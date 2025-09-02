// backend-patch.js — redireciona somente rotas de API para o backend em produção
(function () {
  // BACKEND em produção
  const API_BASE = "https://mei-robo-prod.onrender.com";

  // Rotas de API (apenas essas serão redirecionadas ao backend)
  const API_PREFIXES = [
    "/auth",
    "/clientes",
    "/pricing",
    "/schedule",
    "/whatsapp",
    "/api"
  ];

  // NUNCA redirecionar estes caminhos (assets/partials/html locais)
  const LOCAL_PREFIXES = ["/partials", "/assets"];
  const LOCAL_EXTS = [
    ".html", ".css", ".js", ".png", ".jpg",
    ".jpeg", ".svg", ".ico", ".webmanifest"
  ];

  function isLocalPath(path) {
    if (!path.startsWith("/")) return false;
    for (const p of LOCAL_PREFIXES) {
      if (path.startsWith(p)) return true;
    }
    for (const ext of LOCAL_EXTS) {
      if (path.endsWith(ext)) return true;
    }
    return false;
  }

  function isApiPath(path) {
    if (!path.startsWith("/")) return false;
    return API_PREFIXES.some(p => path.startsWith(p));
  }

  const origFetch = window.fetch.bind(window);

  window.fetch = (resource, init) => {
    try {
      // String URL
      if (typeof resource === "string") {
        if (isLocalPath(resource)) return origFetch(resource, init);
        if (isApiPath(resource)) return origFetch(API_BASE + resource, init);
        return origFetch(resource, init);
      }

      // Request objeto
      if (resource instanceof Request) {
        const url = new URL(resource.url, window.location.href);
        const isSameOrigin = url.origin === window.location.origin;
        if (isSameOrigin) {
          const path = url.pathname;
          if (isLocalPath(path)) return origFetch(resource, init);
          if (isApiPath(path)) {
            const newUrl = API_BASE + path + (url.search || "");
            const patched = new Request(newUrl, resource);
            return origFetch(patched, init);
          }
        }
      }

      return origFetch(resource, init);
    } catch (e) {
      return origFetch(resource, init);
    }
  };
})();
