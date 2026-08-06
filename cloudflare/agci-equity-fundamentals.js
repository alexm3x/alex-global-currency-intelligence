const CONTRACT_VERSION = "1.0.0";
const SEC_TICKERS_URL = "https://www.sec.gov/files/company_tickers.json";
const SEC_FACTS_BASE = "https://data.sec.gov/api/xbrl/companyfacts";
const TWELVE_QUOTE_URL = "https://api.twelvedata.com/quote";
const SEC_CACHE_MS = 6 * 60 * 60 * 1000;
const TICKER_CACHE_MS = 24 * 60 * 60 * 1000;
const QUOTE_CACHE_MS = 15 * 60 * 1000;
const QUOTE_BATCH_LIMIT = 8;
const MAX_SELECTED = 10;
const MAX_COMPANIES = 30;
const FETCH_TIMEOUT_MS = 12_000;

export const PEER_GROUPS = [
  { sector: "Technology", industry: "Enterprise software", tickers: ["MSFT", "ORCL", "CRM", "ADBE", "NOW", "INTU"] },
  { sector: "Technology", industry: "Semiconductors", tickers: ["NVDA", "AVGO", "AMD", "QCOM", "TXN", "MU", "INTC"] },
  { sector: "Communication Services", industry: "Digital platforms", tickers: ["GOOGL", "META", "SNAP", "PINS"] },
  { sector: "Consumer Discretionary", industry: "Digital commerce", tickers: ["AMZN", "EBAY", "ETSY", "CHWY"] },
  { sector: "Consumer Discretionary", industry: "Automobiles", tickers: ["TSLA", "GM", "F", "RIVN"] },
  { sector: "Financials", industry: "Diversified banks", tickers: ["JPM", "BAC", "C", "WFC", "GS", "MS"] },
  { sector: "Financials", industry: "Payment networks", tickers: ["V", "MA", "AXP", "PYPL", "COF"] },
  { sector: "Health Care", industry: "Large-cap pharmaceuticals", tickers: ["LLY", "JNJ", "MRK", "PFE", "ABBV", "BMY"] },
  { sector: "Health Care", industry: "Managed care", tickers: ["UNH", "ELV", "CI", "HUM", "CNC"] },
  { sector: "Health Care", industry: "Medical devices", tickers: ["ISRG", "ABT", "MDT", "SYK", "BSX"] },
  { sector: "Industrials", industry: "Aerospace and defense", tickers: ["GE", "RTX", "LMT", "NOC", "GD", "LHX"] },
  { sector: "Industrials", industry: "Machinery and electrification", tickers: ["CAT", "DE", "ETN", "EMR", "PH", "ROK"] },
  { sector: "Consumer Staples", industry: "General merchandise retail", tickers: ["COST", "WMT", "TGT", "BJ"] },
  { sector: "Consumer Discretionary", industry: "Home improvement retail", tickers: ["HD", "LOW", "TSCO", "FND"] },
  { sector: "Energy", industry: "Integrated energy", tickers: ["XOM", "CVX", "COP", "OXY", "EOG"] },
  { sector: "Communication Services", industry: "Telecommunications", tickers: ["TMUS", "VZ", "T", "CHTR"] }
];

