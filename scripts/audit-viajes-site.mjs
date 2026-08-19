import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viajes = path.join(root, 'viajes');
const errors = [];
const warnings = [];
const page = await readFile(path.join(viajes, 'index.html'), 'utf8');
const assistant = await readFile(path.join(viajes, 'travel-assistant.js'), 'utf8');
const intelligence = await readFile(path.join(viajes, 'travel-intelligence.js'), 'utf8');
const windowEngine = await readFile(path.join(viajes, 'travel-window-engine.js'), 'utf8');
const core = await readFile(path.join(viajes, 'travel-intelligence-core.js'), 'utf8');
const logisticsCore = await readFile(path.join(viajes, 'travel-logistics-core.js'), 'utf8');
const logistics = await readFile(path.join(viajes, 'travel-logistics.js'), 'utf8');
const itineraryCore = await readFile(path.join(viajes, 'travel-itinerary-core.js'), 'utf8');
const itinerary = await readFile(path.join(viajes, 'travel-itinerary.js'), 'utf8');
const costCore = await readFile(path.join(viajes, 'travel-cost-core.js'), 'utf8');
const cost = await readFile(path.join(viajes, 'travel-cost.js'), 'utf8');
const pdfCore = await readFile(path.join(viajes, 'travel-pdf-core.js'), 'utf8');
const pdf = await readFile(path.join(viajes, 'travel-pdf.js'), 'utf8');
const integrationCore = await readFile(path.join(viajes, 'travel-integration-core.js'), 'utf8');
const integration = await readFile(path.join(viajes, 'travel-integration.js'), 'utf8');
const worker = await readFile(path.join(root, 'cloudflare', 'viajes-assistant-worker.js'), 'utf8');
const config = await readFile(path.join(root, 'wrangler.viajes-assistant.jsonc'), 'utf8');

function requireMatch(source, regex, label) { if (!regex.test(source)) errors.push(`Missing: ${label}`); }

const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) errors.push(`Duplicate HTML ids: ${[...new Set(duplicateIds)].join(', ')}`);

for (const required of ['travelAssistant','travelAssistantDialog','smartStaysPanel','opportunityImportPanel','queryForm','recommendations','matrixBody']) {
  if (!ids.includes(required)) errors.push(`Required UI id not found: ${required}`);
}

