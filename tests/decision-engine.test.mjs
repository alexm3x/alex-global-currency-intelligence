import test from 'node:test';
import assert from 'node:assert/strict';
import { fairValueEstimate, intrinsicFcfAnchor, preparationScore, requiredMarginOfSafety, buildDecision, rankRadar } from '../decision-engine-core.js';

function analysis(overrides = {}) {
  const base = {
    ticker: 'TEST',
    confidence: 85,
    isStale: false,
    score: { valuation: 70, growth: 68, quality: 82, financialStrength: 78, momentum: 55 },
    medians: {
      'ratios.peTTM': 20,
      'ratios.priceToSales': 4,
      'ratios.evEbitda': 14,
      'ratios.fcfYield': 0.04
    },
    company: {
      companyName: 'Test Corp',
      price: 100,
      currency: 'USD',
      dataCoverage: 90,
      isStale: false,
      fundamentals: { shares: 100, revenue: 2500, ebitda: 500, freeCashFlow: 400, debt: 300, cash: 200 },
      ratios: { peTTM: 25, roic: 0.22, operatingMargin: 0.20, roe: 0.24, cashConversion: 1.05, netDebtToEbitda: 0.2, fcfYield: 0.04 },
      growth: { revenueYoY: 0.12, fcfYoY: 0.10 }
    },
    preferredComparable: { ticker: 'PEER', score: 78 }
  };
  return {
    ...base,
    ...overrides,
    score: { ...base.score, ...(overrides.score || {}) },
    medians: { ...base.medians, ...(overrides.medians || {}) },
    company: {
      ...base.company,
      ...(overrides.company || {}),
      fundamentals: { ...base.company.fundamentals, ...(overrides.company?.fundamentals || {}) },
      ratios: { ...base.company.ratios, ...(overrides.company?.ratios || {}) },
      growth: { ...base.company.growth, ...(overrides.company?.growth || {}) }
    }
  };
}

test('fair value blends comparable anchors with a conservative intrinsic FCF anchor', () => {
  const source = analysis();
  const result = fairValueEstimate(source);
  assert.equal(result.anchors.length, 5);
  assert.ok(result.anchors.some(anchor => anchor.id === 'dcf-fcf'));
  assert.ok(Number.isFinite(result.fairValue));
  assert.ok(result.fairValue > 0);
  assert.ok(result.fairValue < source.company.price * 6);
  assert.equal(result.method, 'median-mixed-anchors');
});

test('intrinsic FCF anchor remains available when peer valuation medians are missing', () => {
  const result = fairValueEstimate(analysis({ medians: {
    'ratios.peTTM': null,
    'ratios.priceToSales': null,
    'ratios.evEbitda': null,
    'ratios.fcfYield': null
  } }));
  assert.equal(result.anchors.length, 1);
  assert.equal(result.anchors[0].id, 'dcf-fcf');
  assert.equal(result.method, 'single-intrinsic-anchor');
  assert.ok(Number.isFinite(result.fairValue));
});

test('intrinsic FCF model refuses to manufacture an anchor without enough growth evidence', () => {
  const anchor = intrinsicFcfAnchor(analysis({ company: { growth: { revenueYoY: null, fcfYoY: null } } }));
  assert.equal(anchor, null);
});

test('preparation score falls when data is stale and anchors are insufficient', () => {
  const fresh = preparationScore(analysis(), 5);
  const stale = preparationScore(analysis({ isStale: true, confidence: 55, company: { dataCoverage: 50, isStale: true } }), 1);
  assert.ok(fresh >= 80);
  assert.ok(stale < 55);
});

test('margin of safety increases for weak balance and low preparation', () => {
  const strong = requiredMarginOfSafety(analysis(), 90);
  const weak = requiredMarginOfSafety(analysis({ score: { quality: 35, financialStrength: 30, growth: 25 }, company: { ratios: { netDebtToEbitda: 4.2 } } }), 50);
  assert.ok(strong <= 0.12);
  assert.ok(weak >= 0.30);
});

test('decision engine exposes terrain, why, sizing and non-binary decision', () => {
  const result = buildDecision(analysis());
  assert.ok(Number.isFinite(result.decisionScore));
  assert.ok(Number.isFinite(result.preparationScore));
  assert.ok(Number.isFinite(result.terrain.fairValue));
  assert.ok(Number.isFinite(result.terrain.buy));
  assert.ok(Array.isArray(result.reasons.positives));
  assert.ok(Array.isArray(result.whatMakesBuy));
  assert.match(result.positionSizing, /%/);
});

test('insufficient price evidence never fabricates fair value', () => {
  const result = buildDecision(analysis({ company: { price: null } }));
  assert.equal(result.terrain.fairValue, null);
  assert.equal(result.label, 'INFORMACIÓN INSUFICIENTE');
});

test('radar prioritizes names already inside buy terrain', () => {
  const cheap = analysis({ ticker: 'CHEAP', company: { companyName: 'Cheap Corp', price: 60 } });
  const expensive = analysis({ ticker: 'RICH', company: { companyName: 'Rich Corp', price: 160 } });
  const ranked = rankRadar([expensive, cheap]);
  assert.equal(ranked[0].ticker, 'CHEAP');
});
