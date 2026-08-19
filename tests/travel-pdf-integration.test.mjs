import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function loadCore(file, globalName) {
  const source = await readFile(new URL(`../viajes/${file}`, import.meta.url), 'utf8');
  const context = { window:{}, Number, Math, Object, Array, String, RegExp, Date, URL, Map, Set, JSON };
  vm.runInNewContext(source, context, { filename:file });
  return context.window[globalName];
}

function fixture() {
  const profile={trip_id:'trip-9',destination_scope:{values:['Nueva York']},dates:{start:'2026-09-12',end:'2026-09-13'},origin:{city:'MEX',airports:['MEX']},travelers:{adults:2,children:[],rooms:1},budget:{amount:3000,normalized_total:3000,currency:'USD'},planning:{mode:'known_dates'},free_comments:'private note must not enter history',concerns:['private concern']};
  const research={contract:'asc-travel-intelligence-v1',destination:'Nueva York',verified_at:'2026-08-19T20:00:00Z',collision:{detected:true,count:3},sources:[{title:'Official A',url:'https://example.com/a'},{title:'Official A duplicate',url:'https://example.com/a'}],items:[
    {id:'a',name:'US Open event',category:'sports',date_start:'2026-09-12',date_end:'2026-09-12',verification_status:'confirmed',opportunity_index:94,asc_experience_score:91,executive_classification:'IMPERDIBLE',venue:'Venue A',location:'Queens',source_title:'Official A',source_url:'https://example.com/a',signals:{rarity:95,exclusivity:80}},
    {id:'b',name:'Outside trip',category:'music',date_start:'2026-09-20',date_end:'2026-09-20',verification_status:'confirmed',opportunity_index:99,source_url:'https://example.com/b'},
    {id:'c',name:'Unconfirmed',category:'museum',date_start:'2026-09-13',date_end:'2026-09-13',verification_status:'estimated',opportunity_index:96,source_url:'https://example.com/c'}
  ]};
  const logistics={contract:'asc-travel-logistics-v1',verdict:'LOGÍSTICA FACTIBLE',metrics:{logistics_score:92,impossible:0,strained:0,unverified:0},days:[{date:'2026-09-12',verdict:'FACTIBLE',stops:[{id:'a'}],metrics:{geo_coverage:100,time_coverage:100,logistics_score:94},maps_url:'https://www.google.com/maps/dir/?api=1'}]};
  const itinerary={contract:'asc-travel-itinerary-v1',metrics:{activities:1,must_do:1},days:[{date:'2026-09-12',verdict:'EJECUTABLE',selected:[{id:'a',name:'US Open event',venue:'Venue A',location:'Queens',category:'sports',executive_classification:'IMPERDIBLE',opportunity_index:94,asc_experience_score:91,time:{start:600,end:720},schedule_basis:'source_time',source_url:'https://example.com/a'}],planning_blocks:[{period:'lunch',label:'Comida / descanso',type:'planning_block'}],alternates:[]}]};
  const cost={contract:'asc-travel-cost-v1',total_status:'partial_observed',totals_by_currency:{USD:1200},evidence:{coverage:60,included_lines:2,reference_lines:1,missing_categories:['meals','local_transport']},budget_comparison:{budget:3000,observed_subtotal:1200,usage_pct:40,currency:'USD'},event_premium_pct:18,lines:[{category:'flight',label:'Vuelo',amount:1000,currency:'USD',basis:'explicit_total',included_in_observed_subtotal:true,observed_at:'2026-08-19',source_title:'Flight',source_url:'https://example.com/f'},{category:'activity',label:'US Open event',amount:200,currency:'USD',basis:'explicit_total',included_in_observed_subtotal:true,observed_at:'2026-08-19',source_title:'Official A',source_url:'https://example.com/a'},{category:'lodging',label:'Hotel',amount:500,currency:'USD',basis:'nightly_reference',included_in_observed_subtotal:false,observed_at:'2026-08-19',source_title:'Hotel',source_url:'https://example.com/h'}],risks:['Alojamiento solo como referencia'],sources:[{title:'Flight',url:'https://example.com/f'},{title:'Official A',url:'https://example.com/a'}]};
  const selectedWindow={id:'w1',strategy_label:'Mejor balance',asc_travel_window_score:88};
  return {profile,research,logistics,itinerary,cost,selectedWindow};
}

test('Phase 9 builds an executive PDF contract only from existing Phase 3-8 evidence', async () => {
  const core=await loadCore('travel-pdf-core.js','TravelPdfCore');
  const f=fixture();const report=core.buildReport(f.profile,f.research,f.logistics,f.itinerary,f.cost,f.selectedWindow);
  assert.equal(report.contract,'asc-travel-pdf-v1');
  assert.equal(report.trip.destination,'Nueva York');
  assert.deepEqual(report.costs.totals_by_currency,{USD:1200});
  assert.equal(report.only_during_trip.length,1);
  assert.equal(report.only_during_trip[0].id,'a');
  assert.ok(!report.only_during_trip.some(item=>item.id==='b'||item.id==='c'));
});