const CONCEPTS = {
  revenue: ["RevenueFromContractWithCustomerExcludingAssessedTax", "Revenues", "SalesRevenueNet"],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  operatingIncome: ["OperatingIncomeLoss"],
  grossProfit: ["GrossProfit"],
  assets: ["Assets"],
  liabilities: ["Liabilities"],
  equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  currentAssets: ["AssetsCurrent"],
  currentLiabilities: ["LiabilitiesCurrent"],
  cash: ["CashAndCashEquivalentsAtCarryingValue", "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents"],
  debt: ["LongTermDebtAndFinanceLeaseObligationsCurrent", "LongTermDebtCurrent"],
  debtNoncurrent: ["LongTermDebtAndFinanceLeaseObligationsNoncurrent", "LongTermDebtNoncurrent", "LongTermDebt"],
  operatingCashFlow: ["NetCashProvidedByUsedInOperatingActivities"],
  capex: ["PaymentsToAcquirePropertyPlantAndEquipment", "PaymentsForAdditionsToPropertyPlantAndEquipment"],
  depreciation: ["DepreciationDepletionAndAmortization", "DepreciationDepletionAndAmortizationPropertyPlantAndEquipment"],
  interestExpense: ["InterestExpenseNonOperating", "InterestAndDebtExpense"],
  incomeTax: ["IncomeTaxExpenseBenefit"],
  pretaxIncome: ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest", "IncomeLossFromContinuingOperationsBeforeIncomeTaxesMinorityInterestAndIncomeLossFromEquityMethodInvestments"],
  eps: ["EarningsPerShareDiluted", "EarningsPerShareBasicAndDiluted"],
  dividends: ["PaymentsOfDividendsCommonStock", "PaymentsOfOrdinaryDividends"],
  shares: ["EntityCommonStockSharesOutstanding", "CommonStockSharesOutstanding"]
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return cors(new Response(null, { status: 204 }));
    if (request.method !== "GET") return json({ error: "Método no permitido" }, 405);

    try {
      if (url.pathname === "/" || url.pathname === "/health") {
        return json({
          service: "agci-equity-fundamentals",
          status: "ok",
          contractVersion: CONTRACT_VERSION,
          coverage: "US SEC filers",
          priceProvider: env.TWELVE_DATA_API_KEY ? "Twelve Data" : "not-configured",
          cache: Boolean(env.EQUITY_CACHE),
          timestamp: new Date().toISOString()
        });
      }

      if (url.pathname === "/symbols") {
        const query = String(url.searchParams.get("q") || "").trim().toUpperCase().slice(0, 80);
        if (!query) return json({ query, results: [] });
        const tickers = await loadTickerMap(env, ctx);
        const results = Object.entries(tickers.value)
          .filter(([ticker, item]) => ticker.includes(query) || item.title.toUpperCase().includes(query))
          .slice(0, 12)
          .map(([ticker, item]) => ({ ticker, companyName: item.title, exchange: item.exchange || null, cik: item.cik }));
        return json({ query, results, isStale: tickers.isStale, updatedAt: tickers.updatedAt });
      }

      if (url.pathname === "/compare") {
        const symbols = normalizeSymbols(url.searchParams.get("symbols"), MAX_SELECTED);
        if (!symbols.length) return json({ error: "Incluya entre 1 y 10 símbolos estadounidenses válidos." }, 400);
        const payload = await buildComparison(symbols, env, ctx);
        return json(payload, 200, payload.isStale ? 0 : 300, { "X-AGCI-Cache": payload.isStale ? "STALE" : "FRESH" });
      }

      return json({ error: "Ruta no encontrada" }, 404);
    } catch (error) {
      logError("equity-request-failed", error, { path: url.pathname });
      return json({
        error: "No fue posible completar el análisis fundamental",
        detail: error instanceof Error ? error.message : "Error desconocido",
        contractVersion: CONTRACT_VERSION
      }, 502);
    }
  }
};

