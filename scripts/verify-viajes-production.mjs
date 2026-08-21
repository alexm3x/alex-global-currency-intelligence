import { writeFile } from 'node:fs/promises';

const outputIndex = process.argv.indexOf('--output');
const outputPath = outputIndex >= 0 ? process.argv[outputIndex + 1] : null;
const pagesUrl = process.env.PAGES_URL || 'https://alexm3x.github.io/alex-global-currency-intelligence/';
const pagesRoute = new URL('viajes/', pagesUrl).href;
const liveProviderAssetUrl = new URL('asc-live-providers.js', pagesRoute).href;
const customDomainUrl = process.env.CUSTOM_DOMAIN_URL || 'https://alexsaldana.com/viajes/';
const workerUrl = process.env.WORKER_URL || 'https://viajes-asc-assistant.proadmexico.workers.dev';
const providerUrl = process.env.PROVIDER_URL || 'https://viajes-asc-providers.proadmexico.workers.dev';
const deploymentSucceeded = process.env.PAGES_DEPLOYMENT_SUCCEEDED === '1';
const qaPassed = process.env.PHASE11_QA_PASSED === '1';

async function timedFetch(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try { return await fetch(url, { ...options, signal: controller.signal }); }
  finally { clearTimeout(timer); }
}

async function inspectPage(url) {
  const start = new URL(url);
  const allowedOrigin = start.origin;
  const redirects = [];
  const seen = new Set();
  let current = start.href;
  let initialStatus = null;
  try {
    for (let hop = 0; hop <= 5; hop += 1) {
      if (seen.has(current)) return { ok:false, status:0, initialStatus, finalUrl:current, location:null, redirects, bodyMarker:false, error:'same_origin_redirect_loop' };
      seen.add(current);
      const response = await timedFetch(current, { redirect:'manual', headers:{ 'user-agent':'ViajesASC-Production-Verification/2.0' } });
      if (initialStatus === null) initialStatus = response.status;
      const location = response.headers.get('location');
      if ([301,302,303,307,308].includes(response.status) && location) {
        const next = new URL(location, current);
        redirects.push({ status:response.status, from:current, to:next.href });
        if (next.origin !== allowedOrigin) return { ok:false, status:response.status, initialStatus, finalUrl:current, location:next.href, redirects, bodyMarker:false, error:'cross_origin_redirect_not_followed' };
        current = next.href;
        continue;
      }
      let bodyMarker = false;
      if (response.status === 200) bodyMarker = (await response.text()).includes('VIAJES ASC');
      return { ok:response.status === 200 && bodyMarker, status:response.status, initialStatus, finalUrl:current, location:null, redirects, bodyMarker, error:null };
    }
    return { ok:false, status:0, initialStatus, finalUrl:current, location:null, redirects, bodyMarker:false, error:'too_many_same_origin_redirects' };
  } catch (error) {
    return { ok:false, status:0, initialStatus, finalUrl:current, location:null, redirects, bodyMarker:false, error:String(error?.message || error) };
  }
}

async function inspectAsset(url, marker) {
  try {
    const response = await timedFetch(url, { headers:{ 'user-agent':'ViajesASC-Production-Verification/2.0' } });
    const text = response.status === 200 ? await response.text() : '';
    return { ok:response.status === 200 && text.includes(marker), status:response.status, marker, error:null };
  } catch (error) {
    return { ok:false, status:0, marker, error:String(error?.message || error) };
  }
}

async function inspectAssistantWorker() {
  const health = { ok:false, status:0, body:null, error:null };
  try {
    const response = await timedFetch(`${workerUrl}/health`, { headers:{ 'user-agent':'ViajesASC-Production-Verification/2.0' } });
    health.status = response.status;
    const body = await response.json().catch(() => null);
    health.body = body;
    health.ok = response.status === 200 && body?.status === 'ok' && body?.service === 'viajes-asc-assistant' && body?.contractVersion === 'asc-travel-intelligence-v1' && body?.windowContractVersion === 'asc-travel-window-v1';
  } catch (error) { health.error = String(error?.message || error); }

  const cors = { ok:false, status:0, allowOrigin:null, error:null };
  try {
    const response = await timedFetch(`${workerUrl}/research`, { method:'OPTIONS', headers:{ Origin:'https://alexsaldana.com', 'Access-Control-Request-Method':'POST' } });
    cors.status = response.status;
    cors.allowOrigin = response.headers.get('access-control-allow-origin');
    cors.ok = response.status >= 200 && response.status < 300 && cors.allowOrigin === 'https://alexsaldana.com';
  } catch (error) { cors.error = String(error?.message || error); }

  const research = { operational:false, status:0, contract:null, error:null, classification:null };
  try {
    const request = {
      action:'research_trip',
      profile:{
        schema_version:'travel-data-v4', trip_id:'production-smoke', created_at:new Date().toISOString(),
        origin:{ city:'MEX', airports:['MEX'] }, destination_scope:{ mode:'fixed', values:['Nueva York'] },
        dates:{ start:'2026-09-12', end:'2026-09-13', month:null, flex_days:0, nights_min:1, nights_max:1 },
        travelers:{ adults:2, children:[], rooms:1, relation:'couple', room_preferences:[], accessibility:'' },
        budget:{ amount:0, normalized_total:0, currency:'MXN', basis:'total', includes:[], strictness:'moderate', contingency_pct:10 },
        transport:{ cabin:'economy', direct_preference:'preferred', max_stops:1, max_total_hours:null },
        lodging:{ types:['hotel'], category_min:null, location_preferences:[] }, priorities:['eventos especiales'],
        hard_constraints:[], concerns:[], concern_rules:[], free_comments:'', derived_preferences:[], clarifications:[],
        planning:{ mode:'known_dates', period_approx:null, duration_days:2, budget_tier:null, pace:'balanced', hotel:null, preferred_zone:null, prepared_at:new Date().toISOString() }
      }
    };
    const response = await timedFetch(`${workerUrl}/research`, { method:'POST', headers:{ Origin:'https://alexsaldana.com', 'Content-Type':'application/json', 'x-asc-session':'production-verification' }, body:JSON.stringify(request) }, 90000);
    research.status = response.status;
    const body = await response.json().catch(() => ({}));
    if (response.status === 200 && body?.research?.contract === 'asc-travel-intelligence-v1') {
      research.operational = true; research.contract = body.research.contract; research.classification = 'operational';
    } else if (response.status === 503 && body?.error === 'assistant_unavailable') {
      research.error = body.error; research.classification = 'external_dependency_unavailable_fail_safe';
    } else {
      research.error = body?.error || `unexpected_http_${response.status}`; research.classification = 'unexpected_response';
    }
  } catch (error) {
    research.error = String(error?.message || error); research.classification = 'request_failed';
  }
  return { health, cors, research };
}

