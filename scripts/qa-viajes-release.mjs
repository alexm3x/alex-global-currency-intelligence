import { access, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viajesDir = path.join(root, 'viajes');
const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
const checks = [];
const failures = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok: Boolean(ok), detail });
  if (!ok) failures.push(`${name}${detail ? `: ${detail}` : ''}`);
}

async function exists(file) {
  try { await access(file); return true; } catch { return false; }
}

const manifestPath = path.join(viajesDir, 'release-manifest.json');
const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
check('release manifest schema', manifest.schemaVersion === 1);
check('release phase', manifest.phase === 13, `expected 13, got ${manifest.phase}`);
check('release identifier', /^asc-viajes-phase13-/.test(manifest.release || ''));

const expectedContracts = {
  profile: 'travel-data-v4',
  research: 'asc-travel-intelligence-v1',
  window: 'asc-travel-window-v1',
  logistics: 'asc-travel-logistics-v1',
  itinerary: 'asc-travel-itinerary-v1',
  cost: 'asc-travel-cost-v1',
  pdf: 'asc-travel-pdf-v1',
  integration: 'asc-travel-integration-v1'
};
for (const [key, value] of Object.entries(expectedContracts)) {
  check(`contract ${key}`, manifest.contracts?.[key] === value, `${manifest.contracts?.[key] || 'missing'}`);
}

for (const asset of manifest.clientAssets || []) {
  check(`asset ${asset}`, await exists(path.join(viajesDir, asset)));
}

const sources = Object.fromEntries(await Promise.all([
  'travel-assistant-core.js','travel-assistant.js','travel-intelligence-core.js','travel-intelligence.js',
  'travel-window-engine.js','travel-logistics-core.js','travel-logistics.js','travel-itinerary-core.js',
  'travel-itinerary.js','travel-cost-core.js','travel-cost.js','travel-pdf-core.js','travel-pdf.js',
  'travel-integration-core.js','travel-integration.js','index.html','stays-intelligence.js'
].map(async file => [file, await readFile(path.join(viajesDir, file), 'utf8')])));

const contractEvidence = [
  ['travel-assistant-core.js', 'travel-data-v4'],
  ['travel-intelligence-core.js', 'asc-travel-intelligence-v1'],
  ['travel-window-engine.js', 'research_windows'],
  ['travel-logistics-core.js', 'asc-travel-logistics-v1'],
  ['travel-itinerary-core.js', 'asc-travel-itinerary-v1'],
  ['travel-cost-core.js', 'asc-travel-cost-v1'],
  ['travel-pdf-core.js', 'asc-travel-pdf-v1'],
  ['travel-integration-core.js', 'asc-travel-integration-v1']
];
for (const [file, token] of contractEvidence) check(`${file} exposes ${token}`, sources[file].includes(token));

check('two planning modes preserved', /known_dates/.test(sources['travel-assistant.js']) && /inverse_dates/.test(sources['travel-assistant.js']));
check('phase 5 selected-window handoff preserved', /viajes:window-selected/.test(sources['travel-window-engine.js']));
check('phase 6 research handoff preserved', /viajes:research-ready/.test(sources['travel-logistics.js']));
check('phase 7 itinerary handoff preserved', /viajes:itinerary-ready/.test(sources['travel-itinerary.js']));
check('phase 8 cost handoff preserved', /viajes:cost-ready/.test(sources['travel-cost.js']));
check('phase 9 PDF handoff preserved', /viajes:pdf-ready/.test(sources['travel-pdf.js']));
check('phase 10 integration handoff preserved', /viajes:integration-ready/.test(sources['travel-integration.js']));

check('PDF uses browser-native print', /popup\.print\(\)/.test(sources['travel-pdf.js']));
check('PDF keeps evidence-only disclosure', /solo reorganiza evidencia existente/i.test(sources['travel-pdf.js']));
check('cost engine forbids implicit FX', /never_converted_without_explicit_fx_evidence/.test(sources['travel-cost-core.js']));
check('event premium cannot be double counted', /never_double_counted/.test(sources['travel-cost-core.js']));
check('stays remain explicitly demonstrative', /Modo demostración:/i.test(sources['index.html']));
check('integration forbids demo-to-live promotion', /parameter_sync_only_demo_data_never_promoted_to_live/.test(sources['travel-integration-core.js']));
check('external alert state remains inactive', /local_watch_intent_only_external_notification_inactive/.test(sources['travel-integration-core.js']));
check('UI labels external notification inactive', /Notificación externa: NO ACTIVA/.test(sources['travel-integration.js']));
check('history storage is bounded', /mergeBounded\(parse\(KEYS\.history,\[\]\),record,20/.test(sources['travel-integration.js']) && /slice\(0, Math\.max\(1, Number\(max\)/.test(sources['travel-integration-core.js']));
check('private free comments are not copied by integration core', !/free_comments\s*:/.test(sources['travel-integration-core.js']));

const auditScript = await readFile(path.join(root, 'scripts', 'audit-viajes-site.mjs'), 'utf8');
const pagesWorkflow = await readFile(path.join(root, '.github', 'workflows', 'pages.yml'), 'utf8');
const workerWorkflow = await readFile(path.join(root, '.github', 'workflows', 'deploy-viajes-assistant.yml'), 'utf8');
const securityWorkflow = await readFile(path.join(root, '.github', 'workflows', 'viajes-toolchain-security.yml'), 'utf8');
check('site audit exists', /Viajes ASC audit:/.test(auditScript));
check('Pages workflow has release manifest gate', /release-manifest\.json/.test(pagesWorkflow));
check('Worker workflow has release manifest gate', /release-manifest\.json/.test(workerWorkflow));
check('Security workflow has release gate', /qa-viajes-release\.mjs/.test(securityWorkflow));
check('Pages workflow declares Phase 13', /phase:13/.test(pagesWorkflow));
check('Worker workflow declares Phase 13', /phase:13/.test(workerWorkflow));
check('Security workflow declares Phase 13', /phase:13/.test(securityWorkflow));

const secretPattern = /sk-[A-Za-z0-9_-]{20,}/;
for (const [file, source] of Object.entries(sources)) check(`no embedded OpenAI key in ${file}`, !secretPattern.test(source));

const passed = checks.filter(item => item.ok).length;
const result = {
  schemaVersion: 1,
  service: 'viajes-asc-phase11-qa',
  release: manifest.release,
  phase: 11,
  targetPhase: 13,
  generatedAt: new Date().toISOString(),
  status: failures.length ? 'failed' : 'passed',
  checks: { total: checks.length, passed, failed: failures.length },
  failures,
  policy: {
    noFabrication: true,
    syntheticStaysStayDemo: true,
    implicitFxForbidden: true,
    externalAlertsRequireRealConnector: true,
    privacyBoundedLocalHistory: true
  }
};

if (outputPath) await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(`Viajes ASC Phase 11 QA: ${passed}/${checks.length} passed, ${failures.length} failed.`);
if (failures.length) {
  failures.forEach(failure => console.error(`ERROR ${failure}`));
  process.exit(1);
}
