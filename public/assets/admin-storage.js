/* admin-storage.js — MEI Robô
 * ADMIN Storage Viewer (seguro)
 * - Lista arquivos via backend (admin-only)
 * - Gera Signed URL via backend (admin-only)
 * - NÃO depende de Firebase Storage Rules
 */

(function(){
  const auth = firebase.auth();
  const $ = (sel)=>document.querySelector(sel);

  const uidInput   = $("#uid");
  const prefixInput= $("#prefix");
  const statusEl   = $("#status");
  const filesTbody = $("#filesTbody");

  function setStatus(html){ statusEl.innerHTML = html || ""; }
  function esc(s){ return String(s||"").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

  async function guard(){
    return new Promise((resolve)=>{
      auth.onAuthStateChanged(async (user)=>{
        if(!user){
          setStatus("Não autenticado. Redirecionando para login...");
          setTimeout(()=> location.href = "/pages/login.html", 600);
          return;
        }
        // claim admin é best-effort (não é o gate real)
        try{
          const token = await user.getIdTokenResult();
          if(!token.claims || token.claims.admin !== true){
            setStatus(`<span class="warn">Logado.</span> (Obs: claim admin não detectada. O acesso real é validado no backend.)`);
          } else {
            setStatus(`<span class="ok">Autenticado.</span>`);
          }
        }catch(e){
          console.warn("Falha ao checar claims", e);
          setStatus(`<span class="ok">Autenticado.</span>`);
        }
        resolve(user);
      });
    });
  }

  function defaultPrefix(){
    const uid = (uidInput.value || "").trim();
    // robusto: lista tudo do sandbox do usuário (evita "lista vazia" se o caminho variar)
    return uid ? `sandbox/${uid}/` : "sandbox/";
  }

  async function getIdToken(){
    const user = auth.currentUser;
    if(!user) throw new Error("not_authenticated");
    return user.getIdToken(true);
  }

  async function apiGet(url, params){
    const idToken = await getIdToken();
    const q = new URLSearchParams(params || {});
    const resp = await fetch(`${url}?${q}`, {
      headers: { "Authorization": `Bearer ${idToken}` }
    });

    const text = await resp.text();
    let data = null;
    try{ data = JSON.parse(text); }catch(_){ /* ignore */ }

    if(!resp.ok){
      // Mensagens claras pra não parecer "bug" quando é permissão
      if(resp.status === 401){
        throw new Error("401 unauthorized — faça login novamente (token inválido/expirado).");
      }
      if(resp.status === 403){
        const detail = (data && (data.error || data.detail)) ? ` (${data.error || data.detail})` : "";
        throw new Error("403 forbidden — você não tem acesso admin (allowlist)." + detail);
      }
      const msg = (data && (data.error || data.detail))
        ? `${data.error}${data.detail?": "+data.detail:""}`
        : `${resp.status} ${resp.statusText}`;
      throw new Error(msg);
    }
    return data;
  }

  async function listFiles(){
    const uid = (uidInput.value || "").trim();
    if(!uid) return alert("Informe o UID ou clique em 'Usar meu UID'.");

    const prefix = (prefixInput.value || "").trim() || defaultPrefix();
    prefixInput.value = prefix;

    const listBtn = $("#listBtn");
    if (listBtn) listBtn.disabled = true;

    setStatus(`Listando: <span class="badge">${esc(prefix)}</span> ...`);
    filesTbody.innerHTML = `<tr><td colspan="5" class="muted">Carregando...</td></tr>`;

    const listBtn2 = $("#listBtn");
    try{
      const data = await apiGet("/api/admin/storage/list", { prefix, limit: "500" });
      const items = (data && data.items) || [];

      if(items.length === 0){
        filesTbody.innerHTML = `<tr><td colspan="5" class="muted">Sem arquivos nesse prefixo.</td></tr>`;
        setStatus(`Pronto. <span class="ok">0 itens</span> em <span class="badge">${esc(prefix)}</span>`);
        return;
      }

      filesTbody.innerHTML = "";
      for(const it of items){
        const tr = document.createElement("tr");

        const nameTd = document.createElement("td");
        nameTd.textContent = (it.path || "").split("/").pop() || "(sem nome)";

        const sizeTd = document.createElement("td");
        const size = Number(it.size || 0);
        sizeTd.textContent = size < 1024 ? `${size} B` : `${(size/1024).toFixed(1)} KB`;

        const typeTd = document.createElement("td");
        typeTd.className = "small";
        typeTd.textContent = it.contentType || "-";

        const pathTd = document.createElement("td");
        pathTd.className = "small";
        pathTd.textContent = it.path || "-";

        const actionsTd = document.createElement("td");
        actionsTd.className = "actions";
        const openBtn = document.createElement("button");
        openBtn.textContent = "Abrir (Signed URL)";
        openBtn.addEventListener("click", ()=> openSignedUrl(it.path));
        actionsTd.appendChild(openBtn);

        tr.appendChild(nameTd);
        tr.appendChild(sizeTd);
        tr.appendChild(typeTd);
        tr.appendChild(pathTd);
        tr.appendChild(actionsTd);
        filesTbody.appendChild(tr);
      }

      setStatus(`Pronto. <span class="ok">${items.length} itens</span> em <span class="badge">${esc(prefix)}</span>`);
    }catch(e){
      console.error(e);
      setStatus(`<span class="err">Falhou listar:</span> ${esc(e.message || e)}`);
      filesTbody.innerHTML = `<tr><td colspan="5" class="muted">Erro ao listar.</td></tr>`;
    }finally{
      if (listBtn2) listBtn2.disabled = false;
    }
  }

  async function openSignedUrl(path){
    if(!path) return;
    setStatus("Gerando Signed URL...");
    try{
      const data = await apiGet("/api/admin/storage/signed-url", { path });
      if(!data || !data.url) throw new Error("Resposta sem URL");
      window.open(data.url, "_blank", "noopener");
      setStatus(`URL gerada. <span class="muted">Expira em ~${Math.round((data.expiresInSeconds||900)/60)}min.</span>`);
    }catch(e){
      console.error(e);
      setStatus(`<span class="err">Falhou gerar Signed URL:</span> ${esc(e.message || e)}`);
    }
  }

  function wire(){
    $("#useMyUid").addEventListener("click", async ()=>{
      const user = auth.currentUser;
      if(!user) return alert("Não autenticado.");
      uidInput.value = user.uid;
      prefixInput.value = defaultPrefix();
    });

    $("#useDefaultPrefix").addEventListener("click", ()=>{
      prefixInput.value = defaultPrefix();
    });

    $("#listBtn").addEventListener("click", listFiles);

    // inicializa prefix
    if(!prefixInput.value) prefixInput.value = defaultPrefix();
  }

  guard().then(()=> wire());
})();
