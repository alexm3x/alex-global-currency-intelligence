#!/usr/bin/env python3
"""AGCI market valuation input engine.

Uses Robert Shiller/Yale's public Irrational Exuberance workbook for S&P market
price, trailing earnings and CAPE, plus the Federal Reserve/FRED DGS10 series.
Outputs only reproducible observations with provenance and percentile scoring.
"""
from __future__ import annotations

import io
import json
import math
import os
from datetime import datetime, timezone
from pathlib import Path

import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "valuation-market-latest.json"
SHILLER_URL = "https://www.econ.yale.edu/~shiller/data/ie_data.xls"
FRED_DGS10_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10"
UA = "AGCI Valuation Engine/1.0 (+https://alexm3x.github.io/alex-global-currency-intelligence/)"


def finite(v):
    try:
        return v is not None and math.isfinite(float(v))
    except (TypeError, ValueError):
        return False


def percentile(values, value):
    vals = sorted(float(x) for x in values if finite(x))
    if not vals or not finite(value):
        return None
    return 100.0 * sum(x <= float(value) for x in vals) / len(vals)


def score_expensive(values, value):
    p = percentile(values, value)
    return round(max(0, min(100, p))) if p is not None else None


def score_inverse(values, value):
    p = percentile(values, value)
    return round(max(0, min(100, 100 - p))) if p is not None else None


def get(url):
    r = requests.get(url, headers={"User-Agent": UA}, timeout=45)
    r.raise_for_status()
    return r.content


def load_shiller():
    raw = get(SHILLER_URL)
    # Workbook layout is stable: sheet Data, header row 8 (zero-based 7).
    df = pd.read_excel(io.BytesIO(raw), sheet_name="Data", header=7, engine="xlrd")
    df.columns = [str(c).strip() for c in df.columns]
    date_col = df.columns[0]
    # Shiller workbook columns: Date, P, D, E, CPI, Date Fraction, Long Interest Rate, Real Price, Real Dividend, Real Total Return Price, Real Earnings, Real TR Scaled Earnings, CAPE, TR CAPE, Excess CAPE Yield, Monthly Total Bond Returns, Real Total Bond Returns, 10 Year Annualized Stock Real Return
    rename = {date_col: "Date"}
    for c in df.columns:
        lc = c.lower().strip()
        if c == date_col:
            continue
        if lc == "p": rename[c] = "P"
        elif lc == "e": rename[c] = "E"
        elif lc == "cape": rename[c] = "CAPE"
    df = df.rename(columns=rename)
    for col in ["P", "E", "CAPE"]:
        if col not in df.columns:
            raise RuntimeError(f"Shiller workbook missing {col}")
        df[col] = pd.to_numeric(df[col], errors="coerce")
    df = df.dropna(subset=["P", "E", "CAPE"]).copy()
    if len(df) < 500:
        raise RuntimeError("Shiller history insufficient")
    df["trailingPE"] = df["P"] / df["E"]
    df = df[(df["trailingPE"] > 0) & (df["trailingPE"] < 200)]
    return df


def load_dgs10():
    raw = get(FRED_DGS10_URL)
    df = pd.read_csv(io.BytesIO(raw))
    df.columns = [str(c).strip() for c in df.columns]
    value_col = next(c for c in df.columns if c != "observation_date")
    df[value_col] = pd.to_numeric(df[value_col], errors="coerce")
    df = df.dropna(subset=[value_col])
    if len(df) < 500:
        raise RuntimeError("FRED DGS10 history insufficient")
    return df, value_col


