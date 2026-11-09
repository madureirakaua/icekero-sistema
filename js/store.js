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
    userId: r.user_id, storeId: r.store_id, distancia: r.distancia_km != null ? Number(r.distancia_km) : null,
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
  fora_da_area: "Esse endereço está fora da área de entrega da loja. Você pode retirar o pedido.",
  endereco_sem_localizacao: "Não encontramos seu endereço no mapa. Confira o CEP ou use sua localização.",
  loja_invalida: "Loja indisponível. Escolha outra unidade.",
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

  // ---------- lojas ----------
  async stores() {
    const { data, error } = await sb.from("stores").select("*").eq("ativo", true).order("ordem");
    if (error) throw error;
    return data.map((s) => ({ ...s, taxa_base: Number(s.taxa_base), km_inclusos: Number(s.km_inclusos), taxa_km: Number(s.taxa_km), raio_km: Number(s.raio_km) }));
  },
  // minutos desde 00:00 no horário de Brasília
  nowMin() {
    const p = new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "America/Sao_Paulo" }).format(new Date());
    const [h, m] = p.split(":").map(Number);
    return (h % 24) * 60 + m;
  },
  isOpen(s) {
    if (!s || !s.ativo) return false;
    if (s.aberta === true || s.aberta === false) return s.aberta;
    const n = this.nowMin();
    return n >= s.abre_min && n < s.fecha_min;
  },
  hora(min) { const h = Math.floor(min / 60), m = min % 60; return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`; },
  async setOpen(storeId, v) { const { error } = await sb.rpc("set_store_open", { p_store: storeId, p_aberta: v }); if (error) throw error; },

  // ---------- pedidos ----------
  async placeOrder({ store, itens, tipo, endereco, pagamento, troco, usarPontos }) {
    const { data, error } = await sb.rpc("place_order", {
      p_store: store, p_itens: itens, p_tipo: tipo, p_endereco: endereco, p_pagamento: pagamento,
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
  watchStores(cb) {
    return sb.channel("stores-" + Math.random().toString(36).slice(2)).on("postgres_changes", { event: "*", schema: "public", table: "stores" }, (p) => cb(p.new)).subscribe();
  },
};

// ---------- Endereço → coordenadas → loja mais próxima ----------
// CEP: ViaCEP (gratuito). Coordenadas: Nominatim/OpenStreetMap (gratuito, uso moderado).
// Em produção com muito movimento, troque o geocode por Google Maps ou Mapbox.
const Geo = {
  async cep(cep) {
    const d = onlyDigits(cep);
    if (d.length !== 8) throw new Error("cep_invalido");
    const r = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    const j = await r.json();
    if (j.erro) throw new Error("cep_nao_encontrado");
    return { cep: j.cep, rua: j.logradouro, bairro: j.bairro, cidade: j.localidade, uf: j.uf };
  },
  async _search(params) {
    const url = "https://nominatim.openstreetmap.org/search?" + new URLSearchParams({ format: "jsonv2", limit: "1", countrycodes: "br", "accept-language": "pt-BR", ...params });
    const r = await fetch(url);
    const j = await r.json();
    return j[0] ? { lat: Number(j[0].lat), lng: Number(j[0].lon) } : null;
  },
  // tenta pela rua e número; se não achar, pelo CEP; por último, pelo bairro
  async geocode({ rua, num, bairro, cidade = "Belo Horizonte", uf = "MG", cep }) {
    const tries = [];
    if (rua) tries.push({ street: `${num || ""} ${rua}`.trim(), city: cidade, state: uf, ...(cep ? { postalcode: onlyDigits(cep) } : {}) });
    if (rua) tries.push({ street: `${num || ""} ${rua}`.trim(), city: cidade, state: uf });
    if (cep) tries.push({ postalcode: onlyDigits(cep).replace(/(\d{5})(\d{3})/, "$1-$2"), country: "Brasil" });
    if (bairro) tries.push({ q: `${bairro}, ${cidade}, ${uf}` });
    for (const t of tries) {
      try {
        const p = await this._search(t);
        if (p) return { ...p, precisao: t.street ? "rua" : t.q ? "bairro" : "cep" };
      } catch {}
    }
    return null;
  },
  async reverse(lat, lng) {
    const url = "https://nominatim.openstreetmap.org/reverse?" + new URLSearchParams({ format: "jsonv2", lat, lon: lng, "accept-language": "pt-BR", zoom: "18" });
    const j = await (await fetch(url)).json();
    const a = j.address || {};
    return { rua: a.road || "", num: a.house_number || "", bairro: a.suburb || a.neighbourhood || a.city_district || "", cidade: a.city || a.town || "", uf: "MG", cep: a.postcode || "" };
  },
  here() {
    return new Promise((res, rej) => {
      if (!navigator.geolocation) return rej(new Error("sem_gps"));
      navigator.geolocation.getCurrentPosition((p) => res({ lat: p.coords.latitude, lng: p.coords.longitude }), rej, { enableHighAccuracy: true, timeout: 12000 });
    });
  },
  dist(lat1, lng1, lat2, lng2) {
    const R = 6371, rad = (x) => (x * Math.PI) / 180;
    const a = Math.sin(rad(lat2 - lat1) / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lng2 - lng1) / 2) ** 2;
    return R * 2 * Math.asin(Math.sqrt(a));
  },
  // mesma regra de taxa do servidor
  taxa(store, km) { return store.taxa_base + Math.max(0, Math.ceil(km - store.km_inclusos)) * store.taxa_km; },
  // lojas ordenadas pela distância, com taxa e se atendem o endereço
  rank(stores, lat, lng) {
    return stores.map((s) => {
      const km = this.dist(lat, lng, s.lat, s.lng);
      return { store: s, km, taxa: this.taxa(s, km), atende: km <= s.raio_km, aberta: Api.isOpen(s) };
    }).sort((a, b) => a.km - b.km);
  },
  km(v) { return v < 1 ? `${Math.round(v * 1000)} m` : `${v.toFixed(1).replace(".", ",")} km`; },
};

// Sacola: continua no navegador
const Store = {
  STATUS, onlyDigits,
  getCart() { try { return JSON.parse(localStorage.getItem("ik_cart")) || []; } catch { return []; } },
  setCart(c) { try { localStorage.setItem("ik_cart", JSON.stringify(c)); } catch {} },
};
