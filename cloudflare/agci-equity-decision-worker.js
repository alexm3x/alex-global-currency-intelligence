import {
  buildCompanySnapshot,
  normalizeSymbols,
  peerCandidates,
  scoreAnalysis
} from './agci-equity-fundamentals.js';

const CONTRACT_VERSION = '1.0.0';
const SEC_TICKERS_URL = 'https://www.sec.gov/files/company_tickers.json';
const SEC_FACTS_BASE = 'https://data.sec.gov/api/xbrl/companyfacts';
const MARKET_DATA_URL = 'https://agci-market-data.proadmexico.workers.dev';
const YAHOO_CHART_BASE = 'https://query1.finance.yahoo.com/v8/finance/chart';
const SEC_CACHE_MS = 6 * 60 * 60 * 1000;
const TICKER_CACHE_MS = 24 * 60 * 60 * 1000;
const MAX_SELECTED = 10;
const MAX_COMPANIES = 30;
const MARKET_REQUEST_LIMIT = 10;
const FETCH_TIMEOUT_MS = 12_000;

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === 'OPTIONS') return cors(new Response(null, { status: 204 }));
    if (request.method !== 'GET') return json({ error: 'Método no permitido' }, 405);

    try {
      if (url.pathname === '/' || url.pathname === '/health') {
        const marketHealth = await marketGatewayHealth(env).catch(() => ({ ready: false }));
        return json({
          service: 'agci-equity-fundamentals',
          status: 'ok',
          contractVersion: CONTRACT_VERSION,
          coverage: 'US SEC filers',
          priceProvider: 'AGCI Market Data with Yahoo Finance fallback',
          marketGatewayReady: Boolean(marketHealth.ready),
          fallbackProvider: 'Yahoo Finance chart',
          cache: Boolean(env.EQUITY_CACHE),
          timestamp: new Date().toISOString()
        });
      }

      if (url.pathname === '/symbols') {
        const query = String(url.searchParams.get('q') || '').trim().toUpperCase().slice(0, 80);
        if (!query) return json({ query, results: [] });
        const tickers = await loadTickerMap(env, ctx);
        const results = Object.entries(tickers.value)
          .filter(([ticker, item]) => ticker.includes(query) || item.title.toUpperCase().includes(query))
          .slice(0, 12)
          .map(([ticker, item]) => ({ ticker, companyName: item.title, exchange: item.exchange || null, cik: item.cik }));
        return json({ query, results, isStale: tickers.isStale, updatedAt: tickers.updatedAt });
      }

      if (url.pathname === '/compare') {
        const symbols = normalizeSymbols(url.searchParams.get('symbols'), MAX_SELECTED);
        if (!symbols.length) return json({ error: 'Incluya entre 1 y 10 símbolos estadounidenses válidos.' }, 400);
        const payload = await buildComparison(symbols, env, ctx);
        return json(payload, 200, payload.isStale ? 0 : 300, { 'X-AGCI-Cache': payload.isStale ? 'STALE' : 'FRESH' });
      }

      return json({ error: 'Ruta no encontrada' }, 404);
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', event: 'equity-decision-request-failed', error: error instanceof Error ? error.message : String(error), path: url.pathname }));
      return json({
        error: 'No fue posible completar el análisis fundamental',
        detail: error instanceof Error ? error.message : 'Error desconocido',
        contractVersion: CONTRACT_VERSION
      }, 502);
    }
  }
};

