const DEFAULT_WEIGHTS = Object.freeze({
  quality: 20,
  valuation: 20,
  growth: 15,
  profitability: 15,
  balance: 10,
  momentum: 5,
  risk: 15
});

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));
const avg = values => {
  const valid = values.filter(finite).map(Number);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
};
const median = values => {
  const valid = values.filter(finite).map(Number).sort((a, b) => a - b);
  if (!valid.length) return null;
  const mid = Math.floor(valid.length / 2);
  return valid.length % 2 ? valid[mid] : (valid[mid - 1] + valid[mid]) / 2;
};

function scoreBand(value, bands) {
  if (!finite(value)) return null;
  const v = Number(value);
  for (const [limit, score] of bands) if (v <= limit) return score;
  return bands.at(-1)?.[1] ?? 50;
}

export function profitabilityScore(company = {}) {
  const r = company.ratios || {};
  const roic = scoreBand(r.roic, [[0, 15], [0.05, 35], [0.10, 55], [0.15, 70], [0.25, 85], [Infinity, 95]]);
  const op = scoreBand(r.operatingMargin, [[0, 20], [0.05, 35], [0.10, 50], [0.20, 70], [0.30, 85], [Infinity, 95]]);
  const roe = scoreBand(r.roe, [[0, 20], [0.08, 40], [0.15, 60], [0.25, 80], [Infinity, 92]]);
  const cash = scoreBand(r.cashConversion, [[0, 15], [0.60, 45], [0.90, 65], [1.20, 82], [Infinity, 92]]);
  return Math.round(avg([roic, op, roe, cash]) ?? 50);
}

export function riskSafetyScore(analysis = {}) {
  const c = analysis.company || {};
  const r = c.ratios || {};
  const g = c.growth || {};
  let score = 88;
  if (finite(r.netDebtToEbitda)) {
    if (Number(r.netDebtToEbitda) > 4) score -= 35;
    else if (Number(r.netDebtToEbitda) > 3) score -= 25;
    else if (Number(r.netDebtToEbitda) > 2) score -= 12;
    else if (Number(r.netDebtToEbitda) < 0) score += 5;
  } else score -= 8;
  if (finite(c.fundamentals?.freeCashFlow) && Number(c.fundamentals.freeCashFlow) < 0) score -= 25;
  if (finite(g.revenueYoY) && Number(g.revenueYoY) < 0) score -= 10;
  if (finite(g.fcfYoY) && Number(g.fcfYoY) < -0.20) score -= 10;
  if (Number(analysis.score?.quality ?? 50) < 40) score -= 10;
  if (Number(analysis.score?.financialStrength ?? 50) < 40) score -= 12;
  if (Number(analysis.confidence ?? 0) < 60) score -= 12;
  if (analysis.isStale || c.isStale) score -= 8;
  return Math.round(clamp(score, 0, 100));
}

export function valuationAnchors(analysis = {}) {
  const c = analysis.company || {};
  const m = analysis.medians || {};
  const r = c.ratios || {};
  const f = c.fundamentals || {};
  const price = Number(c.price);
  const shares = Number(f.shares);
  const anchors = [];
  if (!finite(price) || price <= 0 || !finite(shares) || shares <= 0) return anchors;

  const pe = Number(r.peTTM);
  const medianPe = Number(m['ratios.peTTM']);
  if (finite(pe) && pe > 0 && finite(medianPe) && medianPe > 0) {
    const eps = price / pe;
    anchors.push({ id: 'pe', label: 'P/E comparable', value: eps * medianPe });
  }

  const medianPs = Number(m['ratios.priceToSales']);
  if (finite(f.revenue) && Number(f.revenue) > 0 && finite(medianPs) && medianPs > 0) {
    anchors.push({ id: 'ps', label: 'P/S comparable', value: (Number(f.revenue) / shares) * medianPs });
  }

  const medianEv = Number(m['ratios.evEbitda']);
  if (finite(f.ebitda) && Number(f.ebitda) > 0 && finite(medianEv) && medianEv > 0) {
    const equityValue = medianEv * Number(f.ebitda) - Number(f.debt || 0) + Number(f.cash || 0);
    if (equityValue > 0) anchors.push({ id: 'ev', label: 'EV/EBITDA comparable', value: equityValue / shares });
  }

  const medianFcfYield = Number(m['ratios.fcfYield']);
  if (finite(f.freeCashFlow) && Number(f.freeCashFlow) > 0 && finite(medianFcfYield) && medianFcfYield > 0) {
    anchors.push({ id: 'fcf', label: 'FCF Yield comparable', value: (Number(f.freeCashFlow) / shares) / medianFcfYield });
  }

  return anchors
    .filter(item => finite(item.value) && item.value > 0 && item.value < price * 6)
    .map(item => ({ ...item, value: Number(item.value) }));
}

export function fairValueEstimate(analysis = {}) {
  const anchors = valuationAnchors(analysis);
  if (!anchors.length) return { fairValue: null, anchors, method: 'insufficient' };
  const values = anchors.map(item => item.value);
  return {
    fairValue: median(values),
    anchors,
    method: anchors.length >= 2 ? 'median-comparable-anchors' : 'single-comparable-anchor'
  };
}

