import { readFile, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { buildMarketSnapshot } from '../greed-valuation-core.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const LATEST = resolve(ROOT, 'data/greed-valuation-latest.json');
const HISTORY = resolve(ROOT, 'data/greed-valuation-history.json');
const VALUATION = resolve(ROOT, 'data/valuation-market-latest.json');
const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));

async function readJson(path) { return JSON.parse(await readFile(path, 'utf8')); }

export async function applyValuation({ write = true } = {}) {
  const [latest, history, valuationInput] = await Promise.all([readJson(LATEST), readJson(HISTORY), readJson(VALUATION)]);
  const greedComponents = latest.components || {};
  const valuationComponents = valuationInput.components || {};
  const marketCore = buildMarketSnapshot({ greed_components: greedComponents, valuation_components: valuationComponents });
  if (!finite(marketCore.valuation) || marketCore.coverage.valuation < 0.55) {
    throw new Error(`Valuation policy threshold not met: score=${marketCore.valuation} coverage=${marketCore.coverage.valuation}`);
  }

  const condition = marketCore.condition;
  const regime = latest.market?.regime || 'N/D';
  const interpretation = `Greed ${marketCore.greed}/100 (${marketCore.greed_label}) y Valuation ${marketCore.valuation}/100 (${marketCore.valuation_label}). Cobertura verificable: Greed ${(marketCore.coverage.greed*100).toFixed(0)}%, Valuation ${(marketCore.coverage.valuation*100).toFixed(0)}%. Régimen: ${regime}. Señal de matriz: ${condition.label}.`;

  latest.timestamp = new Date().toISOString();
  latest.methodology_version = 'AGCI-GV-v1.2';
  latest.status = 'greed_valuation_live';
  latest.market = {
    ...latest.market,
    greed: marketCore.greed,
    greed_label: marketCore.greed_label,
    valuation: marketCore.valuation,
    valuation_label: marketCore.valuation_label,
    confidence: marketCore.confidence,
    coverage: marketCore.coverage,
    condition,
    interpretation
  };
  latest.valuation_components = valuationComponents;
  latest.sources = [...(latest.sources || []).filter(x => !String(x.name || '').includes('Shiller') && !String(x.name || '').includes('DGS10')), ...(valuationInput.sources || [])];
  latest.signals = condition?.code && condition.code !== 'INSUFFICIENT_DATA' ? [{ code: condition.code, severity: condition.severity, label: condition.label }] : [];
  latest.governance = {
    ...(latest.governance || {}),
    valuation_withheld_until_authorized_coverage: false,
    valuation_methodology_version: valuationInput.methodology_version,
    minimum_valuation_coverage: 0.55,
    forward_pe_unavailable_not_proxied: true,
    fcf_yield_unavailable_not_proxied: true
  };

  const date = latest.timestamp.slice(0, 10);
  const rows = Array.isArray(history.observations) ? history.observations.filter(x => x.date !== date) : [];
  const prior = Array.isArray(history.observations) ? history.observations.find(x => x.date === date) : null;
  rows.push({
    ...(prior || {}),
    date,
    greed: marketCore.greed,
    valuation: marketCore.valuation,
    market_regime: regime,
    confidence: marketCore.confidence,
    spx: prior?.spx ?? null,
    vix: prior?.vix ?? null,
    credit_spread: prior?.credit_spread ?? null
  });
  rows.sort((a,b) => String(a.date).localeCompare(String(b.date)));
  history.methodology_version = 'AGCI-GV-v1.2';
  history.updated_at = latest.timestamp;
  history.observations = rows.slice(-1826);

  if (write) {
    await writeFile(LATEST, `${JSON.stringify(latest, null, 2)}\n`);
    await writeFile(HISTORY, `${JSON.stringify(history, null, 2)}\n`);
  }
  return { latest, history };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { latest } = await applyValuation({ write: !process.argv.includes('--dry-run') });
  console.log(JSON.stringify({ status: latest.status, greed: latest.market.greed, valuation: latest.market.valuation, valuation_label: latest.market.valuation_label, condition: latest.market.condition, confidence: latest.market.confidence, coverage: latest.market.coverage }, null, 2));
}
