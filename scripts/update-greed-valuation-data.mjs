import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildMarketSnapshot, clamp } from '../greed-valuation-core.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MACRO_PATH = resolve(ROOT, 'data/macro-latest.json');
const LATEST_PATH = resolve(ROOT, 'data/greed-valuation-latest.json');
const HISTORY_PATH = resolve(ROOT, 'data/greed-valuation-history.json');
const USER_AGENT = 'AGCI Greed Valuation updater/1.0 (+https://alexm3x.github.io/alex-global-currency-intelligence/)';

const FRED_SERIES = Object.freeze({
  sp500: 'SP500',
  dow: 'DJIA',
  nasdaq: 'NASDAQCOM',
  highYieldOas: 'BAMLH0A0HYM2'
});

function finite(v) { return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v)); }
function round(v, digits = 2) { return finite(v) ? Number(Number(v).toFixed(digits)) : null; }
function isoDate(v) { const d = new Date(v); return Number.isFinite(d.getTime()) ? d.toISOString().slice(0, 10) : null; }
function ageDays(date, now = new Date()) { const t = Date.parse(date || ''); return Number.isFinite(t) ? Math.max(0, (now.getTime() - t) / 86400000) : Infinity; }
function freshnessScore(date, now = new Date()) { const age = ageDays(date, now); return age <= 2 ? 100 : age <= 5 ? 90 : age <= 10 ? 75 : age <= 30 ? 50 : 20; }
function pctReturn(series, lookback) {
  if (!Array.isArray(series) || series.length <= lookback) return null;
  const latest = Number(series.at(-1).value);
  const past = Number(series.at(-(lookback + 1)).value);
  return finite(latest) && finite(past) && past !== 0 ? ((latest / past) - 1) * 100 : null;
}
function sma(series, window) {
  const values = (series || []).slice(-window).map(x => Number(x.value)).filter(Number.isFinite);
  return values.length >= Math.max(10, Math.floor(window * 0.8)) ? values.reduce((a, b) => a + b, 0) / values.length : null;
}
function percentileRank(values, value) {
  const valid = values.map(Number).filter(Number.isFinite).sort((a,b)=>a-b);
  if (!valid.length || !finite(value)) return null;
  return 100 * valid.filter(x => x <= Number(value)).length / valid.length;
}

async function fetchWithRetry(url, { attempts = 3, timeoutMs = 30000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, { headers: { accept: 'text/csv,*/*', 'user-agent': USER_AGENT }, signal: controller.signal });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(r => setTimeout(r, attempt * 1200));
    } finally { clearTimeout(timer); }
  }
  throw new Error(`${new URL(url).hostname}: ${lastError?.message || lastError}`);
}

export function parseFredCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const header = lines[0].split(',');
  const dateIndex = header.findIndex(x => /date|observation_date/i.test(x));
  const valueIndex = header.findIndex((x, i) => i !== dateIndex && !/^realtime_/i.test(x));
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const value = Number(cells[valueIndex]);
    return { date: cells[dateIndex], value: Number.isFinite(value) ? value : null };
  }).filter(x => x.date && finite(x.value));
}

export function parseCboeCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map(x => x.trim().replace(/^"|"$/g, ''));
  const dateIndex = headers.findIndex(x => /^date$/i.test(x));
  const closeIndex = headers.findIndex(x => /^close$/i.test(x));
  return lines.slice(1).map(line => {
    const cells = line.split(',').map(x => x.trim().replace(/^"|"$/g, ''));
    const rawDate = cells[dateIndex];
    const match = String(rawDate || '').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    const date = match ? `${match[3]}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}` : rawDate;
    const value = Number(cells[closeIndex]);
    return { date, value: Number.isFinite(value) ? value : null };
  }).filter(x => x.date && finite(x.value));
}

async function fetchFredSeries(id) {
  const text = await fetchWithRetry(`https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`);
  const rows = parseFredCsv(text);
  if (rows.length < 40) throw new Error(`FRED ${id}: insufficient observations`);
  return rows;
}

