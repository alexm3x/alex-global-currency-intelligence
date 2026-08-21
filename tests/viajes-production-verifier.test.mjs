import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const verifier=await readFile(path.join(root,'scripts','verify-viajes-production.mjs'),'utf8');
const pages=await readFile(path.join(root,'.github','workflows','pages.yml'),'utf8');

test('production verifier covers provider gateway health, CORS and public asset',()=>{
  assert.match(verifier,/viajes-asc-providers\.proadmexico\.workers\.dev/);
  assert.match(verifier,/asc-live-providers\.js/);
  assert.match(verifier,/provider_gateway_health_failed/);
  assert.match(verifier,/provider_gateway_cors_failed/);
  assert.match(verifier,/live_provider_asset_unreachable/);
});

test('unconfigured provider credentials are external blockers rather than fabricated data',()=>{
  assert.match(verifier,/duffel_provider_unconfigured/);
  assert.match(verifier,/booking_provider_unconfigured/);
  assert.match(verifier,/openai_research_unavailable/);
});

test('Pages workflow runs hardening audit and persists provider runtime',()=>{
  assert.match(pages,/audit-viajes-production-hardening\.mjs/);
  assert.match(pages,/PROVIDER_URL:/);
  assert.match(pages,/providerRuntime:release\.phase13\.providers/);
  assert.match(pages,/asc-live-providers\.js/);
});
