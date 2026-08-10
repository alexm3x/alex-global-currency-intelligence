(() => {
  const VIEW_ID = 'equityIntelligence';

  function loadPerformanceAssets() {
    if (!document.querySelector('link[data-eqp-style]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'equity-performance-panel.css?v=20260807-performance1';
      link.dataset.eqpStyle = 'true';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-eqp-script]')) {
      const script = document.createElement('script');
      script.src = 'equity-performance-panel.js?v=20260807-performance1';
      script.defer = true;
      script.dataset.eqpScript = 'true';
      document.head.appendChild(script);
    }
  }

  function loadMultiAssetAssets() {
    if (!document.querySelector('link[data-aml-style]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'multi-asset-lists.css?v=20260807-lists1';
      link.dataset.amlStyle = 'true';
      document.head.appendChild(link);
    }
    if (!document.querySelector('script[data-aml-script]')) {
      const script = document.createElement('script');
      script.src = 'multi-asset-lists.js?v=20260807-lists1';
      script.defer = true;
      script.dataset.amlScript = 'true';
      document.head.appendChild(script);
    }
  }

  function loadDecisionEvidenceAssets() {
    if (document.querySelector('script[data-de-evidence-script]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'decision-evidence.js?v=20260810-phase3';
    script.dataset.deEvidenceScript = 'true';
    document.head.appendChild(script);
  }

  function loadDecisionEvolutionAssets() {
    if (document.querySelector('script[data-de-evolution-script]')) return;
    const script = document.createElement('script');
    script.type = 'module';
    script.src = 'decision-evolution.js?v=20260810-phase5a';
    script.dataset.deEvolutionScript = 'true';
    document.head.appendChild(script);
  }

  function ensurePodcastAccess(nav) {
    let podcast = nav.querySelector('[data-podcast-access]');
    if (!podcast) {
      podcast = document.createElement('button');
      podcast.type = 'button';
      podcast.dataset.podcastAccess = 'true';
      podcast.textContent = 'Morning Audio';
      podcast.setAttribute('aria-label', 'Escuchar AGCI Morning Intelligence');
    }
    podcast.onclick = () => { window.location.href = 'podcast/'; };
    const briefing = nav.querySelector('[data-view="briefing"]');
    if (briefing && briefing.nextElementSibling !== podcast) briefing.insertAdjacentElement('afterend', podcast);
    else if (!briefing && !podcast.isConnected) nav.appendChild(podcast);
  }

  function normalizeNavigation() {
    const nav = document.querySelector('.main-nav');
    if (!nav) return;

    const equityButtons = [...nav.querySelectorAll(`[data-view="${VIEW_ID}"]`)];
    let equity = equityButtons[0];

    if (!equity) {
      equity = document.createElement('button');
      equity.type = 'button';
      equity.dataset.view = VIEW_ID;
      equity.textContent = 'Equity Intelligence';
    }

    equityButtons.slice(1).forEach(button => button.remove());
    equity.textContent = 'Equity Intelligence';
    equity.setAttribute('aria-label', 'Abrir Equity Intelligence');

    const home = nav.querySelector('[data-view="home"]');
    if (home && home.nextElementSibling !== equity) {
      home.insertAdjacentElement('afterend', equity);
    }

    equity.onclick = () => {
      if (typeof window.setView === 'function') window.setView(VIEW_ID);
      else if (typeof setView === 'function') setView(VIEW_ID);
    };

    const seen = new Set();
    [...nav.querySelectorAll('[data-view]')].forEach(item => {
      const key = item.dataset.view;
      if (seen.has(key)) item.remove();
      else seen.add(key);
    });

    ensurePodcastAccess(nav);
  }

  function init() {
    normalizeNavigation();
    loadPerformanceAssets();
    loadMultiAssetAssets();
    loadDecisionEvidenceAssets();
    loadDecisionEvolutionAssets();
    const nav = document.querySelector('.main-nav');
    if (!nav) return;
    const observer = new MutationObserver(normalizeNavigation);
    observer.observe(nav, { childList: true });
    window.setTimeout(() => observer.disconnect(), 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();