async function buildComparison(selected, env, ctx) {
  const tickerMapResult = await loadTickerMap(env, ctx);
  const knownSelected = selected.filter(symbol => tickerMapResult.value[symbol]);
  const invalidSymbols = selected.filter(symbol => !tickerMapResult.value[symbol]);
  if (!knownSelected.length) throw new Error('Ninguno de los símbolos está registrado por la SEC');

  const peerMap = Object.fromEntries(knownSelected.map(symbol => [symbol, peerCandidates(symbol, knownSelected)]));
  const peerSymbols = knownSelected.flatMap(symbol => peerMap[symbol]);
  const requestedCompanies = [...new Set([...knownSelected, ...peerSymbols])].slice(0, MAX_COMPANIES);

  const loaded = await mapLimit(requestedCompanies, 3, async symbol => {
    const identity = tickerMapResult.value[symbol];
    if (!identity) return { symbol, error: 'Símbolo no registrado por la SEC' };
    try {
      const result = await loadCompanySnapshot(symbol, identity, env, ctx);
      return { symbol, ...result };
    } catch (error) {
      return { symbol, error: error instanceof Error ? error.message : 'Error SEC' };
    }
  });

  const quoteSymbols = [...new Set([...knownSelected, ...peerSymbols])].slice(0, MARKET_REQUEST_LIMIT);
  const quoteResult = await loadMarketQuotes(quoteSymbols, env).catch(error => ({
    quotes: {},
    isStale: true,
    unresolvedSymbols: quoteSymbols,
    providers: [],
    error: error instanceof Error ? error.message : 'Quote provider error'
  }));

  const companies = {};
  const errors = [];
  for (const item of loaded) {
    if (item.error || !item.value) {
      errors.push({ ticker: item.symbol, error: item.error || 'Información no disponible' });
      continue;
    }
    const quote = quoteResult.quotes[item.symbol] || null;
    companies[item.symbol] = finalizeCompany(item.value, quote, {
      isStale: item.isStale || Boolean(quote?.isStale),
      updatedAt: item.updatedAt,
      priceUpdatedAt: quote?.updatedAt || null
    });
  }

  const analyses = knownSelected.map(symbol => {
    const company = companies[symbol];
    if (!company) return { ticker: symbol, classification: 'Información insuficiente', error: 'Fundamentales no disponibles' };
    const peers = peerMap[symbol].map(ticker => companies[ticker]).filter(Boolean);
    return scoreAnalysis(company, peers);
  });

  const staleCompanies = Object.values(companies).filter(company => company.isStale).map(company => company.ticker);
  const priceMissing = knownSelected.filter(symbol => !companies[symbol]?.price);
  const isStale = tickerMapResult.isStale || quoteResult.isStale || staleCompanies.length > 0 || priceMissing.length > 0;
  const successfulDates = Object.values(companies).map(company => company.lastSuccessfulUpdate).filter(Boolean).sort();
  const coverage = analyses.length ? analyses.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / analyses.length : 0;

  if (quoteResult.error) errors.push({ ticker: 'MARKET', error: quoteResult.error });
  for (const ticker of priceMissing) errors.push({ ticker, error: 'Precio no disponible en el ciclo actual; no se calcula terreno de compra.' });

  return {
    contractVersion: CONTRACT_VERSION,
    requestedSymbols: selected,
    analyzedSymbols: analyses.filter(item => !item.error).map(item => item.ticker),
    invalidSymbols,
    generatedAt: new Date().toISOString(),
    lastSuccessfulUpdate: successfulDates.at(-1) || null,
    isStale,
    staleSymbols: [...new Set([...staleCompanies, ...priceMissing])],
    dataQuality: coverage >= 75 && !errors.length ? 'complete' : coverage >= 40 ? 'partial' : 'limited',
    methodology: {
      statementPeriod: 'Latest available annual 10-K; no forward estimates',
      scoreWeights: { valuation: 30, growth: 20, quality: 20, financialStrength: 20, momentum: 10 },
      peerUniverse: 'Curated US industry groups; editable and non-exhaustive',
      priceCapacity: 'Up to 10 selected/peer quotes per comparison cycle; AGCI Market Data preferred, Yahoo Finance fallback'
    },
    sources: [
      { provider: 'SEC EDGAR', dataset: 'Company Facts API', url: 'https://data.sec.gov/api/xbrl/companyfacts/', frequency: 'filing-driven' },
      { provider: 'AGCI Market Data', upstream: 'Twelve Data when compatible route is available', dataset: 'Equity Quote Gateway', url: `${marketBase(env)}/equity-quotes`, role: 'preferred' },
      { provider: 'Yahoo Finance', dataset: 'Chart API regular market price', url: YAHOO_CHART_BASE, role: 'fallback' }
    ],
    quoteProvidersUsed: quoteResult.providers || [],
    analyses,
    errors
  };
}

async function loadTickerMap(env, ctx) {
  return swr(env, ctx, 'sec:tickers:decision:v1', TICKER_CACHE_MS, async () => {
    const response = await fetchWithTimeout(SEC_TICKERS_URL, secHeaders(env));
    if (!response.ok) throw new Error(`SEC ticker map HTTP ${response.status}`);
    const raw = await response.json();
    const map = {};
    for (const item of Object.values(raw || {})) {
      const ticker = String(item?.ticker || '').toUpperCase();
      if (!ticker) continue;
      map[ticker] = {
        cik: String(item.cik_str).padStart(10, '0'),
        title: String(item.title || ticker),
        exchange: item.exchange || null
      };
    }
    if (!Object.keys(map).length) throw new Error('SEC ticker map vacío');
    return map;
  });
}

