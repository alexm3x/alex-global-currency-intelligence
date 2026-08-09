import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const SOURCE = path.join(ROOT, 'data', 'daily-briefing-latest.json');
const PODCAST = path.join(ROOT, 'podcast');
const latestPath = path.join(PODCAST, 'latest.json');
const archivePath = path.join(PODCAST, 'archive.json');
const generatedDir = path.join(PODCAST, 'generated');

function fail(message) {
  console.error(`AGCI Morning Intelligence: ${message}`);
  process.exit(1);
}
function readJson(file) { return JSON.parse(fs.readFileSync(file, 'utf8')); }
function writeJson(file, value) { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(value, null, 2) + '\n'); }
function words(text='') { return String(text).trim().split(/\s+/).filter(Boolean).length; }
function escapeXml(v='') { return String(v).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])); }
function displayDate(iso) {
  const [y,m,d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d)));
}

if (!fs.existsSync(SOURCE)) fail('falta data/daily-briefing-latest.json');
const source = readJson(SOURCE);
if (source.schemaVersion !== 2) fail('schemaVersion del briefing debe ser 2');
for (const key of ['date','timestamp','title','executiveSummary','audio']) if (!source[key]) fail(`falta ${key}`);
if (!Array.isArray(source.audio.chapters) || source.audio.chapters.length < 5) fail('audio.chapters debe tener al menos 5 capítulos');
if (!Array.isArray(source.sources) || source.sources.length < 1) fail('debe existir trazabilidad de fuentes');

const speechRateWpm = Number(process.env.SPEECH_RATE_WPM || 145);
let cursor = 0;
const chapters = source.audio.chapters.map((c, index) => {
  const text = String(c.text || '').trim();
  if (!c.id || !c.title || !text) fail(`capítulo ${index + 1} incompleto`);
  const chapter = { id:c.id, start:Math.round(cursor), title:c.title, text };
  cursor += (words(`${c.title}. ${text}`) / speechRateWpm) * 60 + 1.2;
  return chapter;
});
const estimatedDuration = Math.max(60, Math.round(cursor));
const audioDuration = Number(process.env.AUDIO_DURATION_SECONDS || 0);
const durationSeconds = audioDuration > 0 ? Math.round(audioDuration) : estimatedDuration;
const audioUrl = process.env.AUDIO_URL || null;
const episodeNumber = Number(source.episodeNumber || 0) || Math.max(1, Math.floor((new Date(`${source.date}T00:00:00Z`) - new Date('2026-08-08T00:00:00Z')) / 86400000));

const episode = {
  schemaVersion: 2,
  status: audioUrl ? 'published' : 'generated',
  date: source.date,
  timestamp: source.timestamp,
  timezone: source.timezone || 'America/Mexico_City',
  episodeNumber,
  title: source.title,
  subtitle: source.audio.subtitle || 'Mercados, inversión y oportunidades estratégicas en menos de 12 minutos.',
  durationSeconds,
  executiveSummary: source.executiveSummary,
  threeSignals: source.threeSignals || [],
  chapters,
  markets: source.markets || [],
  equities: source.equities || [],
  mexico: source.sections?.find(x => /México/i.test(x.title)) || null,
  realEstate: source.sections?.find(x => /bienes raíces/i.test(x.title)) || null,
  ai: source.sections?.find(x => /Inteligencia artificial/i.test(x.title)) || null,
  travel: source.travel || [],
  actions: source.actions || [],
  sources: source.sources || [],
  audioUrl,
  pdfUrl: source.pdfUrl || null,
  transcriptUrl: `podcast/episodes/${source.date.slice(0,4)}/${source.date.slice(5,7)}/${source.date}.txt`,
  archiveUrl: 'podcast/',
  sourceUrl: 'data/daily-briefing-latest.json',
  isStale: false,
  fallbackMode: audioUrl ? 'audio' : 'speechSynthesis'
};

fs.mkdirSync(generatedDir,{recursive:true});
const plainScript = chapters.map(c => `${c.title}.\n${c.text}`).join('\n\n');
fs.writeFileSync(path.join(generatedDir,'script.txt'), plainScript + '\n');
fs.writeFileSync(path.join(generatedDir,'transcript.md'), `# ${source.audio.title || 'AGCI Morning Intelligence'}\n\n**${displayDate(source.date)} · Ciudad de México**\n\n${chapters.map(c=>`## ${c.title}\n\n${c.text}`).join('\n\n')}\n`);

writeJson(latestPath, episode);
const yyyy = source.date.slice(0,4), mm = source.date.slice(5,7);
const episodeDir = path.join(PODCAST,'episodes',yyyy,mm);
fs.mkdirSync(episodeDir,{recursive:true});
writeJson(path.join(episodeDir,`${source.date}.json`), episode);
fs.writeFileSync(path.join(episodeDir,`${source.date}.txt`), plainScript + '\n');

let archive = { schemaVersion:2, updatedAt:source.timestamp, episodes:[] };
if (fs.existsSync(archivePath)) {
  try { archive = readJson(archivePath); } catch {}
}
archive.schemaVersion = 2;
archive.updatedAt = source.timestamp;
archive.episodes = Array.isArray(archive.episodes) ? archive.episodes.filter(e => e.date !== source.date) : [];
archive.episodes.unshift({
  date:source.date,
  title:source.title,
  durationSeconds,
  audioUrl,
  transcriptUrl:episode.transcriptUrl,
  pdfUrl:episode.pdfUrl,
  status:episode.status
});
archive.episodes = archive.episodes.slice(0,366);
writeJson(archivePath, archive);

const site='https://alexm3x.github.io/alex-global-currency-intelligence/';
const rssItems = archive.episodes.slice(0,50).map(e => {
  const audio = e.audioUrl ? `<enclosure url="${escapeXml(new URL(e.audioUrl,site).href)}" type="audio/mpeg"/>` : '';
  return `<item><title>${escapeXml(e.title)}</title><guid>${escapeXml(e.date)}</guid><pubDate>${new Date(`${e.date}T14:00:00Z`).toUTCString()}</pubDate><link>${site}podcast/</link><description>${escapeXml('AGCI Morning Intelligence — inteligencia ejecutiva diaria en español.')}</description>${audio}</item>`;
}).join('');
const rss = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>AGCI Morning Intelligence</title><link>${site}podcast/</link><description>Mercados, inversión y oportunidades estratégicas en español.</description><language>es-MX</language>${rssItems}</channel></rss>`;
fs.writeFileSync(path.join(PODCAST,'feed.xml'),rss+'\n');
console.log(JSON.stringify({date:source.date, chapters:chapters.length, durationSeconds, audioUrl, episodePath:`podcast/episodes/${yyyy}/${mm}/${source.date}.json`},null,2));
