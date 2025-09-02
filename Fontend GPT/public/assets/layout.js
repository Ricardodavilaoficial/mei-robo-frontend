// layout.js — robusto com fallback (relativo + absoluto)

function tryFetch(urls, onOk, onFail) {
  const next = (i) => {
    if (i >= urls.length) {
      return onFail(new Error("Falha em todas as URLs: " + urls.join(", ")));
    }
    const u = `${urls[i]}${urls[i].includes("?") ? "" : `?v=${Date.now()}`}`;
    fetch(u, { cache: "no-store" })
      .then((r) => (r.ok ? r.text() : Promise.reject(new Error(`${u} -> ${r.status}`))))
      .then((html) => onOk(html))
      .catch(() => next(i + 1));
  };
  next(0);
}

function inject(id, urls) {
  const el = document.getElementById(id);
  if (!el) return;

  tryFetch(
    urls,
    (html) => {
      el.innerHTML = html;
    },
    (err) => {
      console.error("Inject error:", err);
      el.innerHTML = `<div style="padding:8px;color:#b00020;background:#ffeaea;border:1px solid #ffc4c4;">
        Falha ao carregar: ${urls.map((u) => `<code>${u}</code>`).join(" ou ")}<br>${err.message}
      </div>`;
    }
  );
}

document.addEventListener("DOMContentLoaded", () => {
  // Como agenda.html está em /pages → preferimos o RELATIVO, com fallback ABSOLUTO
  inject("app-header", ["../partials/header.html", "/partials/header.html"]);
  inject("app-footer", ["../partials/footer.html", "/partials/footer.html"]);
});
