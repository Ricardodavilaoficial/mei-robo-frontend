// assets/upgrade.js
// Fluxo de upgrade de espaço (Starter+ 10 GB) no MEI Robô.
// Chama o backend em /api/upgrade/checkout e redireciona para o pagamento.

(function () {
  const $ = (sel) => document.querySelector(sel);

  const state = {
    isValidateMode: false,
    loading: false,
  };

  // Base do backend (Render). Se __API_BASE não estiver set, cai para relativo (dev/local).
  function getApiBase() {
    try {
      const raw = (window.__API_BASE || "").trim();
      if (!raw) return "";
      // tira barras duplicadas no final
      return raw.replace(/\/+$/, "");
    } catch (e) {
      return "";
    }
  }

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

  function setLoading(isLoading) {
    state.loading = isLoading;
    const btn = $("#btn-upgrade-starter-plus");
    if (!btn) return;
    btn.disabled = !!isLoading;
    if (isLoading) {
      if (!btn.dataset.originalLabel) {
        btn.dataset.originalLabel = btn.textContent;
      }
      btn.textContent = "Abrindo tela de pagamento...";
    } else if (btn.dataset.originalLabel) {
      btn.textContent = btn.dataset.originalLabel;
    }
  }

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

  async function getIdToken(user) {
    if (!user) return null;
    try {
      return await user.getIdToken(/* forceRefresh */ true);
    } catch (e) {
      console.error("Erro ao pegar idToken:", e);
      return null;
    }
  }

  async function handleUpgradeClick() {
    if (state.isValidateMode) {
      showInfo("Modo visual ligado (?validate=1). Aqui, o botão só mostra o fluxo — não chama o pagamento de verdade.");
      return;
    }

    if (state.loading) return;

    setLoading(true);
    showError("");
    showInfo("");
    setStatus("Confirmando sua conta...");

    try {
      const user = await ensureLoggedIn();
      if (!user) {
        setStatus("Você precisa estar logado para fazer o upgrade.");
        showError("Faça login e volte para esta tela para concluir o upgrade.");
        setLoading(false);
        window.location.href = "/pages/login.html";
        return;
      }

      const idToken = await getIdToken(user);
      if (!idToken) {
        setStatus("Não consegui confirmar seu login.");
        showError("Tente sair e entrar de novo na sua conta, depois volte aqui.");
        setLoading(false);
        return;
      }

      setStatus("Preparando a tela de pagamento...");

      const apiBase = getApiBase();
      const url = apiBase
        ? apiBase + "/api/upgrade/checkout"
        : "/api/upgrade/checkout"; // fallback dev/localhost

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + idToken,
        },
        body: JSON.stringify({
          plan: "starter_plus_10gb",
        }),
      });

      if (!res.ok) {
        let msg = "Não consegui abrir o pagamento agora. Tente de novo em alguns minutos.";
        try {
          const data = await res.json();
          if (data && data.error && data.error.message) {
            msg = data.error.message;
          } else if (data && data.error && typeof data.error === "string") {
            msg = data.error;
          }
        } catch (_) {
          // ignora parse de erro
        }
        console.error("Erro ao criar checkout de upgrade:", res.status, msg);
        setStatus("Algo não deu certo ao preparar o upgrade.");
        showError(msg);
        setLoading(false);
        return;
      }

      const data = await res.json();
      if (!data || !data.checkoutUrl) {
        setStatus("Resposta inesperada do servidor.");
        showError("Não consegui abrir a tela de pagamento. Tente de novo em alguns minutos.");
        setLoading(false);
        return;
      }

      setStatus("Redirecionando para o pagamento...");
      window.location.href = data.checkoutUrl;
    } catch (e) {
      console.error("Erro geral no fluxo de upgrade:", e);
      setStatus("Algo não deu certo ao preparar o upgrade.");
      showError("Tente novamente em alguns minutos. Se continuar, fale com o suporte.");
      setLoading(false);
    }
  }

  function handleVoltarAcervo() {
    window.location.href = "/pages/acervo.html";
  }

  // Bootstrap
  document.addEventListener("DOMContentLoaded", () => {
    state.isValidateMode = getValidateMode();

    const btnUpgrade = $("#btn-upgrade-starter-plus");
    const btnVoltar = $("#btn-voltar-acervo");

    if (btnUpgrade) {
      btnUpgrade.addEventListener("click", handleUpgradeClick);
      if (state.isValidateMode) {
        showInfo("Modo visual ligado (?validate=1). O botão mostra o fluxo, mas não chama o pagamento de verdade.");
      }
    }

    if (btnVoltar) {
      btnVoltar.addEventListener("click", handleVoltarAcervo);
    }
  });
})();
