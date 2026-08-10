const BUY_ZONES = new Set(['ALTA CONVICCIÓN', 'COMPRA ATRACTIVA', 'COMPRA']);
const CAUTION_ZONES = new Set(['ESPERAR', 'SOBREVALORACIÓN']);
const HORIZONS = Object.freeze([1, 5, 20]);

const finite = value => value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value));
const round = (value, digits = 2) => Number(Number(value).toFixed(digits));
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

function toDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) / 86400000;
}

function daysBetween(a, b) {
  const da = toDay(a);
  const db = toDay(b);
  return da == null || db == null ? null : db - da;
}

function decisionsByTicker(snapshot = {}) {
  return new Map((snapshot.decisions || []).map(item => [item.ticker, item]));
}

function nearestFutureSnapshot(snapshots, originIndex, ticker, horizon) {
  const origin = snapshots[originIndex];
  let best = null;
  let bestGap = Infinity;
  for (let index = originIndex + 1; index < snapshots.length; index += 1) {
    const candidate = snapshots[index];
    const elapsed = daysBetween(origin.date || origin.generatedAt, candidate.date || candidate.generatedAt);
    if (!finite(elapsed) || elapsed < horizon) continue;
    const decision = decisionsByTicker(candidate).get(ticker);
    if (!decision || !finite(decision.price)) continue;
    const gap = elapsed - horizon;
    if (gap < bestGap) {
      best = { snapshot: candidate, decision, elapsedDays: elapsed };
      bestGap = gap;
    }
    if (gap === 0) break;
  }
  return best;
}

function outcomeDirection(zone, forwardReturnPct) {
  if (!finite(forwardReturnPct)) return null;
  if (BUY_ZONES.has(zone)) return Number(forwardReturnPct) > 0;
  if (CAUTION_ZONES.has(zone)) return Number(forwardReturnPct) <= 0;
  return null;
}

export function buildForwardObservations(snapshots = [], horizons = HORIZONS) {
  const ordered = [...snapshots]
    .filter(item => item && (item.date || item.generatedAt))
    .sort((a, b) => String(a.date || a.generatedAt).localeCompare(String(b.date || b.generatedAt)));
  const observations = [];

  ordered.forEach((origin, originIndex) => {
    for (const decision of origin.decisions || []) {
      if (!decision?.ticker || !finite(decision.price)) continue;
      for (const horizon of horizons) {
        const future = nearestFutureSnapshot(ordered, originIndex, decision.ticker, horizon);
        if (!future) continue;
        const forwardReturnPct = (Number(future.decision.price) / Number(decision.price) - 1) * 100;
        observations.push({
          ticker: decision.ticker,
          originDate: origin.date || origin.generatedAt,
          outcomeDate: future.snapshot.date || future.snapshot.generatedAt,
          elapsedDays: future.elapsedDays,
          horizonDays: horizon,
          originPrice: Number(decision.price),
          outcomePrice: Number(future.decision.price),
          forwardReturnPct: round(forwardReturnPct, 2),
          zone: decision.zone || decision.label || 'N/D',
          decisionScore: finite(decision.decisionScore) ? Number(decision.decisionScore) : null,
          preparationScore: finite(decision.preparationScore) ? Number(decision.preparationScore) : null,
          contextLabel: decision.context?.label || 'N/D',
          contextPoints: finite(decision.context?.totalPoints) ? Number(decision.context.totalPoints) : null,
          directionalHit: outcomeDirection(decision.zone || decision.label, forwardReturnPct)
        });
      }
    }
  });
  return observations;
}

function summarizeGroup(items) {
  const returns = items.map(item => item.forwardReturnPct).filter(finite).map(Number);
  const scoredHits = items.map(item => item.directionalHit).filter(value => typeof value === 'boolean');
  return {
    observations: returns.length,
    averageForwardReturnPct: returns.length ? round(avg(returns), 2) : null,
    medianForwardReturnPct: returns.length ? round(median(returns), 2) : null,
    directionalObservations: scoredHits.length,
    directionalHitRatePct: scoredHits.length ? round((scoredHits.filter(Boolean).length / scoredHits.length) * 100, 1) : null,
    status: returns.length >= 5 ? 'measurable' : 'insufficient-history'
  };
}