async function buildComparison(selected, env, ctx) {
  const tickerMapResult = await loadTickerMap(env, ctx);
  const knownSelected = selected.filter(symbol => tickerMapResult.value[symbol]);
  const invalidSymbols = selected.filter(symbol => !tickerMapResult.value[symbol]);
  if (!knownSelected.length) throw new Error("Ninguno de los símbolos está registrado por la SEC");

  const peerMap = Object.fromEntries(knownSelected.map(symbol => [symbol, peerCandidates(symbol, knownSelected)]));
  const requested = [...new Set(knownSelected.flatMap(symbol => [symbol, ...peerMap[symbol]]))].slice(0, MAX_COMPANIES);
  const loaded = await mapLimit(requested, 3, async symbol => {
    const identity = tickerMapResult.value[symbol];
    if (!identity) return { symbol, error: "Símbolo no registrado por la SEC" };
    try {
      const result = await loadCompanySnapshot(symbol, identity, env, ctx);
      return { symbol, ...result };
    } catch (error) {
      return { symbol, error: error instanceof Error ? error.message : "Error SEC" };
    }
  });

  const quoteResult = await loadQuotes(requested, env, ctx);
  const companies = {};
  const errors = [];
  for (const item of loaded) {
    if (item.error || !item.value) {
      errors.push({ ticker: item.symbol, error: item.error || "Información no disponible" });
      continue;
    }
    companies[item.symbol] = finalizeCompany(item.value, quoteResult.quotes[item.symbol] || null, {
      isStale: item.isStale || quoteResult.staleSymbols.includes(item.symbol),
      updatedAt: item.updatedAt,
      priceUpdatedAt: quoteResult.quotes[item.symbol]?.updatedAt || null
    });
  }

  const analyses = knownSelected.map(symbol => {
    const company = companies[symbol];
    if (!company) return { ticker: symbol, classification: "Información insuficiente", error: "Fundamentales no disponibles" };
    const peers = peerMap[symbol].map(ticker => companies[ticker]).filter(Boolean);
    return scoreAnalysis(company, peers);
  });

  const staleCompanies = Object.values(companies).filter(company => company.isStale).map(company => company.ticker);
  const isStale = tickerMapResult.isStale || staleCompanies.length > 0;
  const successfulDates = Object.values(companies).map(company => company.lastSuccessfulUpdate).filter(Boolean).sort();
  const coverage = analyses.length ? analyses.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / analyses.length : 0;

  return {
    contractVersion: CONTRACT_VERSION,
    requestedSymbols: selected,
    analyzedSymbols: analyses.filter(item => !item.error).map(item => item.ticker),
    invalidSymbols,
    generatedAt: new Date().toISOString(),
    lastSuccessfulUpdate: successfulDates.at(-1) || null,
    isStale,
    staleSymbols: staleCompanies,
    dataQuality: coverage >= 75 && !errors.length ? "complete" : coverage >= 40 ? "partial" : "limited",
    methodology: {
      statementPeriod: "Latest available annual 10-K; no forward estimates",
      scoreWeights: { valuation: 30, growth: 20, quality: 20, financialStrength: 20, momentum: 10 },
      peerUniverse: "Curated US industry groups; editable and non-exhaustive",
      priceCapacity: `Up to ${QUOTE_BATCH_LIMIT} uncached symbols per refresh on the current free-plan guardrail`
    },
    sources: [
      { provider: "SEC EDGAR", dataset: "Company Facts API", url: "https://data.sec.gov/api/xbrl/companyfacts/", frequency: "filing-driven" },
      { provider: "Twelve Data", dataset: "Quote", url: "https://api.twelvedata.com/quote", frequency: "15-minute cache", configured: Boolean(env.TWELVE_DATA_API_KEY) }
    ],
    analyses,
    errors
  };
}

export function normalizeSymbols(input, limit = MAX_SELECTED) {
  return [...new Set(String(input || "")
    .split(/[\s,;]+/)
    .map(value => value.trim().toUpperCase())
    .filter(value => /^[A-Z][A-Z0-9.-]{0,9}$/.test(value)))]
    .slice(0, limit);
}

export function peerCandidates(symbol, selected = []) {
  const group = PEER_GROUPS.find(item => item.tickers.includes(symbol));
  if (!group) return [];
  const selectedPeers = selected.filter(item => item !== symbol && group.tickers.includes(item));
  const curated = group.tickers.filter(item => item !== symbol && !selectedPeers.includes(item));
  return [...selectedPeers, ...curated].slice(0, 5);
}

function peerMetadata(symbol) {
  return PEER_GROUPS.find(item => item.tickers.includes(symbol)) || { sector: "Unclassified", industry: "SEC registrant", tickers: [] };
}

async function loadTickerMap(env, ctx) {
  return swr(env, ctx, "sec:tickers:v2", TICKER_CACHE_MS, async () => {
    const response = await fetchWithTimeout(SEC_TICKERS_URL, secHeaders(env));
    if (!response.ok) throw new Error(`SEC ticker map HTTP ${response.status}`);
    const raw = await response.json();
    const map = {};
    for (const item of Object.values(raw || {})) {
      const ticker = String(item?.ticker || "").toUpperCase();
      if (!ticker) continue;
      map[ticker] = {
        cik: String(item.cik_str).padStart(10, "0"),
        title: String(item.title || ticker),
        exchange: item.exchange || null
      };
    }
    if (!Object.keys(map).length) throw new Error("SEC ticker map vacío");
    return map;
  });
}

async function loadCompanySnapshot(symbol, identity, env, ctx) {
  return swr(env, ctx, `sec:company:${identity.cik}:v2`, SEC_CACHE_MS, async () => {
    const response = await fetchWithTimeout(`${SEC_FACTS_BASE}/CIK${identity.cik}.json`, secHeaders(env));
    if (!response.ok) throw new Error(`SEC company facts HTTP ${response.status}`);
    const facts = await response.json();
    return buildCompanySnapshot(symbol, identity, facts);
  });
}

