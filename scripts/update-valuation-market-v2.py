#!/usr/bin/env python3
from __future__ import annotations
import io,json,math,re,time
from datetime import datetime,timezone
from pathlib import Path
from urllib.parse import urljoin
import pandas as pd, requests
ROOT=Path(__file__).resolve().parents[1]; OUT=ROOT/'data/valuation-market-latest.json'
UA='AGCI Valuation Engine/1.1'; FRED='https://fred.stlouisfed.org/graph/fredgraph.csv?id=DGS10&cosd=1962-01-01&fq=Monthly&fam=Average'; YALE='https://www.econ.yale.edu/~shiller/data/ie_data.xls'; SHILLER_PAGE='https://shillerdata.com/'
def get(u,attempts=4):
 last=None
 for i in range(attempts):
  try:
   r=requests.get(u,headers={'User-Agent':UA,'Accept':'text/csv,application/vnd.ms-excel,text/html;q=0.8,*/*;q=0.5'},timeout=(15,90)); r.raise_for_status(); return r.content,r.url
  except Exception as e:
   last=e
   if i+1<attempts: time.sleep(2*(i+1))
 raise RuntimeError(f'Provider unavailable after {attempts} attempts: {u}; {last}')
def shiller_bytes():
 try: return (*get(YALE,2),'Robert J. Shiller / Yale')
 except Exception as primary:
  html,landing=get(SHILLER_PAGE,3); text=html.decode('utf-8','ignore'); links=re.findall(r'href=["\']([^"\']+)["\']',text,re.I)
  candidates=[urljoin(landing,x.replace('&amp;','&')) for x in links if ('ie_data' in x.lower() or x.lower().split('?')[0].endswith('.xls'))]
  for u in candidates:
   try:
    raw,final=get(u,2)
    if len(raw)>100000: return raw,final,'Robert J. Shiller / ShillerData distribution'
   except Exception: pass
  raise RuntimeError(f'No authorized Shiller workbook source reachable; Yale error={primary}')
def pct(vals,v):
 a=sorted(float(x) for x in vals if pd.notna(x) and math.isfinite(float(x))); return round(100*sum(x<=v for x in a)/len(a))
def inv(vals,v): return 100-pct(vals,v)
def shiller_ym(v):
 try:
  f=float(v); y=int(f); m=max(1,min(12,round((f-y)*100))); return f'{y:04d}-{m:02d}'
 except: return None
def main():
 raw,source_url,source_name=shiller_bytes(); df=pd.read_excel(io.BytesIO(raw),sheet_name='Data',header=7,engine='xlrd'); df.columns=[str(x).strip() for x in df.columns]
 date=df.columns[0]; ren={date:'Date'}
 for c in df.columns:
  if c.lower().strip()=='p': ren[c]='P'
  elif c.lower().strip()=='e': ren[c]='E'
  elif c.lower().strip()=='cape': ren[c]='CAPE'
 df=df.rename(columns=ren)
 for c in ['P','E','CAPE']:
  if c not in df: raise RuntimeError(f'Shiller contract changed: missing {c}')
  df[c]=pd.to_numeric(df[c],errors='coerce')
 df=df.dropna(subset=['P','E','CAPE']); df['PE']=df.P/df.E; df=df[(df.PE>0)&(df.PE<200)]; df['ym']=df.Date.map(shiller_ym)
 if len(df)<500: raise RuntimeError('Insufficient Shiller history')
 fred_raw,_=get(FRED,4); rates=pd.read_csv(io.BytesIO(fred_raw)); dcol=next(c for c in rates.columns if 'date' in c.lower()); vcol=next(c for c in rates.columns if c!=dcol); rates[vcol]=pd.to_numeric(rates[vcol],errors='coerce'); rates[dcol]=pd.to_datetime(rates[dcol],errors='coerce'); rates=rates.dropna(subset=[vcol,dcol]); ten=float(rates.iloc[-1][vcol]); rates['ym']=rates[dcol].dt.strftime('%Y-%m'); monthly=rates[['ym',vcol]].copy()
 x=df.iloc[-1]; pe=float(x.PE); cape=float(x.CAPE); ey=100/pe; cy=100/cape; esp=ey-ten; erp=cy-ten
 hist=df.tail(1200); aligned=hist.merge(monthly,on='ym',how='inner'); sph=(100/aligned.PE-aligned[vcol]).tolist(); cph=(100/aligned.CAPE-aligned[vcol]).tolist()
 if len(sph)<120: raise RuntimeError(f'Insufficient aligned Shiller/FRED spread history: {len(sph)} months')
 rawdate=str(x.Date); ym=shiller_ym(rawdate); asof=f'{ym}-01' if ym else rawdate; rasof=str(rates.iloc[-1][dcol].date())
 def c(label,val,score,src,a,conf): return {'label':label,'value':round(val,3),'normalized_score':score,'source':src,'asOf':a,'freshness':'MIXED','freshness_score':88,'confidence':conf,'source_quality':97}
 comps={'trailingPE':c('Trailing P/E',pe,pct(hist.PE,pe),source_name,asof,92),'cape':c('Shiller CAPE',cape,pct(hist.CAPE,cape),source_name,asof,96),'earningsYieldSpread':c('Trailing Earnings Yield − Treasury 10Y',esp,inv(sph,esp),source_name+' + Federal Reserve / FRED DGS10',rasof,90),'equityRiskPremium':c('CAPE Earnings Yield − Treasury 10Y',erp,inv(cph,erp),source_name+' + Federal Reserve / FRED DGS10',rasof,88)}
 payload={'schema_version':1,'timestamp':datetime.now(timezone.utc).isoformat().replace('+00:00','Z'),'methodology_version':'AGCI-VALUATION-v1.1','status':'connected','inputs':{'treasury10y':round(ten,3),'trailingEarningsYield':round(ey,3),'capeEarningsYield':round(cy,3)},'components':comps,'sources':[{'name':source_name,'url':source_url,'frequency':'MONTHLY','asOf':asof,'status':'connected'},{'name':'Federal Reserve / FRED DGS10','url':FRED,'frequency':'MONTHLY_AVG','asOf':rasof,'status':'connected'}],'governance':{'no_forward_pe_proxy':True,'no_fcf_yield_proxy':True,'no_price_sales_proxy':True,'no_price_book_proxy':True,'derived_spreads_are_labeled':True,'spread_history_uses_fred_dgs10':True,'fred_monthly_compact_feed':True,'provider_retries_enabled':True,'missing_values_are_never_zero':True}}
 OUT.write_text(json.dumps(payload,indent=2)+'\n'); print(json.dumps({'status':'connected','source':source_name,'PE':pe,'CAPE':cape,'DGS10':ten,'aligned_months':len(sph),'scores':{k:v['normalized_score'] for k,v in comps.items()}},indent=2))
if __name__=='__main__': main()
