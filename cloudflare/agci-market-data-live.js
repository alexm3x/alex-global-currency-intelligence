import {
  CURRENCY_TARGETS,
  ECONOMIES,
  TAIL_RISK_DEFAULTS,
  TAIL_RISK_SHARDS,
  buildAlertMessage,
  buildWebhookRequest,
  calculateTailRisk,
  configuredChannels,
  parseQuoteBatch
} from "./tail-risk.js";

const FAST_TTL_SECONDS = 15 * 60;
const SLOW_TTL_SECONDS = 30 * 60;
const EDGE_STALE_TTL_SECONDS = 7 * 24 * 60 * 60;
const MARKET_CACHE_VERSION = 3;
const MARKET_KV_PREFIX = `market-data:v${MARKET_CACHE_VERSION}:group:`;
const WEBHOOK_TIMEOUT_MS = 10_000;
const PROVIDER_TIMEOUT_MS = 12_000;
const TAIL_RISK_CRONS = Object.freeze({
  "0 */6 * * *": 0,
  "2 */6 * * *": 1,
  "4 */6 * * *": 2
});

const GROUPS = [
  {
    name: "core",
    ttl: FAST_TTL_SECONDS,
    symbols: ["EUR/USD", "GBP/USD", "USD/JPY", "USD/MXN"]
  },
  {
    name: "extended",
    ttl: SLOW_TTL_SECONDS,
    symbols: ["USD/BRL", "USD/CNY"]
  }
];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    if (request.method === "GET" && url.pathname === "/tail-risk/status") {
      return json(tailRiskStatus(env));
    }

    if (request.method === "POST" && url.pathname === "/tail-risk/run") {
      if (!(await authorized(request, env))) return json({ error: "No autorizado" }, 401);
      const shard = Number(url.searchParams.get("shard") ?? 0);
      if (!Number.isInteger(shard) || !TAIL_RISK_SHARDS[shard]) {
        return json({ error: `Shard inválido; use 0-${TAIL_RISK_SHARDS.length - 1}` }, 400);
      }
      try {
        const result = await runTailRiskCycle(env, shard, new Date(), "manual");
        return json({ ok: true, ...result });
      } catch (error) {
        logError("tail-risk-manual-failed", error, { shard });
        return json({ error: "No fue posible ejecutar Tail Risk" }, 502);
      }
    }

    if (request.method !== "GET" || (url.pathname !== "/" && url.pathname !== "/market")) {
      return json({ error: "Ruta no encontrada" }, 404);
    }

    const cache = caches.default;

    try {
      const results = [];
      for (const group of GROUPS) {
        results.push(await getGroup({ group, cache, origin: url.origin, env, ctx }));
      }

      const quotes = results.flatMap(result => result.quotes);
      const updatedTimes = results.map(result => Date.parse(result.updatedAt || "")).filter(Number.isFinite);
      const nextTimes = results.map(result => Date.parse(result.nextUpdateAt || "")).filter(Number.isFinite);
      const staleGroups = results.filter(result => result.isStale).map(result => result.name);
      const isStale = staleGroups.length > 0;

      const payload = {
        provider: "Twelve Data",
        mode: "basic-plan-optimized",
        isStale,
        refreshFrequency: {
          core: "15 minutes",
          extended: "30 minutes",
          browser: "60 seconds",
          tailRisk: "6 hours"
        },
        updatedAt: updatedTimes.length ? new Date(Math.max(...updatedTimes)).toISOString() : null,
        oldestUpdatedAt: updatedTimes.length ? new Date(Math.min(...updatedTimes)).toISOString() : null,
        nextUpdateAt: nextTimes.length ? new Date(Math.min(...nextTimes)).toISOString() : null,
        groups: results.map(result => ({
          name: result.name,
          symbols: result.symbols,
          updatedAt: result.updatedAt,
          nextUpdateAt: result.nextUpdateAt,
          source: result.source,
          isStale: result.isStale
        })),
        cache: {
          strategy: "stale-while-revalidate",
          persistentStore: "cloudflare-kv",
          staleGroups
        },
        tailRisk: {
          enabled: env.TAIL_RISK_ENABLED === "true",
          economies: ECONOMIES.length,
          uniqueCurrencies: CURRENCY_TARGETS.length,
          statusPath: "/tail-risk/status"
        },
        quotes
      };

      return json(payload, 200, isStale ? 0 : 60, {
        "X-AGCI-Cache": isStale ? "STALE" : "FRESH"
      });
    } catch (error) {
      logError("market-data-failed", error);
      return json({
        error: "No fue posible obtener datos de mercado",
        detail: error instanceof Error ? error.message : "Error desconocido"
      }, 502);
    }
  },

  async scheduled(controller, env, ctx) {
    if (env.TAIL_RISK_ENABLED !== "true") {
      logInfo("tail-risk-skipped", { reason: "disabled", cron: controller.cron });
      return;
    }
    const shard = TAIL_RISK_CRONS[controller.cron];
    if (!Number.isInteger(shard)) {
      logInfo("tail-risk-skipped", { reason: "unknown-cron", cron: controller.cron });
      return;
    }
    ctx.waitUntil(
      runTailRiskCycle(env, shard, new Date(controller.scheduledTime), "scheduled")
        .catch(error => logError("tail-risk-scheduled-failed", error, { shard, cron: controller.cron }))
    );
  }
};

