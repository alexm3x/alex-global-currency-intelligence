import { matrixSignal, stockOpportunityScore } from './greed-valuation-core.js';

const MARKET_URL = './data/greed-valuation-latest.json';
const STOCK_URL = './data/stock-greed-valuation.json';
let marketData = null;
let stockData = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const score = value => finite(value) ? Math.round(Number(value)) : 'N/D';
const delta = value => finite(value) ? `${Number(value) > 0 ? '+' : ''}${Number(value).toFixed(0)}` : 'N/D';

async function loadJson(url) {
  const response = await fetch(`${url}?v=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function bandClass(value, kind) {
  if (!finite(value)) return 'unavailable';
  const v = Number(value);
  if (kind === 'greed') {
    if (v <= 20) return 'fear-extreme';
    if (v <= 40) return 'fear';
    if (v <= 59) return 'neutral';
    if (v <= 79) return 'greed';
    return 'greed-extreme';
  }
  if (v <= 20) return 'cheap-deep';
  if (v <= 40) return 'cheap';
  if (v <= 60) return 'neutral';
  if (v <= 80) return 'expensive';
  return 'expensive-extreme';
}

function renderHomeCard() {
  const host = document.getElementById('agciGreedValuationHome');
  if (!host) return;
  const m = marketData?.market || {};
  const condition = m.condition || matrixSignal(m.greed, m.valuation);
  host.innerHTML = `
    <button type="button" class="gv-home-card" data-jump="greedValuation" aria-label="Abrir Greed + Valuation Dashboard">
      <div><p class="rubric">MARKET PSYCHOLOGY × VALUE</p><h3>Greed + Valuation</h3></div>
      <div class="gv-home-kpis">
        <span><small>GREED</small><strong>${score(m.greed)}</strong></span>
        <span><small>VALUATION</small><strong>${score(m.valuation)}</strong></span>
        <span><small>REGIME</small><strong class="gv-text">${esc(m.regime || 'N/D')}</strong></span>
        <span><small>OPPORTUNITY</small><strong>${score(m.opportunity)}</strong></span>
      </div>
      <p>${esc(condition.label || 'Insufficient data')}</p>
    </button>`;
  host.querySelector('[data-jump]').addEventListener('click', () => activateView('greedValuation'));
}

function renderDashboard() {
  const root = document.getElementById('greedValuationRoot');
  if (!root) return;
  const m = marketData?.market || {};
  const history = marketData?.changes || {};
  const components = marketData?.components || {};
  const condition = m.condition || matrixSignal(m.greed, m.valuation);
  const sourceRows = (marketData?.sources || []).map(s => `<tr><td>${esc(s.name)}</td><td>${esc(s.frequency || 'N/D')}</td><td>${esc(s.asOf || 'N/D')}</td><td>${esc(s.status || 'N/D')}</td></tr>`).join('');
  const componentRows = Object.entries(components).map(([key, item]) => `<tr><td>${esc(item.label || key)}</td><td>${score(item.normalized_score)}</td><td>${esc(item.value ?? 'N/D')}</td><td>${esc(item.freshness || 'N/D')}</td><td>${score(item.confidence)}</td></tr>`).join('');

  root.innerHTML = `
    <div class="gv-hero">
      <div><p class="rubric">AGCI PROPRIETARY INTELLIGENCE</p><h2>Greed + Valuation</h2><p>Market Psychology × Fundamental Value</p></div>
      <div class="gv-meta"><span>Methodology ${esc(marketData?.methodology_version || 'N/D')}</span><span>Updated ${esc(marketData?.timestamp || 'N/D')}</span></div>
    </div>
    <section class="gv-score-grid">
      <article class="gv-score ${bandClass(m.greed,'greed')}"><span>AGCI GREED LEVEL</span><strong>${score(m.greed)}<em>/100</em></strong><b>${esc(m.greed_label || 'Unavailable')}</b><small>1D ${delta(history.greed_1d)} · 7D ${delta(history.greed_7d)} · 30D ${delta(history.greed_30d)}</small></article>
      <article class="gv-score ${bandClass(m.valuation,'valuation')}"><span>AGCI VALUATION LEVEL</span><strong>${score(m.valuation)}<em>/100</em></strong><b>${esc(m.valuation_label || 'Unavailable')}</b><small>1D ${delta(history.valuation_1d)} · 7D ${delta(history.valuation_7d)} · 30D ${delta(history.valuation_30d)}</small></article>
      <article class="gv-condition"><span>AGCI MARKET CONDITION</span><strong>${esc(condition.label || 'Insufficient data')}</strong><p>${esc(m.interpretation || 'El sistema no emitirá una lectura concluyente hasta alcanzar cobertura mínima de datos.')}</p></article>
      <article class="gv-regime"><span>MARKET REGIME</span><strong>${esc(m.regime || 'N/D')}</strong><small>Confidence ${score(m.confidence)}/100</small><small>Opportunity ${score(m.opportunity)}/100</small></article>
    </section>
    <section class="gv-matrix-card"><div><p class="rubric">DECISION MAP</p><h3>Greed × Valuation Matrix</h3></div><div class="gv-matrix" id="gvMatrix"></div></section>
    <section class="gv-two-col">
      <article><p class="rubric">EXPLAINABILITY</p><h3>Why this score?</h3><div class="gv-table-wrap"><table><thead><tr><th>Component</th><th>Score</th><th>Raw</th><th>Freshness</th><th>Confidence</th></tr></thead><tbody>${componentRows || '<tr><td colspan="5">No hay componentes verificables suficientes.</td></tr>'}</tbody></table></div></article>
      <article><p class="rubric">DATA GOVERNANCE</p><h3>Sources & freshness</h3><div class="gv-table-wrap"><table><thead><tr><th>Source</th><th>Frequency</th><th>As of</th><th>Status</th></tr></thead><tbody>${sourceRows || '<tr><td colspan="4">Fuentes aún no cargadas.</td></tr>'}</tbody></table></div></article>
    </section>
    <section class="gv-signals"><p class="rubric">DIVERGENCES & ALERTS</p><h3>Signals</h3><div>${(marketData?.signals || []).map(s => `<span class="gv-pill ${esc(s.severity || '')}">${esc(s.code || s.label || '')}</span>`).join('') || '<span class="gv-pill">Sin señal material nueva</span>'}</div></section>`;
  renderMatrix(m.greed, m.valuation);
}

function renderMatrix(greed, valuation) {
  const host = document.getElementById('gvMatrix');
  if (!host) return;
  const labels = ['Extreme Fear','Fear','Neutral','Greed','Extreme Greed'];
  const vals = ['Deep Value','Attractive','Fair','Expensive','Extreme'];
  const gIndex = finite(greed) ? Math.min(4, Math.floor(Number(greed) / 20)) : -1;
  const vIndex = finite(valuation) ? Math.min(4, Math.floor(Number(valuation) / 20)) : -1;
  host.innerHTML = `<div class="gv-axis-title">VALUATION →</div>${labels.slice().reverse().map((g, row) => {
    const actualG = 4 - row;
    return `<div class="gv-row-label">${g}</div>${vals.map((v,col) => `<div class="gv-cell ${actualG===gIndex && col===vIndex ? 'active':''}" title="${g} × ${v}">${actualG===gIndex && col===vIndex ? '●':''}</div>`).join('')}`;
  }).join('')}<div></div>${vals.map(v => `<div class="gv-col-label">${v}</div>`).join('')}`;
}

function activateView(id) {
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.id === id));
  document.querySelectorAll('.main-nav [data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === id));
  window.scrollTo({top:0,behavior:'smooth'});
}

function bindNav() {
  const button = document.querySelector('.main-nav [data-view="greedValuation"]');
  if (button && !button.dataset.gvBound) {
    button.dataset.gvBound = '1';
    button.addEventListener('click', () => activateView('greedValuation'));
  }
}

function getStockRecord(ticker) {
  const rows = stockData?.stocks || [];
  return rows.find(row => String(row.ticker).toUpperCase() === String(ticker).toUpperCase()) || null;
}

function injectDecisionOverlay() {
  document.querySelectorAll('.de-detail').forEach(detail => {
    if (detail.querySelector('.gv-decision-overlay')) return;
    const heading = detail.querySelector('h3')?.textContent || '';
    const ticker = heading.split('·')[0].trim().toUpperCase();
    if (!ticker) return;
    const row = getStockRecord(ticker);
    const overlay = document.createElement('section');
    overlay.className = 'gv-decision-overlay';
    if (!row) {
      overlay.innerHTML = `<div><p class="rubric">PSYCHOLOGY & VALUE</p><h3>${esc(ticker)}</h3></div><p>Greed/Valuation individual: <strong>N/D</strong>. No se inferirá un score sin cobertura verificable.</p>`;
    } else {
      const opportunity = stockOpportunityScore(row).score ?? row.opportunity;
      overlay.innerHTML = `<div><p class="rubric">PSYCHOLOGY & VALUE</p><h3>${esc(ticker)}</h3></div><div class="gv-stock-kpis"><span>GREED <b>${score(row.greed)}</b></span><span>VALUATION <b>${score(row.valuation)}</b></span><span>QUALITY <b>${score(row.quality)}</b></span><span>OPPORTUNITY <b>${score(opportunity)}</b></span></div><p>${esc(row.interpretation || 'Sin interpretación disponible.')}</p>`;
    }
    const scoreboard = detail.querySelector('.de-scoreboard');
    if (scoreboard) scoreboard.insertAdjacentElement('afterend', overlay); else detail.prepend(overlay);
  });
}

async function boot() {
  bindNav();
  try { marketData = await loadJson(MARKET_URL); } catch (e) { marketData = { market: { interpretation: e.message } }; }
  try { stockData = await loadJson(STOCK_URL); } catch { stockData = { stocks: [] }; }
  renderHomeCard();
  renderDashboard();
  injectDecisionOverlay();
  new MutationObserver(injectDecisionOverlay).observe(document.body, { childList: true, subtree: true });
}

document.readyState === 'loading' ? document.addEventListener('DOMContentLoaded', boot) : boot();
