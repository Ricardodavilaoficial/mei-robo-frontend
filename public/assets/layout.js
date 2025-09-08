// HOTFIX: pular redirect global nesta página (ela própria faz o gate)
(function () {
  try {
    var skipPages = ['/pages/configuracao.html'];
    if (skipPages.indexOf(location.pathname) !== -1) {
      window.__SKIP_GLOBAL_AUTH_REDIRECT__ = true;
    }
  } catch (e) {}
})();

/* layout.js - injeta header e footer (UTF-8, ASCII only) */
(function(){
  'use strict';

  function pickHeader(){
    return document.getElementById('app-header') || document.querySelector('[data-include="header"]');
  }
  function pickFooter(){
    return document.getElementById('app-footer') || document.querySelector('[data-include="footer"]');
  }
  function fetchPart(name){
    return fetch('/partials/' + name + '.html?v=2025-09-06-03', { cache: 'no-store' }).then(function(r){
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }
  function inject(el, html){
    if (!el) return;
    el.innerHTML = html;

    // Executa <script> embutidos no parcial (header/footer)
    try {
      var scripts = Array.prototype.slice.call(el.querySelectorAll('script'));
      scripts.forEach(function(old){
        var s = document.createElement('script');
        if (old.src) {
          s.src = old.src + (old.src.indexOf('?') === -1 ? '?v=2025-09-06-03' : '');
          s.async = false; s.defer = old.defer || false;
        } else {
          s.text = old.textContent || '';
        }
        document.head.appendChild(s);
        old.parentNode && old.parentNode.removeChild(old);
      });
    } catch(e) {
      try { console.warn('[layout] script exec skip:', e.message || e); } catch(_){}
    }
  }
  function logOk(name){ try { console.log('[layout] OK:', name); } catch(e){} }
  function logFail(name, err){ try { console.warn('[layout] FAIL:', name, '-', (err && err.message) || err); } catch(e){} }

  function boot(){
    var h = pickHeader();
    var f = pickFooter();
    Promise.all([
      fetchPart('header').then(function(t){ inject(h, t); logOk('header'); }).catch(function(e){ logFail('header', e); }),
      fetchPart('footer').then(function(t){ inject(f, t); logOk('footer'); }).catch(function(e){ logFail('footer', e); })
    ]);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
