import fs from 'node:fs';
import path from 'node:path';

const ROOT=process.cwd();
const resultPath=path.join(ROOT,'podcast','generated','chirp-result.json');
const latestPath=path.join(ROOT,'podcast','latest.json');
const archivePath=path.join(ROOT,'podcast','archive.json');

function read(file){return JSON.parse(fs.readFileSync(file,'utf8'));}
function write(file,value){fs.writeFileSync(file,JSON.stringify(value,null,2)+'\n');}
function fail(msg){console.error(`AGCI Chirp metadata: ${msg}`);process.exit(1);}

if(!fs.existsSync(resultPath)) fail('falta chirp-result.json');
if(!fs.existsSync(latestPath)) fail('falta podcast/latest.json');
const result=read(resultPath), latest=read(latestPath);
if(result.date!==latest.date) fail('fecha Chirp no coincide con latest.json');

latest.status='published';
latest.audioUrl=result.audioUrl;
latest.durationSeconds=Math.round(result.durationSeconds);
latest.primaryPlayback='publishedAudio';
latest.preferredVoiceProfile='private-banking';
latest.voiceMode='google-chirp3-hd';
latest.voices=[
  {role:'CIO',engine:'Google Cloud Text-to-Speech',model:'Chirp3-HD',name:result.voices.CIO,locale:result.locale,purpose:'voz principal'},
  {role:'ANALISTA',engine:'Google Cloud Text-to-Speech',model:'Chirp3-HD',name:result.voices.ANALISTA,locale:result.locale,purpose:'voz secundaria'}
];
latest.fallbackMode='deviceSpeech';
latest.audioEngine={provider:'Google Cloud Text-to-Speech',model:'Chirp 3 HD',locale:result.locale,generatedAt:result.generatedAt};
write(latestPath,latest);

const episodePath=path.join(ROOT,'podcast','episodes',latest.date.slice(0,4),latest.date.slice(5,7),`${latest.date}.json`);
if(fs.existsSync(episodePath)) write(episodePath,latest);

if(fs.existsSync(archivePath)){
  const archive=read(archivePath);
  archive.episodes=(archive.episodes||[]).map(e=>e.date===latest.date?{...e,audioUrl:result.audioUrl,durationSeconds:Math.round(result.durationSeconds),status:'published',voiceMode:'google-chirp3-hd',primaryPlayback:'publishedAudio'}:e);
  write(archivePath,archive);
}

console.log(JSON.stringify({date:latest.date,audioUrl:latest.audioUrl,voiceMode:latest.voiceMode,primaryPlayback:latest.primaryPlayback}));
