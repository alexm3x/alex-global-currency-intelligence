# AGCI Greed + Valuation Methodology

Version: **AGCI-GV-v1.1**

## Objective

AGCI Greed + Valuation separates market psychology from fundamental valuation. Neither score is an automatic BUY or SELL signal. The decision layer combines psychology, valuation, quality, regime and margin of safety.

## Greed Score

Scale: 0–100.

- 0–20: Extreme Fear
- 21–40: Fear
- 41–59: Neutral
- 60–79: Greed
- 80–100: Extreme Greed

Configured weights remain:

- Market momentum 15%
- Market breadth 15%
- VIX / volatility 15%
- Put/Call & options 10%
- Credit spreads 10%
- AAII sentiment 10%
- Institutional positioning / NAAIM 10%
- ETF / fund flows 5%
- Speculative activity 5%
- News sentiment 5%

A Greed score is not published unless at least 60% of configured weight has verified normalized observations. Missing values are excluded from the denominator and are never converted to zero or neutral.

### v1.1 live component definitions

The first production data engine activates five auditable components, representing 65% of configured weight:

- **Market momentum (15%)**: S&P 500 short- and medium-horizon returns from Federal Reserve/FRED series `SP500`.
- **Market breadth proxy (15%)**: cross-index participation proxy using S&P 500, Dow Jones Industrial Average and Nasdaq Composite. The proxy evaluates participation above 50-day and 100-day moving averages plus positive 20-day momentum. It is explicitly labelled a proxy and must not be represented as exchange-level advance/decline breadth.
- **VIX / volatility (15%)**: inverse one-year percentile of the official Cboe VIX observation already maintained by AGCI structural data.
- **Options term structure (10%)**: VIX relative to Cboe VIX3M. Contango is interpreted as greater complacency/greed and backwardation as greater stress/fear. This is an options-market term-structure measure, not a put/call ratio.
- **Credit spreads (10%)**: inverse trailing percentile of ICE BofA US High Yield OAS distributed via Federal Reserve/FRED.

AAII, NAAIM, flows, speculative activity and news sentiment remain unavailable until an authorized, reproducible source is connected. Their absence reduces coverage rather than creating artificial neutral values.

## Valuation Score

Scale: 0–100, where higher means more expensive.

- 0–20: Deep Value
- 21–40: Attractive
- 41–60: Fair Value
- 61–80: Expensive
- 81–100: Extreme Valuation

The configured market framework includes forward P/E, trailing P/E, CAPE, earnings-yield spread, FCF yield, Price/Sales, Equity Risk Premium and Price/Book where relevant. Valuation requires at least 55% weighted coverage before an aggregate score is published.

**v1.1 governance rule:** the aggregate Valuation score remains `N/D` until authorized and sufficiently broad market-level valuation observations satisfy the 55% threshold. Greed availability must never cause Valuation to be inferred.

Normalization must use historical distributions or defensible peer/sector distributions. Raw ratios are not averaged directly.

## Data Governance

Primary and authorized sources take precedence: Cboe, Federal Reserve/FRED, U.S. Treasury, SEC, AAII and NAAIM where licensed/authorized, plus existing AGCI market-data services. External composite indices may be used only as benchmarks.

Every component preserves source, `asOf`, raw value, normalized score, freshness and confidence. Stale data is labelled. API failure returns Unavailable or preserves the last valid upstream structural observation when that upstream contract explicitly indicates degraded/cached data; it never becomes zero.

The live pipeline runs every six hours after the structural-data cycle and stores daily observations in `data/greed-valuation-history.json`.

## Confidence

Confidence combines coverage, source quality, freshness and component-level confidence. The dashboard exposes confidence independently from the score. A high Greed score with low confidence must not be interpreted the same as a high-confidence reading.

## Market Regime

v1.1 derives a deterministic market regime from S&P 500 position versus its 200-day moving average, 20-day/125-day momentum and the VIX environment. Initial labels are Bear Market, Correction, Mid Bull, Late Bull and Recovery. Regime is contextual and does not alter the underlying component observations.

## Greed × Valuation Matrix

The matrix is an interpretation layer, not a trading rule.

- Extreme Fear + Attractive/Deep Value: Potential Opportunity
- Fear + Fair/Attractive: Accumulation Zone
- Neutral + Fair Value: Hold / Analyze
- Greed + Expensive: Wait / Price Discipline
- Extreme Greed + Extreme Valuation: Capital Preservation / Do Not Chase

When Valuation is unavailable, the two-dimensional matrix must remain `INSUFFICIENT_DATA` even if Greed is live.

## Stock-Level Integration

Ticker-level analysis uses sector-aware valuation. Banks, REITs, software, industrials and utilities must not share an identical valuation formula. Greed acts as a timing/behavioral overlay; fair value and buy zones remain fundamentally anchored.

Opportunity Score considers quality, value attractiveness, growth, momentum, risk safety, margin of safety, sentiment discipline, regime and catalysts. It is withheld when minimum coverage is not satisfied.

## Divergences

Key deterministic events include:

- Price up + Greed up + Breadth down → NARROW_RALLY
- Price down + Fear rising + fundamentals stable → POTENTIAL_OPPORTUNITY
- Price down + valuation cheaper + fundamentals deteriorating → VALUE_TRAP_RISK
- Greed >80 + Valuation >80 → EUPHORIA_RISK

## Daily Briefing and Morning Intelligence

The Daily Strategic Briefing consumes the latest Greed, Valuation, Regime and Confidence state. Editorial changes should be considered material when Greed or Valuation moves approximately 5 points, crosses a major band, a regime changes or a new divergence is detected.

Morning Intelligence should verbalize the indicator only when material. The score must never generate prose that overrules source evidence or the broader AGCI investment framework.

## Versioning

Any change to weights, source definitions, normalization formulas or classification bands increments `methodology_version`. Historical series retains the methodology version under which observations were produced.

## Backtesting

Forward-return analytics must avoid look-ahead bias, survivorship bias and overfitting. Report sample size, median forward return, probability positive and maximum drawdown for 1M, 3M, 6M, 12M and 24M horizons only when sample size is sufficient.
