// Conta do cliente: janela de entrar/cadastrar, menu da conta no topo e estado do login.
const Auth = (() => {
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const state = { user: null, profile: null };
  const listeners = [];
  let onSuccess = null;
  let resolveReady; const ready = new Promise((r) => (resolveReady = r));

  // ---------- janela ----------
  const overlay = document.createElement("div");
  overlay.className = "overlay"; overlay.style.zIndex = 85;
  const modal = document.createElement("div");
  modal.className = "modal auth-modal"; modal.style.zIndex = 86;
  modal.setAttribute("role", "dialog"); modal.setAttribute("aria-modal", "true");
  document.body.append(overlay, modal);

  function close() { overlay.classList.remove("open"); modal.classList.remove("open"); onSuccess = null; }
  overlay.addEventListener("click", close);

  const head = (titulo, sub) => `
    <button class="close auth-x" data-aclose aria-label="Fechar">✕</button>
    <div class="auth-head"><span class="brand"><span class="ice">ICE</span><span class="kero">KERO</span></span>
    <h3>${titulo}</h3>${sub ? `<p>${sub}</p>` : ""}</div>`;

  const VIEWS = {
    login: (o) => `${head("Entrar na sua conta", o.reason || "Acompanhe pedidos, junte pontos e peça mais rápido.")}
      <form data-form="login">
        <label class="field">E-mail <input name="email" type="email" autocomplete="email" required></label>
        <label class="field">Senha <input name="senha" type="password" autocomplete="current-password" required></label>
        <div class="auth-err"></div>
        <button class="btn btn-pink btn-block" type="submit">Entrar</button>
      </form>
      <div class="auth-links"><button data-go="forgot">Esqueci minha senha</button>
        <span>Não tem conta? <button data-go="signup">Criar conta</button></span></div>`,
    signup: (o) => `${head("Criar conta", o.reason || "Leva menos de um minuto.")}
      <form data-form="signup">
        <label class="field">Nome <input name="nome" autocomplete="name" required minlength="2" maxlength="80"></label>
        <label class="field">Celular / WhatsApp <input name="telefone" inputmode="tel" autocomplete="tel" required placeholder="(31) 9 9999-9999"></label>
        <label class="field">E-mail <input name="email" type="email" autocomplete="email" required></label>
        <label class="field">Senha <input name="senha" type="password" autocomplete="new-password" required minlength="6" placeholder="Mínimo de 6 caracteres"></label>
        <div class="auth-err"></div>
        <button class="btn btn-pink btn-block" type="submit">Criar conta</button>
      </form>
      <p class="auth-note">🔒 Seus dados ficam protegidos e só você e a loja têm acesso aos seus pedidos.</p>
      <div class="auth-links"><span>Já tem conta? <button data-go="login">Entrar</button></span></div>`,
    forgot: () => `${head("Recuperar senha", "Enviaremos um link para você criar uma nova senha.")}
      <form data-form="forgot">
        <label class="field">E-mail <input name="email" type="email" autocomplete="email" required></label>
        <div class="auth-err"></div>
        <button class="btn btn-pink btn-block" type="submit">Enviar link</button>
      </form>
      <div class="auth-links"><button data-go="login">← Voltar</button></div>`,
    newpass: () => `${head("Criar nova senha", "")}
      <form data-form="newpass">
        <label class="field">Nova senha <input name="senha" type="password" autocomplete="new-password" required minlength="6"></label>
        <div class="auth-err"></div>
        <button class="btn btn-pink btn-block" type="submit">Salvar senha</button>
      </form>`,
    sent: (o) => `${head(o.titulo, o.msg)}
      <div class="auth-big">📩</div>
      <button class="btn btn-ghost btn-block" data-go="login">Ir para o login</button>`,
  };

  function show(view, opts = {}) {
    modal.innerHTML = `<div class="modal-body">${VIEWS[view](opts)}</div>`;
    overlay.classList.add("open"); modal.classList.add("open");
    setTimeout(() => modal.querySelector("input")?.focus(), 60);
  }

  modal.addEventListener("click", (e) => {
    if (e.target.closest("[data-aclose]")) { close(); return; }
    const go = e.target.closest("[data-go]");
    if (go) show(go.dataset.go);
  });

  modal.addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.target, kind = f.dataset.form, v = Object.fromEntries(new FormData(f));
    const err = f.querySelector(".auth-err"), btn = f.querySelector("button[type=submit]");
    err.textContent = "";
    if (kind === "signup" && onlyDigits(v.telefone).length < 10) { err.textContent = "Digite o celular com DDD."; return; }
    const label = btn.textContent; btn.disabled = true; btn.textContent = "Aguarde…";
    try {
      if (kind === "login") {
        await Api.signIn(v.email.trim(), v.senha);
        await done();
      } else if (kind === "signup") {
        const r = await Api.signUp({ nome: v.nome.trim(), telefone: v.telefone.trim(), email: v.email.trim(), senha: v.senha });
        if (r.precisaConfirmar) show("sent", { titulo: "Confirme seu e-mail", msg: `Enviamos um link para <b>${esc(v.email)}</b>. Clique nele para ativar sua conta e depois entre.` });
        else await done();
      } else if (kind === "forgot") {
        await Api.resetPassword(v.email.trim());
        show("sent", { titulo: "Confira seu e-mail", msg: "Se houver uma conta com esse e-mail, você vai receber o link para criar uma nova senha." });
      } else if (kind === "newpass") {
        await Api.updatePassword(v.senha);
        close(); toastAuth("Senha alterada! ✅");
      }
    } catch (ex) {
      err.textContent = errMsg(ex);
    } finally {
      if (document.body.contains(btn)) { btn.disabled = false; btn.textContent = label; }
    }
  });

  async function done() {
    const cb = onSuccess;
    await refresh();
    close();
    toastAuth(`Olá, ${(state.profile?.nome || "").split(" ")[0] || "bem-vindo"}! 🍧`);
    if (cb) cb();
  }

  function toastAuth(msg) {
    const t = document.getElementById("toast"); if (!t) return;
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toastAuth.t); toastAuth.t = setTimeout(() => t.classList.remove("show"), 2400);
  }

  // ---------- estado ----------
  async function refresh() {
    state.user = await Api.user();
    try { state.profile = state.user ? await Api.profile() : null; } catch { state.profile = null; }
    renderAccount();
    listeners.forEach((cb) => cb(state));
  }

  Api.onAuth((ev, user) => {
    if (ev === "PASSWORD_RECOVERY") { show("newpass"); return; }
    if (ev === "SIGNED_OUT" || (ev === "SIGNED_IN" && user?.id !== state.user?.id) || ev === "USER_UPDATED") {
      setTimeout(refresh, 0); // fora do callback do Supabase
    }
  });

  // ---------- menu da conta no topo ----------
  function renderAccount() {
    const el = document.getElementById("account"); if (!el) return;
    if (!state.user) {
      el.innerHTML = `<button class="orders-link" data-login>👤 <span class="label">Entrar</span></button>`;
      return;
    }
    const nome = (state.profile?.nome || state.user.email).split(" ")[0];
    el.innerHTML = `<div class="acct">
      <button class="orders-link" data-acct aria-haspopup="true">👤 <span class="label">${esc(nome)}</span></button>
      <div class="acct-menu" hidden>
        <div class="acct-who"><b>${esc(state.profile?.nome || "")}</b><small>${esc(state.user.email)}</small>
          <small>⭐ ${state.profile?.pontos ?? 0} pontos</small></div>
        <a href="pedidos.html">📦 Meus pedidos</a>
        <a href="pedidos.html#dados">✏️ Meus dados</a>
        <button data-logout>↩ Sair</button>
      </div></div>`;
  }
  document.addEventListener("click", (e) => {
    if (e.target.closest("[data-login]")) { open(); return; }
    const menu = document.querySelector(".acct-menu");
    if (e.target.closest("[data-acct]")) { if (menu) menu.hidden = !menu.hidden; return; }
    if (e.target.closest("[data-logout]")) { Api.signOut(); if (menu) menu.hidden = true; toastAuth("Você saiu da conta."); return; }
    if (menu && !e.target.closest(".acct")) menu.hidden = true;
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && modal.classList.contains("open")) close(); });

  function open(opts = {}) { onSuccess = opts.onSuccess || null; show(opts.mode || "login", opts); }

  refresh().then(() => resolveReady(state));

  return {
    state, ready, open, close, refresh,
    onChange(cb) { listeners.push(cb); },
  };
})();
