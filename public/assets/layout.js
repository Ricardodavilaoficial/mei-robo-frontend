/* public/assets/layout.js
 * MEI Robô — injeção de parciais (robusta) + Auth Guard (produção)
 * - Suporta:
 *   - <div data-include="header" [data-src="/partials/header-landing.html"]>
 *   - <div id="header"> ou <div id="app-header">
 *   - <div data-include="footer"> / <div id="footer"> / <div id="app-footer">
 * - Fallback relativo e absoluto para /partials/*.html
 * - Bloqueio de rotas protegidas e admin
 * Dependência: /assets/firebase-init.js deve carregar antes deste script.
 */

(function () {
  const $ = (sel) => document.querySelector(sel);
  const now = () => new Date();

  // ---------- util: fetch com fallback (relativa + absoluta) ----------
  function tryFetch(urls, onOk, onFail) {
    const next = (i) => {
      if (i >= urls.length) return onFail(new Error("Falha em todas as URLs: " + urls.join(", ")));
      const u = `${urls[i]}${urls[i].includes("?") ? "" : `?v=${Date.now()}`}`;
      fetch(u, { cache: "no-store" })
        .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${u} -> ${r.status}`))))
        .then((html) => onOk(html))
        .catch(() => next(i + 1));
    };
    next(0);
  }

  function injectInto(el, urls) {
    if (!el) return;
    tryFetch(
      urls,
      (html) => { el.innerHTML = html; },
      (err) => {
        console.error("[layout] Inject error:", err);
        el.innerHTML =
          `<div style="padding:8px;color:#b00020;background:#ffeaea;border:1px solid #ffc4c4;">
             Falha ao carregar: ${urls.map(u => `<code>${u}</code>`).join(" ou ")}<br>${err.message}
           </div>`;
      }
    );
  }

  // ---------- injeção de header/footer ----------
  function currentPath() {
    let p = (location.pathname || "/").toLowerCase();
    if (p === "" || p === "/") return "/index.html";
    return p;
  }

  function buildCandidates(defaultSrc, dataSrc) {
    const list = [];
    // prioridade: data-src, depois absoluto, depois relativo comum
    if (dataSrc) list.push(dataSrc);
    list.push(defaultSrc); // absoluto
    // fallback relativo típico p/ páginas em /pages/
    list.push(`..${defaultSrc}`); // ex.: ../partials/header.html
    return list;
  }

  async function injectPartials() {
    // HEADER — aceita data-include ou ids usuais
    const headerEl = $('[data-include="header"]') || $('#header') || $('#app-header');
    const headerSrc = headerEl && headerEl.getAttribute && headerEl.getAttribute('data-src');
    const headerUrls = buildCandidates('/partials/header.html', headerSrc);
    if (headerEl) injectInto(headerEl, headerUrls);

    // FOOTER
    const footerEl = $('[data-include="footer"]') || $('#footer') || $('#app-footer');
    const footerSrc = footerEl && footerEl.getAttribute && footerEl.getAttribute('data-src');
    const footerUrls = buildCandidates('/partials/footer.html', footerSrc);
    if (footerEl) injectInto(footerEl, footerUrls);
  }

  // ---------- Auth Guard ----------
  const PUBLIC_ROUTES = new Set([
    '/', '/index.html',
    '/login.html',
    '/cadastro.html',
    '/cookies.html',
    '/privacidade.html',
    '/termos.html'
  ]);

  const AUTH_REQUIRED = new Set([
    '/dashboard.html',
    '/agenda.html',
    '/configuracao.html',
    '/ativar.html'
  ]);

  const ADMIN_ONLY = new Set([
    '/admin-cupons.html'
  ]);

  function waitForFirebase(ms = 3000) {
    return new Promise((resolve) => {
      const start = Date.now();
      (function tick() {
        if (window.firebase && firebase.apps && firebase.apps.length > 0) return resolve(true);
        if (Date.now() - start > ms) {
          console.warn("[layout] Firebase não disponível após", ms, "ms (seguindo sem guard).");
          return resolve(false);
        }
        setTimeout(tick, 100);
      })();
    });
  }

  async function setupAuthGuard() {
    const ok = await waitForFirebase();
    const path = currentPath();
    if (!ok) return; // não quebra a página se Firebase não veio

    const auth = firebase.auth();

    const enforce = async (user) => {
      const isPublic   = PUBLIC_ROUTES.has(path);
      const needsAuth  = AUTH_REQUIRED.has(path);
      const needsAdmin = ADMIN_ONLY.has(path);

      if (isPublic) return;

      if (needsAuth) {
        if (!user) { location.replace('/login.html'); return; }
        return;
      }

      if (needsAdmin) {
        if (!user) { location.replace('/login.html'); return; }
        try {
          const token = await user.getIdTokenResult(true);
          const isAdmin = !!(token && token.claims && token.claims.admin === true);
          if (!isAdmin) { location.replace('/index.html'); return; }
        } catch (e) {
          console.error('[guard] Falha ao ler claims:', e);
          location.replace('/index.html');
        }
        return;
      }

      // demais rotas continuam livres (comportamento atual)
    };

    // aplica já e mantém vigilância
    enforce(auth.currentUser);
    auth.onAuthStateChanged((u) => enforce(u));
  }

  // ---------- boot ----------
  document.addEventListener('DOMContentLoaded', async () => {
    await injectPartials();
    await setupAuthGuard();
    console.debug('[layout] OK —', now().toISOString(), currentPath());
  });
})();
