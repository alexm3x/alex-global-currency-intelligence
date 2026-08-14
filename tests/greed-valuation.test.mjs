import assert from 'node:assert/strict';
import { weightedScore, greedBand, valuationBand, matrixSignal, detectDivergences, stockOpportunityScore } from '../greed-valuation-core.js';

const weights = { a: 50, b: 50 };
assert.deepEqual(weightedScore({a:{normalized_score:80},b:{normalized_score:60}}, weights, .5).score, 70);
assert.equal(weightedScore({a:{normalized_score:80}}, weights, .6).score, null, 'must withhold when coverage is insufficient');
assert.equal(weightedScore({a:{normalized_score:null},b:{normalized_score:null}}, weights, .5).score, null, 'missing values must never become neutral');

assert.equal(greedBand(20), 'Extreme Fear');
assert.equal(greedBand(21), 'Fear');
assert.equal(greedBand(80), 'Extreme Greed');
assert.equal(valuationBand(20), 'Deep Value');
assert.equal(valuationBand(81), 'Extreme Valuation');

assert.equal(matrixSignal(85, 90).code, 'EUPHORIA_RISK');
assert.equal(matrixSignal(15, 30).code, 'POTENTIAL_OPPORTUNITY');
assert.equal(matrixSignal(null, 30).code, 'INSUFFICIENT_DATA');

assert.ok(detectDivergences({priceTrend:1,greedTrend:1,breadthTrend:-1}).some(x=>x.code==='NARROW_RALLY'));
assert.ok(detectDivergences({priceTrend:-1,greedTrend:-1,fundamentalsTrend:0}).some(x=>x.code==='POTENTIAL_OPPORTUNITY'));
assert.ok(detectDivergences({priceTrend:-1,valuationTrend:-1,fundamentalsTrend:-1}).some(x=>x.code==='VALUE_TRAP_RISK'));

const opportunity = stockOpportunityScore({quality:90,valuation:30,growth:80,momentum:60,riskSafety:80,marginOfSafety:75,greed:25,regimeScore:70,catalysts:70});
assert.ok(opportunity.score >= 70, 'high quality + attractive valuation + low greed should rank strongly');

console.log('AGCI Greed + Valuation tests passed');
