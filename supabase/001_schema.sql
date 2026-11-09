-- Banco de dados da Ice Kero (Supabase / Postgres).
-- Já aplicado no projeto "icekero". Mantido aqui para referência e para recriar o banco.
-- Ordem: 001_schema.sql, 002_cardapio.sql e 003_multiplas_lojas.sql.

-- ============ PERFIS ============
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null default '',
  telefone text not null default '',
  endereco jsonb,
  pontos integer not null default 0 check (pontos >= 0),
  is_staff boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = ''
as $$ select coalesce((select p.is_staff from public.profiles p where p.id = auth.uid()), false) $$;

create policy "perfil: dono ou equipe le" on public.profiles for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));
create policy "perfil: dono atualiza" on public.profiles for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- cliente só pode alterar nome, telefone e endereço (nunca pontos nem is_staff)
revoke insert, update, delete on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;
grant update (nome, telefone, endereco) on public.profiles to authenticated;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, nome, telefone)
  values (new.id,
          left(coalesce(new.raw_user_meta_data->>'nome', ''), 80),
          left(coalesce(new.raw_user_meta_data->>'telefone', ''), 20));
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============ PRODUTOS (preço oficial fica no servidor) ============
create table public.products (
  id text primary key,
  nome text not null,
  cat text not null,
  preco numeric(10,2) not null check (preco >= 0),
  monte integer not null default 0,
  ativo boolean not null default true
);
alter table public.products enable row level security;
create policy "produtos: todos leem" on public.products for select to anon, authenticated using (true);
revoke insert, update, delete on public.products from anon, authenticated;

-- ============ CONFIGURAÇÕES DA LOJA ============
create table public.store_settings (
  id integer primary key default 1 check (id = 1),
  aberta boolean,              -- null = automático pelo horário
  abre_hora integer not null default 11,
  fecha_hora integer not null default 22,
  taxa_entrega numeric(10,2) not null default 5,
  updated_at timestamptz not null default now()
);
insert into public.store_settings (id) values (1);
alter table public.store_settings enable row level security;
create policy "config: todos leem" on public.store_settings for select to anon, authenticated using (true);
revoke insert, update, delete on public.store_settings from anon, authenticated;

create or replace function public.loja_aberta()
returns boolean language sql stable security definer set search_path = ''
as $$
  select coalesce(s.aberta,
    extract(hour from (now() at time zone 'America/Sao_Paulo')) >= s.abre_hora
    and extract(hour from (now() at time zone 'America/Sao_Paulo')) < s.fecha_hora)
  from public.store_settings s where s.id = 1
$$;

-- ============ PEDIDOS ============
create sequence public.order_code_seq start 1001;
create table public.orders (
  id uuid primary key default gen_random_uuid(),
  code text not null unique default ('#' || nextval('public.order_code_seq')),
  user_id uuid not null references auth.users(id) on delete cascade,
  cliente_nome text not null,
  cliente_tel text not null,
  status text not null default 'novo' check (status in ('novo','preparo','rota','entregue','cancelado')),
  tipo text not null check (tipo in ('entrega','retirada')),
  endereco text,
  pagamento text not null check (pagamento in ('pix','cartao','dinheiro')),
  troco text,
  itens jsonb not null,
  sub numeric(10,2) not null,
  taxa numeric(10,2) not null,
  desconto numeric(10,2) not null default 0,
  total numeric(10,2) not null,
  pontos_usados integer not null default 0,
  pontos_ganhos integer not null default 0,
  cancel_tipo text,
  cancel_motivo text,
  status_anterior text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index orders_user_idx on public.orders (user_id, created_at desc);
create index orders_created_idx on public.orders (created_at desc);
alter table public.orders enable row level security;
create policy "pedido: dono ou equipe le" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));
-- sem políticas de insert/update/delete: tudo passa pelas funções abaixo
revoke insert, update, delete on public.orders from anon, authenticated;
revoke all on public.orders from anon;