async function fetchVix3m() {
  const text = await fetchWithRetry('https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX3M_History.csv');
  const rows = parseCboeCsv(text);
  if (rows.length < 40) throw new Error('Cboe VIX3M: insufficient observations');
  return rows;
}

export function scoreMomentum(sp500) {
  const r20 = pctReturn(sp500, 20);
  const r125 = pctReturn(sp500, 125);
  if (!finite(r20) || !finite(r125)) return null;
  return Math.round(clamp(50 + (Number(r20) * 2.2) + (Number(r125) * 0.9)));
}

export function scoreBreadthProxy(seriesMap) {
  const checks = [];
  for (const rows of Object.values(seriesMap)) {
    if (!Array.isArray(rows) || rows.length < 120) continue;
    const latest = Number(rows.at(-1).value);
    const ma50 = sma(rows, 50);
    const ma100 = sma(rows, 100);
    const r20 = pctReturn(rows, 20);
    if (finite(latest) && finite(ma50)) checks.push(latest > ma50 ? 1 : 0);
    if (finite(latest) && finite(ma100)) checks.push(latest > ma100 ? 1 : 0);
    if (finite(r20)) checks.push(r20 > 0 ? 1 : 0);
  }
  return checks.length >= 6 ? Math.round(100 * checks.reduce((a,b)=>a+b,0) / checks.length) : null;
}

export function scoreCredit(rows) {
  if (!Array.isArray(rows) || rows.length < 100) return null;
  const latest = Number(rows.at(-1).value);
  const percentile = percentileRank(rows.slice(-756).map(x=>x.value), latest);
  return finite(percentile) ? Math.round(clamp(100 - percentile)) : null;
}

export function scoreOptionsTermStructure(vix, vix3m) {
  if (!finite(vix) || !finite(vix3m) || Number(vix3m) <= 0) return null;
  const ratio = Number(vix) / Number(vix3m);
  return Math.round(clamp(50 + (1 - ratio) * 250));
}

export function scoreVolatility(vixPercentile1y) {
  return finite(vixPercentile1y) ? Math.round(clamp(100 - Number(vixPercentile1y))) : null;
}

function component(label, value, normalizedScore, source, asOf, now, confidence = 90, sourceQuality = 95) {
  return {
    label,
    value: finite(value) ? round(value, 4) : value,
    normalized_score: finite(normalizedScore) ? Math.round(Number(normalizedScore)) : null,
    source,
    asOf,
    freshness: ageDays(asOf, now) <= 2 ? 'DAILY' : ageDays(asOf, now) <= 7 ? 'RECENT' : 'STALE',
    freshness_score: freshnessScore(asOf, now),
    confidence,
    source_quality: sourceQuality
  };
}

function deriveRegime(sp500, vix) {
  const latest = Number(sp500?.at(-1)?.value);
  const ma200 = sma(sp500, 200);
  const r20 = pctReturn(sp500, 20);
  const r125 = pctReturn(sp500, 125);
  if (![latest, ma200, r20, r125].every(finite)) return 'N/D';
  if (latest < ma200 && r125 < 0) return 'Bear Market';
  if (latest > ma200 && r20 < 0) return 'Correction';
  if (latest > ma200 && r125 > 0 && Number(vix || 0) < 22) return 'Mid Bull';
  if (latest > ma200 && r125 > 0) return 'Late Bull';
  return 'Recovery';
}

function changesFromHistory(history, current) {
  const nearest = days => {
    if (!history.length) return null;
    const target = Date.parse(current.date) - days * 86400000;
    return history.slice().sort((a,b)=>Math.abs(Date.parse(a.date)-target)-Math.abs(Date.parse(b.date)-target))[0] || null;
  };
  const delta = (field, days) => {
    const prev = nearest(days);
    return prev && finite(prev[field]) && finite(current[field]) ? round(Number(current[field]) - Number(prev[field]), 1) : null;
  };
  return {
    greed_1d: delta('greed', 1), greed_7d: delta('greed', 7), greed_30d: delta('greed', 30),
    valuation_1d: delta('valuation', 1), valuation_7d: delta('valuation', 7), valuation_30d: delta('valuation', 30)
  };
}

