import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildContextOverlay, analystEvidence, briefingEvidence } from '../decision-evidence-core.js';

const ciar = JSON.parse(fs.readFileSync(new URL('../data/ciar-latest.json', import.meta.url)));
const briefing = JSON.parse(fs.readFileSync(new URL('../data/daily-briefing-latest.json', import.meta.url)));
const macro = JSON.parse(fs.readFileSync(new URL('../data/macro-latest.json', import.meta.url)));
const now = new Date('2026-08-10T11:39:00-06:00');

test('GOOGL receives transparent GOOG same-issuer proxy instead of fabricated class-specific CIAR data', () => {
  const evidence = analystEvidence('GOOGL', ciar, now);
  assert.equal(evidence.proxy, true);
  assert.equal(evidence.sourceTicker, 'GOOG');
  assert.equal(evidence.signal, 'Strong Positive');
  assert.equal(evidence.points, 2);
  assert.match(evidence.proxyNote, /proxy del mismo emisor/);
});

test('AMZN combines current analyst and briefing evidence without changing valuation governance', () => {
  const overlay = buildContextOverlay('AMZN', { ciar, briefing, macro }, now);
  assert.equal(overlay.analyst.signal, 'Positive');
  assert.equal(overlay.briefing.classification, 'COMPRAR EN CORRECCIÓN');
  assert.equal(overlay.governance.changesFairValue, false);
  assert.equal(overlay.governance.changesBuyTerrain, false);
  assert.equal(overlay.governance.changesBaseDecisionScore, false);
  assert.ok(['Soporte fuerte', 'Soporte', 'Mixto', 'Cautela', 'Cautela alta'].includes(overlay.label));
});

test('NVDA carries explicit event risk from the Daily Strategic Briefing watch list', () => {
  const evidence = briefingEvidence('NVDA', briefing);
  assert.ok(evidence.watch.some(item => item.includes('26 agosto')));
  const overlay = buildContextOverlay('NVDA', { ciar, briefing, macro }, now);
  assert.equal(overlay.eventPenalty, -0.5);
});

test('uncovered ticker never receives invented CIAR or company-specific briefing evidence', () => {
  const overlay = buildContextOverlay('XOM', { ciar, briefing, macro }, now);
  assert.equal(overlay.analyst, null);
  assert.equal(overlay.briefing, null);
  assert.ok(overlay.macro);
  assert.equal(overlay.evidenceCount, 1);
});

test('CIAR outside its 45-day window is marked stale and contributes zero analyst points', () => {
  const future = new Date('2026-10-01T12:00:00-06:00');
  const evidence = analystEvidence('MSFT', ciar, future);
  assert.equal(evidence.stale, true);
  assert.equal(evidence.points, 0);
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
