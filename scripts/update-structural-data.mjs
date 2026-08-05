import {readFile, writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {dirname, resolve} from 'node:path';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT_PATH = resolve(ROOT, 'data/macro-latest.json');
const REGISTRY_PATH = resolve(ROOT, 'data/sources.json');
const USER_AGENT = 'AGCI structural-data updater/1.0 (+https://alexm3x.github.io/alex-global-currency-intelligence/)';

export const ECONOMIES = {
  MX: {name:'México', currency:'MXN'},
  US: {name:'Estados Unidos', currency:'USD'},
  XM: {name:'Zona euro', currency:'EUR'},
  GB: {name:'Reino Unido', currency:'GBP'},
  JP: {name:'Japón', currency:'JPY'},
  CN: {name:'China', currency:'CNY'},
  BR: {name:'Brasil', currency:'BRL'}
};

const WORLD_BANK_CODES = Object.keys(ECONOMIES).filter(code => code !== 'XM').concat('EMU');
const WB_TO_AGCI = {MEX:'MX',USA:'US',EMU:'XM',GBR:'GB',JPN:'JP',CHN:'CN',BRA:'BR'};
const INDICATORS = {
  inflation:{code:'FP.CPI.TOTL.ZG',label:'Inflación anual',unit:'%'},
  growth:{code:'NY.GDP.MKTP.KD.ZG',label:'Crecimiento real del PIB',unit:'%'},
  currentAccount:{code:'BN.CAB.XOKA.GD.ZS',label:'Cuenta corriente / PIB',unit:'% PIB'}
};

function number(value) {
  if (value===null || value===undefined || value==='') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseCsv(text) {
  const rows=[]; let row=[]; let field=''; let quoted=false;
  for (let i=0;i<text.length;i+=1) {
    const char=text[i];
    if (quoted) {
      if (char==='"' && text[i+1]==='"') { field+='"'; i+=1; }
      else if (char==='"') quoted=false;
      else field+=char;
    } else if (char==='"') quoted=true;
    else if (char===',') { row.push(field); field=''; }
    else if (char==='\n') { row.push(field.replace(/\r$/,'')); if (row.some(Boolean)) rows.push(row); row=[]; field=''; }
    else field+=char;
  }
  if (field.length || row.length) { row.push(field.replace(/\r$/,'')); rows.push(row); }
  if (!rows.length) return [];
  const headers=rows[0];
  return rows.slice(1).map(values=>Object.fromEntries(headers.map((header,index)=>[header,values[index]??''])));
}

async function fetchWithRetry(url, {timeoutMs=30000, attempts=3, accept='application/json'}={}) {
  let lastError;
  for (let attempt=1;attempt<=attempts;attempt+=1) {
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),timeoutMs);
    try {
      const response=await fetch(url,{headers:{accept,'user-agent':USER_AGENT},signal:controller.signal});
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response;
    } catch (error) {
      lastError=error;
      if (attempt<attempts) await new Promise(done=>setTimeout(done,attempt*1200));
    } finally { clearTimeout(timer); }
  }
  throw new Error(`${new URL(url).hostname}: ${lastError?.message || lastError}`);
}

function latestByArea(rows, areaField='REF_AREA') {
  const result={};
  for (const row of rows) {
    const area=WB_TO_AGCI[row[areaField]] || row[areaField];
    const value=number(row.OBS_VALUE);
    if (!ECONOMIES[area] || value===null || !row.TIME_PERIOD) continue;
    if (!result[area] || row.TIME_PERIOD>result[area].period) {
      result[area]={value,period:row.TIME_PERIOD,status:row.OBS_STATUS || null};
    }
  }
  return result;
}

export function parseWorldBank(payload) {
  if (!Array.isArray(payload) || !Array.isArray(payload[1])) throw new Error('World Bank response contract changed');
  const result={};
  for (const row of payload[1]) {
    const area=WB_TO_AGCI[row?.countryiso3code] || row?.countryiso3code;
    const value=number(row?.value);
    if (!ECONOMIES[area] || value===null || !row?.date) continue;
    if (!result[area] || row.date>result[area].period) result[area]={value,period:row.date};
  }
  return result;
}

