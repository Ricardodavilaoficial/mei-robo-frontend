// js/app.js

// --- IMPORTANTE: Variáveis globais do Firebase (auth, db, storage) são acessíveis via window. ---
// Ex: window.auth, window.db, window.storage
// Isso é definido em firebase-init.js

// --- Elementos HTML (referências aos elementos da página pelos NOVOS IDs) ---
// Seções principais
const authSection = document.getElementById('authSection');
const userDashboardSection = document.getElementById('userDashboardSection');
const personalKnowledgeSection = document.getElementById('personalKnowledgeSection');
const clientManagementSection = document.getElementById('clientManagementSection');
const fileUploadSection = document.getElementById('fileUploadSection');

// Formulários e seus campos
const formProfessionalRegister = document.getElementById('formProfessionalRegister');
const professionalNameInput = document.getElementById('professionalName');
const professionalEmailInput = document.getElementById('professionalEmail');
const professionalPasswordInput = document.getElementById('professionalPassword');
const professionalConfirmPasswordInput = document.getElementById('professionalConfirmPassword'); // NOVO: Confirmação de senha
const professionalCnpjInput = document.getElementById('professionalCnpj');
const voiceCloneFileInput = document.getElementById('voiceCloneFile');
const registerMessageDiv = document.getElementById('registerMessage');

const formProfessionalLogin = document.getElementById('formProfessionalLogin');
const loginEmailInput = document.getElementById('loginEmail');
const loginPasswordInput = document.getElementById('loginPassword');
const loginMessageDiv = document.getElementById('loginMessage');

const userIdDisplayDiv = document.getElementById('userIdDisplay');
const logoutButton = document.getElementById('logoutButton');

const formPersonalKnowledge = document.getElementById('formPersonalKnowledge');
const personalKnowledgeTextarea = document.getElementById('personalKnowledgeText');
const personalKnowledgeMessageDiv = document.getElementById('personalKnowledgeMessage');

const formClientContact = document.getElementById('formClientContact');
const clientContactNameInput = document.getElementById('clientContactName');
const clientContactPhoneInput = document.getElementById('clientContactPhone');
const clientRelationshipSelect = document.getElementById('clientRelationship');
const clientTreatmentInput = document.getElementById('clientTreatment');
const clientVoiceSampleFileInput = document.getElementById('clientVoiceSampleFile');
const clientNotesTextarea = document.getElementById('clientNotes');
const clientSpecificKnowledgeTextarea = document.getElementById('clientSpecificKnowledge');
const clientCommunicationStyleTextarea = document.getElementById('clientCommunicationStyle');
const clientContactMessageDiv = document.getElementById('clientContactMessage');

const selectClientToUploadDropdown = document.getElementById('selectClientToUpload');
const formFileUpload = document.getElementById('formFileUpload');
const fileToUploadInput = document.getElementById('fileToUpload');
const fileDescriptionInput = document.getElementById('fileDescription');
const fileUploadMessageDiv = document.getElementById('fileUploadMessage');

const clientList = document.getElementById('clientList');


// --- Variáveis Globais (para controlar o estado do usuário logado) ---
// Declaradas aqui no app.js para garantir que são usadas e atualizadas localmente
let currentProfessionalId = null; // Será o UID do usuário autenticado no Firebase Auth
let currentClients = []; // Armazenará os clientes para preencher o dropdown e lista


// --- Funções Auxiliares ---

// Função para exibir mensagens de status ao usuário
function showMessage(divElement, msg, type) {
    divElement.textContent = msg;
    divElement.className = `message ${type}`;
}

// Função para ocultar todas as seções principais (exceto a de autenticação)
function hideAllMainSections() {
    userDashboardSection.classList.add('hidden');
    personalKnowledgeSection.classList.add('hidden');
    clientManagementSection.classList.add('hidden');
    fileUploadSection.classList.add('hidden');
}

// Função para mostrar as seções pós-login
function showUserSections() {
    authSection.classList.add('hidden'); // Esconde a seção de login/registro
    userDashboardSection.classList.remove('hidden');
    personalKnowledgeSection.classList.remove('hidden');
    clientManagementSection.classList.remove('hidden');
    fileUploadSection.classList.remove('hidden');
}

