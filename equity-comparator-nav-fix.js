(() => {
  const VIEW_ID = "equityComparator";

  function loadEquityIntelligenceAssets() {
    if (!document.querySelector('link[data-agci-equity-intelligence]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'equity-intelligence-dashboard.css?v=20260806-deep1';
      link.dataset.agciEquityIntelligence = 'true';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-agci-equity-intelligence]')) {
      const script = document.createElement('script');
      script.src = 'equity-intelligence-dashboard.js?v=20260806-deep1';
      script.dataset.agciEquityIntelligence = 'true';
      document.body.appendChild(script);
    }
  }

  function openComparator() {
    if (typeof window.setView === "function") {
      window.setView(VIEW_ID);
      return;
    }
    document.querySelectorAll(".view").forEach(view => view.classList.toggle("active", view.id === VIEW_ID));
    document.querySelectorAll(".main-nav [data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === VIEW_ID));
    document.getElementById(VIEW_ID)?.scrollIntoView({ block: "start" });
  }

  function exposeNavigation() {
    const nav = document.querySelector(".main-nav");
    const comparator = document.getElementById(VIEW_ID);
    if (!nav || !comparator) return false;
    let button = nav.querySelector(`[data-view="${VIEW_ID}"]`);
    if (!button) {
      button = document.createElement("button");
      button.type = "button";
      button.dataset.view = VIEW_ID;
    }
    button.textContent = "Análisis de 10 Acciones";
    const marketsButton = nav.querySelector('[data-view="markets"]');
    if (marketsButton) marketsButton.insertAdjacentElement("afterend", button);
    else nav.prepend(button);
    button.removeEventListener("click", openComparator);
    button.addEventListener("click", openComparator);
    button.setAttribute("aria-label", "Abrir comparador fundamental de hasta diez acciones");

    const home = document.getElementById("home");
    if (home && !document.getElementById("equityComparatorShortcut")) {
      const shortcut = document.createElement("section");
      shortcut.id = "equityComparatorShortcut";
      shortcut.className = "ranking-preview";
      shortcut.innerHTML = `<div class="section-heading"><div><p class="rubric">AGCI FUNDAMENTAL LAB</p><h2>Analice y edite hasta 10 acciones</h2><p>Compare P/E, P/S, EV/EBITDA, FCF Yield, crecimiento, márgenes, ROE, ROIC, deuda y empresas semejantes.</p></div><button type="button" class="link-button" id="openEquityComparator">Abrir comparador →</button></div>`;
      const ranking = home.querySelector(".ranking-preview");
      if (ranking) ranking.insertAdjacentElement("beforebegin", shortcut);
      else home.appendChild(shortcut);
      shortcut.querySelector("button")?.addEventListener("click", openComparator);
    }
    loadEquityIntelligenceAssets();
    return true;
  }

  function initialize() {
    loadEquityIntelligenceAssets();
    if (exposeNavigation()) return;
    const observer = new MutationObserver(() => {
      if (exposeNavigation()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    window.setTimeout(() => observer.disconnect(), 10000);
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initialize);
  else initialize();
})();
