import currentWorker from './agci-market-data-current.js';
import { PEER_GROUPS } from './agci-equity-fundamentals.js';

const FRESH_TTL_SECONDS = 15 * 60;
const STALE_TTL_SECONDS = 6 * 60 * 60;
const PROVIDER_TIMEOUT_MS = 12_000;
const MAX_SYMBOLS = 10;
const MAX_PROVIDER_SYMBOLS = 8;
const ALLOWED_EQUITIES = new Set([...PEER_GROUPS.flatMap(group => group.tickers), 'AAPL']);

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS' && url.pathname === '/equity-quotes') return cors(new Response(null, { status: 204 }));
    if (request.method === 'GET' && url.pathname === '/equity-quotes') return handleEquityQuotes(request, env, ctx);
    if (!currentWorker?.fetch) return json({ error: 'AGCI Market Data base worker unavailable' }, 503);
    return currentWorker.fetch(request, env, ctx);
  },

  async scheduled(controller, env, ctx) {
    if (typeof currentWorker?.scheduled === 'function') return currentWorker.scheduled(controller, env, ctx);
  }
};

async function handleEquityQuotes(request, env, ctx) {
  const url = new URL(request.url);
  const requested = normalizeSymbols(url.searchParams.get('symbols'));
  if (!requested.length) return json({ error: 'Incluya al menos un ticker válido.' }, 400);

  const rejectedSymbols = requested.filter(symbol => !ALLOWED_EQUITIES.has(symbol));
  const symbols = requested.filter(symbol => ALLOWED_EQUITIES.has(symbol));
  if (!symbols.length) return json({ error: 'Los tickers solicitados están fuera del universo habilitado.', rejectedSymbols }, 400);

  const canonical = [...symbols].sort().join(',');
  const freshKey = new Request(`${url.origin}/_agci/equity-quotes/fresh?symbols=${encodeURIComponent(canonical)}`);
  const staleKey = new Request(`${url.origin}/_agci/equity-quotes/stale?symbols=${encodeURIComponent(canonical)}`);
  const cache = caches.default;
  const cached = await cache.match(freshKey);
  if (cached) return withCacheHeader(cached, 'FRESH');

  try {
    const payload = await fetchProviderQuotes(symbols, env);
    const response = json(payload, 200, 60, { 'X-AGCI-Cache': 'PROVIDER' });
    ctx.waitUntil(Promise.all([
      cache.put(freshKey, cacheClone(payload, FRESH_TTL_SECONDS)),
      cache.put(staleKey, cacheClone(payload, STALE_TTL_SECONDS))
    ]));
    return response;
  } catch (error) {
    const stale = await cache.match(staleKey);
    if (stale) {
      const payload = await stale.json();
      return json({ ...payload, isStale: true, warning: error instanceof Error ? error.message : 'Provider error' }, 200, 0, { 'X-AGCI-Cache': 'STALE' });
    }
    return json({
      error: 'No fue posible obtener cotizaciones de acciones',
      detail: error instanceof Error ? error.message : 'Error desconocido',
      requestedSymbols: requested
    }, 502);
  }
}

async function fetchProviderQuotes(symbols, env) {
  if (!env.TWELVE_DATA_API_KEY) throw new Error('TWELVE_DATA_API_KEY no está configurada en AGCI Market Data');
  const refreshSymbols = symbols.slice(0, MAX_PROVIDER_SYMBOLS);
  const apiUrl = new URL('https://api.twelvedata.com/quote');
  apiUrl.searchParams.set('symbol', refreshSymbols.join(','));
  apiUrl.searchParams.set('apikey', env.TWELVE_DATA_API_KEY);
  const response = await fetchWithTimeout(apiUrl.toString());
  if (response.status === 429) throw new Error('Límite de Twelve Data alcanzado');
  if (!response.ok) throw new Error(`Twelve Data respondió HTTP ${response.status}`);
  const data = await response.json();
  if (data?.status === 'error') throw new Error(data.message || 'Twelve Data devolvió un error');
  const records = refreshSymbols.length === 1 && !data[refreshSymbols[0]] ? { [refreshSymbols[0]]: data } : data;
  const updatedAt = new Date().toISOString();
  const quotes = [];
  const unresolvedSymbols = [];

  for (const symbol of symbols) {
    const item = records?.[symbol];
    const price = numberOrNull(item?.close);
    if (!item || item.status === 'error' || !Number.isFinite(price) || price <= 0) {
      unresolvedSymbols.push(symbol);
      continue;
    }
    quotes.push({
      ticker: symbol,
      price,
      percentChange: numberOrNull(item.percent_change),
      previousClose: numberOrNull(item.previous_close),
      datetime: item.datetime || null,
      updatedAt,
      isStale: false
    });
  }

  return {
    provider: 'Twelve Data via AGCI Market Data',
    requestedSymbols: symbols,
    rejectedSymbols: [],
    unresolvedSymbols,
    quoteLimitPerRefresh: MAX_PROVIDER_SYMBOLS,
    isStale: false,
    quotes,
    timestamp: updatedAt
  };
}

function normalizeSymbols(input) {
  return [...new Set(String(input || '')
    .split(/[\s,;]+/)
    .map(value => value.trim().toUpperCase())
    .filter(value => /^[A-Z][A-Z0-9.-]{0,9}$/.test(value)))]
    .slice(0, MAX_SYMBOLS);
}

async function fetchWithTimeout(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    return await fetch(url, { headers: { Accept: 'application/json' }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function cacheClone(payload, ttl) {
  return new Response(JSON.stringify(payload), {
    headers: { 'Content-Type': 'application/json; charset=UTF-8', 'Cache-Control': `public, max-age=${ttl}` }
  });
}

function withCacheHeader(response, value) {
  const headers = new Headers(response.headers);
  headers.set('X-AGCI-Cache', value);
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function json(body, status = 200, browserTtl = 0, extraHeaders = {}) {
  return cors(new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=UTF-8',
      'Cache-Control': browserTtl ? `public, max-age=${browserTtl}` : 'no-store',
      ...extraHeaders
    }
  }));
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
