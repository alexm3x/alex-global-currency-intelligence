const JSON_HEADERS = {'content-type':'application/json;charset=UTF-8'};

function allowedOrigin(request, env) {
  const origin = request.headers.get('Origin') || '';
  const configured = (env.ALLOWED_ORIGINS || '').split(',').map(x => x.trim()).filter(Boolean);
  if (!origin) return configured[0] || '*';
  if (!configured.length) return origin;
  return configured.includes(origin) ? origin : '';
}

function cors(origin) {
  return {
    'access-control-allow-origin': origin || 'null',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-headers': 'content-type,x-agci-key,x-alert-id',
    'access-control-max-age': '86400',
    'vary': 'Origin'
  };
}

function json(body, status = 200, origin = '*') {
  return new Response(JSON.stringify(body), {status, headers:{...JSON_HEADERS, ...cors(origin)}});
}

function validPayload(x) {
  const validSeverity = ['info','important','critical','digest'].includes(x?.severity || 'info');
  return Boolean(x && typeof x.title === 'string' && typeof x.message === 'string' &&
    x.title.trim().length > 0 && x.title.length <= 120 &&
    x.message.trim().length > 0 && x.message.length <= 1200 && validSeverity);
}

function localTime(env, date = new Date()) {
  const timezone = env.ALERT_TIMEZONE || 'America/Mexico_City';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone:timezone, year:'numeric', month:'2-digit', day:'2-digit',
    hour:'2-digit', minute:'2-digit', hour12:false
  }).formatToParts(date);
  const get = type => parts.find(x=>x.type===type)?.value || '';
  return {date:`${get('year')}-${get('month')}-${get('day')}`, time:`${get('hour')}:${get('minute')}`, timezone};
}

function inQuietHours(payload, env) {
  if ((payload.severity || 'info') === 'critical') return false;
  const start = env.QUIET_START || '22:00';
  const end = env.QUIET_END || '07:00';
  const now = localTime(env).time;
  return start <= end ? now >= start && now < end : now >= start || now < end;
}

async function isDuplicate(env, alertId) {
  if (!alertId || !env.ALERT_DEDUP) return false;
  const key = `alert:${alertId}`;
  const existing = await env.ALERT_DEDUP.get(key);
  if (existing) return true;
  await env.ALERT_DEDUP.put(key, '1', {expirationTtl:Number(env.DEDUP_TTL_SECONDS || 21600)});
  return false;
}

async function recordHistory(env, event) {
  if (!env.ALERT_HISTORY) return;
  const stamp = new Date().toISOString();
  const id = event.id || crypto.randomUUID();
  await env.ALERT_HISTORY.put(`history:${stamp}:${id}`, JSON.stringify({...event, recordedAt:stamp}), {
    expirationTtl:Number(env.HISTORY_TTL_SECONDS || 7776000)
  });
}

function buildTemplate(templateName, language, payload) {
  const template = {name:templateName, language:{code:language}};
  if (templateName !== 'hello_world') {
    template.components = [{
      type:'body',
      parameters:[
        {type:'text', text:payload.title.trim()},
        {type:'text', text:payload.message.trim()},
        {type:'text', text:(payload.severity || 'info').toUpperCase()}
      ]
    }];
  }
  return template;
}

