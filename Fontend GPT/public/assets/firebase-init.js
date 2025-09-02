// public/assets/firebase-init.js
(function () {
  // ❗ Substitua pelos valores reais do seu projeto (Console → Project settings → SDK config)
  const cfg = {
    apiKey: "PASTE_API_KEY",
    authDomain: "mei-robo-prod.firebaseapp.com",
    projectId: "mei-robo-prod",
    storageBucket: "mei-robo-prod.appspot.com",
    messagingSenderId: "PASTE_SENDER_ID",
    appId: "PASTE_APP_ID"
  };

  if (!window.firebase) {
    console.warn("Firebase SDK ainda não carregado (firebase-app/auth).");
    return;
  }
  if (!firebase.apps || !firebase.apps.length) {
    firebase.initializeApp(cfg);
    console.log("Firebase inicializado:", cfg.projectId);
  }
})();
