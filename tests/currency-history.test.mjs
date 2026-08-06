import test from "node:test";
import assert from "node:assert/strict";

await import("../currency-history-core.js");
const { buildCompositeHistory, normalizeLiveRate } = globalThis.AGCICurrencyHistoryCore;

test("normalizes direct and inverse USD quotes", () => {
  assert.equal(normalizeLiveRate({ code: "JPY", marketSymbol: "USD/JPY", marketPrice: 157.5 }), 157.5);
  assert.equal(normalizeLiveRate({ code: "EUR", marketSymbol: "EUR/USD", marketPrice: 1.25 }), .8);
  assert.equal(normalizeLiveRate({ code: "MXN", marketSymbol: "EUR/USD", marketPrice: 1.25 }), null);
});

test("reconstructed composite closes at the current AGCI score", () => {
  const currency = { score: 82, momentum: 71 };
  const points = buildCompositeHistory(currency, [
    { date: "2026-07-06", value: 162.34 },
    { date: "2026-07-21", value: 162.74 },
    { date: "2026-08-05", value: 157.59 }
  ]);
  assert.equal(points.at(-1).score, 82);
  assert.ok(points.every(point => point.score >= 0 && point.score <= 100));
  assert.notEqual(points[0].score, points.at(-1).score);
});
