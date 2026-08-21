(() => {
  'use strict';
  if (window.__VIAJES_ASC_TRAVEL_OS__) return;
  window.__VIAJES_ASC_TRAVEL_OS__ = true;

  const DNA_KEY = 'viajesASCTravelDNA';
  const GUEST_KEY = 'viajesASCGuestMode';
  const LAST_INTENT_KEY = 'viajesASCLastStructuredIntent';
  const $ = (s, root=document) => root.querySelector(s);
  const $$ = (s, root=document) => [...root.querySelectorAll(s)];
  const safeJSON = (key, fallback=null) => { try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; } catch { return fallback; } };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  const DEFAULT_DNA = {
    schema:'asc-travel-dna-v1', origin:'MEX', travelerType:'couple', tier:'premium', currency:'MXN',
    interests:['gastronomía','cultura','eventos'], cabin:'economy', directPreference:'preferred',
    lodgingLevel:'5-star', pace:'balanced', consent:true, updatedAt:null
  };

  function readDNA(){ return {...DEFAULT_DNA, ...(safeJSON(DNA_KEY,{}) || {})}; }
  function saveDNA(next){
    const dna={...DEFAULT_DNA,...next,schema:'asc-travel-dna-v1',updatedAt:new Date().toISOString()};
    if(dna.consent!==false) localStorage.setItem(DNA_KEY,JSON.stringify(dna));
    window.dispatchEvent(new CustomEvent('viajes:travel-dna-updated',{detail:{dna}}));
    renderDNAStatus();
    return dna;
  }
  function clearDNA(){ localStorage.removeItem(DNA_KEY); localStorage.setItem(GUEST_KEY,'true'); renderDNAStatus(); }

  function styles(){
    if($('#asc-travel-os-styles')) return;
    const el=document.createElement('style'); el.id='asc-travel-os-styles';
    el.textContent=`
      .asc-os-launcher{display:flex;gap:8px;align-items:center;margin:12px 0 2px;flex-wrap:wrap}.asc-os-chip{min-height:38px;padding:8px 11px;border:1px solid rgba(148,163,184,.22);border-radius:999px;background:rgba(5,11,16,.5);color:#a8b5c7;font-size:10px;font-weight:800}.asc-os-chip strong{color:#e8c66a}.asc-os-chip:hover{border-color:rgba(232,198,106,.55);color:#fff}.asc-dna-dialog,.asc-compare-dialog{width:min(920px,calc(100vw - 28px));max-height:calc(100dvh - 28px);margin:auto;border:1px solid rgba(103,232,249,.25);border-radius:18px;background:#071119;color:#e2e8f0;box-shadow:0 34px 110px rgba(0,0,0,.75)}.asc-dna-dialog::backdrop,.asc-compare-dialog::backdrop{background:rgba(1,5,9,.78);backdrop-filter:blur(8px)}.asc-os-head{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;padding:20px 22px;border-bottom:1px solid #1e293b}.asc-os-head p{color:#e8c66a;font:700 9px/1.2 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}.asc-os-head h2{margin-top:6px;color:#fff;font-size:24px;font-weight:700}.asc-os-close{width:38px;height:38px;border:1px solid #334155;border-radius:50%;font-size:22px}.asc-os-body{padding:20px 22px;overflow:auto}.asc-dna-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.asc-dna-grid label>span{display:block;margin-bottom:6px;color:#94a3b8;font:700 9px/1.2 ui-monospace,monospace;text-transform:uppercase}.asc-dna-grid input,.asc-dna-grid select{width:100%;min-height:44px;border:1px solid #334155;border-radius:9px;background:#050b10;padding:9px 11px;color:#f8fafc}.asc-dna-interests{grid-column:1/-1;display:flex;flex-wrap:wrap;gap:7px}.asc-dna-interests label{position:relative}.asc-dna-interests input{position:absolute;opacity:0}.asc-dna-interests span{display:block;padding:9px 11px;border:1px solid #334155;border-radius:999px;color:#94a3b8;font-size:10px;cursor:pointer}.asc-dna-interests input:checked+span{border-color:#e8c66a;color:#f3d982;background:rgba(232,198,106,.08)}.asc-os-actions{display:flex;gap:9px;justify-content:flex-end;flex-wrap:wrap;padding:16px 22px;border-top:1px solid #1e293b}.asc-os-primary,.asc-os-secondary{min-height:42px;padding:9px 14px;border-radius:9px;font-size:11px;font-weight:850}.asc-os-primary{background:#e8c66a;color:#071119}.asc-os-secondary{border:1px solid #334155;color:#cbd5e1}.asc-copilot-receipt{margin-top:10px;padding:12px 14px;border:1px solid rgba(52,211,153,.25);border-radius:11px;background:rgba(52,211,153,.045);color:#9fb0c4;font-size:10px;line-height:1.55}.asc-copilot-receipt strong{color:#34d399}.asc-compare-bar{position:fixed;right:18px;bottom:88px;z-index:75;display:none;gap:8px;align-items:center;padding:8px;border:1px solid rgba(232,198,106,.3);border-radius:12px;background:rgba(5,11,16,.94);box-shadow:0 15px 50px rgba(0,0,0,.4)}.asc-compare-bar.is-active{display:flex}.asc-compare-bar span{padding:0 5px;color:#e8c66a;font-size:10px;font-weight:800}.asc-compare-add{margin-top:9px;width:100%;min-height:34px;border:1px solid rgba(103,232,249,.25);border-radius:8px;color:#67e8f9;font-size:10px;font-weight:800}.asc-compare-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px}.asc-compare-card{padding:14px;border:1px solid #1e293b;border-radius:12px;background:#050b10}.asc-compare-card h3{color:#fff;font-size:17px}.asc-compare-card dl{margin-top:12px;display:grid;gap:8px}.asc-compare-card div{display:flex;justify-content:space-between;gap:8px;border-bottom:1px solid rgba(51,65,85,.45);padding-bottom:7px}.asc-compare-card dt{color:#64748b;font-size:9px;text-transform:uppercase}.asc-compare-card dd{color:#e2e8f0;font-size:10px;text-align:right}.asc-compare-winner{border-color:rgba(232,198,106,.55);box-shadow:0 0 0 1px rgba(232,198,106,.08)}@media(max-width:760px){.asc-dna-dialog,.asc-compare-dialog{width:100vw;height:100dvh;max-height:100dvh;border:0;border-radius:0}.asc-dna-grid{grid-template-columns:1fr}.asc-compare-bar{left:10px;right:10px;bottom:86px;justify-content:space-between}}
    `; document.head.appendChild(el);
  }

  function buildDNA(){
    if($('#ascDNADialog')) return;
    const d=document.createElement('dialog'); d.id='ascDNADialog'; d.className='asc-dna-dialog';
    d.innerHTML=`<form id="ascDNAForm" method="dialog"><header class="asc-os-head"><div><p>ASC Personalization Foundation</p><h2>ASC Travel DNA</h2></div><button class="asc-os-close" type="button" data-close-dna aria-label="Cerrar">×</button></header><div class="asc-os-body"><p style="margin:0 0 16px;color:#94a3b8;font-size:11px;line-height:1.6">Cinco preferencias iniciales crean un perfil editable. Puede usar modo invitado o eliminarlo en cualquier momento.</p><div class="asc-dna-grid"><label><span>Ciudad habitual de salida</span><input name="origin" maxlength="5" placeholder="MEX"></label><label><span>Tipo de viajero</span><select name="travelerType"><option value="solo">Solo</option><option value="couple">Pareja</option><option value="family">Familia</option><option value="friends">Amigos</option><option value="business">Negocios</option></select></label><label><span>Nivel de viaje</span><select name="tier"><option value="value">Value</option><option value="premium">Premium</option><option value="luxury">Lujo</option><option value="ultra-luxury">Ultra lujo</option></select></label><label><span>Moneda preferida</span><select name="currency"><option>MXN</option><option>USD</option><option>EUR</option><option>GBP</option><option>JPY</option><option>CHF</option><option>CAD</option></select></label><label><span>Cabina habitual</span><select name="cabin"><option value="economy">Economy</option><option value="premium">Premium Economy</option><option value="business">Business</option><option value="first">First</option></select></label><label><span>Ritmo</span><select name="pace"><option value="relaxed">Relajado</option><option value="balanced">Balanceado</option><option value="intensive">Intensivo</option></select></label><div class="asc-dna-interests" aria-label="Intereses">${['gastronomía','golf','esquí','buceo','playa','cultura','arte','museos','conciertos','deportes','Fórmula 1','tenis','fútbol','shopping','nightlife','naturaleza','wellness','arquitectura','negocios'].map(x=>`<label><input type="checkbox" name="interests" value="${esc(x)}"><span>${esc(x)}</span></label>`).join('')}</div></div></div><footer class="asc-os-actions"><button type="button" class="asc-os-secondary" data-clear-dna>Usar como invitado</button><button type="submit" class="asc-os-primary">Guardar Travel DNA</button></footer></form>`;
    document.body.appendChild(d);
    const f=$('#ascDNAForm');
    $('[data-close-dna]',d).onclick=()=>d.close();
    $('[data-clear-dna]',d).onclick=()=>{clearDNA();d.close();};
    f.addEventListener('submit',e=>{e.preventDefault();const fd=new FormData(f);saveDNA({origin:String(fd.get('origin')||'MEX').toUpperCase(),travelerType:fd.get('travelerType'),tier:fd.get('tier'),currency:fd.get('currency'),cabin:fd.get('cabin'),pace:fd.get('pace'),interests:fd.getAll('interests'),consent:true});localStorage.removeItem(GUEST_KEY);d.close();});
  }

  function openDNA(){
    const dna=readDNA(), d=$('#ascDNADialog'), f=$('#ascDNAForm'); if(!d||!f)return;
    ['origin','travelerType','tier','currency','cabin','pace'].forEach(k=>{if(f.elements[k])f.elements[k].value=dna[k]||'';});
    $$('input[name="interests"]',f).forEach(i=>i.checked=(dna.interests||[]).includes(i.value)); d.showModal();
  }

  function buildLauncher(){
    if($('#ascOSLauncher'))return; const host=$('#ascPrimaryNav')||$('.workspace-tabs'); if(!host)return;
    const wrap=document.createElement('div');wrap.id='ascOSLauncher';wrap.className='asc-os-launcher';wrap.innerHTML=`<button class="asc-os-chip" type="button" data-open-dna><strong>Travel DNA</strong> · <span id="ascDNAStatus">configurar</span></button><button class="asc-os-chip" type="button" data-open-compare>Comparador · <span id="ascCompareCount">0</span>/5</button>`;host.insertAdjacentElement('afterend',wrap);$('[data-open-dna]',wrap).onclick=openDNA;$('[data-open-compare]',wrap).onclick=openCompare;renderDNAStatus();
  }
  function renderDNAStatus(){ const el=$('#ascDNAStatus'); if(!el)return; const guest=localStorage.getItem(GUEST_KEY)==='true'; const saved=!!localStorage.getItem(DNA_KEY); el.textContent=guest?'invitado':saved?`${readDNA().tier} · ${readDNA().currency}`:'configurar'; }

  function parseIntent(text){
    const dna=readDNA(); const raw=String(text||'').trim(); const lower=raw.toLowerCase();
    const money=raw.match(/(?:\$|usd\s*|mxn\s*|eur\s*)\s?([\d,.]+)/i); const days=lower.match(/(\d{1,2})\s*(?:días|dias|noches)/); const month=lower.match(/\b(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/);
    const knownCities=['tokyo','paris','madrid','rome','roma','london','londres','new york','nueva york','miami','aspen','dubai','singapore','singapur','bangkok','barcelona','lisboa','lisbon','seoul','seúl','los angeles','san francisco','cancún','cancun'];
    const destination=knownCities.find(c=>lower.includes(c))||null;
    const interests=['gastronomía','golf','esquí','buceo','playa','cultura','arte','museos','conciertos','deportes','shopping','nightlife','naturaleza','wellness','negocios'].filter(i=>lower.includes(i.normalize('NFD').replace(/[\u0300-\u036f]/g,''))||lower.includes(i));
    const currency=/\busd\b|dólares|dolares/i.test(raw)?'USD':/\beur\b|euros/i.test(raw)?'EUR':/\bmxn\b|pesos/i.test(raw)?'MXN':dna.currency;
    const intent={schema:'asc-travel-intent-v1',raw,origin:dna.origin,destination,durationDays:days?Number(days[1]):null,periodApprox:month?month[1]:null,budget:money?Number(money[1].replace(/,/g,'')):null,currency,interests:interests.length?interests:dna.interests,travelerType:dna.travelerType,tier:dna.tier,cabin:dna.cabin,parsedAt:new Date().toISOString(),confidence:destination?0.86:0.62};
    localStorage.setItem(LAST_INTENT_KEY,JSON.stringify(intent)); return intent;
  }

  function receipt(intent){
    const box=$('#ascCommandStatus'); if(!box)return; box.className='asc-copilot-receipt';
    const bits=[intent.destination&&`Destino: ${intent.destination}`,intent.durationDays&&`${intent.durationDays} días`,intent.budget&&`${intent.budget.toLocaleString('es-MX')} ${intent.currency}`,intent.periodApprox&&intent.periodApprox].filter(Boolean);
    box.innerHTML=`<strong>Copilot entendió:</strong> ${esc(bits.join(' · ')||'intención general de viaje')}. ${intent.confidence<.7?'Complete destino/fechas en el asistente para elevar precisión.':'Abriremos el flujo con estas prioridades.'}`;
  }

  function bindCopilot(){
    const input=$('#ascNaturalIntent'), submit=$('#ascNaturalSubmit'); if(!input||!submit||submit.dataset.osBound)return; submit.dataset.osBound='1';
    submit.addEventListener('click',()=>{const intent=parseIntent(input.value);receipt(intent);window.dispatchEvent(new CustomEvent('viajes:structured-intent',{detail:{intent}}));
      const legacy=$('#interestInput'); if(legacy&&intent.interests?.length)legacy.value=intent.interests.join(', '); const budget=$('#budgetInput'); if(budget&&intent.budget)budget.value=intent.budget; const origin=$('#originInput'); if(origin&&intent.origin)origin.value=intent.origin;
    },true);
  }

  const compare=[]; let latestData=null;
  function normalizeDestination(d){return {id:d.id||d.city,name:d.city||d.name,country:d.country||'',score:Number(d.query_score||d.asc_score||0),daily:Number(d.daily_cost_mxn||d.daily_cost||0),fx:Number(d.fx_advantage_pct||0),connectivity:Number(d.connectivity_score||0),why:d.why_value||'',airport:d.airport||''};}
  function addCompare(d){const x=normalizeDestination(d);if(compare.some(v=>v.id===x.id)||compare.length>=5)return;compare.push(x);renderCompareBar();}
  function renderCompareBar(){let bar=$('#ascCompareBar');if(!bar){bar=document.createElement('div');bar.id='ascCompareBar';bar.className='asc-compare-bar';bar.innerHTML='<span></span><button class="asc-os-primary" type="button">Comparar ahora</button>';document.body.appendChild(bar);$('button',bar).onclick=openCompare;}bar.classList.toggle('is-active',compare.length>0);$('span',bar).textContent=`${compare.length} destino${compare.length===1?'':'s'} seleccionado${compare.length===1?'':'s'}`;const c=$('#ascCompareCount');if(c)c.textContent=compare.length;}
  function buildCompare(){if($('#ascCompareDialog'))return;const d=document.createElement('dialog');d.id='ascCompareDialog';d.className='asc-compare-dialog';d.innerHTML='<header class="asc-os-head"><div><p>Destination Battle</p><h2>Comparación ejecutiva</h2></div><button class="asc-os-close" type="button" aria-label="Cerrar">×</button></header><div id="ascCompareBody" class="asc-os-body"></div><footer class="asc-os-actions"><button id="ascCompareClear" class="asc-os-secondary" type="button">Limpiar</button></footer>';document.body.appendChild(d);$('.asc-os-close',d).onclick=()=>d.close();$('#ascCompareClear').onclick=()=>{compare.splice(0);renderCompareBar();renderCompare();};}
  function renderCompare(){const host=$('#ascCompareBody');if(!host)return;if(!compare.length){host.innerHTML='<p style="color:#94a3b8">Seleccione hasta cinco destinos desde las recomendaciones del tablero.</p>';return;}const winner=[...compare].sort((a,b)=>b.score-a.score)[0];host.innerHTML=`<div class="asc-compare-grid">${compare.map(x=>`<article class="asc-compare-card ${x.id===winner.id?'asc-compare-winner':''}"><h3>${esc(x.name)}</h3><small>${esc(x.country)}</small><dl><div><dt>ASC Score</dt><dd>${x.score||'—'}</dd></div><div><dt>FX advantage</dt><dd>${x.fx>=0?'+':''}${x.fx||0}%</dd></div><div><dt>Conectividad</dt><dd>${x.connectivity||'—'}/100</dd></div><div><dt>Costo diario</dt><dd>${x.daily?x.daily.toLocaleString('es-MX')+' MXN':'Dato no disponible'}</dd></div></dl>${x.id===winner.id?'<p style="margin-top:12px;color:#e8c66a;font-size:10px;font-weight:800">MEJOR ASC SCORE DEL GRUPO</p>':''}</article>`).join('')}</div><p style="margin-top:14px;color:#64748b;font-size:10px">Comparación basada exclusivamente en los datos actualmente cargados en Viajes ASC. Precio y disponibilidad deben verificarse en la fuente original.</p>`;}
  function openCompare(){buildCompare();renderCompare();$('#ascCompareDialog').showModal();}
  function augmentCards(){const cards=$$('#recommendations article.result-card');cards.forEach((card,i)=>{if($('.asc-compare-add',card))return;const name=$('h3',card)?.textContent?.trim();if(!name)return;const d=(latestData?.destinations||[]).find(x=>x.city===name);if(!d)return;const b=document.createElement('button');b.type='button';b.className='asc-compare-add';b.textContent='Agregar a Destination Battle';b.onclick=()=>addCompare(d);card.appendChild(b);});}
  function bindData(){window.addEventListener('viajes:data-ready',e=>{latestData=e.detail?.data||null;setTimeout(augmentCards,60);});new MutationObserver(()=>augmentCards()).observe($('#recommendations')||document.body,{childList:true,subtree:true});}

  function init(){styles();buildDNA();buildCompare();buildLauncher();bindCopilot();bindData();renderCompareBar();if(!localStorage.getItem(DNA_KEY)&&localStorage.getItem(GUEST_KEY)!=='true') setTimeout(()=>{const hint=$('#ascDNAStatus');if(hint)hint.textContent='nuevo · 60 s';},500);window.ASCTravelOS={readDNA,saveDNA,parseIntent,addCompare,get compare(){return [...compare]}};}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