-- ---------- Cliente faz o pedido (preços, taxa e pontos calculados aqui) ----------
create or replace function public.place_order(
  p_itens jsonb, p_tipo text, p_endereco jsonb, p_pagamento text, p_troco text, p_usar_pontos boolean
) returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles;
  v_cfg public.store_settings;
  v_item jsonb; v_prod public.products;
  v_qtd integer; v_extras jsonb; v_extra text;
  v_out jsonb := '[]'::jsonb;
  v_sub numeric := 0; v_taxa numeric := 0; v_desc numeric := 0; v_total numeric;
  v_usados integer := 0; v_ganhos integer;
  v_end text := null;
  v_ord public.orders;
  v_permitidos text[] := array['Leite condensado','Leite em pó','Granola','Banana','Morango','Paçoca','Amendoim granulado',
    'Creme de avelã','Ovomaltine','Oreo','Chantilly','Canudo biju','Confete','Creme de Ninho','Kiwi','Mel'];
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if not public.loja_aberta() then raise exception 'loja_fechada'; end if;
  if p_tipo not in ('entrega','retirada') then raise exception 'tipo_invalido'; end if;
  if p_pagamento not in ('pix','cartao','dinheiro') then raise exception 'pagamento_invalido'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 30 then
    raise exception 'itens_invalidos';
  end if;

  select * into v_prof from public.profiles where id = v_uid for update;
  if v_prof.id is null or length(v_prof.nome) < 2 or length(regexp_replace(v_prof.telefone, '\D', '', 'g')) < 10 then
    raise exception 'perfil_incompleto';
  end if;
  select * into v_cfg from public.store_settings where id = 1;

  for v_item in select * from jsonb_array_elements(p_itens) loop
    select * into v_prod from public.products where id = v_item->>'pid' and ativo;
    if v_prod.id is null then raise exception 'produto_indisponivel'; end if;
    v_qtd := coalesce((v_item->>'qtd')::integer, 0);
    if v_qtd < 1 or v_qtd > 50 then raise exception 'quantidade_invalida'; end if;
    v_extras := coalesce(v_item->'extras', '[]'::jsonb);
    if jsonb_typeof(v_extras) <> 'array' or jsonb_array_length(v_extras) > v_prod.monte then
      raise exception 'adicionais_invalidos';
    end if;
    for v_extra in select jsonb_array_elements_text(v_extras) loop
      if not (v_extra = any(v_permitidos)) then raise exception 'adicionais_invalidos'; end if;
    end loop;
    v_sub := v_sub + v_prod.preco * v_qtd;
    v_out := v_out || jsonb_build_object('pid', v_prod.id, 'nome', v_prod.nome, 'preco', v_prod.preco, 'qtd', v_qtd,
      'extras', v_extras, 'obs', left(coalesce(v_item->>'obs', ''), 140));
  end loop;

  if p_tipo = 'entrega' then
    if coalesce(trim(p_endereco->>'rua'), '') = '' or coalesce(trim(p_endereco->>'num'), '') = ''
       or coalesce(trim(p_endereco->>'bairro'), '') = '' then
      raise exception 'endereco_incompleto';
    end if;
    v_taxa := v_cfg.taxa_entrega;
    v_end := left(trim(p_endereco->>'rua'), 120) || ', ' || left(trim(p_endereco->>'num'), 12)
      || case when coalesce(trim(p_endereco->>'comp'), '') <> '' then ' – ' || left(trim(p_endereco->>'comp'), 60) else '' end
      || ' — ' || left(trim(p_endereco->>'bairro'), 60);
    update public.profiles set endereco = jsonb_build_object(
      'rua', left(trim(p_endereco->>'rua'),120), 'num', left(trim(p_endereco->>'num'),12),
      'bairro', left(trim(p_endereco->>'bairro'),60), 'comp', left(coalesce(trim(p_endereco->>'comp'),''),60))
      where id = v_uid;
  end if;

  if coalesce(p_usar_pontos, false) and v_prof.pontos >= 10 then
    v_desc := 5; v_usados := 10;
  end if;
  v_total := greatest(0, v_sub + v_taxa - v_desc);
  v_ganhos := floor(v_total / 20);

  update public.profiles set pontos = pontos - v_usados + v_ganhos where id = v_uid;

  insert into public.orders (user_id, cliente_nome, cliente_tel, tipo, endereco, pagamento, troco, itens,
    sub, taxa, desconto, total, pontos_usados, pontos_ganhos)
  values (v_uid, v_prof.nome, v_prof.telefone, p_tipo, v_end, p_pagamento,
    case when p_pagamento = 'dinheiro' then left(nullif(trim(coalesce(p_troco,'')), ''), 12) end,
    v_out, v_sub, v_taxa, v_desc, v_total, v_usados, v_ganhos)
  returning * into v_ord;
  return v_ord;
