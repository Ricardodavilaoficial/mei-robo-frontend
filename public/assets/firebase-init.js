/**
 * Firebase init — MEI Robô (produção)
 * Compat v9 + app nomeado "loginApp"
 * Requer: firebase-app-compat.js, firebase-auth-compat.js já carregados.
 */
(function () {
  if (!window.firebase) {
    console.error("[firebase-init] Firebase não encontrado no window. Verifique os <script> compat no HTML.");
    return;
  }

  // ⚠️ CONFIG REAL (copiada do seu console → Web app)
  const firebaseConfig = {
    apiKey: "AIzaSyCjIbIjLOjAa_NyoB3MMLWOdq_rJs432qg",
    authDomain: "mei-robo-prod.firebaseapp.com",
    projectId: "mei-robo-prod",
    storageBucket: "mei-robo-prod.appspot.com", // ← corrigido
    messagingSenderId: "161054994911",
    appId: "1:161054994911:web:4a57ad4337d8edf0b5146a"
    // measurementId: "G-XXXXXXXXXX" // (opcional)
  };

  // Evita reinit
  let defaultApp = firebase.apps.find(a => a.name === "[DEFAULT]");
  if (!defaultApp) {
    defaultApp = firebase.initializeApp(firebaseConfig);
    console.log("Firebase inicializado (DEFAULT):", defaultApp.options.projectId);
  }

  let loginApp = firebase.apps.find(a => a.name === "loginApp");
  if (!loginApp) {
    loginApp = firebase.initializeApp(firebaseConfig, "loginApp");
    console.log("Firebase inicializado (loginApp):", !!loginApp.options.apiKey ? "OK" : "SEM API KEY");
  }

  // Exponho referências úteis
  window.loginApp = loginApp;
  window.loginAuth = firebase.auth(loginApp);

  // Diagnóstico
  try {
    const table = firebase.apps.map(a => ({ name: a.name, apiKey: a.options.apiKey }));
    console.table(table);
  } catch (e) {
    console.warn("[firebase-init] Não foi possível listar apps:", e);
  }
})();
