(() => {
  'use strict';
  if (window.__VIAJES_ASC_GLOBAL_EXPERIENCE__) return;
  window.__VIAJES_ASC_GLOBAL_EXPERIENCE__ = true;

  const STORAGE_THEME = 'viajesASCAppearance';
  const STORAGE_INTENT = 'viajesASCNaturalLanguageIntent';
  const $ = selector => document.querySelector(selector);
  const $$ = selector => [...document.querySelectorAll(selector)];

  function addStyles() {
    if ($('#asc-global-experience-styles')) return;
    const style = document.createElement('style');
    style.id = 'asc-global-experience-styles';
    style.textContent = `
      :root {
        --asc-bg:#050b10; --asc-surface:#071119; --asc-surface-2:#0a1720; --asc-line:#1e293b;
        --asc-text:#f8fafc; --asc-muted:#94a3b8; --asc-soft:#64748b; --asc-gold:#e8c66a;
        --asc-cyan:#67e8f9; --asc-green:#34d399; --asc-danger:#fb7185; --asc-radius:18px;
        --asc-shadow:0 24px 80px rgba(0,0,0,.32); color-scheme:dark;
      }
      html[data-asc-theme="light"] {
        --asc-bg:#f4f2ec; --asc-surface:#fffdf8; --asc-surface-2:#f1eee6; --asc-line:#d7d2c7;
        --asc-text:#14212a; --asc-muted:#52616d; --asc-soft:#6c7983; --asc-shadow:0 20px 60px rgba(31,41,55,.12);
        color-scheme:light;
      }
      html[data-asc-theme="light"] body { background:#f4f2ec!important; color:#14212a!important; }
      html[data-asc-theme="light"] .bg-terminal-950, html[data-asc-theme="light"] .bg-terminal-900 { background-color:#fffdf8!important; }
      html[data-asc-theme="light"] .bg-terminal-850 { background-color:#f1eee6!important; }
      html[data-asc-theme="light"] .text-white, html[data-asc-theme="light"] .text-slate-100, html[data-asc-theme="light"] .text-slate-200 { color:#14212a!important; }
      html[data-asc-theme="light"] .text-slate-300, html[data-asc-theme="light"] .text-slate-400 { color:#52616d!important; }
      html[data-asc-theme="light"] .text-slate-500, html[data-asc-theme="light"] .text-slate-600 { color:#6c7983!important; }
      html[data-asc-theme="light"] .border-slate-700, html[data-asc-theme="light"] .border-slate-800 { border-color:#d7d2c7!important; }
      html[data-asc-theme="light"] header.sticky { background:rgba(255,253,248,.92)!important; border-color:#d7d2c7!important; }
      html[data-asc-theme="light"] .assistant-entry, html[data-asc-theme="light"] .assistant-dialog,
      html[data-asc-theme="light"] .assistant-summary__grid div, html[data-asc-theme="light"] .assistant-field input,
      html[data-asc-theme="light"] .assistant-field select, html[data-asc-theme="light"] .assistant-field textarea {
        background:#fffdf8!important; color:#14212a!important; border-color:#d7d2c7!important;
      }
      html[data-asc-theme="light"] .assistant-entry h1, html[data-asc-theme="light"] .assistant-step h3,
      html[data-asc-theme="light"] .assistant-dialog__header h2, html[data-asc-theme="light"] .assistant-summary__hero strong { color:#14212a!important; }
      html[data-asc-theme="light"] .travel-motion { opacity:.12; }

      .asc-skip-link { position:fixed; left:12px; top:-60px; z-index:999; padding:10px 14px; border-radius:8px; background:var(--asc-gold); color:#071119; font-weight:800; transition:top .15s ease; }
      .asc-skip-link:focus { top:12px; }
      .asc-primary-nav { position:relative; z-index:12; display:flex; align-items:center; justify-content:space-between; gap:14px; margin:0 0 18px; padding:10px 12px; border:1px solid rgba(148,163,184,.18); border-radius:14px; background:rgba(5,11,16,.68); backdrop-filter:blur(18px); box-shadow:0 14px 50px rgba(0,0,0,.16); }
      html[data-asc-theme="light"] .asc-primary-nav { background:rgba(255,253,248,.82); border-color:#d7d2c7; }
      .asc-primary-nav__links { display:flex; flex-wrap:wrap; gap:4px; }
      .asc-primary-nav button { min-height:40px; padding:8px 11px; border:1px solid transparent; border-radius:9px; color:var(--asc-muted); font-size:11px; font-weight:750; letter-spacing:.01em; }
      .asc-primary-nav button:hover, .asc-primary-nav button:focus-visible { border-color:rgba(103,232,249,.38); color:var(--asc-text); background:rgba(103,232,249,.06); outline:none; }
      .asc-primary-nav__brand { display:flex; align-items:center; gap:9px; white-space:nowrap; color:var(--asc-text); font-size:10px; font-weight:800; letter-spacing:.14em; text-transform:uppercase; }
      .asc-primary-nav__brand i { width:7px; height:7px; border-radius:50%; background:var(--asc-green); box-shadow:0 0 12px rgba(52,211,153,.7); }
      .asc-theme-toggle { min-width:92px; border-color:rgba(232,198,106,.25)!important; color:var(--asc-gold)!important; }

      #travelAssistant.asc-home-command { grid-template-columns:minmax(0,1.55fr) minmax(260px,.45fr); padding:clamp(24px,4vw,52px); border-radius:24px; box-shadow:var(--asc-shadow); }
      #travelAssistant.asc-home-command h1 { max-width:880px; font-size:clamp(32px,4.7vw,66px); line-height:1.01; letter-spacing:-.055em; }
      #travelAssistant.asc-home-command .assistant-entry__copy>p { max-width:790px; font-size:14px; }
      .asc-command-box { margin-top:22px; padding:10px; border:1px solid rgba(103,232,249,.22); border-radius:16px; background:rgba(3,10,15,.62); box-shadow:inset 0 1px rgba(255,255,255,.04); }
      html[data-asc-theme="light"] .asc-command-box { background:#f7f4ed; border-color:#cfc8bb; }
      .asc-command-box label { display:block; padding:2px 4px 7px; color:var(--asc-soft); font:700 9px/1.2 IBM Plex Mono,ui-monospace,monospace; letter-spacing:.12em; text-transform:uppercase; }
      .asc-command-row { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:8px; align-items:stretch; }
      .asc-command-row textarea { width:100%; min-height:64px; max-height:150px; resize:vertical; border:0; border-radius:11px; background:rgba(10,23,32,.82); padding:14px 15px; color:var(--asc-text); font-size:14px; line-height:1.5; outline:none; }
      html[data-asc-theme="light"] .asc-command-row textarea { background:#fffdf8; }
      .asc-command-row textarea:focus-visible { box-shadow:0 0 0 2px var(--asc-cyan); }
      .asc-command-submit { min-width:132px; border-radius:11px; padding:0 17px; background:var(--asc-gold); color:#071119; font-size:11px; font-weight:900; }
      .asc-command-submit:hover { filter:brightness(1.06); transform:translateY(-1px); }
      .asc-example-line { margin-top:7px; padding:0 4px; color:var(--asc-soft); font-size:10px; line-height:1.55; }
      .asc-quick-actions { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:8px; margin-top:12px; }
      .asc-quick-action { min-height:52px; padding:10px 11px; border:1px solid rgba(148,163,184,.18); border-radius:11px; background:rgba(5,11,16,.42); color:var(--asc-muted); text-align:left; font-size:10px; font-weight:750; line-height:1.25; }
      html[data-asc-theme="light"] .asc-quick-action { background:rgba(255,255,255,.48); border-color:#d7d2c7; }
      .asc-quick-action:hover, .asc-quick-action:focus-visible { border-color:rgba(232,198,106,.55); color:var(--asc-text); outline:none; }
      .asc-quick-action strong { display:block; margin-bottom:4px; color:var(--asc-text); font-size:11px; }
      .asc-command-status { min-height:18px; margin-top:8px; padding:0 4px; color:var(--asc-green); font-size:10px; }

      .workspace-tabs { position:sticky; top:72px; z-index:25; backdrop-filter:blur(18px); }
      .workspace-tabs button { min-height:42px; }
      :where(button,a,input,select,textarea):focus-visible { outline:2px solid var(--asc-cyan); outline-offset:2px; }

      .asc-mobile-nav { display:none; }
      @media (max-width:980px) {
        .asc-primary-nav { overflow-x:auto; justify-content:flex-start; scrollbar-width:none; }
        .asc-primary-nav::-webkit-scrollbar { display:none; }
        .asc-primary-nav__brand { display:none; }
        .asc-quick-actions { grid-template-columns:repeat(2,minmax(0,1fr)); }
        #travelAssistant.asc-home-command { grid-template-columns:1fr; }
      }
      @media (max-width:760px) {
        body { padding-bottom:calc(74px + env(safe-area-inset-bottom)); }
        .asc-primary-nav { display:none; }
        #travelAssistant.asc-home-command { padding:24px 17px; border-radius:18px; }
        #travelAssistant.asc-home-command h1 { font-size:clamp(32px,12vw,49px); }
        .asc-command-row { grid-template-columns:1fr; }
        .asc-command-submit { min-height:48px; }
        .asc-quick-actions { grid-template-columns:1fr 1fr; }
        .workspace-tabs { top:64px; overflow-x:auto; }
        .asc-mobile-nav { position:fixed; left:10px; right:10px; bottom:calc(9px + env(safe-area-inset-bottom)); z-index:80; display:grid; grid-template-columns:repeat(5,1fr); gap:3px; padding:6px; border:1px solid rgba(148,163,184,.22); border-radius:16px; background:rgba(5,11,16,.92); backdrop-filter:blur(22px); box-shadow:0 18px 55px rgba(0,0,0,.42); }
        html[data-asc-theme="light"] .asc-mobile-nav { background:rgba(255,253,248,.94); border-color:#d7d2c7; }
        .asc-mobile-nav button { min-height:48px; border-radius:10px; color:var(--asc-muted); font-size:9px; font-weight:800; }
        .asc-mobile-nav button:hover, .asc-mobile-nav button:focus-visible { background:rgba(232,198,106,.08); color:var(--asc-gold); outline:none; }
      }
      @media (prefers-reduced-motion: reduce) {
        *,*::before,*::after { scroll-behavior:auto!important; animation-duration:.01ms!important; animation-iteration-count:1!important; transition-duration:.01ms!important; }
      }
    `;
    document.head.appendChild(style);
  }

  function currentTheme() {
    return localStorage.getItem(STORAGE_THEME) || 'system';
  }

  function applyTheme(mode) {
    const resolved = mode === 'system'
      ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark')
      : mode;
    document.documentElement.dataset.ascTheme = resolved;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
    localStorage.setItem(STORAGE_THEME, mode);
    const button = $('#ascThemeToggle');
    if (button) button.textContent = `Apariencia · ${mode === 'system' ? 'Auto' : mode === 'light' ? 'Claro' : 'Oscuro'}`;
  }

  function cycleTheme() {
    const modes = ['system','dark','light'];
    const current = currentTheme();
    applyTheme(modes[(modes.indexOf(current) + 1) % modes.length]);
  }

  function scrollToTarget(selector) {
    const target = $(selector);
    if (!target) return false;
    target.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block:'start' });
    return true;
  }

  function clickWorkspace(name) {
    const button = $(`[data-workspace-tab="${name}"]`);
    if (!button) return false;
    button.click();
    setTimeout(() => button.scrollIntoView({ behavior:'smooth', block:'nearest' }), 60);
    return true;
  }

  function openAssistant(mode) {
    const start = $('#startTravelAssistant');
    if (!start) return;
    start.click();
    setTimeout(() => {
      const radio = $(`input[name="planningMode"][value="${mode}"]`);
      if (radio) { radio.checked = true; radio.dispatchEvent(new Event('change', { bubbles:true })); }
    }, 80);
  }

  function routeAction(action) {
    switch (action) {
      case 'home': window.scrollTo({ top:0, behavior:'smooth' }); break;
      case 'discover': scrollToTarget('#recommendations') || scrollToTarget('#queryForm'); break;
      case 'plan': openAssistant('known_dates'); break;
      case 'best-dates': openAssistant('inverse_dates'); break;
      case 'stays': clickWorkspace('stays'); break;
      case 'opportunities': clickWorkspace('imports'); break;
      case 'compare': scrollToTarget('#matrixBody') || scrollToTarget('#multiDestinationPlanner') || scrollToTarget('#queryForm'); break;
      case 'saved': scrollToTarget('#assistantActiveSummary') || scrollToTarget('#travelAssistant'); break;
      case 'intelligence': clickWorkspace('intelligence'); scrollToTarget('#queryForm') || scrollToTarget('#travelAssistant'); break;
      default: scrollToTarget('#travelAssistant');
    }
    window.dispatchEvent(new CustomEvent('viajes:global-navigation', { detail:{ action } }));
  }

  function buildPrimaryNav() {
    if ($('#ascPrimaryNav')) return;
    const main = $('main');
    const tabs = $('.workspace-tabs');
    if (!main || !tabs) return;
    const nav = document.createElement('nav');
    nav.id = 'ascPrimaryNav';
    nav.className = 'asc-primary-nav';
    nav.setAttribute('aria-label','Navegación principal de Viajes ASC');
    nav.innerHTML = `
      <div class="asc-primary-nav__brand"><i></i><span>Global Personal Travel Intelligence</span></div>
      <div class="asc-primary-nav__links">
        <button type="button" data-asc-action="home">Inicio</button>
        <button type="button" data-asc-action="discover">Descubrir</button>
        <button type="button" data-asc-action="plan">Planear</button>
        <button type="button" data-asc-action="stays">Reservar</button>
        <button type="button" data-asc-action="saved">Mis viajes</button>
        <button type="button" data-asc-action="intelligence">Intelligence</button>
      </div>
      <button id="ascThemeToggle" type="button" class="asc-theme-toggle" aria-label="Cambiar apariencia">Apariencia · Auto</button>`;
    main.insertBefore(nav, tabs);
    nav.addEventListener('click', event => {
      const action = event.target.closest('[data-asc-action]')?.dataset.ascAction;
      if (action) routeAction(action);
    });
    $('#ascThemeToggle')?.addEventListener('click', cycleTheme);
  }

  function buildMobileNav() {
    if ($('#ascMobileNav')) return;
    const nav = document.createElement('nav');
    nav.id = 'ascMobileNav';
    nav.className = 'asc-mobile-nav';
    nav.setAttribute('aria-label','Navegación móvil de Viajes ASC');
    nav.innerHTML = `
      <button type="button" data-asc-action="home">Inicio</button>
      <button type="button" data-asc-action="discover">Explorar</button>
      <button type="button" data-asc-action="plan">Viajes</button>
      <button type="button" data-asc-action="best-dates">Copilot</button>
      <button type="button" data-asc-action="saved">Perfil</button>`;
    document.body.appendChild(nav);
    nav.addEventListener('click', event => {
      const action = event.target.closest('[data-asc-action]')?.dataset.ascAction;
      if (action) routeAction(action);
    });
  }

  function buildCommandCenter() {
    const entry = $('#travelAssistant');
    const copy = entry?.querySelector('.assistant-entry__copy');
    const actions = entry?.querySelector('.assistant-entry__actions');
    if (!entry || !copy || !actions) return;
    entry.classList.add('asc-home-command');
    const title = $('#travelAssistantTitle');
    if (title) title.textContent = '¿Qué viaje quiere hacer?';
    const paragraph = copy.querySelector(':scope > p');
    if (paragraph) paragraph.textContent = 'Describa su viaje en lenguaje natural. Viajes ASC combinará fechas, presupuesto, preferencias, costo total, eventos y oportunidad para reducir cientos de opciones a una decisión clara.';
    const kicker = copy.querySelector('.assistant-kicker span:first-child');
    if (kicker) kicker.textContent = 'ASC TRAVEL COPILOT · PERSONAL INTELLIGENCE';
    if ($('#ascTravelCommand')) return;

    const block = document.createElement('div');
    block.className = 'asc-command-box';
    block.id = 'ascTravelCommand';
    block.innerHTML = `
      <label for="ascNaturalLanguageIntent">Describa el viaje que tiene en mente</label>
      <div class="asc-command-row">
        <textarea id="ascNaturalLanguageIntent" maxlength="1200" placeholder="Ejemplo: Tengo 8 días entre octubre y noviembre, salgo de Ciudad de México, presupuesto de USD 5,000, hotel premium, gran gastronomía y un evento importante."></textarea>
        <button id="ascAnalyzeIntent" class="asc-command-submit" type="button">Analizar viaje</button>
      </div>
      <div class="asc-example-line">Puede indicar destino, periodo, presupuesto, integrantes, intereses o simplemente pedir inspiración.</div>
      <div class="asc-quick-actions" aria-label="Acciones rápidas">
        <button type="button" class="asc-quick-action" data-asc-action="plan"><strong>Ya sé cuándo viajar</strong>Analizar mis fechas</button>
        <button type="button" class="asc-quick-action" data-asc-action="best-dates"><strong>Encontrar mejores fechas</strong>Motor inverso</button>
        <button type="button" class="asc-quick-action" data-asc-action="opportunities"><strong>Buscar oportunidades</strong>Ofertas y anomalías</button>
        <button type="button" class="asc-quick-action" data-asc-action="stays"><strong>Buscar estancias</strong>Costo total real</button>
        <button type="button" class="asc-quick-action" data-asc-action="discover"><strong>Inspirarme</strong>Destinos y señales</button>
        <button type="button" class="asc-quick-action" data-asc-action="compare"><strong>Comparar destinos</strong>Matriz de decisión</button>
        <button type="button" class="asc-quick-action" data-asc-action="intelligence"><strong>Travel Intelligence</strong>FX, costo y contexto</button>
        <button type="button" class="asc-quick-action" data-asc-action="plan"><strong>Crear viaje completo</strong>Copilot de principio a fin</button>
      </div>
      <div id="ascCommandStatus" class="asc-command-status" aria-live="polite"></div>`;
    copy.insertBefore(block, actions);

    block.addEventListener('click', event => {
      const action = event.target.closest('[data-asc-action]')?.dataset.ascAction;
      if (action) routeAction(action);
    });

    $('#ascAnalyzeIntent')?.addEventListener('click', () => {
      const text = $('#ascNaturalLanguageIntent')?.value.trim();
      const status = $('#ascCommandStatus');
      if (!text) {
        if (status) status.textContent = 'Describa brevemente el viaje para preparar el Copilot.';
        $('#ascNaturalLanguageIntent')?.focus();
        return;
      }
      sessionStorage.setItem(STORAGE_INTENT, text);
      if (status) status.textContent = 'Intención capturada. Complete únicamente los datos que falten.';
      const inverse = /\b(cu[aá]ndo|mejores? fechas?|fecha conveniente|conviene viajar|flexible)\b/i.test(text);
      openAssistant(inverse ? 'inverse_dates' : 'known_dates');
      window.dispatchEvent(new CustomEvent('viajes:natural-language-intent', { detail:{ text, inferredMode: inverse ? 'inverse_dates' : 'known_dates' } }));
    });
  }

  function bridgeNaturalLanguageIntent() {
    const host = $('#assistantStepContent');
    if (!host || host.dataset.ascIntentBridge === '1') return;
    host.dataset.ascIntentBridge = '1';
    const observer = new MutationObserver(() => {
      const text = sessionStorage.getItem(STORAGE_INTENT);
      if (!text) return;
      const comments = host.querySelector('textarea[name="comments"]');
      if (comments && !comments.value.trim()) {
        comments.value = `Solicitud en lenguaje natural: ${text}`;
        comments.dispatchEvent(new Event('input', { bubbles:true }));
      }
    });
    observer.observe(host, { childList:true, subtree:true });
  }

  function addSkipLink() {
    if ($('.asc-skip-link')) return;
    const link = document.createElement('a');
    link.className = 'asc-skip-link';
    link.href = '#travelAssistant';
    link.textContent = 'Ir al planificador de viaje';
    document.body.prepend(link);
  }

  function init() {
    addStyles();
    addSkipLink();
    buildPrimaryNav();
    buildMobileNav();
    buildCommandCenter();
    bridgeNaturalLanguageIntent();
    applyTheme(currentTheme());
  }

  init();
  window.addEventListener('load', () => { init(); setTimeout(buildCommandCenter, 250); }, { once:true });
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => { if (currentTheme() === 'system') applyTheme('system'); });
})();
