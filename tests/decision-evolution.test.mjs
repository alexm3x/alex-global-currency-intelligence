import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { parseIbkrRatingsBody, buildCiarSnapshot, publicSnapshotIsSanitized } from '../scripts/parse-ibkr-ratings.mjs';
import { buildLearningReport } from '../decision-learning-core.js';
import { validateVariableRegistry, summarizeVariableRegistry, promoteVariable } from '../decision-variable-core.js';

const read = file => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');

const amznBody = `Symbol Buy Outperform Hold Underperform Sell Account(s)\n\nAMZN@NASDAQ 18(-1) 46(0) 4(0) 0(0) 0(0) U****000`;
const tslaBody = `Symbol Buy Outperform Hold Underperform Sell Account(s)\n\nTSLA@NASDAQ 8(0) 17(0) 24(+1) 5(-1) 1(0) U****000`;

test('IBKR parser converts analyst categories into deterministic public metrics', () => {
  const [amzn] = parseIbkrRatingsBody(amznBody, '2026-08-05');
  assert.equal(amzn.ticker, 'AMZN');
  assert.equal(amzn.exchange, 'NASDAQ');
  assert.equal(amzn.totalAnalysts, 68);
  assert.equal(amzn.bullishPct, 94.1);
  assert.equal(amzn.consensusScore, 4.21);
  assert.equal(amzn.netChange, -2);
  assert.equal(amzn.signal, 'Positive');

  const [tsla] = parseIbkrRatingsBody(tslaBody, '2026-08-07');
  assert.equal(tsla.netChange, 1);
});

test('CIAR build keeps latest ticker reading and strips private Gmail/account metadata', () => {
  const snapshot = buildCiarSnapshot([
    { subject: 'FYI: Changes in Analyst Ratings', email_ts: '2026-08-05T15:16:41Z', body: amznBody, id: 'private-gmail-id' },
    { subject: 'FYI: Changes in Analyst Ratings', email_ts: '2026-08-07T12:24:50Z', body: tslaBody, id: 'another-private-id' }
  ], null, new Date('2026-08-10T18:00:00Z'));
  assert.equal(snapshot.records.length, 2);
  assert.equal(snapshot.latestSourceDate, '2026-08-07');
  assert.equal(publicSnapshotIsSanitized(snapshot), true);
  const text = JSON.stringify(snapshot);
  assert.doesNotMatch(text, /private-gmail-id/);
  assert.doesNotMatch(text, /U\*{2,}/);
});

function snap(date, prices, contextLabel = 'Soporte') {
  return {
    date,
    decisions: Object.entries(prices).map(([ticker, price]) => ({
      ticker,
      price,
      zone: 'COMPRA',
      decisionScore: 80,
      preparationScore: 85,
      context: { label: contextLabel, totalPoints: 3 }
    }))
  };
}

test('learning engine waits for future observations and activates only with adequate sample', () => {
  const tickers = Object.fromEntries(['AAA','BBB','CCC','DDD','EEE','FFF'].map((ticker, index) => [ticker, 100 + index]));
  const later = Object.fromEntries(Object.entries(tickers).map(([ticker, price]) => [ticker, price * 1.02]));
  const report = buildLearningReport([
    snap('2026-08-10', tickers),
    snap('2026-08-11', later)
  ], new Date('2026-08-11T22:00:00Z'));
  assert.equal(report.status, 'learning-active');
  assert.equal(report.byHorizon['1d'].all.observations, 6);
  assert.equal(report.byHorizon['1d'].all.status, 'measurable');
  assert.equal(report.byHorizon['5d'].all.status, 'insufficient-history');
  assert.equal(report.byHorizon['1d'].all.directionalHitRatePct, 100);
});

test('variable registry forbids weight before promotion and requires evidence for promotion', () => {
  const registry = JSON.parse(read('data/decision-variable-registry.json'));
  const validation = validateVariableRegistry(registry);
  assert.equal(validation.valid, true, validation.errors.join('; '));
  const summary = summarizeVariableRegistry(registry);
  assert.equal(summary.promoted, 0);
  assert.deepEqual(summary.weightedVariables, []);
  assert.throws(() => promoteVariable(registry, 'earnings_transcript_change', { weight: 3, rationale: 'Insufficient sample should never promote.', validationSample: 10 }));
  const promoted = promoteVariable(registry, 'earnings_transcript_change', {
    weight: 3,
    rationale: 'Forward observations show incremental information after controlling for existing evidence.',
    validationSample: 25
  });
  const item = promoted.variables.find(variable => variable.id === 'earnings_transcript_change');
  assert.equal(item.state, 'promoted');
  assert.equal(item.mode, 'score');
  assert.equal(item.weight, 3);
});

test('production loader exposes learning and governance assets with mobile support', () => {
  const nav = read('nav-dedupe.js');
  const ui = read('decision-evolution.js');
  const css = read('decision-evolution.css');
  assert.match(nav, /decision-evolution\.js/);
  assert.match(ui, /data\/decision-learning-latest\.json/);
  assert.match(ui, /data\/decision-variable-registry\.json/);
  assert.match(ui, /FASE 4 · LEARNING LOOP/);
  assert.match(ui, /FASE 5 · VARIABLE GOVERNANCE/);
  assert.match(css, /@media\(max-width:430px\)/);
});

test('decision learning workflow is scheduled after market and commits only generated history', () => {
  const workflow = read('.github/workflows/decision-learning.yml');
  assert.match(workflow, /cron: '45 20 \* \* 1-5'/);
  assert.match(workflow, /node scripts\/capture-decision-snapshot\.mjs/);
  assert.match(workflow, /git add data\/decision-history data\/decision-learning-latest\.json/);
  assert.doesNotMatch(workflow, /data\/ciar-latest\.json/);
});
