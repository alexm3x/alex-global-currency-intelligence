# AGCI Greed + Valuation Methodology

Version: **AGCI-GV-v1.0**

## Objective

AGCI Greed + Valuation separates market psychology from fundamental valuation. Neither score is an automatic BUY or SELL signal. The decision layer combines psychology, valuation, quality, regime and margin of safety.

## Greed Score

Scale: 0–100.

- 0–20: Extreme Fear
- 21–40: Fear
- 41–59: Neutral
- 60–79: Greed
- 80–100: Extreme Greed

Initial weights:

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

## Valuation Score

Scale: 0–100, where higher means more expensive.

- 0–20: Deep Value
- 21–40: Attractive
- 41–60: Fair Value
- 61–80: Expensive
- 81–100: Extreme Valuation

Initial market framework includes forward P/E, trailing P/E, CAPE, earnings-yield spread, FCF yield, Price/Sales, Equity Risk Premium and Price/Book where relevant. Valuation requires at least 55% weighted coverage before an aggregate score is published.

Normalization must use historical distributions or defensible peer/sector distributions. Raw ratios are not averaged directly.

## Data Governance

Primary and authorized sources take precedence: CBOE, Federal Reserve/FRED, U.S. Treasury, SEC, AAII and NAAIM where licensed/authorized, plus existing AGCI market-data services. External composite indices may be used only as benchmarks.

Every component should preserve source, timestamp, raw value, normalized score, freshness and confidence. Stale data must be labelled. API failure must return Unavailable or Cached, never zero.

## Confidence

Confidence combines coverage, source quality, freshness and component-level confidence. The dashboard exposes confidence independently from the score.

## Greed × Valuation Matrix

The matrix is an interpretation layer, not a trading rule.

- Extreme Fear + Attractive/Deep Value: Potential Opportunity
- Fear + Fair/Attractive: Accumulation Zone
- Neutral + Fair Value: Hold / Analyze
- Greed + Expensive: Wait / Price Discipline
- Extreme Greed + Extreme Valuation: Capital Preservation / Do Not Chase

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

The Daily Strategic Briefing shows the latest Greed, Valuation, Regime and Confidence state. Editorial changes should be considered material when Greed or Valuation moves approximately 5 points, crosses a major band, a regime changes or a new divergence is detected.

Morning Intelligence should verbalize the indicator only when material. The score must never generate prose that overrules source evidence or the broader AGCI investment framework.

## Versioning

Any change to weights, source definitions, normalization formulas or classification bands increments `methodology_version`. Historical series must retain the methodology version under which each observation was produced.

## Backtesting

Forward-return analytics must avoid look-ahead bias, survivorship bias and overfitting. Report sample size, median forward return, probability positive and maximum drawdown for 1M, 3M, 6M, 12M and 24M horizons only when sample size is sufficient.
