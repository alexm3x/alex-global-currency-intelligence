import fs from 'node:fs';
import path from 'node:path';

const [, , inputPath, outputPath] = process.argv;
if (!inputPath || !outputPath) {
  console.error('Usage: node scripts/extract-cloudflare-worker-content.mjs <multipart-file> <output-js>');
  process.exit(2);
}

const raw = fs.readFileSync(inputPath);
if (!raw.length) throw new Error('Cloudflare content package is empty');
const text = raw.toString('utf8');
const firstBreak = text.search(/\r?\n/);
if (firstBreak < 0) throw new Error('Cloudflare content package has no multipart boundary');
const boundary = text.slice(0, firstBreak).trim();
if (!boundary.startsWith('--') || boundary.length < 8) throw new Error('Invalid multipart boundary');

const candidates = [];
for (const rawPart of text.split(boundary).slice(1)) {
  let part = rawPart.replace(/^\r?\n/, '');
  if (!part || part === '--' || part.startsWith('--\r') || part.startsWith('--\n')) continue;
  part = part.replace(/\r?\n--\s*$/, '');
  let separator = part.indexOf('\r\n\r\n');
  let separatorLength = 4;
  if (separator < 0) {
    separator = part.indexOf('\n\n');
    separatorLength = 2;
  }
  if (separator < 0) continue;

  const headers = part.slice(0, separator);
  let body = part.slice(separator + separatorLength).replace(/\r?\n$/, '');
  const filename = headers.match(/filename="([^"]+)"/i)?.[1] || null;
  const fieldName = headers.match(/name="([^"]+)"/i)?.[1] || null;
  const contentType = headers.match(/Content-Type:\s*([^\r\n]+)/i)?.[1]?.trim() || '';
  if (!filename && !/javascript|ecmascript/i.test(contentType)) continue;
  if (!body.trim()) continue;
  candidates.push({ filename, fieldName, contentType, body });
}

if (!candidates.length) throw new Error('No JavaScript module found in Cloudflare content package');
const preferred = candidates.find(item => item.filename === 'worker.js')
  || candidates.find(item => /\.m?js$/i.test(item.filename || ''))
  || candidates[0];

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, preferred.body);
console.log(JSON.stringify({
  extracted: outputPath,
  selectedFile: preferred.filename || preferred.fieldName || 'unnamed',
  javascriptParts: candidates.map(item => item.filename || item.fieldName || 'unnamed'),
  bytes: Buffer.byteLength(preferred.body)
}));