async function getGroup({ group, cache, origin, env, ctx }) {
  const freshKey = new Request(`${origin}/_cache/${group.name}/fresh-v${MARKET_CACHE_VERSION}`);
  const staleKey = new Request(`${origin}/_cache/${group.name}/stale-v${MARKET_CACHE_VERSION}`);
  const legacyStaleKey = new Request(`${origin}/_cache/${group.name}/stale-v2`);

  const fresh = await cache.match(freshKey);
  if (fresh) {
    const data = await fresh.json();
    return { ...data, source: "edge-cache", isStale: false };
  }

  const [snapshot, edgeStale, legacyStale] = await Promise.all([
    readMarketSnapshot(env, group),
    cache.match(staleKey),
    cache.match(legacyStaleKey)
  ]);

  if (snapshot) {
    const isStale = marketSnapshotAgeMs(snapshot) > group.ttl * 1000;
    if (isStale) {
      ctx.waitUntil(
        revalidateGroup({ group, cache, freshKey, staleKey, env })
          .catch(error => logError("market-swr-revalidation-failed", error, { group: group.name }))
      );
    } else {
      ctx.waitUntil(cache.put(freshKey, cacheResponse(snapshot, group.ttl)));
    }
    return {
      ...snapshot,
      source: isStale ? "stale-kv" : "kv-cache",
      isStale
    };
  }

  try {
    const groupPayload = await revalidateGroup({ group, cache, freshKey, staleKey, env });
    return { ...groupPayload, source: "provider", isStale: false };
  } catch (error) {
    const fallback = edgeStale || legacyStale;
    if (fallback) {
      const data = await fallback.json();
      if (!edgeStale && validMarketSnapshot(data, group)) {
        ctx.waitUntil(
          writeMarketSnapshot(env, group, { ...data, version: MARKET_CACHE_VERSION })
            .catch(kvError => logError("market-legacy-cache-migration-failed", kvError, { group: group.name }))
        );
      }
      return {
        ...data,
        source: edgeStale ? "stale-edge-cache" : "stale-legacy-edge-cache",
        isStale: true,
        warning: error instanceof Error ? error.message : "Error desconocido"
      };
    }
    throw error;
  }
}

