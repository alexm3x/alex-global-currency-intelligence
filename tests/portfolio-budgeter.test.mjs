import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ALLOCATION_METHODS,
  compositeFromComponents,
  getRiskBand,
  optimizePortfolio,
  riskExposureFromScore,
} from '../components/portfolio-budgeter.js';

const currencies = [
  { code: 'JPY', score: 82, risk: 74, valuation: 94, fundamentals: 66, momentum: 71 },
  { code: 'MXN', score: 74, risk: 66, valuation: 69, fundamentals: 71, momentum: 82 },
  { code: 'BRL', score: 72, risk: 60, valuation: 80, fundamentals: 68, momentum: 73 },
];

test('risk-adjusted allocation fully invests the capital to the cent', () => {
  const result = optimizePortfolio({ capital: 1_000_000, currencies });
  const total = result.allocations.reduce((sum, row) => sum + row.amount, 0);
  assert.equal(total, 1_000_000);
  assert.equal(result.allocations.length, 3);
  assert.ok(result.allocations[0].percentage > result.allocations[1].percentage);
});

test('direct score allocation is proportional to AGCI Composite', () => {
  const result = optimizePortfolio({
    capital: 1_000,
    currencies: currencies.slice(0, 2),
    method: ALLOCATION_METHODS.DIRECT_SCORE,
  });
  const expectedJpy = 82 / (82 + 74);
  assert.ok(Math.abs(result.allocations[0].percentage / 100 - expectedJpy) < 0.0001);
});

test('risk-adjusted mode consumes all four published model components', () => {
  assert.equal(compositeFromComponents(currencies[0]), 76.85);
  const baseline = optimizePortfolio({ capital: 100, currencies });
  const weakenedMomentum = optimizePortfolio({
    capital: 100,
    currencies: [{ ...currencies[0], momentum: 0 }, ...currencies.slice(1)],
  });
  assert.ok(weakenedMomentum.allocations[0].amount < baseline.allocations[0].amount);
});

test('risk exposure uses inverse of the AGCI resilience score', () => {
  assert.equal(riskExposureFromScore(74), 26);
  assert.deepEqual(getRiskBand(30), { label: 'Bajo', tone: 'low' });
  assert.deepEqual(getRiskBand(31), { label: 'Medio', tone: 'medium' });
  assert.deepEqual(getRiskBand(56), { label: 'Alto', tone: 'high' });
});

test('invalid or empty inputs produce no allocation', () => {
  assert.deepEqual(optimizePortfolio({ capital: 0, currencies }).allocations, []);
  assert.deepEqual(optimizePortfolio({ capital: 100, currencies: [] }).allocations, []);
});

test('duplicate currency codes cannot create accidental double exposure', () => {
  const result = optimizePortfolio({
    capital: 100,
    currencies: [currencies[0], { ...currencies[0], name: 'duplicate' }],
  });
  assert.equal(result.allocations.length, 1);
  assert.equal(result.allocations[0].amount, 100);
});
