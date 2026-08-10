(() => {
  const VERSION = '20260810-visible1';

  function ensureStyle() {
    if (document.querySelector('link[data-de-discoverability-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `decision-discoverability.css?v=${VERSION}`;
    link.dataset.deDiscoverabilityStyle = 'true';
    document.head.appendChild(link);
  }

  function waitForTarget(id, timeout = 12000) {
    return new Promise(resolve => {
      const existing = document.getElementById(id);
      if (existing) return resolve(existing);
      const root = document.getElementById('decisionEngineRoot') || document.body;
      const observer = new MutationObserver(() => {
        const target = document.getElementById(id);
        if (!target) return;
        observer.disconnect();
        resolve(target);
      });
      observer.observe(root, { childList: true, subtree: true });
      setTimeout(() => {
        observer.disconnect();
        resolve(document.getElementById(id));
      }, timeout);
    });
  }

  async function goToPhase(targetId) {
    let target = document.getElementById(targetId);
    if (!target && ['deEvidenceLayer', 'deEvolutionLayer'].includes(targetId)) {
      const analyze = document.getElementById('deAnalyze');
      if (analyze && !analyze.disabled) analyze.click();
      target = await waitForTarget(targetId);
    }
    if (!target && targetId === 'deOutput') target = document.getElementById('deOutput');
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function phaseButton(phase, title, subtitle, target, status) {
    return `<button type="button" class="ded-phase" data-ded-target="${target}">
      <span class="ded-phase-number">${phase}</span>
      <span class="ded-phase-copy"><strong>${title}</strong><small>${subtitle}</small></span>
      <span class="ded-phase-status">${status}</span>
    </button>`;
  }

  function injectPhaseMap() {
    const root = document.getElementById('decisionEngineRoot');
    if (!root || document.getElementById('dePhaseMap')) return Boolean(root);
    const hero = root.querySelector('.de-hero');
    if (!hero) return false;

    const map = document.createElement('section');
    map.id = 'dePhaseMap';
    map.className = 'ded-phase-map';
    map.innerHTML = `
      <div class="ded-phase-head">
        <div><p class="rubric">MAPA DEL MOTOR</p><h3>Fases 1–5 visibles desde aquí</h3><p>Pulse una fase. Las fases 3–5 se cargan con datos reales al preparar una decisión.</p></div>
        <span class="ded-live-badge">PRODUCCIÓN</span>
      </div>
      <div class="ded-phase-grid">
        ${phaseButton('01', 'Preparación', 'Universo, cobertura y Preparation Score', 'deOutput', 'ACTIVA')}
        ${phaseButton('02', 'Valoración y compra', 'Fair Value, MOS y Terreno de Compra', 'deOutput', 'ACTIVA')}
        ${phaseButton('03', 'Evidence Overlay', 'CIAR + Daily Briefing + macro AGCI', 'deEvidenceLayer', 'ACTIVA')}
        ${phaseButton('04', 'Learning Loop', 'Resultados observados a 1d / 5d / 20d', 'deEvolutionLayer', 'RECOPILANDO')}
        ${phaseButton('05', 'Variable Governance', 'Experimental → Validated → Promoted', 'deEvolutionLayer', 'ACTIVA')}
      </div>
      <div class="ded-howto"><strong>Cómo verlo:</strong><span>1) elija o deje los 10 tickers · 2) pulse “Preparar decisión” · 3) seleccione una acción del radar · 4) Fase 3, 4 y 5 aparecerán dentro de su ficha.</span></div>`;
    hero.insertAdjacentElement('afterend', map);
    map.addEventListener('click', event => {
      const button = event.target.closest('[data-ded-target]');
      if (button) goToPhase(button.dataset.dedTarget);
    });
    return true;
  }

  function emphasizeMotorTab() {
    const tab = document.querySelector('.main-nav [data-view="decisionEngine"]');
    if (!tab) return;
    tab.classList.add('ded-motor-tab');
    tab.setAttribute('aria-label', 'Abrir Motor de Decisión AGCI · Fases 1 a 5');
  }

  function init() {
    ensureStyle();
    emphasizeMotorTab();
    if (injectPhaseMap()) return;
    const observer = new MutationObserver(() => {
      emphasizeMotorTab();
      if (injectPhaseMap()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 20000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