export function buildCompanySnapshot(symbol, identity, payload) {
  const facts = payload?.facts || {};
  const annual = key => annualSeries(facts, CONCEPTS[key]);
  const instant = key => instantSeries(facts, CONCEPTS[key]);
  const revenue = annual("revenue");
  const netIncome = annual("netIncome");
  const operatingIncome = annual("operatingIncome");
  const grossProfit = annual("grossProfit");
  const operatingCashFlow = annual("operatingCashFlow");
  const capex = annual("capex");
  const depreciation = annual("depreciation");
  const interestExpense = annual("interestExpense");
  const incomeTax = annual("incomeTax");
  const pretaxIncome = annual("pretaxIncome");
  const eps = annual("eps", "USD/shares");
  const dividends = annual("dividends");
  const assets = instant("assets");
  const liabilities = instant("liabilities");
  const equity = instant("equity");
  const currentAssets = instant("currentAssets");
  const currentLiabilities = instant("currentLiabilities");
  const cash = instant("cash");
  const debtCurrent = instant("debt");
  const debtNoncurrent = instant("debtNoncurrent");
  const shares = instant("shares", "shares");
  const group = peerMetadata(symbol);
  const latestEnd = [revenue[0]?.end, assets[0]?.end, equity[0]?.end].filter(Boolean).sort().at(-1) || null;

  return {
    ticker: symbol,
    companyName: payload?.entityName || identity.title,
    cik: identity.cik,
    exchange: identity.exchange,
    currency: "USD",
    sector: group.sector,
    industry: group.industry,
    statementPeriod: "annual",
    fiscalPeriodEnd: latestEnd,
    raw: {
      revenue, netIncome, operatingIncome, grossProfit, operatingCashFlow, capex, depreciation,
      interestExpense, incomeTax, pretaxIncome, eps, dividends, assets, liabilities, equity,
      currentAssets, currentLiabilities, cash, debtCurrent, debtNoncurrent, shares
    }
  };
}

function annualSeries(facts, concepts, unitHint = "USD") {
  for (const concept of concepts || []) {
    const node = facts?.[concept === "EntityCommonStockSharesOutstanding" ? "dei" : "us-gaap"]?.[concept];
    const units = chooseUnits(node?.units, unitHint);
    if (!units.length) continue;
    const candidates = units
      .filter(item => /^10-K(?:\/A)?$/.test(item.form || "") && item.fp === "FY" && finite(item.val))
      .filter(item => !item.start || durationDays(item.start, item.end) >= 300)
      .sort((a, b) => Date.parse(b.filed || b.end) - Date.parse(a.filed || a.end));
    const byEnd = new Map();
    for (const item of candidates) if (!byEnd.has(item.end)) byEnd.set(item.end, compactFact(item, concept));
    const result = [...byEnd.values()].sort((a, b) => Date.parse(b.end) - Date.parse(a.end)).slice(0, 4);
    if (result.length) return result;
  }
  return [];
}

function instantSeries(facts, concepts, unitHint = "USD") {
  for (const concept of concepts || []) {
    const taxonomy = concept === "EntityCommonStockSharesOutstanding" ? "dei" : "us-gaap";
    const node = facts?.[taxonomy]?.[concept];
    const units = chooseUnits(node?.units, unitHint);
    if (!units.length) continue;
    const candidates = units
      .filter(item => /^10-K(?:\/A)?$/.test(item.form || "") && finite(item.val))
      .sort((a, b) => Date.parse(b.end || b.filed) - Date.parse(a.end || a.filed) || Date.parse(b.filed) - Date.parse(a.filed));
    const byEnd = new Map();
    for (const item of candidates) if (!byEnd.has(item.end)) byEnd.set(item.end, compactFact(item, concept));
    const result = [...byEnd.values()].sort((a, b) => Date.parse(b.end) - Date.parse(a.end)).slice(0, 4);
    if (result.length) return result;
  }
  return [];
}

function chooseUnits(units, hint) {
  if (!units || typeof units !== "object") return [];
  if (Array.isArray(units[hint])) return units[hint];
  const preferred = Object.entries(units).find(([unit]) => unit.toLowerCase() === hint.toLowerCase());
  return preferred ? preferred[1] : Object.values(units).find(Array.isArray) || [];
}

function compactFact(item, concept) {
  return { concept, val: Number(item.val), start: item.start || null, end: item.end || null, filed: item.filed || null, fy: item.fy || null, form: item.form || null };
}

