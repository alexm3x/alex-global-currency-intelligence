import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'data', 'daily-briefing-latest.json');
const PODCAST = path.join(ROOT, 'podcast');
const GENERATED = path.join(PODCAST, 'generated');
const SEGMENTS = path.join(GENERATED, 'segments');
const latestPath = path.join(PODCAST, 'latest.json');
const archivePath = path.join(PODCAST, 'archive.json');

const fail = msg => { console.error(`AGCI Morning Intelligence 4min: ${msg}`); process.exit(1); };
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'));
const writeJson = (file, value) => { fs.mkdirSync(path.dirname(file), {recursive:true}); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); };
const clean = v => String(v || '').replace(/\s+/g, ' ').trim();
const words = v => clean(v).split(/\s+/).filter(Boolean).length;
const escapeXml = v => String(v || '').replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c]));

function trimToBudget(text, maxWords) {
  const input = clean(text);
  if (words(input) <= maxWords) return input;
  const sentences = input.split(/(?<=[.!?])\s+/).filter(Boolean);
  const kept = [];
  let count = 0;
  for (const sentence of sentences) {
    const w = words(sentence);
    if (kept.length && count + w > maxWords) break;
    kept.push(sentence);
    count += w;
    if (count >= maxWords) break;
  }
  if (kept.length) return kept.join(' ');
  return input.split(/\s+/).slice(0, maxWords).join(' ') + '.';
}

if (!fs.existsSync(SOURCE)) fail('falta data/daily-briefing-latest.json');
const source = readJson(SOURCE);
if (source.schemaVersion !== 2 || source.language !== 'es-MX') fail('briefing canónico inválido');
if (!Array.isArray(source.audio?.chapters) || source.audio.chapters.length < 7) fail('faltan capítulos canónicos');
if (!Array.isArray(source.sources) || !source.sources.length) fail('faltan fuentes');

const BUDGETS = {
  apertura: 55,
  senales: 60,
  mercados: 65,
  inversion: 70,
  mexico: 50,
  capital: 50,
  ia: 45,
  viajes: 45,
  acciones: 60
};

function category(chapter) {
  const k = `${chapter.id || ''} ${chapter.title || ''}`.toLowerCase();
  if (/apertura/.test(k)) return 'apertura';
  if (/señal|senal/.test(k)) return 'senales';
  if (/mercado/.test(k)) return 'mercados';
  if (/inversi|radar/.test(k)) return 'inversion';
  if (/méxico|mexico/.test(k)) return 'mexico';
  if (/(^|\s)ia(\s|$)|inteligencia artificial|ai capital/.test(k)) return 'ia';
  if (/capital|negocio|bienes/.test(k)) return 'capital';
  if (/viaje|travel/.test(k)) return 'viajes';
  if (/qué haría|que haria|acciones/.test(k)) return 'acciones';
  return 'general';
}

function speakerFor(chapter) {
  if (chapter.speaker) return clean(chapter.speaker).toUpperCase();
  return ['mercados','inversion','capital','ia','viajes'].includes(category(chapter)) ? 'ANALISTA' : 'CIO';
}

let compact = source.audio.chapters.map(ch => {
  const cat = category(ch);
  return {
    id: ch.id,
    title: clean(ch.title),
    text: trimToBudget(ch.text, BUDGETS[cat] || 45),
    speaker: speakerFor(ch),
    category: cat
  };
});

let totalWords = compact.reduce((n, c) => n + words(`${c.title} ${c.text}`), 0);
if (totalWords > 520) {
  compact = compact.map(c => ({...c, text: trimToBudget(c.text, Math.max(28, Math.floor((BUDGETS[c.category] || 45) * 0.86)))}));
  totalWords = compact.reduce((n, c) => n + words(`${c.title} ${c.text}`), 0);
}
if (totalWords < 330) fail(`guion demasiado corto: ${totalWords} palabras`);
if (totalWords > 520) fail(`guion supera límite de cuatro minutos: ${totalWords} palabras`);

let actualDurations = null;
if (process.env.CHAPTER_DURATIONS_JSON) {
  try { actualDurations = JSON.parse(process.env.CHAPTER_DURATIONS_JSON); } catch { fail('CHAPTER_DURATIONS_JSON inválido'); }
  if (!Array.isArray(actualDurations) || actualDurations.length !== compact.length || actualDurations.some(x => !(Number(x) > 0))) fail('duraciones incompletas');
}

const targetWpm = Number(process.env.SPEECH_RATE_WPM || 150);
let cursor = 0;
const chapters = compact.map((c, index) => {
  const item = {id:c.id, start:Math.round(cursor), title:c.title, text:c.text, speaker:c.speaker};
  cursor += actualDurations ? Number(actualDurations[index]) : (words(`${c.title}. ${c.text}`) / targetWpm) * 60 + 0.45;
  return item;
});
const estimatedDuration = Math.max(90, Math.round(cursor));
const audioDuration = Number(process.env.AUDIO_DURATION_SECONDS || 0);
const durationSeconds = audioDuration > 0 ? Math.round(audioDuration) : estimatedDuration;
if (durationSeconds > 240) fail(`duración excede 4:00: ${durationSeconds}s`);

const audioUrl = process.env.AUDIO_URL || null;
const episodeNumber = Number(source.episodeNumber || 0) || Math.max(1, Math.floor((new Date(`${source.date}T00:00:00Z`) - new Date('2026-08-08T00:00:00Z')) / 86400000));

