const DEFAULTS = Object.freeze({
  historyLimit: 64,
  minSamples: 6,
  priceWeight: 0.65,
  momentumWeight: 0.35,
  zScale: 10,
  thresholdPercent: 15,
  minScorePoints: 5,
  maxAbsZ: 8
});

export const ECONOMIES = Object.freeze([
  { country: "Estados Unidos", code: "USD", name: "Dólar estadounidense", symbol: "AGCI:USD-BASKET", invert: false, synthetic: true },
  { country: "China", code: "CNY", name: "Yuan chino", symbol: "USD/CNY", invert: false },
  { country: "Alemania", code: "EUR", name: "Euro", symbol: "EUR/USD", invert: true },
  { country: "Japón", code: "JPY", name: "Yen japonés", symbol: "USD/JPY", invert: false },
  { country: "India", code: "INR", name: "Rupia india", symbol: "USD/INR", invert: false },
  { country: "Reino Unido", code: "GBP", name: "Libra esterlina", symbol: "GBP/USD", invert: true },
  { country: "Francia", code: "EUR", name: "Euro", symbol: "EUR/USD", invert: true },
  { country: "Italia", code: "EUR", name: "Euro", symbol: "EUR/USD", invert: true },
  { country: "Brasil", code: "BRL", name: "Real brasileño", symbol: "USD/BRL", invert: false },
  { country: "Canadá", code: "CAD", name: "Dólar canadiense", symbol: "USD/CAD", invert: false },
  { country: "Rusia", code: "RUB", name: "Rublo ruso", symbol: "USD/RUB", invert: false },
  { country: "Corea del Sur", code: "KRW", name: "Won surcoreano", symbol: "USD/KRW", invert: false },
  { country: "Australia", code: "AUD", name: "Dólar australiano", symbol: "AUD/USD", invert: true },
  { country: "España", code: "EUR", name: "Euro", symbol: "EUR/USD", invert: true },
  { country: "México", code: "MXN", name: "Peso mexicano", symbol: "USD/MXN", invert: false },
  { country: "Indonesia", code: "IDR", name: "Rupia indonesia", symbol: "USD/IDR", invert: false },
  { country: "Turquía", code: "TRY", name: "Lira turca", symbol: "USD/TRY", invert: false },
  { country: "Países Bajos", code: "EUR", name: "Euro", symbol: "EUR/USD", invert: true },
  { country: "Arabia Saudita", code: "SAR", name: "Riyal saudí", symbol: "USD/SAR", invert: false },
  { country: "Suiza", code: "CHF", name: "Franco suizo", symbol: "USD/CHF", invert: false },
  { country: "Argentina", code: "ARS", name: "Peso argentino", symbol: "USD/ARS", invert: false }
]);

export const CURRENCY_TARGETS = Object.freeze(
  Array.from(
    ECONOMIES.reduce((map, economy) => {
      const current = map.get(economy.code);
      if (current) current.economies.push(economy.country);
      else map.set(economy.code, { ...economy, economies: [economy.country] });
      return map;
    }, new Map()).values()
  ).map(Object.freeze)
);