function finalizeCompany(snapshot, quote, freshness) {
  const raw = snapshot.raw;
  const latest = key => raw[key]?.[0]?.val ?? null;
  const prior = key => raw[key]?.[1]?.val ?? null;
  const revenue = latest("revenue");
  const netIncome = latest("netIncome");
  const operatingIncome = latest("operatingIncome");
  const grossProfit = latest("grossProfit");
  const ocf = latest("operatingCashFlow");
  const capex = latest("capex");
  const depreciation = latest("depreciation");
  const assets = latest("assets");
  const equity = latest("equity");
  const cash = latest("cash");
  const debt = sumNullable(latest("debtCurrent"), latest("debtNoncurrent"));
  const shares = latest("shares");
  const eps = latest("eps");
  const ebitda = sumNullable(operatingIncome, depreciation);
  const freeCashFlow = finite(ocf) && finite(capex) ? ocf - Math.abs(capex) : null;
  const price = quote?.price ?? null;
  const marketCap = finite(price) && finite(shares) ? price * shares : null;
  const enterpriseValue = finite(marketCap) ? marketCap + (debt || 0) - (cash || 0) : null;
  const averageEquity = averageNullable(equity, prior("equity"));
  const averageAssets = averageNullable(assets, prior("assets"));
  const taxRate = clamp(safeDivide(latest("incomeTax"), latest("pretaxIncome")), 0, 0.35);
  const investedCapital = finite(equity) ? equity + (debt || 0) - (cash || 0) : null;
  const nopat = finite(operatingIncome) ? operatingIncome * (1 - (taxRate ?? 0.21)) : null;
  const dividend = latest("dividends");

  const ratios = {
    peTTM: positiveDivide(price, eps),
    peForward: null,
    peg: null,
    priceToSales: positiveDivide(marketCap, revenue),
    priceToBook: positiveDivide(marketCap, equity),
    evRevenue: positiveDivide(enterpriseValue, revenue),
    evEbitda: positiveDivide(enterpriseValue, ebitda),
    priceToFCF: positiveDivide(marketCap, freeCashFlow),
    fcfYield: positiveDivide(freeCashFlow, marketCap),
    earningsYield: positiveDivide(netIncome, marketCap),
    dividendYield: positiveDivide(dividend, marketCap),
    grossMargin: safeDivide(grossProfit, revenue),
    operatingMargin: safeDivide(operatingIncome, revenue),
    netMargin: safeDivide(netIncome, revenue),
    roe: safeDivide(netIncome, averageEquity),
    roa: safeDivide(netIncome, averageAssets),
    roic: safeDivide(nopat, investedCapital),
    cashConversion: safeDivide(freeCashFlow, netIncome),
    netDebtToEbitda: safeDivide((debt || 0) - (cash || 0), ebitda),
    debtToEquity: safeDivide(debt, equity),
    currentRatio: safeDivide(latest("currentAssets"), latest("currentLiabilities")),
    interestCoverage: safeDivide(operatingIncome, latest("interestExpense")),
    payoutRatio: safeDivide(dividend, netIncome)
  };

  const growth = {
    revenueYoY: growthRate(revenue, prior("revenue")),
    revenueCagr3Y: cagr(raw.revenue?.[0]?.val, raw.revenue?.[3]?.val, 3),
    epsYoY: growthRate(eps, prior("eps")),
    epsCagr3Y: cagr(raw.eps?.[0]?.val, raw.eps?.[3]?.val, 3),
    fcfYoY: growthRate(freeCashFlow, finite(prior("operatingCashFlow")) && finite(prior("capex")) ? prior("operatingCashFlow") - Math.abs(prior("capex")) : null)
  };

  const keyMetrics = [ratios.peTTM, ratios.priceToSales, ratios.evEbitda, ratios.fcfYield, growth.revenueYoY, growth.epsYoY, ratios.operatingMargin, ratios.roe, ratios.roic, ratios.netDebtToEbitda];
  const coverage = Math.round(keyMetrics.filter(finite).length / keyMetrics.length * 100);
  return {
    ticker: snapshot.ticker,
    companyName: snapshot.companyName,
    cik: snapshot.cik,
    exchange: snapshot.exchange,
    currency: "USD",
    sector: snapshot.sector,
    industry: snapshot.industry,
    price,
    priceChangePercent: quote?.percentChange ?? null,
    marketCap,
    enterpriseValue,
    fiscalPeriodEnd: snapshot.fiscalPeriodEnd,
    statementPeriod: snapshot.statementPeriod,
    fundamentals: { revenue, netIncome, operatingIncome, freeCashFlow, cash, debt, equity, assets, shares, ebitda },
    ratios: cleanNumbers(ratios),
    growth: cleanNumbers(growth),
    dataCoverage: coverage,
    dataQuality: coverage >= 75 ? "complete" : coverage >= 40 ? "partial" : "limited",
    isStale: Boolean(freshness.isStale),
    lastSuccessfulUpdate: freshness.updatedAt,
    priceUpdatedAt: freshness.priceUpdatedAt,
    sources: ["SEC EDGAR Company Facts", ...(quote ? ["Twelve Data Quote"] : [])]
  };
}

