-- Várias unidades: lojas com coordenadas, pedido ligado à loja, taxa pela distância
-- e funcionário que só enxerga a própria loja. Já aplicado no projeto "icekero".

-- ============ LOJAS ============
create table public.stores (
  id text primary key,
  nome text not null,
  endereco text not null,
  bairro text not null,
  cep text,
  telefone text,
  lat double precision not null,
  lng double precision not null,
  abre_min integer not null,          -- minutos desde 00:00 (horário de Brasília)
  fecha_min integer not null,
  aberta boolean,                     -- null = automático pelo horário
  taxa_base numeric(10,2) not null default 5,   -- taxa até km_inclusos
  km_inclusos numeric not null default 3,
  taxa_km numeric(10,2) not null default 1,     -- + por km depois disso
  raio_km numeric not null default 8,           -- área máxima de entrega
  ativo boolean not null default true,
  ordem integer not null default 0,
  updated_at timestamptz not null default now()
);
alter table public.stores enable row level security;
create policy "lojas: todos leem" on public.stores for select to anon, authenticated using (true);
revoke insert, update, delete on public.stores from anon, authenticated;

-- Dados do Google Maps em 09/11/2026. Horário de fechamento de Floramar e Santa Efigênia a confirmar (22h).
insert into public.stores (id, nome, endereco, bairro, cep, telefone, lat, lng, abre_min, fecha_min, ordem) values
 ('floramar', 'Floramar', 'Av. José Lopes Muradas, 277', 'Floramar', '31742-084', '(31) 3272-6248', -19.8357544, -43.9345791, 600, 1320, 1),
 ('tupi', 'Tupi', 'R. Emílio Cardoso Aíres, 274', 'Tupi', '31844-090', '(31) 3272-6248', -19.8390739, -43.9173509, 660, 1320, 2),
 ('santa-efigenia', 'Santa Efigênia', 'Av. Mem de Sá, 271', 'Santa Efigênia', '30260-270', '(31) 99503-8825', -19.9200486, -43.9105574, 390, 1320, 3);

-- distância em linha reta (km)
create or replace function public.dist_km(lat1 double precision, lng1 double precision, lat2 double precision, lng2 double precision)
returns double precision language sql immutable set search_path = ''
as $$
  select 6371 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)))
$$;

create or replace function public.store_aberta(p_store text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select s.ativo and coalesce(s.aberta,
    (extract(hour from (now() at time zone 'America/Sao_Paulo')) * 60
      + extract(minute from (now() at time zone 'America/Sao_Paulo'))) between s.abre_min and s.fecha_min - 1)
  from public.stores s where s.id = p_store
$$;

-- ============ FUNCIONÁRIO POR LOJA ============
alter table public.profiles add column store_id text references public.stores(id); -- null = todas as lojas (dono)

create or replace function public.staff_can(p_store text)
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from public.profiles p
    where p.id = auth.uid() and p.is_staff and (p.store_id is null or p.store_id = p_store))
$$;

-- ============ PEDIDO LIGADO À LOJA ============
alter table public.orders add column store_id text references public.stores(id);
alter table public.orders add column distancia_km numeric(6,2);
update public.orders set store_id = 'floramar' where store_id is null;
alter table public.orders alter column store_id set not null;
create index orders_store_idx on public.orders (store_id, created_at desc);

drop policy "pedido: dono ou equipe le" on public.orders;
create policy "pedido: dono ou equipe da loja le" on public.orders for select to authenticated
  using (user_id = (select auth.uid()) or public.staff_can(store_id));