async function loadCompanySnapshot(symbol, identity, env, ctx) {
  return swr(env, ctx, `sec:company:decision:${identity.cik}:v1`, SEC_CACHE_MS, async () => {
    const response = await fetchWithTimeout(`${SEC_FACTS_BASE}/CIK${identity.cik}.json`, secHeaders(env));
    if (!response.ok) throw new Error(`SEC company facts HTTP ${response.status}`);
    const facts = await response.json();
    return buildCompanySnapshot(symbol, identity, facts);
  });
}

async function loadMarketQuotes(symbols, env) {
  if (!symbols.length) return { quotes: {}, isStale: false, unresolvedSymbols: [], providers: [] };

  const quotes = {};
  const providers = [];
  let preferredError = null;
  try {
    const preferred = await loadAgciQuotes(symbols, env);
    Object.assign(quotes, preferred.quotes);
    if (Object.keys(preferred.quotes).length) providers.push('Twelve Data via AGCI Market Data');
  } catch (error) {
    preferredError = error instanceof Error ? error.message : 'AGCI Market Data no disponible';
  }

  const missing = symbols.filter(symbol => !quotes[symbol]);
  if (missing.length) {
    const fallback = await loadYahooQuotes(missing);
    Object.assign(quotes, fallback.quotes);
    if (Object.keys(fallback.quotes).length) providers.push('Yahoo Finance');
  }

  const unresolvedSymbols = symbols.filter(symbol => !quotes[symbol]);
  const isStale = Object.values(quotes).some(quote => quote.isStale) || unresolvedSymbols.length > 0;
  const error = unresolvedSymbols.length
    ? [preferredError, `${unresolvedSymbols.length} cotización(es) sin resolver`].filter(Boolean).join(' · ')
    : null;

  return { quotes, isStale, unresolvedSymbols, providers, error };
}

async function loadAgciQuotes(symbols, env) {
  const url = new URL(`${marketBase(env)}/equity-quotes`);
  url.searchParams.set('symbols', symbols.join(','));
  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`AGCI Market Data HTTP ${response.status}`);
  const payload = await response.json();
  const quotes = Object.fromEntries((payload.quotes || []).filter(item => finite(item?.price)).map(item => [item.ticker, { ...item, provider: 'Twelve Data via AGCI Market Data' }]));
  return { quotes };
}

async function loadYahooQuotes(symbols) {
  const loaded = await mapLimit(symbols, 4, async symbol => {
    try {
      const url = `${YAHOO_CHART_BASE}/${encodeURIComponent(symbol)}?interval=1d&range=5d&includePrePost=false&events=div%2Csplits`;
      const response = await fetchWithTimeout(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'Mozilla/5.0 AGCI/1.0'
        }
      });
      if (!response.ok) return { symbol, quote: null };
      const payload = await response.json();
      const result = payload?.chart?.result?.[0];
      const meta = result?.meta || {};
      const closes = result?.indicators?.quote?.[0]?.close || [];
      const price = finite(meta.regularMarketPrice) ? Number(meta.regularMarketPrice) : [...closes].reverse().find(finite);
      if (!finite(price) || Number(price) <= 0) return { symbol, quote: null };
      const previousClose = finite(meta.chartPreviousClose) ? Number(meta.chartPreviousClose) : finite(meta.previousClose) ? Number(meta.previousClose) : null;
      const percentChange = finite(previousClose) && Number(previousClose) > 0 ? (Number(price) / Number(previousClose) - 1) * 100 : null;
      const marketTime = finite(meta.regularMarketTime) ? new Date(Number(meta.regularMarketTime) * 1000).toISOString() : new Date().toISOString();
      return {
        symbol,
        quote: {
          ticker: symbol,
          price: Number(price),
          previousClose,
          percentChange,
          datetime: marketTime,
          updatedAt: marketTime,
          isStale: false,
          provider: 'Yahoo Finance'
        }
      };
    } catch {
      return { symbol, quote: null };
    }
  });
  return {
    quotes: Object.fromEntries(loaded.filter(item => item.quote).map(item => [item.symbol, item.quote]))
  };
}

