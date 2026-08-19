import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import test from 'node:test';

async function logisticsCore() {
  const source = await readFile(new URL('../viajes/travel-logistics-core.js', import.meta.url), 'utf8');
  const context = { window:{}, Number, Math, Object, Array, String, RegExp, Date, URLSearchParams, Map };
  vm.runInNewContext(source, context, { filename:'travel-logistics-core.js' });
  return context.window.TravelLogisticsCore;
}

test('Phase 6 parses explicit time ranges without inventing duration', async () => {
  const core = await logisticsCore();
  assert.deepEqual(JSON.parse(JSON.stringify(core.parseTime('7:30 pm - 9:00 pm'))), { start:1170, end:1260, precision:'range' });
  assert.equal(core.parseTime('evening'), null);
});

test('Phase 6 detects a true schedule collision before geography', async () => {
  const core = await logisticsCore();
  const a = { id:'a', time:{ start:600, end:660 } };
  const b = { id:'b', time:{ start:650, end:720 } };
  assert.equal(core.segmentAnalysis(a,b).feasibility, 'impossible');
});

test('Phase 6 uses coordinates only when available and labels transfer time as estimated', async () => {
  const core = await logisticsCore();
  const a = { id:'a', lat:40.70, lon:-74.00, time:{ start:600, end:660 }, location:'Downtown' };
  const b = { id:'b', lat:40.78, lon:-73.96, time:{ start:670, end:730 }, location:'Uptown' };
  const segment = core.segmentAnalysis(a,b);
  assert.ok(segment.distance_km > 5);
  assert.equal(segment.transfer.basis, 'estimated_from_straight_line_distance');
  assert.equal(segment.feasibility, 'strained');
});

test('Phase 6 never converts missing distance into a fabricated transfer time', async () => {
  const core = await logisticsCore();
  const a = { id:'a', time:{ start:600, end:660 }, location:'Place A' };
  const b = { id:'b', time:{ start:720, end:780 }, location:'Place B' };
  const segment = core.segmentAnalysis(a,b);
  assert.equal(segment.distance_km, null);
  assert.equal(segment.transfer, null);
  assert.equal(segment.feasibility, 'unverified');
});

test('Phase 6 filters inverse-period research to the selected stay', async () => {
  const core = await logisticsCore();
  const profile = { dates:{ start:'2026-09-12', end:'2026-09-15' }, destination_scope:{ values:['Nueva York'] }, planning:{} };
  const research = { items:[
    { id:'outside', name:'Outside', date_start:'2026-09-02', time:'19:00', venue:'A', location:'A' },
    { id:'inside', name:'Inside', date_start:'2026-09-13', time:'19:00', venue:'B', location:'B' }
  ] };
  const analysis = core.analyzeTrip(profile, research);
  assert.equal(analysis.metrics.stops, 1);
  assert.equal(analysis.days.find(day => day.date === '2026-09-13').stops[0].id, 'inside');
});

test('Phase 6 exposes a traceable Maps route and client integration contract', async () => {
  const core = await logisticsCore();
  const href = core.mapsDirectionsUrl([
    { venue:'Hotel A', location:'Manhattan, New York' },
    { venue:'Museum B', location:'Manhattan, New York' },
    { venue:'Theatre C', location:'Manhattan, New York' }
  ]);
  assert.match(href, /^https:\/\/www\.google\.com\/maps\/dir\/\?api=1/);
  const client = await readFile(new URL('../viajes/travel-logistics.js', import.meta.url), 'utf8');
  assert.match(client, /TravelLogisticsCore/);
  assert.match(client, /viajes:window-selected/);
  assert.match(client, /viajes:research-ready/);
  assert.match(client, /Abrir ruta del día en Maps/);
  assert.match(client, /no tiempos de tráfico en vivo/i);
});
