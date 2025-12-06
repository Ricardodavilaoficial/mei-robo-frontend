// assets/acervo.js
// Tela de Acervo de Conhecimento — MEI Robô
// Fala com os endpoints /api/acervo* e respeita ?validate=1.

(function () {
  const $ = (sel) => document.querySelector(sel);

  const state = {
    isValidateMode: false,
    token: null,
    items: [],
    meta: null,
    selectedId: null,
    filterQuery: "",
  };

  function getValidateMode() {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get("validate") === "1";
    } catch (e) {
      return false;
    }
  }

  function showAlert(message, type = "info") {
    const box = $("#acervo-alert");
    if (!box) return;
    if (!message) {
      box.style.display = "none";
      return;
    }
    box.textContent = message;
    box.className = `acervo-alert ${type}`;
    box.style.display = "block";
  }

  function formatBytes(bytes) {
    if (typeof bytes !== "number" || isNaN(bytes)) return "–";
    if (bytes === 0) return "0 B";
    const units = ["B", "KB", "MB", "GB", "TB"];
    const i = Math.min(
      units.length - 1,
      Math.floor(Math.log(bytes) / Math.log(1024))
    );
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
  }

  function formatDate(val) {
    if (!val) return "–";
    try {
      let d;
      if (typeof val === "string" || typeof val === "number") {
        d = new Date(val);
      } else if (val._seconds || val.seconds) {
        const sec = val._seconds ?? val.seconds;
        d = new Date(sec * 1000);
      } else {
        return "–";
      }
      if (isNaN(d.getTime())) return "–";
      return d.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch (e) {
      return "–";
    }
  }

  function labelNivelUso(nivel) {
    switch (nivel) {
      case "clientes":
        return "Só clientes";
      case "familia_amigos":
        return "Família e amigos";
      case "interno":
        return "Só eu";
      case "todos":
      default:
        return "Qualquer pessoa";
    }
  }

  function apiFetch(path, options = {}) {
    // Usa backend-patch.js se existir, senão cai no fetch normal com Authorization.
    const url = path.startsWith("http")
      ? path
      : `/api${path.startsWith("/") ? "" : "/"}${path}`;

    if (window.backendFetch) {
      return window.backendFetch(url, options);
    }

    const headers = new Headers(options.headers || {});
    if (state.token) {
      headers.set("Authorization", `Bearer ${state.token}`);
    }
    if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
      headers.set("Content-Type", "application/json");
    }

    return fetch(url, {
      ...options,
      headers,
    });
  }

  function renderQuota() {
    const usageEl = $("#acervo-quota-usage");
    const maxEl = $("#acervo-quota-max");
    const barEl = $("#acervo-quota-bar");

    const meta = state.meta || {};
    const totalBytes = meta.totalBytes ?? meta.total ?? 0;
    const maxBytes =
      meta.maxBytes ??
      meta.max ??
      2 * 1024 * 1024 * 1024; // fallback 2GB

    const safeMax = Math.max(1, maxBytes);
    const usedPct = Math.max(0, Math.min(100, (totalBytes / safeMax) * 100));
    const freePct = 100 - usedPct;
    const livreBytes = Math.max(0, maxBytes - totalBytes);

    // Exibe uso em bytes + sufixo "usado"
    if (usageEl) {
      usageEl.textContent = `${formatBytes(totalBytes)} usado`;
    }

    // Exibe total em bytes + % livre (evita esse 2.0 GB vs 2.0 GB enganoso)
    if (maxEl) {
      maxEl.textContent = `${formatBytes(maxBytes)} total — ${freePct.toFixed(
        1
      )}% livre`;
    }

    // Barra visual de uso
    if (barEl) {
      barEl.style.width = `${usedPct.toFixed(1)}%`;

      if (!state.isValidateMode && usedPct >= 80) {
        showAlert(
          "Você está chegando perto do limite de espaço do seu plano. Se precisar guardar mais coisas, fale com a gente para aumentar o espaço.",
          "info"
        );
      }
    }
  }

  function getFilteredItems() {
    const q = (state.filterQuery || "").trim().toLowerCase();
    if (!q) return state.items || [];

    return (state.items || []).filter((item) => {
      const titulo = (item.titulo || "").toLowerCase();
      const tipo = (item.tipo || item.fonte || "").toLowerCase();
      const fonte = (item.fonte || "").toLowerCase();
      const nivel = labelNivelUso(item.nivelUso).toLowerCase();

      let tagsText = "";
      if (Array.isArray(item.tags)) {
        tagsText = item.tags.join(", ").toLowerCase();
      } else if (typeof item.tags === "string") {
        tagsText = item.tags.toLowerCase();
      }

      return (
        titulo.includes(q) ||
        tipo.includes(q) ||
        fonte.includes(q) ||
        tagsText.includes(q) ||
        nivel.includes(q)
      );
    });
  }

  function renderItems() {
    const tbody = $("#acervo-tbody");
    const subtitle = $("#acervo-list-subtitle");
    if (!tbody) return;

    tbody.innerHTML = "";

    const filtered = getFilteredItems();
    const total = state.items ? state.items.length : 0;

    if (!filtered || filtered.length === 0) {
      const tr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 9;
      td.className = "acervo-muted";
      td.textContent = state.filterQuery
        ? "Nenhum item encontrado com esse filtro."
        : "Ainda não há itens no seu acervo.";
      tr.appendChild(td);
      tbody.appendChild(tr);

      if (subtitle) {
        if (state.filterQuery) {
          subtitle.textContent = "Nenhum item encontrado para o filtro digitado.";
        } else {
          subtitle.textContent =
            "Seu acervo ainda está vazio. Comece adicionando um texto ou arquivo ao lado.";
        }
      }
      return;
    }

    filtered.forEach((item) => {
      const tr = document.createElement("tr");

      const tdTitulo = document.createElement("td");
      tdTitulo.textContent = item.titulo || "(sem título)";

      const tdTipo = document.createElement("td");
      tdTipo.textContent = item.tipo || item.fonte || "–";

      const tdTags = document.createElement("td");
      if (Array.isArray(item.tags) && item.tags.length) {
        item.tags.forEach((tag) => {
          const span = document.createElement("span");
          span.className = "acervo-tag-pill";
          span.textContent = String(tag);
          tdTags.appendChild(span);
        });
      } else if (typeof item.tags === "string" && item.tags.trim()) {
        const bits = item.tags.split(/[;,]/).map((s) => s.trim());
        bits.forEach((tag) => {
          if (!tag) return;
          const span = document.createElement("span");
          span.className = "acervo-tag-pill";
          span.textContent = tag;
          tdTags.appendChild(span);
        });
      } else {
        tdTags.innerHTML = '<span class="acervo-muted">–</span>';
      }

      const tdTamanho = document.createElement("td");
      tdTamanho.textContent = formatBytes(item.tamanhoBytes);

      const tdFonte = document.createElement("td");
      tdFonte.textContent = item.fonte || "–";

      const tdHabilitado = document.createElement("td");
      const enabled = !!item.habilitado;
      const spanHab = document.createElement("span");
      spanHab.className = enabled
        ? "acervo-badge-enabled"
        : "acervo-badge-disabled";
      spanHab.textContent = enabled ? "Sim" : "Não";
      tdHabilitado.appendChild(spanHab);

      const tdParaQuem = document.createElement("td");
      tdParaQuem.textContent = labelNivelUso(item.nivelUso);

      const tdAtualizado = document.createElement("td");
      const rawDate =
        item.atualizadoEm ||
        item.updatedAt ||
        item.criadoEm ||
        item.createdAt;
      tdAtualizado.textContent = formatDate(rawDate) || "–";

      const tdAcoes = document.createElement("td");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "acervo-btn acervo-btn-secondary";
      btn.textContent = "Editar";
      btn.addEventListener("click", () => {
        if (state.isValidateMode) {
          showAlert(
            "Modo de validação: edição desabilitada. Saia do ?validate=1 para editar de verdade.",
            "info"
          );
          return;
        }
        selectItemForEdit(item);
      });
      tdAcoes.appendChild(btn);

      tr.appendChild(tdTitulo);
      tr.appendChild(tdTipo);
      tr.appendChild(tdTags);
      tr.appendChild(tdTamanho);
      tr.appendChild(tdFonte);
      tr.appendChild(tdHabilitado);
      tr.appendChild(tdParaQuem);
      tr.appendChild(tdAtualizado);
      tr.appendChild(tdAcoes);

      tbody.appendChild(tr);
    });

    if (subtitle) {
      if (state.filterQuery) {
        subtitle.textContent = `${filtered.length} item(ns) exibido(s) de ${total} no seu acervo.`;
      } else {
        subtitle.textContent = `${filtered.length} item(ns) carregado(s) do seu acervo.`;
      }
    }
  }

  function parseTags(raw) {
    if (!raw) return [];
    return raw
      .split(/[;,]/)
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function selectItemForEdit(item) {
    state.selectedId = item.id || item.acervo_id || item.uid || null;
    const card = $("#acervo-edit-card");
    const meta = $("#acervo-edit-meta");
    if (!card) return;

    if (!state.selectedId) {
      showAlert(
        "Este item não possui um identificador compatível para edição.",
        "error"
      );
      return;
    }

    $("#acervo-edit-titulo").value = item.titulo || "";
    const tagsVal = Array.isArray(item.tags)
      ? item.tags.join(", ")
      : item.tags || "";
    $("#acervo-edit-tags").value = tagsVal;
    $("#acervo-edit-resumo").value = item.resumoCurto || "";
    const prioridadeInput = $("#acervo-edit-prioridade");
    if (prioridadeInput) {
      const prior = item.prioridade != null ? String(item.prioridade) : "";
      prioridadeInput.value = prior;
    }
    $("#acervo-edit-habilitado").checked = !!item.habilitado;

    const nivelSelect = $("#acervo-edit-nivelUso");
    if (nivelSelect) {
      nivelSelect.value = item.nivelUso || "todos";
    }

    if (meta) {
      meta.textContent = `Editando: ${
        item.titulo || "(sem título)"
      } — ID: ${state.selectedId}`;
    }
    card.style.display = "block";
  }

  function clearEditSelection() {
    state.selectedId = null;
    const card = $("#acervo-edit-card");
    if (card) {
      card.style.display = "none";
    }
  }

  async function loadAcervo() {
    showAlert("Carregando acervo...", "info");
    try {
      const res = await apiFetch("/acervo", {
        method: "GET",
        credentials: "include",
      });

      if (res.status === 401 || res.status === 403) {
        showAlert(
          "Sua sessão expirou ou não foi encontrada. Faça login novamente.",
          "error"
        );
        // Opcional: redirecionar
        // window.location.href = "/pages/login.html";
        return;
      }

      const data = await res.json().catch(() => ({}));

      let items = [];
      let meta = null;

      if (Array.isArray(data)) {
        items = data;
      } else {
        items = data.items || data.itens || [];
        meta = data.meta || data.acervoMeta || null;
      }

      state.items = items || [];
      state.meta = meta;

      // reset de filtro sempre que recarregar do backend
      state.filterQuery = "";
      const filterInput = $("#acervo-filter-query");
      if (filterInput) filterInput.value = "";

      renderQuota();
      renderItems();
      showAlert("", "info");
    } catch (err) {
      console.error("[acervo] erro ao carregar acervo:", err);
      showAlert(
        "Não consegui carregar o acervo agora. Tente novamente em alguns instantes.",
        "error"
      );
    }
  }

  async function handleCreateTexto(evt) {
    evt.preventDefault();
    if (state.isValidateMode) {
      showAlert(
        "Modo de validação: o envio está desabilitado. Saia do ?validate=1 para gravar de verdade.",
        "info"
      );
      return;
    }

    const titulo = $("#acervo-texto-titulo").value.trim();
    const corpo = $("#acervo-texto-corpo").value.trim();
    const tagsRaw = $("#acervo-texto-tags").value.trim();
    const prioridade = $("#acervo-texto-prioridade").value;
    const habilitado = $("#acervo-texto-habilitado").checked;
    const nivelUsoSelect = $("#acervo-texto-nivelUso");
    const nivelUso = nivelUsoSelect ? nivelUsoSelect.value : "todos";

    if (!titulo || !corpo) {
      showAlert("Preencha pelo menos o título e o texto.", "error");
      return;
    }

    const payload = {
      titulo,
      corpo,
      tags: parseTags(tagsRaw),
      habilitado,
      nivelUso: nivelUso || "todos",
    };

    if (prioridade) {
      payload.prioridade = Number(prioridade);
    }

    const btn = $("#acervo-texto-submit");
    showAlert("Salvando texto no acervo...", "info");
    if (btn) {
      btn.disabled = true;
      btn.dataset.label = btn.textContent;
      btn.textContent = "Salvando...";
    }

    try {
      const res = await apiFetch("/acervo/texto", {
        method: "POST",
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code = data.error || data.code || "internal_error";
        handleBackendError(code, data);
        return;
      }

      showAlert("Texto salvo no acervo com sucesso.", "success");
      // Limpa somente o texto; deixa tags e prioridade, que é útil repetir
      $("#acervo-texto-corpo").value = "";
      await loadAcervo();
    } catch (err) {
      console.error("[acervo] erro ao salvar texto:", err);
      showAlert(
        "Não consegui salvar este texto agora. Tente novamente em alguns instantes.",
        "error"
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.label || "Salvar no acervo";
      }
    }
  }

  async function handleUploadArquivo(evt) {
    evt.preventDefault();
    if (state.isValidateMode) {
      showAlert(
        "Modo de validação: o envio está desabilitado. Saia do ?validate=1 para gravar de verdade.",
        "info"
      );
      return;
    }

    const inputFile = $("#acervo-upload-arquivo");
    if (!inputFile || !inputFile.files || inputFile.files.length === 0) {
      showAlert("Escolha um arquivo para enviar.", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", inputFile.files[0]);

    const titulo = $("#acervo-upload-titulo").value.trim();
    const tagsRaw = $("#acervo-upload-tags").value.trim();
    const prioridade = $("#acervo-upload-prioridade").value;
    const habilitado = $("#acervo-upload-habilitado").checked;
    const nivelUsoSelect = $("#acervo-upload-nivelUso");
    const nivelUso = nivelUsoSelect ? nivelUsoSelect.value : "todos";

    if (titulo) formData.append("titulo", titulo);
    if (tagsRaw) formData.append("tags", tagsRaw);
    if (prioridade) formData.append("prioridade", prioridade);
    formData.append("habilitado", habilitado ? "true" : "false");
    formData.append("nivelUso", nivelUso || "todos");

    const btn = $("#acervo-upload-submit");
    showAlert("Enviando arquivo para o acervo...", "info");
    if (btn) {
      btn.disabled = true;
      btn.dataset.label = btn.textContent;
      btn.textContent = "Enviando...";
    }

    try {
      const res = await apiFetch("/acervo/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code = data.error || data.code || "internal_error";
        handleBackendError(code, data);
        return;
      }

      showAlert("Arquivo enviado e salvo no acervo.", "success");
      inputFile.value = "";
      await loadAcervo();
    } catch (err) {
      console.error("[acervo] erro no upload de arquivo:", err);
      showAlert(
        "Não consegui enviar este arquivo agora. Tente novamente em alguns instantes.",
        "error"
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.label || "Enviar arquivo";
      }
    }
  }

  async function handleEditSubmit(evt) {
    evt.preventDefault();
    if (state.isValidateMode) {
      showAlert(
        "Modo de validação: edição desabilitada. Saia do ?validate=1 para editar de verdade.",
        "info"
      );
      return;
    }
    if (!state.selectedId) {
      showAlert("Nenhum item selecionado para edição.", "error");
      return;
    }

    const titulo = $("#acervo-edit-titulo").value.trim();
    const tagsRaw = $("#acervo-edit-tags").value.trim();
    const prioridade = $("#acervo-edit-prioridade").value;
    const habilitado = $("#acervo-edit-habilitado").checked;
    const resumoCurto = $("#acervo-edit-resumo").value.trim();
    const nivelSelect = $("#acervo-edit-nivelUso");
    const nivelUso = nivelSelect ? nivelSelect.value : "";

    const payload = {};
    if (titulo) payload.titulo = titulo;
    if (tagsRaw) payload.tags = parseTags(tagsRaw);
    if (prioridade) payload.prioridade = Number(prioridade);
    payload.habilitado = habilitado;
    payload.resumoCurto = resumoCurto || null;
    if (nivelUso) payload.nivelUso = nivelUso;

    const btn = $("#acervo-edit-submit");
    showAlert("Salvando alterações do item...", "info");
    if (btn) {
      btn.disabled = true;
      btn.dataset.label = btn.textContent;
      btn.textContent = "Salvando...";
    }

    try {
      const res = await apiFetch(
        `/acervo/${encodeURIComponent(state.selectedId)}`,
        {
          method: "PATCH",
          body: JSON.stringify(payload),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        const code = data.error || data.code || "internal_error";
        handleBackendError(code, data);
        return;
      }

      showAlert("Item atualizado com sucesso.", "success");
      clearEditSelection();
      await loadAcervo();
    } catch (err) {
      console.error("[acervo] erro ao atualizar item:", err);
      showAlert(
        "Não consegui salvar as alterações agora. Tente novamente em alguns instantes.",
        "error"
      );
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.textContent = btn.dataset.label || "Salvar alterações";
      }
    }
  }

  function handleBackendError(code, payload) {
    console.warn("[acervo] erro backend:", code, payload);
    let msg = payload && payload.message ? String(payload.message) : "";

    switch (code) {
      case "unauthenticated":
      case "UNAUTHENTICATED":
        msg = msg || "Sessão não encontrada. Faça login novamente.";
        break;
      case "quota_exceeded":
        msg =
          msg ||
          "Você atingiu o limite de armazenamento do seu plano. Apague itens antigos ou fale com o suporte.";
        break;
      case "file_too_large":
        msg =
          msg ||
          "O arquivo é maior do que o permitido para o seu plano. Tente um arquivo menor ou divida o conteúdo.";
        break;
      case "meta_error":
        msg =
          msg ||
          "Não consegui atualizar os metadados do acervo. Tente novamente em alguns instantes.";
        break;
      default:
        msg =
          msg ||
          "Ocorreu um erro interno ao falar com o acervo. Tente novamente em alguns instantes.";
        break;
    }

    showAlert(msg, "error");
  }

  function setupTabs() {
    const tabTexto = $("#acervo-tab-texto");
    const tabUpload = $("#acervo-tab-upload");
    const formTexto = $("#acervo-form-texto");
    const formUpload = $("#acervo-form-upload");

    if (!tabTexto || !tabUpload || !formTexto || !formUpload) return;

    tabTexto.addEventListener("click", () => {
      tabTexto.classList.add("active");
      tabUpload.classList.remove("active");
      formTexto.style.display = "";
      formUpload.style.display = "none";
      tabTexto.setAttribute("aria-selected", "true");
      tabUpload.setAttribute("aria-selected", "false");
    });

    tabUpload.addEventListener("click", () => {
      tabUpload.classList.add("active");
      tabTexto.classList.remove("active");
      formUpload.style.display = "";
      formTexto.style.display = "none";
      tabUpload.setAttribute("aria-selected", "true");
      tabTexto.setAttribute("aria-selected", "false");
    });
  }

  function applyValidateMode() {
    if (!state.isValidateMode) return;
    const banner = $("#acervo-validate-banner");
    if (banner) banner.style.display = "block";

    const allInputs = document.querySelectorAll(
      "#acervo-root input, #acervo-root textarea, #acervo-root select, #acervo-root button"
    );
    allInputs.forEach((el) => {
      const id = el.id || "";
      // Permitimos somente navegação e recarregar
      if (
        id === "acervo-reload-btn" ||
        id === "acervo-tab-texto" ||
        id === "acervo-tab-upload"
      ) {
        return;
      }
      if (el.type === "button" || el.type === "submit" || el.tagName === "BUTTON") {
        el.disabled = true;
      }
      if (
        el.tagName === "INPUT" ||
        el.tagName === "TEXTAREA" ||
        el.tagName === "SELECT"
      ) {
        el.setAttribute("readonly", "readonly");
      }
    });
  }

  function fillFakeDataForValidate() {
    // Meta fake
    state.meta = {
      totalBytes: Math.round(8.5 * 1024 * 1024),
      maxBytes: 2 * 1024 * 1024 * 1024,
    };

    const now = Date.now();

    state.items = [
      {
        id: "demo-1",
        titulo: "Orientações de pré-atendimento",
        tipo: "texto",
        tags: ["técnico", "pré-atendimento", "clientes"],
        tamanhoBytes: 12 * 1024,
        fonte: "Texto aqui na tela",
        habilitado: true,
        nivelUso: "clientes",
        updatedAt: now - 3600 * 1000,
      },
      {
        id: "demo-2",
        titulo: "Curso de corte masculino avançado (PDF)",
        tipo: "pdf",
        tags: ["curso", "corte masculino"],
        tamanhoBytes: 2.5 * 1024 * 1024,
        fonte: "Arquivo enviado",
        habilitado: true,
        nivelUso: "todos",
        updatedAt: now - 2 * 24 * 3600 * 1000,
      },
      {
        id: "demo-3",
        titulo: "Nascimento do meu filho (mensagem do Dr. João)",
        tipo: "nota",
        tags: ["pessoal", "família", "Dr João"],
        tamanhoBytes: 4 * 1024,
        fonte: "Conversa WhatsApp",
        habilitado: true,
        nivelUso: "interno",
        updatedAt: now - 5 * 24 * 3600 * 1000,
      },
    ];

    state.filterQuery = "";
    const filterInput = $("#acervo-filter-query");
    if (filterInput) filterInput.value = "";
  }

  function initAuthAndLoad() {
    if (!window.firebase || !firebase.auth) {
      console.error("[acervo] Firebase não disponível.");
      showAlert(
        "Não consegui inicializar a autenticação. Recarregue a página em alguns instantes.",
        "error"
      );
      return;
    }

    firebase.auth().onAuthStateChanged(async (user) => {
      if (!user) {
        showAlert(
          "Sessão não encontrada. Faça login para acessar o seu acervo.",
          "error"
        );
        // Opcional: redirecionar
        // window.location.href = "/pages/login.html";
        return;
      }

      try {
        state.token = await user.getIdToken();
      } catch (e) {
        console.error("[acervo] erro ao obter idToken:", e);
        showAlert(
          "Não consegui validar a sua sessão. Tente sair e entrar novamente.",
          "error"
        );
        return;
      }

      await loadAcervo();
    });
  }

  function wireEvents() {
    const formTexto = $("#acervo-form-texto");
    const formUpload = $("#acervo-form-upload");
    const formEdit = $("#acervo-form-edit");
    const btnReload = $("#acervo-reload-btn");
    const btnEditCancel = $("#acervo-edit-cancel");
    const filterInput = $("#acervo-filter-query");

    if (formTexto) formTexto.addEventListener("submit", handleCreateTexto);
    if (formUpload) formUpload.addEventListener("submit", handleUploadArquivo);
    if (formEdit) formEdit.addEventListener("submit", handleEditSubmit);

    if (btnReload)
      btnReload.addEventListener("click", () => {
        if (state.isValidateMode) {
          fillFakeDataForValidate();
          renderQuota();
          renderItems();
        } else {
          loadAcervo();
        }
      });

    if (btnEditCancel)
      btnEditCancel.addEventListener("click", () => {
        clearEditSelection();
      });

    if (filterInput) {
      filterInput.addEventListener("input", (e) => {
        const val = e.target && typeof e.target.value === "string"
          ? e.target.value
          : "";
        state.filterQuery = val;
        renderItems();
      });
    }
  }

  document.addEventListener("DOMContentLoaded", () => {
    state.isValidateMode = getValidateMode();
    setupTabs();
    wireEvents();

    if (state.isValidateMode) {
      applyValidateMode();
      fillFakeDataForValidate();
      renderQuota();
      renderItems();
      showAlert(
        "Modo demonstração: estes dados são apenas de exemplo. Nada será gravado de verdade.",
        "info"
      );
      return;
    }

    initAuthAndLoad();
  });
})();