async function revalidateGroup({ group, cache, freshKey, staleKey, env }) {
  if (!env.TWELVE_DATA_API_KEY) throw new Error("TWELVE_DATA_API_KEY no está configurada");

  const quotes = [];
  for (const symbol of group.symbols) quotes.push(await fetchQuote(symbol, env.TWELVE_DATA_API_KEY));

  const updatedAt = new Date();
  const groupPayload = {
    version: MARKET_CACHE_VERSION,
    name: group.name,
    symbols: group.symbols,
    updatedAt: updatedAt.toISOString(),
    nextUpdateAt: new Date(updatedAt.getTime() + group.ttl * 1000).toISOString(),
    quotes
  };

  await writeMarketSnapshot(env, group, groupPayload);
  await Promise.all([
    cache.put(freshKey, cacheResponse(groupPayload, group.ttl)),
    cache.put(staleKey, cacheResponse(groupPayload, EDGE_STALE_TTL_SECONDS))
  ]);
  return groupPayload;
}

function marketSnapshotKey(group) {
  return `${MARKET_KV_PREFIX}${group.name}`;
}

function validMarketSnapshot(value, group) {
  return Boolean(
    value
    && typeof value === "object"
    && value.name === group.name
    && Array.isArray(value.quotes)
    && value.quotes.some(quote => Number.isFinite(Number(quote?.price)))
    && Number.isFinite(Date.parse(value.updatedAt || ""))
  );
}

function marketSnapshotAgeMs(snapshot) {
  const timestamp = Date.parse(snapshot?.updatedAt || "");
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : Infinity;
}

async function readMarketSnapshot(env, group) {
  if (!env.MARKET_DATA_CACHE) return null;
  try {
    const value = await env.MARKET_DATA_CACHE.get(marketSnapshotKey(group), "json");
    return validMarketSnapshot(value, group) ? value : null;
  } catch (error) {
    logError("market-kv-read-failed", error, { group: group.name });
    return null;
  }
}

async function writeMarketSnapshot(env, group, payload) {
  if (!env.MARKET_DATA_CACHE) {
    throw new Error("MARKET_DATA_CACHE KV no está enlazado");
  }
  await env.MARKET_DATA_CACHE.put(marketSnapshotKey(group), JSON.stringify(payload), {
    metadata: {
      version: MARKET_CACHE_VERSION,
      group: group.name,
      updatedAt: payload.updatedAt
    }
  });
}

async function fetchQuote(symbol, apiKey) {
  const apiUrl = new URL("https://api.twelvedata.com/quote");
  apiUrl.searchParams.set("symbol", symbol);
  apiUrl.searchParams.set("apikey", apiKey);
  const response = await fetchWithTimeout(apiUrl.toString(), PROVIDER_TIMEOUT_MS);
  const data = await parseProviderResponse(response);
  return {
    symbol,
    price: numberOrNull(data.close),
    open: numberOrNull(data.open),
    previousClose: numberOrNull(data.previous_close),
    change: numberOrNull(data.change),
    percentChange: numberOrNull(data.percent_change),
    high: numberOrNull(data.high),
    low: numberOrNull(data.low),
    datetime: data.datetime || null
  };
}

async function fetchTailRiskQuotes(targets, apiKey) {
  const quotes = [];
  const errors = [];
  for (const target of targets) {
    if (target.synthetic) continue;
    const apiUrl = new URL("https://api.twelvedata.com/quote");
    apiUrl.searchParams.set("symbol", target.symbol);
    apiUrl.searchParams.set("apikey", apiKey);
    try {
      const response = await fetchWithTimeout(apiUrl.toString(), PROVIDER_TIMEOUT_MS);
      const data = await parseProviderResponse(response);
      const parsed = parseQuoteBatch(data, [target]);
      quotes.push(...parsed.quotes);
      errors.push(...parsed.errors);
    } catch (error) {
      errors.push({ symbol: target.symbol, error: error instanceof Error ? error.message : "Provider error" });
    }
  }
  const usdTarget = targets.find(target => target.code === "USD" && target.synthetic);
  if (usdTarget) {
    const components = quotes.filter(quote => ["CNY", "EUR", "JPY", "INR", "GBP"].includes(quote.code));
    if (components.length >= 3) {
      const normalizedPrice = Math.exp(components.reduce((sum, quote) => sum + Math.log(quote.normalizedPrice), 0) / components.length);
      const sortedMomentum = components.map(quote => quote.momentum).sort((a, b) => a - b);
      const midpoint = Math.floor(sortedMomentum.length / 2);
      const momentum = sortedMomentum.length % 2
        ? sortedMomentum[midpoint]
        : (sortedMomentum[midpoint - 1] + sortedMomentum[midpoint]) / 2;
      quotes.unshift({
        ...usdTarget,
        rawPrice: normalizedPrice,
        normalizedPrice,
        momentum,
        providerDatetime: timestampMax(components.map(quote => quote.providerDatetime))
      });
    } else {
      errors.push({ symbol: usdTarget.symbol, error: "Insufficient components for USD basket" });
    }
  }
  return { quotes, errors };
}