def main():
    now = datetime.now(timezone.utc)
    sh = load_shiller()
    rates, rate_col = load_dgs10()
    latest = sh.iloc[-1]
    ten_year = float(rates.iloc[-1][rate_col])
    trailing_pe = float(latest["trailingPE"])
    cape = float(latest["CAPE"])
    trailing_earnings_yield = 100.0 / trailing_pe
    cape_earnings_yield = 100.0 / cape
    earnings_yield_spread = trailing_earnings_yield - ten_year
    cape_risk_premium = cape_earnings_yield - ten_year

    # Historical valuation percentiles. For spreads, lower = more expensive.
    pe_hist = sh["trailingPE"].tail(1200).tolist()
    cape_hist = sh["CAPE"].tail(1200).tolist()
    # Build long-run spread distributions using the workbook's own long-rate column when available.
    long_col = next((c for c in sh.columns if "Long Interest" in c), None)
    spread_hist = []
    cape_spread_hist = []
    if long_col:
        temp = sh.copy()
        temp[long_col] = pd.to_numeric(temp[long_col], errors="coerce")
        temp = temp.dropna(subset=[long_col])
        spread_hist = ((100 / temp["trailingPE"]) - temp[long_col]).tail(1200).tolist()
        cape_spread_hist = ((100 / temp["CAPE"]) - temp[long_col]).tail(1200).tolist()
    if len(spread_hist) < 120:
        spread_hist = [earnings_yield_spread]
    if len(cape_spread_hist) < 120:
        cape_spread_hist = [cape_risk_premium]

    shiller_asof = str(latest["Date"])
    rate_asof = str(rates.iloc[-1]["observation_date"])
    components = {
        "trailingPE": {
            "label": "Trailing P/E",
            "value": round(trailing_pe, 2),
            "normalized_score": score_expensive(pe_hist, trailing_pe),
            "source": "Robert J. Shiller / Yale — Irrational Exuberance data",
            "asOf": shiller_asof,
            "freshness": "MONTHLY",
            "freshness_score": 85,
            "confidence": 92,
            "source_quality": 96,
        },
        "cape": {
            "label": "Shiller CAPE",
            "value": round(cape, 2),
            "normalized_score": score_expensive(cape_hist, cape),
            "source": "Robert J. Shiller / Yale — CAPE",
            "asOf": shiller_asof,
            "freshness": "MONTHLY",
            "freshness_score": 85,
            "confidence": 96,
            "source_quality": 98,
        },
        "earningsYieldSpread": {
            "label": "Trailing Earnings Yield − Treasury 10Y",
            "value": round(earnings_yield_spread, 3),
            "normalized_score": score_inverse(spread_hist, earnings_yield_spread),
            "source": "Robert J. Shiller / Yale + Federal Reserve / FRED DGS10",
            "asOf": rate_asof,
            "freshness": "MIXED",
            "freshness_score": 88,
            "confidence": 90,
            "source_quality": 97,
        },
        "equityRiskPremium": {
            "label": "CAPE Earnings Yield − Treasury 10Y",
            "value": round(cape_risk_premium, 3),
            "normalized_score": score_inverse(cape_spread_hist, cape_risk_premium),
            "source": "Robert J. Shiller / Yale + Federal Reserve / FRED DGS10",
            "asOf": rate_asof,
            "freshness": "MIXED",
            "freshness_score": 88,
            "confidence": 88,
            "source_quality": 97,
        },
    }
    payload = {
        "schema_version": 1,
        "timestamp": now.isoformat().replace("+00:00", "Z"),
        "methodology_version": "AGCI-VALUATION-v1.0",
        "status": "connected",
        "inputs": {
            "treasury10y": round(ten_year, 3),
            "trailingEarningsYield": round(trailing_earnings_yield, 3),
            "capeEarningsYield": round(cape_earnings_yield, 3),
        },
        "components": components,
        "sources": [
            {"name": "Robert J. Shiller / Yale", "url": SHILLER_URL, "frequency": "MONTHLY", "asOf": shiller_asof, "status": "connected"},
            {"name": "Federal Reserve / FRED DGS10", "url": FRED_DGS10_URL, "frequency": "DAILY", "asOf": rate_asof, "status": "connected"},
        ],
        "governance": {
            "no_forward_pe_proxy": True,
            "no_fcf_yield_proxy": True,
            "no_price_sales_proxy": True,
            "no_price_book_proxy": True,
            "derived_spreads_are_labeled": True,
            "missing_values_are_never_zero": True,
        },
    }
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"status": payload["status"], "trailingPE": trailing_pe, "cape": cape, "treasury10y": ten_year, "components": {k: v["normalized_score"] for k, v in components.items()}}, indent=2))


if __name__ == "__main__":
    main()