test('Phase 9 preserves planning blocks as generic non-priced planning, not bookings', async () => {
  const core=await loadCore('travel-pdf-core.js','TravelPdfCore');
  const f=fixture();const report=core.buildReport(f.profile,f.research,f.logistics,f.itinerary,f.cost,f.selectedWindow);
  const block=report.itinerary[0].planning_blocks[0];
  assert.equal(block.type,'planning_block');
  assert.equal(block.evidence,'generated_planning_block');
  assert.equal(block.cost_status,'not_priced');
  assert.ok(!('venue' in block));
});

test('Phase 9 deduplicates source URLs and retains traceability', async () => {
  const core=await loadCore('travel-pdf-core.js','TravelPdfCore');
  const f=fixture();const report=core.buildReport(f.profile,f.research,f.logistics,f.itinerary,f.cost,f.selectedWindow);
  assert.equal(report.sources.filter(source=>source.url==='https://example.com/a').length,1);
  assert.ok(report.sources.some(source=>source.url==='https://example.com/f'));
  assert.ok(report.completeness.score > 0);
});

test('Phase 10 creates a minimal cross-module snapshot with explicit integration limitations', async () => {
  const pdf=await loadCore('travel-pdf-core.js','TravelPdfCore');
  const integration=await loadCore('travel-integration-core.js','TravelIntegrationCore');
  const f=fixture();const report=pdf.buildReport(f.profile,f.research,f.logistics,f.itinerary,f.cost,f.selectedWindow);
  const snapshot=integration.buildSnapshot(f.profile,f.research,f.logistics,f.itinerary,f.cost,report,f.selectedWindow);
  assert.equal(snapshot.contract,'asc-travel-integration-v1');
  assert.equal(snapshot.integration_status.stays,'parameter_sync_only_demo_data_never_promoted_to_live');
  assert.equal(snapshot.integration_status.alerts,'local_watch_intent_only_external_notification_inactive');
  assert.equal(snapshot.maps.length,1);
});

test('Phase 10 history and favorites exclude free comments and private concern arrays', async () => {
  const pdf=await loadCore('travel-pdf-core.js','TravelPdfCore');
  const integration=await loadCore('travel-integration-core.js','TravelIntegrationCore');
  const f=fixture();const report=pdf.buildReport(f.profile,f.research,f.logistics,f.itinerary,f.cost,f.selectedWindow);
  const snapshot=integration.buildSnapshot(f.profile,f.research,f.logistics,f.itinerary,f.cost,report,f.selectedWindow);
  const serialized=JSON.stringify(integration.storageRecord(snapshot));
  assert.doesNotMatch(serialized,/private note|private concern|free_comments|concerns/);
  assert.equal(integration.favoriteRecord(snapshot).contract,'asc-travel-favorite-v1');
});

test('Phase 10 alert records never claim an external notification is active', async () => {
  const integration=await loadCore('travel-integration-core.js','TravelIntegrationCore');
  const record=integration.alertIntent({trip_id:'t1',destination:'Madrid',dates:{start:'2026-10-01',end:'2026-10-05'},selected_window:{id:'w'}});
  assert.equal(record.contract,'asc-travel-alert-intent-v1');
  assert.equal(record.external_notification_active,false);
  assert.equal(record.status,'local_watch_intent_saved');
});

test('Phase 9-10 clients are chained from Phase 8 and use native browser PDF printing', async () => {
  const cost=await readFile(new URL('../viajes/travel-cost.js',import.meta.url),'utf8');
  const pdf=await readFile(new URL('../viajes/travel-pdf.js',import.meta.url),'utf8');
  const integration=await readFile(new URL('../viajes/travel-integration.js',import.meta.url),'utf8');
  assert.match(cost,/travel-pdf-core\.js/);assert.match(cost,/travel-pdf\.js/);assert.match(cost,/travel-integration-core\.js/);assert.match(cost,/travel-integration\.js/);
  assert.match(pdf,/viajes:cost-ready/);assert.match(pdf,/viajes:pdf-ready/);assert.match(pdf,/popup\.print\(\)/);assert.match(pdf,/Guardar como PDF/);assert.doesNotMatch(pdf,/jsPDF|html2pdf/);
  assert.match(integration,/viajes:pdf-ready/);assert.match(integration,/viajes:integration-ready/);assert.match(integration,/Notificación externa: NO ACTIVA/);assert.match(integration,/demo y no alimentan el costo trazable/i);
});