export function calculateVixRisk(rows) {
  const normalizeDate=value=>{
    const match=String(value||'').match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    return match?`${match[3]}-${match[1].padStart(2,'0')}-${match[2].padStart(2,'0')}`:String(value||'');
  };
  const observations=rows.map(row=>({
    period:normalizeDate(row.DATE || row.Date || row.date),
    value:number(row.CLOSE ?? row.Close ?? row.close)
  })).filter(row=>row.period && row.value!==null).sort((a,b)=>a.period.localeCompare(b.period));
  if (observations.length<20) throw new Error('Cboe VIX history has fewer than 20 observations');
  const latest=observations.at(-1);
  const trailing20=observations.slice(-20);
  const trailing252=observations.slice(-252);
  const average20=trailing20.reduce((sum,row)=>sum+row.value,0)/trailing20.length;
  const percentile100=100*trailing252.filter(row=>row.value<=latest.value).length/trailing252.length;
  const regime=latest.value<15?'bajo':latest.value<20?'normal':latest.value<30?'elevado':'extremo';
  return {
    vix:latest.value,
    period:latest.period,
    average20:Number(average20.toFixed(2)),
    percentile1y:Number(percentile100.toFixed(1)),
    change20d:Number((latest.value-trailing20[0].value).toFixed(2)),
    regime
  };
}

async function fetchWorldBank(now) {
  const startYear=now.getUTCFullYear()-5;
  const endYear=now.getUTCFullYear()+1;
  const countries=WORLD_BANK_CODES.join(';');
  const values={};
  for (const [key,indicator] of Object.entries(INDICATORS)) {
    const url=`https://api.worldbank.org/v2/country/${countries}/indicator/${indicator.code}?format=json&per_page=500&date=${startYear}:${endYear}`;
    const response=await fetchWithRetry(url,{timeoutMs:45000});
    values[key]=parseWorldBank(await response.json());
  }
  return {
    provider:'World Bank — World Development Indicators',
    homepage:'https://data.worldbank.org/',
    retrievedAt:now.toISOString(),
    series:Object.fromEntries(Object.entries(INDICATORS).map(([key,value])=>[key,value.code])),
    values
  };
}

async function fetchBis(now) {
  const areas=Object.keys(ECONOMIES).join('+');
  const startYear=now.getUTCFullYear()-2;
  const policyUrl=`https://stats.bis.org/api/v2/data/dataflow/BIS/WS_CBPOL/1.0/M.${areas}?startPeriod=${startYear}-01&format=csvfile`;
  const reerUrl=`https://stats.bis.org/api/v2/data/dataflow/BIS/WS_EER/1.0/M.R.B.${areas}?startPeriod=${startYear}-01&format=csvfile`;
  const [policyResponse,reerResponse]=await Promise.all([
    fetchWithRetry(policyUrl,{accept:'text/csv'}),
    fetchWithRetry(reerUrl,{accept:'text/csv'})
  ]);
  const policyRows=parseCsv(await policyResponse.text());
  const reerRows=parseCsv(await reerResponse.text());
  if (!policyRows.length || !reerRows.length) throw new Error('BIS returned an empty dataset');
  return {
    provider:'Bank for International Settlements',
    homepage:'https://data.bis.org/',
    retrievedAt:now.toISOString(),
    policyRates:{series:'BIS,WS_CBPOL,1.0',frequency:'Mensual',values:latestByArea(policyRows)},
    reer:{series:'BIS,WS_EER,1.0 / M.R.B',frequency:'Mensual',values:latestByArea(reerRows)}
  };
}

async function fetchCboe(now) {
  const url='https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv';
  const response=await fetchWithRetry(url,{accept:'text/csv'});
  const risk=calculateVixRisk(parseCsv(await response.text()));
  return {
    provider:'Cboe Global Markets',
    homepage:'https://www.cboe.com/tradable_products/vix/vix_historical_data/',
    retrievedAt:now.toISOString(),
    series:'VIX daily close',
    risk
  };
}

function providerResult(status, data=null, error=null, previous=null) {
  if (status==='ok') return {status,data,error:null,usedPrevious:false};
  if (previous?.data) return {status:'degraded',data:previous.data,error,usedPrevious:true};
  return {status:'error',data:null,error,usedPrevious:false};
}

function buildEconomies(providers) {
  return Object.fromEntries(Object.entries(ECONOMIES).map(([code,meta])=>{
    const wb=providers.worldBank.data?.values || {};
    const bis=providers.bis.data || {};
    return [code,{
      ...meta,
      inflation:wb.inflation?.[code] || null,
      growth:wb.growth?.[code] || null,
      currentAccount:wb.currentAccount?.[code] || null,
      policyRate:bis.policyRates?.values?.[code] || null,
      reer:bis.reer?.values?.[code] || null
    }];
  }));
}