export function scoreAnalysis(company, peers) {
  const universe = [company, ...peers];
  const component = (specs) => {
    const scores = specs.map(([path, direction]) => percentileScore(valueAt(company, path), universe.map(item => valueAt(item, path)), direction)).filter(finite);
    return scores.length ? Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length) : null;
  };
  const valuation = component([["ratios.peTTM", "low"], ["ratios.priceToSales", "low"], ["ratios.evEbitda", "low"], ["ratios.priceToFCF", "low"], ["ratios.fcfYield", "high"]]);
  const growth = component([["growth.revenueYoY", "high"], ["growth.revenueCagr3Y", "high"], ["growth.epsYoY", "high"], ["growth.fcfYoY", "high"]]);
  const quality = component([["ratios.grossMargin", "high"], ["ratios.operatingMargin", "high"], ["ratios.roe", "high"], ["ratios.roic", "high"], ["ratios.cashConversion", "high"]]);
  const financialStrength = component([["ratios.netDebtToEbitda", "low"], ["ratios.debtToEquity", "low"], ["ratios.currentRatio", "high"], ["ratios.interestCoverage", "high"]]);
  const momentum = finite(company.priceChangePercent) ? clamp(Math.round(50 + company.priceChangePercent * 5), 0, 100) : 50;
  const filled = { valuation: valuation ?? 50, growth: growth ?? 50, quality: quality ?? 50, financialStrength: financialStrength ?? 50, momentum };
  const rawTotal = filled.valuation * 0.30 + filled.growth * 0.20 + filled.quality * 0.20 + filled.financialStrength * 0.20 + filled.momentum * 0.10;
  const confidence = Math.round((company.dataCoverage * 0.7) + (Math.min(peers.length, 3) / 3 * 30));
  const total = Math.round(rawTotal * (0.9 + Math.min(confidence, 100) / 1000));
  const valueTrap = filled.valuation >= 65 && (filled.quality < 40 || filled.financialStrength < 35);
  const valuationAvailable = [company.ratios?.peTTM, company.ratios?.priceToSales, company.ratios?.evEbitda, company.ratios?.priceToFCF, company.ratios?.fcfYield].some(finite);
  const classification = confidence < 35 || !valuationAvailable ? "Información insuficiente" : valueTrap ? "Posible trampa de valor" : total >= 70 ? "Valuación atractiva" : total >= 50 ? "Razonablemente valuada" : "Valuación exigente";
  const medians = medianMetrics(peers);
  const rankedPeers = peers.map(peer => ({ peer, score: scoreAnalysisShallow(peer, universe) })).sort((a, b) => b.score - a.score);
  const preferred = rankedPeers[0]?.peer || null;

  return {
    ticker: company.ticker,
    company,
    comparables: peers.map(peer => ({ ticker: peer.ticker, companyName: peer.companyName, sector: peer.sector, industry: peer.industry, rationale: peer.industry === company.industry ? `Misma industria: ${peer.industry}` : `Sector relacionado: ${peer.sector}` })),
    medians,
    score: { valuation, growth, quality, financialStrength, momentum, total },
    confidence,
    classification,
    preferredComparable: preferred ? {
      ticker: preferred.ticker,
      companyName: preferred.companyName,
      rationale: `Mayor puntuación relativa disponible dentro del grupo ${company.industry}.`,
      score: rankedPeers[0].score
    } : null,
    risks: buildRisks(company, filled),
    conclusion: buildConclusion(company, preferred, medians, classification),
    isStale: company.isStale || peers.some(peer => peer.isStale)
  };
}

function scoreAnalysisShallow(company, universe) {
  const metrics = [
    percentileScore(company.ratios?.peTTM, universe.map(item => item.ratios?.peTTM), "low"),
    percentileScore(company.ratios?.evEbitda, universe.map(item => item.ratios?.evEbitda), "low"),
    percentileScore(company.ratios?.fcfYield, universe.map(item => item.ratios?.fcfYield), "high"),
    percentileScore(company.ratios?.roic, universe.map(item => item.ratios?.roic), "high"),
    percentileScore(company.growth?.revenueYoY, universe.map(item => item.growth?.revenueYoY), "high")
  ].filter(finite);
  return metrics.length ? Math.round(metrics.reduce((sum, value) => sum + value, 0) / metrics.length) : 0;
}

