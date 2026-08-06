(() => {
  'use strict';

  const VERSION = 'travel-data-v4';
  const SOURCE_TYPES = new Set(['live', 'cached', 'estimated', 'baseline']);

  const numberOr = (value, fallback = 0) => Number.isFinite(Number(value)) ? Number(value) : fallback;
  const textOr = (value, fallback = '') => typeof value === 'string' && value.trim() ? value : fallback;

  function sourceTypeFor(destination, raw) {
    const declared = destination?.sourceType;
    if (SOURCE_TYPES.has(declared)) return declared;
    return raw?.source_status?.cost_model ? 'baseline' : 'estimated';
  }

  function normalizeDestination(destination, raw) {
    const sourceType = sourceTypeFor(destination, raw);
    const observedAt = textOr(destination.observedAt, raw?.meta?.generated_at || new Date(0).toISOString());
    const moderateTotal = numberOr(destination.moderate_total_7n_mxn);
    const businessTotal = numberOr(destination.business_total_7n_mxn);
    const observedTime = new Date(observedAt).getTime();
    const staleByAge = Number.isFinite(observedTime) && Date.now() - observedTime > 18 * 60 * 60 * 1000;
    return {
      ...destination,
      sourceType,
      observedAt,
      updatedAt: textOr(destination.updatedAt, observedAt),
      isStale: Boolean(destination.isStale ?? raw?.isStale ?? staleByAge),
      confidence: numberOr(destination.confidence, sourceType === 'live' ? .9 : sourceType === 'cached' ? .75 : .6),
      priceComponents: destination.priceComponents || {
        economyFlight: numberOr(destination.economy_flight_mxn),
        businessFlight: numberOr(destination.business_flight_mxn),
        moderateDaily: numberOr(destination.moderate_daily_mxn),
        luxuryDaily: numberOr(destination.luxury_daily_mxn)
      },
      totalPrice: destination.totalPrice || { tourist: moderateTotal, business: businessTotal },
      budgetDelta: Number.isFinite(Number(destination.budgetDelta)) ? Number(destination.budgetDelta) : null,
      benchmarkPrice: Number.isFinite(Number(destination.benchmarkPrice)) ? Number(destination.benchmarkPrice) : null,
      discountPercent: Number.isFinite(Number(destination.discountPercent)) ? Number(destination.discountPercent) : null,
      fxNominalAdvantage: numberOr(destination.fxNominalAdvantage, destination.fx_advantage_pct),
      fxRealAdvantage: Number.isFinite(Number(destination.fxRealAdvantage)) ? Number(destination.fxRealAdvantage) : null,
      inflationAdjustment: Number.isFinite(Number(destination.inflationAdjustment)) ? Number(destination.inflationAdjustment) : null,
      qualityScore: numberOr(destination.qualityScore, destination.quality_score),
      connectivityScore: numberOr(destination.connectivityScore, destination.connectivity_score),
      riskScore: numberOr(destination.riskScore, Math.max(0, 100 - numberOr(destination.volatility_annualized_pct) * 2)),
      decision: textOr(destination.decision, 'DATOS INSUFICIENTES'),
      decisionReason: textOr(destination.decisionReason, 'Los costos son baselines de planeación y requieren cotización verificable.'),
      deepLink: textOr(destination.deepLink, destination.google_travel?.google_flights_economy || ''),
      sources: Array.isArray(destination.sources) ? destination.sources : [
        raw?.source_status?.current_fx_source,
        raw?.source_status?.historical_fx_source
      ].filter(Boolean)
    };
  }

  function normalize(raw) {
    if (!raw || typeof raw !== 'object') throw new Error('travel-data-v4: payload ausente');
    const destinations = Array.isArray(raw.destinations) ? raw.destinations : [];
    if (!destinations.length) throw new Error('travel-data-v4: no hay destinos válidos');
    return {
      ...raw,
      contract: VERSION,
      meta: { ...(raw.meta || {}), schema_version: VERSION, destination_count: destinations.length },
      destinations: destinations.map(destination => normalizeDestination(destination, raw))
    };
  }

  function validate(data) {
    const errors = [];
    if (data?.meta?.schema_version !== VERSION) errors.push('schema_version');
    if (!Array.isArray(data?.destinations) || !data.destinations.length) errors.push('destinations');
    data?.destinations?.forEach((destination, index) => {
      if (!destination.id) errors.push(`destinations[${index}].id`);
      if (!SOURCE_TYPES.has(destination.sourceType)) errors.push(`destinations[${index}].sourceType`);
      if (!destination.observedAt) errors.push(`destinations[${index}].observedAt`);
      if (!destination.priceComponents) errors.push(`destinations[${index}].priceComponents`);
    });
    return { valid: errors.length === 0, errors };
  }

  window.TravelDataV4 = { VERSION, normalize, validate };
})();
