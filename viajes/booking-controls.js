(() => {
  'use strict';

  if (window.__VIAJES_ASC_BOOKING_CONTROLS__) return;
  window.__VIAJES_ASC_BOOKING_CONTROLS__ = true;

  const CURRENCY_NAMES = {
    MXN: 'Peso mexicano', USD: 'Dólar estadounidense', EUR: 'Euro',
    JPY: 'Yen japonés', ARS: 'Peso argentino', TRY: 'Lira turca',
    THB: 'Baht tailandés', KRW: 'Won surcoreano', VND: 'Dong vietnamita',
    ZAR: 'Rand sudafricano', EGP: 'Libra egipcia', MAD: 'Dírham marroquí',
    HUF: 'Forinto húngaro', CZK: 'Corona checa', MYR: 'Ringgit malasio',
    IDR: 'Rupia indonesia', SGD: 'Dólar de Singapur'
  };
  const PRIORITY_CURRENCIES = ['MXN', 'USD', 'EUR', 'JPY', 'ARS', 'TRY', 'THB'];
  const dateFormatter = new Intl.DateTimeFormat('es-MX', {
    day: '2-digit', month: 'short', year: 'numeric'
  });

  let selectedCurrency = localStorage.getItem('viajesASCCurrency') || 'MXN';
  let selectedNights = 7;
  let currencySelect;
  let summaryElement;
  let budgetLabel;

  const budgetInput = document.getElementById('budgetInput');
  const startInput = document.getElementById('startDate');
  const endInput = document.getElementById('endDate');
  const queryForm = document.getElementById('queryForm');

  if (!budgetInput || !startInput || !endInput || !queryForm) return;

  const parseISO = value => {
    if (!value) return null;
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return null;
    return new Date(year, month - 1, day, 12, 0, 0);
  };

  const toISO = date => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const addDays = (date, days) => {
    const copy = new Date(date);
    copy.setDate(copy.getDate() + days);
    return copy;
  };

  const dayDifference = (start, end) => Math.max(
    1,
    Math.round((end.getTime() - start.getTime()) / 86400000)
  );

  function rateMap() {
    const usdMxn = Number(state?.data?.market_snapshot?.usd_mxn) || 17.23;
    const rates = { USD: 1, MXN: usdMxn };
    (state?.data?.destinations || []).forEach(destination => {
      const code = destination.currency;
      const rate = Number(destination.current_local_per_usd);
      if (code && Number.isFinite(rate) && rate > 0 && !rates[code]) rates[code] = rate;
    });
    return rates;
  }

  function toMXN(amount, currency = selectedCurrency) {
    const rates = rateMap();
    const amountNumber = Number(amount) || 0;
    const localPerUsd = rates[currency] || 1;
    return (amountNumber / localPerUsd) * rates.MXN;
  }

  function fromMXN(amount, currency = selectedCurrency) {
    const rates = rateMap();
    const mxnAmount = Number(amount) || 0;
    return (mxnAmount / rates.MXN) * (rates[currency] || 1);
  }

  function fractionDigits(currency = selectedCurrency) {
    if (['JPY', 'KRW', 'VND', 'IDR', 'ARS', 'HUF'].includes(currency)) return 0;
    return 0;
  }

  function formatSelectedCurrency(mxnAmount) {
    return new Intl.NumberFormat('es-MX', {
      style: 'currency',
      currency: selectedCurrency,
      maximumFractionDigits: fractionDigits()
    }).format(fromMXN(mxnAmount));
  }

  function roundedBudget(value, currency) {
    if (!Number.isFinite(value)) return '';
    if (['JPY', 'KRW', 'VND', 'IDR', 'ARS', 'HUF'].includes(currency)) {
      return String(Math.round(value / 1000) * 1000);
    }
    return String(Math.round(value));
  }

  function availableCurrencies() {
    const rates = rateMap();
    const available = Object.keys(rates).filter(code => CURRENCY_NAMES[code]);
    return available.sort((a, b) => {
      const aPriority = PRIORITY_CURRENCIES.indexOf(a);
      const bPriority = PRIORITY_CURRENCIES.indexOf(b);
      if (aPriority !== -1 || bPriority !== -1) {
        if (aPriority === -1) return 1;
        if (bPriority === -1) return -1;
        return aPriority - bPriority;
      }
      return a.localeCompare(b);
    });
  }

  function populateCurrencySelector() {
    const currencies = availableCurrencies();
    if (!currencies.includes(selectedCurrency)) selectedCurrency = 'MXN';
    currencySelect.innerHTML = currencies.map(code => (
      `<option value="${code}">${code} · ${CURRENCY_NAMES[code]}</option>`
    )).join('');
    currencySelect.value = selectedCurrency;
    updateCurrencyLabels();
  }

  function updateCurrencyLabels() {
    if (budgetLabel) budgetLabel.textContent = `Presupuesto total · ${selectedCurrency}`;
    budgetInput.step = ['MXN', 'ARS', 'JPY', 'KRW', 'VND', 'IDR', 'HUF'].includes(selectedCurrency) ? '1000' : '100';
    budgetInput.placeholder = selectedCurrency === 'MXN' ? 'Ej. 120000' : selectedCurrency === 'USD' ? 'Ej. 7000' : 'Ingresa tu presupuesto';
    const costMode = document.getElementById('costModeLabel');
    if (costMode) {
      const cabin = state?.cabin === 'business' ? 'BUSINESS' : 'TURISTA';
      costMode.textContent = `${cabin} · ${selectedCurrency}`;
    }
    const headers = [...document.querySelectorAll('thead th')];
    headers.forEach(header => {
      const text = header.textContent.replace(/\s·\s[A-Z]{3}$/, '');
      if (['Diario moderado', '7 noches Turista', '7 noches Business'].includes(text)) {
        header.textContent = `${text} · ${selectedCurrency}`;
      }
    });
  }

  function convertRenderedMoney(root) {
    if (!root) return;
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(node => {
      const match = node.nodeValue.match(/^\s*\$\s?([\d,]+)\s*$/);
      if (!match) return;
      const mxnValue = Number(match[1].replace(/,/g, ''));
      if (Number.isFinite(mxnValue)) node.nodeValue = formatSelectedCurrency(mxnValue);
    });
  }

  function updateCostChartCurrency() {
    if (!window.Chart) return;
    const chart = Chart.getChart(document.getElementById('costChart'));
    if (!chart) return;
    chart.data.datasets.forEach(dataset => {
      const source = Array.isArray(dataset.__mxnValues)
        ? dataset.__mxnValues
        : dataset.data.map(Number);
      dataset.__mxnValues = source;
      dataset.data = source.map(value => fromMXN(value));
    });
    chart.options.plugins.tooltip.callbacks.label = context => (
      `${context.dataset.label ? `${context.dataset.label}: ` : ''}` +
      new Intl.NumberFormat('es-MX', {
        style: 'currency', currency: selectedCurrency,
        maximumFractionDigits: fractionDigits()
      }).format(Number(context.raw) || 0)
    );
    chart.options.scales.y.ticks.callback = value => {
      const numeric = Number(value) || 0;
      if (Math.abs(numeric) >= 1000000) return `${(numeric / 1000000).toFixed(1)}m ${selectedCurrency}`;
      if (Math.abs(numeric) >= 1000) return `${Math.round(numeric / 1000)}k ${selectedCurrency}`;
      return `${Math.round(numeric)} ${selectedCurrency}`;
    };
    chart.update('none');
  }

  function refreshCurrencyPresentation() {
    populateCurrencySelector();
    convertRenderedMoney(document.getElementById('recommendations'));
    convertRenderedMoney(document.getElementById('matrixBody'));
    updateCurrencyLabels();
    window.setTimeout(updateCostChartCurrency, 40);
  }

  function updateDateSummary() {
    const start = parseISO(startInput.value);
    const end = parseISO(endInput.value);
    if (!start || !end) {
      summaryElement.textContent = 'Selecciona salida y regreso';
      return;
    }
    selectedNights = dayDifference(start, end);
    summaryElement.textContent = `${dateFormatter.format(start)} → ${dateFormatter.format(end)} · ${selectedNights} ${selectedNights === 1 ? 'noche' : 'noches'}`;
    endInput.min = toISO(addDays(start, 1));
  }

  function setTripFromToday(daysAhead) {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const start = addDays(today, daysAhead);
    startInput.value = toISO(start);
    endInput.value = toISO(addDays(start, selectedNights));
    updateDateSummary();
    applyQuery();
  }

  function setNights(nights) {
    selectedNights = nights;
    const start = parseISO(startInput.value) || addDays(new Date(), 90);
    endInput.value = toISO(addDays(start, nights));
    updateDateSummary();
    applyQuery();
  }

  function openNativePicker(input) {
    try {
      if (typeof input.showPicker === 'function') input.showPicker();
      else {
        input.focus();
        input.click();
      }
    } catch {
      input.focus();
    }
  }

  function buildBudgetControl() {
    const label = budgetInput.closest('label');
    budgetLabel = label?.querySelector('span');
    if (!label || !budgetLabel) return;
    const wrapper = document.createElement('div');
    wrapper.className = 'grid grid-cols-[1fr_auto] overflow-hidden rounded border border-slate-700 bg-terminal-950 focus-within:border-cyanx';
    budgetInput.parentNode.insertBefore(wrapper, budgetInput);
    wrapper.appendChild(budgetInput);
    budgetInput.className = 'min-w-0 border-0 bg-transparent px-3 py-3 text-sm outline-none';

    currencySelect = document.createElement('select');
    currencySelect.id = 'currencyInput';
    currencySelect.setAttribute('aria-label', 'Moneda del presupuesto y resultados');
    currencySelect.className = 'max-w-[160px] border-0 border-l border-slate-700 bg-terminal-850 px-3 text-xs font-semibold text-goldx outline-none';
    wrapper.appendChild(currencySelect);

    const helper = document.createElement('div');
    helper.className = 'mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500';
    helper.innerHTML = '<span>Los resultados se convertirán automáticamente.</span><span id="currencyRateNote" class="font-mono"></span>';
    wrapper.insertAdjacentElement('afterend', helper);

    currencySelect.addEventListener('change', () => {
      const previousCurrency = selectedCurrency;
      const existingBudget = Number(budgetInput.value);
      const budgetMXN = existingBudget > 0 ? toMXN(existingBudget, previousCurrency) : 0;
      selectedCurrency = currencySelect.value;
      localStorage.setItem('viajesASCCurrency', selectedCurrency);
      if (budgetMXN > 0) budgetInput.value = roundedBudget(fromMXN(budgetMXN, selectedCurrency), selectedCurrency);
      applyQuery();
    });
  }

  function buildCalendarControls() {
    const today = new Date();
    today.setHours(12, 0, 0, 0);
    const todayISO = toISO(today);
    startInput.min = todayISO;

    [startInput, endInput].forEach(input => {
      input.classList.add('cursor-pointer');
      const label = input.closest('label');
      if (!label || label.querySelector('[data-open-calendar]')) return;
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.openCalendar = input.id;
      button.className = 'mt-1 inline-flex items-center gap-1.5 rounded border border-slate-700 px-2.5 py-1.5 text-[10px] font-semibold text-cyanx hover:border-cyanx hover:bg-cyanx/5';
      button.innerHTML = '<span aria-hidden="true">▦</span> Abrir calendario';
      button.addEventListener('click', () => openNativePicker(input));
      label.appendChild(button);
      input.addEventListener('click', () => openNativePicker(input));
    });

    const helper = document.createElement('div');
    helper.id = 'calendarAssistant';
    helper.className = 'rounded-lg border border-slate-800 bg-terminal-950/70 p-3 lg:col-span-4';
    helper.innerHTML = `
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p class="font-mono text-[9px] uppercase tracking-[.16em] text-goldx">Calendario asistido</p>
          <p id="tripDateSummary" class="mt-1 text-xs font-semibold text-white">Selecciona salida y regreso</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button type="button" data-departure="30" class="rounded border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-300 hover:border-cyanx hover:text-cyanx">En 30 días</button>
          <button type="button" data-departure="60" class="rounded border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-300 hover:border-cyanx hover:text-cyanx">En 60 días</button>
          <button type="button" data-departure="90" class="rounded border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-300 hover:border-cyanx hover:text-cyanx">En 90 días</button>
          <span class="hidden w-px bg-slate-700 sm:block"></span>
          <button type="button" data-nights="7" class="rounded border border-goldx/50 bg-goldx/10 px-2.5 py-1.5 text-[10px] font-semibold text-goldx">7 noches</button>
          <button type="button" data-nights="10" class="rounded border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-300 hover:border-goldx hover:text-goldx">10 noches</button>
          <button type="button" data-nights="14" class="rounded border border-slate-700 px-2.5 py-1.5 text-[10px] text-slate-300 hover:border-goldx hover:text-goldx">14 noches</button>
        </div>
      </div>`;
    queryForm.appendChild(helper);
    summaryElement = helper.querySelector('#tripDateSummary');

    helper.querySelectorAll('[data-departure]').forEach(button => {
      button.addEventListener('click', () => setTripFromToday(Number(button.dataset.departure)));
    });
    helper.querySelectorAll('[data-nights]').forEach(button => {
      button.addEventListener('click', () => {
        helper.querySelectorAll('[data-nights]').forEach(item => {
          item.classList.remove('border-goldx/50', 'bg-goldx/10', 'text-goldx', 'font-semibold');
          item.classList.add('border-slate-700', 'text-slate-300');
        });
        button.classList.remove('border-slate-700', 'text-slate-300');
        button.classList.add('border-goldx/50', 'bg-goldx/10', 'text-goldx', 'font-semibold');
        setNights(Number(button.dataset.nights));
      });
    });

    startInput.addEventListener('change', () => {
      const start = parseISO(startInput.value);
      if (!start) return;
      endInput.value = toISO(addDays(start, selectedNights));
      updateDateSummary();
      applyQuery();
    });
    endInput.addEventListener('change', () => {
      const start = parseISO(startInput.value);
      const end = parseISO(endInput.value);
      if (start && end && end <= start) endInput.value = toISO(addDays(start, 1));
      updateDateSummary();
      applyQuery();
    });

    updateDateSummary();
  }

  buildBudgetControl();
  buildCalendarControls();
  populateCurrencySelector();

  const originalScoreQuery = scoreQuery;
  scoreQuery = function currencyAwareScore(destination) {
    const originalValue = budgetInput.value;
    const budgetMXN = toMXN(originalValue);
    budgetInput.value = budgetMXN ? String(Math.round(budgetMXN)) : '';
    try {
      return originalScoreQuery(destination);
    } finally {
      budgetInput.value = originalValue;
    }
  };

  const originalApplyQuery = applyQuery;
  applyQuery = function currencyAwareApplyQuery() {
    const result = originalApplyQuery();
    refreshCurrencyPresentation();
    const saved = JSON.parse(localStorage.getItem('viajesASCQuery') || '{}');
    saved.currency = selectedCurrency;
    localStorage.setItem('viajesASCQuery', JSON.stringify(saved));
    return result;
  };

  window.addEventListener('load', () => window.setTimeout(refreshCurrencyPresentation, 250));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') window.setTimeout(refreshCurrencyPresentation, 100);
  });
  window.setTimeout(refreshCurrencyPresentation, 300);
})();