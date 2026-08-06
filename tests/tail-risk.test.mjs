import test from "node:test";
import assert from "node:assert/strict";
import {
  CURRENCY_TARGETS,
  ECONOMIES,
  TAIL_RISK_SHARDS,
  buildAlertMessage,
  buildWebhookRequest,
  calculateTailRisk,
  configuredChannels,
  isMaterialScoreChange,
  normalizePrice,
  parseQuoteBatch,
  zScore
} from "../cloudflare/tail-risk.js";
import { runTailRiskCycle } from "../cloudflare/agci-market-data-live.js";

test("covers 21 economies through 17 unique currencies in quota-safe shards", () => {
  assert.equal(ECONOMIES.length, 21);
  assert.equal(CURRENCY_TARGETS.length, 17);
  assert.deepEqual(TAIL_RISK_SHARDS.map(shard => shard.length), [6, 6, 5]);
  assert.equal(new Set(CURRENCY_TARGETS.map(target => target.symbol)).size, 17);
  assert.equal(CURRENCY_TARGETS.find(target => target.code === "EUR").economies.length, 5);
});

test("normalizes direct and inverted USD quotes", () => {
  assert.equal(normalizePrice(18.75, false), 18.75);
  assert.equal(normalizePrice(1.25, true), 0.8);
  assert.equal(normalizePrice(0, true), null);
});

test("parses a Twelve Data batch and aligns inverted momentum", () => {
  const targets = CURRENCY_TARGETS.filter(target => ["EUR", "MXN"].includes(target.code));
  const result = parseQuoteBatch({
    "EUR/USD": { close: "1.2500", percent_change: "2.0", datetime: "2026-08-05" },
    "USD/MXN": { close: "18.7500", percent_change: "-1.5", datetime: "2026-08-05" }
  }, targets);
  const eur = result.quotes.find(quote => quote.code === "EUR");
  const mxn = result.quotes.find(quote => quote.code === "MXN");
  assert.equal(eur.normalizedPrice, 0.8);
  assert.equal(eur.momentum, -2);
  assert.equal(mxn.normalizedPrice, 18.75);
  assert.equal(mxn.momentum, -1.5);
  assert.deepEqual(result.errors, []);
});

test("computes bounded Z-Scores and detects a material score jump", () => {
  assert.ok(zScore(10, [1, 2, 3, 4, 5]) > 0);
  assert.deepEqual(isMaterialScoreChange(50, 60), {
    material: true,
    scoreChangePoints: 10,
    scoreChangePercent: 20
  });
  assert.equal(isMaterialScoreChange(50, 54).material, false);
  assert.equal(isMaterialScoreChange(0, 10).material, true);
});

test("warms up before evaluating and then produces a material anomaly", () => {
  const short = calculateTailRisk(
    [{ timestamp: "1", price: 100, momentum: 0.1 }],
    { normalizedPrice: 101, momentum: 0.2, providerDatetime: null },
    "2026-08-05T00:00:00.000Z"
  );
  assert.equal(short.enoughHistory, false);
  assert.equal(short.material, false);

  const prices = [100, 101, 100.5, 101.5, 101, 102, 101.5, 102.5];
  const momentums = [0.1, -0.1, 0.2, -0.2, 0.1, -0.1, 0.2, -0.2];
  const history = prices.map((price, index) => ({
    timestamp: String(index),
    price,
    momentum: momentums[index],
    tailRiskScore: index === prices.length - 1 ? 50 : null
  }));
  const result = calculateTailRisk(
    history,
    { normalizedPrice: 106, momentum: 4, providerDatetime: "2026-08-05" },
    "2026-08-05T06:00:00.000Z"
  );
  assert.equal(result.enoughHistory, true);
  assert.equal(result.material, true);
  assert.ok(result.observation.priceZScore > 0);
  assert.ok(result.observation.momentumZScore > 0);
  assert.ok(result.scoreChangePoints >= 5);
});

test("formats the required Spanish corporate alert", () => {
  const target = CURRENCY_TARGETS.find(item => item.code === "JPY");
  assert.equal(
    buildAlertMessage(target, -18.456),
    "[ALERTA AGCI] Anomalía detectada en Yen japonés (JPY). Cambio de Score: -18.46 puntos. Revisar panel corporativo"
  );
});