fs.rmSync(SEGMENTS, {recursive:true, force:true});
fs.mkdirSync(SEGMENTS, {recursive:true});
const renderPlan = {
  schemaVersion: 3,
  date: source.date,
  totalWords,
  targetSeconds: 240,
  primaryPlayback: 'deviceSpeech',
  fallbackVoiceMode: 'dual-espeak',
  segments: compact.map((c, index) => {
    const file = `podcast/generated/segments/${String(index).padStart(2,'0')}.txt`;
    fs.writeFileSync(path.join(ROOT, file), `${c.title}. ${c.text}\n`);
    return {index, speaker:c.speaker, voice:c.speaker === 'ANALISTA' ? 'es+f3' : 'es+m3', file, title:c.title, category:c.category, words:words(`${c.title} ${c.text}`)};
  })
};
writeJson(path.join(GENERATED, 'render-plan.json'), renderPlan);

const episode = {
  schemaVersion: 3,
  status: audioUrl ? 'published' : 'generated',
  date: source.date,
  timestamp: source.timestamp,
  timezone: source.timezone || 'America/Mexico_City',
  episodeNumber,
  title: source.title,
  subtitle: 'Mercados, inversión y oportunidades estratégicas en menos de 4 minutos.',
  durationSeconds,
  executiveSummary: source.executiveSummary,
  stance: source.stance || null,
  risk: source.risk || null,
  threeSignals: source.threeSignals || [],
  chapters,
  markets: source.markets || [],
  equities: source.equities || [],
  travel: source.travel || [],
  actions: source.actions || [],
  sources: source.sources || [],
  primaryPlayback: 'deviceSpeech',
  preferredVoiceProfile: 'private-banking',
  voiceMode: 'natural-device',
  voices: [
    {role:'PRINCIPAL', engine:'SpeechSynthesis del dispositivo', locale:'es-MX', purpose:'experiencia principal'},
    {role:'FALLBACK CIO', engine:'eSpeak NG', variant:'es+m3'},
    {role:'FALLBACK ANALISTA', engine:'eSpeak NG', variant:'es+f3'}
  ],
  audioUrl,
  pdfUrl: source.pdfUrl || null,
  transcriptUrl: `podcast/episodes/${source.date.slice(0,4)}/${source.date.slice(5,7)}/${source.date}.txt`,
  archiveUrl: 'podcast/',
  sourceUrl: 'data/daily-briefing-latest.json',
  isStale: false,
  fallbackMode: audioUrl ? 'legacyMp3' : 'transcript'
};

fs.mkdirSync(GENERATED, {recursive:true});
const plainScript = chapters.map(c => `[${c.speaker}] ${c.title}.\n${c.text}`).join('\n\n');
fs.writeFileSync(path.join(GENERATED, 'script.txt'), plainScript + '\n');
fs.writeFileSync(path.join(GENERATED, 'transcript.md'), `# AGCI Morning Intelligence\n\n**${source.date} · Ciudad de México · versión ejecutiva ≤4 minutos**\n\n${chapters.map(c => `## ${c.title}\n\n**${c.speaker}:** ${c.text}`).join('\n\n')}\n`);
writeJson(latestPath, episode);

const yyyy = source.date.slice(0,4), mm = source.date.slice(5,7);
const episodeDir = path.join(PODCAST, 'episodes', yyyy, mm);
fs.mkdirSync(episodeDir, {recursive:true});
writeJson(path.join(episodeDir, `${source.date}.json`), episode);
fs.writeFileSync(path.join(episodeDir, `${source.date}.txt`), plainScript + '\n');

let archive = {schemaVersion:3, updatedAt:source.timestamp, episodes:[]};
if (fs.existsSync(archivePath)) { try { archive = readJson(archivePath); } catch {} }
archive.schemaVersion = 3;
archive.updatedAt = source.timestamp;
archive.episodes = Array.isArray(archive.episodes) ? archive.episodes.filter(e => e.date !== source.date) : [];
archive.episodes.unshift({date:source.date, title:source.title, durationSeconds, audioUrl, transcriptUrl:episode.transcriptUrl, pdfUrl:episode.pdfUrl, status:episode.status, voiceMode:'natural-device', primaryPlayback:'deviceSpeech'});
archive.episodes = archive.episodes.slice(0, 366);
writeJson(archivePath, archive);

const site = 'https://alexm3x.github.io/alex-global-currency-intelligence/';
const rssItems = archive.episodes.slice(0,50).map(e => {
  const enclosure = e.audioUrl ? `<enclosure url="${escapeXml(new URL(e.audioUrl, site).href)}" type="audio/mpeg"/>` : '';
  return `<item><title>${escapeXml(e.title)}</title><guid>${escapeXml(e.date)}</guid><pubDate>${new Date(`${e.date}T14:00:00Z`).toUTCString()}</pubDate><link>${site}podcast/</link><description>${escapeXml('AGCI Morning Intelligence — versión ejecutiva en menos de cuatro minutos.')}</description>${enclosure}</item>`;
}).join('');
fs.writeFileSync(path.join(PODCAST, 'feed.xml'), `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>AGCI Morning Intelligence</title><link>${site}podcast/</link><description>Mercados, inversión y oportunidades estratégicas en menos de cuatro minutos.</description><language>es-MX</language>${rssItems}</channel></rss>\n`);

console.log(JSON.stringify({date:source.date, totalWords, durationSeconds, chapters:chapters.length, primaryPlayback:'deviceSpeech'}));
