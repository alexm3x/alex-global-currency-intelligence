import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'data', 'daily-briefing-latest.json');
const PODCAST = path.join(ROOT, 'podcast');
const latestPath = path.join(PODCAST, 'latest.json');
const archivePath = path.join(PODCAST, 'archive.json');
const generatedDir = path.join(PODCAST, 'generated');
const segmentsDir = path.join(generatedDir, 'segments');

function fail(message){ console.error(`AGCI Morning Intelligence: ${message}`); process.exit(1); }
function readJson(file){ return JSON.parse(fs.readFileSync(file,'utf8')); }
function writeJson(file,value){ fs.mkdirSync(path.dirname(file),{recursive:true}); fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n'); }
function words(text=''){ return String(text).trim().split(/\s+/).filter(Boolean).length; }
function escapeXml(v=''){ return String(v).replace(/[<>&"']/g,c=>({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])); }
function clean(v=''){ return String(v||'').replace(/\s+/g,' ').trim(); }
function displayDate(iso){ const [y,m,d]=iso.split('-').map(Number); return new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d))); }

if(!fs.existsSync(SOURCE)) fail('falta data/daily-briefing-latest.json');
const source=readJson(SOURCE);
if(source.schemaVersion!==2) fail('schemaVersion del briefing debe ser 2');
for(const key of ['date','timestamp','title','executiveSummary','audio']) if(!source[key]) fail(`falta ${key}`);
if(!Array.isArray(source.audio.chapters)||source.audio.chapters.length<7) fail('audio.chapters debe tener al menos 7 capítulos');
if(!Array.isArray(source.sources)||source.sources.length<1) fail('debe existir trazabilidad de fuentes');

const sections=Array.isArray(source.sections)?source.sections:[];
const marketLines=(source.markets||[]).slice(0,12).map(x=>`${clean(x.asset)}: ${clean(x.value)}. ${clean(x.interpretation)}`).join(' ');
const equityLines=(source.equities||[]).slice(0,5).map(x=>`${clean(x.ticker)} se clasifica como ${clean(x.classification)}${x.thesis?`, por ${clean(x.thesis)}`:''}${x.confidence?`. Confianza ${clean(x.confidence)}`:''}.`).join(' ');
const travelLines=(source.travel||[]).slice(0,3).map(x=>`${clean(x.destination)}, desde ${clean(x.airport)}, ${clean(x.fare)}${x.dates?`, fechas ${clean(x.dates)}`:''}${x.classification?`. ${clean(x.classification)}`:''}.`).join(' ');
const signalLines=(source.threeSignals||[]).slice(0,3).map(x=>`${clean(x.label)}: ${clean(x.summary)}`).join(' ');
const actionLines=(source.actions||[]).slice(0,6).map((x,i)=>`${i+1}. ${clean(x)}`).join(' ');

function sectionText(regex){
  const s=sections.find(x=>regex.test(clean(x.title)));
  if(!s) return '';
  return [s.body&&clean(s.body),s.why&&`Por qué importa: ${clean(s.why)}`,s.implication&&`Implicación: ${clean(s.implication)}`,s.opportunity&&`Oportunidad: ${clean(s.opportunity)}`,s.risk&&`Riesgo: ${clean(s.risk)}`,s.signal&&`Próxima señal: ${clean(s.signal)}`].filter(Boolean).join(' ');
}
const mexicoDetail=sectionText(/México|Mexico/i);
const realEstateDetail=sectionText(/bienes raíces|real estate|negocios/i)||mexicoDetail;
const aiDetail=sectionText(/Inteligencia artificial|tecnolog|\bIA\b/i);
const marketsDetail=sectionText(/mercados|inversion/i);

function category(c){const k=`${c.id||''} ${c.title||''}`.toLowerCase();if(/apertura/.test(k))return'apertura';if(/señal|senal/.test(k))return'senales';if(/mercado/.test(k))return'mercados';if(/inversi|radar/.test(k))return'inversion';if(/méxico|mexico/.test(k))return'mexico';if(/capital|negocio|bienes/.test(k))return'capital';if(/\bia\b|inteligencia artificial|ai capital/.test(k))return'ia';if(/viaje|travel/.test(k))return'viajes';if(/qué haría|que haria|acciones/.test(k))return'acciones';return'general';}
function speakerFor(c){if(c.speaker)return clean(c.speaker).toUpperCase();const cat=category(c);return['mercados','inversion','capital','ia','viajes'].includes(cat)?'ANALISTA':'CIO';}
function addUnique(base,extra){extra=clean(extra);if(!extra)return base;const probe=extra.slice(0,70).toLowerCase();if(clean(base).toLowerCase().includes(probe))return base;return`${clean(base)} ${extra}`.trim();}

let chapterDrafts=source.audio.chapters.map(c=>{
  let text=clean(c.text);const cat=category(c);
  if(cat==='apertura')text=addUnique(text,`La lectura ejecutiva del día es la siguiente: ${clean(source.executiveSummary)} La postura es ${clean(source.stance||'selectiva')}; el riesgo se clasifica como ${clean(source.risk||'elevado')} y el horizonte principal es ${clean(source.horizon||'de corto a mediano plazo')}.`);
  if(cat==='senales')text=addUnique(text,signalLines);
  if(cat==='mercados'){text=addUnique(text,marketLines);text=addUnique(text,marketsDetail);}
  if(cat==='inversion')text=addUnique(text,equityLines);
  if(cat==='mexico')text=addUnique(text,mexicoDetail);
  if(cat==='capital')text=addUnique(text,realEstateDetail);
  if(cat==='ia')text=addUnique(text,aiDetail);
  if(cat==='viajes')text=addUnique(text,travelLines);
  if(cat==='acciones')text=addUnique(text,actionLines);
  return{id:c.id,title:clean(c.title),text,speaker:speakerFor(c)};
});

const minimumWords=1150;
const supplementPool=sections.flatMap(s=>[
  clean(s.body),
  s.why&&`Por qué importa: ${clean(s.why)}`,
  s.implication&&`Implicación de inversión o negocio: ${clean(s.implication)}`,
  s.opportunity&&`Oportunidad identificada: ${clean(s.opportunity)}`,
  s.risk&&`Riesgo principal: ${clean(s.risk)}`,
  s.signal&&`Señal a vigilar: ${clean(s.signal)}`
]).filter(Boolean);
let totalWords=chapterDrafts.reduce((n,c)=>n+words(`${c.title} ${c.text}`),0),poolIndex=0,chapterIndex=2;
while(totalWords<minimumWords&&supplementPool.length&&poolIndex<supplementPool.length*3){
  const extra=supplementPool[poolIndex%supplementPool.length];
  const target=chapterIndex%Math.max(1,chapterDrafts.length-1);
  const before=words(chapterDrafts[target].text);
  chapterDrafts[target].text=addUnique(chapterDrafts[target].text,extra);
  totalWords+=Math.max(0,words(chapterDrafts[target].text)-before);
  poolIndex++;chapterIndex++;
}
if(totalWords<1000)fail(`guion demasiado corto: ${totalWords} palabras; requiere mayor profundidad editorial en el JSON maestro`);
if(totalWords>1900)fail(`guion demasiado largo: ${totalWords} palabras; objetivo 8–12 minutos`);

let actualDurations=null;
if(process.env.CHAPTER_DURATIONS_JSON){try{actualDurations=JSON.parse(process.env.CHAPTER_DURATIONS_JSON);}catch{fail('CHAPTER_DURATIONS_JSON inválido');}if(!Array.isArray(actualDurations)||actualDurations.length!==chapterDrafts.length||actualDurations.some(x=>!(Number(x)>0)))fail('duraciones de capítulos incompletas');}
const speechRateWpm=Number(process.env.SPEECH_RATE_WPM||138);
let cursor=0;
const chapters=chapterDrafts.map((c,index)=>{const chapter={id:c.id,start:Math.round(cursor),title:c.title,text:c.text,speaker:c.speaker};cursor+=actualDurations?Number(actualDurations[index]):(words(`${c.title}. ${c.text}`)/speechRateWpm)*60+.8;return chapter;});
const estimatedDuration=Math.max(60,Math.round(cursor));
const audioDuration=Number(process.env.AUDIO_DURATION_SECONDS||0);
const durationSeconds=audioDuration>0?Math.round(audioDuration):estimatedDuration;
const audioUrl=process.env.AUDIO_URL||null;
const episodeNumber=Number(source.episodeNumber||0)||Math.max(1,Math.floor((new Date(`${source.date}T00:00:00Z`)-new Date('2026-08-08T00:00:00Z'))/86400000));

fs.rmSync(segmentsDir,{recursive:true,force:true});fs.mkdirSync(segmentsDir,{recursive:true});
const renderPlan={schemaVersion:1,date:source.date,totalWords,voiceMode:'dual',segments:chapterDrafts.map((c,index)=>{const file=`podcast/generated/segments/${String(index).padStart(2,'0')}.txt`;fs.writeFileSync(path.join(ROOT,file),`${c.title}. ${c.text}\n`);return{index,speaker:c.speaker,voice:c.speaker==='ANALISTA'?'es+f3':'es+m3',file,title:c.title,words:words(`${c.title} ${c.text}`)};})};
writeJson(path.join(generatedDir,'render-plan.json'),renderPlan);

const episode={schemaVersion:2,status:audioUrl?'published':'generated',date:source.date,timestamp:source.timestamp,timezone:source.timezone||'America/Mexico_City',episodeNumber,title:source.title,subtitle:source.audio.subtitle||'Mercados, inversión y oportunidades estratégicas en menos de 12 minutos.',durationSeconds,executiveSummary:source.executiveSummary,threeSignals:source.threeSignals||[],chapters,markets:source.markets||[],equities:source.equities||[],mexico:sections.find(x=>/México/i.test(x.title))||null,realEstate:sections.find(x=>/bienes raíces/i.test(x.title))||null,ai:sections.find(x=>/Inteligencia artificial/i.test(x.title))||null,travel:source.travel||[],actions:source.actions||[],sources:source.sources||[],voiceMode:'dual',voices:[{role:'CIO',engine:'eSpeak NG',variant:'es+m3'},{role:'ANALISTA',engine:'eSpeak NG',variant:'es+f3'}],audioUrl,pdfUrl:source.pdfUrl||null,transcriptUrl:`podcast/episodes/${source.date.slice(0,4)}/${source.date.slice(5,7)}/${source.date}.txt`,archiveUrl:'podcast/',sourceUrl:'data/daily-briefing-latest.json',isStale:false,fallbackMode:audioUrl?'audio':'speechSynthesis'};

fs.mkdirSync(generatedDir,{recursive:true});
const plainScript=chapters.map(c=>`[${c.speaker}] ${c.title}.\n${c.text}`).join('\n\n');
fs.writeFileSync(path.join(generatedDir,'script.txt'),plainScript+'\n');
fs.writeFileSync(path.join(generatedDir,'transcript.md'),`# ${source.audio.title||'AGCI Morning Intelligence'}\n\n**${displayDate(source.date)} · Ciudad de México**\n\n${chapters.map(c=>`## ${c.title}\n\n**${c.speaker}:** ${c.text}`).join('\n\n')}\n`);
writeJson(latestPath,episode);
const yyyy=source.date.slice(0,4),mm=source.date.slice(5,7),episodeDir=path.join(PODCAST,'episodes',yyyy,mm);fs.mkdirSync(episodeDir,{recursive:true});writeJson(path.join(episodeDir,`${source.date}.json`),episode);fs.writeFileSync(path.join(episodeDir,`${source.date}.txt`),plainScript+'\n');

let archive={schemaVersion:2,updatedAt:source.timestamp,episodes:[]};if(fs.existsSync(archivePath)){try{archive=readJson(archivePath);}catch{}}archive.schemaVersion=2;archive.updatedAt=source.timestamp;archive.episodes=Array.isArray(archive.episodes)?archive.episodes.filter(e=>e.date!==source.date):[];archive.episodes.unshift({date:source.date,title:source.title,durationSeconds,audioUrl,transcriptUrl:episode.transcriptUrl,pdfUrl:episode.pdfUrl,status:episode.status,voiceMode:'dual'});archive.episodes=archive.episodes.slice(0,366);writeJson(archivePath,archive);

const site='https://alexm3x.github.io/alex-global-currency-intelligence/';
const rssItems=archive.episodes.slice(0,50).map(e=>{const audio=e.audioUrl?`<enclosure url="${escapeXml(new URL(e.audioUrl,site).href)}" type="audio/mpeg"/>`:'';return`<item><title>${escapeXml(e.title)}</title><guid>${escapeXml(e.date)}</guid><pubDate>${new Date(`${e.date}T14:00:00Z`).toUTCString()}</pubDate><link>${site}podcast/</link><description>${escapeXml('AGCI Morning Intelligence — inteligencia ejecutiva diaria en español.')}</description>${audio}</item>`;}).join('');
const rss=`<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>AGCI Morning Intelligence</title><link>${site}podcast/</link><description>Mercados, inversión y oportunidades estratégicas en español.</description><language>es-MX</language>${rssItems}</channel></rss>`;fs.writeFileSync(path.join(PODCAST,'feed.xml'),rss+'\n');
console.log(JSON.stringify({date:source.date,chapters:chapters.length,totalWords,durationSeconds,audioUrl,voiceMode:'dual',episodePath:`podcast/episodes/${yyyy}/${mm}/${source.date}.json`},null,2));
