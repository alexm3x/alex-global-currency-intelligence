import fs from 'node:fs';
import path from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';

const ROOT = process.cwd();
const PLAN = path.join(ROOT, 'podcast', 'generated', 'render-plan.json');
const SOURCE = path.join(ROOT, 'data', 'daily-briefing-latest.json');
const RESULT = path.join(ROOT, 'podcast', 'generated', 'chirp-result.json');
const CIO_VOICE = process.env.CHIRP_CIO_VOICE || 'es-US-Chirp3-HD-Achird';
const ANALYST_VOICE = process.env.CHIRP_ANALYST_VOICE || 'es-US-Chirp3-HD-Achernar';
const LANGUAGE = process.env.CHIRP_LANGUAGE || 'es-US';
const API = 'https://texttospeech.googleapis.com/v1/text:synthesize';

function fail(message) {
  console.error(`AGCI Chirp 3 HD: ${message}`);
  process.exit(1);
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function duration(file) {
  const out = execFileSync('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1', file], {encoding:'utf8'}).trim();
  const n = Number(out);
  if (!(n > 0)) fail(`duración inválida para ${file}`);
  return n;
}
function run(cmd,args) {
  const r=spawnSync(cmd,args,{stdio:'inherit'});
  if(r.status!==0) fail(`${cmd} terminó con código ${r.status}`);
}
function token() {
  try {
    return execFileSync('gcloud',['auth','application-default','print-access-token'],{encoding:'utf8'}).trim();
  } catch {
    try { return execFileSync('gcloud',['auth','print-access-token'],{encoding:'utf8'}).trim(); }
    catch { fail('no fue posible obtener access token de Google Cloud'); }
  }
}

if (!fs.existsSync(PLAN)) fail('falta render-plan.json');
if (!fs.existsSync(SOURCE)) fail('falta daily-briefing-latest.json');
const plan=readJson(PLAN), source=readJson(SOURCE);
if(!Array.isArray(plan.segments)||plan.segments.length<7) fail('render plan incompleto');

const accessToken=token();
if(!accessToken) fail('access token vacío');
const tmp=fs.mkdtempSync('/tmp/agci-chirp-');
const concat=[];
const durations=[];

for(const segment of plan.segments) {
  const inputPath=path.join(ROOT, segment.file);
  const text=fs.readFileSync(inputPath,'utf8').trim();
  if(!text) fail(`segmento ${segment.index} vacío`);
  const voice=String(segment.speaker).toUpperCase()==='ANALISTA' ? ANALYST_VOICE : CIO_VOICE;
  const response=await fetch(API,{
    method:'POST',
    headers:{'authorization':`Bearer ${accessToken}`,'content-type':'application/json'},
    body:JSON.stringify({
      input:{text},
      voice:{languageCode:LANGUAGE,name:voice},
      audioConfig:{audioEncoding:'MP3'}
    })
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok) fail(`Google TTS HTTP ${response.status}: ${payload?.error?.message||'respuesta inválida'}`);
  if(!payload.audioContent) fail(`Google TTS no devolvió audio para segmento ${segment.index}`);
  const file=path.join(tmp,`${String(segment.index).padStart(2,'0')}.mp3`);
  fs.writeFileSync(file,Buffer.from(payload.audioContent,'base64'));
  if(fs.statSync(file).size<1000) fail(`audio demasiado pequeño en segmento ${segment.index}`);
  concat.push(`file '${file.replaceAll("'","'\\''")}'`);
  durations.push(duration(file));
}

const list=path.join(tmp,'concat.txt');
fs.writeFileSync(list,concat.join('\n')+'\n');
const yyyy=source.date.slice(0,4), mm=source.date.slice(5,7);
const outDir=path.join(ROOT,'podcast','episodes',yyyy,mm);
fs.mkdirSync(outDir,{recursive:true});
const raw=path.join(tmp,'joined.mp3');
const output=path.join(outDir,`${source.date}.mp3`);
run('ffmpeg',['-y','-hide_banner','-loglevel','error','-f','concat','-safe','0','-i',list,'-c:a','libmp3lame','-b:a','112k',raw]);
run('ffmpeg',['-y','-hide_banner','-loglevel','error','-i',raw,'-af','highpass=f=65,lowpass=f=11000,loudnorm=I=-16:TP=-1.5:LRA=7','-ar','44100','-ac','1','-c:a','libmp3lame','-b:a','112k',output]);

const total=duration(output);
if(total>260) fail(`audio Chirp excede límite operativo: ${total.toFixed(1)}s`);
const result={
  schemaVersion:1,
  engine:'google-cloud-text-to-speech',
  model:'Chirp3-HD',
  locale:LANGUAGE,
  voices:{CIO:CIO_VOICE,ANALISTA:ANALYST_VOICE},
  date:source.date,
  audioUrl:`podcast/episodes/${yyyy}/${mm}/${source.date}.mp3`,
  durationSeconds:total,
  chapterDurations:durations,
  generatedAt:new Date().toISOString()
};
fs.writeFileSync(RESULT,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result));
