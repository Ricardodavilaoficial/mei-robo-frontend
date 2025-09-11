// public/assets/captcha_gate.js — Gate de login com Cloudflare Turnstile
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

  const sitekey = getSiteKey();
  if (!sitekey) {
    console.error('[captcha_gate] SiteKey não configurada. Defina data-sitekey no container.');
    return;
  }

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
    fetch('/captcha/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token })
    })
    .then(async (resp) => {
      const ok = resp.ok;
      let payload = null;
      try { payload = await resp.json(); } catch {}
      if (!ok) {
        console.warn('[captcha_gate] verificação falhou', payload || resp.status);
        setGatedEnabled(false);
        return;
      }
      console.info('[captcha_gate] verificação ok', payload);
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
