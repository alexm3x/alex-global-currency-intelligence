import { buildContextOverlay } from './decision-evidence-core.js';

const VERSION = '20260810-phase3';
const DATA_URLS = Object.freeze({
  ciar: `data/ciar-latest.json?v=${VERSION}`,
  briefing: `data/daily-briefing-latest.json?v=${VERSION}`,
  macro: `data/macro-latest.json?v=${VERSION}`
});

let sources = null;
let loadingPromise = null;
let observer = null;
let renderTimer = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const pct = value => finite(value) ? `${Number(value).toFixed(1)}%` : 'N/D';
const num = (value, digits = 1) => finite(value) ? Number(value).toFixed(digits) : 'N/D';
const dateLabel = value => {
  if (!value) return 'N/D';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? esc(value) : date.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
};

function ensureStyle() {
  if (document.querySelector('link[data-de-evidence-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `decision-evidence.css?v=${VERSION}`;
  link.dataset.deEvidenceStyle = 'true';
  document.head.appendChild(link);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

function loadSources() {
  if (sources) return Promise.resolve(sources);
  if (loadingPromise) return loadingPromise;
  loadingPromise = Promise.allSettled([
    fetchJson(DATA_URLS.ciar),
    fetchJson(DATA_URLS.briefing),
    fetchJson(DATA_URLS.macro)
  ]).then(results => {
    sources = {
      ciar: results[0].status === 'fulfilled' ? results[0].value : null,
      briefing: results[1].status === 'fulfilled' ? results[1].value : null,
      macro: results[2].status === 'fulfilled' ? results[2].value : null,
      errors: results.map((result, index) => result.status === 'rejected' ? ['CIAR', 'Daily Briefing', 'Macro'][index] : null).filter(Boolean)
    };
    return sources;
  }).finally(() => { loadingPromise = null; });
  return loadingPromise;
}

function selectedTicker() {
  const active = document.querySelector('#decisionEngine [data-de-select].active');
  if (active?.dataset.deSelect) return active.dataset.deSelect;
  const heading = document.querySelector('#deDecisionDetail .de-section-head h3');
  const match = String(heading?.textContent || '').match(/^\s*([A-Z][A-Z0-9.-]{0,9})\b/);
  return match?.[1] || null;
}

function tone(label) {
  return ({ 'Soporte fuerte': 'support-strong', 'Soporte': 'support', 'Mixto': 'mixed', 'Cautela': 'caution', 'Cautela alta': 'caution-high' })[label] || 'unknown';
}

function signalDelta(value) {
  if (!finite(value)) return 'Cambio N/D';
  const n = Number(value);
  return `${n > 0 ? '+' : ''}${n} cambio neto`;
}

function analystCard(item) {
  if (!item) return `<article class="dee-card unavailable"><div class="dee-card-head"><span>CIAR · IBKR</span><b>N/D</b></div><p>Este ticker no tiene lectura consolidada disponible en el snapshot actual.</p><small>La ausencia de cobertura no se convierte en señal neutral.</small></article>`;
  return `<article class="dee-card ${item.stale ? 'stale' : ''}">
    <div class="dee-card-head"><span>CIAR · IBKR / Reuters</span><b>${esc(item.signal)}</b></div>
    <div class="dee-metrics"><strong>${pct(item.bullishPct)}<small>alcista</small></strong><strong>${num(item.consensusScore,2)}<small>consenso /5</small></strong><strong>${item.totalAnalysts ?? 'N/D'}<small>analistas</small></strong></div>
    <p>${signalDelta(item.netChange)} · lectura ${dateLabel(item.asOf)}${item.stale ? ' · FUERA DE VENTANA 45D' : ''}.</p>
    ${item.proxyNote ? `<small class="dee-proxy">${esc(item.proxyNote)}</small>` : '<small>Evidencia agregada; no representa posición ni orden de IBKR.</small>'}
  </article>`;
}

function briefingCard(item, briefing) {
  if (!item) return `<article class="dee-card unavailable"><div class="dee-card-head"><span>DAILY STRATEGIC BRIEFING</span><b>N/D</b></div><p>No existe una tesis específica para este ticker en el briefing vigente.</p><small>Contexto global disponible sin inventar una recomendación individual.</small></article>`;
  return `<article class="dee-card">
    <div class="dee-card-head"><span>DAILY STRATEGIC BRIEFING</span><b>${esc(item.classification)}</b></div>
    <p>${esc(item.thesis || 'Sin tesis específica publicada.')}</p>
    <div class="dee-inline"><span>Confianza: <strong>${esc(item.confidence || 'N/D')}</strong></span><span>Fecha: <strong>${dateLabel(item.date)}</strong></span></div>
    ${item.watch?.length ? `<small class="dee-watch">Catalizador: ${item.watch.map(esc).join(' · ')}</small>` : `<small>${esc(briefing?.stance || 'Postura global N/D')}</small>`}
  </article>`;
}

function macroCard(item) {
  if (!item) return `<article class="dee-card unavailable"><div class="dee-card-head"><span>MACRO AGCI</span><b>N/D</b></div><p>No fue posible cargar el contexto macro.</p></article>`;
  return `<article class="dee-card">
    <div class="dee-card-head"><span>MACRO AGCI</span><b>${esc(item.stance || 'Contexto')}</b></div>
    <div class="dee-metrics"><strong>${num(item.vix,1)}<small>VIX</small></strong><strong>${num(item.vixAverage20,1)}<small>media 20d</small></strong><strong>${finite(item.policyRateUS) ? `${num(item.policyRateUS,3)}%` : 'N/D'}<small>tasa US</small></strong></div>
    <p>Riesgo briefing: <strong>${esc(item.risk || 'N/D')}</strong> · régimen VIX: <strong>${esc(item.vixRegime || 'N/D')}</strong>.</p>
    <small>${item.reasons?.map(esc).join(' ') || 'Sin lectura adicional.'}</small>
  </article>`;
}

function renderSignals(overlay) {
  const signals = overlay.macro?.signals || [];
  if (!signals.length) return '';
  return `<div class="dee-signals"><strong>Qué está cambiando ahora</strong>${signals.map(item => `<div><span>${esc(item.label)}</span><b>${esc(item.type)}</b><p>${esc(item.summary)}</p></div>`).join('')}</div>`;
}

function renderOverlay(ticker, bundle) {
  const detail = document.getElementById('deDecisionDetail');
  if (!detail || !ticker) return;
  const overlay = buildContextOverlay(ticker, bundle, new Date());
  const existing = document.getElementById('deEvidenceLayer');
  if (existing?.dataset.ticker === ticker && existing?.dataset.sourceDate === String(bundle.briefing?.date || '')) return;
  existing?.remove();

  const section = document.createElement('section');
  section.id = 'deEvidenceLayer';
  section.className = 'dee-layer';
  section.dataset.ticker = ticker;
  section.dataset.sourceDate = String(bundle.briefing?.date || '');
  section.innerHTML = `
    <div class="dee-head">
      <div><span class="dee-number">06</span><div><p class="rubric">FASE 3 · EVIDENCE OVERLAY</p><h3>¿Qué está cambiando alrededor de ${esc(ticker)}?</h3><p>CIAR + Daily Strategic Briefing + macro AGCI. Esta capa modifica disciplina de ejecución, no valoración.</p></div></div>
      <div class="dee-balance ${tone(overlay.label)}"><small>Context Balance</small><strong>${esc(overlay.label)}</strong><span>${finite(overlay.totalPoints) ? `${overlay.totalPoints > 0 ? '+' : ''}${overlay.totalPoints} pts` : 'N/D'}</span></div>
    </div>
    <div class="dee-grid">${analystCard(overlay.analyst)}${briefingCard(overlay.briefing, bundle.briefing)}${macroCard(overlay.macro)}</div>
    ${renderSignals(overlay)}
    <div class="dee-execution"><div><strong>Impacto sobre ejecución</strong><p>${esc(overlay.execution)}</p></div><div><strong>Regla de gobernanza</strong><p>${esc(overlay.governance.principle)}</p></div></div>
    <div class="dee-source-line"><span>CIAR: ${dateLabel(bundle.ciar?.latestSourceDate)}</span><span>Briefing: ${dateLabel(bundle.briefing?.date)}</span><span>Macro: ${dateLabel(bundle.macro?.generatedAt)}</span>${bundle.errors?.length ? `<span class="dee-source-error">Fuente no disponible: ${bundle.errors.map(esc).join(', ')}</span>` : ''}</div>`;

  const scoreboard = detail.querySelector('.de-scoreboard');
  if (scoreboard) scoreboard.insertAdjacentElement('afterend', section);
  else detail.prepend(section);
}

async function scheduleRender(explicitTicker = null) {
  clearTimeout(renderTimer);
  renderTimer = setTimeout(async () => {
    const ticker = explicitTicker || selectedTicker();
    if (!ticker || !document.getElementById('deDecisionDetail')) return;
    const bundle = await loadSources();
    renderOverlay(ticker, bundle);
  }, 40);
}

function observeDecisionEngine() {
  const root = document.getElementById('decisionEngineRoot');
  if (!root) return false;
  observer?.disconnect();
  observer = new MutationObserver(() => scheduleRender());
  observer.observe(root, { childList: true, subtree: true });
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-de-select]');
    if (target?.dataset.deSelect) scheduleRender(target.dataset.deSelect);
  }, true);
  scheduleRender();
  return true;
}

function init() {
  ensureStyle();
  loadSources().catch(() => {});
  if (observeDecisionEngine()) return;
  const bodyObserver = new MutationObserver(() => {
    if (observeDecisionEngine()) bodyObserver.disconnect();
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => bodyObserver.disconnect(), 20000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
