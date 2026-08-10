import fs from 'node:fs';

function assert(ok, msg) {
  if (!ok) {
    console.error(`VOICE STUDIO QA: ${msg}`);
    process.exit(1);
  }
}

const router = fs.readFileSync('voice-router.js', 'utf8');
const studio = fs.readFileSync('voice-studio.js', 'utf8');
const index = fs.readFileSync('index.html', 'utf8');
const sw = fs.readFileSync('sw.js', 'utf8');
const generator = fs.readFileSync('scripts/generate-morning-intelligence-4min.mjs', 'utf8');
const dict = JSON.parse(fs.readFileSync('pronunciation-dictionary.json', 'utf8'));

for (const id of ['cio-institucional','private-banking','markets-desk','executive-brief','cio-analista']) assert(router.includes(`'${id}'`), `falta perfil ${id}`);
for (const v of ['0.9','1.1','1.25','1.5','1.75','2']) assert(router.includes(v), `falta velocidad ${v}`);
// Duration modes belong to voice-router.js. voice-studio.js now decorates the published-audio status only.
for (const id of ['completo','ejecutivo','express','mercados','inversiones','mexico-negocios','ia-tecnologia','viajes']) assert(router.includes(id), `falta modo ${id}`);

assert(dict.schemaVersion === 1 && dict.language === 'es-MX', 'diccionario debe ser schemaVersion 1 es-MX');
assert(Array.isArray(dict.terms) && dict.terms.length >= 15, 'diccionario insuficiente');
for (const token of ['GOOGL','NVDA','JPM','S&P 500','DXY','T-MEC','USMCA','Treasury','EBITDA','capex']) assert(dict.terms.some(x => x.match === token), `falta pronunciación ${token}`);

assert(index.includes('voice-router.js'), 'index no carga voice-router.js');
assert(index.includes('voice-studio.js'), 'index no carga voice-studio.js');
assert(sw.includes('agci-v4-natural-20260809'), 'service worker no invalida caché anterior');
assert(sw.includes('./voice-router.js') && sw.includes('./voice-studio.js') && sw.includes('./pronunciation-dictionary.json'), 'service worker no cachea Voice Studio');
assert(router.includes('SpeechSynthesisUtterance'), 'falta TTS natural del dispositivo');
assert(router.includes("'private-banking'"), 'falta perfil Private Banking');
assert(router.includes('DURATION_PRESETS'), 'falta configuración de duraciones');
assert(studio.includes('GOOGLE CHIRP 3 HD') && studio.includes('FALLBACK LOCAL'), 'falta estado de audio publicado/fallback');
assert(generator.includes("primaryPlayback: 'deviceSpeech'"), 'generador no marca voz natural como principal');
assert(generator.includes('totalWords > 520'), 'falta límite editorial de palabras');
assert(generator.includes('durationSeconds > 240'), 'falta límite absoluto de 4 minutos');

console.log('VOICE STUDIO NATURAL-FIRST QA OK');
