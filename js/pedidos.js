// Página "Meus pedidos": só com a conta do cliente. Mostra os pedidos ao vivo,
// o histórico e os dados salvos (nome, celular, endereço).
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PAG = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" };
  const byId = Object.fromEntries(PRODUTOS.map((p) => [p.id, p]));
  const byName = Object.fromEntries(PRODUTOS.map((p) => [p.nome, p]));
  const ativo = (o) => o.status !== "entregue" && o.status !== "cancelado";

  let orders = [];
  let channel = null;
  const snap = {}; // status anterior de cada pedido, para avisar mudanças

  $("#footPhone").innerHTML = `<a href="${LOJA.telefoneLink}">${LOJA.telefone}</a><br>${esc(LOJA.endereco)}`;

  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toast.t); toast.t = setTimeout(() => t.classList.remove("show"), 2400);
  }

  const quando = (t) => {
    const d = new Date(t), hoje = new Date();
    const hora = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (d.toDateString() === hoje.toDateString()) return `Hoje, ${hora}`;
    return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + `, ${hora}`;
  };
  const minDesde = (t) => Math.max(0, Math.floor((Date.now() - t) / 60000));
  function nomeEtapa(o, s) { return o.tipo === "retirada" && s.nomeRetirada ? s.nomeRetirada : s.nome; }

  function headline(o) {
    if (o.status === "cancelado") return { emoji: "😕", txt: o.cancelTipo === "recusado" ? "Pedido recusado" : "Pedido cancelado", cls: "bad" };
    const s = Store.STATUS.find((x) => x.id === o.status);
    const emoji = o.tipo === "retirada" && s.emojiRetirada ? s.emojiRetirada : s.emoji;
    return { emoji, txt: nomeEtapa(o, s), cls: o.status === "entregue" ? "ok" : "live" };
  }

  function itensHtml(o) {
    return o.itens.map((i) => `<li><b>${i.qtd}×</b> ${esc(i.nome)}${i.extras?.length ? `<small>+ ${i.extras.map(esc).join(", ")}</small>` : ""}${i.obs ? `<small>“${esc(i.obs)}”</small>` : ""}</li>`).join("");
  }

  function activeCard(o) {
    const h = headline(o);
    const idx = Store.STATUS.findIndex((s) => s.id === o.status);
    const pct = (idx / (Store.STATUS.length - 1)) * 100;
    return `<article class="ord ord-live">
      <div class="ord-top">
        <div>
          <span class="ord-code">${esc(o.code)}</span>
          <span class="ord-when">${quando(o.createdAt)} • ${o.tipo === "entrega" ? "🛵 Entrega" : "🏪 Retirada"}</span>
        </div>
        <span class="live-dot">Ao vivo</span>
      </div>
      <div class="ord-status ${h.cls}"><span>${h.emoji}</span>${esc(h.txt)}</div>
      <p class="ord-eta">${o.status === "novo" ? "Aguardando a loja confirmar…" :
        o.status === "rota" ? (o.tipo === "retirada" ? "Pode vir buscar! 😋" : "Seu pedido está a caminho.") :
        `Previsão: ${LOJA.tempoEntrega} • feito há ${minDesde(o.createdAt)} min`}</p>
      <div class="steps">
        <div class="steps-bar"><i style="width:${pct}%"></i></div>
        ${Store.STATUS.map((s, i) => `<div class="stp ${i < idx ? "done" : i === idx ? "now" : ""}">
          <span class="dot">${i < idx ? "✓" : i + 1}</span><small>${esc(nomeEtapa(o, s))}</small></div>`).join("")}
      </div>
      <details class="ord-more" open>
        <summary>Itens do pedido</summary>
        <ul class="ord-items">${itensHtml(o)}</ul>
        ${o.endereco ? `<p class="ord-addr">📍 ${esc(o.endereco)}</p>` : `<p class="ord-addr">📍 Retirar em: ${esc(LOJA.endereco)}</p>`}
      </details>
      <div class="ord-foot">
        <span>${PAG[o.pagamento] || ""}${o.troco ? ` • troco p/ R$ ${esc(o.troco)}` : ""}</span>
        <strong>${brl(o.total)}</strong>
      </div>
      <a class="ord-help" href="${LOJA.telefoneLink}">Precisa de ajuda com o pedido? Ligue ${LOJA.telefone}</a>
    </article>`;
  }

  function pastCard(o) {
    const h = headline(o);
    const resumo = o.itens.map((i) => `${i.qtd}× ${i.nome}`).join(", ");
    return `<article class="ord ord-past">
      <div class="ord-top">
        <div><span class="ord-code">${esc(o.code)}</span><span class="ord-when">${quando(o.createdAt)}</span></div>
        <span class="ord-badge ${h.cls}">${h.emoji} ${esc(h.txt)}</span>
      </div>
      <p class="ord-resume">${esc(resumo)}</p>
      ${o.status === "cancelado" && o.cancelMotivo ? `<p class="ord-reason">Motivo: ${esc(o.cancelMotivo)}</p>` : ""}
      <div class="ord-foot">
        <strong class="${o.status === "cancelado" ? "strike" : ""}">${brl(o.total)}</strong>
        <button class="btn btn-ghost" data-again="${o.id}">🔁 Pedir de novo</button>
      </div>
    </article>`;
  }

  function renderLoggedOut() {
    $("#who").innerHTML = "";
    $("#dadosOut").innerHTML = "";
    $("#ordersOut").innerHTML = `<div class="orders-empty">
      <div>🔒</div><h3>Entre na sua conta</h3>
      <p>Seus pedidos e dados ficam protegidos na sua conta Ice Kero.</p>
      <button class="btn btn-pink" data-entrar>Entrar ou criar conta</button></div>`;
  }

  function render() {
    const st = Auth.state;
    if (!st.user) return renderLoggedOut();
    const p = st.profile || {};
    $("#who").innerHTML = `<span>Olá, <b>${esc((p.nome || "").split(" ")[0] || st.user.email)}</b>! ⭐ Você tem <b>${p.pontos ?? 0} ${p.pontos === 1 ? "ponto" : "pontos"}</b> no Clube Ice Kero.</span>
      <a class="link-btn" href="#dados">Meus dados</a>`;
    const out = $("#ordersOut");
    if (!orders.length) {
      out.innerHTML = `<div class="orders-empty"><div>🍦</div><h3>Nenhum pedido ainda</h3><p>Quando você fizer um pedido, ele aparece aqui.</p><a href="index.html#cardapio" class="btn btn-pink">Fazer meu primeiro pedido</a></div>`;
    } else {
      const ativos = orders.filter(ativo), hist = orders.filter((o) => !ativo(o));
      out.innerHTML = `
        ${ativos.length ? `<h2 class="orders-sub">Em andamento <span>${ativos.length}</span></h2><div class="ord-grid">${ativos.map(activeCard).join("")}</div>` :
          `<div class="orders-empty slim"><p>Nenhum pedido em andamento agora.</p><a href="index.html#cardapio" class="btn btn-pink">Fazer um pedido</a></div>`}
        ${hist.length ? `<h2 class="orders-sub">Histórico <span>${hist.length}</span></h2><div class="ord-grid past">${hist.map(pastCard).join("")}</div>` : ""}`;
    }
    renderDados();
  }

  function renderDados() {
    const st = Auth.state; if (!st.user) return;
    const p = st.profile || {}, e = p.endereco || {};
    // não redesenha enquanto o cliente está digitando
    if ($("#dadosForm") && $("#dadosForm").contains(document.activeElement)) return;
    $("#dadosOut").innerHTML = `
      <h2 class="orders-sub" id="dados">Meus dados</h2>
      <form class="ord dados" id="dadosForm">
        <div class="row2">
          <label class="field">Nome <input name="nome" value="${esc(p.nome || "")}" required minlength="2" maxlength="80"></label>
          <label class="field">Celular / WhatsApp <input name="telefone" value="${esc(p.telefone || "")}" inputmode="tel" required></label>
        </div>
        <label class="field">E-mail <input value="${esc(st.user.email)}" disabled></label>
        <p class="ord-addr">📍 Endereço salvo: ${e.rua ? esc(`${e.rua}, ${e.num}${e.comp ? " – " + e.comp : ""} — ${e.bairro}`) : "nenhum ainda (é salvo no seu próximo pedido com entrega)"}</p>
        <div class="dados-acts">
          <button class="btn btn-pink" type="submit">Salvar alterações</button>
          <button class="btn btn-ghost" type="button" data-novasenha>Trocar senha</button>
          <button class="btn btn-ghost" type="button" data-sair>Sair da conta</button>
        </div>
      </form>`;
  }

  async function load() {
    if (!Auth.state.user) { orders = []; render(); return; }
    try {
      orders = await Api.myOrders();
      orders.forEach((o) => (snap[o.id] = o.status));
    } catch (e) { toast(errMsg(e)); }
    render();
  }

  function watch() {
    if (channel) { sb.removeChannel(channel); channel = null; }
    const uid = Auth.state.user?.id; if (!uid) return;
    channel = Api.watchOrders("pagina-" + uid, `user_id=eq.${uid}`, (ev, o) => {
      if (!o) return;
      const i = orders.findIndex((x) => x.id === o.id);
      if (i >= 0) orders[i] = o; else orders.unshift(o);
      if (snap[o.id] && snap[o.id] !== o.status) { const h = headline(o); toast(`${o.code}: ${h.emoji} ${h.txt}`); }
      snap[o.id] = o.status;
      if (o.status === "cancelado") Auth.refresh(); // pontos devolvidos
      render();
    });
  }

  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-entrar]")) { Auth.open({ reason: "Entre para ver seus pedidos." }); return; }
    if (e.target.closest("[data-sair]")) { Api.signOut(); return; }
    if (e.target.closest("[data-novasenha]")) { Auth.open({ mode: "newpass" }); return; }
    const again = e.target.closest("[data-again]");
    if (again) {
      const o = orders.find((x) => x.id === again.dataset.again); if (!o) return;
      const cart = Store.getCart();
      let n = 0;
      o.itens.forEach((i) => {
        const p = byId[i.pid] || byName[i.nome];
        if (!p) return; // item que saiu do cardápio
        const key = p.id + "|" + (i.extras || []).join(",") + "|" + (i.obs || "");
        const found = cart.find((c) => c.key === key);
        if (found) found.qtd += i.qtd;
        else cart.push({ key, pid: p.id, nome: p.nome, preco: p.preco, qtd: i.qtd, extras: i.extras || [], obs: i.obs || "", img: p.img || null, cat: p.cat });
        n += i.qtd;
      });
      Store.setCart(cart);
      location.href = n ? "index.html?sacola=1" : "index.html#cardapio";
    }
  });

  document.addEventListener("submit", async (e) => {
    if (e.target.id !== "dadosForm") return;
    e.preventDefault();
    const v = Object.fromEntries(new FormData(e.target));
    if (onlyDigits(v.telefone).length < 10) { toast("Digite o celular com DDD"); return; }
    const btn = e.target.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      await Api.updateProfile({ nome: v.nome.trim(), telefone: v.telefone.trim() });
      document.activeElement?.blur();
      await Auth.refresh();
      toast("Dados salvos ✅");
    } catch (ex) { toast(errMsg(ex)); }
    finally { btn.disabled = false; }
  });

  Auth.onChange(() => { load(); watch(); });
  Auth.ready.then(() => {
    if (!Auth.state.user) { renderLoggedOut(); Auth.open({ reason: "Entre para ver seus pedidos." }); }
  });
  setInterval(() => { if (Auth.state.user) render(); }, 60000); // atualiza o "feito há X min"
})();