async function inspectProviderGateway() {
  const health = { ok:false, status:0, body:null, error:null };
  try {
    const response = await timedFetch(`${providerUrl}/health`, { headers:{ 'user-agent':'ViajesASC-Production-Verification/2.0' } });
    health.status = response.status;
    const body = await response.json().catch(() => null);
    health.body = body;
    health.ok = response.status === 200 && body?.status === 'ok' && body?.service === 'viajes-asc-providers' && body?.contract === 'asc-live-provider-gateway-v1' && body?.truth_policy === 'no_fabricated_price_or_availability';
  } catch (error) { health.error = String(error?.message || error); }

  const cors = { ok:false, status:0, allowOrigin:null, error:null };
  try {
    const response = await timedFetch(`${providerUrl}/search`, { method:'OPTIONS', headers:{ Origin:'https://alexm3x.github.io', 'Access-Control-Request-Method':'POST' } });
    cors.status = response.status;
    cors.allowOrigin = response.headers.get('access-control-allow-origin');
    cors.ok = response.status >= 200 && response.status < 300 && cors.allowOrigin === 'https://alexm3x.github.io';
  } catch (error) { cors.error = String(error?.message || error); }

  const providers = health.body?.providers || {};
  return {
    health,
    cors,
    readiness:{
      flights:providers.flights || null,
      stays:providers.stays || null,
      research:providers.research || null
    }
  };
}

const [pages, customDomain, assistant, providerGateway, liveProviderAsset] = await Promise.all([
  inspectPage(pagesRoute),
  inspectPage(customDomainUrl),
  inspectAssistantWorker(),
  inspectProviderGateway(),
  inspectAsset(liveProviderAssetUrl, '__VIAJES_ASC_LIVE_PROVIDERS__')
]);

const coreFailures = [];
if (!qaPassed) coreFailures.push('phase11_qa_not_passed');
if (!deploymentSucceeded) coreFailures.push('pages_deployment_not_confirmed');
if (!pages.ok) coreFailures.push('github_pages_route_unreachable');
if (!liveProviderAsset.ok) coreFailures.push('live_provider_asset_unreachable');
if (!assistant.health.ok) coreFailures.push('assistant_worker_health_failed');
if (!assistant.cors.ok) coreFailures.push('assistant_worker_cors_failed');
if (!providerGateway.health.ok) coreFailures.push('provider_gateway_health_failed');
if (!providerGateway.cors.ok) coreFailures.push('provider_gateway_cors_failed');

const externalBlockers = [];
if (!customDomain.ok) externalBlockers.push('custom_domain_unreachable');
if (!assistant.research.operational) externalBlockers.push('openai_research_unavailable');
if (!providerGateway.readiness.flights?.configured) externalBlockers.push('duffel_provider_unconfigured');
if (!providerGateway.readiness.stays?.configured) externalBlockers.push('booking_provider_unconfigured');

const status = coreFailures.length ? 'failed' : externalBlockers.length ? 'verified_with_external_blockers' : 'verified';

const result = {
  schemaVersion:2,
  service:'viajes-asc-release',
  release:'asc-viajes-production-hardening-2026-08-21',
  phase:13,
  verifiedAt:new Date().toISOString(),
  status,
  phase11:{ qaPassed },
  phase12:{ pagesDeploymentSucceeded:deploymentSucceeded, pagesUrl, pagesRoute, liveProviderAsset:{ url:liveProviderAssetUrl, ...liveProviderAsset } },
  phase13:{
    pages,
    customDomain:{ url:customDomainUrl, ...customDomain },
    assistant:{ workerUrl, workerHealth:assistant.health, workerCors:assistant.cors, research:assistant.research },
    providers:{ workerUrl:providerUrl, workerHealth:providerGateway.health, workerCors:providerGateway.cors, readiness:providerGateway.readiness },
    coreFailures,
    externalBlockers
  },
  releaseDecision:coreFailures.length ? 'do_not_claim_release_verified' : 'release_verified_with_truthful_runtime_state'
};

if (outputPath) await writeFile(outputPath, JSON.stringify(result, null, 2) + '\n');
console.log(`Viajes ASC production verification: ${status}. Core failures=${coreFailures.length}; external blockers=${externalBlockers.length}.`);
if (coreFailures.length) {
  coreFailures.forEach(failure => console.error(`ERROR ${failure}`));
  process.exit(1);
}