export function buildLearningReport(snapshots = [], now = new Date()) {
  const observations = buildForwardObservations(snapshots);
  const byHorizon = {};
  for (const horizon of HORIZONS) {
    const subset = observations.filter(item => item.horizonDays === horizon);
    byHorizon[`${horizon}d`] = {
      all: summarizeGroup(subset),
      buyTerrain: summarizeGroup(subset.filter(item => BUY_ZONES.has(item.zone))),
      cautionTerrain: summarizeGroup(subset.filter(item => CAUTION_ZONES.has(item.zone))),
      contextualSupport: summarizeGroup(subset.filter(item => ['Soporte fuerte', 'Soporte'].includes(item.contextLabel))),
      contextualCaution: summarizeGroup(subset.filter(item => ['Cautela', 'Cautela alta'].includes(item.contextLabel)))
    };
  }

  const dated = snapshots.filter(item => item?.date || item?.generatedAt);
  const first = dated.length ? dated.reduce((min, item) => String(item.date || item.generatedAt) < min ? String(item.date || item.generatedAt) : min, String(dated[0].date || dated[0].generatedAt)) : null;
  const last = dated.length ? dated.reduce((max, item) => String(item.date || item.generatedAt) > max ? String(item.date || item.generatedAt) : max, String(dated[0].date || dated[0].generatedAt)) : null;
  const historyDays = first && last ? daysBetween(first, last) : 0;
  const measurableHorizons = Object.entries(byHorizon).filter(([, value]) => value.all.status === 'measurable').map(([key]) => key);

  const tickerStats = {};
  for (const item of observations) {
    const key = item.ticker;
    tickerStats[key] ||= {};
    tickerStats[key][`${item.horizonDays}d`] ||= [];
    tickerStats[key][`${item.horizonDays}d`].push(item);
  }
  for (const ticker of Object.keys(tickerStats)) {
    for (const horizon of Object.keys(tickerStats[ticker])) tickerStats[ticker][horizon] = summarizeGroup(tickerStats[ticker][horizon]);
  }

  return {
    schemaVersion: 1,
    generatedAt: now.toISOString(),
    status: measurableHorizons.length ? 'learning-active' : 'collecting-history',
    methodology: {
      horizonsDays: HORIZONS,
      minimumObservationsForMeasurement: 5,
      principle: 'A decision is evaluated only after subsequent observed prices exist. No backfilled or synthetic outcomes are created.',
      directionalRule: 'Buy-zone observations are directional hits when forward return is positive; wait/overvaluation observations are hits when forward return is non-positive. Observe-zone decisions are not scored as binary hits.'
    },
    history: {
      snapshots: dated.length,
      firstDate: first,
      lastDate: last,
      calendarSpanDays: historyDays,
      forwardObservations: observations.length,
      measurableHorizons
    },
    byHorizon,
    byTicker: tickerStats,
    evidenceLift: buildEvidenceLift(observations),
    recentObservations: observations.slice(-50)
  };
}

export function buildEvidenceLift(observations = []) {
  const output = {};
  for (const horizon of HORIZONS) {
    const base = observations.filter(item => item.horizonDays === horizon && BUY_ZONES.has(item.zone));
    const support = base.filter(item => ['Soporte fuerte', 'Soporte'].includes(item.contextLabel));
    const nonSupport = base.filter(item => !['Soporte fuerte', 'Soporte'].includes(item.contextLabel));
    const a = summarizeGroup(support);
    const b = summarizeGroup(nonSupport);
    output[`${horizon}d`] = {
      support: a,
      comparison: b,
      averageReturnLiftPctPoints: a.observations >= 5 && b.observations >= 5 && finite(a.averageForwardReturnPct) && finite(b.averageForwardReturnPct)
        ? round(Number(a.averageForwardReturnPct) - Number(b.averageForwardReturnPct), 2)
        : null,
      status: a.observations >= 5 && b.observations >= 5 ? 'measurable' : 'insufficient-history'
    };
  }
  return output;
}

export function learningForTicker(report = {}, ticker = '') {
  return report?.byTicker?.[String(ticker).toUpperCase()] || null;
}

export { BUY_ZONES, CAUTION_ZONES, HORIZONS };
