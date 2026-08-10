import { buildDecision, rankRadar, DEFAULT_WEIGHTS } from './decision-engine-core.js';

const API_URL = 'https://agci-equity-fundamentals.proadmexico.workers.dev';
const STORAGE_KEY = 'agci:decision-engine:list:v1';
const HISTORY_KEY = 'agci:decision-engine:history:v1';
const COMPARATOR_KEY = 'agci:equity-comparator:v1';
const DEFAULTS = ['MSFT', 'GOOGL', 'AMZN', 'JPM', 'V', 'LLY', 'ISRG', 'GE', 'COST', 'XOM'];
const MAX_SYMBOLS = 10;
let latestPayload = null;
let decisions = [];
let selectedTicker = null;
let hasLoaded = false;

const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const money = value => finite(value) ? `$${Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : 'N/D';
const pct = (value, digits = 1) => finite(value) ? `${Number(value).toFixed(digits)}%` : 'N/D';
const ratioPct = value => finite(value) ? `${(Number(value) * 100).toFixed(1)}%` : 'N/D';
const num = (value, digits = 0) => finite(value) ? Number(value).toFixed(digits) : 'N/D';

function normalize(input) {
  const values = Array.isArray(input) ? input : String(input || '').split(/[\s,;]+/);
  return [...new Set(values.map(value => String(value).trim().toUpperCase()).filter(value => /^[A-Z][A-Z0-9.-]{0,9}$/.test(value)))].slice(0, MAX_SYMBOLS);
}

function loadSymbols() {
  try {
    const own = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
    const comparator = JSON.parse(localStorage.getItem(COMPARATOR_KEY) || 'null');
    return normalize(Array.isArray(own) && own.length ? own : Array.isArray(comparator) && comparator.length ? comparator : DEFAULTS);
  } catch {
    return [...DEFAULTS];
  }
}

function saveSymbols(symbols) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(normalize(symbols)));
}

function buildShell() {
  const root = $('decisionEngineRoot');
  if (!root || root.dataset.ready === '1') return;
  root.dataset.ready = '1';
  root.innerHTML = `
    <div class="de-hero">
      <div>
        <p class="rubric">AGCI DECISION ENGINE · AFILAR EL HACHA</p>
        <h2>Motor de Decisión</h2>
        <p class="de-subtitle">Preparar → Valorar → Esperar → Comprar → Revisar</p>
        <p class="de-intro">El objetivo no es predecir el siguiente movimiento. Es saber qué estamos pagando, por qué actuar y dónde comienza el terreno de compra.</p>
      </div>
      <div class="de-philosophy"><span>PRINCIPIO</span><strong>La batalla se gana en la preparación.</strong><small>La preparación debe terminar en una decisión verificable.</small></div>
    </div>

    <section class="de-control-card">
      <div class="de-control-head"><div><span>01</span><div><h3>Universo de decisión</h3><p>Hasta 10 acciones. Reutiliza la lista del Comparador Fundamental cuando existe.</p></div></div><b id="deCount">0/10</b></div>
      <div class="de-input-row">
        <textarea id="deSymbols" rows="2" aria-label="Tickers para el motor de decisión" placeholder="MSFT, GOOGL, AMZN"></textarea>
        <button id="deAnalyze" type="button" class="de-primary">Preparar decisión</button>
      </div>
      <div class="de-actions"><button id="deSyncComparator" type="button">Usar lista del comparador</button><button id="deRestore" type="button">Restaurar ejemplo</button><span id="deStatus" role="status" aria-live="polite"></span></div>
    </section>

    <div id="deFreshness" class="de-freshness" hidden></div>
    <div id="deLoading" class="de-loading" hidden><span></span><div><strong>Afilar el hacha</strong><small>Validando fundamentales, comparables, precio, valoración y suficiencia de datos.</small></div></div>
    <div id="deOutput">
      <section class="de-empty"><strong>El motor está listo.</strong><p>Abra esta pestaña o pulse “Preparar decisión”. No se mostrarán precios objetivo si los datos verificables son insuficientes.</p></section>
    </div>`;

  const symbols = loadSymbols();
  $('deSymbols').value = symbols.join(', ');
  updateCount();
  $('deSymbols').addEventListener('input', updateCount);
  $('deAnalyze').addEventListener('click', analyze);
  $('deRestore').addEventListener('click', () => { $('deSymbols').value = DEFAULTS.join(', '); saveSymbols(DEFAULTS); updateCount(); analyze(); });
  $('deSyncComparator').addEventListener('click', () => {
    try {
      const list = normalize(JSON.parse(localStorage.getItem(COMPARATOR_KEY) || '[]'));
      if (!list.length) return setStatus('El comparador no tiene una lista guardada.', true);
      $('deSymbols').value = list.join(', ');
      saveSymbols(list);
      updateCount();
      analyze();
    } catch {
      setStatus('No fue posible leer la lista del comparador.', true);
    }
  });
}

function updateCount() {
  const list = normalize($('deSymbols')?.value || '');
  if ($('deCount')) $('deCount').textContent = `${list.length}/${MAX_SYMBOLS}`;
}

function setStatus(text, error = false) {
  const target = $('deStatus');
  if (!target) return;
  target.textContent = text;
  target.classList.toggle('error', error);
}

async function analyze() {
  const symbols = normalize($('deSymbols')?.value || '');
  if (!symbols.length) return setStatus('Ingrese al menos un ticker válido.', true);
  $('deSymbols').value = symbols.join(', ');
  saveSymbols(symbols);
  updateCount();
  $('deLoading').hidden = false;
  $('deAnalyze').disabled = true;
  setStatus('Preparando decisión…');
  try {
    const response = await fetch(`${API_URL}/compare?symbols=${encodeURIComponent(symbols.join(','))}`, { cache: 'no-store' });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
    if (!Array.isArray(payload.analyses)) throw new Error('Contrato de fundamentales inválido.');
    latestPayload = payload;
    decisions = rankRadar(payload.analyses, DEFAULT_WEIGHTS);
    if (!decisions.length) throw new Error('No existe cobertura suficiente para los símbolos solicitados.');
    selectedTicker = decisions.find(item => item.ticker === selectedTicker)?.ticker || decisions[0].ticker;
    renderFreshness(payload);
    renderAll(payload);
    rememberSnapshot(decisions);
    hasLoaded = true;
    setStatus(`${decisions.length} decisiones preparadas · ${payload.dataQuality || 'calidad no clasificada'}.`);
  } catch (error) {
    $('deOutput').innerHTML = `<section class="de-error"><strong>No fue posible preparar la decisión.</strong><p>${esc(error.message || 'Error desconocido')}</p><p>La lista permanece guardada. El motor no sustituirá datos faltantes con estimaciones inventadas.</p></section>`;
    setStatus('Error de conexión o cobertura.', true);
  } finally {
    $('deLoading').hidden = true;
    $('deAnalyze').disabled = false;
  }
}

function renderFreshness(payload) {
  const bar = $('deFreshness');
  bar.hidden = false;
  const stale = Boolean(payload.isStale);
  bar.className = `de-freshness ${stale ? 'stale' : 'fresh'}`;
  const date = payload.lastSuccessfulUpdate ? new Date(payload.lastSuccessfulUpdate).toLocaleString('es-MX') : 'N/D';
  bar.innerHTML = `<span></span><strong>${stale ? 'Datos en caché · confirmar antes de ejecutar' : 'Datos fundamentales disponibles'}</strong><small>Última actualización exitosa: ${esc(date)}</small>`;
}

function renderAll(payload) {
  const selected = decisions.find(item => item.ticker === selectedTicker) || decisions[0];
  const errors = [...(payload.invalidSymbols || []).map(ticker => ({ ticker, error: 'Símbolo no registrado por SEC' })), ...(payload.errors || [])];
  $('deOutput').innerHTML = `
    ${renderRadar(decisions)}
    <section id="deDecisionDetail" class="de-detail">${renderDecision(selected)}</section>
    <section class="de-governance">
      <div><strong>Metodología activa</strong><span>Calidad 20% · Valoración 20% · Crecimiento 15% · Rentabilidad 15% · Balance 10% · Momentum 5% · Riesgo 15%</span></div>
      <div><strong>Fair Value AGCI</strong><span>Mediana robusta de anclas comparables disponibles (P/E, P/S, EV/EBITDA y FCF Yield). No utiliza forecasts no disponibles.</span></div>
      <div><strong>Gobernanza</strong><span>SEC EDGAR + cotización Twelve Data mediante el servicio AGCI. N/D cuando falta evidencia verificable.</span></div>
      ${errors.length ? `<div class="de-source-errors"><strong>Cobertura incompleta</strong><span>${errors.map(item => `${esc(item.ticker)}: ${esc(item.error)}`).join(' · ')}</span></div>` : ''}
    </section>`;

  document.querySelectorAll('[data-de-select]').forEach(button => button.addEventListener('click', () => {
    selectedTicker = button.dataset.deSelect;
    document.querySelectorAll('[data-de-select]').forEach(item => item.classList.toggle('active', item.dataset.deSelect === selectedTicker));
    const chosen = decisions.find(item => item.ticker === selectedTicker);
    $('deDecisionDetail').innerHTML = renderDecision(chosen);
    $('deDecisionDetail').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }));
}

function renderRadar(items) {
  const ready = items.filter(item => ['ALTA CONVICCIÓN', 'COMPRA ATRACTIVA', 'COMPRA'].includes(item.label)).length;
  const near = items.filter(item => finite(item.distanceToBuyPct) && item.distanceToBuyPct < 0 && item.distanceToBuyPct >= -10).length;
  return `<section class="de-radar">
    <div class="de-section-head"><div><span>02</span><div><h3>Radar de Terreno de Compra</h3><p>Ordenado por oportunidad ejecutable y proximidad al precio de compra.</p></div></div><div class="de-radar-kpis"><b>${ready}<small>en compra</small></b><b>${near}<small>a ≤10%</small></b></div></div>
    <div class="de-radar-grid">${items.map((item, index) => renderRadarCard(item, index)).join('')}</div>
    <div class="de-table-wrap"><table><thead><tr><th>Rank</th><th>Ticker</th><th>Precio</th><th>Fair Value</th><th>Compra desde</th><th>Distancia</th><th>Decision</th><th>Prep.</th><th>Estado</th></tr></thead><tbody>${items.map((item, index) => `<tr><td>${index + 1}</td><td><button class="de-ticker-link" data-de-select="${esc(item.ticker)}">${esc(item.ticker)}</button></td><td>${money(item.terrain.price)}</td><td>${money(item.terrain.fairValue)}</td><td>${money(item.terrain.buy)}</td><td class="${Number(item.distanceToBuyPct) >= 0 ? 'positive' : 'negative'}">${pct(item.distanceToBuyPct)}</td><td>${item.decisionScore}</td><td>${item.preparationScore}</td><td><span class="de-zone ${zoneClass(item.label)}">${esc(item.label)}</span></td></tr>`).join('')}</tbody></table></div>
  </section>`;
}

function renderRadarCard(item, index) {
  return `<button type="button" data-de-select="${esc(item.ticker)}" class="de-radar-card ${item.ticker === selectedTicker ? 'active' : ''}">
    <span class="de-rank">#${index + 1}</span><strong>${esc(item.ticker)}</strong><small>${esc(item.companyName)}</small>
    <b class="de-mini-score">${item.decisionScore}</b><span class="de-zone ${zoneClass(item.label)}">${esc(item.label)}</span>
    <em>${finite(item.distanceToBuyPct) ? (item.distanceToBuyPct >= 0 ? `${pct(item.distanceToBuyPct)} dentro del terreno` : `${pct(Math.abs(item.distanceToBuyPct))} hasta compra`) : 'Terreno N/D'}</em>
  </button>`;
}

function renderDecision(d) {
  if (!d) return '<section class="de-error">Decisión no disponible.</section>';
  const a = d.sourceAnalysis;
  const c = a.company || {};
  const r = c.ratios || {};
  const g = c.growth || {};
  const t = d.terrain;
  return `
    <div class="de-section-head"><div><span>03</span><div><p class="rubric">TESIS DE DECISIÓN</p><h3>${esc(d.ticker)} · ${esc(d.companyName)}</h3><p>${esc(a.classification || 'Clasificación fundamental no disponible')}</p></div></div><span class="de-zone de-zone-large ${zoneClass(d.label)}">${esc(d.label)}</span></div>

    <div class="de-scoreboard">
      <article><span>Precio actual</span><strong>${money(t.price)}</strong><small>${esc(c.currency || 'USD')}</small></article>
      <article><span>Fair Value AGCI</span><strong>${money(t.fairValue)}</strong><small>${t.anchors?.length || 0} anclas verificables</small></article>
      <article><span>Decision Score</span><strong>${d.decisionScore}<em>/100</em></strong><small>Calidad + precio + riesgo</small></article>
      <article><span>Preparation Score</span><strong>${d.preparationScore}<em>/100</em></strong><small>Suficiencia de evidencia</small></article>
      <article><span>Compra desde</span><strong>${money(t.buy)}</strong><small>MOS requerido ${ratioPct(t.marginOfSafetyRequired)}</small></article>
      <article><span>Distancia a compra</span><strong class="${Number(d.distanceToBuyPct) >= 0 ? 'positive' : 'negative'}">${pct(d.distanceToBuyPct)}</strong><small>${Number(d.distanceToBuyPct) >= 0 ? 'Precio dentro del terreno' : 'Corrección aproximada requerida'}</small></article>
    </div>

    ${renderTerrain(d)}

    <div class="de-two-col">
      <section class="de-why"><div class="de-block-title"><span>04</span><h3>¿Por qué esta decisión?</h3></div><div class="de-reason-columns"><div><h4>Tesis positiva</h4>${list(d.reasons.positives, 'No existe todavía una fortaleza cuantitativa dominante.')}</div><div><h4>Problemas / frenos</h4>${list(d.reasons.concerns, 'No se detectó un freno cuantitativo dominante; revisar riesgos cualitativos.')}</div></div><p class="de-conclusion">${esc(buildConclusion(d))}</p></section>
      <section class="de-position"><div class="de-block-title"><span>05</span><h3>Ejecución disciplinada</h3></div><div class="de-position-size"><span>Position size indicativo</span><strong>${esc(d.positionSizing)}</strong></div><h4>Qué me haría comprar / aumentar</h4>${list(d.whatMakesBuy)}<h4>Qué rompería la tesis</h4>${list(d.invalidates)}</section>
    </div>

    <section class="de-pillars"><div class="de-block-title"><span>06</span><h3>Los 7 pilares de preparación</h3></div><div class="de-pillar-grid">${Object.entries({ Calidad: d.components.quality, Valoración: d.components.valuation, Crecimiento: d.components.growth, Rentabilidad: d.components.profitability, Balance: d.components.balance, Momentum: d.components.momentum, 'Control de riesgo': d.components.risk }).map(([label, value]) => `<article><div><span>${esc(label)}</span><strong>${num(value)}</strong></div><i><b style="width:${Math.max(0, Math.min(100, Number(value || 0)))}%"></b></i></article>`).join('')}</div></section>

    <div class="de-two-col de-evidence-grid">
      <section><div class="de-block-title"><span>07</span><h3>¿Qué estamos pagando?</h3></div><dl class="de-metrics"><div><dt>P/E TTM</dt><dd>${num(r.peTTM, 1)}</dd></div><div><dt>EV/EBITDA</dt><dd>${num(r.evEbitda, 1)}</dd></div><div><dt>FCF Yield</dt><dd>${ratioPct(r.fcfYield)}</dd></div><div><dt>ROIC</dt><dd>${ratioPct(r.roic)}</dd></div><div><dt>Margen operativo</dt><dd>${ratioPct(r.operatingMargin)}</dd></div><div><dt>Ingresos YoY</dt><dd>${ratioPct(g.revenueYoY)}</dd></div><div><dt>Deuda neta/EBITDA</dt><dd>${num(r.netDebtToEbitda, 1)}</dd></div><div><dt>Cobertura de datos</dt><dd>${num(c.dataCoverage)}%</dd></div></dl></section>
      <section><div class="de-block-title"><span>08</span><h3>Anclas de Fair Value</h3></div>${t.anchors?.length ? `<div class="de-anchor-list">${t.anchors.map(anchor => `<div><span>${esc(anchor.label)}</span><strong>${money(anchor.value)}</strong></div>`).join('')}</div><p class="de-method-note">El Fair Value es la mediana de las anclas disponibles para reducir el efecto de un múltiplo extremo.</p>` : '<p class="de-method-note">No existen suficientes anclas comparables verificables. El motor no fabrica un precio objetivo.</p>'}${a.preferredComparable ? `<div class="de-best-alt"><span>Mejor comparable relativo disponible</span><strong>${esc(a.preferredComparable.ticker)} · Score ${num(a.preferredComparable.score)}</strong></div>` : ''}</section>
    </div>`;
}

function renderTerrain(d) {
  const t = d.terrain;
  if (!finite(t.fairValue) || !finite(t.price)) return `<section class="de-terrain de-terrain-empty"><div class="de-block-title"><span>TERRENO</span><h3>Terreno de Compra AGCI</h3></div><p>Información insuficiente para calcular rangos de precio responsables.</p></section>`;
  const min = Math.max(0.01, Number(t.highConviction) * 0.85);
  const max = Number(t.waitCeiling) * 1.18;
  const position = Math.max(0, Math.min(100, ((Number(t.price) - min) / (max - min)) * 100));
  return `<section class="de-terrain">
    <div class="de-block-title"><span>TERRENO</span><div><h3>Terreno de Compra AGCI</h3><p>Dónde está el precio actual respecto al valor económico y al margen de seguridad requerido.</p></div></div>
    <div class="de-terrain-wrap">
      <div class="de-terrain-track"><div class="de-terrain-marker" style="left:${position}%"><b>${money(t.price)}</b><i></i></div></div>
      <div class="de-terrain-zones"><div><b>Alta convicción</b><span>≤ ${money(t.highConviction)}</span></div><div><b>Compra atractiva</b><span>≤ ${money(t.attractive)}</span></div><div><b>Compra</b><span>≤ ${money(t.buy)}</span></div><div><b>Observación</b><span>≤ ${money(t.fairValue)}</span></div><div><b>Espera</b><span>≤ ${money(t.waitCeiling)}</span></div><div><b>Sobrevaloración</b><span>&gt; ${money(t.waitCeiling)}</span></div></div>
    </div>
  </section>`;
}

function buildConclusion(d) {
  const t = d.terrain;
  if (!finite(t.fairValue)) return 'La evidencia actual no permite construir un Fair Value defendible. La decisión correcta es seguir preparando, no forzar una compra.';
  if (['COMPRA', 'COMPRA ATRACTIVA', 'ALTA CONVICCIÓN'].includes(d.label)) return `${d.companyName} se encuentra dentro del terreno de compra calculado con comparables disponibles. La ejecución sigue condicionada a que la tesis fundamental permanezca intacta y al tamaño de posición indicado.`;
  if (finite(d.distanceToBuyPct) && d.distanceToBuyPct < 0) return `${d.companyName} no está todavía en terreno de compra. Una corrección aproximada de ${Math.abs(d.distanceToBuyPct).toFixed(1)}% llevaría el precio al umbral de compra, siempre que los fundamentales no se deterioren.`;
  return `${d.companyName} requiere más evidencia o una mejor relación precio/calidad antes de comprometer capital.`;
}

function list(items = [], fallback = '') {
  const values = items.length ? items : fallback ? [fallback] : [];
  return `<ul>${values.map(item => `<li>${esc(item)}</li>`).join('')}</ul>`;
}

function zoneClass(label) {
  return String(label || '').toLowerCase().replace(/[^a-z0-9áéíóúñ]+/g, '-').replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i').replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n');
}

function rememberSnapshot(items) {
  try {
    const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    const stamp = new Date().toISOString();
    const snapshots = items.map(item => ({ ticker: item.ticker, at: stamp, price: item.terrain.price, fairValue: item.terrain.fairValue, buy: item.terrain.buy, decisionScore: item.decisionScore, preparationScore: item.preparationScore, label: item.label }));
    localStorage.setItem(HISTORY_KEY, JSON.stringify([...snapshots, ...history].slice(0, 120)));
  } catch {
    // History is best-effort and must never block the decision engine.
  }
}

function init() {
  buildShell();
  const navButton = document.querySelector('[data-view="decisionEngine"]');
  navButton?.addEventListener('click', () => {
    if (!hasLoaded) analyze();
  });
  if (location.hash === '#decisionEngine') {
    setTimeout(() => {
      if (typeof window.setView === 'function') window.setView('decisionEngine');
      analyze();
    }, 0);
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
