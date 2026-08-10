import marketWorker from './agci-market-data-live.js';
import { PEER_GROUPS } from './agci-equity-fundamentals.js';

const EQUITY_QUOTE_TTL_MS = 15 * 60 * 1000;
const EQUITY_QUOTE_MAX_REFRESH = 8;
const PROVIDER_TIMEOUT_MS = 12_000;
const EQUITY_CACHE_PREFIX = 'market-data:v3:equity-quote:';
const ALLOWED_EQUITIES = new Set([
  ...PEER_GROUPS.flatMap(group => group.tickers),
  'AAPL'
]);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/equity-quotes') {
      return handleEquityQuotes(url, env, ctx);
    }
    return marketWorker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    return marketWorker.scheduled(controller, env, ctx);
  }
};

async function handleEquityQuotes(url, env, ctx) {
  const requested = normalizeSymbols(url.searchParams.get('symbols'));
  if (!requested.length) return json({ error: 'Incluya al menos un ticker permitido.' }, 400);

  const rejected = requested.filter(symbol => !ALLOWED_EQUITIES.has(symbol));
  const symbols = requested.filter(symbol => ALLOWED_EQUITIES.has(symbol));
  if (!symbols.length) return json({ error: 'Los tickers solicitados están fuera del universo de acciones habilitado.', rejected }, 400);

  const quotes = {};
  const staleSymbols = [];
  const missing = [];

  for (const symbol of symbols) {
    const envelope = await readQuote(env, symbol);
    if (!envelope) {
      missing.push(symbol);
      continue;
    }
    quotes[symbol] = envelope.value;
    if (ageMs(envelope.updatedAt) > EQUITY_QUOTE_TTL_MS) staleSymbols.push(symbol);
  }

  const refreshCandidates = [...new Set([...missing, ...staleSymbols])].slice(0, EQUITY_QUOTE_MAX_REFRESH);
  if (refreshCandidates.length && env.TWELVE_DATA_API_KEY) {
    const refreshTask = refreshQuotes(refreshCandidates, env)
      .then(fresh => Object.assign(quotes, fresh))
      .catch(error => console.error(JSON.stringify({ level: 'error', event: 'equity-quotes-refresh-failed', error: error instanceof Error ? error.message : String(error), symbols: refreshCandidates })));
    if (missing.some(symbol => refreshCandidates.includes(symbol))) await refreshTask;
    else ctx.waitUntil(refreshTask);
  }

  const output = symbols
    .map(symbol => quotes[symbol])
    .filter(Boolean)
    .map(quote => ({ ...quote, isStale: ageMs(quote.updatedAt) > EQUITY_QUOTE_TTL_MS }));
  const unresolved = symbols.filter(symbol => !quotes[symbol]);
  const isStale = output.some(quote => quote.isStale) || unresolved.length > 0;

  return json({
    provider: 'Twelve Data via AGCI Market Data',
    requestedSymbols: requested,
    allowedSymbols: symbols,
    rejectedSymbols: rejected,
    unresolvedSymbols: unresolved,
    quoteLimitPerRefresh: EQUITY_QUOTE_MAX_REFRESH,
    isStale,
    quotes: output,
    timestamp: new Date().toISOString()
  }, 200, isStale ? 0 : 60, { 'X-AGCI-Cache': isStale ? 'STALE' : 'FRESH' });
}

function normalizeSymbols(input) {
  return [...new Set(String(input || '')
    .split(/[\s,;]+/)
    .map(value => value.trim().toUpperCase())
    .filter(value => /^[A-Z][A-Z0-9.-]{0,9}$/.test(value)))]
    .slice(0, 10);
}

async function refreshQuotes(symbols, env) {
  const apiUrl = new URL('https://api.twelvedata.com/quote');
  apiUrl.searchParams.set('symbol', symbols.join(','));
  apiUrl.searchParams.set('apikey', env.TWELVE_DATA_API_KEY);
  const response = await fetchWithTimeout(apiUrl.toString(), PROVIDER_TIMEOUT_MS);
  if (response.status === 429) throw new Error('Límite de Twelve Data alcanzado');
  if (!response.ok) throw new Error(`Twelve Data respondió HTTP ${response.status}`);
  const data = await response.json();
  if (data?.status === 'error') throw new Error(data.message || 'Twelve Data devolvió un error');
  const records = symbols.length === 1 && !data[symbols[0]] ? { [symbols[0]]: data } : data;
  const result = {};

  for (const symbol of symbols) {
    const item = records?.[symbol];
    const price = numberOrNull(item?.close);
    if (!item || item.status === 'error' || !Number.isFinite(price) || price <= 0) continue;
    const value = {
      ticker: symbol,
      price,
      percentChange: numberOrNull(item.percent_change),
      previousClose: numberOrNull(item.previous_close),
      datetime: item.datetime || null,
      updatedAt: new Date().toISOString()
    };
    result[symbol] = value;
    await writeQuote(env, symbol, value);
  }
  return result;
}

async function readQuote(env, symbol) {
  if (!env.MARKET_DATA_CACHE) return null;
  try {
    const value = await env.MARKET_DATA_CACHE.get(`${EQUITY_CACHE_PREFIX}${symbol}`, 'json');
    return value && value.value && Number.isFinite(Date.parse(value.updatedAt || '')) ? value : null;
  } catch {
    return null;
  }
}

async function writeQuote(env, symbol, value) {
  if (!env.MARKET_DATA_CACHE) return;
  const updatedAt = value.updatedAt || new Date().toISOString();
  await env.MARKET_DATA_CACHE.put(`${EQUITY_CACHE_PREFIX}${symbol}`, JSON.stringify({ updatedAt, value }), {
    metadata: { type: 'equity-quote', ticker: symbol, updatedAt }
  });
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function ageMs(value) {
  const timestamp = Date.parse(value || '');
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : Infinity;
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Origin'
  };
}

function json(body, status = 200, browserTtl = 0, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': browserTtl ? `public, max-age=${browserTtl}` : 'no-store',
      ...corsHeaders(),
      ...extraHeaders
    }
  });
}