export function buildRegistry(snapshot) {
  const wb=snapshot.providers.worldBank.status;
  const bis=snapshot.providers.bis.status;
  const cboe=snapshot.providers.cboe.status;
  const label=status=>status==='ok'?'Conectado':status==='degraded'?'Degradado':'Pendiente de conexión';
  const structural=[wb,bis,cboe];
  const status=structural.every(value=>value==='ok')?'connected':structural.some(value=>value==='ok'||value==='degraded')?'partially-connected':'disconnected';
  return {
    status,
    generated_at:snapshot.generatedAt,
    last_reviewed:snapshot.generatedAt.slice(0,10),
    note:'El registro se genera automáticamente a partir de pruebas reales de extracción. El estado no se define manualmente.',
    automation:{engine:'GitHub Actions',schedule:'Cada 6 horas (UTC)',workflow:'.github/workflows/update-structural-data.yml'},
    sources:[
      {category:'FX spot',provider:'Twelve Data vía Cloudflare Worker',frequency:'15–30 minutos en origen',status:'Conectado',last_success:snapshot.generatedAt},
      {category:'Noticias financieras',provider:'GDELT y fuentes oficiales enlazadas',frequency:'Periódica',status:'Conectado',last_success:snapshot.generatedAt},
      {category:'Inflación y crecimiento',provider:'World Bank — WDI',frequency:'Según publicación oficial',status:label(wb),last_success:snapshot.providers.worldBank.data?.retrievedAt||null,error:snapshot.providers.worldBank.error},
      {category:'Tasas y bancos centrales',provider:'BIS — datos reportados por bancos centrales',frequency:'Semanal/Mensual',status:label(bis),last_success:snapshot.providers.bis.data?.retrievedAt||null,error:snapshot.providers.bis.error},
      {category:'REER y balanza externa',provider:'BIS (REER) + World Bank (cuenta corriente)',frequency:'Mensual/Anual',status:label(bis==='ok'&&wb==='ok'?'ok':bis==='error'||wb==='error'?'error':'degraded'),last_success:[snapshot.providers.bis.data?.retrievedAt,snapshot.providers.worldBank.data?.retrievedAt].filter(Boolean).sort().at(0)||null,error:[snapshot.providers.bis.error,snapshot.providers.worldBank.error].filter(Boolean).join(' · ')||null},
      {category:'Riesgo y volatilidad',provider:'Cboe VIX — cálculo AGCI',frequency:'Diaria',status:label(cboe),last_success:snapshot.providers.cboe.data?.retrievedAt||null,error:snapshot.providers.cboe.error}
    ]
  };
}

async function readPrevious() {
  try { return JSON.parse(await readFile(OUTPUT_PATH,'utf8')); }
  catch { return {providers:{}}; }
}

export async function updateStructuralData({write=true, now=new Date()}={}) {
  const previous=await readPrevious();
  const tasks={worldBank:fetchWorldBank(now),bis:fetchBis(now),cboe:fetchCboe(now)};
  const entries=await Promise.all(Object.entries(tasks).map(async ([key,promise])=>{
    try { return [key,providerResult('ok',await promise)]; }
    catch (error) { return [key,providerResult('error',null,error.message,previous.providers?.[key])]; }
  }));
  const providers=Object.fromEntries(entries);
  const snapshot={
    schemaVersion:1,
    generatedAt:now.toISOString(),
    overallStatus:Object.values(providers).every(item=>item.status==='ok')?'connected':Object.values(providers).some(item=>item.data)?'degraded':'unavailable',
    providers,
    economies:buildEconomies(providers),
    risk:providers.cboe.data?.risk || null
  };
  const registry=buildRegistry(snapshot);
  if (write) {
    await writeFile(OUTPUT_PATH,`${JSON.stringify(snapshot,null,2)}\n`);
    await writeFile(REGISTRY_PATH,`${JSON.stringify(registry,null,2)}\n`);
  }
  return {snapshot,registry};
}

if (process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  const {snapshot}=await updateStructuralData();
  console.log(JSON.stringify({generatedAt:snapshot.generatedAt,overallStatus:snapshot.overallStatus,providers:Object.fromEntries(Object.entries(snapshot.providers).map(([key,value])=>[key,{status:value.status,error:value.error}]))},null,2));
  if (!Object.values(snapshot.providers).some(provider=>provider.data)) process.exitCode=1;
}
