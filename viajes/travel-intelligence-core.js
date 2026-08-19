(() => {
  'use strict';

  const EXPERIENCE_WEIGHTS = Object.freeze({ importance: 0.20, exclusivity: 0.15, date_match: 0.15, affinity: 0.15, value: 0.10, availability: 0.05, location: 0.05, quality: 0.10, cultural_relevance: 0.03, rarity: 0.02 });
  const OPPORTUNITY_WEIGHTS = Object.freeze({ date_match: 0.30, rarity: 0.25, exclusivity: 0.20, importance: 0.10, availability: 0.05, affinity: 0.05, value: 0.05 });
  const WINDOW_WEIGHTS = Object.freeze({ extraordinary_events: 0.25, price_quality: 0.20, flight: 0.15, lodging: 0.15, affinity: 0.10, weather: 0.05, saturation: 0.05, logistics: 0.05 });

  const clamp = value => Math.max(0, Math.min(100, Number(value)));
  const finite = value => Number.isFinite(Number(value));

  function weightedScore(signals = {}, weights = {}) {
    let totalWeight = 0;
    let weighted = 0;
    Object.entries(weights).forEach(([key, weight]) => {
      const value = signals?.[key];
      if (!finite(value)) return;
      totalWeight += weight;
      weighted += clamp(value) * weight;
    });
    if (totalWeight <= 0) return null;
    return Math.round((weighted / totalWeight) * 10) / 10;
  }

  function classification(score) {
    if (!finite(score)) return 'PENDIENTE DE DATOS';
    if (score >= 90) return 'IMPERDIBLE';
    if (score >= 80) return 'MUY RECOMENDABLE';
    if (score >= 68) return 'RECOMENDABLE';
    if (score >= 55) return 'SI HAY TIEMPO';
    return 'PRESCINDIBLE';
  }

  function opportunityLabel(score) {
    if (!finite(score)) return 'PENDIENTE';
    if (score >= 92) return 'EXCEPCIONAL';
    if (score >= 80) return 'EXTRAORDINARIA';
    if (score >= 68) return 'BUEN VALOR';
    return 'NORMAL';
  }

  function eventPremium(item = {}) {
    return finite(item.event_premium_pct) ? Math.round(Number(item.event_premium_pct) * 10) / 10 : null;
  }
  function scoreExperience(item = {}) { return weightedScore(item.signals || {}, EXPERIENCE_WEIGHTS); }
  function scoreOpportunity(item = {}, collisionBoost = 0) {
    const base = weightedScore(item.signals || {}, OPPORTUNITY_WEIGHTS);
    if (!finite(base)) return null;
    return Math.round(Math.min(100, base + Math.max(0, Number(collisionBoost) || 0)) * 10) / 10;
  }
  function travelWindowScore(factors = {}, customWeights = {}) { return weightedScore(factors, { ...WINDOW_WEIGHTS, ...(customWeights || {}) }); }

  function collisionEngine(items = []) {
    const candidates = (Array.isArray(items) ? items : []).filter(item => {
      const opportunity = finite(item.opportunity_index) ? Number(item.opportunity_index) : scoreOpportunity(item);
      return opportunity >= 82 && item.verification_status === 'confirmed';
    });
    const count = candidates.length;
    const detected = count >= 3;
    const boost = detected ? Math.min(8, 2 + (count - 3) * 1.5) : 0;
    return { detected, count, boost: Math.round(boost * 10) / 10, label: detected ? 'TRAVEL COLLISION DETECTED' : 'Sin colisión extraordinaria' };
  }

  function enrichItem(item = {}, collisionBoost = 0) {
    const experience = scoreExperience(item);
    const opportunity = scoreOpportunity(item, collisionBoost);
    return { ...item, asc_experience_score: experience, opportunity_index: opportunity, executive_classification: classification(experience), opportunity_label: opportunityLabel(opportunity), event_premium_pct: eventPremium(item) };
  }

  function scoreResearch(payload = {}) {
    const rawItems = Array.isArray(payload.items) ? payload.items : [];
    let items = rawItems.map(item => enrichItem(item, 0));
    const firstCollision = collisionEngine(items);
    if (firstCollision.detected) items = rawItems.map(item => enrichItem(item, firstCollision.boost));
    const collision = collisionEngine(items);
    const confirmed = items.filter(item => item.verification_status === 'confirmed').length;
    const extraordinary = items.filter(item => Number(item.opportunity_index) >= 80).length;
    return { ...payload, items, scoring: { contract: 'asc-travel-intelligence-v1', experience_weights: EXPERIENCE_WEIGHTS, opportunity_weights: OPPORTUNITY_WEIGHTS, window_weights: WINDOW_WEIGHTS }, metrics: { total_items: items.length, confirmed_items: confirmed, extraordinary_items: extraordinary, collision } };
  }

  window.TravelIntelligenceCore = { EXPERIENCE_WEIGHTS, OPPORTUNITY_WEIGHTS, WINDOW_WEIGHTS, weightedScore, classification, opportunityLabel, eventPremium, scoreExperience, scoreOpportunity, travelWindowScore, collisionEngine, enrichItem, scoreResearch };
})();
