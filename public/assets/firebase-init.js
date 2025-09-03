// public/assets/firebase-init.js
// Firebase init (v8) — MEI Robô (produção)
// Requer: firebase-app.js, firebase-auth.js já carregados (v8.10.1)

(function () {
  if (!(window.firebase && firebase.initializeApp)) {
    console.error("[firebase-init] Firebase SDK v8 não encontrado. Verifique a ordem dos <script>.");
    return;
  }

  // ⚠️ CONFIG REAL (copiada do Console > Project settings > Web app)
  var firebaseConfig = {
    apiKey: "AIzaSyCjIbIjLOjAa_NyoB3MMLWOdq_rJs432qg",
    authDomain: "mei-robo-prod.firebaseapp.com",
    projectId: "mei-robo-prod",
    storageBucket: "mei-robo-prod.appspot.com",
    messagingSenderId: "161054994911",
    appId: "1:161054994911:web:4a57ad4337d8edf0b5146a"
    // measurementId opcional
  };

  // Inicializa SOMENTE o DEFAULT (o login.html cria o app nomeado 'loginApp')
  var app;
  if (!firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
    console.log("[firebase-init] DEFAULT inicializado:", app.options.projectId);
  } else {
    app = firebase.app();
    console.log("[firebase-init] DEFAULT já existia:", app.options.projectId);
  }

  // Diagnóstico leve
  try {
    var table = (firebase.apps || []).map(function (a) {
      return { name: a.name, apiKey: a.options && a.options.apiKey };
    });
    console.table(table);
    if ((app.options.apiKey || "").toUpperCase() === "PASTE_API_KEY") {
      console.error("[firebase-init] API KEY inválida (PASTE_API_KEY). Atualize este arquivo no hosting.");
    }
  } catch (e) {}
})();
