import fs from 'node:fs/promises';
import path from 'node:path';
import { rankRadar, DEFAULT_WEIGHTS } from '../decision-engine-core.js';
import { buildContextOverlay } from '../decision-evidence-core.js';
import { buildLearningReport } from '../decision-learning-core.js';

const ENDPOINT = process.env.AGCI_EQUITY_ENDPOINT || 'https://agci-equity-fundamentals.proadmexico.workers.dev';
const SYMBOLS = String(process.env.AGCI_DECISION_SYMBOLS || 'MSFT,GOOGL,AMZN,JPM,V,LLY,ISRG,GE,COST,XOM')
  .split(',').map(value => value.trim().toUpperCase()).filter(Boolean).slice(0, 10);
const HISTORY_DIR = path.resolve('data/decision-history');
const LEARNING_FILE = path.resolve('data/decision-learning-latest.json');
const RETRYABLE_HTTP_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function readJson(file, fallback = null) {
  try { return JSON.parse(await fs.readFile(file, 'utf8')); } catch { return fallback; }
}

function mexicoDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Mexico_City', year: 'numeric', month: '2-digit', day: '2-digit'
  }).formatToParts(now);
  const value = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${value.year}-${value.month}-${value.day}`;
}

export async function fetchFundamentals(symbols, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const sleep = options.sleep || delay;
  const attempts = Math.max(1, Number(options.attempts) || 5);
  const baseDelayMs = Math.max(0, Number(options.baseDelayMs) || 1000);
  const url = `${ENDPOINT}/compare?symbols=${encodeURIComponent(symbols.join(','))}`;
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        headers: { accept: 'application/json' },
        signal: AbortSignal.timeout(30000)
      });
      if (!response.ok) {
        const error = new Error(`Fundamentals endpoint HTTP ${response.status}`);
        error.retryable = RETRYABLE_HTTP_STATUS.has(response.status);
        throw error;
      }
      const payload = await response.json();
      if (!Array.isArray(payload.analyses) || !payload.analyses.length) {
        throw new Error('No analyses returned by fundamentals endpoint.');
      }
      return payload;
    } catch (error) {
      lastError = error;
      const transportFailure = ['AbortError', 'TimeoutError', 'TypeError'].includes(error?.name);
      const retryable = error?.retryable === true || transportFailure;
      if (!retryable || attempt === attempts) throw error;
      const waitMs = Math.min(baseDelayMs * (2 ** (attempt - 1)), 10000);
      console.warn(`Fundamentals request failed (${error.message}); retrying ${attempt + 1}/${attempts} in ${waitMs}ms.`);
      await sleep(waitMs);
    }
  }

  throw lastError;
}

function compactContext(overlay = {}) {
  return {
    label: overlay.label || 'N/D',
    totalPoints: Number.isFinite(Number(overlay.totalPoints)) ? Number(overlay.totalPoints) : null,
    analystSignal: overlay.analyst?.signal || 'N/D',
    analystAsOf: overlay.analyst?.asOf || null,
    analystStale: overlay.analyst?.stale ?? null,
    briefingClassification: overlay.briefing?.classification || 'N/D',
    briefingConfidence: overlay.briefing?.confidence || 'N/D',
    macroRisk: overlay.macro?.risk || 'N/D',
    macroVix: Number.isFinite(Number(overlay.macro?.vix)) ? Number(overlay.macro.vix) : null
  };
}

function compactDecision(decision, bundle, now) {
  const overlay = buildContextOverlay(decision.ticker, bundle, now);
  return {
    ticker: decision.ticker,
    companyName: decision.companyName,
    price: decision.terrain?.price ?? null,
    fairValue: decision.terrain?.fairValue ?? null,
    buy: decision.terrain?.buy ?? null,
    attractive: decision.terrain?.attractive ?? null,
    highConviction: decision.terrain?.highConviction ?? null,
    zone: decision.label || decision.terrain?.status || 'N/D',
    decisionScore: decision.decisionScore ?? null,
    preparationScore: decision.preparationScore ?? null,
    distanceToBuyPct: decision.distanceToBuyPct ?? null,
    marginOfSafetyRequired: decision.terrain?.marginOfSafetyRequired ?? null,
    valuationMethod: decision.terrain?.method || 'N/D',
    anchorCount: decision.terrain?.anchors?.length || 0,
    context: compactContext(overlay)
  };
}

async function loadHistory() {
  await fs.mkdir(HISTORY_DIR, { recursive: true });
  const files = (await fs.readdir(HISTORY_DIR)).filter(name => /^\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
  const snapshots = [];
  for (const name of files) {
    const item = await readJson(path.join(HISTORY_DIR, name));
    if (item) snapshots.push(item);
  }
  return snapshots;
}

export async function captureDecisionSnapshot(now = new Date()) {
  const payload = await fetchFundamentals(SYMBOLS);
  const [ciar, briefing, macro, registry] = await Promise.all([
    readJson('data/ciar-latest.json'),
    readJson('data/daily-briefing-latest.json'),
    readJson('data/macro-latest.json'),
    readJson('data/decision-variable-registry.json')
  ]);
  const bundle = { ciar, briefing, macro, errors: [] };
  const decisions = rankRadar(payload.analyses, DEFAULT_WEIGHTS);
  if (!decisions.length) throw new Error('Decision engine returned no ranked decisions.');

  const date = mexicoDate(now);
  const snapshot = {
    schemaVersion: 1,
    date,
    generatedAt: now.toISOString(),
    timezone: 'America/Mexico_City',
    methodologyVersion: 'decision-engine-phase5-governed',
    source: {
      fundamentalsUpdatedAt: payload.lastSuccessfulUpdate || null,
      fundamentalsDataQuality: payload.dataQuality || 'N/D',
      ciarLatestSourceDate: ciar?.latestSourceDate || null,
      briefingDate: briefing?.date || null,
      macroGeneratedAt: macro?.generatedAt || null,
      variableRegistryVersion: registry?.schemaVersion || null
    },
    decisions: decisions.map(item => compactDecision(item, bundle, now))
  };

  await fs.mkdir(HISTORY_DIR, { recursive: true });
  await fs.writeFile(path.join(HISTORY_DIR, `${date}.json`), `${JSON.stringify(snapshot, null, 2)}\n`);
  const history = await loadHistory();
  const report = buildLearningReport(history, now);
  await fs.writeFile(LEARNING_FILE, `${JSON.stringify(report, null, 2)}\n`);
  return { snapshot, report };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { snapshot, report } = await captureDecisionSnapshot(new Date());
  console.log(JSON.stringify({
    date: snapshot.date,
    decisions: snapshot.decisions.length,
    historySnapshots: report.history.snapshots,
    forwardObservations: report.history.forwardObservations,
    status: report.status
  }));
}