function medianMetrics(peers) {
  const paths = ["ratios.peTTM", "ratios.priceToSales", "ratios.evEbitda", "ratios.fcfYield", "growth.revenueYoY", "growth.epsYoY", "ratios.operatingMargin", "ratios.roe", "ratios.roic", "ratios.netDebtToEbitda"];
  return Object.fromEntries(paths.map(path => [path, median(peers.map(peer => valueAt(peer, path)).filter(finite))]));
}

function buildRisks(company, score) {
  const risks = [];
  if (finite(company.ratios?.netDebtToEbitda) && company.ratios.netDebtToEbitda > 3) risks.push("Apalancamiento elevado frente a EBITDA.");
  if (finite(company.fundamentals?.freeCashFlow) && company.fundamentals.freeCashFlow < 0) risks.push("Flujo de efectivo libre negativo en el último ejercicio.");
  if (finite(company.growth?.revenueYoY) && company.growth.revenueYoY < 0) risks.push("Ingresos en contracción interanual.");
  if (score.valuation >= 65 && score.quality < 40) risks.push("El descuento relativo puede reflejar menor calidad operativa.");
  if (company.dataCoverage < 60) risks.push("Cobertura de datos insuficiente para una conclusión de alta confianza.");
  if (!risks.length) risks.push("No se detectó una alerta cuantitativa dominante; revisar factores cualitativos y eventos posteriores al 10-K.");
  return risks;
}

function buildConclusion(company, preferred, medians, classification) {
  const ev = company.ratios?.evEbitda;
  const medianEv = medians["ratios.evEbitda"];
  const relative = finite(ev) && finite(medianEv) && medianEv !== 0 ? Math.round((ev / medianEv - 1) * 100) : null;
  const valuationText = relative === null ? "no dispone todavía de EV/EBITDA comparable suficiente" : `${relative <= 0 ? "cotiza con un descuento" : "cotiza con una prima"} de ${Math.abs(relative)}% en EV/EBITDA frente a la mediana disponible`;
  const peerText = preferred ? ` ${preferred.ticker} obtiene la mejor puntuación relativa del grupo con los datos disponibles.` : " No existe todavía un comparable con cobertura suficiente.";
  return `${company.ticker} ${valuationText}. La lectura se clasifica como ${classification.toLowerCase()}.${peerText}`;
}

async function loadQuotes(symbols, env, ctx) {
  const quotes = {};
  const staleSymbols = [];
  if (!env.EQUITY_CACHE) return { quotes, staleSymbols };
  const cached = await Promise.all(symbols.map(async symbol => [symbol, await readEnvelope(env, `quote:${symbol}:v1`)]));
  const refresh = [];
  for (const [symbol, envelope] of cached) {
    if (!envelope) {
      refresh.push(symbol);
      continue;
    }
    quotes[symbol] = envelope.value;
    if (ageMs(envelope.updatedAt) > QUOTE_CACHE_MS) {
      staleSymbols.push(symbol);
      refresh.push(symbol);
    }
  }
  if (!env.TWELVE_DATA_API_KEY || !refresh.length) return { quotes, staleSymbols };
  const batch = refresh.slice(0, QUOTE_BATCH_LIMIT);
  const task = refreshQuotes(batch, env).then(fresh => Object.assign(quotes, fresh)).catch(error => logError("equity-quotes-refresh-failed", error, { symbols: batch }));
  const missing = batch.some(symbol => !quotes[symbol]);
  if (missing) await task; else ctx.waitUntil(task);
  return { quotes, staleSymbols: staleSymbols.filter(symbol => !quotes[symbol] || ageMs(quotes[symbol]?.updatedAt) > QUOTE_CACHE_MS) };
}

async function refreshQuotes(symbols, env) {
  if (!symbols.length) return {};
  const url = new URL(TWELVE_QUOTE_URL);
  url.searchParams.set("symbol", symbols.join(","));
  url.searchParams.set("apikey", env.TWELVE_DATA_API_KEY);
  const response = await fetchWithTimeout(url.toString(), { headers: { Accept: "application/json" } });
  if (response.status === 429) throw new Error("Límite de Twelve Data alcanzado");
  if (!response.ok) throw new Error(`Twelve Data HTTP ${response.status}`);
  const data = await response.json();
  const records = symbols.length === 1 && !data[symbols[0]] ? { [symbols[0]]: data } : data;
  const result = {};
  await Promise.all(symbols.map(async symbol => {
    const item = records?.[symbol];
    if (!item || item.status === "error" || !finite(Number(item.close))) return;
    const value = { ticker: symbol, price: Number(item.close), percentChange: numberOrNull(item.percent_change), datetime: item.datetime || null, updatedAt: new Date().toISOString() };
    result[symbol] = value;
    await writeEnvelope(env, `quote:${symbol}:v1`, value);
  }));
  return result;
}

