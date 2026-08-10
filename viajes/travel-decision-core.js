(() => {
  'use strict';

  const integer = (value, fallback, min, max) => Math.max(min, Math.min(max, Math.round(Number(value) || fallback)));

  function normalizeQuery(query = {}) {
    const adults = integer(query.adults, 1, 1, 12);
    const minors = integer(query.minors, 0, 0, 8);
    return {
      cabin: query.cabin === 'business' ? 'business' : 'tourist',
      nights: integer(query.nights, 7, 1, 60),
      adults,
      minors,
      travelers: adults + minors,
      rooms: integer(query.rooms, 1, 1, 8),
      budget: Math.max(0, Number(query.budget) || 0)
    };
  }

  function estimateTrip(destination = {}, query = {}) {
    const normalized = normalizeQuery(query);
    const flightPerTraveler = normalized.cabin === 'business'
      ? Number(destination.business_flight_mxn) || 0
      : Number(destination.economy_flight_mxn) || 0;
    const lodgingPerRoomNight = normalized.cabin === 'business'
      ? Number(destination.luxury_daily_mxn) || 0
      : Number(destination.moderate_daily_mxn) || 0;
    const flight = flightPerTraveler * normalized.travelers;
    const lodging = lodgingPerRoomNight * normalized.rooms * normalized.nights;
    const total = flight + lodging;
    const contingencyPct = destination.sourceType === 'live' ? .07 : .10;
    const contingency = Math.round(total * contingencyPct);
    return { ...normalized, flight, lodging, total, contingency, contingencyPct, conservative: total + contingency };
  }

  function assessBudget(destination, query = {}) {
    const estimate = estimateTrip(destination, query);
    if (!estimate.budget) return { ...estimate, status: 'open', delta: 0, deltaPct: 0 };
    const status = estimate.conservative <= estimate.budget
      ? 'within'
      : estimate.total <= estimate.budget ? 'adjusted' : 'outside';
    const delta = estimate.budget - estimate.total;
    return { ...estimate, status, delta, deltaPct: (delta / estimate.budget) * 100 };
  }

  function eligibleByBudget(destination, query = {}) {
    const assessment = assessBudget(destination, query);
    return !assessment.budget || assessment.status !== 'outside';
  }

  function fixedRecommendations(eligible = [], ranked = [], limit = 3) {
    const recommendations = [];
    const seen = new Set();
    const target = integer(limit, 3, 1, 10);

    for (const destination of [...eligible, ...ranked]) {
      const key = destination?.id || `${destination?.city || ''}|${destination?.country || ''}`;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      recommendations.push(destination);
      if (recommendations.length === target) break;
    }

    return recommendations;
  }

  window.TravelDecisionCore = {
    normalizeQuery,
    estimateTrip,
    assessBudget,
    eligibleByBudget,
    fixedRecommendations
  };
})();
