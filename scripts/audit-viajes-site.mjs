import { readFile, access } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const viajes = path.join(root, 'viajes');
const errors = [];
const warnings = [];
const page = await readFile(path.join(viajes, 'index.html'), 'utf8');
const assistant = await readFile(path.join(viajes, 'travel-assistant.js'), 'utf8');
const worker = await readFile(path.join(root, 'cloudflare', 'viajes-assistant-worker.js'), 'utf8');
const config = await readFile(path.join(root, 'wrangler.viajes-assistant.jsonc'), 'utf8');

function requireMatch(source, regex, label) { if (!regex.test(source)) errors.push(`Missing: ${label}`); }

const ids = [...page.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]);
const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
if (duplicateIds.length) errors.push(`Duplicate HTML ids: ${[...new Set(duplicateIds)].join(', ')}`);

for (const required of ['travelAssistant','travelAssistantDialog','smartStaysPanel','opportunityImportPanel','queryForm','recommendations','matrixBody']) {
  if (!ids.includes(required)) errors.push(`Required UI id not found: ${required}`);
}

const localAssets = [];
for (const match of page.matchAll(/<(?:script|link)[^>]+(?:src|href)="([^"]+)"/g)) {
  const ref = match[1];
  if (/^(?:https?:|data:|#)/.test(ref)) continue;
  localAssets.push(ref.split('?')[0]);
}
for (const ref of localAssets) {
  try { await access(path.join(viajes, ref)); } catch { errors.push(`Broken local asset reference: ${ref}`); }
}

for (const match of page.matchAll(/<a\b[^>]*target="_blank"[^>]*>/g)) {
  if (!/\brel="[^"]*noopener/.test(match[0])) warnings.push(`External target lacks noopener: ${match[0].slice(0, 120)}`);
}

requireMatch(page, /Modo demostración:/, 'synthetic stays disclosure');
requireMatch(assistant, /known_dates/, 'Mode A known dates');
requireMatch(assistant, /inverse_dates/, 'Mode B inverse dates');
requireMatch(assistant, /Presupuesto máximo opcional/, 'optional budget UX');
requireMatch(assistant, /travel-intelligence-core\.js/, 'Phase 3/4 core loader');
requireMatch(assistant, /travel-intelligence\.js/, 'Phase 3/4 UI loader');
requireMatch(worker, /type:\s*'web_search'/, 'OpenAI web search research tool');
requireMatch(worker, /research_trip/, 'research_trip backend action');
requireMatch(worker, /event_premium_pct/, 'Event Premium research field');
requireMatch(config, /alexsaldana\.com/, 'production custom-domain CORS origin');
requireMatch(config, /alexm3x\.github\.io/, 'GitHub Pages CORS origin');

for (const file of ['travel-intelligence-core.js','travel-intelligence.js']) {
  try { await access(path.join(viajes, file)); } catch { errors.push(`Missing Phase 3/4 module: ${file}`); }
}

const secretPatterns = [/sk-[A-Za-z0-9_-]{20,}/, /OPENAI_API_KEY\s*[:=]\s*["'][^"']+["']/];
for (const [name, source] of [['index.html', page], ['travel-assistant.js', assistant], ['viajes-assistant-worker.js', worker], ['wrangler.viajes-assistant.jsonc', config]]) {
  if (secretPatterns.some(pattern => pattern.test(source))) errors.push(`Potential embedded secret in ${name}`);
}

console.log(`Viajes ASC audit: ${ids.length} ids, ${localAssets.length} local assets, ${warnings.length} warning(s), ${errors.length} error(s).`);
warnings.slice(0, 10).forEach(value => console.warn(`WARN ${value}`));
if (errors.length) {
  errors.forEach(value => console.error(`ERROR ${value}`));
  process.exit(1);
}
