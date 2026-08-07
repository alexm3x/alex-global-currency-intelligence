(() => {
  const VIEW_ID = 'equityIntelligence';

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
  }

  function init() {
    normalizeNavigation();
    const nav = document.querySelector('.main-nav');
    if (!nav) return;
    const observer = new MutationObserver(normalizeNavigation);
    observer.observe(nav, { childList: true });
    window.setTimeout(() => observer.disconnect(), 15000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
