const FAST_TTL_SECONDS = 15 * 60;
const SLOW_TTL_SECONDS = 30 * 60;
const STALE_TTL_SECONDS = 24 * 60 * 60;

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
      return new Response(null, {
        status: 204,
        headers: corsHeaders()
      });
    }

    if (request.method !== "GET" || (url.pathname !== "/" && url.pathname !== "/market")) {
      return json({ error: "Ruta no encontrada" }, 404);
    }

    if (!env.TWELVE_DATA_API_KEY) {
      return json({ error: "TWELVE_DATA_API_KEY no está configurada" }, 500);
    }

    const cache = caches.default;

    try {
      const results = [];
      for (const group of GROUPS) {
        results.push(await getGroup({ group, cache, origin: url.origin, env, ctx }));
      }

      const quotes = results.flatMap(result => result.quotes);
      const updatedTimes = results
        .map(result => Date.parse(result.updatedAt || ""))
        .filter(Number.isFinite);
      const nextTimes = results
        .map(result => Date.parse(result.nextUpdateAt || ""))
        .filter(Number.isFinite);

      const payload = {
        provider: "Twelve Data",
        mode: "basic-plan-optimized",
        refreshFrequency: {
          core: "15 minutes",
          extended: "30 minutes",
          browser: "60 seconds"
        },
        updatedAt: updatedTimes.length ? new Date(Math.max(...updatedTimes)).toISOString() : null,
        oldestUpdatedAt: updatedTimes.length ? new Date(Math.min(...updatedTimes)).toISOString() : null,
        nextUpdateAt: nextTimes.length ? new Date(Math.min(...nextTimes)).toISOString() : null,
        groups: results.map(result => ({
          name: result.name,
          symbols: result.symbols,
          updatedAt: result.updatedAt,
          nextUpdateAt: result.nextUpdateAt,
          source: result.source
        })),
        quotes
      };

      return json(payload, 200, 60);
    } catch (error) {
      return json({
        error: "No fue posible obtener datos de mercado",
        detail: error.message
      }, 502);
    }
  }
};

async function getGroup({ group, cache, origin, env, ctx }) {
  const freshKey = new Request(`${origin}/_cache/${group.name}/fresh-v2`);
  const staleKey = new Request(`${origin}/_cache/${group.name}/stale-v2`);

  const fresh = await cache.match(freshKey);
  if (fresh) {
    const data = await fresh.json();
    return { ...data, source: "cache" };
  }

  try {
    const quotes = [];

    for (const symbol of group.symbols) {
      const quote = await fetchQuote(symbol, env.TWELVE_DATA_API_KEY);
      quotes.push(quote);
    }

    const updatedAt = new Date();
    const groupPayload = {
      name: group.name,
      symbols: group.symbols,
      updatedAt: updatedAt.toISOString(),
      nextUpdateAt: new Date(updatedAt.getTime() + group.ttl * 1000).toISOString(),
      quotes
    };

    const freshResponse = cacheResponse(groupPayload, group.ttl);
    const staleResponse = cacheResponse(groupPayload, STALE_TTL_SECONDS);

    ctx.waitUntil(Promise.all([
      cache.put(freshKey, freshResponse),
      cache.put(staleKey, staleResponse)
    ]));

    return { ...groupPayload, source: "provider" };
  } catch (error) {
    const stale = await cache.match(staleKey);
    if (stale) {
      const data = await stale.json();
      return {
        ...data,
        source: "stale-cache",
        warning: error.message
      };
    }
    throw error;
  }
}

async function fetchQuote(symbol, apiKey) {
  const apiUrl = new URL("https://api.twelvedata.com/quote");
  apiUrl.searchParams.set("symbol", symbol);
  apiUrl.searchParams.set("apikey", apiKey);

  const response = await fetch(apiUrl.toString(), {
    headers: { Accept: "application/json" }
  });

  if (response.status === 429) {
    throw new Error("Límite diario o por minuto de Twelve Data alcanzado");
  }

  if (!response.ok) {
    throw new Error(`Twelve Data respondió HTTP ${response.status}`);
  }

  const data = await response.json();
  if (data.status === "error") {
    throw new Error(data.message || "Twelve Data devolvió un error");
  }

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
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function json(body, status = 200, browserTtl = 0) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Cache-Control": browserTtl ? `public, max-age=${browserTtl}` : "no-store",
      ...corsHeaders()
    }
  });
}