// Função para carregar clientes e preencher o dropdown e a lista
async function loadClientsAndDisplay() {
    if (!currentProfessionalId || !window.db) { // Verifica se db está disponível via window
        console.warn("loadClientsAndDisplay: currentProfessionalId ou window.db não disponível.");
        return;
    }

    try {
        const clientsSnapshot = await window.db.collection("profissionais").doc(currentProfessionalId).collection("contatos").get();
        currentClients = clientsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        selectClientToUploadDropdown.innerHTML = '<option value="">-- Selecione um Contato --</option>';
        currentClients.forEach(contact => {
            const option = document.createElement('option');
            option.value = contact.id;
            option.textContent = contact.name;
            selectClientToUploadDropdown.appendChild(option);
        });

        clientList.innerHTML = '';
        if (currentClients.length === 0) {
            clientList.innerHTML = '<p>Nenhum contato cadastrado ainda.</p>';
        } else {
            currentClients.forEach(contact => {
                const li = document.createElement('li');
                li.innerHTML = `<strong>${contact.name}</strong> (${contact.relationship || 'Não informado'}) - Tel: ${contact.phone || 'Não informado'}`;
                clientList.appendChild(li);
            });
        }

    } catch (error) {
        console.error("Erro ao carregar contatos:", error);
        showMessage(clientContactMessageDiv, "Erro ao carregar lista de contatos.", 'error');
        showMessage(fileUploadMessageDiv, "Erro ao carregar lista de contatos.", 'error');
    }
}


// --- Lógica de Autenticação (Firebase Auth) ---

// Monitora o estado de autenticação (se o usuário está logado ou não)
// Certifica-se de que window.auth esteja disponível
if (window.auth) {
    window.auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentProfessionalId = user.uid;
            userIdDisplayDiv.textContent = `Logado como: ${user.email} (ID: ${user.uid})`;
            showUserSections();
            await loadClientsAndDisplay();
            await loadPersonalKnowledge();

        } else {
            currentProfessionalId = null;
            authSection.classList.remove('hidden');
            hideAllMainSections();
        }
    });
} else {
    console.error("Firebase Auth não foi inicializado. Verifique firebase-init.js");
}


// --- Lógica de Registro do Profissional ---
formProfessionalRegister.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessage(registerMessageDiv, 'Cadastrando seu Eu Digital...', '');

    const name = professionalNameInput.value;
    const email = professionalEmailInput.value;
    const password = professionalPasswordInput.value;
    const confirmPassword = professionalConfirmPasswordInput.value; // NOVO
    const cnpj = professionalCnpjInput.value;
    const voiceCloneFile = voiceCloneFileInput.files[0];

    // Validações básicas e de segurança da senha
    if (!name || !email || !password || !confirmPassword || !cnpj || !voiceCloneFile) {
        showMessage(registerMessageDiv, 'Por favor, preencha todos os campos e selecione sua voz clonada.', 'error');
        return;
    }
    if (password.length < 6) {
        showMessage(registerMessageDiv, 'A senha deve ter no mínimo 6 caracteres.', 'error');
        return;
    }
    if (password !== confirmPassword) { // NOVO: Validação de confirmação de senha
        showMessage(registerMessageDiv, 'As senhas não coincidem.', 'error');
        return;
    }
    if (!/^\d{14}$/.test(cnpj)) {
        showMessage(registerMessageDiv, 'Por favor, insira um CNPJ válido com 14 dígitos numéricos.', 'error');
        return;
    }
    if (voiceCloneFile.type !== 'audio/mp3' && voiceCloneFile.type !== 'audio/wav') {
        showMessage(registerMessageDiv, 'Por favor, selecione um arquivo de áudio MP3 ou WAV para sua voz clonada.', 'error');
        return;
    }

    try {
        // 1. Criar usuário no Firebase Authentication
        const userCredential = await window.auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        currentProfessionalId = user.uid;

        // 2. Upload da Voz Clonada para o Firebase Storage
        const voiceCloneStorageRef = window.storage.ref(`profissionais/${currentProfessionalId}/voz_clonada.wav`);
        await voiceCloneStorageRef.put(voiceCloneFile);
        const voiceCloneURL = await voiceCloneStorageRef.getDownloadURL();

        // 3. Salvar dados do profissional no Firestore (coleção 'profissionais')
        await window.db.collection("profissionais").doc(currentProfessionalId).set({
            name: name,
            email: email,
            cnpj: cnpj,
            voiceCloneURL: voiceCloneURL,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp(), // Usa window.firebase
            plan: "gratuito"
        });

        showMessage(registerMessageDiv, 'Seu Eu Digital foi cadastrado e sua conta criada com sucesso!', 'success');
        formProfessionalRegister.reset();

    } catch (error) {
        console.error("Erro ao cadastrar profissional:", error);
        showMessage(registerMessageDiv, `Erro ao cadastrar Eu Digital: ${error.message}`, 'error');
    }
});


