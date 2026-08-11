import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildContextOverlay, analystEvidence, briefingEvidence } from '../decision-evidence-core.js';

const ciar = JSON.parse(fs.readFileSync(new URL('../data/ciar-latest.json', import.meta.url)));
const briefing = JSON.parse(fs.readFileSync(new URL('../data/daily-briefing-latest.json', import.meta.url)));
const now = new Date('2026-08-10T11:39:00-06:00');

const ciarFixture = {
  windowDays: 45,
  records: [
    { ticker: 'GOOG', asOf: '2026-07-24', signal: 'Strong Positive', netChange: 2, totalAnalysts: 18, bullishPct: 94.4, consensusScore: 4.39, proxyFor: ['GOOGL'] },
    { ticker: 'AMZN', asOf: '2026-08-05', signal: 'Positive', netChange: -2, totalAnalysts: 68, bullishPct: 94.1, consensusScore: 4.21 },
    { ticker: 'MSFT', asOf: '2026-07-22', signal: 'Strong Positive', netChange: 1, totalAnalysts: 63, bullishPct: 93.7, consensusScore: 4.27 }
  ]
};

const briefingFixture = {
  date: '2026-08-10',
  title: 'Fixture estable de evidencia contextual',
  stance: 'Riesgo selectivo',
  risk: 'Elevado',
  threeSignals: [{ label: 'Inflación', summary: 'Vigilar la siguiente publicación macroeconómica.' }],
  equities: [
    { ticker: 'AMZN', classification: 'COMPRAR EN CORRECCIÓN', confidence: 'Alta', thesis: 'Tesis de prueba estable.' }
  ],
  watch: ['NVDA — resultados 26 agosto']
};

const macroFixture = {
  generatedAt: '2026-08-10T11:39:00-06:00',
  risk: { regime: 'Bajo', vix: 17, average20: 18 },
  economies: { US: { policyRate: { value: 3.75 } } }
};

test('GOOGL receives transparent GOOG same-issuer proxy instead of fabricated class-specific CIAR data', () => {
  const evidence = analystEvidence('GOOGL', ciarFixture, now);
  assert.equal(evidence.proxy, true);
  assert.equal(evidence.sourceTicker, 'GOOG');
  assert.equal(evidence.signal, 'Strong Positive');
  assert.equal(evidence.points, 2);
  assert.match(evidence.proxyNote, /proxy del mismo emisor/);
});

test('AMZN combines current analyst and briefing evidence without changing valuation governance', () => {
  const overlay = buildContextOverlay('AMZN', { ciar: ciarFixture, briefing: briefingFixture, macro: macroFixture }, now);
  assert.equal(overlay.analyst.signal, 'Positive');
  assert.equal(overlay.briefing.classification, 'COMPRAR EN CORRECCIÓN');
  assert.equal(overlay.governance.changesFairValue, false);
  assert.equal(overlay.governance.changesBuyTerrain, false);
  assert.equal(overlay.governance.changesBaseDecisionScore, false);
  assert.ok(['Soporte fuerte', 'Soporte', 'Mixto', 'Cautela', 'Cautela alta'].includes(overlay.label));
});

test('NVDA carries explicit event risk from the Daily Strategic Briefing watch list', () => {
  const evidence = briefingEvidence('NVDA', briefingFixture);
  assert.ok(evidence.watch.some(item => item.includes('26 agosto')));
  const overlay = buildContextOverlay('NVDA', { ciar: ciarFixture, briefing: briefingFixture, macro: macroFixture }, now);
  assert.equal(overlay.eventPenalty, -0.5);
});

test('uncovered ticker never receives invented CIAR or company-specific briefing evidence', () => {
  const overlay = buildContextOverlay('XOM', { ciar: ciarFixture, briefing: briefingFixture, macro: macroFixture }, now);
  assert.equal(overlay.analyst, null);
  assert.equal(overlay.briefing, null);
  assert.ok(overlay.macro);
  assert.equal(overlay.evidenceCount, 1);
});

test('CIAR outside its 45-day window is marked stale and contributes zero analyst points', () => {
  const future = new Date('2026-10-01T12:00:00-06:00');
  const evidence = analystEvidence('MSFT', ciarFixture, future);
  assert.equal(evidence.stale, true);
  assert.equal(evidence.points, 0);
});

test('current Daily Strategic Briefing preserves the public evidence contract without requiring fixed tickers', () => {
  assert.equal(briefing.schemaVersion, 2);
  assert.match(briefing.date, /^\d{4}-\d{2}-\d{2}$/);
  assert.ok(Array.isArray(briefing.equities));
  assert.ok(Array.isArray(briefing.watch));
  assert.ok(briefing.equities.every(item => typeof item.ticker === 'string' && typeof item.classification === 'string'));
});

test('public CIAR snapshot excludes private account identifiers and email addresses', () => {
  const raw = fs.readFileSync(new URL('../data/ciar-latest.json', import.meta.url), 'utf8');
  assert.doesNotMatch(raw, /U\*\*\*\*/);
  assert.doesNotMatch(raw, /proadmexico/i);
  assert.doesNotMatch(raw, /@gmail\.com/i);
});

test('phase 3 UI consumes CIAR, briefing and macro sources and states valuation separation', () => {
  const ui = fs.readFileSync(new URL('../decision-evidence.js', import.meta.url), 'utf8');
  assert.match(ui, /data\/ciar-latest\.json/);
  assert.match(ui, /data\/daily-briefing-latest\.json/);
  assert.match(ui, /data\/macro-latest\.json/);
  assert.match(ui, /modifica disciplina de ejecución, no valoración/);
});
