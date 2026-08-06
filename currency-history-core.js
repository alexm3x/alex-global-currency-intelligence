((globalScope) => {
  "use strict";

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const round = (value, digits = 2) => Number(value.toFixed(digits));

  function normalizeLiveRate(currency) {
    const price = Number(currency.marketPrice);
    const symbol = currency.marketSymbol || "";
    if (!Number.isFinite(price) || !symbol.includes("/")) return null;
    if (symbol === `USD/${currency.code}`) return price;
    if (symbol === `${currency.code}/USD` && price !== 0) return 1 / price;
    return null;
  }

  function buildCompositeHistory(currency, fxPoints) {
    const firstRate = fxPoints[0].value;
    const finalRate = fxPoints.at(-1).value;
    const finalPerformance = ((firstRate / finalRate) - 1) * 100;
    return fxPoints.map(point => {
      const currencyPerformance = ((firstRate / point.value) - 1) * 100;
      const reconstructedMomentum = clamp(currency.momentum + (currencyPerformance - finalPerformance) * 5, 0, 100);
      const score = clamp(currency.score + .25 * (reconstructedMomentum - currency.momentum), 0, 100);
      return { ...point, score: round(score, 1) };
    });
  }

  globalScope.AGCICurrencyHistoryCore = { buildCompositeHistory, normalizeLiveRate, round };
})(globalThis);
