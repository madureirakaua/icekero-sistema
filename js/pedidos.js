// Página "Meus pedidos": o cliente acompanha os pedidos ao vivo e vê o histórico.
// Nesta demonstração a busca é só pelo celular. Em produção, confirme o número
// com um código por SMS/WhatsApp antes de mostrar os pedidos.
(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PAG = { pix: "Pix", cartao: "Cartão", dinheiro: "Dinheiro" };
  const byId = Object.fromEntries(PRODUTOS.map((p) => [p.id, p]));
  const byName = Object.fromEntries(PRODUTOS.map((p) => [p.nome, p]));
  const ativo = (o) => o.status !== "entregue" && o.status !== "cancelado";

  let tel = (Store.getCliente() || {}).tel || "";

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
    const min = minDesde(o.createdAt);
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
        `Previsão: ${LOJA.tempoEntrega} • feito há ${min} min`}</p>
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

  function render() {
    const who = $("#who"), out = $("#ordersOut");
    if (document.activeElement !== $("#lkTel")) $("#lkTel").value = tel;
    if (Store.onlyDigits(tel).length < 10) {
      who.innerHTML = "";
      out.innerHTML = `<div class="orders-empty"><div>📱</div><h3>Digite seu celular</h3><p>Use o mesmo número que você informou ao fazer o pedido.</p></div>`;
      return;
    }
    const list = Store.ordersByPhone(tel).sort((a, b) => b.createdAt - a.createdAt);
    const pts = Store.getPoints(tel);
    const cli = list[0]?.cliente?.nome || Store.getCliente()?.nome;
    who.innerHTML = `<span>${cli ? `Olá, <b>${esc(cli.split(" ")[0])}</b>! ` : ""}⭐ Você tem <b>${pts} ${pts === 1 ? "ponto" : "pontos"}</b> no Clube Ice Kero.</span>
      <button class="link-btn" id="trocar">Não é você? Trocar número</button>`;
    if (!list.length) {
      out.innerHTML = `<div class="orders-empty"><div>🍦</div><h3>Nenhum pedido encontrado</h3><p>Ainda não há pedidos para este número.</p><a href="index.html#cardapio" class="btn btn-pink">Fazer meu primeiro pedido</a></div>`;
      return;
    }
    const ativos = list.filter(ativo), hist = list.filter((o) => !ativo(o));
    out.innerHTML = `
      ${ativos.length ? `<h2 class="orders-sub">Em andamento <span>${ativos.length}</span></h2><div class="ord-grid">${ativos.map(activeCard).join("")}</div>` :
        `<div class="orders-empty slim"><p>Nenhum pedido em andamento agora.</p><a href="index.html#cardapio" class="btn btn-pink">Fazer um pedido</a></div>`}
      ${hist.length ? `<h2 class="orders-sub">Histórico <span>${hist.length}</span></h2><div class="ord-grid past">${hist.map(pastCard).join("")}</div>` : ""}`;
  }

  // buscar por celular
  $("#lookup").addEventListener("submit", (e) => {
    e.preventDefault();
    const v = $("#lkTel").value.trim();
    if (Store.onlyDigits(v).length < 10) { toast("Digite o celular com DDD"); return; }
    tel = v;
    render();
  });
  document.addEventListener("click", (e) => {
    if (e.target.closest("#trocar")) { tel = ""; render(); $("#lkTel").focus(); return; }
    const again = e.target.closest("[data-again]");
    if (again) {
      const o = Store.getOrder(again.dataset.again); if (!o) return;
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

  // atualiza ao vivo quando a loja muda o status no painel
  window.addEventListener("storage", (e) => {
    if (e.key !== Store.K.orders) return;
    const antes = render.snap || {};
    render();
    // avisa mudanças de status dos pedidos deste cliente
    Store.ordersByPhone(tel).forEach((o) => {
      if (antes[o.id] && antes[o.id] !== o.status) {
        const h = headline(o);
        toast(`${o.code}: ${h.emoji} ${h.txt}`);
      }
    });
    snap();
  });
  function snap() { render.snap = Object.fromEntries(Store.ordersByPhone(tel).map((o) => [o.id, o.status])); }

  render(); snap();
  setInterval(render, 60000); // atualiza o "feito há X min"
})();
