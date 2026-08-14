export const GREED_WEIGHTS = Object.freeze({
  momentum: 15,
  breadth: 15,
  volatility: 15,
  options: 10,
  credit: 10,
  retailSentiment: 10,
  institutionalPositioning: 10,
  flows: 5,
  speculation: 5,
  newsSentiment: 5
});

export const VALUATION_WEIGHTS = Object.freeze({
  forwardPE: 20,
  trailingPE: 10,
  cape: 15,
  earningsYieldSpread: 15,
  fcfYield: 10,
  priceSales: 10,
  equityRiskPremium: 15,
  priceBook: 5
});

const finite = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v));
export const clamp = (v, lo = 0, hi = 100) => Math.min(hi, Math.max(lo, Number(v)));

export function weightedScore(components = {}, weights = {}, minCoverage = 0.6) {
  let weighted = 0;
  let usedWeight = 0;
  let totalWeight = 0;
  const used = [];
  const missing = [];

  for (const [key, weightRaw] of Object.entries(weights)) {
    const weight = Number(weightRaw || 0);
    totalWeight += weight;
    const item = components[key];
    const score = typeof item === 'object' ? item?.normalized_score : item;
    if (!finite(score)) {
      missing.push(key);
      continue;
    }
    weighted += clamp(score) * weight;
    usedWeight += weight;
    used.push(key);
  }

  const coverage = totalWeight ? usedWeight / totalWeight : 0;
  return {
    score: coverage >= minCoverage && usedWeight ? Math.round(weighted / usedWeight) : null,
    coverage: Number(coverage.toFixed(4)),
    used,
    missing,
    status: coverage >= minCoverage ? 'available' : 'insufficient_coverage'
  };
}

export function confidenceScore(components = {}, weights = {}) {
  let weighted = 0;
  let usedWeight = 0;
  let totalWeight = 0;
  for (const [key, weightRaw] of Object.entries(weights)) {
    const weight = Number(weightRaw || 0);
    totalWeight += weight;
    const item = components[key];
    if (!item || !finite(item.normalized_score)) continue;
    const sourceQuality = finite(item.source_quality) ? clamp(item.source_quality) : 75;
    const freshness = finite(item.freshness_score) ? clamp(item.freshness_score) : 70;
    const internal = finite(item.confidence) ? clamp(item.confidence) : 70;
    weighted += ((sourceQuality * 0.4) + (freshness * 0.35) + (internal * 0.25)) * weight;
    usedWeight += weight;
  }
  const coverage = totalWeight ? usedWeight / totalWeight : 0;
  if (!usedWeight) return 0;
  return Math.round(clamp((weighted / usedWeight) * Math.sqrt(coverage)));
}

export function greedBand(score) {
  if (!finite(score)) return 'Unavailable';
  const s = Number(score);
  if (s <= 20) return 'Extreme Fear';
  if (s <= 40) return 'Fear';
  if (s <= 59) return 'Neutral';
  if (s <= 79) return 'Greed';
  return 'Extreme Greed';
}

export function valuationBand(score) {
  if (!finite(score)) return 'Unavailable';
  const s = Number(score);
  if (s <= 20) return 'Deep Value';
  if (s <= 40) return 'Attractive';
  if (s <= 60) return 'Fair Value';
  if (s <= 80) return 'Expensive';
  return 'Extreme Valuation';
}

export function matrixSignal(greed, valuation) {
  if (!finite(greed) || !finite(valuation)) return { code: 'INSUFFICIENT_DATA', label: 'Insufficient data', severity: 'neutral' };
  const g = Number(greed);
  const v = Number(valuation);
  if (g >= 80 && v >= 80) return { code: 'EUPHORIA_RISK', label: 'Capital preservation / Do not chase', severity: 'red' };
  if (g >= 60 && v >= 61) return { code: 'PRICE_DISCIPLINE', label: 'Wait / Price discipline', severity: 'amber' };
  if (g <= 20 && v <= 40) return { code: 'POTENTIAL_OPPORTUNITY', label: 'Potential opportunity', severity: 'green-dark' };
  if (g <= 40 && v <= 60) return { code: 'ACCUMULATION_ZONE', label: 'Accumulation zone', severity: 'green' };
  return { code: 'HOLD_ANALYZE', label: 'Hold / Analyze', severity: 'neutral' };
}

export function detectDivergences({ priceTrend, greedTrend, breadthTrend, fundamentalsTrend, valuationTrend } = {}) {
  const signals = [];
  if (priceTrend > 0 && greedTrend > 0 && breadthTrend < 0) signals.push({ code: 'NARROW_RALLY', severity: 'warning' });
  if (priceTrend < 0 && greedTrend < 0 && fundamentalsTrend >= 0) signals.push({ code: 'POTENTIAL_OPPORTUNITY', severity: 'opportunity' });
  if (priceTrend < 0 && valuationTrend < 0 && fundamentalsTrend < 0) signals.push({ code: 'VALUE_TRAP_RISK', severity: 'risk' });
  return signals;
}

export function stockOpportunityScore(input = {}) {
  const values = {
    quality: input.quality,
    valueAttractiveness: finite(input.valuation) ? 100 - Number(input.valuation) : null,
    growth: input.growth,
    momentum: input.momentum,
    riskSafety: input.riskSafety,
    marginOfSafety: input.marginOfSafety,
    sentimentDiscipline: finite(input.greed) ? 100 - Math.max(0, Number(input.greed) - 40) : null,
    regime: input.regimeScore,
    catalysts: input.catalysts
  };
  const weights = { quality: 20, valueAttractiveness: 20, growth: 10, momentum: 5, riskSafety: 10, marginOfSafety: 15, sentimentDiscipline: 10, regime: 5, catalysts: 5 };
  return weightedScore(values, weights, 0.65);
}

export function buildMarketSnapshot(payload = {}) {
  const greedCalc = weightedScore(payload.greed_components || {}, GREED_WEIGHTS, 0.6);
  const valuationCalc = weightedScore(payload.valuation_components || {}, VALUATION_WEIGHTS, 0.55);
  const greed = greedCalc.score;
  const valuation = valuationCalc.score;
  return {
    greed,
    greed_label: greedBand(greed),
    valuation,
    valuation_label: valuationBand(valuation),
    condition: matrixSignal(greed, valuation),
    confidence: Math.round((confidenceScore(payload.greed_components || {}, GREED_WEIGHTS) + confidenceScore(payload.valuation_components || {}, VALUATION_WEIGHTS)) / 2),
    coverage: { greed: greedCalc.coverage, valuation: valuationCalc.coverage }
  };
}