-- ============ FUNÇÕES ============
drop function public.place_order(jsonb, text, jsonb, text, text, boolean);
create or replace function public.place_order(
  p_store text, p_itens jsonb, p_tipo text, p_endereco jsonb, p_pagamento text, p_troco text, p_usar_pontos boolean
) returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_prof public.profiles;
  v_loja public.stores;
  v_item jsonb; v_prod public.products;
  v_qtd integer; v_extras jsonb; v_extra text;
  v_out jsonb := '[]'::jsonb;
  v_sub numeric := 0; v_taxa numeric := 0; v_desc numeric := 0; v_total numeric;
  v_usados integer := 0; v_ganhos integer;
  v_end text := null; v_dist numeric := null;
  v_lat double precision; v_lng double precision;
  v_ord public.orders;
  v_permitidos text[] := array['Leite condensado','Leite em pó','Granola','Banana','Morango','Paçoca','Amendoim granulado',
    'Creme de avelã','Ovomaltine','Oreo','Chantilly','Canudo biju','Confete','Creme de Ninho','Kiwi','Mel'];
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select * into v_loja from public.stores where id = p_store and ativo;
  if v_loja.id is null then raise exception 'loja_invalida'; end if;
  if not public.store_aberta(p_store) then raise exception 'loja_fechada'; end if;
  if p_tipo not in ('entrega','retirada') then raise exception 'tipo_invalido'; end if;
  if p_pagamento not in ('pix','cartao','dinheiro') then raise exception 'pagamento_invalido'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 or jsonb_array_length(p_itens) > 30 then
    raise exception 'itens_invalidos';
  end if;

  select * into v_prof from public.profiles where id = v_uid for update;
  if v_prof.id is null or length(v_prof.nome) < 2 or length(regexp_replace(v_prof.telefone, '\D', '', 'g')) < 10 then
    raise exception 'perfil_incompleto';
  end if;

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
    begin
      v_lat := (p_endereco->>'lat')::double precision;
      v_lng := (p_endereco->>'lng')::double precision;
    exception when others then v_lat := null; v_lng := null; end;
    if v_lat is null or v_lng is null or v_lat not between -34 and 6 or v_lng not between -74 and -28 then
      raise exception 'endereco_sem_localizacao';
    end if;
    v_dist := round(public.dist_km(v_lat, v_lng, v_loja.lat, v_loja.lng)::numeric, 2);
    if v_dist > v_loja.raio_km then raise exception 'fora_da_area'; end if;
    v_taxa := v_loja.taxa_base + greatest(0, ceil(v_dist - v_loja.km_inclusos)) * v_loja.taxa_km;
    v_end := left(trim(p_endereco->>'rua'), 120) || ', ' || left(trim(p_endereco->>'num'), 12)
      || case when coalesce(trim(p_endereco->>'comp'), '') <> '' then ' – ' || left(trim(p_endereco->>'comp'), 60) else '' end
      || ' — ' || left(trim(p_endereco->>'bairro'), 60);
    update public.profiles set endereco = jsonb_build_object(
      'cep', left(coalesce(trim(p_endereco->>'cep'),''),9),
      'rua', left(trim(p_endereco->>'rua'),120), 'num', left(trim(p_endereco->>'num'),12),
      'bairro', left(trim(p_endereco->>'bairro'),60), 'comp', left(coalesce(trim(p_endereco->>'comp'),''),60),
      'lat', v_lat, 'lng', v_lng)
      where id = v_uid;
  end if;

  if coalesce(p_usar_pontos, false) and v_prof.pontos >= 10 then
    v_desc := 5; v_usados := 10;
  end if;
  v_total := greatest(0, v_sub + v_taxa - v_desc);
  v_ganhos := floor(v_total / 20);

  update public.profiles set pontos = pontos - v_usados + v_ganhos where id = v_uid;

  insert into public.orders (user_id, store_id, cliente_nome, cliente_tel, tipo, endereco, distancia_km, pagamento, troco, itens,
    sub, taxa, desconto, total, pontos_usados, pontos_ganhos)
  values (v_uid, p_store, v_prof.nome, v_prof.telefone, p_tipo, v_end, v_dist, p_pagamento,
    case when p_pagamento = 'dinheiro' then left(nullif(trim(coalesce(p_troco,'')), ''), 12) end,
    v_out, v_sub, v_taxa, v_desc, v_total, v_usados, v_ganhos)
  returning * into v_ord;
  return v_ord;
end $$;

create or replace function public.advance_order(p_id uuid)
returns public.orders language plpgsql security definer set search_path = ''
as $$
declare v_ord public.orders; v_next text;
begin
  select * into v_ord from public.orders where id = p_id for update;
  if v_ord.id is null then raise exception 'pedido_nao_encontrado'; end if;
  if not public.staff_can(v_ord.store_id) then raise exception 'acesso_negado'; end if;
  v_next := case v_ord.status when 'novo' then 'preparo' when 'preparo' then 'rota' when 'rota' then 'entregue' end;
  if v_next is null then raise exception 'status_final'; end if;
  update public.orders set status = v_next, updated_at = now() where id = p_id returning * into v_ord;
  return v_ord;
end $$;

create or replace function public.cancel_order(p_id uuid, p_motivo text)
returns public.orders language plpgsql security definer set search_path = ''
as $$
declare v_ord public.orders;
begin
  if coalesce(trim(p_motivo), '') = '' then raise exception 'motivo_obrigatorio'; end if;
  select * into v_ord from public.orders where id = p_id for update;
  if v_ord.id is null then raise exception 'pedido_nao_encontrado'; end if;
  if not public.staff_can(v_ord.store_id) then raise exception 'acesso_negado'; end if;
  if v_ord.status in ('entregue','cancelado') then raise exception 'status_final'; end if;
  update public.profiles set pontos = greatest(0, pontos - v_ord.pontos_ganhos + v_ord.pontos_usados)
    where id = v_ord.user_id;
  update public.orders set status = 'cancelado',
    cancel_tipo = case when v_ord.status = 'novo' then 'recusado' else 'cancelado' end,
    cancel_motivo = left(trim(p_motivo), 200), status_anterior = v_ord.status, updated_at = now()
    where id = p_id returning * into v_ord;
  return v_ord;
end $$;

drop function public.set_store_open(boolean);
create or replace function public.set_store_open(p_store text, p_aberta boolean)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if not public.staff_can(p_store) then raise exception 'acesso_negado'; end if;
  update public.stores set aberta = p_aberta, updated_at = now() where id = p_store;
end $$;

-- a configuração única deu lugar às lojas
alter publication supabase_realtime drop table public.store_settings;
drop function public.loja_aberta();
drop table public.store_settings;
alter publication supabase_realtime add table public.stores;

-- permissões
revoke execute on function public.place_order(text,jsonb,text,jsonb,text,text,boolean) from public, anon;
revoke execute on function public.set_store_open(text,boolean) from public, anon;
revoke execute on function public.staff_can(text) from public, anon;
revoke execute on function public.store_aberta(text) from public;
grant execute on function public.place_order(text,jsonb,text,jsonb,text,text,boolean) to authenticated;
grant execute on function public.set_store_open(text,boolean) to authenticated;
grant execute on function public.staff_can(text) to authenticated;
grant execute on function public.store_aberta(text) to anon, authenticated;
grant execute on function public.dist_km(double precision,double precision,double precision,double precision) to anon, authenticated;

-- ============ FUNCIONÁRIO DE UMA LOJA ============
-- Depois que a pessoa criar a conta pelo site:
--   update public.profiles set is_staff = true, store_id = 'tupi'   -- ou 'floramar', 'santa-efigenia'
--   where id = (select id from auth.users where email = 'funcionario@exemplo.com');
-- Para o dono ver todas as lojas, deixe store_id = null.