function timestampMax(values) {
  return values.filter(Boolean).sort().at(-1) || null;
}

async function fetchWithTimeout(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { headers: { Accept: "application/json" }, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function parseProviderResponse(response) {
  if (response.status === 429) throw new Error("Límite diario o por minuto de Twelve Data alcanzado");
  if (!response.ok) throw new Error(`Twelve Data respondió HTTP ${response.status}`);
  const data = await response.json();
  if (data?.status === "error") throw new Error(data.message || "Twelve Data devolvió un error");
  return data;
}

function numberSetting(env, key, fallback, minimum, maximum) {
  const parsed = Number(env[key]);
  return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, parsed)) : fallback;
}

function tailRiskOptions(env) {
  return {
    historyLimit: numberSetting(env, "TAIL_RISK_HISTORY_LIMIT", TAIL_RISK_DEFAULTS.historyLimit, 16, 256),
    minSamples: numberSetting(env, "TAIL_RISK_MIN_SAMPLES", TAIL_RISK_DEFAULTS.minSamples, 4, 60),
    thresholdPercent: numberSetting(env, "TAIL_RISK_THRESHOLD_PERCENT", TAIL_RISK_DEFAULTS.thresholdPercent, 1, 100),
    minScorePoints: numberSetting(env, "TAIL_RISK_MIN_SCORE_POINTS", TAIL_RISK_DEFAULTS.minScorePoints, 0, 50),
    priceWeight: numberSetting(env, "TAIL_RISK_PRICE_WEIGHT", TAIL_RISK_DEFAULTS.priceWeight, 0, 1),
    momentumWeight: numberSetting(env, "TAIL_RISK_MOMENTUM_WEIGHT", TAIL_RISK_DEFAULTS.momentumWeight, 0, 1)
  };
}

function stateKey(code) {
  return `tail-risk:history:${code}`;
}

function pendingKey(code) {
  return `tail-risk:pending:${code}`;
}

async function readJson(env, key) {
  const value = await env.TAIL_RISK_STATE.get(key, "json");
  return value && typeof value === "object" ? value : null;
}

async function readHistory(env, code) {
  const state = await readJson(env, stateKey(code));
  return Array.isArray(state?.history) ? state.history : [];
}

async function writeHistory(env, target, history, updatedAt) {
  await env.TAIL_RISK_STATE.put(stateKey(target.code), JSON.stringify({
    version: 1,
    code: target.code,
    symbol: target.symbol,
    updatedAt,
    history
  }));
}

async function enqueuePending(env, event) {
  const stored = await readJson(env, pendingKey(event.code));
  const events = Array.isArray(stored?.events) ? stored.events : [];
  if (!events.some(item => item.id === event.id)) events.push(event);
  await env.TAIL_RISK_STATE.put(pendingKey(event.code), JSON.stringify({ events: events.slice(-10) }));
}

