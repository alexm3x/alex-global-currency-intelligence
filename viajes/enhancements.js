(() => {
  'use strict';

  const COLORS = {
    bg: '#0B0F19', card: '#161B26', edge: '#222B3C', text: '#ECF3FA',
    muted: '#8290A5', cyan: '#55DFF7', gold: '#E4C56A', green: '#3DDC97',
    amber: '#F6C85F', red: '#FF6B7A'
  };
  const impactRank = { high: 3, medium: 2, low: 1 };
  let costChartV3 = null;
  let fxChartV3 = null;
  let fxResizeV3 = null;
  let selectedDestinationId = null;
  let lightweightPromise = null;

  const html = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[char]));
  const mxn = value => new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0
  }).format(Number(value) || 0);
  const decimal = (value, digits = 1) => Number(value || 0).toLocaleString('es-MX', {
    minimumFractionDigits: digits, maximumFractionDigits: digits
  });

  function injectVisualLayer() {
    if (document.getElementById('viajesV3Styles')) return;
    const style = document.createElement('style');
    style.id = 'viajesV3Styles';
    style.textContent = `
      :root{--v3-bg:${COLORS.bg};--v3-card:${COLORS.card};--v3-edge:${COLORS.edge};--v3-cyan:${COLORS.cyan};--v3-gold:${COLORS.gold};--v3-green:${COLORS.green};--v3-amber:${COLORS.amber};--v3-red:${COLORS.red}}
      body{background-color:var(--v3-bg)!important}
      #newsIntelligenceV3{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(280px,.75fr);gap:16px;margin-top:16px}
      .v3-panel{background:linear-gradient(180deg,rgba(22,27,38,.98),rgba(13,18,28,.98));border:1px solid var(--v3-edge);border-radius:14px;box-shadow:0 22px 70px rgba(0,0,0,.28);overflow:hidden}
      .v3-head{padding:18px 20px;border-bottom:1px solid var(--v3-edge)}
      .v3-kicker{font:700 10px/1.3 ui-monospace,SFMono-Regular,Menlo,monospace;letter-spacing:.18em;text-transform:uppercase;color:var(--v3-gold)}
      .v3-head h2,.v3-head h3{margin:5px 0 0;color:#fff}.v3-head p{margin:7px 0 0;color:${COLORS.muted};font-size:12px}
      .v3-news article{position:relative;padding:17px 20px 17px 34px;border-top:1px solid var(--v3-edge)}
      .v3-news article:first-child{border-top:0}.v3-news article:before{content:'';position:absolute;left:20px;top:21px;bottom:21px;width:2px;background:linear-gradient(var(--v3-cyan),transparent)}
      .v3-news-meta{display:flex;flex-wrap:wrap;align-items:center;gap:7px}.v3-news a{display:block;margin-top:8px;color:#fff;font-weight:750;font-size:15px;line-height:1.38;text-decoration:none}.v3-news a:hover{color:var(--v3-cyan)}
      .v3-news p{margin:8px 0 0;color:${COLORS.muted};font-size:12px;line-height:1.55}.v3-source{margin-top:8px;color:#59667a;font:9px ui-monospace,monospace;text-transform:uppercase}
      .v3-impact,.v3-destination{display:inline-flex;border:1px solid var(--v3-edge);border-radius:5px;padding:4px 6px;font:800 9px ui-monospace,monospace;text-transform:uppercase}.v3-destination{color:var(--v3-cyan)}
      .v3-impact.high{color:var(--v3-red);border-color:rgba(255,107,122,.35);background:rgba(255,107,122,.08)}.v3-impact.medium{color:var(--v3-amber);border-color:rgba(246,200,95,.35);background:rgba(246,200,95,.08)}.v3-impact.low{color:var(--v3-green);border-color:rgba(61,220,151,.35);background:rgba(61,220,151,.08)}
      .v3-time{color:#59667a;font:9px ui-monospace,monospace}.v3-risk{padding:18px}.v3-risk-card{padding:14px;border:1px solid var(--v3-edge);border-radius:10px;background:${COLORS.bg};margin-bottom:11px}.v3-risk-line{display:flex;justify-content:space-between;gap:12px;font-size:12px;color:${COLORS.muted}}.v3-risk-line strong{color:#fff}
      .v3-progress{height:5px;margin-top:10px;border-radius:999px;overflow:hidden;background:#0A1019}.v3-progress i{display:block;height:100%;border-radius:999px;background:linear-gradient(90deg,var(--v3-cyan),var(--v3-gold))}
      #fxChartV3{height:320px;position:relative}.v3-fx-header{display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center;margin:0 0 10px}.v3-fx-header strong{font-size:13px}.v3-fx-header span{font:10px ui-monospace,monospace;color:${COLORS.muted}}
      .v3-card-selected{border-color:rgba(228,197,106,.7)!important;box-shadow:0 14px 40px rgba(0,0,0,.28)}
      .v3-svg{width:100%;height:100%;display:block}.v3-attribution{text-align:right;color:#566175;font-size:9px;margin-top:5px}
      @media(max-width:920px){#newsIntelligenceV3{grid-template-columns:1fr}}@media(max-width:640px){#fxChartV3{height:275px}}
    `;
    document.head.appendChild(style);
  }

  function ensureNewsShell() {
    let section = document.getElementById('newsIntelligenceV3');
    if (section) return section;
    section = document.createElement('section');
    section.id = 'newsIntelligenceV3';
    section.innerHTML = `
      <article class="v3-panel">
        <div class="v3-head"><div class="v3-kicker">Terminal de Noticias Cambiarias & Geopolítica</div><h2>Señales relevantes para el Top 3</h2><p>El flujo cambia automáticamente con los destinos sugeridos por la consola.</p></div>
        <div id="newsTerminalV3" class="v3-news"></div>
      </article>
      <aside class="v3-panel">
        <div class="v3-head"><div class="v3-kicker">Risk Radar</div><h3>Lectura ejecutiva</h3></div>
        <div id="riskRadarV3" class="v3-risk"></div>
      </aside>`;
    const chartAnchor = document.getElementById('costChart')?.closest('section');
    const matrixAnchor = document.getElementById('matrixBody')?.closest('section');
    if (chartAnchor?.parentNode) chartAnchor.insertAdjacentElement('afterend', section);
    else if (matrixAnchor?.parentNode) matrixAnchor.parentNode.insertBefore(section, matrixAnchor);
    else document.querySelector('main')?.appendChild(section);
    return section;
  }

  function loadLightweightCharts() {
    if (window.LightweightCharts) return Promise.resolve(window.LightweightCharts);
    if (lightweightPromise) return lightweightPromise;
    lightweightPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/lightweight-charts@5.0.9/dist/lightweight-charts.standalone.production.js';
      script.async = true;
      script.onload = () => resolve(window.LightweightCharts);
      script.onerror = reject;
      document.head.appendChild(script);
    });
    return lightweightPromise;
  }

  function currentCostField() {
    try { return state.cabin === 'business' ? 'business_total_7n_mxn' : 'moderate_total_7n_mxn'; }
    catch { return 'moderate_total_7n_mxn'; }
  }

  function syntheticTrend(item) {
    const supplied = Array.isArray(item.fx_trend) ? item.fx_trend : [];
    if (supplied.length >= 2) return supplied.map(point => ({ time: point.date, value: Number(point.local_per_usd) })).filter(point => point.time && Number.isFinite(point.value));
    const current = Number(item.current_local_per_usd) || 1;
    const anchor = Number(item.historical_average_local_per_usd) || current;
    const today = new Date();
    return Array.from({ length: 12 }, (_, index) => {
      const date = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - (11 - index), 1));
      const progress = index / 11;
      const wave = Math.sin(index * 1.3 + item.currency.charCodeAt(0) / 10) * Math.max(Math.abs(current - anchor) * .035, anchor * .002);
      return { time: date.toISOString().slice(0, 10), value: Math.max(.000001, anchor + (current - anchor) * progress + wave) };
    });
  }

  function destroyFx() {
    if (fxResizeV3) { fxResizeV3.disconnect(); fxResizeV3 = null; }
    if (fxChartV3) { fxChartV3.remove(); fxChartV3 = null; }
  }

  function renderFxFallback(container, item, data) {
    destroyFx();
    const values = data.map(point => point.value);
    if (values.length < 2) { container.innerHTML = '<div style="display:flex;height:100%;align-items:center;justify-content:center;color:#8290A5">Sin tendencia disponible</div>'; return; }
    const width = 820, height = 280, min = Math.min(...values), max = Math.max(...values), range = max - min || 1;
    const path = values.map((value, index) => `${index ? 'L' : 'M'} ${(index / (values.length - 1)) * width} ${height - 28 - ((value - min) / range) * (height - 58)}`).join(' ');
    container.innerHTML = `<svg class="v3-svg" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="v3FxGradient" x1="0" y1="0" x2="0" y2="1"><stop stop-color="${COLORS.cyan}" stop-opacity=".42"/><stop offset="1" stop-color="${COLORS.cyan}" stop-opacity="0"/></linearGradient></defs><path d="${path} L ${width} ${height} L 0 ${height} Z" fill="url(#v3FxGradient)"/><path d="${path}" fill="none" stroke="${COLORS.cyan}" stroke-width="3"/></svg>`;
  }

  async function drawFxChart(item) {
    let host = document.getElementById('fxChart');
    if (!host) return;
    if (host.tagName === 'CANVAS') {
      const replacement = document.createElement('div');
      replacement.id = 'fxChart';
      replacement.className = host.className;
      host.replaceWith(replacement);
      host = replacement;
    }
    host.innerHTML = `<div class="v3-fx-header"><strong>${html(item.city)} · ${html(item.currency)} por USD</strong><span>${Number(item.fx_advantage_pct) >= 0 ? '+' : ''}${decimal(item.fx_advantage_pct)}% vs referencia</span></div><div id="fxChartV3"></div><div class="v3-attribution">Charts by TradingView Lightweight Charts™</div>`;
    const container = document.getElementById('fxChartV3');
    const data = syntheticTrend(item);
    try {
      const LightweightCharts = await loadLightweightCharts();
      destroyFx();
      const chart = LightweightCharts.createChart(container, {
        width: container.clientWidth, height: container.clientHeight,
        layout: { background: { type: 'solid', color: COLORS.card }, textColor: COLORS.muted, fontFamily: 'Inter' },
        grid: { vertLines: { color: 'rgba(130,144,165,.08)' }, horzLines: { color: 'rgba(130,144,165,.08)' } },
        rightPriceScale: { borderColor: COLORS.edge }, timeScale: { borderColor: COLORS.edge },
        crosshair: { vertLine: { color: 'rgba(228,197,106,.45)', labelBackgroundColor: COLORS.gold }, horzLine: { color: 'rgba(85,223,247,.35)', labelBackgroundColor: COLORS.cyan } }
      });
      let series;
      if (chart.addSeries && LightweightCharts.AreaSeries) series = chart.addSeries(LightweightCharts.AreaSeries, { lineColor: COLORS.cyan, topColor: 'rgba(85,223,247,.42)', bottomColor: 'rgba(85,223,247,.02)', lineWidth: 3 });
      else if (chart.addAreaSeries) series = chart.addAreaSeries({ lineColor: COLORS.cyan, topColor: 'rgba(85,223,247,.42)', bottomColor: 'rgba(85,223,247,.02)', lineWidth: 3 });
      else throw new Error('Area series unavailable');
      series.setData(data);
      chart.timeScale().fitContent();
      fxChartV3 = chart;
      fxResizeV3 = new ResizeObserver(entries => entries.forEach(entry => chart.applyOptions({ width: entry.contentRect.width, height: entry.contentRect.height })));
      fxResizeV3.observe(container);
    } catch (error) {
      console.warn('Lightweight Charts fallback:', error);
      renderFxFallback(container, item, data);
    }
  }

  function drawCostChart(items) {
    const canvas = document.getElementById('costChart');
    if (!canvas || canvas.tagName !== 'CANVAS') return;
    const rows = items.slice(0, 8);
    if (!rows.length || !window.Chart) return;
    if (costChartV3) costChartV3.destroy();
    const context = canvas.getContext('2d');
    const touristGradient = context.createLinearGradient(0, 0, 0, 320);
    touristGradient.addColorStop(0, 'rgba(85,223,247,.94)');
    touristGradient.addColorStop(1, 'rgba(85,223,247,.16)');
    const businessGradient = context.createLinearGradient(0, 0, 0, 320);
    businessGradient.addColorStop(0, 'rgba(228,197,106,.90)');
    businessGradient.addColorStop(1, 'rgba(228,197,106,.18)');
    costChartV3 = new Chart(context, {
      type: 'bar',
      data: { labels: rows.map(item => item.city), datasets: [
        { label: 'Turista', data: rows.map(item => item.moderate_total_7n_mxn), backgroundColor: touristGradient, borderColor: COLORS.cyan, borderWidth: 1, borderRadius: 7 },
        { label: 'Business', data: rows.map(item => item.business_total_7n_mxn), backgroundColor: businessGradient, borderColor: COLORS.gold, borderWidth: 1, borderRadius: 7 }
      ] },
      options: {
        responsive: true, maintainAspectRatio: false, animation: { duration: 700, easing: 'easeOutQuart' }, interaction: { mode: 'index', intersect: false },
        plugins: { legend: { labels: { color: '#9AA8BA', usePointStyle: true, boxWidth: 9 } }, tooltip: { backgroundColor: COLORS.bg, borderColor: '#33445C', borderWidth: 1, callbacks: { label: context => `${context.dataset.label}: ${mxn(context.raw)}` } } },
        scales: { x: { ticks: { color: COLORS.muted, maxRotation: 35, minRotation: 18 }, grid: { display: false } }, y: { ticks: { color: COLORS.muted, callback: value => `${Math.round(value / 1000)}k` }, grid: { color: 'rgba(130,144,165,.10)' } } }
      }
    });
  }

  function contextualNews(item) {
    if (Array.isArray(item.news) && item.news.length) return item.news;
    const advantage = Number(item.fx_advantage_pct) || 0;
    return [
      { id: `${item.id}-client-fx`, headline: advantage >= 5 ? `El USD conserva una ventaja estimada de ${decimal(advantage)}%` : advantage <= -3 ? `La moneda local cotiza ${decimal(Math.abs(advantage))}% más fuerte que la referencia` : `El tipo de cambio se mantiene en zona neutral (${advantage >= 0 ? '+' : ''}${decimal(advantage)}%)`, source: 'Viajes ASC FX Monitor', impact: advantage >= 10 ? 'high' : advantage >= 5 || advantage <= -3 ? 'medium' : 'low', category: 'Mercado cambiario', published_at: new Date().toISOString(), url: 'https://open.er-api.com/v6/latest/USD', summary: `Semáforo ${item.traffic_light}; volatilidad anualizada estimada ${decimal(item.volatility_annualized_pct)}%.` },
      { id: `${item.id}-client-risk`, headline: item.kind === 'cruise' ? 'Puertos, combustible y requisitos de escala son los riesgos principales' : 'Inflación local y regulación pueden modificar el costo real del viaje', source: 'Viajes ASC Risk Engine', impact: item.volatility_annualized_pct > 15 ? 'high' : 'medium', category: item.kind === 'cruise' ? 'Cruceros / Geopolítica' : 'Inflación / Regulación', published_at: new Date().toISOString(), url: item.google_travel?.google_hotels || '#', summary: 'La señal es contextual y debe verificarse con fuentes oficiales antes de reservar.' }
    ];
  }

  function relativeTime(value) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Contexto vigente';
    const delta = date.getTime() - Date.now(), absolute = Math.abs(delta);
    const formatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' });
    if (absolute < 86400000) return formatter.format(Math.round(delta / 3600000), 'hour');
    if (absolute < 2592000000) return formatter.format(Math.round(delta / 86400000), 'day');
    return new Intl.DateTimeFormat('es-MX', { dateStyle: 'medium' }).format(date);
  }

  function renderNews(items) {
    ensureNewsShell();
    const top = items.slice(0, 3);
    const collection = [];
    top.forEach(destination => contextualNews(destination).forEach(news => collection.push({ ...news, destination: destination.city })));
    const unique = [];
    const seen = new Set();
    collection.sort((a, b) => (impactRank[b.impact] || 0) - (impactRank[a.impact] || 0) || new Date(b.published_at) - new Date(a.published_at)).forEach(item => {
      const key = item.id || item.headline;
      if (!seen.has(key)) { seen.add(key); unique.push(item); }
    });
    const newsHost = document.getElementById('newsTerminalV3');
    newsHost.innerHTML = unique.slice(0, 8).map(item => `<article><div class="v3-news-meta"><span class="v3-impact ${html(item.impact)}">${html({ high: 'Alto', medium: 'Medio', low: 'Bajo' }[item.impact] || item.impact)}</span><span class="v3-destination">${html(item.destination)}</span><span class="v3-time">${relativeTime(item.published_at)}</span></div><a href="${html(item.url)}" target="_blank" rel="noopener">${html(item.headline)}</a><p>${html(item.summary)}</p><div class="v3-source">${html(item.source)} · ${html(item.category)}</div></article>`).join('');
    const high = unique.filter(item => item.impact === 'high').length;
    const medium = unique.filter(item => item.impact === 'medium').length;
    const green = top.filter(item => item.traffic_light === 'green').length;
    document.getElementById('riskRadarV3').innerHTML = `
      <div class="v3-risk-card"><div class="v3-risk-line"><span>Impacto alto</span><strong style="color:${COLORS.red}">${high}</strong></div><div class="v3-progress"><i style="width:${Math.min(100, high * 25)}%;background:linear-gradient(90deg,${COLORS.red},${COLORS.amber})"></i></div></div>
      <div class="v3-risk-card"><div class="v3-risk-line"><span>Impacto medio</span><strong style="color:${COLORS.amber}">${medium}</strong></div><div class="v3-progress"><i style="width:${Math.min(100, medium * 18)}%;background:linear-gradient(90deg,${COLORS.amber},${COLORS.gold})"></i></div></div>
      <div class="v3-risk-card"><div class="v3-risk-line"><span>Destinos verdes Top 3</span><strong style="color:${COLORS.green}">${green}/3</strong></div><div class="v3-progress"><i style="width:${green / 3 * 100}%;background:linear-gradient(90deg,${COLORS.green},${COLORS.cyan})"></i></div></div>`;
  }

  function bindRecommendationSelection(items) {
    const top = items.slice(0, 3);
    if (!top.length) return;
    if (!top.some(item => item.id === selectedDestinationId)) selectedDestinationId = top[0].id;
    const cards = [...document.querySelectorAll('#recommendations > *')];
    cards.forEach((card, index) => {
      const destination = top[index];
      if (!destination) return;
      card.classList.toggle('v3-card-selected', destination.id === selectedDestinationId);
      card.addEventListener('click', event => {
        if (event.target.closest('a')) return;
        selectedDestinationId = destination.id;
        bindRecommendationSelection(top);
        drawFxChart(destination);
      }, { once: true });
    });
    drawFxChart(top.find(item => item.id === selectedDestinationId) || top[0]);
  }

  function enhance(items) {
    const top = items.slice(0, 3);
    drawCostChart(items);
    bindRecommendationSelection(items);
    renderNews(top);
  }

  injectVisualLayer();
  ensureNewsShell();

  if (typeof renderCostChart === 'function') {
    const previousCost = renderCostChart;
    renderCostChart = function upgradedCost(items) {
      try { drawCostChart(items); } catch (error) { console.warn('Cost chart upgrade failed:', error); previousCost(items); }
    };
  }
  if (typeof renderFxChart === 'function') {
    renderFxChart = function upgradedFx(items) {
      const top = items.slice(0, 3);
      if (!top.length) return;
      if (!top.some(item => item.id === selectedDestinationId)) selectedDestinationId = top[0].id;
      drawFxChart(top.find(item => item.id === selectedDestinationId) || top[0]);
    };
  }
  if (typeof renderRecommendations === 'function') {
    const previousRecommendations = renderRecommendations;
    renderRecommendations = function upgradedRecommendations(items) {
      const result = previousRecommendations(items);
      queueMicrotask(() => { bindRecommendationSelection(items); renderNews(items.slice(0, 3)); });
      return result;
    };
  }

  const scheduleEnhance = () => {
    try {
      if (typeof filteredItems === 'function') enhance(filteredItems());
      else if (typeof state !== 'undefined' && Array.isArray(state.data?.destinations)) enhance(state.data.destinations);
    } catch (error) { console.warn('Viajes ASC visual enhancement:', error); }
  };
  document.getElementById('queryForm')?.addEventListener('change', () => setTimeout(scheduleEnhance, 0));
  document.getElementById('queryForm')?.addEventListener('submit', () => setTimeout(scheduleEnhance, 0));
  document.getElementById('refreshButton')?.addEventListener('click', () => setTimeout(scheduleEnhance, 500));
  window.addEventListener('load', () => setTimeout(scheduleEnhance, 150));
  setTimeout(scheduleEnhance, 250);
})();