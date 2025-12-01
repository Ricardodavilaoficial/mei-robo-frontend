// header-auth.js — controla "Entrar / Sair" e saudação no header
(function () {
  'use strict';

  function onReady(fn) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', fn);
    } else {
      fn();
    }
  }

  function getAuthSafe() {
    try {
      if (!window.firebase) return null;

      // Compat v8 ou v9-compat expõem firebase.auth()
      if (typeof firebase.auth === 'function') {
        return firebase.auth();
      }

      // Fallback: tentar app() default
      if (typeof firebase.app === 'function') {
        try {
          var app = firebase.app();
          if (app && typeof app.auth === 'function') {
            return app.auth();
          }
        } catch (e) {
          return null;
        }
      }
    } catch (e) {
      try { console.warn('[header-auth] getAuthSafe erro:', e); } catch (_){}
      return null;
    }
    return null;
  }

  function clearLocalSession() {
    var keys = ['uid', 'idToken', 'isAdmin'];
    for (var i = 0; i < keys.length; i++) {
      try { localStorage.removeItem(keys[i]); } catch (_){}
    }
  }

  onReady(function () {
    var linkEntrar  = document.getElementById('link-entrar');
    var saudacao    = document.getElementById('saudacao');
    var btnSair     = document.getElementById('btn-sair');
    var userAvatar  = document.getElementById('user-avatar');
    var userInitial = document.getElementById('user-initial');
    var userMenu    = document.getElementById('user-menu');
    var menuSair    = document.getElementById('menu-sair');

    // Se o header não estiver presente, não faz nada
    if (!linkEntrar && !saudacao && !btnSair && !userAvatar) {
      return;
    }

    var auth = getAuthSafe();
    if (!auth) {
      // Em páginas públicas sem Firebase, o header fica no modo "visitante"
      return;
    }

    function applyUserState(user) {
      var isLogged = !!user;

      // Visitante / logado: visibilidade básica
      if (linkEntrar) {
        linkEntrar.style.display = isLogged ? 'none' : 'inline-block';
      }

      // CTA "Começar agora" (se existir no header)
      var ctas = document.querySelectorAll('.actions .cta');
      if (ctas && ctas.length) {
        for (var i = 0; i < ctas.length; i++) {
          var cta = ctas[i];
          // A primeira CTA normalmente é "Começar agora" no visitante
          if (!cta.id || cta.id === 'cta-começar-agora') {
            cta.style.display = isLogged ? 'none' : 'inline-block';
          }
        }
      }

      if (!isLogged) {
        if (saudacao) {
          saudacao.style.display = 'none';
          saudacao.textContent = '';
        }
        if (btnSair) btnSair.style.display = 'none';
        if (userAvatar) userAvatar.style.display = 'none';
        if (userMenu) {
          userMenu.style.display = 'none';
          userAvatar && userAvatar.setAttribute('aria-expanded', 'false');
        }
        return;
      }

      // Estado logado
      var nome = '';
      try {
        nome = user.displayName || user.email || '';
      } catch (_){}

      if (nome && nome.indexOf('@') > 0) {
        nome = nome.split('@')[0];
      }
      nome = (nome || 'MEI').trim();

      if (saudacao) {
        saudacao.textContent = 'Olá, ' + nome;
        saudacao.style.display = 'inline-block';
      }

      if (btnSair) {
        btnSair.style.display = 'inline-block';
      }

      if (userAvatar) {
        userAvatar.style.display = 'inline-block';
      }

      if (userInitial) {
        var initial = nome ? nome.charAt(0).toUpperCase() : 'M';
        userInitial.textContent = initial;
      }
    }

    function doLogout(ev) {
      if (ev && ev.preventDefault) ev.preventDefault();
      try {
        clearLocalSession();
        auth.signOut().catch(function () {});
      } catch (_){}

      // Fecha o menu, se existir
      if (userMenu) {
        userMenu.style.display = 'none';
      }
      if (userAvatar) {
        userAvatar.setAttribute('aria-expanded', 'false');
      }

      // Redireciona para login (poderia ser /index.html se preferir)
      window.location.href = '/pages/login.html';
    }

    // Eventos de logout
    if (btnSair) {
      btnSair.addEventListener('click', doLogout);
    }
    if (menuSair) {
      menuSair.addEventListener('click', doLogout);
    }

    // Toggle do menu do avatar
    if (userAvatar && userMenu) {
      userAvatar.addEventListener('click', function (ev) {
        if (ev && ev.preventDefault) ev.preventDefault();
        var isOpen = userMenu.style.display === 'block';
        userMenu.style.display = isOpen ? 'none' : 'block';
        userAvatar.setAttribute('aria-expanded', isOpen ? 'false' : 'true');
      });

      // Fecha menu ao clicar fora
      document.addEventListener('click', function (ev) {
        if (!userMenu || !userAvatar) return;
        var t = ev.target;
        if (!t) return;
        if (userMenu.contains(t) || userAvatar.contains(t)) return;
        userMenu.style.display = 'none';
        userAvatar.setAttribute('aria-expanded', 'false');
      });
    }

    // Estado inicial + listener
    try {
      applyUserState(auth.currentUser || null);
      auth.onAuthStateChanged(function (user) {
        applyUserState(user || null);
      });
    } catch (e) {
      try { console.warn('[header-auth] onAuthStateChanged erro:', e); } catch (_){}
    }
  });
})();
