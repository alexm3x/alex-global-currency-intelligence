import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const code=await readFile(path.join(root,'viajes','asc-intelligence-command.js'),'utf8');
const loader=await readFile(path.join(root,'viajes','opportunity-imports.js'),'utf8');

test('phases 5-7 client parses',()=>assert.doesNotThrow(()=>new vm.Script(code)));
test('phase 5 exposes explainable score weights and confidence',()=>{
  assert.match(code,/asc-intelligence-score-v1/); assert.match(code,/base:30,value:20,connectivity:15,fx:15,match:20/); assert.match(code,/confidence/); assert.match(code,/Cost Index/);
});
test('phase 6 includes Trip Command Center lifecycle and artifact handoffs',()=>{
  assert.match(code,/Trip Command Center/); assert.match(code,/ANTES/); assert.match(code,/DURANTE/); assert.match(code,/DESPUÉS/); assert.match(code,/viajes:itinerary-ready/); assert.match(code,/viajes:cost-ready/); assert.match(code,/viajes:pdf-ready/);
});
test('phase 7 monitoring stays local unless a real connector exists',()=>{
  assert.match(code,/viajesASCTravelWatchlistV1/); assert.match(code,/local_watch_intent_only_external_notification_inactive/); assert.match(code,/Notificación externa: NO ACTIVA/);
});
test('new layer is loaded by existing chain',()=>assert.match(loader,/asc-intelligence-command\.js/));
test('no obvious embedded secret or random score fabrication',()=>{assert.doesNotMatch(code,/sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY\s*[:=]/);assert.doesNotMatch(code,/Math\.random\(/);});