end $$;

-- ---------- Equipe avança o pedido ----------
create or replace function public.advance_order(p_id uuid)
returns public.orders language plpgsql security definer set search_path = ''
as $$
declare v_ord public.orders; v_next text;
begin
  if not public.is_staff() then raise exception 'acesso_negado'; end if;
  select * into v_ord from public.orders where id = p_id for update;
  if v_ord.id is null then raise exception 'pedido_nao_encontrado'; end if;
  v_next := case v_ord.status when 'novo' then 'preparo' when 'preparo' then 'rota' when 'rota' then 'entregue' end;
  if v_next is null then raise exception 'status_final'; end if;
  update public.orders set status = v_next, updated_at = now() where id = p_id returning * into v_ord;
  return v_ord;
end $$;

-- ---------- Equipe recusa/cancela (devolve pontos) ----------
create or replace function public.cancel_order(p_id uuid, p_motivo text)
returns public.orders language plpgsql security definer set search_path = ''
as $$
declare v_ord public.orders;
begin
  if not public.is_staff() then raise exception 'acesso_negado'; end if;
  if coalesce(trim(p_motivo), '') = '' then raise exception 'motivo_obrigatorio'; end if;
  select * into v_ord from public.orders where id = p_id for update;
  if v_ord.id is null then raise exception 'pedido_nao_encontrado'; end if;
  if v_ord.status in ('entregue','cancelado') then raise exception 'status_final'; end if;
  update public.profiles set pontos = greatest(0, pontos - v_ord.pontos_ganhos + v_ord.pontos_usados)
    where id = v_ord.user_id;
  update public.orders set status = 'cancelado',
    cancel_tipo = case when v_ord.status = 'novo' then 'recusado' else 'cancelado' end,
    cancel_motivo = left(trim(p_motivo), 200), status_anterior = v_ord.status, updated_at = now()
    where id = p_id returning * into v_ord;
  return v_ord;
end $$;

-- ---------- Equipe abre/fecha a loja ----------
create or replace function public.set_store_open(p_aberta boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.is_staff() then raise exception 'acesso_negado'; end if;
  update public.store_settings set aberta = p_aberta, updated_at = now() where id = 1;
end $$;

-- ============ PERMISSÕES DAS FUNÇÕES ============
revoke execute on function public.place_order(jsonb,text,jsonb,text,text,boolean) from public, anon;
revoke execute on function public.advance_order(uuid) from public, anon;
revoke execute on function public.cancel_order(uuid,text) from public, anon;
revoke execute on function public.set_store_open(boolean) from public, anon;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.is_staff() from public, anon;
revoke execute on function public.loja_aberta() from public;
grant execute on function public.place_order(jsonb,text,jsonb,text,text,boolean) to authenticated;
grant execute on function public.advance_order(uuid) to authenticated;
grant execute on function public.cancel_order(uuid,text) to authenticated;
grant execute on function public.set_store_open(boolean) to authenticated;
grant execute on function public.is_staff() to authenticated;
grant execute on function public.loja_aberta() to anon, authenticated;

-- ============ TEMPO REAL ============
alter publication supabase_realtime add table public.orders;
alter publication supabase_realtime add table public.store_settings;

-- ============ CRIAR UM FUNCIONÁRIO ============
-- 1) A pessoa cria a conta normalmente pelo site (botão "Entrar" > "Criar conta").
-- 2) Rode no SQL Editor do Supabase, trocando o e-mail:
--    update public.profiles set is_staff = true
--    where id = (select id from auth.users where email = 'funcionario@exemplo.com');
