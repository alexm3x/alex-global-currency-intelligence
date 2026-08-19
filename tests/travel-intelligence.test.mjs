import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function intelligenceCore() {
  const source = await readFile(new URL('../viajes/travel-intelligence-core.js', import.meta.url), 'utf8');
  const context = { window: {}, Number, Math, Object, Array };
  vm.runInNewContext(source, context, { filename: 'travel-intelligence-core.js' });
  return context.window.TravelIntelligenceCore;
}

test('ASC Experience Score re-normalizes weights when evidence is missing', async () => {
  const core = await intelligenceCore();
  const score = core.scoreExperience({ signals: { importance: 100, exclusivity: 80, date_match: 100, affinity: 90 } });
  assert.ok(score >= 90 && score <= 100);
  assert.equal(core.scoreExperience({ signals: {} }), null);
});

test('Opportunity Index rewards exact timing, rarity and exclusivity without exceeding 100', async () => {
  const core = await intelligenceCore();
  const item = { signals: { date_match: 100, rarity: 100, exclusivity: 95, importance: 90, availability: 70, affinity: 90, value: 60 } };
  const base = core.scoreOpportunity(item);
  const boosted = core.scoreOpportunity(item, 8);
  assert.ok(base >= 90);
  assert.ok(boosted >= base);
  assert.ok(boosted <= 100);
});

test('Travel Collision Engine only triggers on three confirmed high-opportunity items', async () => {
  const core = await intelligenceCore();
  const make = (id, status='confirmed') => ({ id, verification_status: status, opportunity_index: 90 });
  assert.equal(core.collisionEngine([make('a'), make('b')]).detected, false);
  const collision = core.collisionEngine([make('a'), make('b'), make('c')]);
  assert.equal(collision.detected, true);
  assert.equal(collision.count, 3);
  assert.ok(collision.boost > 0);
});

test('Event Premium is never fabricated when no evidence exists', async () => {
  const core = await intelligenceCore();
  assert.equal(core.eventPremium({}), null);
  assert.equal(core.eventPremium({ event_premium_pct: 18 }), 18);
});

test('ASC Travel Window Score uses the master weights and supports adjustable weights', async () => {
  const core = await intelligenceCore();
  const factors = { extraordinary_events: 95, price_quality: 70, flight: 75, lodging: 72, affinity: 90, weather: 80, saturation: 60, logistics: 85 };
  const standard = core.travelWindowScore(factors);
  const experienceHeavy = core.travelWindowScore(factors, { extraordinary_events: .5, price_quality: .05 });
  assert.ok(standard > 70);
  assert.ok(experienceHeavy > standard);
});