async function marketGatewayHealth(env) {
  const url = new URL(`${marketBase(env)}/equity-quotes`);
  url.searchParams.set('symbols', 'MSFT');
  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) return { ready: false };
  const payload = await response.json();
  return { ready: Array.isArray(payload?.quotes) && payload.quotes.some(item => finite(item?.price)) };
}

function marketBase(env) {
  return String(env.MARKET_DATA_URL || MARKET_DATA_URL).replace(/\/$/, '');
}

function finalizeCompany(snapshot, quote, freshness) {
  const raw = snapshot.raw || {};
  const latest = key => raw[key]?.[0]?.val ?? null;
  const prior = key => raw[key]?.[1]?.val ?? null;
  const revenue = latest('revenue');
  const netIncome = latest('netIncome');
  const operatingIncome = latest('operatingIncome');
  const grossProfit = latest('grossProfit');
  const ocf = latest('operatingCashFlow');
  const capex = latest('capex');
  const depreciation = latest('depreciation');
  const assets = latest('assets');
  const equity = latest('equity');
  const cash = latest('cash');
  const debt = sumNullable(latest('debtCurrent'), latest('debtNoncurrent'));
  const shares = latest('shares');
  const eps = latest('eps');
  const ebitda = sumNullable(operatingIncome, depreciation);
  const freeCashFlow = finite(ocf) && finite(capex) ? ocf - Math.abs(capex) : null;
  const price = quote?.price ?? null;
  const marketCap = finite(price) && finite(shares) ? price * shares : null;
  const enterpriseValue = finite(marketCap) ? marketCap + (debt || 0) - (cash || 0) : null;
  const averageEquity = averageNullable(equity, prior('equity'));
  const averageAssets = averageNullable(assets, prior('assets'));
  const taxRate = clamp(safeDivide(latest('incomeTax'), latest('pretaxIncome')), 0, 0.35);
  const investedCapital = finite(equity) ? equity + (debt || 0) - (cash || 0) : null;
  const nopat = finite(operatingIncome) ? operatingIncome * (1 - (taxRate ?? 0.21)) : null;
  const dividend = latest('dividends');

  const ratios = {
    peTTM: positiveDivide(price, eps),
    peForward: null,
    peg: null,
    priceToSales: positiveDivide(marketCap, revenue),
    priceToBook: positiveDivide(marketCap, equity),
    evRevenue: positiveDivide(enterpriseValue, revenue),
    evEbitda: positiveDivide(enterpriseValue, ebitda),
    priceToFCF: positiveDivide(marketCap, freeCashFlow),
    fcfYield: positiveDivide(freeCashFlow, marketCap),
    earningsYield: positiveDivide(netIncome, marketCap),
    dividendYield: positiveDivide(dividend, marketCap),
    grossMargin: safeDivide(grossProfit, revenue),
    operatingMargin: safeDivide(operatingIncome, revenue),
    netMargin: safeDivide(netIncome, revenue),
    roe: safeDivide(netIncome, averageEquity),
    roa: safeDivide(netIncome, averageAssets),
    roic: safeDivide(nopat, investedCapital),
    cashConversion: safeDivide(freeCashFlow, netIncome),
    netDebtToEbitda: safeDivide((debt || 0) - (cash || 0), ebitda),
    debtToEquity: safeDivide(debt, equity),
    currentRatio: safeDivide(latest('currentAssets'), latest('currentLiabilities')),
    interestCoverage: safeDivide(operatingIncome, latest('interestExpense')),
    payoutRatio: safeDivide(dividend, netIncome)
  };

  const priorFcf = finite(prior('operatingCashFlow')) && finite(prior('capex')) ? prior('operatingCashFlow') - Math.abs(prior('capex')) : null;
  const growth = {
    revenueYoY: growthRate(revenue, prior('revenue')),
    revenueCagr3Y: cagr(raw.revenue?.[0]?.val, raw.revenue?.[3]?.val, 3),
    epsYoY: growthRate(eps, prior('eps')),
    epsCagr3Y: cagr(raw.eps?.[0]?.val, raw.eps?.[3]?.val, 3),
    fcfYoY: growthRate(freeCashFlow, priorFcf)
  };

  const keyMetrics = [ratios.peTTM, ratios.priceToSales, ratios.evEbitda, ratios.fcfYield, growth.revenueYoY, growth.epsYoY, ratios.operatingMargin, ratios.roe, ratios.roic, ratios.netDebtToEbitda];
  const coverage = Math.round(keyMetrics.filter(finite).length / keyMetrics.length * 100);
  return {
    ticker: snapshot.ticker,
    companyName: snapshot.companyName,
    cik: snapshot.cik,
    exchange: snapshot.exchange,
    currency: 'USD',
    sector: snapshot.sector,
    industry: snapshot.industry,
    price,
    priceChangePercent: quote?.percentChange ?? null,
    marketCap,
    enterpriseValue,
    fiscalPeriodEnd: snapshot.fiscalPeriodEnd,
    statementPeriod: snapshot.statementPeriod,
    fundamentals: { revenue, netIncome, operatingIncome, freeCashFlow, cash, debt, equity, assets, shares, ebitda },
    ratios: cleanNumbers(ratios),
    growth: cleanNumbers(growth),
    dataCoverage: coverage,
    dataQuality: coverage >= 75 ? 'complete' : coverage >= 40 ? 'partial' : 'limited',
    isStale: Boolean(freshness.isStale),
    lastSuccessfulUpdate: freshness.updatedAt,
    priceUpdatedAt: freshness.priceUpdatedAt,
    priceProvider: quote?.provider || null,
    sources: ['SEC EDGAR Company Facts', ...(quote?.provider ? [quote.provider] : [])]
  };
}

