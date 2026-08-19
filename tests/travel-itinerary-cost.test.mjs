import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function loadCore(file, globalName) {
  const source = await readFile(new URL(`../viajes/${file}`, import.meta.url), 'utf8');
  const context = { window:{}, Number, Math, Object, Array, String, RegExp, Date, URL, Map, Set };
  vm.runInNewContext(source, context, { filename:file });
  return context.window[globalName];
}

test('Phase 7 maps source times to dayparts and applies pace without retiming fixed events', async () => {
  const core = await loadCore('travel-itinerary-core.js', 'TravelItineraryCore');
  assert.equal(core.phaseFromMinutes(600), 'morning');
  assert.equal(core.phaseFromMinutes(790), 'lunch');
  assert.equal(core.phaseFromMinutes(null), 'flexible');
  assert.equal(core.paceLimit({ planning:{ pace:'balanced' } }), 4);
  const profile = { trip_id:'t1', destination_scope:{values:['Nueva York']}, dates:{start:'2026-09-12',end:'2026-09-12'}, planning:{pace:'balanced'} };
  const logistics = { days:[{ date:'2026-09-12', verdict:'LOGÍSTICA FACTIBLE', metrics:{logistics_score:92,impossible_segments:0,strained_segments:0,unverified_segments:0}, stops:[
    {id:'a',name:'A',date:'2026-09-12',time:{start:600,end:660},venue:'A',location:'Manhattan'},
    {id:'b',name:'B',date:'2026-09-12',time:{start:1140,end:1200},venue:'B',location:'Manhattan'},
    {id:'c',name:'C',date:'2026-09-12',time:null,venue:'C',location:'Manhattan'},
    {id:'d',name:'D',date:'2026-09-12',time:null,venue:'D',location:'Manhattan'},
    {id:'e',name:'E',date:'2026-09-12',time:null,venue:'E',location:'Manhattan'}
  ] }] };
  const research = { items:[
    {id:'a',opportunity_index:95,asc_experience_score:90}, {id:'b',opportunity_index:88,asc_experience_score:86},
    {id:'c',opportunity_index:92}, {id:'d',opportunity_index:75}, {id:'e',opportunity_index:60}
  ] };
  const result = core.buildItinerary(profile,research,logistics);
  assert.equal(result.contract, 'asc-travel-itinerary-v1');
  assert.equal(result.days[0].selected.length, 4);
  assert.equal(result.days[0].alternates.length, 1);
  assert.equal(result.days[0].selected.find(x => x.id === 'a').time.start, 600);
  assert.equal(result.days[0].selected.find(x => x.id === 'b').time.start, 1140);
  assert.equal(result.days[0].selected.find(x => x.id === 'c').schedule_basis, 'time_unverified');
});

test('Phase 7 adds only generic planning blocks and never named fabricated venues or prices', async () => {
  const core = await loadCore('travel-itinerary-core.js', 'TravelItineraryCore');
  const blocks = core.planningBlocks([{id:'a',time:{start:600,end:660}},{id:'b',time:{start:900,end:960}},{id:'c',time:null}]);
  assert.ok(blocks.length >= 1);
  assert.ok(blocks.every(block => block.type === 'planning_block'));
  assert.ok(blocks.every(block => block.evidence === 'generated_planning_block'));
  assert.ok(blocks.every(block => block.cost_status === 'not_priced'));
  assert.ok(blocks.every(block => !('venue' in block) && !('price' in block)));
});

test('Phase 8 sums only explicit totals and keeps unit or nightly prices as references', async () => {
  const core = await loadCore('travel-cost-core.js', 'TravelCostCore');
  const profile = { trip_id:'t1', destination_scope:{values:['Nueva York']}, budget:{amount:3000,normalized_total:3000,currency:'USD'} };
  const itinerary = { days:[{selected:[{id:'a'},{id:'b'}]}] };
  const research = { verified_at:'2026-08-19T19:00:00Z', items:[
    {id:'a',name:'Ticket A',price_observed:{amount:50,currency:'USD',note:'per ticket',observed_at:'2026-08-19T19:00:00Z'},source_title:'A',source_url:'https://example.com/a'},
    {id:'b',name:'Experience B',price_observed:{amount:200,currency:'USD',note:'total del grupo',observed_at:'2026-08-19T19:00:00Z'},source_title:'B',source_url:'https://example.com/b'}
  ] };
  const selectedWindow = {
    flight_observed:{amount:1000,currency:'USD',note:'total del grupo',observed_at:'2026-08-19T19:00:00Z',source_title:'Flight',source_url:'https://example.com/f'},
    lodging_observed:{amount:800,currency:'USD',note:'per night',observed_at:'2026-08-19T19:00:00Z',source_title:'Hotel',source_url:'https://example.com/h'}
  };
  const cost = core.buildCost(profile,research,itinerary,selectedWindow);
  assert.equal(cost.contract, 'asc-travel-cost-v1');
  assert.equal(cost.totals_by_currency.USD, 1200);
  assert.equal(cost.evidence.included_lines, 2);
  assert.equal(cost.evidence.reference_lines, 2);
  assert.equal(cost.budget_comparison.remaining, 1800);
  assert.equal(cost.lines.find(line => line.label === 'Alojamiento observado').included_in_observed_subtotal, false);
  assert.equal(cost.lines.find(line => line.label === 'Ticket A').included_in_observed_subtotal, false);
});

test('Phase 8 never merges currencies and does not apply Event Premium twice', async () => {
  const core = await loadCore('travel-cost-core.js', 'TravelCostCore');
  const profile = { destination_scope:{values:['Madrid']}, budget:{amount:5000,currency:'USD'} };
  const itinerary = { days:[{selected:[{id:'a'}]}] };
  const research = { items:[{id:'a',name:'Evento',price_observed:{amount:300,currency:'EUR',note:'total',observed_at:'2026-08-19'},source_url:'https://example.com/e'}] };
  const selectedWindow = { flight_observed:{amount:900,currency:'USD',note:'total trip',observed_at:'2026-08-19',source_url:'https://example.com/f'}, event_premium_pct:18 };
  const cost = core.buildCost(profile,research,itinerary,selectedWindow);
  assert.equal(cost.totals_by_currency.USD, 900);
  assert.equal(cost.totals_by_currency.EUR, 300);
  assert.equal(cost.event_premium_pct, 18);
  assert.ok(cost.risks.some(risk => /monedas distintas/i.test(risk)));
  assert.ok(cost.risks.some(risk => /no se vuelve a sumar/i.test(risk)));
});

test('Phase 7 and 8 client contracts are chained from logistics', async () => {
  const logistics = await readFile(new URL('../viajes/travel-logistics.js', import.meta.url), 'utf8');
  const itinerary = await readFile(new URL('../viajes/travel-itinerary.js', import.meta.url), 'utf8');
  const cost = await readFile(new URL('../viajes/travel-cost.js', import.meta.url), 'utf8');
  assert.match(logistics, /travel-itinerary-core\.js/);
  assert.match(logistics, /travel-itinerary\.js/);
  assert.match(logistics, /travel-cost-core\.js/);
  assert.match(logistics, /travel-cost\.js/);
  assert.match(itinerary, /viajes:logistics-ready/);
  assert.match(itinerary, /viajes:itinerary-ready/);
  assert.match(cost, /viajes:itinerary-ready/);
  assert.match(cost, /viajes:cost-ready/);
  assert.match(cost, /no es una cotización final/i);
});
