// assets/upgrade.js
// Upgrade de espaço (Starter+ 10 GB) via Portal do Cliente Stripe.
// Fase 1: tudo de pagamento é resolvido direto no Stripe.

(function () {
  const $ = (sel) => document.querySelector(sel);

  const state = {
    isValidateMode: false,
  };

  // Mesmo padrão das outras telas: ?validate=1 = modo vitrine
  function getValidateMode() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("validate") === "1";
    } catch (e) {
      return false;
    }
  }

  function setStatus(message) {
    const box = $("#upgrade-status");
    if (!box) return;
    box.textContent = message || "";
  }

  function showError(message) {
    const box = $("#upgrade-alert");
    if (!box) return;
    if (!message) {
      box.style.display = "none";
      box.textContent = "";
      return;
    }
    box.style.display = "block";
    box.textContent = message;
  }

  function showInfo(message) {
    const box = $("#upgrade-info");
    if (!box) return;
    if (!message) {
      box.style.display = "none";
      box.textContent = "";
      return;
    }
    box.style.display = "block";
    box.textContent = message;
  }

  // 🔗 Link oficial do Portal do Cliente (Stripe)
  // Se mudar no painel da Stripe, é só trocar AQUI.
  const STRIPE_PORTAL_URL = "https://billing.stripe.com/p/login/eVq3cu9ez2Qp7C67Zz6EU00";

  async function ensureLoggedIn() {
    return new Promise((resolve) => {
      const app = window.firebase && window.firebase.app ? window.firebase.app() : null;
      if (!app || !window.firebase || !window.firebase.auth) {
        setStatus("Não consegui carregar o login. Atualize a página.");
        return resolve(null);
      }

      const auth = window.firebase.auth();
      const current = auth.currentUser;
      if (current) return resolve(current);

      auth.onAuthStateChanged((user) => {
        resolve(user || null);
      });
    });
  }

  async function handleUpgradeClick() {
    if (state.isValidateMode) {
      showInfo(
        "Modo visual ligado (?validate=1). No uso real, esse botão abre o portal seguro da Stripe " +
        "para você atualizar sua assinatura (trocar para Starter+ 10 GB, ajustar pagamento, etc.)."
      );
      return;
    }

    showError("");
    showInfo("");
    setStatus("Confirmando seu login...");

    try {
      const user = await ensureLoggedIn();
      if (!user) {
        setStatus("Você precisa estar logado para fazer o upgrade.");
        showError("Faça login e volte para esta tela para concluir o upgrade.");

        try {
          const next = encodeURIComponent("/pages/upgrade.html");
          window.location.href = "/pages/login.html?next=" + next;
        } catch (_) {
          window.location.href = "/pages/login.html";
        }

        return;
      }

      setStatus("Abrindo a tela segura de pagamento (Stripe)...");

      // Fase 1: deixamos o Stripe cuidar de tudo.
      window.location.href = STRIPE_PORTAL_URL;
    } catch (e) {
      console.error("[upgrade] Erro ao redirecionar para o portal Stripe:", e);
      setStatus("Não consegui abrir o portal agora.");
      showError("Tente de novo em alguns minutos. Se continuar, fale com o suporte.");
    }
  }

  function handleVoltarAcervo() {
    window.location.href = "/pages/acervo.html";
  }

  document.addEventListener("DOMContentLoaded", () => {
    state.isValidateMode = getValidateMode();

    const btnUpgrade = $("#btn-upgrade-starter-plus");
    const btnVoltar = $("#btn-voltar-acervo");

    if (btnUpgrade) {
      btnUpgrade.addEventListener("click", handleUpgradeClick);
      if (state.isValidateMode) {
        showInfo(
          "Modo visual ligado (?validate=1). Aqui você só vê o layout. " +
          "No uso real, o botão leva para o portal de cobrança da Stripe."
        );
      }
    }

    if (btnVoltar) {
      btnVoltar.addEventListener("click", handleVoltarAcervo);
    }
  });
})();
