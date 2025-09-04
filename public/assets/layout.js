powershell -NoProfile -Command "@'
/*! layout.js – injeção de header/footer com fallback universal (v2025-09-04) */
(function () {
  'use strict';

  function log(){ try{ console.log.apply(console, ['[layout]'].concat([].slice.call(arguments))); }catch(e){} }
  function warn(){ try{ console.warn.apply(console, ['[layout]'].concat([].slice.call(arguments))); }catch(e){} }

  function ready(fn){
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn);
  }

  function tryFetch(urls, onOk, onFail) {
    var i = 0;
    (function next() {
      if (i >= urls.length) return onFail && onFail(new Error('Falha em: ' + urls.join(', ')));
      var u = urls[i++];
      if (u.indexOf('?') < 0) u += '?v=' + Date.now();
      fetch(u, { cache: 'no-store' })
        .then(function (r) { return r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function (html) { onOk && onOk(html); })
        .catch(next);
    })();
  }

  function pickEl(which){
    // which: 'header' | 'footer'
    var byId = document.getElementById('app-' + which);
    if (byId) return byId;
    return document.querySelector('[data-include=\"'+ which +'\"]');
  }

  function inject(which){
    var el = pickEl(which);
    if (!el) return;

    var urls = [
      '/partials/' + which + '.html',
      '../partials/' + which + '.html',
      '../../partials/' + which + '.html'
    ];

    tryFetch(urls, function(html){
      el.innerHTML = html;
      log('OK:', which);
    }, function(err){
      warn('Falha ao carregar', which, err && err.message);
      el.innerHTML = '<!-- layout: não foi possível carregar '+ which +' -->';
    });
  }

  function boot(){
    inject('header');
    inject('footer');
  }

  ready(boot);
})();
'@ | Set-Content -Encoding UTF8 'public\assets\layout.js'"
