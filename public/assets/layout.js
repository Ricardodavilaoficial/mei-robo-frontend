/* layout.js - injeta header e footer (robusto a quedas de rede/QUIC) :: v11 */
(function(){'use strict';
  var VERSION = 'v11-2025-09-16-08';

  function pickHeader(){ return document.getElementById('app-header') || document.querySelector('[data-include="header"]'); }
  function pickFooter(){ return document.getElementById('app-footer') || document.querySelector('[data-include="footer"]'); }

  function withVersion(url){
    return url + (url.indexOf('?') === -1 ? '?v=' + VERSION : '&v=' + VERSION);
  }

  function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

  // fetch de texto com timeout + cache reload (quando solicitado)
  function fetchText(url, opts){
    opts = opts || {};
    var ctrl = new AbortController();
    var t = setTimeout(function(){ try{ ctrl.abort(); }catch(_){ } }, opts.timeout || 9000);
    var init = {
      cache: opts.reload ? 'reload' : 'no-store',
      credentials: 'same-origin',
      signal: ctrl.signal
    };
    return fetch(url, init).then(function(r){
      clearTimeout(t);
      if(!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    }).catch(function(e){
      clearTimeout(t);
      throw e;
    });
  }

  // Tenta buscar com 1ª tentativa normal + retries com bust de conexão
  function fetchWithRetry(url, tries){
    tries = Math.max(1, tries || 2);
    var attempt = 0;

    function next(){
      attempt++;
      var bustUrl = attempt === 1 ? withVersion(url)
        : withVersion(url + (url.indexOf('?') === -1 ? '?r=' : '&r=') + Math.floor(Math.random()*1e9));
      var useReload = attempt > 1; // no 2º round em diante, força nova conexão
      return fetchText(bustUrl, { timeout: 9000, reload: useReload }).catch(function(err){
        if (attempt < tries){
          return sleep(400 + attempt*250).then(next);
        }
        throw err;
      });
    }
    return next().then(function(text){ return { html: text, src: url }; });
  }

  // Tenta 1) /assets/partials/{name}.html  2) /partials/{name}.html
  function fetchPartDual(name){
    var primary = '/assets/partials/' + name + '.html';
    var secondary = '/partials/' + name + '.html';
    return fetchWithRetry(primary, 3)
      .catch(function(){ return fetchWithRetry(secondary, 3); });
  }

  function runInlineScripts(container){
    try {
      var scripts = Array.prototype.slice.call(container.querySelectorAll('script'));
      scripts.forEach(function(old){
        var s = document.createElement('script');
        if (old.src) {
          var src = old.src + (old.src.indexOf('?') === -1 ? '?v=' + VERSION : '&v=' + VERSION);
          s.src = src; s.async = false; s.defer = !!old.defer;
        } else {
          s.text = old.textContent || '';
        }
        document.head.appendChild(s);
        if (old.parentNode) old.parentNode.removeChild(old);
      });
    } catch(e) { try { console.warn('[layout] script exec skip:', e.message || e); } catch(_ ){} }
  }

  function hideFallbackStrict(kind){
    try {
      var container = document.querySelector(kind === 'header' ? '#app-header' : '#app-footer');
      if (!container) return;

      var injected = container.querySelector(kind);
      var nodes = document.querySelectorAll(kind);
      for (var i=0;i<nodes.length;i++) {
        var n = nodes[i];
        if ((!injected || n !== injected) && !container.contains(n)) {
          n.style.display = 'none';
          n.setAttribute('data-legacy-hidden','1');
        }
      }

      var sel = [
        kind + '._fallback',
        kind + '[data-fallback]',
        '.index-fallback ' + kind,
        '#header-fallback',
        '#footer-fallback'
      ].join(',');
      var extras = document.querySelectorAll(sel);
      for (var j=0;j<extras.length;j++) {
        var e = extras[j];
        if (!container.contains(e)) {
          e.style.display = 'none';
          e.setAttribute('data-legacy-hidden','1');
        }
      }
    } catch(e){ /* silencioso */ }
  }

  function observeLateFallbacks(kind){
    try {
      var container = document.querySelector(kind === 'header' ? '#app-header' : '#app-footer');
      if (!container || !window.MutationObserver) return;
      var mo = new MutationObserver(function(muts){
        for (var i=0;i<muts.length;i++) {
          var nodes = muts[i].addedNodes || [];
          for (var j=0;j<nodes.length;j++) {
            var n = nodes[j];
            if (!n || n.nodeType !== 1) continue;
            var tag = (n.tagName||'').toLowerCase();
            if (tag === kind && !container.contains(n)) {
              n.style.display='none'; n.setAttribute('data-legacy-hidden','1');
            }
            var q = n.querySelectorAll ? n.querySelectorAll(
              kind + ', ' + kind + '._fallback, ' + kind + '[data-fallback], .index-fallback ' + kind + ', #header-fallback, #footer-fallback'
            ) : [];
            for (var k=0;k<q.length;k++) {
              var el = q[k];
              if (!container.contains(el)) { el.style.display='none'; el.setAttribute('data-legacy-hidden','1'); }
            }
          }
        }
      });
      mo.observe(document.documentElement || document.body, { childList: true, subtree: true });
      if (kind === 'header') window.__HIDE_FALLBACK_MO_HEADER__ = mo;
      else window.__HIDE_FALLBACK_MO_FOOTER__ = mo;
    } catch(e){ /* silencioso */ }
  }

  function inject(el, html, kind){
    if (!el) return;
    el.innerHTML = html;
    runInlineScripts(el);
    hideFallbackStrict(kind);
    observeLateFallbacks(kind);
  }

  function logOk(name, via){ try { console.log('[layout] OK:', name, 'via', via); } catch(e){} }
  function logFail(name, err){ try { console.warn('[layout] FAIL:', name, '-', (err && err.message) || err); } catch(e){} }

  function boot(){
    var h = pickHeader();
    var f = pickFooter();
    var jobs = [];
    if (h) {
      jobs.push(
        fetchPartDual('header')
          .then(function(res){ inject(h, res.html, 'header'); logOk('header', res.src); })
          .catch(function(e){ logFail('header', e); })
      );
    }
    if (f) {
      jobs.push(
        fetchPartDual('footer')
          .then(function(res){ inject(f, res.html, 'footer'); logOk('footer', res.src); })
          .catch(function(e){ logFail('footer', e); })
      );
    }
    return Promise.all(jobs);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
