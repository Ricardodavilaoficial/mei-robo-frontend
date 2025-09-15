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
(function(){'use strict';
  var VERSION = '2025-09-15-01';

  function pickHeader(){ return document.getElementById('app-header') || document.querySelector('[data-include="header"]'); }
  function pickFooter(){ return document.getElementById('app-footer') || document.querySelector('[data-include="footer"]'); }

  function fetchWithPath(path){ 
    return fetch(path + (path.indexOf('?') === -1 ? '?v=' + VERSION : '&v=' + VERSION), { cache: 'no-store' })
      .then(function(r){ if (!r.ok) throw new Error('HTTP ' + r.status); return r.text(); });
  }

  // Tenta 1) /assets/partials/{name}.html  2) /partials/{name}.html
  function fetchPartDual(name){
    var primary = '/assets/partials/' + name + '.html';
    var secondary = '/partials/' + name + '.html';
    return fetchWithPath(primary).then(function(t){ return { html: t, src: primary }; })
      .catch(function(){ 
        return fetchWithPath(secondary).then(function(t){ return { html: t, src: secondary }; }); 
      });
  }

  function runInlineScripts(container){
    try {
      var scripts = Array.prototype.slice.call(container.querySelectorAll('script'));
      scripts.forEach(function(old){
        var s = document.createElement('script');
        if (old.src) {
          s.src = old.src + (old.src.indexOf('?') === -1 ? '?v=' + VERSION : '&v=' + VERSION);
          s.async = false; s.defer = !!old.defer;
        } else {
          s.text = old.textContent || '';
        }
        document.head.appendChild(s);
        if (old.parentNode) old.parentNode.removeChild(old);
      });
    } catch(e) { try { console.warn('[layout] script exec skip:', e.message || e); } catch(_ ){} }
  }

  function hideFallback(kind){
    try {
      var sel = kind === 'header' ? 'header._fallback' : 'footer._fallback';
      var nodes = document.querySelectorAll(sel);
      nodes.forEach(function(n){ n.style.display = 'none'; });
    } catch(e){}
  }

  function inject(el, html, kind){
    if (!el) return;
    el.innerHTML = html;
    runInlineScripts(el);
    hideFallback(kind);
  }

  function logOk(name, via){
    try { console.log('[layout] OK:', name, 'via', via); } catch(e){}
  }
  function logFail(name, err){
    try { console.warn('[layout] FAIL:', name, '-', (err && err.message) || err); } catch(e){}
  }

  function boot(){
    var h = pickHeader();
    var f = pickFooter();
    var jobs = [];
    if (h) {
      jobs.push(
        fetchPartDual('header').then(function(res){ inject(h, res.html, 'header'); logOk('header', res.src); })
                               .catch(function(e){ logFail('header', e); })
      );
    }
    if (f) {
      jobs.push(
        fetchPartDual('footer').then(function(res){ inject(f, res.html, 'footer'); logOk('footer', res.src); })
                               .catch(function(e){ logFail('footer', e); })
      );
    }
    return Promise.all(jobs);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
