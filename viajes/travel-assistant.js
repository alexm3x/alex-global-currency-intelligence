(() => {
  'use strict';

  if (window.__VIAJES_ASC_TRAVEL_ASSISTANT__) return;
  window.__VIAJES_ASC_TRAVEL_ASSISTANT__ = true;

  const core = window.TravelAssistantCore;
  const dialog = document.getElementById('travelAssistantDialog');
  const form = document.getElementById('travelAssistantForm');
  const content = document.getElementById('assistantStepContent');
  const errorBox = document.getElementById('assistantFormError');
  const nextButton = document.getElementById('assistantNext');
  const backButton = document.getElementById('assistantBack');
  const saveButton = document.getElementById('assistantSave');
  const progressBar = document.getElementById('assistantProgressBar');
  const stepLabel = document.getElementById('assistantStepLabel');
  const privacyLabel = document.getElementById('assistantPrivacyLabel');
  const savedKey = 'viajesASCTripProfileV4';
  const draftKey = 'viajesASCTripDraftSession';
  const totalSteps = 7;
  const sessionId = (() => {
    const existing = sessionStorage.getItem('viajesASCAssistantSession');
    if (existing) return existing;
    const created = globalThis.crypto?.randomUUID?.() || `session-${Date.now()}`;
    sessionStorage.setItem('viajesASCAssistantSession', created);
    return created;
  })();
  let step = 0;
  let profile = null;
  let conclusion = null;
  let raw = defaultRaw();

  if (!core || !dialog || !form || !content) return;

  function dateISO(daysAhead) {
    const date = new Date();
    date.setHours(12, 0, 0, 0);
    date.setDate(date.getDate() + daysAhead);
    return date.toISOString().slice(0, 10);
  }

  function defaultRaw() {
    return {
      origin: 'MEX', destinationMode: 'open', destination: '',
      start: dateISO(90), end: dateISO(97), flexDays: 3, nightsMin: 7, nightsMax: 10,
      climate: 'indifferent', maxTotalHours: '', budgetAmount: '', currency: 'MXN',
      budgetBasis: 'total', budgetIncludes: ['flights', 'lodging', 'destination'],
      contingencyPct: 10, strictness: 'moderate', adults: 2, childCount: 0,
      childAges: [], rooms: 1, groupType: 'couple', roomPreferences: [], accessibility: '',
      priorities: ['precio-calidad', 'gastronomía', 'cultura e historia'], cabin: 'economy',
      directPreference: 'preferred', maxStops: 1, lodgingTypes: ['hotel'], categoryMin: 4,
      locationPreferences: ['central'], pace: 'balanced', concerns: ['hidden_costs', 'fx'],
      hardConstraints: [], comments: '', saveProfile: false
    };
  }

  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));

  const money = (amount, currency = 'MXN') => new Intl.NumberFormat('es-MX', {
    style: 'currency', currency, maximumFractionDigits: 0
  }).format(Number(amount) || 0);

  const options = (items, selected) => items.map(([value, label]) => (
    `<option value="${esc(value)}" ${String(selected) === String(value) ? 'selected' : ''}>${esc(label)}</option>`
  )).join('');

  function chips(name, items, selected = [], type = 'checkbox') {
    const values = Array.isArray(selected) ? selected : [selected];
    return `<div class="assistant-chip-grid">${items.map(([value, label]) => `
      <label class="assistant-chip"><input type="${type}" name="${name}" value="${esc(value)}" ${values.includes(value) ? 'checked' : ''}><span>${esc(label)}</span></label>
    `).join('')}</div>`;
  }

  function stepOne() {
    return `<h3>Origen, destino y fechas</h3><p>Defina el marco del viaje. Si el destino está abierto, el motor buscará valor integral dentro de su presupuesto.</p>
      <div class="assistant-grid">
        <label class="assistant-field"><span>Ciudad o aeropuerto de salida</span><input name="origin" value="${esc(raw.origin)}" placeholder="MEX, NLU, GDL…" autocomplete="off" required></label>
        <label class="assistant-field"><span>Alcance del destino</span><select name="destinationMode">${options([['fixed','Destino específico'],['region','País o región'],['open','Destino abierto · recomiéndame']],raw.destinationMode)}</select></label>
        <label class="assistant-field assistant-field--full ${raw.destinationMode === 'open' ? 'assistant-open-destination' : ''}"><span>Zona, país, región o destino considerado</span><input name="destination" value="${esc(raw.destination)}" placeholder="Ej. Japón, Mediterráneo o dejar abierto" ${raw.destinationMode === 'open' ? '' : 'required'}><small>Con destino abierto, puede dejar este campo vacío.</small></label>
        <label class="assistant-field"><span>Salida</span><input type="date" name="start" value="${esc(raw.start)}"></label>
        <label class="assistant-field"><span>Regreso</span><input type="date" name="end" value="${esc(raw.end)}"></label>
        <label class="assistant-field"><span>Flexibilidad</span><select name="flexDays">${options([[0,'Fechas fijas'],[3,'±3 días'],[7,'±7 días'],[31,'Mes completo']],raw.flexDays)}</select></label>
        <label class="assistant-field"><span>Duración aceptable</span><div class="assistant-grid assistant-grid--3" style="margin-top:0"><input type="number" name="nightsMin" min="1" max="60" value="${esc(raw.nightsMin)}" aria-label="Noches mínimas"><input type="number" name="nightsMax" min="1" max="90" value="${esc(raw.nightsMax)}" aria-label="Noches máximas"></div></label>
        <label class="assistant-field"><span>Clima preferido</span><select name="climate">${options([['indifferent','Indiferente'],['warm','Cálido'],['mild','Templado'],['cold','Frío / nieve']],raw.climate)}</select></label>
        <label class="assistant-field"><span>Tiempo máximo de traslado</span><input type="number" name="maxTotalHours" min="1" max="72" value="${esc(raw.maxTotalHours)}" placeholder="No lo sé / recomiéndame"><small>Horas totales; puede dejarlo vacío.</small></label>
      </div>`;
  }

  function stepTwo() {
    return `<h3>Presupuesto real</h3><p>El presupuesto se aplicará antes del ranking. Las opciones principales no lo excederán silenciosamente.</p>
      <div class="assistant-grid">
        <label class="assistant-field"><span>Presupuesto máximo</span><input type="number" inputmode="decimal" name="budgetAmount" min="1" step="100" value="${esc(raw.budgetAmount)}" placeholder="Ej. 120000" required></label>
        <label class="assistant-field"><span>Moneda</span><select name="currency">${options([['MXN','MXN · Peso mexicano'],['USD','USD · Dólar'],['EUR','EUR · Euro'],['JPY','JPY · Yen']],raw.currency)}</select></label>
        <label class="assistant-field"><span>El importe es</span><select name="budgetBasis">${options([['total','Total del viaje'],['person','Por persona'],['night','Por noche']],raw.budgetBasis)}</select></label>
        <label class="assistant-field"><span>Contingencia aceptable</span><select name="contingencyPct">${options([[5,'5%'],[10,'10%'],[15,'15%'],[20,'20%']],raw.contingencyPct)}</select></label>
        <fieldset class="assistant-fieldset"><legend>Qué incluye</legend>${chips('budgetIncludes',[['flights','Vuelos'],['lodging','Alojamiento'],['destination','Gastos en destino'],['experiences','Experiencias'],['insurance','Seguro']],raw.budgetIncludes)}</fieldset>
        <fieldset class="assistant-fieldset"><legend>Flexibilidad del presupuesto</legend>${chips('strictness',[['strict','Estricto'],['moderate','Moderado'],['opportunity','Ampliable por oportunidad extraordinaria']],raw.strictness,'radio')}</fieldset>
      </div>`;
  }

  function stepThree() {
    return `<h3>Integrantes y configuración</h3><p>Solo pedimos datos que afectan tarifas, habitaciones y logística. No se requieren nombres ni documentos.</p>
      <div class="assistant-grid assistant-grid--3">
        <label class="assistant-field"><span>Adultos</span><input type="number" inputmode="numeric" name="adults" min="1" max="12" value="${esc(raw.adults)}" required></label>
        <label class="assistant-field"><span>Menores</span><input type="number" inputmode="numeric" name="childCount" min="0" max="8" value="${esc(raw.childCount)}"></label>
        <label class="assistant-field"><span>Habitaciones</span><input type="number" inputmode="numeric" name="rooms" min="1" max="8" value="${esc(raw.rooms)}" required></label>
        <label class="assistant-field"><span>Edades de menores</span><input name="childAges" value="${esc((raw.childAges || []).join(', '))}" placeholder="Ej. 6, 11"><small>Solo cuando corresponda.</small></label>
        <label class="assistant-field"><span>Tipo de grupo</span><select name="groupType">${options([['solo','Solo'],['couple','Pareja'],['family','Familia'],['friends','Amigos'],['business','Negocio'],['mixed','Grupo mixto']],raw.groupType)}</select></label>
        <label class="assistant-field"><span>Camas y privacidad</span><input name="roomPreferences" value="${esc((raw.roomPreferences || []).join(', '))}" placeholder="King, camas separadas…"></label>
        <label class="assistant-field assistant-field--full"><span>Movilidad, accesibilidad o alimentación relevante</span><textarea name="accessibility" placeholder="Opcional. No incluya diagnósticos ni datos médicos innecesarios.">${esc(raw.accessibility)}</textarea></label>
      </div>`;
  }

  function stepFour() {
    const priorities = [
      ['precio-calidad','Precio-calidad'],['lujo accesible','Lujo accesible'],['gastronomía','Gastronomía'],['cultura e historia','Cultura e historia'],
      ['playa y descanso','Playa'],['buceo','Buceo'],['golf','Golf'],['esquí','Esquí'],['naturaleza y aventura','Naturaleza'],
      ['compras','Compras'],['vida nocturna','Vida nocturna'],['negocios y conectividad','Negocios'],['viaje familiar','Familiar'],['bienestar y spa','Bienestar'],['crucero','Crucero']
    ];
    return `<h3>Estilo y prioridades</h3><p>Seleccione hasta cinco prioridades. Las primeras tres se destacarán en la conclusión ejecutiva.</p>
      <div class="assistant-grid">
        <fieldset class="assistant-fieldset"><legend>Prioridades</legend>${chips('priorities',priorities,raw.priorities)}</fieldset>
        <label class="assistant-field"><span>Cabina</span><select name="cabin">${options([['economy','Económica'],['premium','Premium economy'],['business','Business'],['first','Primera']],raw.cabin)}</select></label>
        <label class="assistant-field"><span>Vuelo directo</span><select name="directPreference">${options([['required','Obligatorio'],['preferred','Preferido'],['indifferent','Indiferente']],raw.directPreference)}</select></label>
        <label class="assistant-field"><span>Máximo de escalas</span><input type="number" name="maxStops" min="0" max="4" value="${esc(raw.maxStops)}"></label>
        <label class="assistant-field"><span>Categoría mínima</span><select name="categoryMin">${options([['','Recomiéndame'],[3,'3 estrellas'],[4,'4 estrellas'],[5,'5 estrellas']],raw.categoryMin)}</select></label>
        <fieldset class="assistant-fieldset"><legend>Alojamiento</legend>${chips('lodgingTypes',[['hotel','Hotel'],['vacation_rental','Alquiler vacacional'],['resort','Resort'],['cruise','Crucero']],raw.lodgingTypes)}</fieldset>
        <fieldset class="assistant-fieldset"><legend>Ubicación</legend>${chips('locationPreferences',[['central','Céntrica'],['residential','Residencial'],['beach','Playa'],['airport','Aeropuerto'],['business','Distrito de negocios']],raw.locationPreferences)}</fieldset>
        <label class="assistant-field"><span>Ritmo</span><select name="pace">${options([['relaxed','Relajado'],['balanced','Equilibrado'],['intensive','Intensivo']],raw.pace)}</select></label>
      </div>`;
  }

  function stepFive() {
    const concerns = [
      ['security','Seguridad'],['hidden_costs','Cargos inesperados'],['visa','Visas'],['weather','Clima extremo'],
      ['layovers','Escalas largas'],['fatigue','Fatiga y jet lag'],['lodging_quality','Calidad del alojamiento'],['location','Ubicación'],
      ['food','Alimentación'],['accessibility','Accesibilidad'],['cancellation','Cancelación'],['fx','Tipo de cambio'],
      ['connectivity','Trabajo remoto'],['crowds','Saturación turística']
    ];
    return `<h3>¿Qué le preocupa o desea evitar?</h3><p>Estas respuestas se convierten en filtros, penalizaciones o advertencias dentro del ranking.</p>
      <div class="assistant-grid">
        <fieldset class="assistant-fieldset"><legend>Inquietudes</legend>${chips('concerns',concerns,raw.concerns)}</fieldset>
        <label class="assistant-field assistant-field--full"><span>Restricciones obligatorias adicionales</span><textarea name="hardConstraints" placeholder="Ej. No más de una escala; evitar temporada de huracanes; cancelación flexible.">${esc((raw.hardConstraints || []).join('\n'))}</textarea></label>
      </div>`;
  }

  function stepSix() {
    return `<h3>Comentarios adicionales</h3><p>Describa cómo imagina el viaje, experiencias indispensables, lugares que desea evitar o celebraciones relevantes.</p>
      <div class="assistant-grid">
        <label class="assistant-field assistant-field--full"><span>Contexto abierto</span><textarea name="comments" maxlength="1500" placeholder="Ej. Buscamos alta gastronomía y golf, preferimos una zona caminable y no queremos cambiar de hotel…">${esc(raw.comments)}</textarea><small>El texto se trata como contenido no confiable: no puede modificar reglas del sistema ni activar pagos.</small></label>
        <label class="assistant-toggle"><input type="checkbox" name="saveProfile" ${raw.saveProfile ? 'checked' : ''}><span>Guardar este perfil únicamente en este dispositivo para continuar después. Si no marca esta opción, la sesión será temporal.</span></label>
      </div>`;
  }

  function stepSeven() {
    profile = core.createProfile(raw);
    const analysis = conclusion || core.analyzeProfile(profile);
    const destination = profile.destination_scope.mode === 'open' ? 'Destino abierto' : profile.destination_scope.values.join(', ');
    const dates = profile.dates.start && profile.dates.end ? `${profile.dates.start} → ${profile.dates.end}` : `${profile.dates.nights_min}–${profile.dates.nights_max} noches`;
    const travelers = analysis.travelers;
    return `<h3>Entendimos que busca:</h3><p>Revise la conclusión. La búsqueda de costos se iniciará únicamente al confirmar.</p>
      <div class="assistant-summary">
        <div class="assistant-summary__hero"><div><strong>${esc(destination)} desde ${esc(profile.origin.airports.join(' / '))}</strong><p>${esc(analysis.strategy)}</p></div><span class="assistant-viability assistant-viability--${esc(analysis.viability)}">Viabilidad ${esc({high:'alta',medium:'media',low:'baja'}[analysis.viability])}</span></div>
        <div class="assistant-summary__grid">
          <div><span>Fechas y flexibilidad</span><strong>${esc(dates)} · ±${profile.dates.flex_days} días</strong></div>
          <div><span>Viajeros y habitaciones</span><strong>${travelers} viajero(s) · ${profile.travelers.rooms} habitación(es)</strong></div>
          <div><span>Presupuesto total normalizado</span><strong>${esc(money(profile.budget.normalized_total, profile.budget.currency))} · contingencia ${profile.budget.contingency_pct}%</strong></div>
          <div><span>Nivel de viaje</span><strong>${esc(profile.transport.cabin)} · ${esc(profile.lodging.types.join(', '))}</strong></div>
          <div><span>Prioridades principales</span><strong>${esc(profile.priorities.slice(0,3).join(' · ') || 'Precio-calidad')}</strong></div>
          <div><span>Principal tensión</span><strong>${esc(analysis.tension)}</strong></div>
          <div><span>Restricciones</span><strong>${esc(profile.hard_constraints.join(' · ') || 'Sin restricciones obligatorias adicionales')}</strong></div>
          <div><span>Inquietudes</span><strong>${esc(profile.concerns.join(' · ') || 'Sin inquietudes seleccionadas')}</strong></div>
        </div>
        <div class="assistant-disclosure">La clasificación utilizará los datos publicados en Viajes ASC. Los precios baseline, estimados o en caché se identificarán como tales y deberán verificarse antes de reservar.</div>
      </div>`;
  }

  const renderers = [stepOne, stepTwo, stepThree, stepFour, stepFive, stepSix, stepSeven];

  function showError(message) {
    errorBox.textContent = message;
    errorBox.hidden = !message;
  }

  function collect() {
    const data = new FormData(form);
    const names = [...new Set([...form.elements].map(element => element.name).filter(Boolean))];
    names.forEach(name => {
      const elements = [...form.elements].filter(element => element.name === name);
      if (!elements.length) return;
      if (elements[0].type === 'checkbox' && elements.length === 1) raw[name] = elements[0].checked;
      else if (elements[0].type === 'checkbox') raw[name] = data.getAll(name);
      else if (elements[0].type === 'radio') raw[name] = data.get(name) ?? raw[name];
      else raw[name] = data.get(name) ?? raw[name];
    });
    ['flexDays','nightsMin','nightsMax','contingencyPct','adults','childCount','rooms','maxStops','categoryMin','maxTotalHours'].forEach(key => {
      if (raw[key] !== '' && raw[key] !== null && raw[key] !== undefined) raw[key] = Number(raw[key]);
    });
    if (typeof raw.childAges === 'string') raw.childAges = raw.childAges.split(',').map(value => Number(value.trim())).filter(Number.isFinite);
    if (typeof raw.roomPreferences === 'string') raw.roomPreferences = raw.roomPreferences.split(',').map(value => value.trim()).filter(Boolean);
    if (typeof raw.hardConstraints === 'string') raw.hardConstraints = raw.hardConstraints.split(/\n|;/).map(value => value.trim()).filter(Boolean);
  }

  function validateStep() {
    collect();
    if (step === 0) {
      if (!String(raw.origin || '').trim()) return 'Indique la ciudad o aeropuerto de salida.';
      if (raw.destinationMode !== 'open' && !String(raw.destination || '').trim()) return 'Indique el destino, país o región; o elija destino abierto.';
      if (raw.start && raw.end && Date.parse(raw.end) <= Date.parse(raw.start)) return 'La fecha de regreso debe ser posterior a la salida.';
      if (Number(raw.nightsMax) < Number(raw.nightsMin)) return 'La duración máxima no puede ser menor que la mínima.';
    }
    if (step === 1 && (!(Number(raw.budgetAmount) > 0))) return 'Indique un presupuesto mayor a cero.';
    if (step === 2) {
      if (!(Number(raw.adults) >= 1)) return 'Debe incluir al menos un adulto.';
      if (!(Number(raw.rooms) >= 1)) return 'Debe incluir al menos una habitación.';
      if (Number(raw.childCount) > 0 && raw.childAges.length && raw.childAges.length !== Number(raw.childCount)) return 'Indique una edad por cada menor o deje las edades vacías.';
    }
    if (step === 3 && raw.priorities.length > 5) return 'Seleccione un máximo de cinco prioridades.';
    return '';
  }

  function render() {
    content.innerHTML = renderers[step]();
    stepLabel.textContent = `Paso ${step + 1} de ${totalSteps}`;
    progressBar.style.width = `${((step + 1) / totalSteps) * 100}%`;
    backButton.disabled = step === 0;
    backButton.textContent = step === totalSteps - 1 ? 'Editar respuestas' : 'Anterior';
    nextButton.textContent = step === totalSteps - 1 ? 'Confirmar y buscar' : 'Siguiente';
    saveButton.hidden = false;
    privacyLabel.textContent = raw.saveProfile ? 'Guardado local autorizado' : 'Modo temporal';
    showError('');
    content.scrollTop = 0;
    const destinationMode = content.querySelector('[name="destinationMode"]');
    destinationMode?.addEventListener('change', () => { collect(); render(); });
    const direct = content.querySelector('[name="directPreference"]');
    direct?.addEventListener('change', () => {
      if (direct.value === 'required') content.querySelector('[name="maxStops"]').value = '0';
    });
  }

  function openAssistant(useSaved = false) {
    if (useSaved) {
      try {
        const saved = JSON.parse(localStorage.getItem(savedKey) || 'null');
        if (saved?.raw) raw = { ...defaultRaw(), ...saved.raw, saveProfile: true };
      } catch { /* Ignore invalid device data. */ }
    } else {
      try {
        const draft = JSON.parse(sessionStorage.getItem(draftKey) || 'null');
        if (draft) raw = { ...defaultRaw(), ...draft };
      } catch { raw = defaultRaw(); }
    }
    step = 0;
    conclusion = null;
    render();
    if (typeof dialog.showModal === 'function') dialog.showModal();
    else dialog.setAttribute('open', '');
    document.body.style.overflow = 'hidden';
    track('assistant_started');
  }

  function closeAssistant() {
    if (dialog.open && typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    document.body.style.overflow = '';
  }

  function saveDraft(force = false) {
    collect();
    sessionStorage.setItem(draftKey, JSON.stringify(raw));
    if (force || raw.saveProfile) {
      const normalized = core.createProfile({ ...raw, saveProfile: true });
      localStorage.setItem(savedKey, JSON.stringify({ raw: { ...raw, saveProfile: true }, profile: normalized }));
      document.getElementById('continueTravelAssistant').disabled = false;
      privacyLabel.textContent = 'Guardado local autorizado';
    }
  }

  async function enrichConclusion() {
    profile = core.createProfile(raw);
    conclusion = core.analyzeProfile(profile);
    const endpoint = document.querySelector('meta[name="viajes-assistant-api"]')?.content || window.VIAJES_ASC_CONFIG?.assistantEndpoint || '';
    if (!endpoint) return;
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 8500);
      const response = await fetch(endpoint, {
        method: 'POST', headers: { 'content-type': 'application/json', 'x-asc-session': sessionId },
        body: JSON.stringify({ action: 'summarize_profile', profile }), signal: controller.signal
      });
      clearTimeout(timer);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const payload = await response.json();
      if (payload?.conclusion?.strategy) conclusion = { ...conclusion, ...payload.conclusion };
    } catch (error) {
      console.warn('ASC assistant deterministic fallback:', error.message);
    }
  }

  function setSelectValue(select, value) {
    if (!select) return;
    if (![...select.options].some(option => option.value === value)) {
      select.add(new Option(value, value));
    }
    select.value = value;
  }

  function applyProfile() {
    profile = core.createProfile(raw);
    const validation = core.validateProfile(profile);
    if (!validation.valid) {
      showError(`Falta completar: ${validation.errors.join(', ')}.`);
      return;
    }
    profile.consent.search_confirmed = true;
    window.__VIAJES_ASC_ACTIVE_TRIP_PROFILE__ = profile;
    const currency = document.getElementById('currencyInput');
    const budget = document.getElementById('budgetInput');
    if (currency) {
      budget.value = '';
      setSelectValue(currency, profile.budget.currency);
      currency.dispatchEvent(new Event('change', { bubbles: true }));
    }
    budget.value = String(Math.round(profile.budget.normalized_total));
    budget.dispatchEvent(new Event('input', { bubbles: true }));
    setSelectValue(document.getElementById('originInput'), profile.origin.airports[0] || 'MEX');
    if (profile.dates.start) document.getElementById('startDate').value = profile.dates.start;
    if (profile.dates.end) document.getElementById('endDate').value = profile.dates.end;
    document.getElementById('adultsInput').value = profile.travelers.adults;
    document.getElementById('minorsInput').value = profile.travelers.children.length;
    document.getElementById('roomsInput').value = profile.travelers.rooms;
    document.getElementById('interestInput').value = profile.priorities.join(', ');
    document.getElementById('sortInput').value = 'score';
    const cabin = ['business','first'].includes(profile.transport.cabin) ? 'business' : 'tourist';
    document.querySelector(`#cabinTabs [data-cabin="${cabin}"]`)?.click();
    const priorities = profile.priorities.join(' ').toLowerCase();
    const type = priorities.includes('crucero') ? 'cruise' : (priorities.includes('playa') || priorities.includes('naturaleza') || priorities.includes('buceo')) ? 'beach' : 'all';
    document.querySelector(`#typeTabs [data-type="${type}"]`)?.click();
    document.getElementById('queryForm').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    if (profile.consent.save_profile || raw.saveProfile) saveDraft(true);
    else localStorage.removeItem(savedKey);
    sessionStorage.removeItem(draftKey);
    renderActiveSummary(profile, conclusion || core.analyzeProfile(profile));
    closeAssistant();
    track('search_confirmed');
    window.setTimeout(() => document.getElementById('recommendations')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 180);
  }

  function renderActiveSummary(active, analysis) {
    const host = document.getElementById('assistantActiveSummary');
    const destination = active.destination_scope.mode === 'open' ? 'destino abierto' : active.destination_scope.values.join(', ');
    host.hidden = false;
    host.innerHTML = `<div><strong>Búsqueda activa · ${esc(destination)}</strong><span>${esc(money(active.budget.normalized_total, active.budget.currency))} · ${analysis.travelers} viajero(s) · viabilidad ${esc({high:'alta',medium:'media',low:'baja'}[analysis.viability])}. ${esc(analysis.strategy)}</span></div><button type="button" class="assistant-secondary" data-edit-profile>Modificar criterios</button>`;
    host.querySelector('[data-edit-profile]').addEventListener('click', () => { step = 0; render(); if (!dialog.open) dialog.showModal(); document.body.style.overflow = 'hidden'; });
  }

  function track(eventName) {
    window.dispatchEvent(new CustomEvent('viajes:assistant-event', { detail: { event: eventName, step: step + 1, at: new Date().toISOString() } }));
  }

  document.getElementById('startTravelAssistant').addEventListener('click', () => openAssistant(false));
  document.getElementById('continueTravelAssistant').addEventListener('click', () => openAssistant(true));
  document.getElementById('closeTravelAssistant').addEventListener('click', closeAssistant);
  dialog.addEventListener('cancel', event => { event.preventDefault(); closeAssistant(); });
  dialog.addEventListener('click', event => { if (event.target === dialog) closeAssistant(); });
  backButton.addEventListener('click', () => { collect(); if (step > 0) step -= 1; render(); track('step_back'); });
  saveButton.addEventListener('click', () => { saveDraft(true); showError('Perfil guardado en este dispositivo. Puede continuar después.'); track('profile_saved'); });
  nextButton.addEventListener('click', async () => {
    const error = validateStep();
    if (error) { showError(error); return; }
    saveDraft(false);
    if (step === totalSteps - 1) { applyProfile(); return; }
    if (step === totalSteps - 2) {
      nextButton.disabled = true;
      nextButton.textContent = 'Preparando conclusión…';
      await enrichConclusion();
      nextButton.disabled = false;
    }
    step += 1;
    render();
    track('step_completed');
  });

  try {
    const saved = JSON.parse(localStorage.getItem(savedKey) || 'null');
    document.getElementById('continueTravelAssistant').disabled = !saved?.profile;
  } catch { document.getElementById('continueTravelAssistant').disabled = true; }

  window.TravelAssistant = {
    getProfile: () => window.__VIAJES_ASC_ACTIVE_TRIP_PROFILE__ || null,
    open: openAssistant,
    clearSaved: () => { localStorage.removeItem(savedKey); document.getElementById('continueTravelAssistant').disabled = true; }
  };
})();
