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
  return x && typeof x.title === 'string' && typeof x.message === 'string' &&
    x.title.trim().length > 0 && x.title.length <= 120 &&
    x.message.trim().length > 0 && x.message.length <= 1200 && validSeverity;
}

function inQuietHours(payload, env) {
  if ((payload.severity || 'info') === 'critical') return false;
  const start = env.QUIET_START || '22:00';
  const end = env.QUIET_END || '07:00';
  const timezone = env.ALERT_TIMEZONE || 'America/Mexico_City';
  const parts = new Intl.DateTimeFormat('en-GB', {timeZone:timezone, hour:'2-digit', minute:'2-digit', hour12:false}).formatToParts(new Date());
  const hh = parts.find(x=>x.type==='hour')?.value || '00';
  const mm = parts.find(x=>x.type==='minute')?.value || '00';
  const now = `${hh}:${mm}`;
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

async function sendMetaWhatsApp(env, payload) {
  const required = ['WHATSAPP_ACCESS_TOKEN','WHATSAPP_PHONE_NUMBER_ID','WHATSAPP_TO'];
  const missing = required.filter(k => !env[k]);
  if (missing.length) throw new Error(`Missing Worker secrets: ${missing.join(', ')}`);

  const graphVersion = env.META_GRAPH_VERSION || 'v23.0';
  const url = `https://graph.facebook.com/${graphVersion}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const templateName = env.WHATSAPP_TEMPLATE_NAME || 'agci_market_alert';
  const language = env.WHATSAPP_TEMPLATE_LANGUAGE || 'es_MX';
  const body = {
    messaging_product:'whatsapp',
    recipient_type:'individual',
    to:env.WHATSAPP_TO,
    type:'template',
    template:{
      name:templateName,
      language:{code:language},
      components:[{
        type:'body',
        parameters:[
          {type:'text', text:payload.title.trim()},
          {type:'text', text:payload.message.trim()},
          {type:'text', text:(payload.severity || 'info').toUpperCase()}
        ]
      }]
    }
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

export default {
  async fetch(request, env) {
    const origin = allowedOrigin(request, env);
    if (request.headers.get('Origin') && !origin) return json({ok:false,error:'Origin not allowed'},403,'null');
    if (request.method === 'OPTIONS') return new Response(null,{status:204,headers:cors(origin)});

    const url = new URL(request.url);
    if (request.method === 'GET' && (url.pathname === '/' || url.pathname === '/health')) {
      return json({ok:true,service:'agci-alerts',provider:'meta-whatsapp',configured:Boolean(env.WHATSAPP_PHONE_NUMBER_ID && env.WHATSAPP_TO && env.WHATSAPP_TEMPLATE_NAME),time:new Date().toISOString()},200,origin);
    }
    if (request.method !== 'POST' || !['/','/alert'].includes(url.pathname)) return json({ok:false,error:'Not found'},404,origin);
    if (!env.AGCI_ALERT_API_KEY || request.headers.get('x-agci-key') !== env.AGCI_ALERT_API_KEY) return json({ok:false,error:'Unauthorized'},401,origin);

    let payload;
    try { payload = await request.json(); } catch { return json({ok:false,error:'Invalid JSON'},400,origin); }
    if (!validPayload(payload)) return json({ok:false,error:'Invalid alert payload'},422,origin);

    const alertId = request.headers.get('x-alert-id') || payload.id || '';
    if (await isDuplicate(env, alertId)) return json({ok:true,duplicate:true,delivery:'skipped'},200,origin);
    if (inQuietHours(payload, env)) return json({ok:true,queued:false,delivery:'suppressed-quiet-hours'},202,origin);

    try {
      const result = await sendMetaWhatsApp(env, payload);
      return json({ok:true,provider:'meta-whatsapp',messageId:result?.messages?.[0]?.id || null},200,origin);
    } catch (error) {
      console.error('AGCI WhatsApp delivery failed', error);
      return json({ok:false,error:'Delivery failed'},502,origin);
    }
  }
};

/*
Required encrypted Worker secrets:
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_TO
AGCI_ALERT_API_KEY

Recommended variables:
ALLOWED_ORIGINS=https://alexm3x.github.io,https://intelligence.alexmexico.com
META_GRAPH_VERSION=v23.0
WHATSAPP_TEMPLATE_NAME=agci_market_alert
WHATSAPP_TEMPLATE_LANGUAGE=es_MX
ALERT_TIMEZONE=America/Mexico_City
QUIET_START=22:00
QUIET_END=07:00
DEDUP_TTL_SECONDS=21600

Optional KV binding:
ALERT_DEDUP

Never expose tokens, API keys, sender IDs or destination numbers in public frontend code.
*/