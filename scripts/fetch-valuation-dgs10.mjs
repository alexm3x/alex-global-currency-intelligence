import { writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = resolve(ROOT, 'data/valuation-dgs10-input.json');
const URL = 'https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10';
const USER_AGENT = 'AGCI Valuation DGS10 bridge/1.0 (+https://alexm3x.github.io/alex-global-currency-intelligence/)';

async function fetchWithRetry(url, { attempts = 4, timeoutMs = 30000 } = {}) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        headers: { accept: 'text/csv,*/*', 'user-agent': USER_AGENT },
        signal: controller.signal
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < attempts) await new Promise(resolve => setTimeout(resolve, attempt * 1200));
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error(`DGS10 provider unavailable: ${lastError?.message || lastError}`);
}

function parseFredCsv(text) {
  const lines = String(text || '').trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) throw new Error('DGS10 CSV is empty');
  const header = lines[0].split(',').map(x => x.trim());
  const dateIndex = header.findIndex(x => /date|observation_date/i.test(x));
  const valueIndex = header.findIndex((x, i) => i !== dateIndex && !/^realtime_/i.test(x));
  if (dateIndex < 0 || valueIndex < 0) throw new Error('DGS10 CSV contract changed');
  return lines.slice(1).map(line => {
    const cells = line.split(',');
    const value = Number(cells[valueIndex]);
    return { date: cells[dateIndex], value: Number.isFinite(value) ? value : null };
  }).filter(row => row.date && Number.isFinite(row.value));
}

function monthlyAverage(rows) {
  const buckets = new Map();
  for (const row of rows) {
    const ym = String(row.date).slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(ym)) continue;
    const bucket = buckets.get(ym) || { sum: 0, count: 0 };
    bucket.sum += row.value;
    bucket.count += 1;
    buckets.set(ym, bucket);
  }
  return [...buckets.entries()].map(([ym, bucket]) => ({
    ym,
    value: Number((bucket.sum / bucket.count).toFixed(6))
  }));
}

const text = await fetchWithRetry(URL);
const rows = parseFredCsv(text);
if (rows.length < 500) throw new Error(`DGS10 history insufficient: ${rows.length}`);
const monthly = monthlyAverage(rows);
if (monthly.length < 120) throw new Error(`DGS10 monthly history insufficient: ${monthly.length}`);
const latest = rows.at(-1);
const payload = {
  schema_version: 1,
  provider: 'Federal Reserve / FRED',
  series: 'DGS10',
  source_url: URL,
  fetched_at: new Date().toISOString(),
  latest,
  monthly
};
await writeFile(OUT, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ status: 'connected', latest, monthly_observations: monthly.length }, null, 2));
