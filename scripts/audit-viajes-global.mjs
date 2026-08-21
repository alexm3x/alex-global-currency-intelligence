import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const viajes=path.join(root,'viajes');
const errors=[];
const warnings=[];
const load=async p=>readFile(path.join(root,p),'utf8');
const must=(condition,message)=>{if(!condition)errors.push(message);};
const has=(source,regex,message)=>must(regex.test(source),message);

const [page,globalExperience,travelOS,intelligence,quality,sw,loader,benchmark,transformation]=await Promise.all([
  load('viajes/index.html'),load('viajes/asc-global-experience.js'),load('viajes/asc-travel-os.js'),
  load('viajes/asc-intelligence-command.js'),load('viajes/asc-global-quality.js'),load('viajes/sw.js'),
  load('viajes/opportunity-imports.js'),load('docs/VIAJES_ASC_GLOBAL_COMPETITIVE_MATRIX_2026.md'),
  load('viajes/transformation-manifest.json')
]);
const manifest=JSON.parse(await load('viajes/manifest.webmanifest'));
const program=JSON.parse(transformation);

for(const asset of ['viajes/manifest.webmanifest','viajes/asc-icon.svg','viajes/sw.js','viajes/asc-global-quality.js','docs/VIAJES_ASC_GLOBAL_COMPETITIVE_MATRIX_2026.md']){
  try{await access(path.join(root,asset));}catch{errors.push(`Missing final transformation asset: ${asset}`);}
}

must(manifest.name?.includes('Viajes ASC'),'PWA manifest name');
must(manifest.start_url==='./','PWA start_url must remain inside /viajes/ scope');
must(manifest.scope==='./','PWA scope must remain inside /viajes/');
must(manifest.display==='standalone','PWA standalone display');
must(Array.isArray(manifest.icons)&&manifest.icons.length>0,'PWA icon missing');

has(sw,/url\.origin !== self\.location\.origin/,'Service worker must reject cross-origin caching');
has(sw,/request\.mode === 'navigate'/,'Service worker navigation fallback');
has(sw,/caches\.match\('\.\/index\.html'\)/,'Offline shell fallback');
has(sw,/networkFirst\(request\)/,'Fresh data network-first policy');

has(quality,/manifest\.webmanifest/,'Manifest runtime attachment');
has(quality,/navigator\.serviceWorker\.register\('\.\/sw\.js'/,'Service worker registration');
has(quality,/PerformanceObserver/,'Runtime performance observation');
has(quality,/metaKey\|\|e\.ctrlKey/,'CMD CTRL command palette shortcut');
has(quality,/ASC System Health/,'System Health command');
has(quality,/cotizaciones, mapas externos y disponibilidad/i,'Offline truth disclosure');

has(globalExperience,/prefers-reduced-motion/,'Reduced motion support');
has(globalExperience,/:focus-visible/,'Visible keyboard focus');
has(globalExperience,/asc-mobile-nav/,'Mobile navigation');
has(page,/<html lang="es"/,'Document language');
has(page,/name="viewport"/,'Responsive viewport');

has(travelOS,/asc-travel-dna-v1/,'Travel DNA contract');
has(travelOS,/asc-travel-intent-v1/,'Structured Copilot contract');
has(intelligence,/asc-intelligence-score-v1/,'Explainable intelligence contract');
has(intelligence,/Notificación externa: NO ACTIVA/,'No fake alert disclosure');
has(loader,/asc-global-quality\.js/,'Global Quality layer must be loaded');

must(program.currentPhase===10,`Transformation current phase must be 10; got ${program.currentPhase}`);
must(Array.isArray(program.completed)&&[0,1,2,3,4,5,6,7,8,9,10].every(n=>program.completed.includes(n)),'Transformation manifest must cover phases 0-10');
must(program.governance?.noFabrication===true,'No-fabrication governance');
must(program.governance?.externalAlertsMustUseRealConnector===true,'Real connector required for external alerts');

for(const competitor of ['Google','Booking.com','Expedia','KAYAK','Skyscanner','Airbnb']) has(benchmark,new RegExp(competitor.replace('.','\\.'),'i'),`Benchmark missing ${competitor}`);
has(benchmark,/21 de agosto de 2026/,'Benchmark freshness date');
has(benchmark,/no entrar en una guerra de inventario/i,'ASC differentiation thesis');

const secretPatterns=[/sk-[A-Za-z0-9_-]{20,}/,/OPENAI_API_KEY\s*[:=]\s*["'][^"']+["']/];
for(const [name,source] of [['asc-global-quality.js',quality],['sw.js',sw],['benchmark',benchmark],['transformation',transformation]]){
  if(secretPatterns.some(p=>p.test(source)))errors.push(`Potential secret in ${name}`);
}

if(!/LCP < 2\.5 s/.test(page) && !/largest-contentful-paint/.test(quality)) warnings.push('Core Web Vitals targets are monitored at runtime but not certified by this static audit.');

console.log(`Viajes ASC Global Quality Audit: ${errors.length} error(s), ${warnings.length} warning(s), phases 0-${program.currentPhase}.`);
warnings.forEach(x=>console.warn(`WARN ${x}`));
if(errors.length){errors.forEach(x=>console.error(`ERROR ${x}`));process.exit(1);}