async function deliverWebhook(channel, env, message) {
  const request = buildWebhookRequest(channel, env, message);
  let lastStatus = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), WEBHOOK_TIMEOUT_MS);
    try {
      const response = await fetch(request.url, { ...request.init, signal: controller.signal });
      lastStatus = response.status;
      if (response.ok) return { channel, ok: true, status: response.status, attempts: attempt };
      if (response.status !== 429 && response.status < 500) break;
    } catch (error) {
      if (attempt === 3) return { channel, ok: false, status: lastStatus, attempts: attempt, error: errorName(error) };
    } finally {
      clearTimeout(timer);
    }
    await delay(250 * (2 ** (attempt - 1)));
  }
  return { channel, ok: false, status: lastStatus, attempts: 3, error: "webhook-http-error" };
}

async function deliverPendingEvent(env, event) {
  const channels = configuredChannels(env);
  if (!channels.length) return { complete: false, configuredChannels: 0, results: [] };
  const results = [];
  for (const channel of channels) {
    const sentKey = `tail-risk:sent:${event.id}:${channel}`;
    if (await env.TAIL_RISK_STATE.get(sentKey)) {
      results.push({ channel, ok: true, duplicate: true });
      continue;
    }
    const result = await deliverWebhook(channel, env, event.message);
    results.push(result);
    if (result.ok) {
      await env.TAIL_RISK_STATE.put(sentKey, "1", { expirationTtl: 7 * 24 * 60 * 60 });
    }
  }
  return { complete: results.every(result => result.ok), configuredChannels: channels.length, results };
}

async function drainPending(env, target) {
  const key = pendingKey(target.code);
  const stored = await readJson(env, key);
  const events = Array.isArray(stored?.events) ? stored.events : [];
  if (!events.length) return { delivered: 0, remaining: 0 };
  const remaining = [];
  let delivered = 0;
  for (const event of events) {
    const result = await deliverPendingEvent(env, event);
    if (result.complete) delivered += 1;
    else remaining.push(event);
    logInfo("tail-risk-delivery", {
      eventId: event.id,
      code: event.code,
      complete: result.complete,
      channels: result.results.map(item => ({ channel: item.channel, ok: item.ok, status: item.status || null }))
    });
  }
  if (remaining.length) await env.TAIL_RISK_STATE.put(key, JSON.stringify({ events: remaining }));
  else await env.TAIL_RISK_STATE.delete(key);
  return { delivered, remaining: remaining.length };
}

async function runTailRiskCycle(env, shardIndex, scheduledAt, reason) {
  if (!env.TWELVE_DATA_API_KEY) throw new Error("TWELVE_DATA_API_KEY no está configurada");
  if (!env.TAIL_RISK_STATE) throw new Error("TAIL_RISK_STATE KV no está enlazado");
  const targets = TAIL_RISK_SHARDS[shardIndex];
  if (!targets) throw new Error(`Shard Tail Risk inexistente: ${shardIndex}`);

  const retrySummary = [];
  for (const target of targets) retrySummary.push(await drainPending(env, target));

  const timestamp = sixHourBucket(scheduledAt);
  const options = tailRiskOptions(env);
  const { quotes, errors } = await fetchTailRiskQuotes(targets, env.TWELVE_DATA_API_KEY);
  const evaluations = [];
  let duplicates = 0;

  for (const quote of quotes) {
    const history = await readHistory(env, quote.code);
    if (history.at(-1)?.timestamp === timestamp) {
      duplicates += 1;
      continue;
    }
    const evaluation = calculateTailRisk(history, quote, timestamp, options);
    await writeHistory(env, quote, evaluation.nextHistory, timestamp);
    evaluations.push({ quote, evaluation });
  }

  let anomalies = 0;
  for (const { quote, evaluation } of evaluations) {
    if (!evaluation.material) continue;
    anomalies += 1;
    const event = {
      id: `${quote.code}-${timestamp.slice(0, 13).replaceAll(":", "")}-${evaluation.scoreChangePoints}`,
      code: quote.code,
      currency: quote.name,
      timestamp,
      scoreChangePoints: evaluation.scoreChangePoints,
      scoreChangePercent: evaluation.scoreChangePercent,
      priceZScore: evaluation.observation.priceZScore,
      momentumZScore: evaluation.observation.momentumZScore,
      message: buildAlertMessage(quote, evaluation.scoreChangePoints)
    };
    await enqueuePending(env, event);
    await drainPending(env, quote);
  }

  const summary = {
    reason,
    shard: shardIndex,
    timestamp,
    requested: targets.length,
    processed: evaluations.length,
    duplicates,
    warm: evaluations.filter(item => item.evaluation.enoughHistory).length,
    anomalies,
    providerErrors: errors,
    pendingRetries: retrySummary.reduce((sum, item) => sum + item.remaining, 0)
  };
  logInfo("tail-risk-cycle", summary);
  return summary;
}