async function readJson(path, fallback) {
  try { return JSON.parse(await readFile(path, 'utf8')); } catch { return fallback; }
}

export async function updateGreedValuationData({ write = true, now = new Date() } = {}) {
  const [macro, previousLatest, previousHistory] = await Promise.all([
    readJson(MACRO_PATH, {}), readJson(LATEST_PATH, {}), readJson(HISTORY_PATH, { schema_version: 1, observations: [] })
  ]);

  const fetches = await Promise.allSettled([
    fetchFredSeries(FRED_SERIES.sp500),
    fetchFredSeries(FRED_SERIES.dow),
    fetchFredSeries(FRED_SERIES.nasdaq),
    fetchFredSeries(FRED_SERIES.highYieldOas),
    fetchVix3m()
  ]);
  const [sp500R, dowR, nasdaqR, creditR, vix3mR] = fetches;
  const sp500 = sp500R.status === 'fulfilled' ? sp500R.value : null;
  const dow = dowR.status === 'fulfilled' ? dowR.value : null;
  const nasdaq = nasdaqR.status === 'fulfilled' ? nasdaqR.value : null;
  const credit = creditR.status === 'fulfilled' ? creditR.value : null;
  const vix3m = vix3mR.status === 'fulfilled' ? vix3mR.value : null;

  const vix = macro?.risk?.vix;
  const vixAsOf = macro?.risk?.period || isoDate(macro?.generatedAt);
  const vixPercentile = macro?.risk?.percentile1y;
  const latestVix3m = vix3m?.at(-1);

  const greedComponents = {
    momentum: component('Market Momentum', sp500?.at(-1)?.value ?? null, scoreMomentum(sp500), 'Federal Reserve / FRED — SP500', sp500?.at(-1)?.date || null, now),
    breadth: component('Cross-index Breadth Proxy', null, scoreBreadthProxy({ sp500, dow, nasdaq }), 'Federal Reserve / FRED — SP500, DJIA, NASDAQCOM', [sp500?.at(-1)?.date,dow?.at(-1)?.date,nasdaq?.at(-1)?.date].filter(Boolean).sort().at(0) || null, now, 82, 92),
    volatility: component('VIX / Volatility', vix, scoreVolatility(vixPercentile), 'Cboe Global Markets — VIX', vixAsOf, now),
    options: component('Options Term Structure', finite(vix) && finite(latestVix3m?.value) ? Number(vix) / Number(latestVix3m.value) : null, scoreOptionsTermStructure(vix, latestVix3m?.value), 'Cboe Global Markets — VIX / VIX3M', latestVix3m?.date || vixAsOf, now, 88, 96),
    credit: component('Credit Spreads', credit?.at(-1)?.value ?? null, scoreCredit(credit), 'Federal Reserve / FRED — ICE BofA US High Yield OAS', credit?.at(-1)?.date || null, now, 92, 96)
  };

  const valuationComponents = {};
  const marketCore = buildMarketSnapshot({ greed_components: greedComponents, valuation_components: valuationComponents });
  const regime = deriveRegime(sp500, vix);
  const valuation = marketCore.valuation;
  const greed = marketCore.greed;
  const condition = marketCore.condition;
  const interpretation = finite(greed)
    ? `Greed ${greed}/100 (${marketCore.greed_label}) con cobertura verificable de ${(marketCore.coverage.greed*100).toFixed(0)}%. La valoración agregada permanece N/D hasta contar con métricas de mercado primarias o autorizadas suficientes. Régimen: ${regime}.`
    : 'Cobertura insuficiente para emitir Greed agregado. La valoración agregada permanece N/D hasta contar con métricas de mercado primarias o autorizadas suficientes.';

  const date = now.toISOString().slice(0,10);
  const currentHistoryRow = { date, greed, valuation, market_regime: regime, confidence: marketCore.confidence, spx: sp500?.at(-1)?.value ?? null, vix: finite(vix) ? Number(vix) : null, credit_spread: credit?.at(-1)?.value ?? null };
  const historyRows = Array.isArray(previousHistory.observations) ? previousHistory.observations.filter(x => x.date !== date) : [];
  const changes = changesFromHistory(historyRows, currentHistoryRow);
  historyRows.push(currentHistoryRow);
  historyRows.sort((a,b)=>String(a.date).localeCompare(String(b.date)));

  const errors = fetches.map((x,i)=>x.status === 'rejected' ? `${Object.keys(FRED_SERIES)[i] || 'vix3m'}: ${x.reason?.message || x.reason}` : null).filter(Boolean);
  const sources = [
    { name:'Cboe Global Markets — VIX', frequency:'DAILY', asOf:vixAsOf, status:finite(vix)?'connected':'unavailable' },
    { name:'Cboe Global Markets — VIX3M', frequency:'DAILY', asOf:latestVix3m?.date || null, status:vix3m?'connected':'degraded' },
    { name:'Federal Reserve / FRED — SP500, DJIA, NASDAQCOM', frequency:'DAILY', asOf:[sp500?.at(-1)?.date,dow?.at(-1)?.date,nasdaq?.at(-1)?.date].filter(Boolean).sort().at(0)||null, status:sp500&&dow&&nasdaq?'connected':'degraded' },
    { name:'Federal Reserve / FRED — ICE BofA High Yield OAS', frequency:'DAILY', asOf:credit?.at(-1)?.date || null, status:credit?'connected':'degraded' },
    { name:'AAII', frequency:'WEEKLY', asOf:null, status:'authorized_access_required' },
    { name:'NAAIM', frequency:'WEEKLY', asOf:null, status:'authorized_access_required' }
  ];

  const output = {
    schema_version: 1,
    timestamp: now.toISOString(),
    timezone: 'America/Mexico_City',
    methodology_version: 'AGCI-GV-v1.1',
    status: finite(greed) ? 'greed_live_valuation_pending' : 'partial_coverage',
    market: {
      greed,
      greed_label: marketCore.greed_label,
      valuation,
      valuation_label: marketCore.valuation_label,
      regime,
      opportunity: null,
      confidence: marketCore.confidence,
      coverage: marketCore.coverage,
      condition,
      interpretation
    },
    changes,
    components: greedComponents,
    sources,
    signals: condition?.code && condition.code !== 'INSUFFICIENT_DATA' ? [{ code: condition.code, severity: condition.severity }] : [],
    errors,
    governance: {
      minimum_greed_coverage: 0.60,
      minimum_valuation_coverage: 0.55,
      breadth_is_cross_index_proxy: true,
      missing_values_are_never_zero: true,
      scores_reproducible_in_code: true,
      ai_may_explain_but_not_set_scores: true,
      valuation_withheld_until_authorized_coverage: true
    }
  };

  const historyOutput = { schema_version: 1, methodology_version: 'AGCI-GV-v1.1', updated_at: now.toISOString(), observations: historyRows.slice(-1826) };
  if (write) {
    await writeFile(LATEST_PATH, `${JSON.stringify(output, null, 2)}\n`);
    await writeFile(HISTORY_PATH, `${JSON.stringify(historyOutput, null, 2)}\n`);
  }
  return { output, history: historyOutput, previousLatest };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const dryRun = process.argv.includes('--dry-run');
  const { output } = await updateGreedValuationData({ write: !dryRun });
  console.log(JSON.stringify({ status: output.status, greed: output.market.greed, valuation: output.market.valuation, confidence: output.market.confidence, coverage: output.market.coverage, errors: output.errors }, null, 2));
  if (!finite(output.market.greed)) process.exitCode = 1;
}
