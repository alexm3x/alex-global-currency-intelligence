import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker, { MARKET_KV_PREFIX } from "../cloudflare/agci-market-data-live.js";

const GROUPS = {
  core: ["EUR/USD", "GBP/USD", "USD/JPY", "USD/MXN"],
  extended: ["USD/BRL", "USD/CNY"]
};

function makeKv(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    async get(key, type) {
      const value = values.get(key) ?? null;
      return type === "json" && value ? JSON.parse(value) : value;
    },
    async put(key, value) { values.set(key, String(value)); },
    async delete(key) { values.delete(key); }
  };
}

function makeCache() {
  const values = new Map();
  return {
    values,
    async match(request) {
      const value = values.get(request.url);
      return value ? value.clone() : undefined;
    },
    async put(request, response) { values.set(request.url, response.clone()); }
  };
}

function snapshot(name, updatedAt) {
  const symbols = GROUPS[name];
  return {
    version: 3,
    name,
    symbols,
    updatedAt,
    nextUpdateAt: new Date(Date.parse(updatedAt) + 30 * 60 * 1000).toISOString(),
    quotes: symbols.map((symbol, index) => ({
      symbol,
      price: 1 + index,
      open: 1 + index,
      previousClose: 1 + index,
      change: 0,
      percentChange: 0,
      high: 1 + index,
      low: 1 + index,
      datetime: updatedAt
    }))
  };
}

function context() {
  const pending = [];
  return {
    pending,
    waitUntil(promise) { pending.push(Promise.resolve(promise)); }
  };
}

async function withRuntime({ cache, fetchImpl }, callback) {
  const originalCaches = globalThis.caches;
  const originalFetch = globalThis.fetch;
  globalThis.caches = { default: cache };
  globalThis.fetch = fetchImpl;
  try {
    return await callback();
  } finally {
    globalThis.caches = originalCaches;
    globalThis.fetch = originalFetch;
  }
}

test("persists every successful provider refresh as the last-known-good KV snapshot", async () => {
  const kv = makeKv();
  const cache = makeCache();
  const ctx = context();
  let providerCalls = 0;

  await withRuntime({
    cache,
    fetchImpl: async url => {
      providerCalls += 1;
      const symbol = new URL(String(url)).searchParams.get("symbol");
      return Response.json({
        symbol,
        close: "18.5",
        open: "18.4",
        previous_close: "18.3",
        change: "0.2",
        percent_change: "1.1",
        high: "18.6",
        low: "18.2",
        datetime: "2026-08-05 18:00:00"
      });
    }
  }, async () => {
    const response = await worker.fetch(
      new Request("https://agci.example/market"),
      { TWELVE_DATA_API_KEY: "test", MARKET_DATA_CACHE: kv },
      ctx
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-AGCI-Cache"), "FRESH");
    assert.equal(body.isStale, false);
    assert.equal(body.quotes.length, 6);
    assert.equal(providerCalls, 6);
    assert.ok(kv.values.has(`${MARKET_KV_PREFIX}core`));
    assert.ok(kv.values.has(`${MARKET_KV_PREFIX}extended`));
  });
});

test("serves stale KV snapshots transparently when Twelve Data is rate limited", async () => {
  const old = "2026-08-01T00:00:00.000Z";
  const kv = makeKv({
    [`${MARKET_KV_PREFIX}core`]: JSON.stringify(snapshot("core", old)),
    [`${MARKET_KV_PREFIX}extended`]: JSON.stringify(snapshot("extended", old))
  });
  const cache = makeCache();
  const ctx = context();

  await withRuntime({
    cache,
    fetchImpl: async () => Response.json(
      { status: "error", message: "Rate Limit Exceeded" },
      { status: 429 }
    )
  }, async () => {
    const response = await worker.fetch(
      new Request("https://agci.example/market"),
      { TWELVE_DATA_API_KEY: "test", MARKET_DATA_CACHE: kv },
      ctx
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("X-AGCI-Cache"), "STALE");
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(body.isStale, true);
    assert.deepEqual(body.cache.staleGroups, ["core", "extended"]);
    assert.equal(body.quotes.length, 6);
    assert.ok(body.groups.every(group => group.isStale === true));
    await Promise.all(ctx.pending);
  });
});

test("uses persisted data even when the provider secret is temporarily unavailable", async () => {
  const old = "2026-08-01T00:00:00.000Z";
  const kv = makeKv({
    [`${MARKET_KV_PREFIX}core`]: JSON.stringify(snapshot("core", old)),
    [`${MARKET_KV_PREFIX}extended`]: JSON.stringify(snapshot("extended", old))
  });
  const cache = makeCache();
  const ctx = context();

  await withRuntime({
    cache,
    fetchImpl: async () => { throw new Error("fetch should not block stale delivery"); }
  }, async () => {
    const response = await worker.fetch(
      new Request("https://agci.example/market"),
      { MARKET_DATA_CACHE: kv },
      ctx
    );
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.isStale, true);
    assert.equal(body.quotes.length, 6);
    await Promise.all(ctx.pending);
  });
});

test("frontend renders the exact discreet amber stale-data indicator", async () => {
  const source = await readFile(new URL("../market-live.js", import.meta.url), "utf8");
  assert.match(source, /payload\?\.isStale === true/);
  assert.match(source, /Datos en caché \(Servidor origen no disponible\)/);
  assert.match(source, /market-cache-indicator/);
  assert.match(source, /background:rgba\(212,155,32/);
});