const localAssets = [];
for (const match of page.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) {
  const ref = match[1];
  if (/^(?:https?:|data:|#)/.test(ref)) continue;
  localAssets.push(ref.split('?')[0]);
}
for (const ref of localAssets) {
  try { await access(path.join(viajes, ref)); } catch { errors.push(`Broken local asset reference: ${ref}`); }
}

for (const match of page.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
  if (!/\brel="[^"]*noopener/.test(match[0])) warnings.push(`External target lacks noopener: ${match[0].slice(0, 120)}`);
}

requireMatch(page, /Modo demostración:/, 'synthetic stays disclosure');
requireMatch(assistant, /known_dates/, 'Mode A known dates');
requireMatch(assistant, /inverse_dates/, 'Mode B inverse dates');
requireMatch(assistant, /Presupuesto máximo opcional/, 'optional budget UX');
requireMatch(assistant, /travel-intelligence-core\.js/, 'Phase 3/4 core loader');
requireMatch(assistant, /travel-intelligence\.js/, 'Phase 3/4 UI loader');
requireMatch(intelligence, /travel-window-engine\.js/, 'Phase 5 loader');
requireMatch(windowEngine, /research_windows/, 'Phase 5 comparative research action');
requireMatch(windowEngine, /viajes:window-selected/, 'Phase 5 selected-window transfer');
requireMatch(windowEngine, /viajes:known-dates-request/, 'Phase 5 exact-date handoff');
requireMatch(core, /parseApproxPeriod/, 'Phase 5 approximate-period parser');
requireMatch(core, /generateCandidateWindows/, 'Phase 5 candidate generator');
requireMatch(core, /selectWindowStrategies/, 'Phase 5 Top 3 strategy selector');
requireMatch(core, /value!==null&&value!==undefined/, 'missing evidence excluded from scoring');
requireMatch(intelligence, /travel-logistics-core\.js/, 'Phase 6 logistics core loader');
requireMatch(intelligence, /travel-logistics\.js/, 'Phase 6 logistics UI loader');
requireMatch(logisticsCore, /asc-travel-logistics-v1/, 'Phase 6 logistics contract');
requireMatch(logisticsCore, /estimated_from_straight_line_distance/, 'Phase 6 transfer estimate provenance');
requireMatch(logistics, /viajes:research-ready/, 'Phase 6 research handoff');
requireMatch(logistics, /Abrir ruta del día en Maps/, 'Phase 6 daily map route');
requireMatch(logistics, /travel-itinerary-core\.js/, 'Phase 7 itinerary core loader');
requireMatch(logistics, /travel-cost-core\.js/, 'Phase 8 cost core loader');
requireMatch(itineraryCore, /asc-travel-itinerary-v1/, 'Phase 7 itinerary contract');
requireMatch(itineraryCore, /fixed_times:'never_retimed'/, 'Phase 7 fixed-time governance');
requireMatch(itinerary, /viajes:itinerary-ready/, 'Phase 7 downstream handoff');
requireMatch(itinerary, /no inventa restaurantes/i, 'Phase 7 no-fabrication disclosure');
requireMatch(costCore, /asc-travel-cost-v1/, 'Phase 8 cost contract');
requireMatch(costCore, /summation:'only_explicit_total_basis'/, 'Phase 8 explicit-total summation rule');
requireMatch(costCore, /unit_prices:'visible_but_excluded'/, 'Phase 8 unit-price exclusion rule');
requireMatch(costCore, /currency:'never_converted_without_explicit_fx_evidence'/, 'Phase 8 FX governance');
requireMatch(cost, /viajes:cost-ready/, 'Phase 8 downstream handoff');
requireMatch(cost, /travel-pdf-core\.js/, 'Phase 9 PDF core loader');
requireMatch(cost, /travel-pdf\.js/, 'Phase 9 PDF UI loader');
requireMatch(cost, /travel-integration-core\.js/, 'Phase 10 integration core loader');
requireMatch(cost, /travel-integration\.js/, 'Phase 10 integration UI loader');
requireMatch(pdfCore, /asc-travel-pdf-v1/, 'Phase 9 PDF contract');
requireMatch(pdfCore, /browser-native print document/, 'Phase 9 no-new-facts PDF methodology');
requireMatch(pdf, /viajes:cost-ready/, 'Phase 9 cost handoff');
requireMatch(pdf, /viajes:pdf-ready/, 'Phase 9 downstream handoff');
requireMatch(pdf, /popup\.print\(\)/, 'Phase 9 native print-to-PDF workflow');
requireMatch(pdf, /Guardar como PDF/, 'Phase 9 user PDF instruction');
if (/jsPDF|html2pdf/.test(pdf)) errors.push('Phase 9 unexpectedly depends on an ungoverned PDF library');
requireMatch(integrationCore, /asc-travel-integration-v1/, 'Phase 10 integration contract');
requireMatch(integrationCore, /local_watch_intent_only_external_notification_inactive/, 'Phase 10 alert governance');
requireMatch(integrationCore, /demo_data_never_promoted_to_live/, 'Phase 10 demo-stays governance');
requireMatch(integration, /viajes:pdf-ready/, 'Phase 10 PDF handoff');
requireMatch(integration, /viajes:integration-ready/, 'Phase 10 downstream handoff');
requireMatch(integration, /Notificación externa: NO ACTIVA/, 'Phase 10 no-fake-alert disclosure');
requireMatch(integration, /no alimentan el costo trazable/i, 'Phase 10 demo data cost isolation');
requireMatch(integration, /viajesASCTripHistory/, 'Phase 10 history integration');
requireMatch(integration, /viajesASCTripFavorites/, 'Phase 10 favorites integration');
requireMatch(integration, /viajesASCTripAlerts/, 'Phase 10 local alert-intent integration');
requireMatch(worker, /type:\s*'web_search'/, 'OpenAI web search research tool');
requireMatch(worker, /research_trip/, 'research_trip backend action');
requireMatch(worker, /research_windows/, 'research_windows backend action');
requireMatch(worker, /asc-travel-window-v1/, 'Phase 5 window contract');
requireMatch(worker, /event_premium/, 'Event Premium window evidence');
requireMatch(config, /alexsaldana\.com/, 'production custom-domain CORS origin');
requireMatch(config, /alexm3x\.github\.io/, 'GitHub Pages CORS origin');

const modules = ['travel-intelligence-core.js','travel-intelligence.js','travel-window-engine.js','travel-logistics-core.js','travel-logistics.js','travel-itinerary-core.js','travel-itinerary.js','travel-cost-core.js','travel-cost.js','travel-pdf-core.js','travel-pdf.js','travel-integration-core.js','travel-integration.js'];
for (const file of modules) {
  try { await access(path.join(viajes, file)); } catch { errors.push(`Missing intelligence module: ${file}`); }
}

const secretPatterns = [/sk-[A-Za-z0-9_-]{20,}/, /OPENAI_API_KEY\s*[:=]\s*["'][^"']+["']/];
for (const [name, source] of [['index.html', page], ['travel-assistant.js', assistant], ['travel-intelligence.js', intelligence], ['travel-window-engine.js', windowEngine], ['travel-logistics-core.js', logisticsCore], ['travel-logistics.js', logistics], ['travel-itinerary-core.js', itineraryCore], ['travel-itinerary.js', itinerary], ['travel-cost-core.js', costCore], ['travel-cost.js', cost], ['travel-pdf-core.js', pdfCore], ['travel-pdf.js', pdf], ['travel-integration-core.js', integrationCore], ['travel-integration.js', integration], ['viajes-assistant-worker.js', worker], ['wrangler.viajes-assistant.jsonc', config]]) {
  if (secretPatterns.some(pattern => pattern.test(source))) errors.push(`Potential embedded secret in ${name}`);
}

console.log(`Viajes ASC audit: ${ids.length} ids, ${localAssets.length} local assets, ${warnings.length} warning(s), ${errors.length} error(s).`);
warnings.slice(0, 10).forEach(value => console.warn(`WARN ${value}`));
if (errors.length) {
  errors.forEach(value => console.error(`ERROR ${value}`));
  process.exit(1);
}