// --- Lógica de Login do Profissional ---
formProfessionalLogin.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessage(loginMessageDiv, 'Entrando...', '');

    const email = loginEmailInput.value;
    const password = loginPasswordInput.value;

    if (!email || !password) {
        showMessage(loginMessageDiv, 'Por favor, insira seu email e senha.', 'error');
        return;
    }

    try {
        await window.auth.signInWithEmailAndPassword(email, password);
        showMessage(loginMessageDiv, 'Login realizado com sucesso!', 'success');
        formProfessionalLogin.reset();
    } catch (error) {
        console.error("Erro ao fazer login:", error);
        showMessage(loginMessageDiv, `Erro ao fazer login: ${error.message}`, 'error');
    }
});


// --- Lógica de Logout ---
logoutButton.addEventListener('click', async () => {
    try {
        await window.auth.signOut();
        showMessage(loginMessageDiv, 'Você saiu da sua conta.', 'success'); // Usa a div de login para a mensagem de logout
    } catch (error) {
        console.error("Erro ao sair:", error);
        showMessage(loginMessageDiv, `Erro ao sair: ${error.message}`, 'error');
    }
});


// --- Lógica de Memórias e Conhecimentos do Profissional ---
formPersonalKnowledge.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessage(personalKnowledgeMessageDiv, 'Salvando suas memórias...', '');

    if (!currentProfessionalId || !window.db) {
        showMessage(personalKnowledgeMessageDiv, 'Erro: Usuário não logado ou Firebase não inicializado. Por favor, faça login.', 'error');
        return;
    }

    const personalKnowledge = personalKnowledgeTextarea.value;

    if (!personalKnowledge.trim()) {
        showMessage(personalKnowledgeMessageDiv, 'Por favor, digite suas memórias e conhecimentos antes de salvar.', 'error');
        return;
    }

    try {
        await window.db.collection("profissionais").doc(currentProfessionalId).collection("memorias").doc("principal").set({
            content: personalKnowledge,
            lastUpdated: window.firebase.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        showMessage(personalKnowledgeMessageDiv, 'Memórias salvas com sucesso!', 'success');
    } catch (error) {
        console.error("Erro ao salvar memórias:", error);
        showMessage(personalKnowledgeMessageDiv, `Erro ao salvar memórias: ${error.message}`, 'error');
    }
});

// Função para carregar as memórias pessoais ao logar
async function loadPersonalKnowledge() {
    if (!currentProfessionalId || !window.db) return;
    try {
        const doc = await window.db.collection("profissionais").doc(currentProfessionalId).collection("memorias").doc("principal").get();
        if (doc.exists) {
            personalKnowledgeTextarea.value = doc.data().content;
        }
    } catch (error) {
        console.error("Erro ao carregar memórias pessoais:", error);
    }
}


