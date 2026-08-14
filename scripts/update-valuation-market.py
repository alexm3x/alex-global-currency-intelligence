#!/usr/bin/env python3
"""AGCI market valuation input engine using Shiller/Yale + FRED."""
from __future__ import annotations
import io, json, math
from datetime import datetime, timezone
from pathlib import Path
import pandas as pd
import requests

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "valuation-market-latest.json"
SHILLER_URL = "http://www.econ.yale.edu/~shiller/data/ie_data.xls"
FRED_DGS10_URL = "https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10"
UA = "AGCI Valuation Engine/1.0 (+https://alexm3x.github.io/alex-global-currency-intelligence/)"

def finite(v):
    try: return v is not None and math.isfinite(float(v))
    except (TypeError, ValueError): return False

def percentile(values, value):
    vals=sorted(float(x) for x in values if finite(x))
    return None if not vals or not finite(value) else 100.0*sum(x<=float(value) for x in vals)/len(vals)

def score_expensive(values,value):
    p=percentile(values,value); return None if p is None else round(max(0,min(100,p)))

def score_inverse(values,value):
    p=percentile(values,value); return None if p is None else round(max(0,min(100,100-p)))

def get(url):
    r=requests.get(url,headers={"User-Agent":UA},timeout=45); r.raise_for_status(); return r.content

def load_shiller():
    raw=get(SHILLER_URL)
    df=pd.read_excel(io.BytesIO(raw),sheet_name="Data",header=7,engine="xlrd")
    df.columns=[str(c).strip() for c in df.columns]
    date_col=df.columns[0]; rename={date_col:"Date"}
    for c in df.columns:
        lc=c.lower().strip()
        if lc=="p": rename[c]="P"
        elif lc=="e": rename[c]="E"
        elif lc=="cape": rename[c]="CAPE"
    df=df.rename(columns=rename)
    for col in ["P","E","CAPE"]:
        if col not in df.columns: raise RuntimeError(f"Shiller workbook missing {col}; columns={list(df.columns)}")
        df[col]=pd.to_numeric(df[col],errors="coerce")
    df=df.dropna(subset=["P","E","CAPE"]).copy()
    if len(df)<500: raise RuntimeError("Shiller history insufficient")
    df["trailingPE"]=df["P"]/df["E"]
    return df[(df["trailingPE"]>0)&(df["trailingPE"]<200)]

def load_dgs10():
    raw=get(FRED_DGS10_URL); df=pd.read_csv(io.BytesIO(raw)); df.columns=[str(c).strip() for c in df.columns]
    date_col=next(c for c in df.columns if "date" in c.lower()); value_col=next(c for c in df.columns if c!=date_col)
    df[value_col]=pd.to_numeric(df[value_col],errors="coerce"); df=df.dropna(subset=[value_col])
    if len(df)<500: raise RuntimeError("FRED DGS10 history insufficient")
    return df,date_col,value_col

def main():
    now=datetime.now(timezone.utc); sh=load_shiller(); rates,date_col,rate_col=load_dgs10(); latest=sh.iloc[-1]
    ten_year=float(rates.iloc[-1][rate_col]); trailing_pe=float(latest["trailingPE"]); cape=float(latest["CAPE"])
    trailing_yield=100/trailing_pe; cape_yield=100/cape; ey_spread=trailing_yield-ten_year; cape_premium=cape_yield-ten_year
    pe_hist=sh["trailingPE"].tail(1200).tolist(); cape_hist=sh["CAPE"].tail(1200).tolist()
    long_col=next((c for c in sh.columns if "long" in c.lower() and "interest" in c.lower()),None)
    spread_hist=[]; cape_spread_hist=[]
    if long_col:
        temp=sh.copy(); temp[long_col]=pd.to_numeric(temp[long_col],errors="coerce"); temp=temp.dropna(subset=[long_col])
        spread_hist=((100/temp["trailingPE"])-temp[long_col]).tail(1200).tolist(); cape_spread_hist=((100/temp["CAPE"])-temp[long_col]).tail(1200).tolist()
    if len(spread_hist)<120 or len(cape_spread_hist)<120: raise RuntimeError("Shiller long-rate history unavailable; refusing synthetic spread percentile")
    raw_date=str(latest["Date"])
    try:
        year=int(float(raw_date)); month=max(1,min(12,round((float(raw_date)-year)*100))); shiller_asof=f"{year:04d}-{month:02d}-01"
    except Exception: shiller_asof=raw_date
    rate_asof=str(rates.iloc[-1][date_col])
    def comp(label,value,score,source,asof,confidence=92,quality=97):
        return {"label":label,"value":round(value,3),"normalized_score":score,"source":source,"asOf":asof,"freshness":"MIXED","freshness_score":88,"confidence":confidence,"source_quality":quality}
    components={
      "trailingPE":comp("Trailing P/E",trailing_pe,score_expensive(pe_hist,trailing_pe),"Robert J. Shiller / Yale — Irrational Exuberance data",shiller_asof,92,96),
      "cape":comp("Shiller CAPE",cape,score_expensive(cape_hist,cape),"Robert J. Shiller / Yale — CAPE",shiller_asof,96,98),
      "earningsYieldSpread":comp("Trailing Earnings Yield − Treasury 10Y",ey_spread,score_inverse(spread_hist,ey_spread),"Robert J. Shiller / Yale + Federal Reserve / FRED DGS10",rate_asof,90,97),
      "equityRiskPremium":comp("CAPE Earnings Yield − Treasury 10Y",cape_premium,score_inverse(cape_spread_hist,cape_premium),"Robert J. Shiller / Yale + Federal Reserve / FRED DGS10",rate_asof,88,97)
    }
    if any(not finite(v["normalized_score"]) for v in components.values()): raise RuntimeError("Valuation normalization incomplete")
    payload={"schema_version":1,"timestamp":now.isoformat().replace("+00:00","Z"),"methodology_version":"AGCI-VALUATION-v1.0","status":"connected","inputs":{"treasury10y":round(ten_year,3),"trailingEarningsYield":round(trailing_yield,3),"capeEarningsYield":round(cape_yield,3)},"components":components,"sources":[{"name":"Robert J. Shiller / Yale","url":SHILLER_URL,"frequency":"MONTHLY","asOf":shiller_asof,"status":"connected"},{"name":"Federal Reserve / FRED DGS10","url":FRED_DGS10_URL,"frequency":"DAILY","asOf":rate_asof,"status":"connected"}],"governance":{"no_forward_pe_proxy":True,"no_fcf_yield_proxy":True,"no_price_sales_proxy":True,"no_price_book_proxy":True,"derived_spreads_are_labeled":True,"missing_values_are_never_zero":True}}
    OUT.write_text(json.dumps(payload,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({"status":payload["status"],"trailingPE":trailing_pe,"cape":cape,"treasury10y":ten_year,"components":{k:v["normalized_score"] for k,v in components.items()}},indent=2))

if __name__=="__main__": main()
