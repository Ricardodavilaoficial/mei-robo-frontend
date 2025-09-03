<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>MEI Robô — Login</title>

  <!-- Firebase SDK v9 compat (ordem importa) -->
  <script src="https://www.gstatic.com/firebasejs/9.6.11/firebase-app-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.11/firebase-auth-compat.js"></script>
  <script src="https://www.gstatic.com/firebasejs/9.6.11/firebase-firestore-compat.js"></script>

  <!-- Sua config correta -->
  <script src="/assets/firebase-init.js"></script>

  <!-- JS de login via SDK (sem usar REST) -->
  <script src="/assets/login.js"></script>

  <style>
    body { font-family: system-ui, Arial, sans-serif; margin: 2rem; }
    .card { max-width: 360px; padding: 1.25rem; border: 1px solid #e5e7eb; border-radius: 12px; }
    label { display:block; margin-top: .75rem; font-size: .9rem; }
    input { width:100%; padding:.6rem .7rem; margin-top:.35rem; border:1px solid #d1d5db; border-radius:8px; }
    button { width:100%; padding:.7rem; margin-top:1rem; border:0; border-radius:10px; cursor:pointer; }
    #btn-login { background:#25D366; color:#fff; font-weight:600; }
    #login-msg { margin-top:.75rem; font-size:.9rem; color:#374151; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Entrar</h1>
    <form id="login-form">
      <label for="email">E-mail</label>
      <input id="email" type="email" autocomplete="username" required />

      <label for="password">Senha</label>
      <input id="password" type="password" autocomplete="current-password" required />

      <button id="btn-login" type="submit">Entrar</button>
      <div id="login-msg"></div>
    </form>
  </div>
</body>
</html>
