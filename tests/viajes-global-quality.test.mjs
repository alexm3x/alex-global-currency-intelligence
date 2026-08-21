import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=p=>readFile(path.join(root,p),'utf8');
const [quality,sw,manifestText,benchmark,transformation,loader]=await Promise.all([
  read('viajes/asc-global-quality.js'),read('viajes/sw.js'),read('viajes/manifest.webmanifest'),
  read('docs/VIAJES_ASC_GLOBAL_COMPETITIVE_MATRIX_2026.md'),read('viajes/transformation-manifest.json'),read('viajes/opportunity-imports.js')
]);
const manifest=JSON.parse(manifestText);
const program=JSON.parse(transformation);

test('phase 8 PWA assets parse and stay scoped to Viajes ASC',()=>{
  assert.doesNotThrow(()=>new vm.Script(quality));
  assert.doesNotThrow(()=>new vm.Script(sw));
  assert.equal(manifest.start_url,'./');
  assert.equal(manifest.scope,'./');
  assert.equal(manifest.display,'standalone');
  assert.ok(manifest.icons.length>=1);
  assert.match(sw,/url\.origin !== self\.location\.origin/);
  assert.match(sw,/caches\.match\('\.\/index\.html'\)/);
});

test('phase 9 quality layer has system health, performance observation and command palette',()=>{
  assert.match(quality,/ASC System Health/);
  assert.match(quality,/PerformanceObserver/);
  assert.match(quality,/largest-contentful-paint/);
  assert.match(quality,/layout-shift/);
  assert.match(quality,/metaKey\|\|e\.ctrlKey/);
  assert.match(loader,/asc-global-quality\.js/);
});

test('phase 10 benchmark covers all required international references',()=>{
  for(const name of ['Google','Booking.com','Expedia','KAYAK','Skyscanner','Airbnb']) assert.match(benchmark,new RegExp(name.replace('.','\\.'),'i'));
  assert.match(benchmark,/21 de agosto de 2026/);
  assert.match(benchmark,/GLOBAL PERSONAL TRAVEL INTELLIGENCE/);
});

test('transformation program reaches phase 10 without relaxing governance',()=>{
  assert.equal(program.currentPhase,10);
  assert.deepEqual(program.completed,[0,1,2,3,4,5,6,7,8,9,10]);
  assert.equal(program.governance.noFabrication,true);
  assert.equal(program.governance.externalAlertsMustUseRealConnector,true);
});

test('final global static audit passes',()=>{
  const run=spawnSync(process.execPath,[path.join(root,'scripts','audit-viajes-global.mjs')],{encoding:'utf8'});
  assert.equal(run.status,0,`${run.stdout}\n${run.stderr}`);
});

test('final assets contain no obvious embedded secrets',()=>{
  for(const source of [quality,sw,benchmark,transformation]) assert.doesNotMatch(source,/sk-[A-Za-z0-9_-]{20,}|OPENAI_API_KEY\s*[:=]/);
});
