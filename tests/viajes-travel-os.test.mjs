import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const os=await readFile(path.join(root,'viajes','asc-travel-os.js'),'utf8');
const loader=await readFile(path.join(root,'viajes','opportunity-imports.js'),'utf8');

test('phases 2-4 client parses',()=>assert.doesNotThrow(()=>new vm.Script(os)));
test('phase 2 Travel DNA is editable, consent-based and supports guest mode',()=>{
  assert.match(os,/asc-travel-dna-v1/); assert.match(os,/viajesASCGuestMode/); assert.match(os,/clearDNA/); assert.match(os,/consent/);
});
test('phase 3 Copilot produces structured intent without fabricated live data',()=>{
  assert.match(os,/asc-travel-intent-v1/); assert.match(os,/parseIntent/); assert.match(os,/confidence/); assert.doesNotMatch(os,/Math\.random\(/);
});
test('phase 4 comparison is capped and driven by loaded destination data',()=>{
  assert.match(os,/compare\.length>=5/); assert.match(os,/viajes:data-ready/); assert.match(os,/Destination Battle/); assert.match(os,/Dato no disponible/);
});
test('travel OS is loaded by existing client chain',()=>assert.match(loader,/asc-travel-os\.js/));
test('no obvious embedded secret',()=>assert.doesNotMatch(os,/sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY\s*[:=]/));
