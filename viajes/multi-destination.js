(() => {
  'use strict';

  if (window.__VIAJES_ASC_MULTI_DESTINATION__) return;
  window.__VIAJES_ASC_MULTI_DESTINATION__ = true;

  const MAX_DESTINATIONS = 6;
  const STORAGE_KEY = 'viajesASCMultiRoute';
  const modeButtons = [...document.querySelectorAll('[data-trip-mode]')];
  const planner = document.getElementById('multiDestinationPlanner');
  const rowsRoot = document.getElementById('multiDestinationRows');
  const addButton = document.getElementById('addDestinationButton');
  const limitLabel = document.getElementById('multiDestinationLimit');
  const returnInput = document.getElementById('returnToOriginInput');
  const summary = document.getElementById('multiDestinationSummary');
  const originInput = document.getElementById('originInput');
  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');

  if (!planner || !rowsRoot || !addButton || !returnInput || !originInput) return;

  const parseISO = value => value ? new Date(`${value}T12:00:00`) : null;
  const toISO = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  const addDays = (value, days) => {
    const date = parseISO(value) || new Date();
    date.setDate(date.getDate() + days);
    return toISO(date);
  };
  const daysBetween = (start, end) => {
    const first = parseISO(start);
    const last = parseISO(end);
    if (!first || !last) return 0;
    return Math.max(0, Math.round((last - first) / 86400000));
  };
  const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, character => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[character]));

  let mode = 'single';
  let routes = [];

  function destinations() {
    return (window.state?.data?.destinations || state?.data?.destinations || [])
      .filter(destination => destination.airport && destination.kind !== 'cruise')
      .sort((a, b) => String(a.city).localeCompare(String(b.city), 'es'));
  }

  function defaultRoutes() {
    const start = startInput.value || addDays(toISO(new Date()), 90);
    return [
      { destinationId: '', date: start },
      { destinationId: '', date: addDays(start, 4) }
    ];
  }

  function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!saved) return;
      mode = saved.mode === 'multi' ? 'multi' : 'single';
      returnInput.checked = saved.returnToOrigin !== false;
      if (Array.isArray(saved.routes) && saved.routes.length >= 2) {
        routes = saved.routes.slice(0, MAX_DESTINATIONS).map(route => ({
          destinationId: String(route.destinationId || ''),
          date: String(route.date || '')
        }));
      }
    } catch (error) {
      console.warn('Multidestino preferences ignored', error);
    }
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      mode,
      returnToOrigin: returnInput.checked,
      routes
    }));
  }

  function destinationById(id) {
    return destinations().find(destination => destination.id === id) || null;
  }

  function routeOrigin(index) {
    if (index === 0) return originInput.value || 'MEX';
    return destinationById(routes[index - 1]?.destinationId)?.airport || '—';
  }

  function optionMarkup(selectedId) {
    const options = destinations().map(destination => (
      `<option value="${escapeHTML(destination.id)}" ${destination.id === selectedId ? 'selected' : ''}>` +
      `${escapeHTML(destination.city)} · ${escapeHTML(destination.airport)} · ${escapeHTML(destination.country)}` +
      '</option>'
    )).join('');
    return `<option value="">Seleccionar ciudad…</option>${options}`;
  }

  function renderRows() {
    rowsRoot.innerHTML = routes.map((route, index) => `
      <div class="multi-route-row" data-route-index="${index}">
        <div class="multi-route-index">${String(index + 1).padStart(2, '0')}</div>
        <div class="multi-route-origin"><small>Desde</small>${escapeHTML(routeOrigin(index))}</div>
        <div class="multi-route-arrow" aria-hidden="true">→</div>
        <label class="multi-route-field">
          <span>Destino ${index + 1}</span>
          <select data-route-destination="${index}" aria-label="Destino ${index + 1}">${optionMarkup(route.destinationId)}</select>
        </label>
        <label class="multi-route-field multi-route-field--date">
          <span>Fecha del tramo</span>
          <input data-route-date="${index}" type="date" value="${escapeHTML(route.date)}" aria-label="Fecha del tramo ${index + 1}">
        </label>
        <div class="multi-route-controls" aria-label="Controles del destino ${index + 1}">
          <button type="button" data-move-route="up" data-index="${index}" aria-label="Subir destino" ${index === 0 ? 'disabled' : ''}>↑</button>
          <button type="button" data-move-route="down" data-index="${index}" aria-label="Bajar destino" ${index === routes.length - 1 ? 'disabled' : ''}>↓</button>
          <button type="button" data-remove-route data-index="${index}" aria-label="Eliminar destino" ${routes.length <= 2 ? 'disabled' : ''}>×</button>
        </div>
      </div>`).join('');

    rowsRoot.querySelectorAll('[data-route-destination]').forEach(select => {
      select.addEventListener('change', () => {
        routes[Number(select.dataset.routeDestination)].destinationId = select.value;
        save();
        renderRows();
        renderSummary();
        applyQuery();
      });
    });
    rowsRoot.querySelectorAll('[data-route-date]').forEach(input => {
      input.addEventListener('change', () => {
        const index = Number(input.dataset.routeDate);
        routes[index].date = input.value;
        if (routes[index + 1] && routes[index + 1].date < input.value) routes[index + 1].date = addDays(input.value, 1);
        save();
        renderRows();
        renderSummary();
      });
    });
    rowsRoot.querySelectorAll('[data-move-route]').forEach(button => {
      button.addEventListener('click', () => {
        const index = Number(button.dataset.index);
        const nextIndex = button.dataset.moveRoute === 'up' ? index - 1 : index + 1;
        if (nextIndex < 0 || nextIndex >= routes.length) return;
        [routes[index], routes[nextIndex]] = [routes[nextIndex], routes[index]];
        save();
        renderRows();
        renderSummary();
      });
    });
    rowsRoot.querySelectorAll('[data-remove-route]').forEach(button => {
      button.addEventListener('click', () => {
        if (routes.length <= 2) return;
        routes.splice(Number(button.dataset.index), 1);
        save();
        renderRows();
        renderSummary();
        applyQuery();
      });
    });

    addButton.disabled = routes.length >= MAX_DESTINATIONS;
    limitLabel.textContent = `${routes.length} de ${MAX_DESTINATIONS} destinos`;
  }

  function selectedRoutes() {
    return routes.map((route, index) => ({
      ...route,
      origin: routeOrigin(index),
      destination: destinationById(route.destinationId)
    })).filter(route => route.destination);
  }

  function buildFlightLink(selected) {
    const segments = selected.map(route => `${route.origin} to ${route.destination.airport} on ${route.date}`);
    if (returnInput.checked && selected.length) {
      segments.push(`${selected.at(-1).destination.airport} to ${originInput.value || 'MEX'} on ${endInput.value}`);
    }
    const cabin = state?.cabin === 'business' ? 'business class' : 'economy';
    return `https://www.google.com/travel/flights?q=${encodeURIComponent(`Multi-city flights ${segments.join(', ')} ${cabin}`)}`;
  }

  function renderSummary() {
    if (mode !== 'multi') return;
    const selected = selectedRoutes();
    const complete = selected.length === routes.length;
    const airports = [originInput.value || 'MEX', ...selected.map(route => route.destination.airport)];
    if (returnInput.checked && selected.length) airports.push(originInput.value || 'MEX');
    const totalNights = daysBetween(routes[0]?.date || startInput.value, endInput.value);
    const currencies = new Set(selected.map(route => route.destination.currency).filter(Boolean));

    summary.innerHTML = `
      <div class="multi-summary-grid">
        <div class="multi-summary-metric"><span>Ruta</span><strong>${airports.map(escapeHTML).join(' → ') || 'Pendiente'}</strong></div>
        <div class="multi-summary-metric"><span>Destinos</span><strong>${selected.length} de ${routes.length}</strong></div>
        <div class="multi-summary-metric"><span>Duración</span><strong>${totalNights || '—'} noches</strong></div>
        <div class="multi-summary-metric"><span>Monedas locales</span><strong>${currencies.size ? [...currencies].map(escapeHTML).join(' · ') : 'Pendiente'}</strong></div>
      </div>
      ${complete ? `<a class="multi-route-verify" target="_blank" rel="noopener" href="${buildFlightLink(selected)}">Verificar ruta aérea completa</a>` : ''}
      <p class="multi-route-warning">El tablero organiza el itinerario y conserva el análisis financiero por destino. Los vuelos entre ciudades se cotizan en vivo antes de comprar; no se suman precios no verificados.</p>`;
  }

  function syncMode() {
    planner.classList.toggle('hidden', mode !== 'multi');
    modeButtons.forEach(button => {
      const active = button.dataset.tripMode === mode;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
    });
    if (mode === 'multi') {
      if (routes.length < 2) routes = defaultRoutes();
      renderRows();
      renderSummary();
    }
    save();
  }

  modeButtons.forEach(button => button.addEventListener('click', () => {
    mode = button.dataset.tripMode === 'multi' ? 'multi' : 'single';
    syncMode();
    applyQuery();
  }));

  addButton.addEventListener('click', () => {
    if (routes.length >= MAX_DESTINATIONS) return;
    const previousDate = routes.at(-1)?.date || startInput.value;
    routes.push({ destinationId: '', date: addDays(previousDate, 3) });
    save();
    renderRows();
    renderSummary();
  });
  returnInput.addEventListener('change', () => { save(); renderSummary(); applyQuery(); });
  originInput.addEventListener('change', () => { renderRows(); renderSummary(); });
  endInput.addEventListener('change', renderSummary);

  restore();
  if (!routes.length) routes = defaultRoutes();
  syncMode();

  const previousApplyQuery = applyQuery;
  applyQuery = function multiDestinationAwareApplyQuery() {
    const result = previousApplyQuery();
    if (mode === 'multi') {
      renderSummary();
      const resultSummary = document.getElementById('resultSummary');
      const selected = selectedRoutes();
      if (resultSummary) resultSummary.textContent += ` · Multidestino: ${selected.length}/${routes.length} rutas definidas`;
    }
    return result;
  };

  const destinationPoll = window.setInterval(() => {
    if (!destinations().length) return;
    window.clearInterval(destinationPoll);
    if (mode === 'multi') { renderRows(); renderSummary(); }
  }, 120);

  window.ViajesMultiDestination = {
    get mode() { return mode; },
    get routes() { return selectedRoutes(); },
    get returnToOrigin() { return returnInput.checked; }
  };
})();
