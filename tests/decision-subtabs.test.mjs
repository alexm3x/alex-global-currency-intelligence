import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const js = fs.readFileSync(new URL('../decision-discoverability.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../decision-discoverability.css', import.meta.url), 'utf8');
const nav = fs.readFileSync(new URL('../nav-dedupe.js', import.meta.url), 'utf8');

test('Decision Engine exposes permanent summary and phase 3-5 tabs', () => {
  for (const marker of [
    "data-ded-tab=\"summary\"",
    "data-ded-tab=\"phase3\"",
    "data-ded-tab=\"phase4\"",
    "data-ded-tab=\"phase5\"",
    'role="tablist"',
    'aria-selected'
  ]) assert.ok(js.includes(marker), `missing ${marker}`);
});

test('advanced phases support direct hashes and preserve explicit routing', () => {
  assert.ok(js.includes("'#decisionEngine-phase3'"));
  assert.ok(js.includes("'#decisionEngine-phase4'"));
  assert.ok(js.includes("'#decisionEngine-phase5'"));
  assert.ok(js.includes("window.setView('decisionEngine')"));
});

test('phase switching requests real analysis rather than fabricating placeholder data', () => {
  assert.ok(js.includes("analyze.click()"));
  assert.ok(js.includes("waitForTarget(id)"));
  assert.ok(!js.includes('mockData'));
  assert.ok(!js.includes('sampleResult'));
});

test('CSS isolates advanced views while keeping radar outside the hidden detail content', () => {
  assert.ok(css.includes('#decisionEngineRoot[data-phase-tab="phase3"] #deDecisionDetail>:not(#deEvidenceLayer)'));
  assert.ok(css.includes('#decisionEngineRoot[data-phase-tab="phase4"] #deDecisionDetail>:not(#deEvolutionLayer)'));
  assert.ok(css.includes('#decisionEngineRoot[data-phase-tab="phase5"] #deDecisionDetail>:not(#deEvolutionLayer)'));
  assert.ok(!css.includes('[data-phase-tab="phase3"] .de-radar{display:none'));
});

test('phase 4 and phase 5 split the combined evolution layer', () => {
  assert.ok(css.includes('[data-phase-tab="phase4"] #deEvolutionLayer .dev-grid>.dev-card:nth-child(2)'));
  assert.ok(css.includes('[data-phase-tab="phase5"] #deEvolutionLayer .dev-grid>.dev-card:nth-child(1)'));
  assert.ok(css.includes('[data-phase-tab="phase5"] #deEvolutionLayer .dev-lift'));
});

test('mobile subtabs use horizontal snap navigation and current asset version is loaded', () => {
  assert.ok(css.includes('@media(max-width:700px)'));
  assert.ok(css.includes('scroll-snap-type:x mandatory'));
  assert.ok(nav.includes('decision-discoverability.js?v=20260810-subtabs1'));
});