async function sendMetaWhatsApp(env, payload) {
  const required = ['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_TO'];
  const missing = required.filter(k => !env[k]);
  if (missing.length) throw new Error(`Missing Worker secrets: ${missing.join(', ')}`);

  const graphVersion = env.META_GRAPH_VERSION || 'v25.0';
  const url = `https://graph.facebook.com/${graphVersion}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const templateName = env.WHATSAPP_TEMPLATE_NAME || 'agci_market_alert';
  const language = env.WHATSAPP_TEMPLATE_LANGUAGE || (templateName === 'hello_world' ? 'en_US' : 'es_MX');
  const body = {
    messaging_product:'whatsapp', recipient_type:'individual', to:env.WHATSAPP_TO,
    type:'template', template:buildTemplate(templateName, language, payload)
  };

  const r = await fetch(url, {
    method:'POST',
    headers:{authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,'content-type':'application/json'},
    body:JSON.stringify(body)
  });
  const data = await r.json().catch(()=>({}));
  if (!r.ok) throw new Error(`WhatsApp API ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

async function deliver(env, payload, alertId = '') {
  if (!validPayload(payload)) return {status:422, body:{ok:false,error:'Invalid alert payload'}};
  if (await isDuplicate(env, alertId || payload.id || '')) {
    return {status:200, body:{ok:true,duplicate:true,delivery:'skipped'}};
  }
  if (inQuietHours(payload, env)) {
    await recordHistory(env, {...payload,id:alertId,status:'suppressed-quiet-hours'});
    return {status:202, body:{ok:true,queued:false,delivery:'suppressed-quiet-hours'}};
  }
  try {
    const result = await sendMetaWhatsApp(env, payload);
    const messageId = result?.messages?.[0]?.id || null;
    await recordHistory(env, {...payload,id:alertId,status:'sent',messageId});
    return {status:200, body:{ok:true,provider:'meta-whatsapp',messageId}};
  } catch (error) {
    console.error('AGCI WhatsApp delivery failed', error);
    await recordHistory(env, {...payload,id:alertId,status:'failed',error:String(error)});
    return {status:502, body:{ok:false,error:'Delivery failed'}};
  }
}

async function fetchJson(url, timeoutMs = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(()=>controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, {headers:{accept:'application/json'}, signal:controller.signal});
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(timer); }
}

function firstArray(root, paths) {
  for (const path of paths) {
    let value = root;
    for (const part of path.split('.')) value = value?.[part];
    if (Array.isArray(value)) return value;
  }
  return [];
}

function label(item) {
  return String(item?.symbol || item?.ticker || item?.pair || item?.currency || item?.name || item?.asset || 'N/A');
}

function score(item) {
  const value = Number(item?.score ?? item?.agciScore ?? item?.rankScore ?? item?.confidence);
  return Number.isFinite(value) ? value : null;
}

function recommendation(item) {
  return String(item?.recommendation || item?.signal || item?.rating || item?.action || '').trim();
}

function topLines(items, limit) {
  return items.slice(0, limit).map((item, i) => {
    const s = score(item); const rec = recommendation(item);
    return `${i+1}. ${label(item)}${s===null?'':` · ${s.toFixed(0)}/100`}${rec?` · ${rec}`:''}`;
  });
}

function parseTimestamp(data) {
  const raw = data?.updatedAt || data?.timestamp || data?.generatedAt || data?.asOf || data?.meta?.updatedAt;
  const time = raw ? Date.parse(raw) : NaN;
  return Number.isFinite(time) ? new Date(time) : null;
}

function watchlist(env) {
  try {
    const parsed = JSON.parse(env.WATCHLIST_JSON || '[]');
    if (Array.isArray(parsed)) return parsed.map(String).filter(Boolean);
  } catch {}
  return (env.WATCHLIST || '').split(',').map(x=>x.trim()).filter(Boolean);
}

function extractCollections(data) {
  return {
    currencies:firstArray(data,['opportunities.currencies','currencies','fx','currencyOpportunities']),
    equities:firstArray(data,['opportunities.equities','equities','stocks','stockOpportunities']),
    etfs:firstArray(data,['opportunities.etfs','etfs','etfOpportunities']),
    ratings:firstArray(data,['ciar','ratings','analystRatings','opportunities.ratings']),
    macro:firstArray(data,['macro','events','macroEvents','news'])
  };
}

function buildExecutiveDigest(data, env) {
  const collections = extractCollections(data);
  const {currencies,equities,etfs,ratings,macro} = collections;
  const lines = [];
  lines.push('DIVISAS'); lines.push(...(topLines(currencies,5).length?topLines(currencies,5):['Sin datos disponibles']));
  lines.push('\nACCIONES'); lines.push(...(topLines(equities,5).length?topLines(equities,5):['Sin datos disponibles']));
  lines.push('\nETFs'); lines.push(...(topLines(etfs,3).length?topLines(etfs,3):['Sin datos disponibles']));
  if (ratings.length) { lines.push('\nCIAR'); lines.push(...topLines(ratings,3)); }
  if (macro.length) { lines.push('\nRIESGO / AGENDA'); lines.push(...macro.slice(0,2).map((x,i)=>`${i+1}. ${label(x)}`)); }
  const wl = watchlist(env);
  if (wl.length) lines.push(`\nWATCHLIST: ${wl.join(', ')}`);
  lines.push(`\nVer análisis: ${env.PORTAL_URL || 'https://alexm3x.github.io/alex-global-currency-intelligence/'}`);
  const counts = Object.fromEntries(Object.entries(collections).map(([key,value])=>[key,value.length]));
  const actionableCount = counts.currencies + counts.equities + counts.etfs + counts.ratings;
  return {
    payload:{
      id:`digest-${localTime(env).date}-${localTime(env).time.replace(':','')}`,
      severity:'digest', title:'AGCI Resumen Ejecutivo', message:lines.join('\n').slice(0,1200)
    },
    counts,
    actionableCount
  };
}

