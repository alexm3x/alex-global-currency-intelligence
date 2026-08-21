import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const required=[
  'cloudflare/viajes-provider-gateway.js','wrangler.viajes-providers.jsonc','viajes/asc-live-providers.js',
  'viajes/production-hardening-manifest.json','tests/viajes-provider-hardening.test.mjs','.github/workflows/deploy-viajes-providers.yml'
];
const checks=[];
for(const file of required){try{await access(path.join(root,file));checks.push({id:`file:${file}`,ok:true})}catch{checks.push({id:`file:${file}`,ok:false})}}
const worker=await readFile(path.join(root,'cloudflare/viajes-provider-gateway.js'),'utf8');
const ui=await readFile(path.join(root,'viajes/asc-live-providers.js'),'utf8');
const sw=await readFile(path.join(root,'viajes/sw.js'),'utf8');
const manifest=JSON.parse(await readFile(path.join(root,'viajes/production-hardening-manifest.json'),'utf8'));
const assert=(id,ok)=>checks.push({id,ok:Boolean(ok)});
assert('contract:provider-gateway',worker.includes('asc-live-provider-gateway-v1'));
assert('provider:duffel',worker.includes('api.duffel.com/air/offer_requests'));
assert('provider:booking-demand-v3.2',worker.includes('demandapi.booking.com/3.2'));
assert('truth:no-fabricated-price',worker.includes('no_fabricated_price_or_availability'));
assert('truth:no-random',!worker.includes('Math.random('));
assert('security:no-obvious-secret',!/sk-[A-Za-z0-9_-]{20,}|Bearer\s+[A-Za-z0-9_-]{30,}/.test(worker));
assert('pwa:no-cross-origin-cache',sw.includes('url.origin !== self.location.origin'));
assert('ui:live-unavailable',ui.includes('LIVE READY')&&ui.includes('UNAVAILABLE'));
assert('manifest:stage13',manifest.currentStage===13);
assert('alerts:inactive-without-connector',manifest.stages?.['13']?.externalAlerts==='inactive_until_real_connector');
const failed=checks.filter(x=>!x.ok);
const report={schemaVersion:1,audit:'viajes-production-hardening-11-13',generatedAt:new Date().toISOString(),status:failed.length?'failed':'passed',total:checks.length,passed:checks.length-failed.length,failed:failed.length,checks};
console.log(JSON.stringify(report,null,2));
if(failed.length)process.exit(1);
