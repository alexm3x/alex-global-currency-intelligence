import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const read = path => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Phase 13 release manifest freezes the complete contract chain', async () => {
  const manifest = JSON.parse(await read('viajes/release-manifest.json'));
  assert.equal(manifest.phase, 13);
  assert.equal(manifest.contracts.profile, 'travel-data-v4');
  assert.equal(manifest.contracts.research, 'asc-travel-intelligence-v1');
  assert.equal(manifest.contracts.window, 'asc-travel-window-v1');
  assert.equal(manifest.contracts.logistics, 'asc-travel-logistics-v1');
  assert.equal(manifest.contracts.itinerary, 'asc-travel-itinerary-v1');
  assert.equal(manifest.contracts.cost, 'asc-travel-cost-v1');
  assert.equal(manifest.contracts.pdf, 'asc-travel-pdf-v1');
  assert.equal(manifest.contracts.integration, 'asc-travel-integration-v1');
  assert.equal(manifest.qualityPolicy.noFabrication, true);
});

test('Phase 11 institutional QA gate checks safety, privacy and every client contract', async () => {
  const source = await read('scripts/qa-viajes-release.mjs');
  for (const token of ['travel-data-v4','asc-travel-intelligence-v1','asc-travel-window-v1','asc-travel-logistics-v1','asc-travel-itinerary-v1','asc-travel-cost-v1','asc-travel-pdf-v1','asc-travel-integration-v1']) {
    assert.match(source, new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
  }
  assert.match(source, /syntheticStaysStayDemo/);
  assert.match(source, /externalAlertsRequireRealConnector/);
  assert.match(source, /privacyBoundedLocalHistory/);
});

test('Phase 13 production verifier separates core failures from external blockers', async () => {
  const source = await read('scripts/verify-viajes-production.mjs');
  assert.match(source, /verified_with_external_blockers/);
  assert.match(source, /custom_domain_unreachable/);
  assert.match(source, /openai_research_unavailable/);
  assert.match(source, /worker_health_failed/);
  assert.match(source, /worker_cors_failed/);
  assert.match(source, /release_verified_with_truthful_runtime_state/);
});

test('Phase 13 production verifier follows only bounded same-origin redirects', async () => {
  const source = await read('scripts/verify-viajes-production.mjs');
  assert.match(source, /redirect:'manual'/);
  assert.match(source, /next\.origin !== allowedOrigin/);
  assert.match(source, /cross_origin_redirect_not_followed/);
  assert.match(source, /same_origin_redirect_loop/);
  assert.match(source, /too_many_same_origin_redirects/);
  assert.match(source, /redirects\.push/);
});

test('Phase 12 publication is gated by Phase 11 and followed by Phase 13 verification', async () => {
  const pages = await read('.github/workflows/pages.yml');
  assert.match(pages, /Phase 11/);
  assert.match(pages, /qa-viajes-release\.mjs/);
  assert.match(pages, /Phase 12/);
  assert.match(pages, /actions\/deploy-pages@v5/);
  assert.match(pages, /Phase 13/);
  assert.match(pages, /verify-viajes-production\.mjs/);
  assert.match(pages, /viajes-release-production\.json/);
});

test('Worker and security workflows participate in the final release gate', async () => {
  const worker = await read('.github/workflows/deploy-viajes-assistant.yml');
  const security = await read('.github/workflows/viajes-toolchain-security.yml');
  assert.match(worker, /release-manifest\.json/);
  assert.match(worker, /qa-viajes-release\.mjs/);
  assert.match(worker, /phase:13/);
  assert.match(security, /qa-viajes-release\.mjs/);
  assert.match(security, /phase:13/);
});

test('Release manifest declares current external dependencies as non-blocking but explicit', async () => {
  const manifest = JSON.parse(await read('viajes/release-manifest.json'));
  const dependencies = Object.fromEntries(manifest.externalDependencies.map(item => [item.id, item]));
  assert.equal(dependencies.openai_research.failSafe, 'assistant_unavailable');
  assert.equal(dependencies.openai_research.releaseBlocking, false);
  assert.equal(dependencies.custom_domain.releaseBlocking, false);
  assert.match(dependencies.custom_domain.requiredFor, /alexsaldana\.com/);
});