function sourceHealth(data, env, now = Date.now()) {
  const timestamp = parseTimestamp(data);
  const maxAgeMinutes = Number(env.MAX_SOURCE_AGE_MINUTES || 180);
  const allowUndated = env.ALLOW_UNDATED_SOURCE === 'true';
  const ageMinutes = timestamp ? Math.max(0,Math.floor((now-timestamp.getTime())/60000)) : null;
  const timestampMissing = !timestamp;
  return {
    timestamp:timestamp?.toISOString() || null,
    timestampMissing,
    ageMinutes,
    maxAgeMinutes,
    stale:timestampMissing ? !allowUndated : ageMinutes > maxAgeMinutes
  };
}

async function loadMarketData(env) {
  const url = env.MARKET_DATA_URL || 'https://agci-market-data.proadmexico.workers.dev/';
  const data = await fetchJson(url, Number(env.SOURCE_TIMEOUT_MS || 12000));
  return {url,data,health:sourceHealth(data,env)};
}

function alignmentReport(data, env, health) {
  const digest = buildExecutiveDigest(data,env);
  const template = env.WHATSAPP_TEMPLATE_NAME || null;
  const minItems = Number(env.MIN_DIGEST_ITEMS || 1);
  const warnings = [];
  if (health.timestampMissing) warnings.push('La fuente no reporta una fecha verificable.');
  if (health.stale) warnings.push('La fuente no cumple la política de frescura.');
  if (digest.actionableCount < minItems) warnings.push('No hay suficientes elementos accionables para enviar el digest.');
  if (template === 'hello_world') warnings.push('La plantilla hello_world valida transporte, pero no muestra el contenido del digest.');
  return {
    aligned:!health.stale && digest.actionableCount >= minItems && template !== 'hello_world',
    transportReady:Boolean(template),
    contentVisible:template !== 'hello_world',
    minItems,
    warnings,
    ...digest
  };
}

async function runDigest(env, reason='manual') {
  const {data,health,url} = await loadMarketData(env);
  const report = alignmentReport(data,env,health);
  if (health.stale) {
    const detail = health.timestampMissing ? 'La fuente no reporta una fecha verificable.' : `La fuente tiene ${health.ageMinutes} minutos de antigüedad.`;
    return deliver(env, {
      id:`stale-${localTime(env).date}`,
      severity:'critical', title:'AGCI Data Governance',
      message:`${detail} No se emitió el digest. Fuente: ${url}`
    }, `stale-${localTime(env).date}`);
  }
  if (report.actionableCount < report.minItems) {
    await recordHistory(env,{id:`empty-digest-${localTime(env).date}`,status:'suppressed-no-actionable-data',counts:report.counts});
    return {status:422,body:{ok:false,error:'Digest suppressed: no actionable data',counts:report.counts}};
  }
  const payload = report.payload;
  payload.id = `${payload.id}-${reason}`;
  return deliver(env,payload,payload.id);
}

function authorized(request, env) {
  return Boolean(env.AGCI_ALERT_API_KEY && request.headers.get('x-agci-key') === env.AGCI_ALERT_API_KEY);
}

