// Camada de dados do site e do painel.
// Contas, perfis, pedidos e pontos ficam no Supabase. As regras de segurança do
// banco garantem que cada cliente só vê os próprios dados e que só a equipe
// mexe nos pedidos. Preços e pontos são calculados no servidor (place_order).
// Só a sacola continua no navegador, porque não é informação sensível.

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});

const STATUS = [
  { id: "novo", nome: "Pedido recebido", emoji: "📥" },
  { id: "preparo", nome: "Em preparo", emoji: "🍨" },
  { id: "rota", nome: "Saiu para entrega", nomeRetirada: "Pronto para retirada", emoji: "🛵", emojiRetirada: "🏪" },
  { id: "entregue", nome: "Entregue", nomeRetirada: "Retirado", emoji: "✅" },
];

const onlyDigits = (s) => (s || "").replace(/\D/g, "");
const brl = (v) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

// Converte a linha do banco para o formato usado nas telas
function normOrder(r) {
  return {
    id: r.id, code: r.code, status: r.status, tipo: r.tipo, endereco: r.endereco,
    pagamento: r.pagamento, troco: r.troco, itens: r.itens || [],
    sub: Number(r.sub), taxa: Number(r.taxa), desc: Number(r.desconto), total: Number(r.total),
    pontosUsados: r.pontos_usados, pontosGanhos: r.pontos_ganhos,
    cancelTipo: r.cancel_tipo, cancelMotivo: r.cancel_motivo,
    createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at),
    userId: r.user_id,
    cliente: { nome: r.cliente_nome, tel: r.cliente_tel },
  };
}

// Mensagens de erro em português
const ERROS = {
  not_authenticated: "Entre na sua conta para continuar.",
  loja_fechada: "A loja está fechada agora. Volte no horário de funcionamento!",
  perfil_incompleto: "Complete seu nome e celular em Meus dados.",
  endereco_incompleto: "Preencha rua, número e bairro.",
  produto_indisponivel: "Um item da sacola não está mais disponível.",
  adicionais_invalidos: "Revise os adicionais escolhidos.",
  quantidade_invalida: "Quantidade inválida.",
  itens_invalidos: "Sua sacola está vazia.",
  acesso_negado: "Sua conta não tem permissão para isso.",
  status_final: "Este pedido já foi finalizado.",
  motivo_obrigatorio: "Informe o motivo.",
  "Invalid login credentials": "E-mail ou senha incorretos.",
  "User already registered": "Este e-mail já tem conta. Entre com sua senha.",
  "Email not confirmed": "Confirme seu e-mail pelo link que enviamos antes de entrar.",
  "Password should be at least 6 characters": "A senha precisa ter pelo menos 6 caracteres.",
  "Unable to validate email address: invalid format": "E-mail inválido.",
  "Email rate limit exceeded": "Muitas tentativas. Aguarde alguns minutos.",
};
function errMsg(e) {
  const m = (e && (e.message || e.error_description || e)) + "";
  for (const k of Object.keys(ERROS)) if (m.includes(k)) return ERROS[k];
  if (/fetch|network/i.test(m)) return "Sem conexão. Verifique sua internet.";
  return "Algo deu errado. Tente novamente.";
}

const Api = {
  // ---------- conta ----------
  async user() { const { data } = await sb.auth.getSession(); return data.session?.user || null; },
  onAuth(cb) { return sb.auth.onAuthStateChange((ev, session) => cb(ev, session?.user || null)); },
  async signUp({ nome, telefone, email, senha }) {
    const { data, error } = await sb.auth.signUp({
      email, password: senha,
      options: { data: { nome, telefone }, emailRedirectTo: location.origin + location.pathname },
    });
    if (error) throw error;
    // sem sessão = o Supabase exige confirmar o e-mail antes
    return { precisaConfirmar: !data.session };
  },
  async signIn(email, senha) {
    const { error } = await sb.auth.signInWithPassword({ email, password: senha });
    if (error) throw error;
  },
  async signOut() { await sb.auth.signOut(); },
  async resetPassword(email) {
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    if (error) throw error;
  },
  async updatePassword(senha) { const { error } = await sb.auth.updateUser({ password: senha }); if (error) throw error; },

  // ---------- perfil ----------
  async profile() {
    const u = await this.user(); if (!u) return null;
    const { data, error } = await sb.from("profiles").select("*").eq("id", u.id).single();
    if (error) throw error;
    return { ...data, email: u.email };
  },
  async updateProfile({ nome, telefone }) {
    const u = await this.user();
    const { error } = await sb.from("profiles").update({ nome, telefone }).eq("id", u.id);
    if (error) throw error;
  },

  // ---------- loja ----------
  async settings() {
    const { data, error } = await sb.from("store_settings").select("*").eq("id", 1).single();
    if (error) throw error;
    return data;
  },
  isOpen(s) {
    if (!s) return false;
    if (s.aberta === true || s.aberta === false) return s.aberta;
    const h = Number(new Date().toLocaleString("en-US", { hour: "numeric", hour12: false, timeZone: "America/Sao_Paulo" })) % 24;
    return h >= s.abre_hora && h < s.fecha_hora;
  },
  async setOpen(v) { const { error } = await sb.rpc("set_store_open", { p_aberta: v }); if (error) throw error; },

  // ---------- pedidos ----------
  async placeOrder({ itens, tipo, endereco, pagamento, troco, usarPontos }) {
    const { data, error } = await sb.rpc("place_order", {
      p_itens: itens, p_tipo: tipo, p_endereco: endereco, p_pagamento: pagamento,
      p_troco: troco || null, p_usar_pontos: !!usarPontos,
    });
    if (error) throw error;
    return normOrder(data);
  },
  // RLS: o cliente só recebe os próprios pedidos; a equipe recebe todos
  async myOrders() {
    const { data, error } = await sb.from("orders").select("*").order("created_at", { ascending: false }).limit(50);
    if (error) throw error;
    return data.map(normOrder);
  },
  async getOrder(id) {
    const { data, error } = await sb.from("orders").select("*").eq("id", id).maybeSingle();
    if (error) throw error;
    return data ? normOrder(data) : null;
  },
  async boardOrders() {
    const start = new Date(); start.setHours(0, 0, 0, 0);
    const { data, error } = await sb.from("orders").select("*")
      .or(`created_at.gte.${start.toISOString()},status.in.(novo,preparo,rota)`)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return data.map(normOrder);
  },
  async advance(id) { const { data, error } = await sb.rpc("advance_order", { p_id: id }); if (error) throw error; return normOrder(data); },
  async cancel(id, motivo) { const { data, error } = await sb.rpc("cancel_order", { p_id: id, p_motivo: motivo }); if (error) throw error; return normOrder(data); },

  // ---------- tempo real ----------
  watchOrders(name, filter, cb) {
    const opts = { event: "*", schema: "public", table: "orders" };
    if (filter) opts.filter = filter;
    return sb.channel(name).on("postgres_changes", opts, (p) => cb(p.eventType, p.new && p.new.id ? normOrder(p.new) : null)).subscribe();
  },
  watchSettings(cb) {
    return sb.channel("settings").on("postgres_changes", { event: "*", schema: "public", table: "store_settings" }, (p) => cb(p.new)).subscribe();
  },
};

// Sacola: continua no navegador
const Store = {
  STATUS, onlyDigits,
  getCart() { try { return JSON.parse(localStorage.getItem("ik_cart")) || []; } catch { return []; } },
  setCart(c) { try { localStorage.setItem("ik_cart", JSON.stringify(c)); } catch {} },
};
