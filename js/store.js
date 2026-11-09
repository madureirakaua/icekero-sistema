// Camada de dados compartilhada entre o site e o painel.
// Nesta demonstração tudo fica no localStorage do navegador — abra o site e o
// painel no MESMO navegador e os pedidos aparecem ao vivo. Em produção, troque
// estas funções por chamadas a uma API/banco (ex.: Supabase, Firebase).
const Store = (() => {
  const K = { orders: "ik_orders", cart: "ik_cart", points: "ik_points", settings: "ik_settings", last: "ik_last_order", cliente: "ik_cliente" };

  const read = (k, fallback) => {
    try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
  };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };

  const STATUS = [
    { id: "novo", nome: "Pedido recebido", emoji: "📥" },
    { id: "preparo", nome: "Em preparo", emoji: "🍨" },
    { id: "rota", nome: "Saiu para entrega", nomeRetirada: "Pronto para retirada", emoji: "🛵", emojiRetirada: "🏪" },
    { id: "entregue", nome: "Entregue", nomeRetirada: "Retirado", emoji: "✅" },
  ];

  const onlyDigits = (s) => (s || "").replace(/\D/g, "");

  return {
    STATUS,
    K,
    onlyDigits,
    // carrinho
    getCart: () => read(K.cart, []),
    setCart: (c) => write(K.cart, c),
    // pedidos
    getOrders: () => read(K.orders, []),
    setOrders: (o) => write(K.orders, o),
    addOrder(order) {
      const all = this.getOrders();
      all.unshift(order);
      this.setOrders(all);
      write(K.last, order.id);
      return order;
    },
    updateOrder(id, patch) {
      const all = this.getOrders().map((o) => (o.id === id ? { ...o, ...patch, updatedAt: Date.now() } : o));
      this.setOrders(all);
    },
    getOrder: (id) => read(K.orders, []).find((o) => o.id === id),
    // Recusa (pedido ainda não aceito) ou cancela (já em andamento).
    // Devolve ao cliente os pontos usados e retira os pontos que o pedido gerou.
    cancelOrder(id, motivo) {
      const o = this.getOrder(id);
      if (!o || o.status === "cancelado" || o.status === "entregue") return null;
      const tipo = o.status === "novo" ? "recusado" : "cancelado";
      if (o.cliente?.tel) {
        const pts = this.getPoints(o.cliente.tel) - (o.pontosGanhos || 0) + (o.pontosUsados || 0);
        this.setPoints(o.cliente.tel, pts);
      }
      this.updateOrder(id, { status: "cancelado", cancelTipo: tipo, cancelMotivo: motivo, statusAnterior: o.status, canceladoEm: Date.now() });
      return tipo;
    },
    lastOrderId: () => read(K.last, null),
    nextCode() {
      const n = this.getOrders().length + 1;
      return "#" + String(1000 + n);
    },
    // fidelidade
    getPoints: (tel) => (read(K.points, {})[onlyDigits(tel)] || 0),
    setPoints(tel, pts) {
      const all = read(K.points, {});
      all[onlyDigits(tel)] = Math.max(0, pts);
      write(K.points, all);
    },
    // cliente deste aparelho (lembrado após o primeiro pedido)
    getCliente: () => read(K.cliente, null),
    setCliente: (c) => write(K.cliente, c),
    ordersByPhone(tel) {
      const d = onlyDigits(tel);
      if (d.length < 10) return [];
      return this.getOrders().filter((o) => onlyDigits(o.cliente?.tel) === d);
    },
    // configurações da loja
    getSettings: () => read(K.settings, { aberta: null }),
    setSettings: (s) => write(K.settings, s),
  };
})();

const brl = (v) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