test("builds provider-specific webhook payloads without hardcoded credentials", () => {
  const env = {
    TAIL_RISK_CHANNELS: "telegram,discord,slack",
    TELEGRAM_BOT_TOKEN: "test-token",
    TELEGRAM_CHAT_ID: "123",
    DISCORD_WEBHOOK_URL: "https://discord.example/webhook",
    SLACK_WEBHOOK_URL: "https://slack.example/webhook"
  };
  assert.deepEqual(configuredChannels(env), ["telegram", "discord", "slack"]);
  const telegram = buildWebhookRequest("telegram", env, "alert");
  const discord = buildWebhookRequest("discord", env, "alert");
  const slack = buildWebhookRequest("slack", env, "alert");
  assert.match(telegram.url, /test-token\/sendMessage$/);
  assert.deepEqual(JSON.parse(telegram.init.body), { chat_id: "123", text: "alert", disable_web_page_preview: true });
  assert.deepEqual(JSON.parse(discord.init.body), { content: "alert", allowed_mentions: { parse: [] } });
  assert.deepEqual(JSON.parse(slack.init.body), { text: "alert" });
});

test("runs a scheduled shard end to end, persists state and delivers through Slack", async () => {
  const values = new Map();
  const kv = {
    async get(key, type) {
      const value = values.get(key) ?? null;
      return type === "json" && value ? JSON.parse(value) : value;
    },
    async put(key, value) { values.set(key, String(value)); },
    async delete(key) { values.delete(key); }
  };
  const bases = { CNY: 7, EUR: 0.8, JPY: 102.5, INR: 80, GBP: 0.75 };
  bases.USD = Math.exp([bases.CNY, bases.EUR, bases.JPY, bases.INR, bases.GBP]
    .reduce((sum, value) => sum + Math.log(value), 0) / 5);
  const pattern = [100, 101, 100.5, 101.5, 101, 102, 101.5, 102.5];
  const momentums = [0.1, -0.1, 0.2, -0.2, 0.1, -0.1, 0.2, -0.2];
  for (const target of TAIL_RISK_SHARDS[0]) {
    const base = bases[target.code];
    const history = pattern.map((point, index) => ({
      timestamp: String(index),
      price: base * point / 102.5,
      momentum: momentums[index],
      tailRiskScore: index === pattern.length - 1 ? 50 : null
    }));
    values.set(`tail-risk:history:${target.code}`, JSON.stringify({ history }));
  }

  const provider = {};
  for (const target of TAIL_RISK_SHARDS[0]) {
    const normalized = target.code === "JPY" ? 106 : bases[target.code] * 1.001;
    const momentum = target.code === "JPY" ? 4 : 0;
    provider[target.symbol] = {
      close: String(target.invert ? 1 / normalized : normalized),
      percent_change: String(target.invert ? -momentum : momentum),
      datetime: "2026-08-05 06:00:00"
    };
  }

  const calls = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).startsWith("https://api.twelvedata.com/quote")) {
      const symbol = new URL(String(url)).searchParams.get("symbol");
      return Response.json(provider[symbol]);
    }
    if (String(url) === "https://slack.example/webhook") return new Response("ok", { status: 200 });
    throw new Error(`Unexpected URL ${url}`);
  };

  try {
    const result = await runTailRiskCycle({
      TWELVE_DATA_API_KEY: "test-key",
      TAIL_RISK_STATE: kv,
      TAIL_RISK_CHANNELS: "slack",
      SLACK_WEBHOOK_URL: "https://slack.example/webhook"
    }, 0, new Date("2026-08-05T06:00:00.000Z"), "test");
    assert.equal(result.processed, 6);
    assert.equal(result.anomalies, 1);
    assert.equal(calls.filter(call => call.url.startsWith("https://api.twelvedata.com/quote")).length, 5);
    const slackCall = calls.find(call => call.url === "https://slack.example/webhook");
    assert.ok(slackCall);
    assert.match(JSON.parse(slackCall.init.body).text, /Yen japonés \(JPY\)/);
    assert.equal(values.has("tail-risk:pending:JPY"), false);
    assert.ok([...values.keys()].some(key => key.startsWith("tail-risk:sent:JPY-")));

    const duplicate = await runTailRiskCycle({
      TWELVE_DATA_API_KEY: "test-key",
      TAIL_RISK_STATE: kv,
      TAIL_RISK_CHANNELS: "slack",
      SLACK_WEBHOOK_URL: "https://slack.example/webhook"
    }, 0, new Date("2026-08-05T07:30:00.000Z"), "test-duplicate");
    assert.equal(duplicate.processed, 0);
    assert.equal(duplicate.duplicates, 6);
    assert.equal(calls.filter(call => call.url === "https://slack.example/webhook").length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
