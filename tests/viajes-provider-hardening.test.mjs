import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const worker=await readFile(path.join(root,'cloudflare','viajes-provider-gateway.js'),'utf8');
const ui=await readFile(path.join(root,'viajes','asc-live-providers.js'),'utf8');
const sw=await readFile(path.join(root,'viajes','sw.js'),'utf8');
const loader=await readFile(path.join(root,'viajes','opportunity-imports.js'),'utf8');
const manifest=JSON.parse(await readFile(path.join(root,'viajes','production-hardening-manifest.json'),'utf8'));

test('hardening stages 11-13 are declared',()=>{
  assert.equal(manifest.currentStage,13);
  assert.equal(manifest.stages['12'].contract,'asc-live-provider-gateway-v1');
  assert.equal(manifest.truthPolicy.fabricatedPrices,false);
});

test('provider gateway has explicit credential gates and no embedded secrets',()=>{
  assert.match(worker,/DUFFEL_ACCESS_TOKEN_not_configured/);
  assert.match(worker,/Booking Demand credentials_not_configured/);
  assert.match(worker,/truth_policy:'no_fabricated_price_or_availability'/);
  assert.doesNotMatch(worker,/sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9_-]{30,}/);
});

test('flight offers are marked LIVE and require revalidation',()=>{
  assert.match(worker,/provider:'duffel'/);
  assert.match(worker,/status:'LIVE'/);
  assert.match(worker,/Revalidar el offer inmediatamente antes de reservar/);
});

test('Booking integration uses Demand API v3.2 and total/display price',()=>{
  assert.match(worker,/demandapi\.booking\.com\/3\.2/);
  assert.match(worker,/price\?\.display/);
  assert.match(worker,/price\?\.total/);
});

test('provider UI visibly distinguishes LIVE from UNAVAILABLE',()=>{
  assert.match(ui,/LIVE READY/);
  assert.match(ui,/UNAVAILABLE/);
  assert.match(ui,/Viajes ASC no sustituye precios faltantes/);
});

test('PWA does not cache external provider responses',()=>{
  assert.match(sw,/url\.origin !== self\.location\.origin/);
  assert.match(sw,/asc-live-providers\.js/);
});

test('existing loader loads provider hub',()=>assert.match(loader,/asc-live-providers\.js/));