// --- Lógica de Cadastro de Contato (Cliente do Profissional) ---
formClientContact.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessage(clientContactMessageDiv, 'Cadastrando contato...', '');

    if (!currentProfessionalId || !window.db || !window.storage) {
        showMessage(clientContactMessageDiv, 'Erro: Usuário não logado ou Firebase não inicializado. Por favor, faça login.', 'error');
        return;
    }

    const name = clientContactNameInput.value;
    const phone = clientContactPhoneInput.value;
    const relationship = clientRelationshipSelect.value;
    const treatment = clientTreatmentInput.value;
    const voiceSampleFile = clientVoiceSampleFileInput.files[0];
    const notes = clientNotesTextarea.value;
    const specificKnowledge = clientSpecificKnowledgeTextarea.value;
    const communicationStyle = clientCommunicationStyleTextarea.value;

    // Validações básicas
    if (!name || !phone || !relationship || !treatment) {
        showMessage(clientContactMessageDiv, 'Por favor, preencha os campos obrigatórios: Nome, WhatsApp, Relacionamento e Tratamento.', 'error');
        return;
    }
    if (!/^\d{10,15}$/.test(phone)) {
        showMessage(clientContactMessageDiv, 'Por favor, insira um número de WhatsApp válido (apenas números, com DDD).', 'error');
        return;
    }
    if (voiceSampleFile && voiceSampleFile.type !== 'audio/wav') {
        showMessage(clientContactMessageDiv, 'Por favor, selecione um arquivo de áudio WAV para a amostra de voz do contato, ou deixe em branco.', 'error');
        return;
    }

    try {
        const contactDocRef = window.db.collection("profissionais").doc(currentProfessionalId).collection("contatos").doc();
        const contactId = contactDocRef.id;
        let voiceSampleURL = '';

        if (voiceSampleFile) {
            const voiceSampleStorageRef = window.storage.ref(`profissionais/${currentProfessionalId}/contatos/${contactId}/amostra_voz.wav`);
            await voiceSampleStorageRef.put(voiceSampleFile);
            voiceSampleURL = await voiceSampleStorageRef.getDownloadURL();
        }

        await contactDocRef.set({
            name: name,
            phone: phone,
            relationship: relationship,
            treatment: treatment,
            voiceSampleURL: voiceSampleURL,
            notes: notes,
            specificKnowledge: specificKnowledge,
            communicationStyle: communicationStyle,
            createdAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });

        showMessage(clientContactMessageDiv, `Contato "${name}" cadastrado com sucesso!`, 'success');
        formClientContact.reset();
        await loadClientsAndDisplay();
    } catch (error) {
        console.error("Erro ao cadastrar contato:", error);
        showMessage(clientContactMessageDiv, `Erro ao cadastrar contato: ${error.message}`, 'error');
    }
});


// --- Lógica de Upload de Arquivos para o Contato ---
formFileUpload.addEventListener('submit', async (e) => {
    e.preventDefault();
    showMessage(fileUploadMessageDiv, 'Enviando arquivo...', '');

    if (!currentProfessionalId || !window.db || !window.storage) {
        showMessage(fileUploadMessageDiv, 'Erro: Usuário não logado ou Firebase não inicializado. Por favor, faça login.', 'error');
        return;
    }

    const selectedClientId = selectClientToUploadDropdown.value;
    if (!selectedClientId) {
        showMessage(fileUploadMessageDiv, 'Por favor, selecione um contato para enviar o arquivo.', 'error');
        return;
    }

    const fileToUpload = fileToUploadInput.files[0];
    const fileDescription = fileDescriptionInput.value;

    if (!fileToUpload) {
        showMessage(fileUploadMessageDiv, 'Por favor, selecione um arquivo para upload.', 'error');
        return;
    }

    try {
        const fileType = fileToUpload.type.startsWith('image/') ? 'imagem' :
                         fileToUpload.type.startsWith('video/') ? 'video' :
                         fileToUpload.type === 'application/pdf' ? 'pdf' :
                         fileToUpload.type.startsWith('audio/') ? 'audio' : 'outro';

        const fileName = fileToUpload.name;
        const fileStorageRef = window.storage.ref(`profissionais/${currentProfessionalId}/contatos/${selectedClientId}/arquivos/${Date.now()}_${fileName}`);

        await fileStorageRef.put(fileToUpload);
        const fileURL = await fileStorageRef.getDownloadURL();

        await window.db.collection("profissionais").doc(currentProfessionalId).collection("contatos").doc(selectedClientId).collection("arquivos").add({
            name: fileName,
            type: fileType,
            url: fileURL,
            description: fileDescription,
            uploadedAt: window.firebase.firestore.FieldValue.serverTimestamp()
        });

        showMessage(fileUploadMessageDiv, `Arquivo "${fileName}" enviado com sucesso para o contato!`, 'success');
        formFileUpload.reset();
    } catch (error) {
        console.error("Erro ao enviar arquivo:", error);
        showMessage(fileUploadMessageDiv, `Erro ao enviar arquivo: ${error.message}`, 'error');
    }
});