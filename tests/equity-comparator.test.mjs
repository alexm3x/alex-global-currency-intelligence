import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import worker, { buildCompanySnapshot, normalizeSymbols, peerCandidates, scoreAnalysis } from "../cloudflare/agci-equity-fundamentals.js";

function duration(concept, values, unit = "USD") {
  return { label: concept, units: { [unit]: values.map(([fy, val]) => ({ fy, fp: "FY", form: "10-K", start: `${fy}-01-01`, end: `${fy}-12-31`, filed: `${fy + 1}-02-15`, val })) } };
}

function instant(concept, values, unit = "USD", taxonomy = "us-gaap") {
  return { taxonomy, node: { label: concept, units: { [unit]: values.map(([fy, val]) => ({ fy, fp: "FY", form: "10-K", end: `${fy}-12-31`, filed: `${fy + 1}-02-15`, val })) } } };
}

function fixture(name = "Microsoft Corporation", multiplier = 1) {
  const instantFacts = [
    ["Assets", [[2025, 500], [2024, 450]]],
    ["Liabilities", [[2025, 220], [2024, 210]]],
    ["StockholdersEquity", [[2025, 280], [2024, 240]]],
    ["AssetsCurrent", [[2025, 180], [2024, 160]]],
    ["LiabilitiesCurrent", [[2025, 100], [2024, 95]]],
    ["CashAndCashEquivalentsAtCarryingValue", [[2025, 80], [2024, 70]]],
    ["LongTermDebtCurrent", [[2025, 10], [2024, 10]]],
    ["LongTermDebtNoncurrent", [[2025, 50], [2024, 55]]]
  ];
  const usGaap = {
    RevenueFromContractWithCustomerExcludingAssessedTax: duration("Revenue", [[2025, 300 * multiplier], [2024, 270 * multiplier], [2023, 240 * multiplier], [2022, 210 * multiplier]]),
    NetIncomeLoss: duration("Net income", [[2025, 75 * multiplier], [2024, 65 * multiplier], [2023, 55 * multiplier], [2022, 48 * multiplier]]),
    OperatingIncomeLoss: duration("Operating income", [[2025, 95 * multiplier], [2024, 82 * multiplier]]),
    GrossProfit: duration("Gross profit", [[2025, 205 * multiplier], [2024, 180 * multiplier]]),
    NetCashProvidedByUsedInOperatingActivities: duration("OCF", [[2025, 100 * multiplier], [2024, 90 * multiplier]]),
    PaymentsToAcquirePropertyPlantAndEquipment: duration("Capex", [[2025, 25 * multiplier], [2024, 22 * multiplier]]),
    DepreciationDepletionAndAmortization: duration("D&A", [[2025, 15 * multiplier], [2024, 14 * multiplier]]),
    InterestExpenseNonOperating: duration("Interest", [[2025, 4 * multiplier], [2024, 4 * multiplier]]),
    IncomeTaxExpenseBenefit: duration("Tax", [[2025, 18 * multiplier], [2024, 16 * multiplier]]),
    IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest: duration("Pretax", [[2025, 93 * multiplier], [2024, 81 * multiplier]]),
    EarningsPerShareDiluted: duration("EPS", [[2025, 10 * multiplier], [2024, 8.5 * multiplier], [2023, 7.2 * multiplier], [2022, 6.5 * multiplier]], "USD/shares"),
    PaymentsOfDividendsCommonStock: duration("Dividends", [[2025, 20 * multiplier], [2024, 18 * multiplier]])
  };
  for (const [concept, values] of instantFacts) usGaap[concept] = instant(concept, values).node;
  return {
    entityName: name,
    facts: {
      "us-gaap": usGaap,
      dei: { EntityCommonStockSharesOutstanding: instant("Shares", [[2025, 7.5], [2024, 7.4]], "shares", "dei").node }
    }
  };
}