function safeStatus(env) {
  const template = env.WHATSAPP_TEMPLATE_NAME || null;
  const configured = Boolean(env.WHATSAPP_ACCESS_TOKEN && env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_TO && template);
  const digestTimes = (env.DIGEST_TIMES || '06:00,12:00,17:00').split(',').map(x=>x.trim());
  return {
    ok:true, service:'agci-alerts', provider:'meta-whatsapp', configured,
    deliveryMode:template === 'hello_world' ? 'test' : (template ? 'production' : 'unconfigured'),
    contentVisible:template !== 'hello_world',
    template, graphVersion:env.META_GRAPH_VERSION || 'v25.0',
    automationEnabled:env.AUTOMATION_ENABLED === 'true',
    digestTimes,
    scheduleAligned:digestTimes.every(x=>/^\d{2}:00$/.test(x)),
    marketDataUrl:env.MARKET_DATA_URL || 'https://agci-market-data.proadmexico.workers.dev/',
    watchlistCount:watchlist(env).length,
    deduplication:Boolean(env.ALERT_DEDUP), history:Boolean(env.ALERT_HISTORY),
    portalUrl:env.PORTAL_URL || null, time:new Date().toISOString()
  };
}

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (request.headers.get('Origin') && !origin) return json({ok:false,error:'Origin not allowed'},403,'null');
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors(origin)});
    const url = new URL(request.url);

    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health' || url.pathname === '/status')) {
      return json(safeStatus(env),200,origin);
    }
    if (request.method === 'GET' && url.pathname === '/source-health') {
      try {
        const source = await loadMarketData(env);
        return json({ok:true,url:source.url,...source.health},200,origin);
      } catch {
        return json({ok:false,error:'Market data unavailable'},503,origin);
      }
    }
    if (request.method !== 'POST') return json({ok:false,error:'Not found'},404,origin);
    if (!authorized(request,env)) return json({ok:false,error:'Unauthorized'},401,origin);

    if (url.pathname === '/preview') {
      try {
        const source = await loadMarketData(env);
        return json({ok:true,source:{url:source.url,...source.health},...alignmentReport(source.data,env,source.health)},200,origin);
      } catch (error) {
        console.error('AGCI preview failed',error);
        return json({ok:false,error:'Preview failed'},502,origin);
      }
    }
    if (url.pathname === '/digest') {
      try {
        const result = await runDigest(env,'manual');
        return json(result.body,result.status,origin);
      } catch (error) {
        console.error('AGCI digest failed',error);
        return json({ok:false,error:'Digest failed'},502,origin);
      }
    }
    if (!['/','/alert'].includes(url.pathname)) return json({ok:false,error:'Not found'},404,origin);

    let payload;
    try { payload = await request.json(); } catch { return json({ok:false,error:'Invalid JSON'},400,origin); }
    const result = await deliver(env,payload,request.headers.get('x-alert-id') || payload.id || '');
    return json(result.body,result.status,origin);
  },

  async scheduled(event, env, ctx) {
    if (env.AUTOMATION_ENABLED !== 'true') return;
    const {date,time} = localTime(env,new Date(event.scheduledTime));
    const times = (env.DIGEST_TIMES || '06:00,12:00,17:00').split(',').map(x=>x.trim());
    if (!times.includes(time)) return;
    ctx.waitUntil(runDigest(env,`scheduled-${date}-${time.replace(':','')}`).catch(error=>console.error('Scheduled AGCI digest failed',error)));
  }
};

export {validPayload, parseTimestamp, sourceHealth, extractCollections, buildExecutiveDigest, alignmentReport};

/*
Required encrypted Worker secrets:
WHATSAPP_ACCESS_TOKEN, WHATSAPP_PHONE_NUMBER_ID, WHATSAPP_TO, AGCI_ALERT_API_KEY

Production template:
WHATSAPP_TEMPLATE_NAME=agci_market_alert
WHATSAPP_TEMPLATE_LANGUAGE=es_MX

Safe runtime variables:
AUTOMATION_ENABLED=false
DIGEST_TIMES=06:00,12:00,17:00
MARKET_DATA_URL=https://agci-market-data.proadmexico.workers.dev/
PORTAL_URL=https://alexm3x.github.io/alex-global-currency-intelligence/
WATCHLIST=USD/MXN,EUR/USD,NVDA,NFLX,ORCL,TSLA,COWZ,QQQ
MAX_SOURCE_AGE_MINUTES=180
MIN_DIGEST_ITEMS=1
ALLOW_UNDATED_SOURCE=false
ALERT_TIMEZONE=America/Mexico_City
QUIET_START=22:00
QUIET_END=07:00

Optional KV bindings:
ALERT_DEDUP, ALERT_HISTORY
*/