export const TAIL_RISK_SHARDS = Object.freeze([
  Object.freeze(CURRENCY_TARGETS.slice(0, 6)),
  Object.freeze(CURRENCY_TARGETS.slice(6, 12)),
  Object.freeze(CURRENCY_TARGETS.slice(12))
]);

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 4) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values, average) {
  if (values.length < 2) return 0;
  const variance = values.reduce((sum, value) => sum + ((value - average) ** 2), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

export function zScore(value, samples, maxAbsZ = DEFAULTS.maxAbsZ) {
  if (!Number.isFinite(value) || !Array.isArray(samples) || samples.length < 2) return null;
  const clean = samples.map(finite).filter(value => value !== null);
  if (clean.length < 2) return null;
  const average = mean(clean);
  const deviation = standardDeviation(clean, average);
  if (deviation < 1e-10) {
    if (Math.abs(value - average) < 1e-10) return 0;
    return Math.sign(value - average) * maxAbsZ;
  }
  return round(clamp((value - average) / deviation, -maxAbsZ, maxAbsZ));
}

export function normalizePrice(rawPrice, invert = false) {
  const price = finite(rawPrice);
  if (price === null || price <= 0) return null;
  return invert ? 1 / price : price;
}

export function parseQuoteBatch(data, targets) {
  if (!data || typeof data !== "object") return { quotes: [], errors: [{ symbol: "batch", error: "Invalid response" }] };
  if (data.status === "error") return { quotes: [], errors: [{ symbol: "batch", error: String(data.message || "Provider error") }] };

  const quotes = [];
  const errors = [];
  for (const target of targets) {
    const raw = targets.length === 1 && !data[target.symbol] ? data : data[target.symbol];
    if (!raw || raw.status === "error") {
      errors.push({ symbol: target.symbol, error: String(raw?.message || "Missing quote") });
      continue;
    }
    const rawPrice = finite(raw.close ?? raw.price);
    const normalizedPrice = normalizePrice(rawPrice, target.invert);
    const rawMomentum = finite(raw.percent_change ?? raw.percentChange);
    if (normalizedPrice === null || rawMomentum === null) {
      errors.push({ symbol: target.symbol, error: "Quote lacks price or momentum" });
      continue;
    }
    quotes.push({
      ...target,
      rawPrice,
      normalizedPrice,
      momentum: target.invert ? -rawMomentum : rawMomentum,
      providerDatetime: raw.datetime || raw.timestamp || null
    });
  }
  return { quotes, errors };
}

export function isMaterialScoreChange(previousScore, currentScore, options = {}) {
  const config = { ...DEFAULTS, ...options };
  if (!Number.isFinite(previousScore) || !Number.isFinite(currentScore)) {
    return { material: false, scoreChangePoints: null, scoreChangePercent: null };
  }
  const scoreChangePoints = round(currentScore - previousScore, 2);
  const scoreChangePercent = round((scoreChangePoints / Math.max(Math.abs(previousScore), 1)) * 100, 2);
  return {
    material: Math.abs(scoreChangePercent) > config.thresholdPercent && Math.abs(scoreChangePoints) >= config.minScorePoints,
    scoreChangePoints,
    scoreChangePercent
  };
}

export function calculateTailRisk(history, quote, timestamp, options = {}) {
  const config = { ...DEFAULTS, ...options };
  const cleanHistory = Array.isArray(history)
    ? history.filter(item => Number.isFinite(item?.price) && Number.isFinite(item?.momentum))
    : [];
  const previous = cleanHistory.at(-1) || null;
  const blockReturn = previous
    ? round(((quote.normalizedPrice / previous.price) - 1) * 100)
    : null;
  const historicalReturns = cleanHistory.slice(1).map((item, index) => {
    const prior = cleanHistory[index];
    return ((item.price / prior.price) - 1) * 100;
  }).filter(Number.isFinite);
  const historicalMomentum = cleanHistory.map(item => item.momentum).filter(Number.isFinite);
  const enoughHistory = historicalReturns.length >= config.minSamples && historicalMomentum.length >= config.minSamples;
  const priceZScore = enoughHistory ? zScore(blockReturn, historicalReturns, config.maxAbsZ) : null;
  const momentumZScore = enoughHistory ? zScore(quote.momentum, historicalMomentum, config.maxAbsZ) : null;
  const compositeZ = Number.isFinite(priceZScore) && Number.isFinite(momentumZScore)
    ? round((config.priceWeight * priceZScore) + (config.momentumWeight * momentumZScore))
    : null;
  const tailRiskScore = compositeZ === null ? null : round(clamp(50 + (config.zScale * compositeZ), 0, 100), 2);
  const change = isMaterialScoreChange(previous?.tailRiskScore, tailRiskScore, config);
  const observation = {
    timestamp,
    price: round(quote.normalizedPrice, 8),
    momentum: round(quote.momentum),
    blockReturn,
    priceZScore,
    momentumZScore,
    compositeZ,
    tailRiskScore,
    providerDatetime: quote.providerDatetime
  };
  const nextHistory = [...cleanHistory, observation].slice(-config.historyLimit);
  return { observation, nextHistory, enoughHistory, ...change };
}

export function buildAlertMessage(target, scoreChangePoints) {
  const signed = `${scoreChangePoints >= 0 ? "+" : ""}${Number(scoreChangePoints).toFixed(2)}`;
  return `[ALERTA AGCI] Anomalía detectada en ${target.name} (${target.code}). Cambio de Score: ${signed} puntos. Revisar panel corporativo`;
}

export function configuredChannels(env) {
  const requested = String(env.TAIL_RISK_CHANNELS || "").split(",").map(value => value.trim().toLowerCase()).filter(Boolean);
  return [...new Set(requested)].filter(channel => {
    if (channel === "telegram") return Boolean(env.TELEGRAM_BOT_TOKEN && env.TELEGRAM_CHAT_ID);
    if (channel === "discord") return Boolean(env.DISCORD_WEBHOOK_URL);
    if (channel === "slack") return Boolean(env.SLACK_WEBHOOK_URL);
    return false;
  });
}

export function buildWebhookRequest(channel, env, message) {
  if (channel === "telegram") {
    return {
      url: `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: env.TELEGRAM_CHAT_ID, text: message, disable_web_page_preview: true })
      }
    };
  }
  if (channel === "discord") {
    return {
      url: env.DISCORD_WEBHOOK_URL,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ content: message, allowed_mentions: { parse: [] } })
      }
    };
  }
  if (channel === "slack") {
    return {
      url: env.SLACK_WEBHOOK_URL,
      init: {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: message })
      }
    };
  }
  throw new Error(`Unsupported webhook channel: ${channel}`);
}

export const TAIL_RISK_DEFAULTS = DEFAULTS;
