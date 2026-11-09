(() => {
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = Object.fromEntries(PRODUTOS.map((p) => [p.id, p]));
  const catEmoji = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c.emoji]));

  // ---------- Lojas (vêm do banco) ----------
  let stores = [];
  let userPos = null; // {lat, lng} do cliente, quando conhecido
  let mapStoreId = null;
  const storeById = (id) => stores.find((s) => s.id === id);
  const anyOpen = () => stores.some((s) => Api.isOpen(s));
  const isOpen = anyOpen;
  const telLink = (t) => "tel:+55" + onlyDigits(t);
  const mapsLink = (s) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`Ice Kero ${s.endereco}, ${s.bairro}, Belo Horizonte`)}`;
  const statusTxt = (s) => Api.isOpen(s) ? "Aberta agora" : `Fechada • abre às ${Api.hora(s.abre_min)}`;

  function renderStatus() {
    const pill = $("#statusPill");
    if (!stores.length) { pill.textContent = "Carregando…"; pill.classList.add("closed"); return; }
    const abertas = stores.filter((s) => Api.isOpen(s));
    if (abertas.length) pill.textContent = abertas.length === stores.length ? "Aberto agora" : `${abertas.length} de ${stores.length} lojas abertas`;
    else pill.textContent = `Fechado • abre às ${Api.hora(Math.min(...stores.map((s) => s.abre_min)))}`;
    pill.classList.toggle("closed", !abertas.length);
  }

  function renderStores() {
    $("#storesTitle").textContent = `${stores.length} unidades em BH`;
    const ranked = userPos ? Geo.rank(stores, userPos.lat, userPos.lng) : stores.map((s) => ({ store: s }));
    const nearestOpen = ranked.find((r) => r.km != null && Api.isOpen(r.store));
    $("#storesList").innerHTML = ranked.map((r, i) => {
      const s = r.store, open = Api.isOpen(s);
      return `<article class="store-card ${mapStoreId === s.id ? "active" : ""}" data-store="${s.id}">
        <div class="store-top">
          <h3>Ice Kero ${esc(s.nome)}</h3>
          <span class="store-status ${open ? "" : "off"}">${statusTxt(s)}</span>
        </div>
        ${r.km != null ? `<div class="store-dist">${i === 0 ? "⭐ Mais perto de você • " : ""}${Geo.km(r.km)}${r.atende ? "" : " • fora da área de entrega"}</div>` : ""}
        <p>📍 <a href="${mapsLink(s)}" target="_blank" rel="noopener">${esc(s.endereco)} — ${esc(s.bairro)}</a></p>
        <p>🕚 Todos os dias, ${Api.hora(s.abre_min)} às ${Api.hora(s.fecha_min)}</p>
        <p>📞 <a href="${telLink(s.telefone)}">${esc(s.telefone)}</a></p>
      </article>`;
    }).join("");
    if (!mapStoreId && stores[0]) showMap((nearestOpen || ranked[0]).store.id);
  }
  function showMap(id) {
    const s = storeById(id); if (!s) return;
    mapStoreId = id;
    $("#storeMap").src = `https://maps.google.com/maps?q=${s.lat},${s.lng}&z=16&output=embed`;
    $$(".store-card").forEach((c) => c.classList.toggle("active", c.dataset.store === id));
  }
  $("#storesList").addEventListener("click", (e) => {
    if (e.target.closest("a")) return;
    const c = e.target.closest("[data-store]"); if (c) showMap(c.dataset.store);
  });
  $("#findNearest").addEventListener("click", async () => {
    const b = $("#findNearest"); b.disabled = true; b.textContent = "Localizando…";
    try {
      userPos = await Geo.here();
      const best = Geo.rank(stores, userPos.lat, userPos.lng)[0];
      $("#nearMsg").innerHTML = `A unidade mais perto é a <b>Ice Kero ${esc(best.store.nome)}</b>, a ${Geo.km(best.km)} de você.`;
      mapStoreId = null; renderStores(); showMap(best.store.id);
    } catch {
      $("#nearMsg").textContent = "Não conseguimos sua localização. Você pode digitar o CEP na hora de finalizar o pedido.";
    } finally { b.disabled = false; b.textContent = "📍 Qual loja fica mais perto de mim?"; }
  });

  // ---------- Infos fixas ----------
  function renderInfo() {
    $("#footPhone").innerHTML = stores.map((s) => `${esc(s.nome)}: <a href="${telLink(s.telefone)}">${esc(s.telefone)}</a>`).join("<br>");
    $("#lnkInsta").href = LOJA.instagram;
    $("#lnkFace").href = LOJA.facebook;
    $("#lnkIfood").href = LOJA.ifood;
    $("#footLegal").textContent = `© ${new Date().getFullYear()} ${LOJA.razao} • CNPJ ${LOJA.cnpj}`;
    const stamps = $("#stamps");
    stamps.innerHTML = Array.from({ length: 10 }, (_, i) => `<div class="stamp ${i < 7 ? "on" : ""}">${i < 7 ? "🍦" : ""}</div>`).join("") +
      `<div class="stamps-caption">Faltam só 3 pontos para o seu desconto!</div>`;
  }

  // ---------- Toast ----------
  let toastT;
  function toast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastT);
    toastT = setTimeout(() => t.classList.remove("show"), 2200);
  }

  // ---------- Imagem com fallback ----------
  const pic = (p) => p.img ? `<img src="${p.img}" alt="${esc(p.nome)}" loading="lazy" onerror="this.remove()">` : "";

  // =====================================================
  // MONTE SEU AÇAÍ
  // =====================================================
  const SIZES = ["acai-300", "acai-500", "acai-700"].map((id) => byId[id]);
  const TOP_COLORS = {
    "Leite condensado": "#fff6e0", "Leite em pó": "#fffdf7", "Granola": "#c98b45", "Banana": "#ffe27a", "Morango": "#ff4d6d",
    "Paçoca": "#d9a066", "Amendoim granulado": "#b5763b", "Creme de avelã": "#6b3a1e", "Ovomaltine": "#8a5a2b", "Oreo": "#2b2b2b",
    "Chantilly": "#ffffff", "Canudo biju": "#f2c879", "Confete": "#38b8c8", "Creme de Ninho": "#fff2d6", "Kiwi": "#8bc34a", "Mel": "#f4b400",
  };
  const builder = { size: SIZES[1], tops: [] };

  function renderSizes() {
    $("#sizes").innerHTML = SIZES.map((p) => `
      <button class="size ${p === builder.size ? "active" : ""}" data-size="${p.id}">
        <strong>${p.nome.match(/\d+ml/)[0]}</strong><span>${p.monte} adicionais</span><b>${brl(p.preco)}</b>
      </button>`).join("");
  }
  function renderChips() {
    const full = builder.tops.length >= builder.size.monte;
    $("#chips").innerHTML = ADICIONAIS_MONTE.map((a) => {
      const on = builder.tops.includes(a);
      return `<button class="chip ${on ? "active" : ""}" data-top="${esc(a)}" ${!on && full ? "disabled" : ""}>${on ? "✓ " : ""}${esc(a)}</button>`;
    }).join("");
    $("#addHint").textContent = `${builder.tops.length} de ${builder.size.monte}`;
  }
  function renderCup() {
    const fillByMl = { "acai-300": 0.55, "acai-500": 0.72, "acai-700": 0.88 };
    const level = fillByMl[builder.size.id];
    const topY = 40, botY = 240, h = botY - topY;
    const surface = botY - h * level;
    const xAt = (y) => 30 + ((y - topY) / h) * 25; // parede inclinada
    const L = xAt(surface), R = 220 - xAt(surface);
    // pedacinhos de cobertura determinísticos
    let bits = "";
    builder.tops.forEach((t, i) => {
      const c = TOP_COLORS[t] || "#fff";
      for (let k = 0; k < 7; k++) {
        const seed = (i * 7 + k) * 9301 + 49297;
        const rx = ((seed % 233280) / 233280);
        const ry = (((seed * 7) % 233280) / 233280);
        const x = L + 8 + rx * (R - L - 16);
        const y = surface - 4 - ry * 14 + i * 1.2;
        bits += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(4 + (k % 3) * 1.5).toFixed(1)}" fill="${c}" stroke="rgba(0,0,0,.12)" stroke-width="1"/>`;
      }
    });
    $("#cupSvg").innerHTML = `
      <defs>
        <clipPath id="cupClip"><path d="M30 40 L190 40 L165 240 Q110 252 55 240 Z"/></clipPath>
        <linearGradient id="acaiG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6a2a72"/><stop offset="1" stop-color="#3a1240"/></linearGradient>
      </defs>
      <g clip-path="url(#cupClip)">
        <rect x="0" y="${surface}" width="220" height="260" fill="url(#acaiG)" style="transition: y .4s"/>
        <path d="M${L} ${surface} Q110 ${surface - 26} ${R} ${surface}" fill="#5a1f62"/>
      </g>
      ${bits}
      <path d="M30 40 L190 40 L165 240 Q110 252 55 240 Z" fill="rgba(255,255,255,.18)" stroke="#e8197a" stroke-width="5" stroke-linejoin="round"/>
      <rect x="22" y="30" width="176" height="14" rx="7" fill="#e8197a"/>
      <text x="110" y="200" text-anchor="middle" font-family="Fredoka" font-weight="700" font-size="22" fill="rgba(255,255,255,.85)">KERO</text>`;
    $("#cupTitle").textContent = builder.size.nome;
    $("#cupPrice").textContent = brl(builder.size.preco);
    $("#cupChosen").innerHTML = builder.tops.length
      ? builder.tops.map((t) => `<span class="mini-chip">${esc(t)}</span>`).join("")
      : `<span style="color:var(--muted);font-size:14px">Escolha seus adicionais 👉</span>`;
  }
  function renderBuilder() { renderSizes(); renderChips(); renderCup(); }

  $("#sizes").addEventListener("click", (e) => {
    const b = e.target.closest("[data-size]"); if (!b) return;
    builder.size = byId[b.dataset.size];
    builder.tops = builder.tops.slice(0, builder.size.monte);
    renderBuilder();
  });
  $("#chips").addEventListener("click", (e) => {
    const b = e.target.closest("[data-top]"); if (!b || b.disabled) return;
    const t = b.dataset.top;
    builder.tops = builder.tops.includes(t) ? builder.tops.filter((x) => x !== t) : [...builder.tops, t];
    renderChips(); renderCup();
  });
  $("#cupAdd").addEventListener("click", () => {
    addToCart(builder.size, 1, builder.tops, $("#cupObs").value.trim());
    builder.tops = []; $("#cupObs").value = "";
    renderBuilder();
  });

  // =====================================================
  // CARDÁPIO
  // =====================================================
  let activeCat = null, term = "";
  function renderTabs() {
    $("#tabs").innerHTML = CATEGORIAS.map((c) => `<button class="tab ${activeCat === c.id ? "active" : ""}" data-cat="${c.id}">${c.emoji} ${c.nome}</button>`).join("");
  }
  const norm = (s) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  function renderMenu() {
    const q = norm(term);
    const html = CATEGORIAS.map((c) => {
      const items = PRODUTOS.filter((p) => p.cat === c.id && (!q || norm(p.nome + " " + p.desc).includes(q)));
      if (!items.length) return "";
      return `<div class="menu-cat" id="cat-${c.id}">
        <h3>${c.emoji} ${c.nome}</h3>
        <div class="grid">${items.map(card).join("")}</div>
      </div>`;
    }).join("");
    $("#menu").innerHTML = html || `<div class="empty">Nada encontrado para “${esc(term)}” 🍧</div>`;
  }
  function card(p) {
    const tagClass = p.tag === "Novo" || p.tag === "Da casa" ? "tag teal" : "tag";
    return `<article class="card" data-pid="${p.id}">
      <div class="card-img">${p.tag ? `<span class="${tagClass}">${p.tag}</span>` : ""}${catEmoji[p.cat]}${pic(p)}</div>
      <div class="card-body">
        <h4>${esc(p.nome)}</h4>
        <p>${esc(p.desc)}</p>
        <div class="card-foot"><span class="price">${brl(p.preco)}</span><button class="add" aria-label="Adicionar ${esc(p.nome)}">+</button></div>
      </div>
    </article>`;
  }
  $("#tabs").addEventListener("click", (e) => {
    const b = e.target.closest("[data-cat]"); if (!b) return;
    activeCat = b.dataset.cat;
    if (term) { term = ""; $("#search").value = ""; renderMenu(); observeCats(); }
    renderTabs();
    $(`#cat-${activeCat}`)?.scrollIntoView({ behavior: "smooth" });
  });
  $("#search").addEventListener("input", (e) => { term = e.target.value; renderMenu(); });
  $("#menu").addEventListener("click", (e) => {
    const c = e.target.closest("[data-pid]"); if (!c) return;
    const p = byId[c.dataset.pid];
    // itens simples entram direto pelo botão "+"
    if (e.target.closest(".add") && !p.monte) { addToCart(p, 1, [], ""); return; }
    openProduct(p);
  });
  // destaca a aba da categoria visível
  const spy = new IntersectionObserver((entries) => {
    entries.forEach((en) => {
      if (en.isIntersecting) {
        const id = en.target.id.replace("cat-", "");
        if (id !== activeCat) {
          activeCat = id; renderTabs();
          const tabs = $("#tabs"), btn = $(`.tab[data-cat="${id}"]`);
          if (btn) tabs.scrollTo({ left: btn.offsetLeft - tabs.clientWidth / 2 + btn.clientWidth / 2, behavior: "smooth" });
        }
      }
    });
  }, { rootMargin: "-160px 0px -60% 0px" });
  const observeCats = () => { spy.disconnect(); $$(".menu-cat").forEach((el) => spy.observe(el)); };

  // =====================================================
  // MODAL DE PRODUTO
  // =====================================================
  const overlay = $("#overlay"), modal = $("#modal"), drawer = $("#drawer");
  function openProduct(p) {
    const st = { qtd: 1, tops: [] };
    const draw = () => {
      const full = p.monte && st.tops.length >= p.monte;
      modal.innerHTML = `
        <div class="modal-hero">${catEmoji[p.cat]}${pic(p)}<button class="close" data-close aria-label="Fechar">✕</button></div>
        <div class="modal-body">
          <h3>${esc(p.nome)}</h3>
          <p>${esc(p.desc)}</p>
          ${p.monte ? `<span class="form-label">Escolha ${p.monte} adicionais <span style="color:var(--muted)">(${st.tops.length}/${p.monte})</span></span>
            <div class="chips" style="margin-bottom:18px">${ADICIONAIS_MONTE.map((a) => {
              const on = st.tops.includes(a);
              return `<button class="chip ${on ? "active" : ""}" data-top="${esc(a)}" ${!on && full ? "disabled" : ""}>${on ? "✓ " : ""}${esc(a)}</button>`;
            }).join("")}</div>` : ""}
          <label class="field">Observação <input id="mObs" placeholder="Ex.: sabor da cobertura, sem cereja…"></label>
        </div>
        <div class="modal-foot">
          <div class="qty"><button data-q="-1" aria-label="Menos">−</button><span>${st.qtd}</span><button data-q="1" aria-label="Mais">+</button></div>
          <button class="btn btn-pink" id="mAdd">Adicionar • ${brl(p.preco * st.qtd)}</button>
        </div>`;
    };
    draw();
    modal.onclick = (e) => {
      const obs = $("#mObs")?.value || "";
      const t = e.target.closest("[data-top]");
      if (t && !t.disabled) {
        const v = t.dataset.top;
        st.tops = st.tops.includes(v) ? st.tops.filter((x) => x !== v) : [...st.tops, v];
        draw(); $("#mObs").value = obs; return;
      }
      const q = e.target.closest("[data-q]");
      if (q) { st.qtd = Math.max(1, st.qtd + Number(q.dataset.q)); draw(); $("#mObs").value = obs; return; }
      if (e.target.closest("#mAdd")) { addToCart(p, st.qtd, st.tops, obs.trim()); closeAll(); }
    };
    open(modal);
  }

  function open(el) { overlay.classList.add("open"); el.classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeAll() {
    [overlay, modal, drawer].forEach((el) => el.classList.remove("open"));
    document.body.style.overflow = "";
    if (view === "track") { view = "cart"; }
  }
  overlay.addEventListener("click", closeAll);
  document.addEventListener("click", (e) => { if (e.target.closest("[data-close]")) closeAll(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeAll(); });

  // =====================================================
  // SACOLA, CHECKOUT E ACOMPANHAMENTO (com conta do cliente)
  // =====================================================
  let cart = Store.getCart();
  let view = "cart"; // cart | checkout | track
  let trackingOrder = null;
  let myActive = []; // pedidos em andamento do cliente logado
  let sending = false;
  const avisados = new Set();

  function addToCart(p, qtd, extras, obs) {
    const key = p.id + "|" + extras.join(",") + "|" + obs;
    const found = cart.find((i) => i.key === key);
    if (found) found.qtd += qtd;
    else cart.push({ key, pid: p.id, nome: p.nome, preco: p.preco, qtd, extras, obs, img: p.img || null, cat: p.cat });
    saveCart();
    toast(`${p.nome} na sacola! 🍧`);
    const b = $("#cartBtn"); b.classList.remove("bump"); void b.offsetWidth; b.classList.add("bump");
  }
  function saveCart() { Store.setCart(cart); renderCartBadge(); if (drawer.classList.contains("open")) renderDrawer(); }
  const subtotal = () => cart.reduce((s, i) => s + i.preco * i.qtd, 0);
  const count = () => cart.reduce((s, i) => s + i.qtd, 0);
  function renderOrdersBadge() { $("#ordersBadge").textContent = myActive.length || ""; }
  function renderCartBadge() {
    renderOrdersBadge();
    $("#cartCount").textContent = count();
    const f = $("#floatCart");
    f.classList.toggle("hidden", count() === 0);
    $("#floatCount").textContent = `${count()} ${count() === 1 ? "item" : "itens"}`;
    $("#floatTotal").textContent = brl(subtotal());
  }

  const checkout = { tipo: "entrega", pagamento: "pix", usarPontos: false, prefilledFor: null,
    cep: "", cidade: "Belo Horizonte", uf: "MG", lat: null, lng: null, geo: "", retiradaId: null };
  const prof = () => Auth.state.profile;
  const logged = () => !!Auth.state.user;

  // preenche nome, celular e endereço salvos na conta (com as coordenadas)
  function prefill() {
    const p = prof();
    if (!p || checkout.prefilledFor === p.id) return;
    checkout.prefilledFor = p.id;
    const e = p.endereco || {};
    Object.assign(checkout, { nome: p.nome, tel: p.telefone, cep: e.cep || "", rua: e.rua || "", num: e.num || "", bairro: e.bairro || "", comp: e.comp || "",
      lat: e.lat ?? null, lng: e.lng ?? null, geo: e.lat != null ? "ok" : "" });
    if (e.lat != null && !userPos) userPos = { lat: e.lat, lng: e.lng };
  }

  // ---------- escolha automática da loja ----------
  function entregaInfo() {
    if (checkout.lat == null) return null;
    const ranked = Geo.rank(stores, checkout.lat, checkout.lng);
    return { ranked, nearest: ranked[0], best: ranked.find((r) => r.atende && r.aberta) || null };
  }
  function retiradaRanked() {
    const pos = checkout.lat != null ? { lat: checkout.lat, lng: checkout.lng } : userPos;
    return pos ? Geo.rank(stores, pos.lat, pos.lng) : stores.map((s) => ({ store: s, km: null, aberta: Api.isOpen(s) }));
  }
  // loja que vai receber o pedido + taxa
  function pedidoLoja() {
    if (checkout.tipo === "entrega") {
      const info = entregaInfo();
      return info?.best ? { store: info.best.store, taxa: info.best.taxa, km: info.best.km } : null;
    }
    const r = retiradaRanked();
    let pick = r.find((x) => x.store.id === checkout.retiradaId && x.aberta);
    if (!pick) { pick = r.find((x) => x.aberta); checkout.retiradaId = pick?.store.id || null; }
    return pick ? { store: pick.store, taxa: 0, km: pick.km } : null;
  }

  function storeBoxHtml() {
    if (checkout.tipo === "retirada") {
      const r = retiradaRanked();
      pedidoLoja(); // garante uma loja aberta selecionada
      return `<span class="form-label">Retirar em qual loja?</span>
        <div class="pick-stores">${r.map((x) => `
          <label class="pick-store ${x.aberta ? "" : "off"} ${checkout.retiradaId === x.store.id ? "active" : ""}">
            <input type="radio" name="retLoja" value="${x.store.id}" ${checkout.retiradaId === x.store.id ? "checked" : ""} ${x.aberta ? "" : "disabled"}>
            <span><b>Ice Kero ${esc(x.store.nome)}</b>${x.km != null ? ` <em>${Geo.km(x.km)}</em>` : ""}<small>${esc(x.store.endereco)} — ${esc(x.store.bairro)}</small>
            <small>${statusTxt(x.store)}</small></span>
          </label>`).join("")}</div>`;
    }
    if (checkout.geo === "buscando") return `<div class="store-box wait">🔎 Localizando seu endereço…</div>`;
    if (checkout.geo === "erro") return `<div class="store-box bad">Não achamos esse endereço no mapa. Confira o CEP e o número, ou toque em <b>Usar minha localização</b>.</div>`;
    const info = entregaInfo();
    if (!info) return `<div class="store-box">📍 Digite seu CEP (ou use sua localização) para encontrarmos a loja mais perto de você.</div>`;
    if (!info.best) {
      const n = info.nearest;
      const msg = n.atende
        ? `As lojas que atendem seu endereço estão fechadas agora. A Ice Kero ${esc(n.store.nome)} abre às ${Api.hora(n.store.abre_min)}.`
        : `Ainda não entregamos nesse endereço: a loja mais perto (Ice Kero ${esc(n.store.nome)}) fica a ${Geo.km(n.km)}.`;
      return `<div class="store-box bad">${msg}<button class="btn btn-ghost" data-seg-go="retirada" style="margin-top:10px;width:100%">🏪 Retirar na loja</button></div>`;
    }
    const b = info.best;
    const nota = info.nearest.store.id !== b.store.id
      ? `<small>A unidade ${esc(info.nearest.store.nome)}, mais perto, ${info.nearest.aberta ? "não atende esse endereço" : "está fechada agora"}.</small>` : "";
    return `<div class="store-box ok">
      <div>🏪 <b>Ice Kero ${esc(b.store.nome)}</b> vai preparar seu pedido</div>
      <small>A ${Geo.km(b.km)} de você • entrega ${brl(b.taxa)} • ${LOJA.tempoEntrega}</small>${nota}
    </div>`;
  }
  function refreshStoreBox() {
    const box = $("#storeBox"); if (box) box.innerHTML = storeBoxHtml();
    if ($("#placeOrder")) renderCheckoutFoot();
  }

  let geoSeq = 0;
  async function geocodeCheckout() {
    readCheckoutFields();
    const c = checkout;
    if (!c.rua && onlyDigits(c.cep).length !== 8) return;
    const seq = ++geoSeq;
    c.geo = "buscando"; refreshStoreBox();
    const p = await Geo.geocode({ rua: c.rua, num: c.num, bairro: c.bairro, cidade: c.cidade, uf: c.uf, cep: c.cep });
    if (seq !== geoSeq) return; // chegou uma busca mais nova
    if (p) { c.lat = p.lat; c.lng = p.lng; c.geo = "ok"; userPos = p; }
    else { c.lat = c.lng = null; c.geo = "erro"; }
    refreshStoreBox();
  }
  async function buscarCep() {
    readCheckoutFields();
    if (onlyDigits(checkout.cep).length !== 8) return;
    checkout.geo = "buscando"; refreshStoreBox();
    try {
      const a = await Geo.cep(checkout.cep);
      Object.assign(checkout, { cep: a.cep, rua: a.rua || checkout.rua, bairro: a.bairro || checkout.bairro, cidade: a.cidade, uf: a.uf });
      const set = (id, v) => { const el = $(id); if (el && v) el.value = v; };
      set("#cRua", checkout.rua); set("#cBairro", checkout.bairro);
      if (!checkout.num) $("#cNum")?.focus();
    } catch {
      toast("CEP não encontrado");
    }
    geocodeCheckout();
  }
  async function usarLocalizacao() {
    const b = $("#useGps"); if (b) { b.disabled = true; b.textContent = "Localizando…"; }
    try {
      const pos = await Geo.here();
      Object.assign(checkout, { lat: pos.lat, lng: pos.lng, geo: "ok" }); userPos = pos;
      try {
        const a = await Geo.reverse(pos.lat, pos.lng);
        Object.assign(checkout, { rua: a.rua || checkout.rua, num: a.num || checkout.num, bairro: a.bairro || checkout.bairro, cep: a.cep || checkout.cep, cidade: a.cidade || checkout.cidade });
      } catch {}
      renderDrawer();
      toast("Localização encontrada! Confira o número da casa.");
    } catch {
      toast("Não conseguimos sua localização. Digite o CEP.");
      if (b) { b.disabled = false; b.textContent = "📍 Usar minha localização"; }
    }
  }

  function askLogin() {
    Auth.open({
      reason: "Entre ou crie sua conta para finalizar o pedido. Seus dados ficam salvos para as próximas vezes.",
      onSuccess: () => { view = "checkout"; renderDrawer(); if (!drawer.classList.contains("open")) open(drawer); },
    });
  }

  function renderDrawer() {
    const body = $("#drawerBody"), foot = $("#drawerFoot"), title = $("#drawerTitle");
    if (view === "track") return renderTrack();
    if (!cart.length) {
      view = "cart";
      title.textContent = "Sua sacola";
      body.innerHTML = `<div class="cart-empty"><div>🍦</div><h4 style="font-family:var(--font-title);font-size:20px;margin:10px 0 6px;color:var(--ink)">Sacola vazia</h4>Que tal um açaí caprichado?</div>`;
      foot.innerHTML = `<a href="#monte" class="btn btn-pink btn-block" data-close>Montar meu açaí</a>
        ${myActive.length ? `<a href="pedidos.html" class="btn btn-ghost btn-block" style="margin-top:10px">📦 Acompanhar meu pedido</a>` : ""}`;
      return;
    }
    if (view === "checkout" && !logged()) view = "cart";
    if (view === "cart") {
      title.textContent = "Sua sacola";
      body.innerHTML = cart.map((i, idx) => `
        <div class="line-item">
          <div class="thumb">${catEmoji[i.cat] || "🍨"}${i.img ? `<img src="${i.img}" alt="" onerror="this.remove()">` : ""}</div>
          <div class="meta">
            <h5>${esc(i.nome)}</h5>
            ${i.extras.length ? `<small>+ ${i.extras.map(esc).join(", ")}</small>` : ""}
            ${i.obs ? `<small>“${esc(i.obs)}”</small>` : ""}
            <div class="qty"><button data-dq="${idx}|-1" aria-label="Menos">−</button><span>${i.qtd}</span><button data-dq="${idx}|1" aria-label="Mais">+</button></div>
          </div>
          <strong>${brl(i.preco * i.qtd)}</strong>
        </div>`).join("");
      const pts = Math.floor(subtotal() / LOJA.fidelidade.reaisPorPonto);
      const aberto = isOpen();
      foot.innerHTML = `
        ${pts ? `<div class="points-note">⭐ Este pedido rende ${pts} ${pts === 1 ? "ponto" : "pontos"} no Clube Ice Kero</div>` : ""}
        <div class="totals"><div class="grand"><span>Subtotal</span><span>${brl(subtotal())}</span></div></div>
        <button class="btn btn-pink btn-block" id="goCheckout" ${aberto ? "" : "disabled"}>${!aberto ? "Loja fechada no momento" : logged() ? "Continuar" : "Entrar e continuar"}</button>
        ${aberto && !logged() ? `<p style="text-align:center;color:var(--muted);font-size:13px;margin:10px 0 0">Para pedir, entre ou crie sua conta grátis.</p>` : ""}`;
      return;
    }
    // checkout (logado)
    prefill();
    title.textContent = "Finalizar pedido";
    const c = checkout;
    body.innerHTML = `
      <div class="points-note" style="background:#f6f0f7;color:var(--ink)">👤 Pedido na conta <b>${esc(Auth.state.user.email)}</b></div>
      <span class="form-label">Como você quer receber?</span>
      <div class="seg" data-seg="tipo">
        <button class="${c.tipo === "entrega" ? "active" : ""}" data-v="entrega">🛵 Entrega</button>
        <button class="${c.tipo === "retirada" ? "active" : ""}" data-v="retirada">🏪 Retirada</button>
      </div>
      <label class="field">Seu nome <input id="cNome" value="${esc(c.nome || "")}" autocomplete="name"></label>
      <label class="field">Celular / WhatsApp <input id="cTel" value="${esc(c.tel || "")}" inputmode="tel" autocomplete="tel" placeholder="(31) 9 9999-9999"></label>
      <div id="ptsBox"></div>
      ${c.tipo === "entrega" ? `
        <div class="row2 cep-row">
          <label class="field">CEP <input id="cCep" value="${esc(c.cep || "")}" inputmode="numeric" autocomplete="postal-code" placeholder="00000-000" maxlength="9"></label>
          <button class="btn btn-ghost" type="button" id="useGps">📍 Usar minha localização</button>
        </div>
        <div class="row2">
          <label class="field">Rua <input id="cRua" value="${esc(c.rua || "")}" autocomplete="address-line1"></label>
          <label class="field">Número <input id="cNum" value="${esc(c.num || "")}"></label>
        </div>
        <div class="row2">
          <label class="field">Bairro <input id="cBairro" value="${esc(c.bairro || "")}"></label>
          <label class="field">Compl. <input id="cComp" value="${esc(c.comp || "")}"></label>
        </div>` : ""}
      <div id="storeBox">${storeBoxHtml()}</div>
      <span class="form-label">Pagamento (na entrega/retirada)</span>
      <div class="seg" data-seg="pagamento">
        <button class="${c.pagamento === "pix" ? "active" : ""}" data-v="pix">Pix</button>
        <button class="${c.pagamento === "cartao" ? "active" : ""}" data-v="cartao">Cartão</button>
        <button class="${c.pagamento === "dinheiro" ? "active" : ""}" data-v="dinheiro">Dinheiro</button>
      </div>
      ${c.pagamento === "dinheiro" ? `<label class="field">Troco para quanto? <input id="cTroco" value="${esc(c.troco || "")}" inputmode="decimal" placeholder="Ex.: 50"></label>` : ""}`;
    renderCheckoutFoot();
    renderPointsBox();
  }

  function readCheckoutFields() {
    const v = (id) => $(id)?.value.trim();
    Object.assign(checkout, {
      nome: v("#cNome") ?? checkout.nome, tel: v("#cTel") ?? checkout.tel, cep: v("#cCep") ?? checkout.cep,
      rua: v("#cRua") ?? checkout.rua, num: v("#cNum") ?? checkout.num, bairro: v("#cBairro") ?? checkout.bairro, comp: v("#cComp") ?? checkout.comp,
      troco: v("#cTroco") ?? checkout.troco,
    });
  }
  const meusPontos = () => prof()?.pontos || 0;
  function totals() {
    const sub = subtotal();
    const loja = pedidoLoja();
    const taxa = checkout.tipo === "entrega" ? (loja ? loja.taxa : 0) : 0;
    const desc = checkout.usarPontos && meusPontos() >= LOJA.fidelidade.pontosParaResgate ? LOJA.fidelidade.desconto : 0;
    return { sub, taxa, desc, total: Math.max(0, sub + taxa - desc) };
  }
  function renderPointsBox() {
    const box = $("#ptsBox"); if (!box) return;
    const pts = meusPontos();
    if (pts >= LOJA.fidelidade.pontosParaResgate) {
      box.innerHTML = `<label class="points-note" style="display:flex;gap:10px;align-items:center;cursor:pointer">
        <input type="checkbox" id="cPts" ${checkout.usarPontos ? "checked" : ""}> ⭐ Você tem ${pts} pontos! Usar 10 e ganhar ${brl(LOJA.fidelidade.desconto)} de desconto</label>`;
    } else {
      box.innerHTML = `<div class="points-note">⭐ Você tem ${pts} ${pts === 1 ? "ponto" : "pontos"}. Faltam ${LOJA.fidelidade.pontosParaResgate - pts} para ganhar ${brl(LOJA.fidelidade.desconto)}.</div>`;
    }
  }
  function renderCheckoutFoot() {
    const t = totals();
    const loja = pedidoLoja();
    const pronto = !!loja && !(checkout.tipo === "entrega" && checkout.geo === "buscando");
    $("#drawerFoot").innerHTML = `
      <div class="totals">
        <div><span>Subtotal</span><span>${brl(t.sub)}</span></div>
        <div><span>Taxa de entrega</span><span>${checkout.tipo === "retirada" ? "Grátis" : loja ? brl(t.taxa) : "—"}</span></div>
        ${t.desc ? `<div style="color:var(--teal-dark)"><span>Desconto fidelidade</span><span>− ${brl(t.desc)}</span></div>` : ""}
        <div class="grand"><span>Total</span><span>${brl(t.total)}</span></div>
      </div>
      <div style="display:flex;gap:10px"><button class="btn btn-ghost" id="backCart">Voltar</button><button class="btn btn-pink" style="flex:1" id="placeOrder" ${pronto ? "" : "disabled"}>${loja ? `Pedir na ${esc(loja.store.nome)}` : "Fazer pedido"}</button></div>`;
  }

  async function placeOrder() {
    if (sending) return;
    if (!logged()) { askLogin(); return; }
    readCheckoutFields();
    const c = checkout;
    const errs = [];
    if (!c.nome || c.nome.length < 2) errs.push("seu nome");
    if (onlyDigits(c.tel).length < 10) errs.push("um celular válido");
    if (c.tipo === "entrega" && (!c.rua || !c.num || !c.bairro)) errs.push("o endereço completo");
    if (errs.length) { toast("Preencha " + errs.join(", ")); return; }
    if (c.tipo === "entrega" && c.lat == null) { toast("Digite o CEP ou use sua localização"); return; }
    const loja = pedidoLoja();
    if (!loja) { toast("Nenhuma loja disponível para esse pedido agora"); return; }
    sending = true;
    const btn = $("#placeOrder"); if (btn) { btn.disabled = true; btn.textContent = "Enviando…"; }
    try {
      const p = prof();
      if (p && (p.nome !== c.nome || p.telefone !== c.tel)) await Api.updateProfile({ nome: c.nome, telefone: c.tel });
      const order = await Api.placeOrder({
        store: loja.store.id,
        itens: cart.map((i) => ({ pid: i.pid, qtd: i.qtd, extras: i.extras, obs: i.obs })),
        tipo: c.tipo,
        endereco: c.tipo === "entrega" ? { cep: c.cep, rua: c.rua, num: c.num, bairro: c.bairro, comp: c.comp, lat: c.lat, lng: c.lng } : null,
        pagamento: c.pagamento,
        troco: c.pagamento === "dinheiro" ? c.troco : null,
        usarPontos: c.usarPontos,
      });
      cart = []; saveCart();
      checkout.usarPontos = false; checkout.prefilledFor = null;
      trackingOrder = order; view = "track";
      renderDrawer();
      Auth.refresh(); // atualiza pontos e endereço salvos
      loadMyOrders();
    } catch (e) {
      toast(errMsg(e));
      const b = $("#placeOrder"); if (b) { b.disabled = false; b.textContent = "Fazer pedido"; }
    } finally {
      sending = false;
    }
  }

  function renderTrack() {
    const o = trackingOrder;
    if (!o) { view = "cart"; return renderDrawer(); }
    $("#drawerTitle").textContent = "Acompanhe seu pedido";
    if (o.status === "cancelado") {
      const rec = o.cancelTipo === "recusado";
      $("#drawerBody").innerHTML = `
        <div class="track">
          <div class="big">😕</div>
          <h3 style="font-size:24px">Pedido ${rec ? "recusado" : "cancelado"}</h3>
          <div class="code" style="background:#fdecec;color:#b42323">Pedido ${esc(o.code)} • ${brl(o.total)}</div>
          ${o.cancelMotivo ? `<p style="font-weight:800;margin:0 0 10px">Motivo: ${esc(o.cancelMotivo)}</p>` : ""}
          <p style="color:var(--muted);font-size:14px;margin:0 0 6px">Nenhuma cobrança será feita${o.pontosUsados ? " e seus pontos de fidelidade foram devolvidos" : ""}.</p>
          ${storeById(o.storeId) ? `<p style="color:var(--muted);font-size:14px;margin:0">Dúvidas? Ligue para a Ice Kero ${esc(storeById(o.storeId).nome)}: <a href="${telLink(storeById(o.storeId).telefone)}">${esc(storeById(o.storeId).telefone)}</a>.</p>` : ""}
        </div>`;
      $("#drawerFoot").innerHTML = `<button class="btn btn-pink btn-block" id="newOrder">Fazer outro pedido</button>`;
      return;
    }
    const idx = Store.STATUS.findIndex((s) => s.id === o.status);
    const ret = o.tipo === "retirada";
    $("#drawerBody").innerHTML = `
      <div class="track">
        <div class="big">${idx >= 3 ? "🎉" : "🍧"}</div>
        <h3 style="font-size:24px">${idx >= 3 ? "Bom apetite!" : "Pedido enviado!"}</h3>
        <div class="code">Pedido ${esc(o.code)} • ${brl(o.total)}</div>
        ${storeById(o.storeId) ? `<p style="margin:-10px 0 18px;font-weight:700;color:var(--muted)">🏪 Ice Kero ${esc(storeById(o.storeId).nome)}${o.distancia != null ? ` • ${Geo.km(o.distancia)} de você` : ""}</p>` : ""}
        <div class="timeline">
          ${Store.STATUS.map((s, i) => `<div class="tl ${i < idx || (i === idx && i === 3) ? "done" : i === idx ? "now" : ""}">
            <span class="dot">${i < idx || (i === idx && i === 3) ? "✓" : i + 1}</span>${ret && s.nomeRetirada ? s.nomeRetirada : s.nome}</div>`).join("")}
        </div>
        <p style="color:var(--muted);font-size:14px;margin-top:20px">Esta tela atualiza sozinha quando a loja muda o status do pedido.</p>
      </div>`;
    $("#drawerFoot").innerHTML = `<a href="pedidos.html" class="btn btn-pink btn-block" style="margin-bottom:10px">📦 Ver em Meus pedidos</a>
      <button class="btn btn-ghost btn-block" id="newOrder">Fazer outro pedido</button>`;
  }

  // eventos da gaveta
  drawer.addEventListener("click", (e) => {
    const dq = e.target.closest("[data-dq]");
    if (dq) {
      const [idx, d] = dq.dataset.dq.split("|").map(Number);
      cart[idx].qtd += d;
      if (cart[idx].qtd <= 0) cart.splice(idx, 1);
      saveCart(); return;
    }
    const seg = e.target.closest("[data-seg] button");
    if (seg) { readCheckoutFields(); checkout[seg.parentElement.dataset.seg] = seg.dataset.v; renderDrawer(); return; }
    if (e.target.closest("#goCheckout")) { if (!logged()) { askLogin(); return; } view = "checkout"; renderDrawer(); return; }
    if (e.target.closest("#backCart")) { readCheckoutFields(); view = "cart"; renderDrawer(); return; }
    if (e.target.closest("#placeOrder")) { placeOrder(); return; }
    if (e.target.closest("#useGps")) { usarLocalizacao(); return; }
    const go = e.target.closest("[data-seg-go]");
    if (go) { readCheckoutFields(); checkout.tipo = go.dataset.segGo; renderDrawer(); return; }
    if (e.target.closest("#newOrder")) { view = "cart"; closeAll(); document.querySelector("#cardapio").scrollIntoView(); }
  });
  drawer.addEventListener("change", (e) => {
    if (e.target.id === "cPts") { checkout.usarPontos = e.target.checked; renderCheckoutFoot(); }
    if (e.target.name === "retLoja") { checkout.retiradaId = e.target.value; refreshStoreBox(); }
    // mudou rua, número ou bairro: recalcula a posição e a loja
    if (["cRua", "cNum", "cBairro"].includes(e.target.id)) geocodeCheckout();
  });
  drawer.addEventListener("input", (e) => {
    if (e.target.id === "cCep") {
      let d = onlyDigits(e.target.value).slice(0, 8);
      e.target.value = d.length > 5 ? d.slice(0, 5) + "-" + d.slice(5) : d;
      if (d.length === 8) buscarCep();
    }
  });

  function openCart() {
    if (view !== "track" && !cart.length && myActive.length) { trackingOrder = myActive[0]; view = "track"; }
    renderDrawer(); open(drawer);
  }
  $("#cartBtn").addEventListener("click", openCart);
  $("#floatCart").addEventListener("click", openCart);

  // ---------- pedidos do cliente + tempo real ----------
  let channel = null;
  async function loadMyOrders() {
    if (!logged()) { myActive = []; renderOrdersBadge(); return; }
    try {
      const all = await Api.myOrders();
      myActive = all.filter((o) => o.status !== "entregue" && o.status !== "cancelado");
    } catch { myActive = []; }
    renderOrdersBadge();
  }
  function watchMine() {
    if (channel) { sb.removeChannel(channel); channel = null; }
    const uid = Auth.state.user?.id; if (!uid) return;
    channel = Api.watchOrders("meus-" + uid, `user_id=eq.${uid}`, (ev, o) => {
      loadMyOrders();
      if (!o) return;
      if (trackingOrder && o.id === trackingOrder.id) { trackingOrder = o; if (view === "track") renderTrack(); }
      // recusado/cancelado: avisa mesmo com a sacola fechada
      if (o.status === "cancelado" && !avisados.has(o.id)) {
        avisados.add(o.id);
        trackingOrder = o; view = "track"; renderDrawer();
        if (!drawer.classList.contains("open")) open(drawer);
      }
    });
  }
  Auth.onChange(() => {
    if (!logged()) { checkout.prefilledFor = null; if (view !== "cart") view = "cart"; trackingOrder = null; }
    loadMyOrders(); watchMine();
    if (drawer.classList.contains("open")) renderDrawer();
  });

  // ---------- lojas (vêm do banco e atualizam ao vivo) ----------
  function onStoresChanged() {
    renderStatus(); renderStores(); renderInfo();
    if (drawer.classList.contains("open") && view !== "track") {
      if (view === "checkout") refreshStoreBox(); else renderDrawer();
    }
  }
  Api.stores().then((s) => { stores = s; onStoresChanged(); }).catch(() => toast("Sem conexão com o servidor"));
  Api.watchStores((row) => {
    if (!row?.id) return;
    const i = stores.findIndex((s) => s.id === row.id);
    const norm = { ...row, taxa_base: Number(row.taxa_base), km_inclusos: Number(row.km_inclusos), taxa_km: Number(row.taxa_km), raio_km: Number(row.raio_km) };
    if (i >= 0) stores[i] = norm; else stores.push(norm);
    onStoresChanged();
  });

  // ---------- init ----------
  renderStatus(); setInterval(() => { renderStatus(); if (stores.length) renderStores(); }, 60000);
  renderInfo();
  renderBuilder();
  renderTabs();
  renderMenu();
  observeCats();
  $("#search").addEventListener("input", observeCats);
  renderCartBadge();
  // vindo do "Pedir de novo" da página Meus pedidos: abre a sacola já preenchida
  if (new URLSearchParams(location.search).get("sacola") === "1") {
    history.replaceState(null, "", location.pathname);
    openCart();
  }
})();
