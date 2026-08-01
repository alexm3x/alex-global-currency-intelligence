const CACHE_TTL_SECONDS = 60;
const SYMBOLS = ["EUR/USD", "GBP/USD", "USD/JPY", "USD/MXN", "USD/BRL", "USD/CNY"];

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (url.pathname !== "/" && url.pathname !== "/market") {
      return json({ error: "Ruta no encontrada" }, 404);
    }
    if (!env.TWELVE_DATA_API_KEY) {
      return json({ error: "TWELVE_DATA_API_KEY no está configurada" }, 500);
    }

    const cache = caches.default;
    const cacheKey = new Request(`${url.origin}/market-live-v1`, { method: "GET" });
    const cached = await cache.match(cacheKey);
    if (cached) return withCors(cached);

    try {
      const quotes = [];
      for (const symbol of SYMBOLS) {
        const apiUrl = new URL("https://api.twelvedata.com/quote");
        apiUrl.searchParams.set("symbol", symbol);
        apiUrl.searchParams.set("apikey", env.TWELVE_DATA_API_KEY);
        const response = await fetch(apiUrl.toString(), {
          headers: { Accept: "application/json" }
        });
        if (response.status === 429) {
          return json({
            error: "Límite de Twelve Data alcanzado",
            detail: "El plan actual no permite esta frecuencia. Aumenta el TTL o mejora el plan."
          }, 429);
        }
        if (!response.ok) {
          return json({ error: "Error consultando Twelve Data", status: response.status }, 502);
        }
        const data = await response.json();
        quotes.push({
          symbol,
          price: numberOrNull(data.close),
          open: numberOrNull(data.open),
          previousClose: numberOrNull(data.previous_close),
          change: numberOrNull(data.change),
          percentChange: numberOrNull(data.percent_change),
          high: numberOrNull(data.high),
          low: numberOrNull(data.low),
          datetime: data.datetime || null
        });
      }

      const updatedAt = new Date();
      const payload = {
        provider: "Twelve Data",
        mode: "near-real-time-rest",
        refreshFrequency: "60 seconds",
        updatedAt: updatedAt.toISOString(),
        nextUpdateAt: new Date(updatedAt.getTime() + CACHE_TTL_SECONDS * 1000).toISOString(),
        quotes
      };
      const response = new Response(JSON.stringify(payload), {
        headers: {
          "Content-Type": "application/json; charset=UTF-8",
          "Cache-Control": `public, max-age=${CACHE_TTL_SECONDS}`
        }
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return withCors(response);
    } catch (error) {
      return json({ error: "No fue posible obtener datos", detail: error.message }, 502);
    }
  }
};

function numberOrNull(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function withCors(response) {
  const result = new Response(response.body, response);
  result.headers.set("Access-Control-Allow-Origin", "https://alexm3x.github.io");
  result.headers.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  return result;
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json; charset=UTF-8",
      "Access-Control-Allow-Origin": "https://alexm3x.github.io",
      "Access-Control-Allow-Methods": "GET, OPTIONS"
    }
  });
}