function sixHourBucket(date) {
  const interval = 6 * 60 * 60 * 1000;
  return new Date(Math.floor(date.getTime() / interval) * interval).toISOString();
}

async function authorized(request, env) {
  const provided = request.headers.get("x-agci-key") || "";
  const expected = env.AGCI_TAIL_RISK_API_KEY || "";
  if (!provided || !expected) return false;
  const encoder = new TextEncoder();
  const [providedHash, expectedHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(provided)),
    crypto.subtle.digest("SHA-256", encoder.encode(expected))
  ]);
  return crypto.subtle.timingSafeEqual(providedHash, expectedHash);
}

function tailRiskStatus(env) {
  const options = tailRiskOptions(env);
  const requestedChannels = String(env.TAIL_RISK_CHANNELS || "").split(",").map(value => value.trim()).filter(Boolean);
  return {
    ok: true,
    module: "agci-tail-risk-v1",
    enabled: env.TAIL_RISK_ENABLED === "true",
    schedule: Object.keys(TAIL_RISK_CRONS),
    coverage: { economies: ECONOMIES.length, uniqueCurrencies: CURRENCY_TARGETS.length },
    shards: TAIL_RISK_SHARDS.map((targets, index) => ({ index, symbols: targets.map(target => target.symbol) })),
    scoring: {
      historyLimit: options.historyLimit,
      minSamples: options.minSamples,
      priceWeight: options.priceWeight,
      momentumWeight: options.momentumWeight,
      thresholdPercent: options.thresholdPercent,
      minScorePoints: options.minScorePoints
    },
    storageReady: Boolean(env.TAIL_RISK_STATE),
    requestedChannels,
    configuredChannels: configuredChannels(env),
    manualTriggerReady: Boolean(env.AGCI_TAIL_RISK_API_KEY),
    timestamp: new Date().toISOString()
  };
}

function cacheResponse(body, ttl) {
  return new Response(JSON.stringify(body), {
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": `public, max-age=${ttl}`
    }
  });
}

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "https://alexm3x.github.io",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-AGCI-Key",
    "Vary": "Origin"
  };
}

function json(body, status = 200, browserTtl = 0, extraHeaders = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": browserTtl ? `public, max-age=${browserTtl}` : "no-store",
      ...corsHeaders(),
      ...extraHeaders
    }
  });
}

function delay(milliseconds) {
  return new Promise(resolve => setTimeout(resolve, milliseconds));
}

function errorName(error) {
  return error instanceof Error ? error.name : "UnknownError";
}

function logInfo(event, details = {}) {
  console.log(JSON.stringify({ level: "info", event, ...details }));
}

function logError(event, error, details = {}) {
  console.error(JSON.stringify({
    level: "error",
    event,
    error: error instanceof Error ? error.message : String(error),
    ...details
  }));
}

export {
  MARKET_CACHE_VERSION,
  MARKET_KV_PREFIX,
  getGroup,
  marketSnapshotKey,
  runTailRiskCycle,
  tailRiskOptions,
  tailRiskStatus
};
