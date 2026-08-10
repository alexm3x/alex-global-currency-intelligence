import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function browserModule(path, exportName) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const context = { window: {}, Date, Number, Math, Set, Array, Boolean };
  vm.runInNewContext(source, context, { filename: path });
  return context.window[exportName];
}

test('travel-data-v4 normalizes legacy planning data without presenting it as live', async () => {
  const contract = await browserModule('../viajes/travel-data-v4.js', 'TravelDataV4');
  const normalized = contract.normalize({
    meta: { generated_at: '2026-08-06T00:00:00Z' },
    source_status: { cost_model: 'planning baseline', current_fx_source: 'https://example.test/fx' },
    destinations: [{ id: 'sample', moderate_total_7n_mxn: 25000, economy_flight_mxn: 10000 }]
  });
  assert.equal(normalized.meta.schema_version, 'travel-data-v4');
  assert.equal(normalized.destinations[0].sourceType, 'baseline');
  assert.equal(normalized.destinations[0].confidence, .6);
  assert.equal(contract.validate(normalized).valid, true);
});

test('budget is a hard eligibility constraint before ranking', async () => {
  const decision = await browserModule('../viajes/travel-decision-core.js', 'TravelDecisionCore');
  const expensive = {
    sourceType: 'baseline', economy_flight_mxn: 55000, moderate_daily_mxn: 5000,
    business_flight_mxn: 90000, luxury_daily_mxn: 7000
  };
  const assessment = decision.assessBudget(expensive, {
    cabin: 'tourist', nights: 7, adults: 1, minors: 0, rooms: 1, budget: 25000
  });
  assert.equal(assessment.total, 90000);
  assert.equal(assessment.status, 'outside');
  assert.equal(decision.eligibleByBudget(expensive, { budget: 25000 }), false);
});

test('the recommendation panel keeps three fixed options when budget leaves only one eligible', async () => {
  const decision = await browserModule('../viajes/travel-decision-core.js', 'TravelDecisionCore');
  const eligible = [{ id: 'istanbul', city: 'Estambul' }];
  const ranked = [
    eligible[0],
    { id: 'lisbon', city: 'Lisboa' },
    { id: 'madrid', city: 'Madrid' },
    { id: 'paris', city: 'París' }
  ];
  const recommendations = decision.fixedRecommendations(eligible, ranked, 3);
  assert.equal(recommendations.length, 3);
  assert.equal(recommendations.map(item => item.id).join(','), 'istanbul,lisbon,madrid');
});

test('party size, rooms and duration scale the complete estimate', async () => {
  const decision = await browserModule('../viajes/travel-decision-core.js', 'TravelDecisionCore');
  const destination = { sourceType: 'baseline', economy_flight_mxn: 10000, moderate_daily_mxn: 2000 };
  const estimate = decision.estimateTrip(destination, { nights: 10, adults: 2, minors: 1, rooms: 2 });
  assert.equal(estimate.travelers, 3);
  assert.equal(estimate.flight, 30000);
  assert.equal(estimate.lodging, 40000);
  assert.equal(estimate.total, 70000);
  assert.equal(estimate.conservative, 77000);
});

test('production page uses compiled CSS and exposes provenance plus budget states', async () => {
  const page = await readFile(new URL('../viajes/index.html', import.meta.url), 'utf8');
  const cssInput = await readFile(new URL('../viajes/tailwind.input.css', import.meta.url), 'utf8');
  assert.doesNotMatch(page, /cdn\.tailwindcss\.com/);
  assert.match(page, /href="app\.css"/);
  assert.match(page, /travel-data-v4\.js/);
  assert.match(page, /travel-decision-core\.js/);
  assert.match(page, /status!==\s*'outside'/);
  assert.match(page, /Baseline ajustado/);
  assert.match(page, /DATOS EN CACHÉ/);
  assert.match(page, /DATA_CACHE_KEY/);
  assert.match(page, /fixedRecommendations\(eligible,state\.matrix,3\)/);
  assert.match(page, /aria-label="Tres recomendaciones fijas"/);
  assert.match(page, /data-trip-mode="multi"/);
  assert.match(page, /id="multiDestinationPlanner"/);
  assert.match(page, /multi-destination\.js/);
  assert.match(cssInput, /#budgetInput\s*\{[^}]*min-width:\s*140px/);
});

test('multidestination planner supports chained routes, ordering and a live verification link', async () => {
  const planner = await readFile(new URL('../viajes/multi-destination.js', import.meta.url), 'utf8');
  assert.match(planner, /MAX_DESTINATIONS = 6/);
  assert.match(planner, /routeOrigin\(index\)/);
  assert.match(planner, /data-move-route/);
  assert.match(planner, /Multi-city flights/);
  assert.match(planner, /no se suman precios no verificados/);
});
