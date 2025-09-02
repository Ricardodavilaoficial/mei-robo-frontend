// backend-patch.js — roteia chamadas de API para o backend de produção
(function () {
  // Backend atual (Render)
  const API_BASE = "https://mei-robo-prod.onrender.com";

  // Domínios antigos a redirecionar
  const OLD_ORIGINS = [
    "https://eu-digital.onrender.com",
    "http://eu-digital.onrender.com"
  ];

  // Prefixos de API que devem ir ao backend
  const API_PREFIXES = [
    "/auth",
    "/clientes",
    "/pricing",
    "/schedule",
    "/whatsapp",
    "/api",
    "/licencas",
    "/gerar-cupom"      // <- novo: a tela Admin usa este caminho relativo
  ];

  // Mapeamentos específicos de caminho → novo caminho no backend
  function mapPath(path) {
    // Se a tela chamar /gerar-cupom, preferimos a rota sob /licencas
    if (path === "/gerar-cupom") return "/licencas/gerar-cupom";
    // Mantém o restante como está
    return path;
  }

  const LOCAL_PREFIXES = ["/partials", "/assets"];
  const LOCAL_EXTS = [
    ".html", ".css", ".js", ".png", ".jpg",
    ".jpeg", ".svg", ".ico", ".webmanifest"
  ];

  function isLocalPath(path) {
    if (!path || !path.startsWith("/")) return false;
    for (const p of LOCAL_PREFIXES) if (path.startsWith(p)) return true;
    for (const ext of LOCAL_EXTS) if (path.endsWith(ext)) return true;
    return false;
  }

  function isApiPath(path) {
    if (!path || !path.startsWith("/")) return false;
    return API_PREFIXES.some(p => path.startsWith(p));
  }

  function rewriteAbsoluteIfOldOrigin(urlStr) {
    try {
      const u = new URL(urlStr);
      if (OLD_ORIGINS.includes(u.origin)) {
        const newPath = mapPath(u.pathname);
        return API_BASE + newPath + (u.search || "");
      }
    } catch {}
    return null;
  }

  const origFetch = window.fetch.bind(window);

  window.fetch = (resource, init) => {
    try {
      // Caso string
      if (typeof resource === "string") {
        // 1) URL absoluta do domínio antigo → API_BASE
        const rewritten = rewriteAbsoluteIfOldOrigin(resource);
        if (rewritten) return origFetch(rewritten, init);

        // 2) Caminho relativo local → mantém
        if (resource.startsWith("/") && isLocalPath(resource)) {
          return origFetch(resource, init);
        }

        // 3) Caminho relativo de API → envia ao backend (com mapeamento)
        if (resource.startsWith("/") && isApiPath(resource)) {
          const path = mapPath(resource);
          return origFetch(API_BASE + path, init);
        }

        // 4) Outras URLs → normal
        return origFetch(resource, init);
      }

      // Caso Request
      if (resource instanceof Request) {
        try {
          const url = new URL(resource.url, window.location.href);

          // A) Absoluta p/ domínio antigo
          if (OLD_ORIGINS.includes(url.origin)) {
            const newPath = mapPath(url.pathname);
            const newUrl = API_BASE + newPath + (url.search || "");
            const patched = new Request(newUrl, resource);
            return origFetch(patched, init);
          }

          // B) Mesma origem com caminho relativo
          const isSameOrigin = url.origin === window.location.origin;
          if (isSameOrigin) {
            const path = url.pathname;
            if (isLocalPath(path)) return origFetch(resource, init);
            if (isApiPath(path)) {
              const newPath = mapPath(path);
              const newUrl = API_BASE + newPath + (url.search || "");
              const patched = new Request(newUrl, resource);
              return origFetch(patched, init);
            }
          }
        } catch {}
      }

      return origFetch(resource, init);
    } catch {
      return origFetch(resource, init);
    }
  };
})();
