(()=>{
  const MARKET='https://agci-market-data.proadmexico.workers.dev/';
  const ALERTS='https://alex-global-currency-intelligence.proadmexico.workers.dev/health';
  const GDELT='https://api.gdeltproject.org/api/v2/doc/doc';
  const NEWS_QUERIES=[
    '(Federal Reserve OR inflation OR Treasury yields OR earnings OR stocks) sourcecountry:US',
    '(Banxico OR Mexico economy OR peso OR USMCA OR nearshoring)',
    '(artificial intelligence OR semiconductors OR cloud computing OR data centers)',
    '(real estate OR commercial property OR mortgage rates OR credit conditions)',
    '(ECB OR Europe economy OR China economy OR Japan economy OR oil prices)'
  ];
  const CATEGORY_RULES=[
    ['MERCADOS',/stocks?|equities|treasury|yield|federal reserve|inflation|earnings|market/i],
    ['MÉXICO',/mexico|mexican|banxico|peso|usmca|nearshoring/i],
    ['IA Y TECNOLOGÍA',/artificial intelligence|\bai\b|semiconductor|chip|cloud|data center|technology/i],
    ['BIENES RAÍCES',/real estate|property|mortgage|housing|rent|commercial real estate/i],
    ['GLOBAL',/europe|ecb|china|japan|oil|geopolit|trade/i]
  ];
  const esc=v=>String(v??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  const pickArray=(o,paths)=>{for(const p of paths){let v=o;for(const k of p.split('.'))v=v?.[k];if(Array.isArray(v))return v;}return[]};
  const stamp=o=>o?.updatedAt||o?.timestamp||o?.generatedAt||o?.asOf||o?.meta?.updatedAt||null;
  const ageMinutes=s=>{const t=Date.parse(s);return Number.isFinite(t)?Math.max(0,Math.round((Date.now()-t)/60000)):null};
  const itemLabel=x=>x?.symbol||x?.ticker||x?.pair||x?.currency||x?.name||x?.asset||'Activo';
  const itemScore=x=>{const n=Number(x?.score??x?.agciScore??x?.rankScore??x?.confidence);return Number.isFinite(n)?Math.round(n):null};
  const signal=x=>x?.recommendation||x?.signal||x?.rating||x?.action||'';

  async function getJSON(url){
    const c=new AbortController();const t=setTimeout(()=>c.abort(),10000);
    try{const r=await fetch(url,{headers:{accept:'application/json'},signal:c.signal});if(!r.ok)throw new Error(`HTTP ${r.status}`);return await r.json()}
    finally{clearTimeout(t)}
  }
  function openView(event,id){event.preventDefault();if(typeof setView==='function')setView(id)}
  function statusHTML(kind,text,detail=''){return `<span class="executive-status"><i class="executive-dot ${kind}"></i>${esc(text)}</span>${detail?`<p class="executive-note">${esc(detail)}</p>`:''}`}

  function inject(){
    const home=document.querySelector('#home');
    if(!home||document.querySelector('#executiveCenter'))return;
    const el=document.createElement('section');
    el.id='executiveCenter';el.className='executive-center';
    el.innerHTML=`<div class="executive-center__head"><div><p class="rubric">EXECUTIVE INTELLIGENCE CENTER</p><h2>Decision dashboard</h2></div><div class="executive-center__meta" id="execUpdated">Verificando sistemas…</div></div><div id="execBanner" class="executive-banner">Conectando fuentes y controles operativos…</div><div class="executive-grid"><article class="executive-card"><h3>Market data</h3><div id="execMarket" class="executive-skeleton">Validando endpoint…</div></article><article class="executive-card"><h3>WhatsApp</h3><div id="execWhatsApp" class="executive-skeleton">Validando Worker…</div></article><article class="executive-card"><h3>Actionable signals</h3><div id="execSignals" class="executive-skeleton">Calculando…</div></article><article class="executive-card"><h3>Governance</h3><div id="execGovernance" class="executive-skeleton">Revisando frescura…</div></article><article class="executive-card wide"><h3>Top opportunities</h3><ul id="execOpportunities" class="executive-list"><li>Cargando ranking…</li></ul></article><article class="executive-card wide"><h3>Immediate actions</h3><div class="executive-actions"><button id="execRefresh" type="button">Actualizar ahora</button><a href="#markets" id="execOpenMarkets">Abrir rankings</a><a href="#briefing" id="execOpenBriefing">Ver briefing</a></div><p class="executive-note">Las alertas financieras se presentan como apoyo informativo. No constituyen una orden automática de inversión.</p></article></div>`;
    home.prepend(el);
    document.querySelector('#execRefresh')?.addEventListener('click',load);
    document.querySelector('#execOpenMarkets')?.addEventListener('click',event=>openView(event,'markets'));
    document.querySelector('#execOpenBriefing')?.addEventListener('click',event=>openView(event,'briefing'));
  }

  async function load(){
    inject();
    const banner=document.querySelector('#execBanner');
    const now=new Date();
    document.querySelector('#execUpdated').textContent=`Última revisión: ${now.toLocaleString('es-MX')}`;
    let market,alerts;
    const results=await Promise.allSettled([getJSON(MARKET),getJSON(ALERTS)]);
    if(results[0].status==='fulfilled')market=results[0].value;
    if(results[1].status==='fulfilled')alerts=results[1].value;
    const ts=market?stamp(market):null;const age=ageMinutes(ts);const stale=age===null||age>180;
    document.querySelector('#execMarket').innerHTML=market?statusHTML(stale?'warn':'ok',stale?'Datos con validación pendiente':'Endpoint operativo',age===null?'La fuente no publica fecha verificable.':`Antigüedad aproximada: ${age} min.`):statusHTML('bad','Endpoint no disponible','Se conserva la última información visible del portal.');
    const transport=Boolean(alerts?.configured);const prod=alerts?.deliveryMode==='production';
    document.querySelector('#execWhatsApp').innerHTML=alerts?statusHTML(transport?(prod?'ok':'warn'):'bad',transport?(prod?'Producción lista':'Modo de prueba'):'No configurado',prod?`Plantilla: ${alerts.template}`:'El transporte puede funcionar, pero el contenido ejecutivo requiere plantilla aprobada.'):statusHTML('bad','Worker no disponible','Revise despliegue y dominio de Cloudflare.');
    const currencies=market?pickArray(market,['opportunities.currencies','currencies','fx','currencyOpportunities']):[];
    const equities=market?pickArray(market,['opportunities.equities','equities','stocks','stockOpportunities']):[];
    const etfs=market?pickArray(market,['opportunities.etfs','etfs','etfOpportunities']):[];
    const combined=[...currencies,...equities,...etfs];
    const actionable=combined.filter(x=>(itemScore(x)??0)>=80||/buy|compra|strong/i.test(signal(x)));
    document.querySelector('#execSignals').innerHTML=`<div class="executive-kpi"><strong>${actionable.length}</strong><span>señales</span></div><p class="executive-note">Criterio visual: score ≥80 o señal de compra publicada por la fuente.</p>`;
    document.querySelector('#execGovernance').innerHTML=statusHTML(market&&!stale?'ok':market?'warn':'bad',market&&!stale?'Frescura validada':market?'Revisión requerida':'Fuente caída',ts?`Marca de tiempo: ${new Date(ts).toLocaleString('es-MX')}`:'Sin marca de tiempo verificable.');
    const top=combined.slice().sort((a,b)=>(itemScore(b)??-1)-(itemScore(a)??-1)).slice(0,5);
    document.querySelector('#execOpportunities').innerHTML=top.length?top.map(x=>`<li><span>${esc(itemLabel(x))}</span><strong>${itemScore(x)??'—'}${signal(x)?` · ${esc(signal(x))}`:''}</strong></li>`).join(''):'<li><span>Sin oportunidades estructuradas</span><strong>Revisar fuente</strong></li>';
    const aligned=Boolean(market&&!stale&&transport&&prod&&actionable.length);
    banner.className=`executive-banner${aligned?' ok':''}`;
    banner.textContent=aligned?'Sistemas alineados: datos vigentes, alertas en producción y señales accionables disponibles.':'Atención: la toma de decisiones requiere revisar uno o más controles de datos, contenido o entrega.';
  }

  function injectNewsStyles(){
    if(document.querySelector('#homepageDecisionNewsStyles'))return;
    const style=document.createElement('style');
    style.id='homepageDecisionNewsStyles';
    style.textContent=`
      .homepage-news{margin:34px 0 10px;border-top:1px solid var(--line);padding-top:22px}
      .homepage-news__head{display:flex;justify-content:space-between;gap:18px;align-items:flex-end;margin-bottom:16px}
      .homepage-news__head h2{margin:3px 0 0;font-size:clamp(26px,3vw,38px);line-height:1.05}
      .homepage-news__tools{display:flex;gap:10px;align-items:center;flex-wrap:wrap;justify-content:flex-end}
      .homepage-news__status{font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.05em}
      .homepage-news__refresh{border:1px solid var(--line);background:var(--paper);color:var(--ink);padding:9px 12px;font-weight:700;cursor:pointer}
      .homepage-news__grid{display:grid;grid-template-columns:1.35fr 1fr 1fr;gap:14px}
      .homepage-news__card{border:1px solid var(--line);background:var(--paper);padding:18px;display:flex;flex-direction:column;min-height:250px}
      .homepage-news__card:first-child{grid-row:span 2;min-height:514px;background:var(--soft)}
      .homepage-news__meta{display:flex;justify-content:space-between;gap:12px;font-size:10px;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
      .homepage-news__tag{color:#8b1e2d;font-weight:800}
      .homepage-news__card h3{font-family:'Source Serif 4',serif;font-size:22px;line-height:1.12;margin:14px 0 12px}
      .homepage-news__card:first-child h3{font-size:34px}
      .homepage-news__card p{font-size:13px;line-height:1.45;color:var(--muted);margin:0 0 12px}
      .homepage-news__decision{margin-top:auto;border-top:1px solid var(--line);padding-top:12px}
      .homepage-news__decision b{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.06em;color:#8b1e2d;margin-bottom:5px}
      .homepage-news__decision span{font-size:13px;line-height:1.4;color:var(--ink)}
      .homepage-news__link{margin-top:13px;color:var(--ink);font-size:12px;font-weight:800;text-decoration:none}
      .homepage-news__footer{display:flex;justify-content:space-between;gap:12px;align-items:center;margin-top:14px;padding-top:14px;border-top:1px solid var(--line)}
      .homepage-news__footer p{margin:0;color:var(--muted);font-size:12px}
      .homepage-news__footer button{border:0;background:transparent;color:var(--ink);font-weight:800;cursor:pointer}
      @media(max-width:980px){.homepage-news__grid{grid-template-columns:1fr 1fr}.homepage-news__card:first-child{grid-row:auto;grid-column:1/-1;min-height:auto}.homepage-news__card:first-child h3{font-size:28px}}
      @media(max-width:650px){.homepage-news__head{align-items:flex-start;flex-direction:column}.homepage-news__tools{justify-content:flex-start}.homepage-news__grid{grid-template-columns:1fr}.homepage-news__card:first-child{grid-column:auto}.homepage-news__card{min-height:auto}.homepage-news__footer{align-items:flex-start;flex-direction:column}}
    `;
    document.head.appendChild(style);
  }

  function categoryFor(text){return(CATEGORY_RULES.find(([,rule])=>rule.test(text))||['GLOBAL'])[0]}
  function decisionFor(category,text){
    const lower=text.toLowerCase();
    if(/rate hike|inflation rises|oil surge|downgrade|recession|default|war|sanction/.test(lower))return'Reducir exposición sensible y revisar coberturas.';
    if(/rate cut|inflation falls|strong earnings|growth accelerates|agreement|reopens/.test(lower))return'Confirmar datos y evaluar compras graduales en beneficiarios directos.';
    return{
      'MERCADOS':'Revisar impacto en tasas, valuaciones y amplitud del mercado antes de aumentar riesgo.',
      'MÉXICO':'Evaluar impacto en MXN, crédito, nearshoring y activos industriales mexicanos.',
      'IA Y TECNOLOGÍA':'Separar crecimiento de ingresos de gasto de capital; privilegiar flujo libre verificable.',
      'BIENES RAÍCES':'Recalcular costo de deuda, cobertura y sensibilidad del valor a cap rates.',
      'GLOBAL':'Revisar divisas, energía, comercio y exposición regional.'
    }[category]||'Revisar exposición y confirmar el dato en su fuente original.'
  }
  function relevanceScore(article){
    const text=`${article.title||''} ${article.domain||''}`;let score=0;
    if(/reuters|bloomberg|ft\.com|wsj\.com|economist\.com|federalreserve\.gov|banxico\.org\.mx|ecb\.europa\.eu|sec\.gov/i.test(text))score+=5;
    if(/rate|inflation|earnings|gdp|jobs|oil|currency|peso|ai|semiconductor|real estate|mortgage|usmca/i.test(text))score+=4;
    if(/breaking|exclusive|decision|raises|cuts|surges|falls|record/i.test(text))score+=2;
    return score
  }
  async function fetchNews(query){
    const url=new URL(GDELT);url.searchParams.set('query',query);url.searchParams.set('mode','artlist');url.searchParams.set('format','json');url.searchParams.set('maxrecords','20');url.searchParams.set('timespan','36h');url.searchParams.set('sort','datedesc');
    const response=await fetch(url.toString());if(!response.ok)throw new Error(`GDELT ${response.status}`);const data=await response.json();return data.articles||[]
  }
  function fallbackNews(){
    return[
      {category:'MERCADOS',title:'Mercados: calidad y liquidez antes que concentración',domain:'AGCI Research Desk',summary:'El costo de capital obliga a distinguir entre crecimiento rentable y expectativas excesivas.',decision:'Favorecer balances sólidos y compras escalonadas; conservar liquidez.'},
      {category:'MÉXICO',title:'México: oportunidad industrial con filtros de infraestructura',domain:'AGCI Research Desk',summary:'Nearshoring, logística y manufactura siguen siendo atractivos, pero energía, agua y cumplimiento importan.',decision:'Priorizar activos con contratos, servicios disponibles y exposición controlada a USMCA.'},
      {category:'IA Y TECNOLOGÍA',title:'IA: monetización verificable, no sólo gasto de capital',domain:'AGCI Research Desk',summary:'El mercado exige ingresos recurrentes, productividad y flujo libre después de inversión.',decision:'Separar plataformas rentables de infraestructura financiada con deuda creciente.'},
      {category:'BIENES RAÍCES',title:'Bienes raíces: refinanciamiento antes que ocupación nominal',domain:'AGCI Research Desk',summary:'Una propiedad ocupada puede perder valor si deuda y cap rates suben.',decision:'Recalcular cobertura y vencimientos con tasas de estrés.'},
      {category:'GLOBAL',title:'Petróleo, comercio y bancos centrales siguen marcando la prima de riesgo',domain:'AGCI Research Desk',summary:'Energía y política monetaria pueden alterar simultáneamente inflación, divisas y valuaciones.',decision:'Mantener coberturas moderadas y revisar sensibilidad regional.'}
    ]
  }
  function renderNews(section,articles,fallback=false){
    const grid=section.querySelector('#homepageNewsGrid');
    grid.innerHTML=articles.slice(0,5).map(article=>{
      const text=`${article.title||''} ${article.domain||''}`;const category=article.category||categoryFor(text);
      const date=article.seendate?new Date(String(article.seendate).replace(' ','T')):new Date();
      const time=Number.isNaN(date.getTime())?'Hoy':date.toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'});
      const summary=article.summary||`Noticia priorizada por su posible impacto en ${category.toLowerCase()}, valuaciones y decisiones de asignación.`;
      const decision=article.decision||decisionFor(category,text);
      const href=article.url&&article.url!=='#'?article.url:null;
      return`<article class="homepage-news__card"><div class="homepage-news__meta"><span class="homepage-news__tag">${esc(category)}</span><span>${esc(article.domain||'Fuente')} · ${time}</span></div><h3>${esc(article.title||'Actualización estratégica')}</h3><p>${esc(summary)}</p><div class="homepage-news__decision"><b>Lectura para decisión</b><span>${esc(decision)}</span></div>${href?`<a class="homepage-news__link" href="${esc(href)}" target="_blank" rel="noopener noreferrer">Ver fuente original →</a>`:`<a class="homepage-news__link" href="#briefing" data-news-briefing>Abrir análisis AGCI →</a>`}</article>`
    }).join('');
    section.querySelectorAll('[data-news-briefing]').forEach(link=>link.addEventListener('click',event=>openView(event,'briefing')));
    section.querySelector('#homepageNewsStatus').textContent=fallback?'Vista estratégica AGCI':`Actualizado ${new Date().toLocaleTimeString('es-MX',{hour:'2-digit',minute:'2-digit'})}`
  }
  function injectHomepageNews(){
    const home=document.querySelector('#home');if(!home||document.querySelector('#homepageDecisionNews'))return;
    injectNewsStyles();
    const section=document.createElement('section');section.id='homepageDecisionNews';section.className='homepage-news';
    section.innerHTML=`<div class="homepage-news__head"><div><p class="rubric">DECISION INTELLIGENCE</p><h2>Lo que puede mover decisiones hoy</h2></div><div class="homepage-news__tools"><span id="homepageNewsStatus" class="homepage-news__status">Actualizando…</span><button id="homepageNewsRefresh" class="homepage-news__refresh" type="button">Actualizar</button></div></div><div id="homepageNewsGrid" class="homepage-news__grid" aria-live="polite"></div><div class="homepage-news__footer"><p>Selección automática por relevancia. Confirmar en la fuente original antes de ejecutar una decisión.</p><button id="homepageNewsOpenBriefing" type="button">Abrir Daily Briefing →</button></div>`;
    const front=document.querySelector('#dailyStrategicFront');if(front)front.insertAdjacentElement('afterend',section);else home.prepend(section);
    section.querySelector('#homepageNewsOpenBriefing').addEventListener('click',event=>openView(event,'briefing'));
    const refresh=section.querySelector('#homepageNewsRefresh');
    async function loadNews(){
      refresh.disabled=true;section.querySelector('#homepageNewsStatus').textContent='Actualizando…';
      try{
        const results=await Promise.allSettled(NEWS_QUERIES.map(fetchNews));const seen=new Set();
        const articles=results.flatMap(result=>result.status==='fulfilled'?result.value:[]).filter(article=>{const key=`${article.url}|${article.title}`;if(!article.title||seen.has(key))return false;seen.add(key);return true}).sort((a,b)=>relevanceScore(b)-relevanceScore(a));
        if(!articles.length)throw new Error('Sin resultados');renderNews(section,articles,false)
      }catch(error){renderNews(section,fallbackNews(),true)}finally{refresh.disabled=false}
    }
    refresh.addEventListener('click',loadNews);loadNews()
  }

  document.addEventListener('DOMContentLoaded',()=>{inject();injectHomepageNews();load();setInterval(load,300000)});
})();