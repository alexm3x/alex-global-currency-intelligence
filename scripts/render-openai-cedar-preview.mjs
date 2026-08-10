import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PLAN = path.join(ROOT, 'podcast', 'generated', 'render-plan.json');
const OUT = process.env.CEDAR_WAV_DIR || '/tmp/agci-cedar-preview';
const API_KEY = process.env.OPENAI_API_KEY || '';
const MODEL = process.env.OPENAI_TTS_MODEL || 'gpt-4o-mini-tts';
const VOICE = process.env.OPENAI_TTS_VOICE || 'cedar';
const ENDPOINT = 'https://api.openai.com/v1/audio/speech';

const STYLE = [
  'Habla en español mexicano neutro.',
  'Interpreta el texto como un Chief Investment Officer de banca privada internacional.',
  'La voz debe sonar madura, sofisticada, serena, segura y natural.',
  'Mantén autoridad intelectual sin dramatismo ni tono comercial.',
  'Usa ritmo moderado, pausas discretas y pronunciación clara de cifras, tickers y términos financieros.',
  'Evita voz de locutor, entusiasmo artificial, teatralidad y monotonía robótica.',
  'El resultado debe sentirse como un morning call privado para clientes patrimoniales sofisticados.'
].join(' ');

function fail(message) {
  console.error(`AGCI Cedar preview: ${message}`);
  process.exit(1);
}

if (!API_KEY) fail('OPENAI_API_KEY no configurada');
if (!fs.existsSync(PLAN)) fail('falta podcast/generated/render-plan.json');
const plan = JSON.parse(fs.readFileSync(PLAN, 'utf8'));
if (!Array.isArray(plan.segments) || plan.segments.length < 7) fail('render plan inválido');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });

async function requestSpeech(input, index, attempt = 1) {
  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      input,
      instructions: STYLE,
      response_format: 'wav',
      speed: 1.0
    })
  });

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 800);
    if (attempt < 2 && [408, 409, 429, 500, 502, 503, 504].includes(response.status)) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return requestSpeech(input, index, attempt + 1);
    }
    fail(`OpenAI TTS HTTP ${response.status}: ${detail}`);
  }

  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length < 1000) fail(`audio Cedar demasiado pequeño en segmento ${index}`);
  const file = path.join(OUT, `${String(index).padStart(2, '0')}.wav`);
  fs.writeFileSync(file, bytes);
  return { index, file, bytes: bytes.length };
}

const results = [];
for (const segment of plan.segments) {
  const sourceFile = path.join(ROOT, segment.file);
  if (!fs.existsSync(sourceFile)) fail(`falta ${segment.file}`);
  const input = fs.readFileSync(sourceFile, 'utf8').replace(/\s+/g, ' ').trim();
  if (!input) fail(`segmento vacío ${segment.index}`);
  if (input.length > 4096) fail(`segmento ${segment.index} excede 4096 caracteres`);
  console.log(`Cedar ${segment.index + 1}/${plan.segments.length}: ${segment.title}`);
  results.push(await requestSpeech(input, segment.index));
}

fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify({
  schemaVersion: 1,
  provider: 'OpenAI',
  model: MODEL,
  voice: VOICE,
  style: 'AGCI CIO Institucional',
  segments: results
}, null, 2) + '\n');

console.log(JSON.stringify({ ok: true, voice: VOICE, model: MODEL, segments: results.length }));
