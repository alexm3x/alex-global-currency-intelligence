import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function intelligenceCore() {
  const source = await readFile(new URL('../viajes/travel-intelligence-core.js', import.meta.url), 'utf8');
  const context = { window: {}, Number, Math, Object, Array, Date, String, RegExp, Set, Map };
  vm.runInNewContext(source, context, { filename: 'travel-intelligence-core.js' });
  return context.window.TravelIntelligenceCore;
}

test('ASC Experience Score re-normalizes weights when evidence is missing', async () => {
  const core = await intelligenceCore();
  const score = core.scoreExperience({ signals: { importance: 100, exclusivity: 80, date_match: 100, affinity: 90 } });
  assert.ok(score >= 90 && score <= 100);
  assert.equal(core.scoreExperience({ signals: {} }), null);
  assert.equal(core.weightedScore({ weather: null }, { weather: 1 }), null, 'null evidence must never become numeric zero');
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
  assert.equal(core.eventPremium({ event_premium_pct: null }), null);
  assert.equal(core.eventPremium({ event_premium_pct: 18 }), 18);
});

test('ASC Travel Window Score uses master weights and supports adjustable weights', async () => {
  const core = await intelligenceCore();
  const factors = { extraordinary_events: 95, price_quality: 70, flight: 75, lodging: 72, affinity: 90, weather: 80, saturation: 60, logistics: 85 };
  const standard = core.travelWindowScore(factors);
  const experienceHeavy = core.travelWindowScore(factors, { extraordinary_events: .5, price_quality: .05 });
  assert.ok(standard > 70);
  assert.ok(experienceHeavy > standard);
});

test('Phase 5 parses common approximate periods into deterministic calendar ranges', async () => {
  const core = await intelligenceCore();
  const now = new Date('2026-08-19T12:00:00Z');
  assert.deepEqual({ ...core.parseApproxPeriod('septiembre 2026', now) }, { start:'2026-09-01', end:'2026-09-30', label:'septiembre 2026', basis:'month' });
  assert.deepEqual({ ...core.parseApproxPeriod('septiembre-octubre 2026', now) }, { start:'2026-09-01', end:'2026-10-31', label:'septiembre-octubre 2026', basis:'month_range' });
  assert.equal(core.parseApproxPeriod('Q4 2026', now).start, '2026-10-01');
  assert.equal(core.parseApproxPeriod('Q4 2026', now).end, '2026-12-31');
  assert.equal(core.parseApproxPeriod('próximos 3 meses', now).start, '2026-08-19');
});

test('Phase 5 generates valid sliding windows and detects exact event overlap', async () => {
  const core = await intelligenceCore();
  const windows = core.generateCandidateWindows({ start:'2026-09-01', end:'2026-09-30', basis:'month' }, 4);
  assert.equal(windows.length, 27);
  assert.equal(windows[0].start, '2026-09-01');
  assert.equal(windows[0].end, '2026-09-04');
  const event = { id:'us-open', date_start:'2026-09-12', date_end:'2026-09-12', opportunity_index:94, signals:{ affinity:90, value:75 } };
  const matched = windows.find(window => window.start === '2026-09-10');
  const missed = windows.find(window => window.start === '2026-09-15');
  assert.equal(core.overlaps(matched, event), true);
  assert.equal(core.overlaps(missed, event), false);
  assert.equal(core.prelimWindow(matched, [event]).opportunity_count, 1);
});

test('Phase 5 ranks only evidenced factors and derives comparative price scores from observed values', async () => {
  const core = await intelligenceCore();
  const base = [
    { id:'w1', start:'2026-09-10', end:'2026-09-13', duration_days:4, extraordinary_events:92, affinity:88, event_value:80, preliminary_score:91, opportunity_count:2, matched_items:['a'] },
    { id:'w2', start:'2026-09-17', end:'2026-09-20', duration_days:4, extraordinary_events:75, affinity:85, event_value:85, preliminary_score:78, opportunity_count:1, matched_items:['b'] }
  ];
  const payload = { windows:[
    { id:'w1', start:'2026-09-10', end:'2026-09-13', flight_observed:{amount:1200,currency:'USD'}, lodging_observed:{amount:1600,currency:'USD'}, weather:{score:85}, saturation:{score:55}, logistics:{score:80}, event_premium:{value:18} },
    { id:'w2', start:'2026-09-17', end:'2026-09-20', flight_observed:{amount:900,currency:'USD'}, lodging_observed:{amount:1200,currency:'USD'}, weather:{score:null}, saturation:{score:82}, logistics:{score:88}, event_premium:{value:null} }
  ]};
  const ranked = core.mergeWindowResearch(base, payload);
  assert.equal(ranked.length, 2);
  assert.ok(ranked.every(window => window.asc_travel_window_score !== null));
  const w2 = ranked.find(window => window.id === 'w2');
  assert.equal(w2.factors.weather, null);
  assert.ok(w2.factors.flight > ranked.find(window => window.id === 'w1').factors.flight);
  assert.ok(w2.factors.lodging > ranked.find(window => window.id === 'w1').factors.lodging);
  assert.ok(w2.evidence_coverage < 1);
});

test('Phase 5 selects distinct balance, opportunity and value strategies when evidence allows', async () => {
  const core = await intelligenceCore();
  const windows = [
    { id:'a', asc_travel_window_score:90, extraordinary_events:82, factors:{price_quality:70} },
    { id:'b', asc_travel_window_score:86, extraordinary_events:99, factors:{price_quality:65} },
    { id:'c', asc_travel_window_score:80, extraordinary_events:72, factors:{price_quality:98} }
  ];
  const strategies = core.selectWindowStrategies(windows);
  assert.equal(strategies.balance.window.id, 'a');
  assert.equal(strategies.opportunity.window.id, 'b');
  assert.equal(strategies.value.window.id, 'c');
  assert.equal(new Set(strategies.top3.map(role => role.window.id)).size, 3);
});

test('Phase 5 client transfers a selected window into the known-dates workflow', async () => {
  const source = await readFile(new URL('../viajes/travel-window-engine.js', import.meta.url), 'utf8');
  assert.match(source, /viajes:window-selected/);
  assert.match(source, /viajes:known-dates-request/);
  assert.match(source, /startDate/);
  assert.match(source, /endDate/);
  assert.match(source, /research_windows/);
  assert.match(source, /No se inventan precios ni factores faltantes/);
});

test('research UI preserves null as missing evidence and clears stale trip research before a new request', async () => {
  const source = await readFile(new URL('../viajes/travel-intelligence.js', import.meta.url), 'utf8');
  assert.match(source, /value !== null && value !== undefined && value !== ''/);
  assert.match(source, /window\.__VIAJES_ASC_TRAVEL_RESEARCH__ = null/);
  assert.match(source, /viajes:research-start/);
  assert.doesNotMatch(source, /const fmt = value => Number\.isFinite\(Number\(value\)\)/);
});