export function requiredMarginOfSafety(analysis = {}, preparationScore = null) {
  const s = analysis.score || {};
  const r = analysis.company?.ratios || {};
  let margin = 0.12;
  if (Number(s.quality ?? 50) < 45) margin += 0.05;
  if (Number(s.financialStrength ?? 50) < 45) margin += 0.05;
  if (Number(s.growth ?? 50) < 35) margin += 0.03;
  if (finite(r.netDebtToEbitda) && Number(r.netDebtToEbitda) > 3) margin += 0.05;
  if (finite(preparationScore) && Number(preparationScore) < 70) margin += 0.05;
  if (analysis.isStale) margin += 0.03;
  if (Number(s.quality ?? 0) >= 80 && Number(s.financialStrength ?? 0) >= 75 && Number(preparationScore ?? 0) >= 80) margin -= 0.03;
  return clamp(margin, 0.08, 0.35);
}

export function preparationScore(analysis = {}, anchorCount = null) {
  const coverage = Number(analysis.company?.dataCoverage ?? 0);
  const confidence = Number(analysis.confidence ?? 0);
  let score = confidence * 0.58 + coverage * 0.42;
  if (analysis.isStale || analysis.company?.isStale) score -= 8;
  if (finite(anchorCount) && Number(anchorCount) < 2) score -= 10;
  return Math.round(clamp(score, 0, 100));
}

export function decisionComponents(analysis = {}) {
  const score = analysis.score || {};
  return {
    quality: Math.round(clamp(score.quality ?? 50, 0, 100)),
    valuation: Math.round(clamp(score.valuation ?? 50, 0, 100)),
    growth: Math.round(clamp(score.growth ?? 50, 0, 100)),
    profitability: profitabilityScore(analysis.company),
    balance: Math.round(clamp(score.financialStrength ?? 50, 0, 100)),
    momentum: Math.round(clamp(score.momentum ?? 50, 0, 100)),
    risk: riskSafetyScore(analysis)
  };
}

export function decisionScore(analysis = {}, weights = DEFAULT_WEIGHTS) {
  const components = decisionComponents(analysis);
  const totalWeight = Object.values(weights).reduce((sum, value) => sum + Number(value || 0), 0) || 100;
  const weighted = Object.entries(weights).reduce((sum, [key, weight]) => sum + Number(components[key] ?? 50) * Number(weight || 0), 0);
  return { total: Math.round(weighted / totalWeight), components, weights: { ...weights } };
}

export function buildTerrain(analysis = {}) {
  const price = finite(analysis.company?.price) ? Number(analysis.company.price) : null;
  const fair = fairValueEstimate(analysis);
  const prep = preparationScore(analysis, fair.anchors.length);
  const margin = requiredMarginOfSafety(analysis, prep);
  const fairValue = fair.fairValue;
  if (!finite(price) || !finite(fairValue)) {
    return { price, fairValue: null, preparationScore: prep, marginOfSafetyRequired: margin, anchors: fair.anchors, method: fair.method, status: 'INFORMACIÓN INSUFICIENTE' };
  }

  const buy = fairValue * (1 - margin);
  const attractive = fairValue * (1 - clamp(margin + 0.10, 0, 0.48));
  const highConviction = fairValue * (1 - clamp(margin + 0.20, 0, 0.62));
  const waitCeiling = fairValue * 1.15;
  const correctionToBuyPct = (buy / price - 1) * 100;
  const mosCurrent = (fairValue - price) / fairValue;

  let zone = 'ESPERAR';
  if (prep < 45) zone = 'INFORMACIÓN INSUFICIENTE';
  else if (price <= highConviction) zone = 'ALTA CONVICCIÓN';
  else if (price <= attractive) zone = 'COMPRA ATRACTIVA';
  else if (price <= buy) zone = 'COMPRA';
  else if (price <= fairValue) zone = 'OBSERVAR';
  else if (price <= waitCeiling) zone = 'ESPERAR';
  else zone = 'SOBREVALORACIÓN';

  return {
    price,
    fairValue,
    buy,
    attractive,
    highConviction,
    waitCeiling,
    correctionToBuyPct,
    marginOfSafetyCurrent: mosCurrent,
    marginOfSafetyRequired: margin,
    preparationScore: prep,
    anchors: fair.anchors,
    method: fair.method,
    status: zone
  };
}

