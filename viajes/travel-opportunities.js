(() => {
  'use strict';

  if (window.__VIAJES_ASC_OPPORTUNITY_DESK__) return;
  window.__VIAJES_ASC_OPPORTUNITY_DESK__ = true;

  const dealCards = document.getElementById('dealCards');
  const dealFilters = document.getElementById('dealFilters');
  if (!dealCards || !dealFilters) return;

  let dealFilter = 'all';

  const median = values => {
    const sorted = values.map(Number).filter(Number.isFinite).sort((a, b) => a - b);
    if (!sorted.length) return 0;
    const midpoint = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[midpoint] : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
  };

  const compactMoney = value => {
    if (window.ViajesCurrency?.formatMXN) return window.ViajesCurrency.formatMXN(value);
    return new Intl.NumberFormat('es-MX', {
      style: 'currency', currency: 'MXN', maximumFractionDigits: 0
    }).format(Number(value) || 0);
  };

  const nights = () => {
    const start = document.getElementById('startDate')?.value;
    const end = document.getElementById('endDate')?.value;
    if (!start || !end) return 7;
    const delta = (new Date(`${end}T12:00:00`) - new Date(`${start}T12:00:00`)) / 86400000;
    return Number.isFinite(delta) && delta > 0 ? Math.round(delta) : 7;
  };

  const tripCost = destination => {
    const stay = state.cabin === 'business' ? destination.luxury_daily_mxn : destination.moderate_daily_mxn;
    const flight = state.cabin === 'business' ? destination.business_flight_mxn : destination.economy_flight_mxn;
    return flight + stay * nights();
  };

  const fxSaving = destination => {
    const usdMxn = Number(state.data?.market_snapshot?.usd_mxn) || 0;
    const baselineDailyUsd = state.cabin === 'business' ? destination.luxury_daily_usd : destination.moderate_daily_usd;
    const baseline = baselineDailyUsd * usdMxn * nights();
    const current = (state.cabin === 'business' ? destination.luxury_daily_mxn : destination.moderate_daily_mxn) * nights();
    return Math.max(0, Math.round(baseline - current));
  };

  function opportunities(items) {
    const rows = items.map(destination => {
      const peers = items.filter(item => item.kind === destination.kind).map(tripCost);
      const benchmark = median(peers) || tripCost(destination);
      const price = tripCost(destination);
      const relativeDiscount = benchmark > 0 ? ((benchmark - price) / benchmark) * 100 : 0;
      const saving = fxSaving(destination);
      const conviction = Math.max(0, relativeDiscount) * .42
        + Math.max(0, Number(destination.fx_advantage_pct)) * 1.1
        + Number(destination.value_for_money) * 2.4
        + Math.max(0, 12 - Number(destination.volatility_annualized_pct)) * .28;
      const signal = relativeDiscount >= 15 && destination.fx_advantage_pct >= 5
        ? 'Reservar'
        : relativeDiscount >= 8 || destination.fx_advantage_pct >= 5
          ? 'Verificar hoy'
          : 'Vigilar';
      return { destination, benchmark, price, relativeDiscount, saving, conviction, signal };
    });
    if (dealFilter === 'savings') rows.sort((a, b) => b.saving - a.saving || b.conviction - a.conviction);
    else if (dealFilter === 'low-risk') rows.sort((a, b) => a.destination.volatility_annualized_pct - b.destination.volatility_annualized_pct || b.conviction - a.conviction);
    else rows.sort((a, b) => b.conviction - a.conviction);
    return rows.slice(0, 4);
  }

  function renderDecisionSignals(items) {
    if (!items.length) return;
    const topFive = [...items].sort((a, b) => b.roi_score - a.roi_score).slice(0, 5);
    const medianFx = median(topFive.map(item => item.fx_advantage_pct));
    const medianVol = median(topFive.map(item => item.volatility_annualized_pct));
    const best = opportunities(items)[0];
    const green = items.filter(item => item.traffic_light === 'green').length;
    const maxSaving = Math.max(...items.map(fxSaving), 0);
    const signal = green >= 4 && medianFx >= 5 ? 'buy' : green === 0 || medianFx < 0 ? 'wait' : 'watch';
    const signalCopy = { buy: 'Ventana favorable', watch: 'Vigilar precios', wait: 'Esperar' }[signal];

    document.getElementById('medianFxAdvantage').textContent = `${medianFx >= 0 ? '+' : ''}${medianFx.toFixed(1)}%`;
    document.getElementById('medianFxAdvantage').style.color = medianFx >= 5 ? '#34d399' : medianFx < 0 ? '#fb7185' : '#e8c66a';
    document.getElementById('maxFxSavings').textContent = compactMoney(maxSaving);
    document.getElementById('maxFxSavings').style.color = maxSaving > 0 ? '#34d399' : '#f8fafc';
    document.getElementById('maxFxSavingsContext').textContent = `${items.sort((a, b) => fxSaving(b) - fxSaving(a))[0]?.city || 'Sin ventaja'} · gasto local ${nights()} noches`;
    document.getElementById('greenCountContext').textContent = `De ${items.length} opciones visibles`;
    document.getElementById('medianVolatility').textContent = `${medianVol.toFixed(1)}%`;
    document.getElementById('medianVolatility').style.color = medianVol <= 8 ? '#34d399' : medianVol >= 15 ? '#fb7185' : '#e8c66a';
    document.getElementById('bestOpportunity').textContent = best?.destination.city || '—';
    document.getElementById('bestOpportunityContext').textContent = best ? `${best.signal} · Score ${Math.round(best.conviction)}` : 'Sin señal';
    const badge = document.getElementById('bookingSignalBadge');
    badge.textContent = signalCopy;
    badge.className = `decision-badge decision-badge--${signal}`;
  }

  function renderDeals(items) {
    const rows = opportunities(items);
    dealCards.innerHTML = rows.map((row, index) => {
      const destination = row.destination;
      const links = buildLiveLinks(destination);
      const confidence = row.conviction >= 28 ? 'Alta' : 'Media';
      const statusClass = confidence === 'Alta' ? 'high' : 'watch';
      const discount = Math.max(0, row.relativeDiscount);
      return `<article class="deal-card">
        <i class="deal-status deal-status--${statusClass}" aria-hidden="true"></i>
        <div class="deal-card__top"><div><p class="deal-card__eyebrow">Oportunidad 0${index + 1} · ${esc(row.signal)}</p><h3>${esc(destination.city)}</h3><p class="deal-card__country">${esc(destination.country)} · ${esc(destination.route_summary)}</p></div><div class="deal-score"><strong>${Math.round(row.conviction)}</strong><span>Score</span></div></div>
        <div class="deal-price"><span>Total estimado · ${nights()} noches</span><strong>${compactMoney(row.price)}</strong><p class="deal-comparison">${discount > 0 ? `<b>${discount.toFixed(0)}% debajo</b> de su canasta comparable` : 'Precio cercano a su referencia comparable'}</p></div>
        <div class="deal-signals"><div class="deal-signal"><span>Ventaja FX</span><strong>${destination.fx_advantage_pct >= 0 ? '+' : ''}${number(destination.fx_advantage_pct)}%</strong></div><div class="deal-signal"><span>Ahorro por divisa</span><strong>${compactMoney(row.saving)}</strong></div><div class="deal-signal"><span>Volatilidad</span><strong>${number(destination.volatility_annualized_pct)}%</strong></div><div class="deal-signal"><span>Convicción</span><strong>${confidence}</strong></div></div>
        <div class="deal-action"><a href="${links.flights}" target="_blank" rel="noopener">Verificar precio en Google Travel <span aria-hidden="true">↗</span></a></div>
      </article>`;
    }).join('') || '<div class="p-6 text-sm text-slate-400">No hay oportunidades para los filtros actuales.</div>';
  }

  function refreshOpportunityDesk() {
    if (!state?.data) return;
    const items = state.filtered?.length ? [...state.filtered] : [...state.data.destinations];
    renderDecisionSignals([...items]);
    renderDeals([...items]);
  }

  dealFilters.querySelectorAll('[data-deal-filter]').forEach(button => {
    button.addEventListener('click', () => {
      dealFilter = button.dataset.dealFilter;
      dealFilters.querySelectorAll('button').forEach(item => item.classList.toggle('is-active', item === button));
      refreshOpportunityDesk();
    });
  });

  const previousApplyQuery = applyQuery;
  applyQuery = function opportunityAwareApplyQuery() {
    const result = previousApplyQuery();
    refreshOpportunityDesk();
    return result;
  };

  window.addEventListener('load', () => window.setTimeout(refreshOpportunityDesk, 350));
  window.addEventListener('online', () => window.setTimeout(refreshOpportunityDesk, 100));
})();
