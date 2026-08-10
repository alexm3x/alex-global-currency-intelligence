(() => {
  const VERSION = '20260810-subtabs1';
  const TAB_HASH = Object.freeze({
    summary: '#decisionEngine',
    phase3: '#decisionEngine-phase3',
    phase4: '#decisionEngine-phase4',
    phase5: '#decisionEngine-phase5'
  });

  function ensureStyle() {
    if (document.querySelector('link[data-de-discoverability-style]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `decision-discoverability.css?v=${VERSION}`;
    link.dataset.deDiscoverabilityStyle = 'true';
    document.head.appendChild(link);
  }

  function waitForTarget(id, timeout = 15000) {
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

  function requestedTab() {
    if (location.hash === TAB_HASH.phase3) return 'phase3';
    if (location.hash === TAB_HASH.phase4) return 'phase4';
    if (location.hash === TAB_HASH.phase5) return 'phase5';
    return 'summary';
  }

  function phaseButton(tab, phase, title, subtitle, status) {
    return `<button type="button" class="ded-phase-tab" role="tab" data-ded-tab="${tab}" aria-selected="${tab === 'summary' ? 'true' : 'false'}">
      <span class="ded-phase-number">${phase}</span>
      <span class="ded-phase-copy"><strong>${title}</strong><small>${subtitle}</small></span>
      <span class="ded-phase-status">${status}</span>
    </button>`;
  }

  function setNotice(tab, state = 'ready') {
    const notice = document.getElementById('dePhaseTabNotice');
    if (!notice) return;
    if (tab === 'summary') {
      notice.hidden = true;
      notice.textContent = '';
      return;
    }
    notice.hidden = false;
    if (state === 'loading') {
      notice.innerHTML = `<strong>Cargando ${tab === 'phase3' ? 'Contexto' : tab === 'phase4' ? 'Learning Loop' : 'Variable Governance'}…</strong><span>Si todavía no existe una decisión preparada, AGCI la generará primero con los tickers guardados.</span>`;
      return;
    }
    notice.innerHTML = `<strong>${tab === 'phase3' ? 'Fase 3 · Contexto' : tab === 'phase4' ? 'Fase 4 · Aprendizaje' : 'Fase 5 · Variables'}</strong><span>Use el Radar para cambiar de ticker sin abandonar esta fase.</span>`;
  }

  function updateHash(tab) {
    const next = TAB_HASH[tab] || TAB_HASH.summary;
    if (location.hash === next) return;
    history.replaceState(null, '', `${location.pathname}${location.search}${next}`);
  }

  function markActiveTab(tab) {
    document.querySelectorAll('#dePhaseTabs [data-ded-tab]').forEach(button => {
      const active = button.dataset.dedTab === tab;
      button.classList.toggle('active', active);
      button.setAttribute('aria-selected', active ? 'true' : 'false');
      button.tabIndex = active ? 0 : -1;
    });
  }

  async function ensureAdvancedLayer(tab) {
    if (tab === 'summary') return true;
    const id = tab === 'phase3' ? 'deEvidenceLayer' : 'deEvolutionLayer';
    if (document.getElementById(id)) return true;
    setNotice(tab, 'loading');
    const analyze = document.getElementById('deAnalyze');
    if (analyze && !analyze.disabled) analyze.click();
    const target = await waitForTarget(id);
    return Boolean(target);
  }

  async function switchTab(tab, { updateLocation = true, focus = false } = {}) {
    const root = document.getElementById('decisionEngineRoot');
    if (!root) return;
    const valid = ['summary', 'phase3', 'phase4', 'phase5'].includes(tab) ? tab : 'summary';
    root.dataset.phaseTab = valid;
    markActiveTab(valid);
    if (updateLocation) updateHash(valid);
    setNotice(valid, valid === 'summary' ? 'ready' : 'loading');
    await ensureAdvancedLayer(valid);
    setNotice(valid, 'ready');
    if (focus) {
      const panel = document.getElementById('deDecisionDetail') || document.getElementById('deOutput');
      panel?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  function injectPhaseTabs() {
    const root = document.getElementById('decisionEngineRoot');
    if (!root || document.getElementById('dePhaseMap')) return Boolean(root);
    const hero = root.querySelector('.de-hero');
    if (!hero) return false;

    const map = document.createElement('section');
    map.id = 'dePhaseMap';
    map.className = 'ded-phase-map';
    map.innerHTML = `
      <div class="ded-phase-head">
        <div><p class="rubric">MAPA DEL MOTOR · NAVEGACIÓN PERMANENTE</p><h3>Una decisión, cuatro vistas</h3><p>El Radar permanece visible. Cambie entre valoración, contexto, aprendizaje y gobernanza sin recorrer una ficha larga.</p></div>
        <span class="ded-live-badge">PRODUCCIÓN</span>
      </div>
      <div id="dePhaseTabs" class="ded-phase-tabs" role="tablist" aria-label="Fases del Motor de Decisión">
        ${phaseButton('summary', '01–02', 'Resumen', 'Preparación · Fair Value · Terreno de Compra', 'ACTIVA')}
        ${phaseButton('phase3', '03', 'Contexto', 'CIAR · Daily Briefing · Macro AGCI', 'ACTIVA')}
        ${phaseButton('phase4', '04', 'Aprendizaje', 'Resultados observados 1d · 5d · 20d', 'RECOPILANDO')}
        ${phaseButton('phase5', '05', 'Variables', 'Experimental → Validated → Promoted', 'ACTIVA')}
      </div>
      <div id="dePhaseTabNotice" class="ded-tab-notice" hidden></div>`;
    hero.insertAdjacentElement('afterend', map);

    map.addEventListener('click', event => {
      const button = event.target.closest('[data-ded-tab]');
      if (button) switchTab(button.dataset.dedTab, { updateLocation: true, focus: true });
    });
    map.addEventListener('keydown', event => {
      if (!['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
      const buttons = [...map.querySelectorAll('[data-ded-tab]')];
      const current = buttons.indexOf(document.activeElement);
      if (current < 0) return;
      event.preventDefault();
      const delta = event.key === 'ArrowRight' ? 1 : -1;
      const next = buttons[(current + delta + buttons.length) % buttons.length];
      next.focus();
      switchTab(next.dataset.dedTab, { updateLocation: true, focus: false });
    });

    switchTab(requestedTab(), { updateLocation: false, focus: false });
    return true;
  }

  function emphasizeMotorTab() {
    const tab = document.querySelector('.main-nav [data-view="decisionEngine"]');
    if (!tab) return;
    tab.classList.add('ded-motor-tab');
    tab.setAttribute('aria-label', 'Abrir Motor de Decisión AGCI · Fases 1 a 5');
  }

  function openDeepLink() {
    const tab = requestedTab();
    if (tab === 'summary' && location.hash !== '#decisionEngine') return;
    if (typeof window.setView === 'function') window.setView('decisionEngine');
    setTimeout(() => switchTab(tab, { updateLocation: false, focus: false }), 0);
  }

  function init() {
    ensureStyle();
    emphasizeMotorTab();
    openDeepLink();
    if (injectPhaseTabs()) return;
    const observer = new MutationObserver(() => {
      emphasizeMotorTab();
      if (injectPhaseTabs()) observer.disconnect();
    });
    observer.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => observer.disconnect(), 20000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