function reasonList(analysis, terrain, decision) {
  const c = analysis.company || {};
  const s = decision.components;
  const positives = [];
  const concerns = [];
  if (s.quality >= 70) positives.push(`Calidad operativa alta (${s.quality}/100).`);
  if (s.profitability >= 70) positives.push(`Rentabilidad sólida (${s.profitability}/100).`);
  if (s.balance >= 70) positives.push(`Balance y cobertura financiera favorables (${s.balance}/100).`);
  if (s.growth >= 65) positives.push(`Crecimiento relativo favorable (${s.growth}/100).`);
  if (s.valuation >= 65) positives.push(`Valuación relativa atractiva frente a comparables (${s.valuation}/100).`);
  if (finite(c.ratios?.roic) && Number(c.ratios.roic) > 0.15) positives.push(`ROIC elevado: ${(Number(c.ratios.roic) * 100).toFixed(1)}%.`);

  if (s.valuation < 45) concerns.push(`Valuación exigente frente al grupo (${s.valuation}/100).`);
  if (s.risk < 55) concerns.push(`Riesgo cuantitativo elevado (${s.risk}/100 en seguridad).`);
  if (s.balance < 45) concerns.push(`Solidez financiera inferior a la deseada (${s.balance}/100).`);
  if (s.growth < 40) concerns.push(`Crecimiento débil o inconsistente (${s.growth}/100).`);
  if (terrain.preparationScore < 65) concerns.push(`Preparación incompleta (${terrain.preparationScore}/100); falta evidencia para alta convicción.`);
  if (finite(terrain.correctionToBuyPct) && terrain.correctionToBuyPct < -2) concerns.push(`El precio requiere una corrección aproximada de ${Math.abs(terrain.correctionToBuyPct).toFixed(1)}% para entrar en terreno de compra.`);
  if (analysis.isStale) concerns.push('Parte de la información proviene de caché; confirmar antes de ejecutar.');
  return { positives: positives.slice(0, 5), concerns: concerns.slice(0, 5) };
}

export function positionSizing(status, prep = 0, risk = 50) {
  if (prep < 55 || risk < 40) return '0% · Esperar más evidencia';
  if (status === 'ALTA CONVICCIÓN') return prep >= 80 && risk >= 65 ? '4–6%' : '3–4%';
  if (status === 'COMPRA ATRACTIVA') return '2–4%';
  if (status === 'COMPRA') return '1–2%';
  return '0% · Observación';
}

export function buildDecision(analysis = {}, weights = DEFAULT_WEIGHTS) {
  const terrain = buildTerrain(analysis);
  const score = decisionScore(analysis, weights);
  const reasons = reasonList(analysis, terrain, score);
  const price = terrain.price;
  const buy = terrain.buy;
  let label = terrain.status;
  if (terrain.status === 'SOBREVALORACIÓN' && score.total < 50) label = 'EVITAR';
  const whatMakesBuy = [];
  if (finite(buy)) whatMakesBuy.push(`Precio ≤ ${buy.toFixed(2)} USD manteniendo la tesis fundamental.`);
  if (terrain.preparationScore < 70) whatMakesBuy.push('Elevar Preparation Score a ≥70 con datos recientes y suficientes.');
  if (Number(score.components.quality) < 55) whatMakesBuy.push('Mejora verificable en calidad/ROIC antes de aumentar convicción.');
  if (Number(score.components.balance) < 55) whatMakesBuy.push('Mejora del balance o reducción del apalancamiento.');
  if (!whatMakesBuy.length) whatMakesBuy.push('Mantener fundamentales intactos y respetar el tamaño de posición definido.');

  const invalidates = [];
  if (finite(analysis.company?.fundamentals?.freeCashFlow) && Number(analysis.company.fundamentals.freeCashFlow) > 0) invalidates.push('Flujo de caja libre se vuelve negativo de forma persistente.');
  invalidates.push('Deterioro material de ROIC, márgenes o balance respecto al caso analizado.');
  invalidates.push('Nueva información reduce significativamente la confianza o cambia los comparables relevantes.');

  return {
    ticker: analysis.ticker,
    companyName: analysis.company?.companyName || analysis.ticker,
    label,
    decisionScore: score.total,
    components: score.components,
    weights: score.weights,
    preparationScore: terrain.preparationScore,
    confidence: terrain.preparationScore,
    terrain,
    reasons,
    whatMakesBuy: whatMakesBuy.slice(0, 4),
    invalidates: invalidates.slice(0, 4),
    positionSizing: positionSizing(label, terrain.preparationScore, score.components.risk),
    preferredComparable: analysis.preferredComparable || null,
    sourceAnalysis: analysis,
    distanceToBuyPct: finite(price) && finite(buy) ? (buy / price - 1) * 100 : null
  };
}

export function rankRadar(analyses = [], weights = DEFAULT_WEIGHTS) {
  return analyses
    .filter(item => item?.company)
    .map(item => buildDecision(item, weights))
    .sort((a, b) => {
      const aReady = ['ALTA CONVICCIÓN', 'COMPRA ATRACTIVA', 'COMPRA'].includes(a.label) ? 1 : 0;
      const bReady = ['ALTA CONVICCIÓN', 'COMPRA ATRACTIVA', 'COMPRA'].includes(b.label) ? 1 : 0;
      if (aReady !== bReady) return bReady - aReady;
      const ad = finite(a.distanceToBuyPct) ? Math.abs(Math.min(0, a.distanceToBuyPct)) : 999;
      const bd = finite(b.distanceToBuyPct) ? Math.abs(Math.min(0, b.distanceToBuyPct)) : 999;
      if (ad !== bd) return ad - bd;
      return b.decisionScore - a.decisionScore;
    });
}

export { DEFAULT_WEIGHTS };