async function swr(env, ctx, key, ttlMs, loader) {
  const cached = await readEnvelope(env, key);
  if (cached) {
    const isStale = ageMs(cached.updatedAt) > ttlMs;
    if (isStale) ctx.waitUntil(loader().then(value => writeEnvelope(env, key, value)).catch(error => logError("equity-swr-revalidation-failed", error, { key })));
    return { value: cached.value, updatedAt: cached.updatedAt, isStale };
  }
  const value = await loader();
  const updatedAt = await writeEnvelope(env, key, value);
  return { value, updatedAt, isStale: false };
}

async function readEnvelope(env, key) {
  if (!env.EQUITY_CACHE) return null;
  try {
    const envelope = await env.EQUITY_CACHE.get(key, "json");
    return envelope && typeof envelope === "object" && envelope.value && Number.isFinite(Date.parse(envelope.updatedAt || "")) ? envelope : null;
  } catch (error) {
    logError("equity-kv-read-failed", error, { key });
    return null;
  }
}

async function writeEnvelope(env, key, value) {
  const updatedAt = new Date().toISOString();
  if (env.EQUITY_CACHE) await env.EQUITY_CACHE.put(key, JSON.stringify({ updatedAt, value }), { metadata: { contractVersion: CONTRACT_VERSION, updatedAt } });
  return updatedAt;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

async function fetchWithTimeout(url, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

function secHeaders(env) {
  return { headers: { Accept: "application/json", "User-Agent": env.SEC_USER_AGENT || "AGCI/1.0 (+https://alexsaldana.com/)" } };
}

function json(body, status = 200, maxAge = 0, headers = {}) {
  return cors(Response.json(body, { status, headers: { "Cache-Control": maxAge > 0 ? `public, max-age=${maxAge}` : "no-store", ...headers } }));
}

function cors(response) {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET,OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Content-Type");
  headers.set("Access-Control-Max-Age", "86400");
  headers.set("Vary", "Origin");
  headers.set("X-Content-Type-Options", "nosniff");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function percentileScore(value, values, direction) {
  if (!finite(value)) return null;
  const valid = values.filter(finite).sort((a, b) => a - b);
  if (valid.length < 2) return 50;
  const lower = valid.filter(item => item < value).length;
  const equal = valid.filter(item => item === value).length;
  const percentile = (lower + Math.max(0, equal - 1) / 2) / (valid.length - 1) * 100;
  return Math.round(direction === "low" ? 100 - percentile : percentile);
}

function valueAt(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function cleanNumbers(object) {
  return Object.fromEntries(Object.entries(object).map(([key, value]) => [key, finite(value) ? Number(value) : null]));
}

function durationDays(start, end) {
  const ms = Date.parse(end || "") - Date.parse(start || "");
  return Number.isFinite(ms) ? ms / 86_400_000 : 0;
}

function growthRate(current, previous) {
  return finite(current) && finite(previous) && previous > 0 ? current / previous - 1 : null;
}

function cagr(current, previous, years) {
  return finite(current) && finite(previous) && current > 0 && previous > 0 ? Math.pow(current / previous, 1 / years) - 1 : null;
}

function safeDivide(numerator, denominator) {
  return finite(numerator) && finite(denominator) && denominator !== 0 ? numerator / denominator : null;
}

function positiveDivide(numerator, denominator) {
  return finite(numerator) && finite(denominator) && numerator > 0 && denominator > 0 ? numerator / denominator : null;
}

function sumNullable(...values) {
  const valid = values.filter(finite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) : null;
}

function averageNullable(...values) {
  const valid = values.filter(finite);
  return valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
}

function clamp(value, minimum, maximum) {
  return finite(value) ? Math.max(minimum, Math.min(maximum, value)) : null;
}

function finite(value) {
  return value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
}

function numberOrNull(value) {
  return finite(value) ? Number(value) : null;
}

function ageMs(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? Math.max(0, Date.now() - timestamp) : Infinity;
}

function logError(message, error, context = {}) {
  console.error(JSON.stringify({ level: "error", message, error: error instanceof Error ? error.message : String(error), ...context }));
}
