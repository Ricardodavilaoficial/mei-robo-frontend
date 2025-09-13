# 1) criar branch de trabalho
git checkout -b feat/hardening-backend-and-firebase-init

# 2) atualizar backend-patch.js
cat > public/assets/backend-patch.js <<'EOF'
// backend-patch.js — roteia chamadas de API para o backend e injeta token com retry 401
(function () {
  'use strict';

  // ===== Config base/allowlist =====
  const DEFAULT_API = "https://mei-robo-prod.onrender.com";
  const DEV_ALLOW_RE = /^https?:\/\/localhost(?::\d+)?$/i;

  function safeApiBase() {
    try {
      const ov = (window.localStorage && localStorage.getItem('apiBase')) || '';
      if (!ov) return DEFAULT_API;
      const u = new URL(ov, window.location.href);
      // Allowlist: PROD + localhost (dev)
      if (u.origin === DEFAULT_API || DEV_ALLOW_RE.test(u.origin)) return u.origin;
      console.warn('[backend-patch] apiBase override ignorado (fora da allowlist):', u.origin);
      return DEFAULT_API;
    } catch {
      return DEFAULT_API;
    }
  }
  const API_BASE = safeApiBase();
  const API_ORIGIN = (() => { try { return new URL(API_BASE).origin; } catch { return DEFAULT_API; } })();

  // Domínios antigos a redirecionar → backend atual
  const OLD_ORIGINS = [
    "https://eu-digital.onrender.com",
    "http://eu-digital.onrender.com"
  ];

  // Prefixos de API que devem ir ao backend
  const API_PREFIXES = [
    "/auth",
    "/clientes",
    "/pricing",
    "/schedule",
    "/whatsapp",
    "/api",
    "/licencas",
    "/admin",        // garante admin → backend
    "/gerar-cupom",  // tela Admin usa este caminho relativo
    "/__list"        // util interno: listagem (admin)
  ];

  // Mapeamentos específicos (mantido simples — sem rewrite especial)
  function mapPath(path) {
    return path;
  }

  // Recursos locais (não devem ser roteados ao backend)
  const LOCAL_PREFIXES = ["/partials", "/assets"];
  const LOCAL_EXTS = [
    ".html", ".css", ".js", ".png", ".jpg", ".jpeg", ".svg", ".ico",
    ".webmanifest", ".json", ".map"
  ];

  function isLocalPath(path) {
    if (!path || !path.startsWith("/")) return false;
    for (const p of LOCAL_PREFIXES) if (path.startsWith(p)) return true;
    for (const ext of LOCAL_EXTS) if (path.endsWith(ext)) return true;
    return false;
  }

  function isApiPath(path) {
    if (!path || !path.startsWith("/")) return false;
    return API_PREFIXES.some(p => path.startsWith(p));
  }

  function rewriteAbsoluteIfOldOrigin(urlStr) {
    try {
      const u = new URL(urlStr, window.location.href);
      if (OLD_ORIGINS.includes(u.origin)) {
        const newPath = mapPath(u.pathname);
        return API_BASE + newPath + (u.search || "");
      }
    } catch {}
    return null;
  }

  // ===== Token helpers =====
  async function getIdTokenSoft() {
    // Tenta Firebase primeiro
    try {
      if (window.firebase && firebase.auth) {
        const cur = firebase.auth().currentUser;
        if (cur) return await cur.getIdToken();
      }
    } catch {}
    // Fallback: localStorage (pode estar recente via refresh manual)
    try {
      const t = localStorage.getItem('idToken');
      if (t && t.includes('.')) return t;
    } catch {}
    return null;
  }

  async function getIdTokenFresh() {
    try {
      if (window.firebase && firebase.auth) {
        const cur = firebase.auth().currentUser;
        if (cur) return await cur.getIdToken(true);
      }
    } catch {}
    return null;
  }

  // Headers utils (aceita Headers|plain|array)
  function toHeaders(initHeaders) {
    try {
      return new Headers(initHeaders || {});
    } catch {
      const h = new Headers();
      if (initHeaders && typeof initHeaders === 'object') {
        Object.entries(initHeaders).forEach(([k, v]) => { if (v != null) h.append(k, String(v)); });
      }
      return h;
    }
  }

  function hasAuthHeader(h) {
    try { return (h.get('Authorization') || h.get('authorization') || '').trim() !== ''; }
    catch { return false; }
  }

  function setIfAbsent(h, key, val) {
    if (!h.has(key)) h.set(key, val);
  }

  // Decide se devemos injetar Authorization: apenas quando destino == API_BASE e path de API
  function shouldAttachAuth(u) {
    try {
      const url = (u instanceof URL) ? u : new URL(u, window.location.href);
      return (url.origin === API_ORIGIN) && isApiPath(url.pathname);
    } catch { return false; }
  }

  // Cria uma Request roteada (URL) preservando tudo
  function routeRequest(reqOrUrl, init) {
    // Normaliza para Request
    const req0 = (typeof reqOrUrl === 'string') ? new Request(reqOrUrl, init) : reqOrUrl;

    let url;
    try { url = new URL(req0.url, window.location.href); } catch { return { req: req0, url: null }; }

    // 1) Absoluta domínio antigo → API_BASE
    if (OLD_ORIGINS.includes(url.origin)) {
      const newPath = mapPath(url.pathname);
      const newUrl = API_BASE + newPath + (url.search || "");
      return { req: new Request(newUrl, req0), url: new URL(newUrl) };
    }

    // 2) Mesma origem com caminho local → mantém
    const sameOrigin = url.origin === window.location.origin;

    if (sameOrigin) {
      const path = url.pathname || '/';
      if (isLocalPath(path)) return { req: req0, url };

      if (isApiPath(path)) {
        const newPath = mapPath(path);
        const newUrl = API_BASE + newPath + (url.search || "");
        return { req: new Request(newUrl, req0), url: new URL(newUrl) };
      }
    }

    // 3) Caminho absoluto já no API_BASE → mantém (ainda assim podemos injetar auth)
    if (url.origin === API_ORIGIN) return { req: req0, url };

    // 4) Caminho relativo string (ex.: "/api/x") quando veio por string
    if (typeof reqOrUrl === 'string' && reqOrUrl.startsWith('/')) {
      const p = reqOrUrl;
      if (isLocalPath(p)) return { req: req0, url: new URL(req0.url, window.location.href) };
      if (isApiPath(p)) {
        const newUrl = API_BASE + mapPath(p);
        // Nesse caso usamos init (se houve) em cima da string original
        return { req: new Request(newUrl, init || {}), url: new URL(newUrl) };
      }
    }

    // 5) Absoluta de domínio antigo (string)
    if (typeof reqOrUrl === 'string') {
      const rew = rewriteAbsoluteIfOldOrigin(reqOrUrl);
      if (rew) return { req: new Request(rew, init || {}), url: new URL(rew) };
    }

    // 6) Outras URLs/terceiros → passa direto
    return { req: req0, url };
  }

  // Monta uma nova Request com cabeçalhos ajustados
  function withHeaders(baseReq, headersObj) {
    const h = toHeaders(headersObj);
    return new Request(baseReq, { headers: h, method: baseReq.method });
  }

  // Sinaliza estado para inspeção eventual
  try { window.__backendPatch = { apiBase: API_BASE, applied: true }; } catch {}

  const origFetch = window.fetch.bind(window);

  window.fetch = (resource, init) => {
    const exec = async () => {
      try {
        // Reescrita de URL (roteamento) primeiro
        const routed = routeRequest(resource, init);
        let reqBase = routed.req;
        const url = routed.url; // pode ser null em casos extremos

        // Cabeçalhos atuais (sempre clonar para não mutar)
        let headers = toHeaders(reqBase.headers);

        // UX/diagnóstico mínimo
        setIfAbsent(headers, 'Accept-Language', 'pt-BR');

        // Tenta injetar Authorization quando apropriado e ausente
        let injectedAuth = false;
        if (url && shouldAttachAuth(url) && !hasAuthHeader(headers)) {
          const tok = await getIdTokenSoft();
          if (tok) {
            headers.set('Authorization', 'Bearer ' + tok);
            injectedAuth = true;
          }
        }

        // Request 1 (com headers finais)
        let req1 = withHeaders(reqBase, headers);

        // Dispara
        let resp = await origFetch(req1);

        // Retry 401: apenas se nós injetamos o token (para não atropelar chamadas do app)
        if (resp && resp.status === 401 && injectedAuth) {
          const fresh = await getIdTokenFresh();
          if (fresh) {
            const h2 = toHeaders(reqBase.headers);
            h2.set('Authorization', 'Bearer ' + fresh);
            setIfAbsent(h2, 'Accept-Language', 'pt-BR');
            const req2 = withHeaders(reqBase, h2);
            try { resp = await origFetch(req2); } catch (e) { /* mantém resp anterior */ }
          }
        }

        return resp;
      } catch (e) {
        // Em caso de erro inesperado, delega ao fetch original sem patch
        try { return await origFetch(resource, init); }
        catch { throw e; }
      }
    };
    return exec();
  };
})();
EOF