function finalized(ticker, price, multiplier = 1) {
  const snapshot = buildCompanySnapshot(ticker, { cik: "0000000001", title: ticker, exchange: "NASDAQ" }, fixture(ticker, multiplier));
  const raw = snapshot.raw;
  const latest = key => raw[key]?.[0]?.val ?? null;
  const revenue = latest("revenue");
  const netIncome = latest("netIncome");
  const operatingIncome = latest("operatingIncome");
  const fcf = latest("operatingCashFlow") - latest("capex");
  const shares = latest("shares");
  const marketCap = price * shares;
  const debt = latest("debtCurrent") + latest("debtNoncurrent");
  const cash = latest("cash");
  const ebitda = operatingIncome + latest("depreciation");
  return {
    ticker, companyName: ticker, sector: snapshot.sector, industry: snapshot.industry, price, priceChangePercent: 1,
    marketCap, dataCoverage: 90, isStale: false,
    fundamentals: { revenue, netIncome, operatingIncome, freeCashFlow: fcf, ebitda },
    ratios: {
      peTTM: price / latest("eps"), priceToSales: marketCap / revenue, evEbitda: (marketCap + debt - cash) / ebitda,
      priceToFCF: marketCap / fcf, fcfYield: fcf / marketCap, grossMargin: latest("grossProfit") / revenue,
      operatingMargin: operatingIncome / revenue, roe: netIncome / latest("equity"), roic: .25,
      cashConversion: fcf / netIncome, netDebtToEbitda: (debt - cash) / ebitda, debtToEquity: debt / latest("equity"),
      currentRatio: latest("currentAssets") / latest("currentLiabilities"), interestCoverage: operatingIncome / latest("interestExpense")
    },
    growth: { revenueYoY: revenue / raw.revenue[1].val - 1, revenueCagr3Y: .12, epsYoY: .15, fcfYoY: .10 }
  };
}

test("normalizes, deduplicates and caps a manual stock list", () => {
  assert.deepEqual(normalizeSymbols(" msft,GOOGL;msft invalid/$ JPM ", 10), ["MSFT", "GOOGL", "JPM"]);
  assert.equal(normalizeSymbols(Array.from({ length: 15 }, (_, index) => `A${index}`).join(","), 10).length, 10);
});

test("selects true curated industry peers rather than a broad sector", () => {
  assert.deepEqual(peerCandidates("MSFT", ["MSFT", "ORCL", "JPM"]).slice(0, 3), ["ORCL", "CRM", "ADBE"]);
  assert.ok(!peerCandidates("MSFT").includes("JPM"));
});

test("extracts annual SEC facts without substituting missing forward ratios", () => {
  const company = buildCompanySnapshot("MSFT", { cik: "0000789019", title: "Microsoft", exchange: "NASDAQ" }, fixture());
  assert.equal(company.raw.revenue[0].val, 300);
  assert.equal(company.raw.revenue.length, 4);
  assert.equal(company.raw.shares[0].val, 7.5);
  assert.equal(company.fiscalPeriodEnd, "2025-12-31");
});

test("scores valuation against peers and preserves an explainable preferred comparable", () => {
  const company = finalized("MSFT", 100);
  const peers = [finalized("ORCL", 70, .9), finalized("CRM", 130, 1.05), finalized("ADBE", 90, .95)];
  const analysis = scoreAnalysis(company, peers);
  assert.equal(analysis.ticker, "MSFT");
  assert.equal(analysis.comparables.length, 3);
  assert.ok(Number.isFinite(analysis.score.total));
  assert.ok(analysis.preferredComparable?.ticker);
  assert.match(analysis.conclusion, /EV\/EBITDA|no dispone/);
});

test("health endpoint exposes contract and provider readiness", async () => {
  const response = await worker.fetch(new Request("https://equities.example/health"), { EQUITY_CACHE: {} }, { waitUntil() {} });
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.contractVersion, "1.0.0");
  assert.equal(body.priceProvider, "not-configured");
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "*");
});

test("frontend persists ten tickers and communicates missing/stale data honestly", async () => {
  const source = await readFile(new URL("../equity-comparator.js", import.meta.url), "utf8");
  assert.match(source, /MAX_SYMBOLS = 10/);
  assert.match(source, /localStorage\.setItem/);
  assert.match(source, /Datos en caché \(Servidor origen no disponible\)/);
  assert.match(source, /P\/E Forward, PEG y estimaciones permanecen como N\/A/);
  assert.doesNotMatch(source, /Math\.random\(/);
});
