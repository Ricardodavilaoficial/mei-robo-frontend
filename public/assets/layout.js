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
    return fetch('/partials/' + name + '.html', { cache: 'no-store' }).then(function(r){
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.text();
    });
  }
  function inject(el, html){
    if (el) { el.innerHTML = html; }
  }
  function logOk(name){ try { console.log('[layout] OK: ' + name); } catch(e){} }
  function logFail(name, err){ try { console.warn('[layout] FAIL: ' + name + ' - ' + (err && err.message ? err.message : err)); } catch(e){} }

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