git add public/assets/backend-patch.js
git commit -m "feat(security): harden backend-patch (token auto-inject, 401 retry, apiBase allowlist, __list route)"

# 3) atualizar firebase-init.js
cat > public/assets/firebase-init.js <<'EOF'
// Firebase init (v8 ou v9-compat) — MEI Robô (produção)
// Requer: (a) v8: firebase-app.js + firebase-auth.js (+ firebase-firestore.js se usar Firestore)
//      ou (b) v9 compat: firebase-app-compat.js + firebase-auth-compat.js (+ firebase-firestore-compat.js se usar Firestore)
// Este script inicializa SOMENTE o app DEFAULT (login.html pode criar 'loginApp').

(function () {
  'use strict';

  // ---- CONFIG REAL (Console → Project settings → Web app)
  var firebaseConfig = {
    apiKey: "AIzaSyCjIbIjLOjAa_NyoB3MMLWOdq_rJs432qg",
    authDomain: "mei-robo-prod.firebaseapp.com",
    projectId: "mei-robo-prod",
    // OBS: storageBucket correto para uso de Storage: *.appspot.com
    storageBucket: "mei-robo-prod.appspot.com",
    messagingSenderId: "161054994911",
    appId: "1:161054994911:web:4a57ad4337d8edf0b5146a"
  };

  // ===== Blindagem extra =====
  function deepFreeze(o){ try{ Object.freeze(o); Object.keys(o||{}).forEach(function(k){ if (o[k] && typeof o[k]==='object') deepFreeze(o[k]); }); }catch{} }
  function maskKey(k){ if(!k || typeof k!=='string') return ''; if(k.length<=6) return '***'; return k.slice(0,3)+'***'+k.slice(-3); }
  function validConfig(cfg){
    return cfg && typeof cfg==='object'
      && typeof cfg.apiKey==='string' && cfg.apiKey && cfg.apiKey.toUpperCase()!=='PASTE_API_KEY'
      && typeof cfg.projectId==='string' && cfg.projectId
      && typeof cfg.appId==='string' && cfg.appId
      && typeof cfg.authDomain==='string' && cfg.authDomain;
  }
  deepFreeze(firebaseConfig);

  // Espera o Firebase estar disponível (caso os <script> anteriores carreguem ligeiramente depois)
  var MAX_TRIES = 20;     // ~2s (20 * 100ms)
  var TRY_DELAY = 100;

  function haveFirebase() {
    return !!(window.firebase && typeof firebase.initializeApp === 'function');
  }

  function warnCompatMixing(){
    try{
      // Se carregar compat e v8 misturados, apenas avisa — não quebra
      var hasCompat = !!(window.firebase && firebase.SDK_VERSION && /-compat/.test(firebase.SDK_VERSION));
      var hasV8 = !!(window.firebase && firebase.SDK_VERSION && !/-compat/.test(firebase.SDK_VERSION));
      if (hasCompat && hasV8) console.warn('[firebase-init] Mistura de SDKs detectada (compat + v8). Prefira um só.');
    }catch{}
  }

  function initDefault() {
    try {
      if (!validConfig(firebaseConfig)) {
        console.error('[firebase-init] Config inválida — verifique as credenciais do app web.');
        return;
      }

      warnCompatMixing();

      var app;
      if (!firebase.apps || !firebase.apps.length) {
        app = firebase.initializeApp(firebaseConfig);
        try {
          console.log("[firebase-init] DEFAULT inicializado:", (app.options && app.options.projectId) || "(?)");
        } catch {}
      } else {
        app = firebase.app();
        try {
          console.log("[firebase-init] DEFAULT já existia:", (app.options && app.options.projectId) || "(?)");
        } catch {}
      }

      // Expõe auth para uso rápido por outros scripts (se o pacote de auth estiver carregado)
      if (typeof firebase.auth === 'function') {
        try {
          var auth = firebase.auth();
          // idioma pt-BR (respeita device quando possível)
          if (typeof auth.useDeviceLanguage === 'function') auth.useDeviceLanguage();
          // exporta como read-only (evita reassign acidental)
          try {
            Object.defineProperty(window, '_auth', { value: auth, writable: false, configurable: false });
          } catch { window._auth = auth; }
        } catch (e) {
          console.warn("[firebase-init] firebase.auth() não pôde ser obtido:", e);
        }
      } else {
        console.warn("[firebase-init] Pacote de Auth não detectado. Carregue 'firebase-auth.js' (v8) ou 'firebase-auth-compat.js' (v9 compat).");
      }

      // Diagnóstico: lista apps (apiKey mascarada). Só se DEBUG_FIREBASE=1
      try {
        var debug = (function(){ try { return localStorage.getItem('DEBUG_FIREBASE')==='1'; } catch { return false; } })();
        if (debug && (firebase.apps || []).length) {
          var rows = (firebase.apps || []).map(function (a) {
            var k = a && a.options && a.options.apiKey;
            return { name: a && a.name, apiKeyMasked: maskKey(String(k||'')), projectId: a && a.options && a.options.projectId };
          });
          if (rows && rows.length) console.table(rows);
        }
      } catch (_) { /* ignore */ }

      // Info curta p/ inspeção manual sem vazar segredo
      try {
        window.__firebaseProject = {
          projectId: (app && app.options && app.options.projectId) || null,
          appId:     (app && app.options && app.options.appId) || null,
          hasAuth:   (typeof firebase.auth === 'function'),
          hasFS:     (typeof firebase.firestore === 'function')
        };
      } catch {}

    } catch (err) {
      console.error("[firebase-init] Falha ao inicializar o app DEFAULT:", err);
    }
  }

  (function waitForFirebase(tries) {
    if (haveFirebase()) {
      initDefault();
      return;
    }
    if (tries >= MAX_TRIES) {
      console.error(
        "[firebase-init] Firebase não disponível após aguardar.",
        "Certifique-se de carregar ANTES deste arquivo:",
        " - v8: firebase-app.js + firebase-auth.js (+ firebase-firestore.js se necessário)",
        " - ou v9 compat: firebase-app-compat.js + firebase-auth-compat.js (+ firebase-firestore-compat.js se necessário)"
      );
      return;
    }
    setTimeout(function () { waitForFirebase(tries + 1); }, TRY_DELAY);
  })(0);
})();
EOF

git add public/assets/firebase-init.js
git commit -m "feat(security): harden firebase-init (validação de config, apiKey mascarada, idioma auth pt-BR, _auth read-only)"

# 4) (opcional) pushar a branch
# git push -u origin feat/hardening-backend-and-firebase-init

