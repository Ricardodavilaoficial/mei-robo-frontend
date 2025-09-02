// js/firebase-init.js
// SUAS CONFIGURAÇÕES DO FIREBASE
const firebaseConfig = {
    apiKey: "AIzaSyC4R5hjw-uVa5FKimdi3pMwSU1kgJpnMEI",
    authDomain: "crafty-granite-462012-h5.firebaseapp.com",
    projectId: "crafty-granite-462012-h5",
    storageBucket: "crafty-granite-462012-h5.appspot.com",
    messagingSenderId: "302054650054",
    appId: "1:302054650054:web:a5ac75a4fcc98b2455a7c7"
};

// Inicializar o Firebase
firebase.initializeApp(firebaseConfig);

// Obter instâncias dos serviços Firebase
const auth = firebase.auth(); // Adicionado para autenticação
const db = firebase.firestore();
const storage = firebase.storage();

// ATENÇÃO: As variáveis globais 'currentUserId' e 'currentClients'
// serão gerenciadas diretamente no app.js, pois o escopo deste arquivo
// é apenas para inicializar o Firebase.
// Removi a declaração delas daqui para evitar conflitos e manter a clareza.
// Elas serão definidas e atualizadas no app.js.

// As instâncias dos serviços Firebase são agora variáveis globais para o window
// Isso permite que 'app.js' as acesse diretamente sem a necessidade de export/import complexo
// para um setup de HTML puro + script tags.
window.auth = auth;
window.db = db;
window.storage = storage;