async function swr(env, ctx, key, ttlMs, loader) {
  const cached = await readEnvelope(env, key);
  if (cached) {
    const isStale = ageMs(cached.updatedAt) > ttlMs;
    if (isStale) ctx.waitUntil(loader().then(value => writeEnvelope(env, key, value)).catch(() => {}));
    return { value: cached.value, updatedAt: cached.updatedAt, isStale };
  }
  const value = await loader();
  const updatedAt = await writeEnvelope(env, key, value);
  return { value, updatedAt, isStale: false };
}

async function readEnvelope(env, key) {
  if (!env.EQUITY_CACHE) return null;
  try {
    const envelope = await env.EQUITY_CACHE.get(key, 'json');
    return envelope && envelope.value && Number.isFinite(Date.parse(envelope.updatedAt || '')) ? envelope : null;
  } catch {
    return null;
  }
}

async function writeEnvelope(env, key, value) {
  const updatedAt = new Date().toISOString();
  if (env.EQUITY_CACHE) await env.EQUITY_CACHE.put(key, JSON.stringify({ updatedAt, value }), { metadata: { contractVersion: CONTRACT_VERSION, updatedAt } });
  return updatedAt;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function secHeaders(env) {
  return { headers: { Accept: 'application/json', 'User-Agent': env.SEC_USER_AGENT || 'AGCI/1.0 (+https://alexsaldana.com/)' } };
}

function json(body, status = 200, maxAge = 0, headers = {}) {
  return cors(Response.json(body, { status, headers: { 'Cache-Control': maxAge > 0 ? `public, max-age=${maxAge}` : 'no-store', ...headers } }));
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET,OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  headers.set('X-Content-Type-Options', 'nosniff');
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function cleanNumbers(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, finite(value) ? Number(value) : null]));
}
function growthRate(current, previous) { return finite(current) && finite(previous) && previous > 0 ? current / previous - 1 : null; }
function cagr(current, previous, years) { return finite(current) && finite(previous) && current > 0 && previous > 0 ? Math.pow(current / previous, 1 / years) - 1 : null; }
function safeDivide(numerator, denominator) { return finite(numerator) && finite(denominator) && Number(denominator) !== 0 ? Number(numerator) / Number(denominator) : null; }
function positiveDivide(numerator, denominator) { return finite(numerator) && finite(denominator) && Number(numerator) > 0 && Number(denominator) > 0 ? Number(numerator) / Number(denominator) : null; }
function sumNullable(...values) { const valid = values.filter(finite).map(Number); return valid.length ? valid.reduce((sum, value) => sum + value, 0) : null; }
function averageNullable(...values) { const valid = values.filter(finite).map(Number); return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null; }
function clamp(value, minimum, maximum) { return finite(value) ? Math.max(minimum, Math.min(maximum, Number(value))) : null; }
function finite(value) { return value !== null && value !== undefined && value !== '' && Number.isFinite(Number(value)); }
function ageMs(value) { const timestamp = Date.parse(value || ''); return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : Infinity; }
