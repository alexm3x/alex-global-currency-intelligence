(() => {
  'use strict';
  if (window.__VIAJES_ASC_TRAVEL_ASSISTANT__) return;
  window.__VIAJES_ASC_TRAVEL_ASSISTANT__ = true;

  const core = window.TravelAssistantCore;
  const $ = id => document.getElementById(id);
  const dialog = $('travelAssistantDialog');
  const form = $('travelAssistantForm');
  const host = $('assistantStepContent');
  const errorBox = $('assistantFormError');
  const next = $('assistantNext');
  const back = $('assistantBack');
  const save = $('assistantSave');
  const progress = $('assistantProgressBar');
  const stepLabel = $('assistantStepLabel');
  const privacy = $('assistantPrivacyLabel');
  const savedKey = 'viajesASCTripProfileV4';
  const draftKey = 'viajesASCTripDraftSession';
  const TOTAL = 6;
  let step = 0;
  let raw = defaults();
  let intelligenceReady = Promise.resolve();
  if (!core || !dialog || !form || !host) return;

  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const value = (id, fallback='') => $(id)?.value ?? fallback;
  const opts = (items, selected) => items.map(([v,l]) => `<option value="${esc(v)}" ${String(v)===String(selected)?'selected':''}>${esc(l)}</option>`).join('');
  const chips = (name, items, selected=[]) => `<div class="assistant-chip-grid">${items.map(([v,l]) => `<label class="assistant-chip"><input type="checkbox" name="${name}" value="${esc(v)}" ${selected.includes(v)?'checked':''}><span>${esc(l)}</span></label>`).join('')}</div>`;

  function defaults(){
    return {
      planningMode:'known_dates', origin:value('originInput','MEX'), destination:'', start:value('startDate',''), end:value('endDate',''),
      periodApprox:'', durationChoice:'4', durationCustom:4, flexDays:7,
      adults:Number(value('adultsInput',2))||2, childCount:Number(value('minorsInput',0))||0, rooms:Number(value('roomsInput',1))||1, groupType:'couple',
      priorities:['gastronomía','museos','eventos especiales'], budgetTier:'high', budgetAmount:value('budgetInput',''), currency:value('currencyInput','MXN')||'MXN',
      pace:'balanced', hotel:'', preferredZone:'', cabin:'economy', directPreference:'preferred', concerns:['hidden_costs','crowds'], comments:'', saveProfile:false
    };
  }

  function addStyles(){
    if ($('viajes-intelligence-phase2-styles')) return;
    const style=document.createElement('style'); style.id='viajes-intelligence-phase2-styles';
    style.textContent=`.assistant-mode-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-top:22px}.assistant-mode-card{position:relative;display:block;padding:20px;border:1px solid #334155;border-radius:14px;background:linear-gradient(145deg,rgba(8,18,27,.94),rgba(5,11,16,.72));cursor:pointer}.assistant-mode-card input{position:absolute;opacity:0}.assistant-mode-card:has(input:checked){border-color:#e8c66a;background:linear-gradient(145deg,rgba(232,198,106,.09),rgba(5,11,16,.88))}.assistant-mode-card b{display:inline-flex;padding:6px 8px;border:1px solid rgba(232,198,106,.35);border-radius:999px;color:#e8c66a;font:700 9px/1 ui-monospace,monospace}.assistant-mode-card strong{display:block;margin-top:15px;color:#fff;font-size:17px}.assistant-mode-card span{display:block;margin-top:9px;color:#8fa0b5;font-size:12px;line-height:1.6}.assistant-mode-flow{color:#67e8f9!important;font:600 9px/1.5 ui-monospace,monospace!important}.assistant-section-note{grid-column:1/-1;padding:12px 14px;border-left:2px solid #e8c66a;background:rgba(232,198,106,.045);color:#91a0b4;font-size:10px;line-height:1.55}.assistant-summary__mode{display:inline-flex;margin-bottom:10px;padding:6px 8px;border:1px solid rgba(103,232,249,.35);border-radius:999px;color:#67e8f9;font:700 9px/1 ui-monospace,monospace;text-transform:uppercase}@media(max-width:760px){.assistant-mode-grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function tuneEntry(){
    if ($('travelAssistantTitle')) $('travelAssistantTitle').textContent='Inteligencia de Viaje';
    if (stepLabel) stepLabel.textContent=`Paso 1 de ${TOTAL}`;
    const entry=$('travelAssistant');
    const p=entry?.querySelector('.assistant-entry__copy > p'); if(p) p.textContent='Descubra cuándo viajar, qué está ocurriendo durante sus fechas y cómo aprovechar mejor su estancia.';
    const k=entry?.querySelector('.assistant-kicker span:first-child'); if(k) k.textContent='VIAJES ASC — INTELIGENCIA DE VIAJE';
    if ($('startTravelAssistant')) $('startTravelAssistant').textContent='CREAR VIAJE INTELIGENTE';
    const signal=entry?.querySelector('.assistant-entry__signal'); if(signal) signal.innerHTML='<span>Fechas</span><b>A</b><i></i><span>Motor inverso</span><b>B</b><i></i><span>Investigación</span><b>→</b>';
  }

  function loadScript(src,id){
    return new Promise((resolve,reject)=>{
      const existing=$(id);
      if(existing){ if(existing.dataset.loaded==='true') resolve(); else existing.addEventListener('load',resolve,{once:true}); return; }
      const script=document.createElement('script'); script.id=id; script.src=src; script.defer=true;
      script.addEventListener('load',()=>{script.dataset.loaded='true';resolve();},{once:true});
      script.addEventListener('error',()=>reject(new Error(`No fue posible cargar ${src}`)),{once:true});
      document.body.appendChild(script);
    });
  }
  function loadIntelligence(){
    intelligenceReady = loadScript('travel-intelligence-core.js','viajes-intelligence-core-script')
      .then(()=>loadScript('travel-intelligence.js','viajes-intelligence-ui-script'))
      .catch(error=>{console.error('Viajes ASC Intelligence modules:',error.message);throw error;});
    return intelligenceReady;
  }

  const interests=[['crucero','Crucero'],['cultura','Cultura'],['gastronomía','Gastronomía'],['compras','Compras'],['museos','Museos'],['deportes','Deportes'],['conciertos','Conciertos'],['teatro','Teatro'],['moda','Moda'],['arte','Arte'],['arquitectura','Arquitectura'],['vida nocturna','Vida nocturna'],['experiencias premium','Experiencias premium'],['negocios','Negocios'],['familia','Familia'],['naturaleza','Naturaleza'],['eventos especiales','Eventos especiales'],['descanso','Descanso']];
  const concerns=[['security','Seguridad'],['hidden_costs','Cargos inesperados'],['visa','Visas'],['weather','Clima extremo'],['layovers','Escalas largas'],['fatigue','Fatiga / jet lag'],['lodging_quality','Calidad del alojamiento'],['location','Ubicación'],['cancellation','Cancelación'],['fx','Tipo de cambio'],['crowds','Saturación turística']];

  function duration(){ return raw.durationChoice==='custom' ? Math.max(2,Math.min(30,Number(raw.durationCustom)||4)) : Math.max(2,Number(raw.durationChoice)||4); }
  function modeView(){return `<h3>¿Ya sabe cuándo quiere viajar?</h3><p>Elija el punto de partida. Viajes ASC reutilizará los datos disponibles en el portal.</p><div class="assistant-mode-grid"><label class="assistant-mode-card"><input type="radio" name="planningMode" value="known_dates" ${raw.planningMode==='known_dates'?'checked':''}><b>MODO A</b><strong>YA SÉ CUÁNDO VIAJO</strong><span>Analizar mis fechas y construir mi guía.</span><span class="assistant-mode-flow">Fechas → investigación → oportunidades → itinerario → PDF</span></label><label class="assistant-mode-card"><input type="radio" name="planningMode" value="inverse_dates" ${raw.planningMode==='inverse_dates'?'checked':''}><b>MODO B</b><strong>AYÚDAME A ELEGIR CUÁNDO VIAJAR</strong><span>Encontrar las mejores fechas según experiencias, precio y oportunidad.</span><span class="assistant-mode-flow">Periodo → investigar → comparar ventanas → elegir fecha</span></label></div>`;}
  function frameView(){
    if(raw.planningMode==='inverse_dates') return `<h3>Encontrar las mejores fechas</h3><p>Destino + duración + periodo aproximado → investigar oportunidades → preparar la comparación de ventanas.</p><div class="assistant-grid"><label class="assistant-field"><span>Destino *</span><input name="destination" value="${esc(raw.destination)}" required></label><label class="assistant-field"><span>Ciudad de origen</span><input name="origin" value="${esc(raw.origin)}"></label><label class="assistant-field assistant-field--full"><span>Periodo aproximado *</span><input name="periodApprox" value="${esc(raw.periodApprox)}" placeholder="Septiembre 2026, próximos 3 meses…" required></label><label class="assistant-field"><span>Duración</span><select name="durationChoice">${opts([['2','Fin de semana'],['3','3 noches'],['4','4 días'],['7','7 días'],['custom','Personalizada']],raw.durationChoice)}</select></label><label class="assistant-field"><span>Días personalizados</span><input type="number" name="durationCustom" min="2" max="30" value="${esc(raw.durationCustom)}" ${raw.durationChoice==='custom'?'':'disabled'}></label><label class="assistant-field"><span>Flexibilidad</span><select name="flexDays">${opts([[3,'±3 días'],[7,'±7 días'],[14,'±14 días'],[31,'Cualquier fecha']],raw.flexDays)}</select></label><div class="assistant-section-note">Fase 3 investigará eventos concretos dentro del periodo. La generación automática de ventanas corresponde a Fase 5.</div></div>`;
    return `<h3>Analizar mis fechas</h3><p>Los únicos campos obligatorios son destino, llegada y salida.</p><div class="assistant-grid"><label class="assistant-field assistant-field--full"><span>Destino *</span><input name="destination" value="${esc(raw.destination)}" required></label><label class="assistant-field"><span>Fecha de llegada *</span><input type="date" name="start" value="${esc(raw.start)}" required></label><label class="assistant-field"><span>Fecha de salida *</span><input type="date" name="end" value="${esc(raw.end)}" required></label><label class="assistant-field assistant-field--full"><span>Ciudad de origen</span><input name="origin" value="${esc(raw.origin)}"></label><div class="assistant-section-note">Origen, viajeros, presupuesto y preferencias se reutilizan si ya existen en Viajes ASC.</div></div>`;
  }
  function preferenceView(){return `<h3>¿Qué debe priorizar el viaje?</h3><p>Seleccione hasta ocho intereses.</p><div class="assistant-grid"><fieldset class="assistant-fieldset"><legend>Tipo de viaje</legend>${chips('priorities',interests,raw.priorities)}</fieldset><label class="assistant-field"><span>Integrantes</span><select name="groupType">${opts([['solo','Solo'],['couple','Pareja'],['family','Familia'],['friends','Amigos'],['business','Negocios']],raw.groupType)}</select></label><label class="assistant-field"><span>Adultos</span><input type="number" name="adults" min="1" max="12" value="${raw.adults}"></label><label class="assistant-field"><span>Menores</span><input type="number" name="childCount" min="0" max="8" value="${raw.childCount}"></label><label class="assistant-field"><span>Habitaciones</span><input type="number" name="rooms" min="1" max="8" value="${raw.rooms}"></label></div>`;}
  function budgetView(){return `<h3>Presupuesto, ritmo y estancia</h3><p>Estos campos son opcionales.</p><div class="assistant-grid"><label class="assistant-field"><span>Nivel de presupuesto</span><select name="budgetTier">${opts([['economic','Económico'],['medium','Medio'],['high','Alto'],['premium','Premium'],['unrestricted','Sin restricción']],raw.budgetTier)}</select></label><label class="assistant-field"><span>Presupuesto máximo opcional</span><input type="number" name="budgetAmount" min="0" value="${esc(raw.budgetAmount)}" placeholder="Sin importe fijo"></label><label class="assistant-field"><span>Moneda</span><select name="currency">${opts([['MXN','MXN'],['USD','USD'],['EUR','EUR'],['JPY','JPY']],raw.currency)}</select></label><label class="assistant-field"><span>Ritmo</span><select name="pace">${opts([['relaxed','Relajado'],['balanced','Balanceado'],['intensive','Intensivo']],raw.pace)}</select></label><label class="assistant-field"><span>Hotel</span><input name="hotel" value="${esc(raw.hotel)}" placeholder="Opcional"></label><label class="assistant-field"><span>Zona preferida</span><input name="preferredZone" value="${esc(raw.preferredZone)}" placeholder="Opcional"></label><label class="assistant-field"><span>Cabina</span><select name="cabin">${opts([['economy','Económica'],['premium','Premium economy'],['business','Business'],['first','Primera']],raw.cabin)}</select></label><label class="assistant-field"><span>Vuelo directo</span><select name="directPreference">${opts([['required','Obligatorio'],['preferred','Preferido'],['indifferent','Indiferente']],raw.directPreference)}</select></label></div>`;}
  function contextView(){return `<h3>Comentarios y restricciones</h3><p>Indique cualquier cosa que quiera hacer, evitar o priorizar.</p><div class="assistant-grid"><fieldset class="assistant-fieldset"><legend>Inquietudes</legend>${chips('concerns',concerns,raw.concerns)}</fieldset><label class="assistant-field assistant-field--full"><span>Comentarios</span><textarea name="comments" maxlength="1500">${esc(raw.comments)}</textarea></label><label class="assistant-toggle"><input type="checkbox" name="saveProfile" ${raw.saveProfile?'checked':''}><span>Guardar este perfil en este dispositivo. Si no se marca, la sesión permanece temporal.</span></label></div>`;}

  function profile(){
    const lodgingTypes=raw.tripType==='cruise'||raw.priorities?.includes('crucero')?['cruise']:['hotel'];
    const p=core.createProfile({...raw,destinationMode:'fixed',destination:raw.destination,start:raw.planningMode==='known_dates'?raw.start:'',end:raw.planningMode==='known_dates'?raw.end:'',nightsMin:raw.planningMode==='inverse_dates'?duration():undefined,nightsMax:raw.planningMode==='inverse_dates'?duration():undefined,budgetAmount:Number(raw.budgetAmount)||0,budgetBasis:'total',budgetIncludes:['flights','lodging','destination','experiences'],strictness:raw.budgetTier==='unrestricted'?'opportunity':'moderate',lodgingTypes,locationPreferences:raw.preferredZone?[raw.preferredZone]:[],roomPreferences:[],hardConstraints:[]});
    p.planning={mode:raw.planningMode,period_approx:raw.periodApprox||null,duration_days:raw.planningMode==='inverse_dates'?duration():null,budget_tier:raw.budgetTier,pace:raw.pace,hotel:raw.hotel||null,preferred_zone:raw.preferredZone||null,prepared_at:new Date().toISOString()};
    return p;
  }
  function summaryView(){
    const p=profile(),inverse=raw.planningMode==='inverse_dates',temporal=inverse?`${raw.periodApprox} · ${duration()} días · ±${raw.flexDays} días`:`${raw.start} → ${raw.end}`;
    const budget=Number(raw.budgetAmount)>0?new Intl.NumberFormat('es-MX',{style:'currency',currency:raw.currency,maximumFractionDigits:0}).format(Number(raw.budgetAmount)):({economic:'Económico',medium:'Medio',high:'Alto',premium:'Premium',unrestricted:'Sin restricción'}[raw.budgetTier]);
    return `<h3>Viaje inteligente preparado</h3><p>Revise la información antes de iniciar la investigación actualizada.</p><div class="assistant-summary"><div class="assistant-summary__hero"><div><span class="assistant-summary__mode">${inverse?'Modo B · Motor inverso':'Modo A · Fechas conocidas'}</span><strong>${esc(raw.destination)}</strong><p>${inverse?'Investigar periodo → detectar eventos que cambian la decisión → preparar comparación de ventanas.':'Investigar fechas → detectar coincidencias → ASC Experience Score + Opportunity Index.'}</p></div><span class="assistant-viability assistant-viability--high">Preparado</span></div><div class="assistant-summary__grid"><div><span>Marco temporal</span><strong>${esc(temporal)}</strong></div><div><span>Origen</span><strong>${esc(raw.origin||'No especificado')}</strong></div><div><span>Viajeros</span><strong>${p.travelers.adults+p.travelers.children.length} viajero(s) · ${p.travelers.rooms} habitación(es)</strong></div><div><span>Presupuesto</span><strong>${esc(budget)}</strong></div><div><span>Prioridades</span><strong>${esc(raw.priorities.join(' · ')||'Abierto')}</strong></div><div><span>Siguiente motor</span><strong>Investigación web verificable + scoring determinista</strong></div></div><div class="assistant-disclosure">No se inventarán eventos, precios, disponibilidad ni enlaces. Toda oportunidad conservará fuente, fecha de consulta y estado de verificación.</div></div>`;
  }

  const views=[modeView,frameView,preferenceView,budgetView,contextView,summaryView];
  function collect(){
    const data=new FormData(form),names=[...new Set([...form.elements].map(e=>e.name).filter(Boolean))];
    names.forEach(name=>{const elements=[...form.elements].filter(e=>e.name===name);if(!elements.length)return;if(elements[0].type==='checkbox'&&elements.length===1)raw[name]=elements[0].checked;else if(elements[0].type==='checkbox')raw[name]=data.getAll(name);else if(elements[0].type==='radio')raw[name]=data.get(name)??raw[name];else raw[name]=data.get(name)??raw[name];});
    ['flexDays','durationCustom','adults','childCount','rooms'].forEach(k=>{if(raw[k]!==''&&raw[k]!=null)raw[k]=Number(raw[k]);});
  }
  function validate(){
    collect(); if(step===0&&!['known_dates','inverse_dates'].includes(raw.planningMode)) return 'Seleccione cómo quiere planear el viaje.';
    if(step===1){ if(!String(raw.destination||'').trim()) return 'Indique el destino.'; if(raw.planningMode==='known_dates'){ if(!raw.start||!raw.end) return 'Indique fecha de llegada y fecha de salida.'; if(Date.parse(raw.end)<=Date.parse(raw.start)) return 'La fecha de salida debe ser posterior a la llegada.'; } else if(!String(raw.periodApprox||'').trim()) return 'Indique el periodo aproximado.'; }
    if(step===2){ if(!(Number(raw.adults)>=1)) return 'Debe incluir al menos un adulto.'; if(!(Number(raw.rooms)>=1)) return 'Debe incluir al menos una habitación.'; if((raw.priorities||[]).length>8) return 'Seleccione un máximo de ocho prioridades.'; }
    return '';
  }
  function showError(msg){errorBox.textContent=msg||'';errorBox.hidden=!msg;}
  function render(){host.innerHTML=views[step]();stepLabel.textContent=`Paso ${step+1} de ${TOTAL}`;progress.style.width=`${((step+1)/TOTAL)*100}%`;back.disabled=step===0;back.textContent=step===TOTAL-1?'Editar respuestas':'Anterior';next.textContent=step===TOTAL-1?(raw.planningMode==='inverse_dates'?'Investigar periodo':'Investigar mis fechas'):'Siguiente';privacy.textContent=raw.saveProfile?'Guardado local autorizado':'Modo temporal';showError('');host.scrollTop=0;host.querySelector('[name="durationChoice"]')?.addEventListener('change',()=>{collect();render();});}
  function hydrate(useSaved=false){const base=defaults();try{const stored=JSON.parse((useSaved?localStorage.getItem(savedKey):sessionStorage.getItem(draftKey))||'null');const r=stored?.raw||stored;if(r&&typeof r==='object')return{...base,...r};}catch{}const active=window.__VIAJES_ASC_ACTIVE_TRIP_PROFILE__;if(active?.destination_scope?.values?.[0])base.destination=active.destination_scope.values[0];return base;}
  function open(useSaved=false){raw=hydrate(useSaved);step=0;render();typeof dialog.showModal==='function'?dialog.showModal():dialog.setAttribute('open','');document.body.style.overflow='hidden';track('assistant_started');}
  function close(){dialog.open&&typeof dialog.close==='function'?dialog.close():dialog.removeAttribute('open');document.body.style.overflow='';}
  function saveDraft(force=false){collect();sessionStorage.setItem(draftKey,JSON.stringify(raw));if(force||raw.saveProfile){localStorage.setItem(savedKey,JSON.stringify({raw:{...raw,saveProfile:true},profile:profile()}));if($('continueTravelAssistant'))$('continueTravelAssistant').disabled=false;privacy.textContent='Guardado local autorizado';}}
  function selectValue(el,v){if(!el||!v)return;if(![...el.options].some(o=>o.value===v))el.add(new Option(v,v));el.value=v;}
  function activeSummary(p){const h=$('assistantActiveSummary');if(!h)return;const inverse=p.planning?.mode==='inverse_dates',temporal=inverse?`${p.planning.period_approx} · ${p.planning.duration_days} días`:`${p.dates.start} → ${p.dates.end}`;h.hidden=false;h.innerHTML=`<div><strong>${inverse?'Motor inverso en investigación':'Guía inteligente en investigación'} · ${esc(p.destination_scope.values.join(', '))}</strong><span>${esc(temporal)} · ${p.travelers.adults+p.travelers.children.length} viajero(s) · ${esc(p.priorities.slice(0,4).join(' · ')||'sin prioridades específicas')}.</span></div><button type="button" class="assistant-secondary" data-edit-profile>Modificar criterios</button>`;h.querySelector('[data-edit-profile]')?.addEventListener('click',()=>open(false));}
  function apply(){
    const p=profile(); p.consent.search_confirmed=true; window.__VIAJES_ASC_ACTIVE_TRIP_PROFILE__=p;
    if(Number(raw.budgetAmount)>0&&$('budgetInput')){selectValue($('currencyInput'),raw.currency);$('currencyInput')?.dispatchEvent(new Event('change',{bubbles:true}));$('budgetInput').value=String(Math.round(Number(raw.budgetAmount)));$('budgetInput').dispatchEvent(new Event('input',{bubbles:true}));}
    if(raw.origin)selectValue($('originInput'),raw.origin); if($('adultsInput'))$('adultsInput').value=raw.adults;if($('minorsInput'))$('minorsInput').value=raw.childCount;if($('roomsInput'))$('roomsInput').value=raw.rooms;if($('interestInput'))$('interestInput').value=raw.priorities.join(', ');
    const requestedType=raw.tripType==='cruise'||raw.priorities?.includes('crucero')?'cruise':raw.tripType;
    if(requestedType&&requestedType!=='all')document.querySelector(`#typeTabs button[data-type="${requestedType}"]`)?.click();
    if(raw.planningMode==='known_dates'){if($('startDate'))$('startDate').value=raw.start;if($('endDate'))$('endDate').value=raw.end;$('queryForm')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));window.dispatchEvent(new CustomEvent('viajes:known-dates-request',{detail:{profile:p}}));}else{window.__VIAJES_ASC_INVERSE_DATE_REQUEST__=p;window.dispatchEvent(new CustomEvent('viajes:inverse-date-request',{detail:{profile:p}}));}
    if(raw.saveProfile)saveDraft(true);else localStorage.removeItem(savedKey);sessionStorage.removeItem(draftKey);activeSummary(p);close();track(raw.planningMode==='inverse_dates'?'inverse_dates_research_started':'known_dates_research_started');setTimeout(()=>$(raw.planningMode==='inverse_dates'?'travelWindowEngine':'travelIntelligenceResearch')?.scrollIntoView({behavior:'smooth',block:'start'}),180);
  }
  function track(event){window.dispatchEvent(new CustomEvent('viajes:assistant-event',{detail:{event,step:step+1,mode:raw.planningMode,at:new Date().toISOString()}}));}

  function rawFromIntent(text, parsed){
    const base=defaults(), interpreted=parsed?.raw||{};
    Object.entries(interpreted).forEach(([key,item])=>{if(item!==undefined&&item!==null&&item!=='')base[key]=item;});
    if(!interpreted.priorities?.length)base.priorities=defaults().priorities;
    base.comments=String(interpreted.comments||text||'').slice(0,1500);
    return base;
  }
  async function waitForRuntime(mode){
    try{await intelligenceReady;}catch{return;}
    if(mode!=='inverse_dates'||window.TravelWindowEngine)return;
    for(let attempt=0;attempt<30&&!window.TravelWindowEngine;attempt++)await new Promise(resolve=>setTimeout(resolve,50));
  }
  async function analyzeNaturalIntent(text, parsed=core.parseNaturalLanguageIntent?.(text)){
    if(!parsed)throw new Error('No fue posible interpretar la solicitud.');
    raw=rawFromIntent(text,parsed);sessionStorage.setItem(draftKey,JSON.stringify(raw));
    if(!parsed.ready){
      step=1;render();typeof dialog.showModal==='function'?dialog.showModal():dialog.setAttribute('open','');document.body.style.overflow='hidden';
      showError(`Complete únicamente: ${parsed.requiredMissing.join(', ')}.`);track('natural_intent_needs_clarification');
      return{started:false,parsed};
    }
    await waitForRuntime(raw.planningMode);apply();track('natural_intent_analysis_started');return{started:true,parsed,profile:window.__VIAJES_ASC_ACTIVE_TRIP_PROFILE__};
  }

  addStyles(); tuneEntry(); loadIntelligence();
  $('startTravelAssistant')?.addEventListener('click',()=>open(false)); $('continueTravelAssistant')?.addEventListener('click',()=>open(true)); $('closeTravelAssistant')?.addEventListener('click',close);
  dialog.addEventListener('cancel',e=>{e.preventDefault();close();}); dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
  back.addEventListener('click',()=>{collect();if(step>0)step--;render();track('step_back');}); save.addEventListener('click',()=>{saveDraft(true);showError('Perfil guardado en este dispositivo. Puede continuar después.');});
  next.addEventListener('click',()=>{const err=validate();if(err){showError(err);return;}saveDraft(false);if(step===TOTAL-1){apply();return;}step++;render();track('step_completed');});
  try{const saved=JSON.parse(localStorage.getItem(savedKey)||'null');if($('continueTravelAssistant'))$('continueTravelAssistant').disabled=!saved?.profile;}catch{if($('continueTravelAssistant'))$('continueTravelAssistant').disabled=true;}
  window.TravelAssistant={getProfile:()=>window.__VIAJES_ASC_ACTIVE_TRIP_PROFILE__||null,getInverseRequest:()=>window.__VIAJES_ASC_INVERSE_DATE_REQUEST__||null,open,analyzeNaturalIntent,clearSaved:()=>{localStorage.removeItem(savedKey);if($('continueTravelAssistant'))$('continueTravelAssistant').disabled=true;}};
})();
