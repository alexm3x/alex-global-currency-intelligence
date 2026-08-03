const JSON_HEADERS={'content-type':'application/json;charset=UTF-8'};
const cors=origin=>({'access-control-allow-origin':origin||'*','access-control-allow-methods':'POST,OPTIONS','access-control-allow-headers':'content-type,x-agci-key','vary':'Origin'});
const response=(body,status=200,origin='*')=>new Response(JSON.stringify(body),{status,headers:{...JSON_HEADERS,...cors(origin)}});

function validPayload(x){return x&&typeof x.title==='string'&&typeof x.message==='string'&&x.title.length<=120&&x.message.length<=1200}

async function sendMetaWhatsApp(env,payload){
  const url=`https://graph.facebook.com/${env.META_GRAPH_VERSION||'v23.0'}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`;
  const body={messaging_product:'whatsapp',to:env.WHATSAPP_TO,type:'template',template:{name:env.WHATSAPP_TEMPLATE_NAME||'agci_market_alert',language:{code:env.WHATSAPP_TEMPLATE_LANGUAGE||'en_US'},components:[{type:'body',parameters:[{type:'text',text:payload.title},{type:'text',text:payload.message},{type:'text',text:payload.severity||'info'}]}]}};
  const r=await fetch(url,{method:'POST',headers:{authorization:`Bearer ${env.WHATSAPP_ACCESS_TOKEN}`,'content-type':'application/json'},body:JSON.stringify(body)});
  const data=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(`WhatsApp API ${r.status}: ${JSON.stringify(data)}`);
  return data;
}

export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin')||'*';
    if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
    if(request.method!=='POST')return response({ok:false,error:'Method not allowed'},405,origin);
    if(env.AGCI_ALERT_API_KEY&&request.headers.get('x-agci-key')!==env.AGCI_ALERT_API_KEY)return response({ok:false,error:'Unauthorized'},401,origin);
    let payload;try{payload=await request.json()}catch{return response({ok:false,error:'Invalid JSON'},400,origin)}
    if(!validPayload(payload))return response({ok:false,error:'Invalid alert payload'},422,origin);
    try{
      const result=await sendMetaWhatsApp(env,payload);
      return response({ok:true,provider:'meta-whatsapp',result},200,origin);
    }catch(error){
      console.error(error);
      return response({ok:false,error:'Delivery failed'},502,origin);
    }
  }
};

/* Required encrypted Worker secrets:
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_TO (E.164 digits, e.g. 5215555555555)
AGCI_ALERT_API_KEY
Optional variables:
META_GRAPH_VERSION, WHATSAPP_TEMPLATE_NAME, WHATSAPP_TEMPLATE_LANGUAGE
Never expose these values in frontend JavaScript or GitHub commits.
*/