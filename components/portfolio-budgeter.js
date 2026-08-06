const DEFAULT_MAX_CAPITAL = 1_000_000_000;

export const ALLOCATION_METHODS = Object.freeze({
  RISK_ADJUSTED: 'risk-adjusted',
  DIRECT_SCORE: 'direct-score',
});

function finiteScore(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(100, Math.max(0, number));
}

export function compositeFromComponents(currency) {
  return (
    finiteScore(currency?.valuation) * 0.30
    + finiteScore(currency?.fundamentals) * 0.30
    + finiteScore(currency?.momentum) * 0.25
    + finiteScore(currency?.risk, 50) * 0.15
  );
}

export function normalizeCapital(value, maxCapital = DEFAULT_MAX_CAPITAL) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(number, maxCapital);
}

export function riskExposureFromScore(riskScore) {
  return 100 - finiteScore(riskScore, 50);
}

export function getRiskBand(exposure) {
  const normalized = Math.min(100, Math.max(0, Number(exposure) || 0));
  if (normalized <= 30) return { label: 'Bajo', tone: 'low' };
  if (normalized <= 55) return { label: 'Medio', tone: 'medium' };
  return { label: 'Alto', tone: 'high' };
}

function allocationStrength(currency, method) {
  const componentScore = compositeFromComponents(currency);
  const score = finiteScore(currency.score, componentScore);
  if (method === ALLOCATION_METHODS.DIRECT_SCORE) return score;

  // AGCI Risk is a resilience score: 100 is safer, not riskier.
  // The five-point floor prevents an extremely safe score from dominating.
  const riskExposure = Math.max(5, riskExposureFromScore(currency.risk));
  return componentScore / riskExposure;
}

function allocateCents(totalCents, strengths) {
  const strengthTotal = strengths.reduce((sum, value) => sum + value, 0);
  if (!totalCents || !strengthTotal) return strengths.map(() => 0);

  const exact = strengths.map((strength) => (totalCents * strength) / strengthTotal);
  const allocated = exact.map(Math.floor);
  let remainder = totalCents - allocated.reduce((sum, value) => sum + value, 0);

  const remainderOrder = exact
    .map((value, index) => ({ index, fraction: value - allocated[index] }))
    .sort((a, b) => b.fraction - a.fraction || a.index - b.index);

  for (let index = 0; remainder > 0; index += 1, remainder -= 1) {
    allocated[remainderOrder[index % remainderOrder.length].index] += 1;
  }

  return allocated;
}

/**
 * Produces a fully invested illustrative portfolio.
 * The currency objects must contain code, score and risk. The other model
 * components are retained in each row for transparent display and audit.
 */
export function optimizePortfolio({
  capital,
  currencies,
  method = ALLOCATION_METHODS.RISK_ADJUSTED,
}) {
  const safeCapital = normalizeCapital(capital);
  const uniqueCurrencies = [...new Map(
    (Array.isArray(currencies) ? currencies : [])
      .filter((currency) => currency?.code)
      .map((currency) => [String(currency.code).toUpperCase(), currency]),
  ).values()];

  if (!safeCapital || !uniqueCurrencies.length) {
    return { allocations: [], riskExposure: 0, riskBand: getRiskBand(0) };
  }

  const strengths = uniqueCurrencies.map((currency) =>
    allocationStrength(currency, method),
  );
  if (!strengths.some((value) => value > 0)) {
    return { allocations: [], riskExposure: 0, riskBand: getRiskBand(0) };
  }

  const totalCents = Math.round(safeCapital * 100);
  const amountsInCents = allocateCents(totalCents, strengths);
  const allocations = uniqueCurrencies.map((currency, index) => {
    const amount = amountsInCents[index] / 100;
    return {
      ...currency,
      code: String(currency.code).toUpperCase(),
      amount,
      percentage: (amount / safeCapital) * 100,
      riskExposure: riskExposureFromScore(currency.risk),
    };
  });

  const riskExposure = allocations.reduce(
    (sum, allocation) =>
      sum + (allocation.percentage / 100) * allocation.riskExposure,
    0,
  );

  return {
    allocations,
    riskExposure,
    riskBand: getRiskBand(riskExposure),
  };
}
