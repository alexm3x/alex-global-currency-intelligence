import { learningForTicker } from './decision-learning-core.js';
import { summarizeVariableRegistry } from './decision-variable-core.js';

const VERSION = '20260810-phase5a';
const URLS = Object.freeze({
  learning: `data/decision-learning-latest.json?v=${VERSION}`,
  registry: `data/decision-variable-registry.json?v=${VERSION}`
});

let bundle = null;
let loading = null;
let observer = null;
let timer = null;

const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const pct = value => finite(value) ? `${Number(value).toFixed(1)}%` : 'N/D';
const points = value => finite(value) ? `${Number(value).toFixed(1)} pts` : 'N/D';

function ensureStyle() {
  if (document.querySelector('link[data-de-evolution-style]')) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `decision-evolution.css?v=${VERSION}`;
  link.dataset.deEvolutionStyle = 'true';
  document.head.appendChild(link);
}

async function fetchJson(url) {
  const response = await fetch(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.json();
}

async function loadBundle() {
  if (bundle) return bundle;
  if (loading) return loading;
  loading = Promise.allSettled([fetchJson(URLS.learning), fetchJson(URLS.registry)]).then(results => {
    bundle = {
      learning: results[0].status === 'fulfilled' ? results[0].value : null,
      registry: results[1].status === 'fulfilled' ? results[1].value : null,
      errors: results.map((item, index) => item.status === 'rejected' ? ['aprendizaje', 'registro de variables'][index] : null).filter(Boolean)
    };
    return bundle;
  }).finally(() => { loading = null; });
  return loading;
}

function selectedTicker() {
  const active = document.querySelector('#decisionEngine [data-de-select].active');
  if (active?.dataset.deSelect) return active.dataset.deSelect;
  const heading = document.querySelector('#deDecisionDetail .de-section-head h3');
  return String(heading?.textContent || '').match(/^\s*([A-Z][A-Z0-9.-]{0,9})\b/)?.[1] || null;
}

function horizonCard(label, stats) {
  const all = stats || null;
  if (!all || !finite(all.observations) || Number(all.observations) === 0) {
    return `<div class="dev-horizon"><strong>${esc(label)}</strong><span>Sin observaciones</span><small>Esperando precios posteriores.</small></div>`;
  }
  return `<div class="dev-horizon"><strong>${esc(label)}</strong><span>${all.observations} obs.</span><b>${pct(all.averageForwardReturnPct)}</b><small>${all.status === 'measurable' ? `Hit rate ${pct(all.directionalHitRatePct)}` : 'Muestra aún insuficiente'}</small></div>`;
}

function learningPanel(learning, ticker) {
  if (!learning) return `<article class="dev-card unavailable"><span>FASE 4</span><h4>Aprendizaje histórico N/D</h4><p>No fue posible cargar el historial.</p></article>`;
  const tickerLearning = learningForTicker(learning, ticker) || {};
  const active = learning.status === 'learning-active';
  const history = learning.history || {};
  return `<article class="dev-card">
    <div class="dev-card-head"><span>FASE 4 · LEARNING LOOP</span><b class="${active ? 'active' : 'collecting'}">${active ? 'APRENDIZAJE ACTIVO' : 'CONSTRUYENDO HISTORIAL'}</b></div>
    <h4>¿Qué tan buenas fueron las decisiones anteriores?</h4>
    <p>AGCI compara la decisión registrada contra precios observados después. No hace backfill de resultados ni considera el precio futuro como “valor justo”.</p>
    <div class="dev-history-kpis"><strong>${history.snapshots ?? 0}<small>snapshots</small></strong><strong>${history.forwardObservations ?? 0}<small>observaciones futuras</small></strong><strong>${history.calendarSpanDays ?? 0}<small>días de historia</small></strong></div>
    <div class="dev-horizons">${horizonCard('1 día', tickerLearning['1d'])}${horizonCard('5 días', tickerLearning['5d'])}${horizonCard('20 días', tickerLearning['20d'])}</div>
    <small class="dev-rule">Se requieren ≥5 observaciones por grupo para publicar métricas como medibles.</small>
  </article>`;
}

function stateLabel(state) {
  return ({ disabled: 'Desactivada', experimental: 'Experimental', validated: 'Validada', promoted: 'Promovida' })[state] || state;
}

function registryPanel(registry) {
  if (!registry) return `<article class="dev-card unavailable"><span>FASE 5</span><h4>Registro de variables N/D</h4><p>No fue posible cargar la gobernanza modular.</p></article>`;
  const summary = summarizeVariableRegistry(registry);
  const visible = (registry.variables || []).filter(item => item.state !== 'disabled').slice(0, 8);
  return `<article class="dev-card">
    <div class="dev-card-head"><span>FASE 5 · VARIABLE GOVERNANCE</span><b class="${summary.valid ? 'active' : 'error'}">${summary.valid ? 'REGISTRO VÁLIDO' : 'REVISAR'}</b></div>
    <h4>Variables extensibles sin contaminar el motor</h4>
    <p>Una variable puede observarse primero y ganar peso sólo después de validación histórica. Hoy ninguna variable contextual nueva modifica el Decision Score base.</p>
    <div class="dev-history-kpis"><strong>${summary.validated}<small>validadas</small></strong><strong>${summary.experimental}<small>experimentales</small></strong><strong>${summary.promoted}<small>promovidas</small></strong></div>
    <div class="dev-variable-list">${visible.map(item => `<div><span>${esc(item.name)}</span><b class="state-${esc(item.state)}">${esc(stateLabel(item.state))}</b><small>Peso ${Number(item.weight || 0)} · ${esc(item.category)}</small></div>`).join('')}</div>
    <small class="dev-rule">Regla: sólo una variable “promovida” puede tener peso > 0; promoción requiere muestra histórica, fuente trazable, comportamiento N/D y rollback documentado.</small>
  </article>`;
}

function evidenceLiftPanel(learning) {
  const lift = learning?.evidenceLift?.['20d'];
  if (!lift || lift.status !== 'measurable') {
    return `<div class="dev-lift collecting"><strong>Valor incremental del contexto</strong><span>Aún no medible</span><p>AGCI necesita al menos 5 observaciones de compra con soporte contextual y 5 de comparación antes de afirmar que CIAR/briefing/macro mejoran la ejecución.</p></div>`;
  }
  const value = lift.averageReturnLiftPctPoints;
  return `<div class="dev-lift ${Number(value) >= 0 ? 'positive' : 'negative'}"><strong>Valor incremental del contexto · 20d</strong><span>${Number(value) > 0 ? '+' : ''}${points(value)}</span><p>Diferencia media observada entre entradas en terreno de compra con soporte contextual y el grupo de comparación.</p></div>`;
}

function renderSignature(ticker, data) {
  return [ticker, data.learning?.generatedAt || 'learning:N/D', data.registry?.updatedAt || 'registry:N/D', (data.errors || []).join('|')].join('::');
}

function render(ticker, data) {
  const detail = document.getElementById('deDecisionDetail');
  if (!detail || !ticker) return;
  const signature = renderSignature(ticker, data);
  let section = document.getElementById('deEvolutionLayer');
  if (section?.dataset.signature === signature && section.isConnected) return;
  if (!section) {
    section = document.createElement('section');
    section.id = 'deEvolutionLayer';
    section.className = 'dev-layer';
  }
  section.dataset.ticker = ticker;
  section.dataset.signature = signature;
  section.innerHTML = `
    <div class="dev-head"><div><span class="dev-number">07–08</span><div><p class="rubric">FASES 4–5 · DECISION EVOLUTION</p><h3>Aprender antes de agregar complejidad</h3><p>Primero medimos decisiones pasadas; después permitimos que nuevas variables compitan por un lugar en el modelo.</p></div></div></div>
    <div class="dev-grid">${learningPanel(data.learning, ticker)}${registryPanel(data.registry)}</div>
    ${evidenceLiftPanel(data.learning)}
    <div class="dev-source-line"><span>Learning: ${esc(data.learning?.generatedAt || 'N/D')}</span><span>Variable registry: ${esc(data.registry?.updatedAt || 'N/D')}</span>${data.errors?.length ? `<span class="error">No disponible: ${data.errors.map(esc).join(', ')}</span>` : ''}</div>`;

  const evidence = document.getElementById('deEvidenceLayer');
  if (evidence) evidence.insertAdjacentElement('afterend', section);
  else {
    const scoreboard = detail.querySelector('.de-scoreboard');
    if (scoreboard) scoreboard.insertAdjacentElement('afterend', section);
    else detail.appendChild(section);
  }
}

function schedule(explicitTicker = null) {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const ticker = explicitTicker || selectedTicker();
    if (!ticker) return;
    const data = await loadBundle();
    render(ticker, data);
  }, 80);
}

function observe() {
  const root = document.getElementById('decisionEngineRoot');
  if (!root) return false;
  observer?.disconnect();
  observer = new MutationObserver(mutations => {
    const externalChange = mutations.some(mutation => mutation.target?.id !== 'deEvolutionLayer' && !mutation.target?.closest?.('#deEvolutionLayer'));
    if (externalChange) schedule();
  });
  observer.observe(root, { childList: true, subtree: true });
  root.addEventListener('click', event => {
    const target = event.target.closest('[data-de-select]');
    if (target?.dataset.deSelect) schedule(target.dataset.deSelect);
  }, true);
  schedule();
  return true;
}

function init() {
  ensureStyle();
  loadBundle().catch(() => {});
  if (observe()) return;
  const bodyObserver = new MutationObserver(() => {
    if (observe()) bodyObserver.disconnect();
  });
  bodyObserver.observe(document.body, { childList: true, subtree: true });
  setTimeout(() => bodyObserver.disconnect(), 20000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();
