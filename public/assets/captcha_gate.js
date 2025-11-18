// public/assets/captcha_gate.js — Gate de login com Cloudflare Turnstile (fix ABS_API)
(function() {
  const $container = document.getElementById('captcha-container');
  if (!$container) {
    console.warn('[captcha_gate] container #captcha-container não encontrado; ignorando.');
    return;
  }

  function getSiteKey() {
    const fromData = $container.getAttribute('data-sitekey');
    if (fromData) return fromData;
    if (window.__TURNSTILE_SITE_KEY) return window.__TURNSTILE_SITE_KEY;
    try {
      const ls = localStorage.getItem('turnstileSiteKey');
      if (ls) return ls;
    } catch {}
    return null;
  }

  // Detecta a base da API do backend (Render)
  function getApiBase() {
    try {
      if (window.API_BASE) return String(window.API_BASE);
      if (window.apiBase)  return String(window.apiBase);
    } catch {}
    try {
      const ls = localStorage.getItem('apiBase');
      if (ls) return ls;
    } catch {}
    // fallback produção (Render)
    return 'https://mei-robo-prod.onrender.com';
  }

  const sitekey = getSiteKey();
  if (!sitekey) {
    console.error('[captcha_gate] SiteKey não configurada. Defina data-sitekey no container.');
    return;
  }

  const API_BASE   = getApiBase().replace(/\/+$/, '');
  // 🔧 AJUSTE: usar rota com prefixo /api, que é a que tem CORS liberado no backend
  const VERIFY_URL = API_BASE + '/api/captcha/verify';
  console.log('[captcha_gate] VERIFY_URL =', VERIFY_URL);

  function setGatedEnabled(enabled) {
    const nodes = document.querySelectorAll('[data-human-gated]');
    nodes.forEach((el) => {
      el.disabled = !enabled;
      if (enabled) el.classList.remove('disabled');
      else el.classList.add('disabled');
    });
  }

  setGatedEnabled(false);

  function onToken(token) {
    fetch(VERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    .then(async (resp) => {
      let payload = null;
      try { payload = await resp.json(); } catch {}
      if (!resp.ok || !(payload && payload.ok)) {
        console.warn('[captcha_gate] verificação falhou', payload || resp.status);
        setGatedEnabled(false);
        return;
      }
      console.info('[captcha_gate] verificação ok');
      setGatedEnabled(true);
    })
    .catch((err) => {
      console.error('[captcha_gate] erro de rede', err);
      setGatedEnabled(false);
    });
  }

  function renderWidget() {
    if (!window.turnstile || !turnstile.render) {
      setTimeout(renderWidget, 200);
      return;
    }
    turnstile.render('#captcha-container', {
      sitekey: sitekey,
      callback: onToken,
      'error-callback': function() {
        console.warn('[captcha_gate] erro no widget');
        setGatedEnabled(false);
      },
      'expired-callback': function() {
        console.info('[captcha_gate] token expirou; desabilitando');
        setGatedEnabled(false);
      }
    });
  }

  renderWidget();
})();
