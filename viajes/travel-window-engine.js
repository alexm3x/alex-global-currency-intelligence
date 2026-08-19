(() => {
  'use strict';
  if (window.__VIAJES_ASC_WINDOW_ENGINE__) return;
  window.__VIAJES_ASC_WINDOW_ENGINE__ = true;

  const core = window.TravelIntelligenceCore;
  if (!core) { console.error('Viajes ASC Phase 5: scoring core unavailable'); return; }

  const state = { profile:null, range:null, all:[], shortlist:[], ranked:[], strategies:null, loading:false, controller:null };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const finite = value => Number.isFinite(Number(value));
  const fmt = value => finite(value) ? new Intl.NumberFormat('es-MX',{maximumFractionDigits:1}).format(Number(value)) : '—';
  const fmtDate = value => { try { return new Intl.DateTimeFormat('es-MX',{day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`)); } catch { return value || '—'; } };
  const money = observation => {
    if (!observation || !finite(observation.amount)) return 'No observado';
    try { return new Intl.NumberFormat('es-MX',{style:'currency',currency:observation.currency || 'USD',maximumFractionDigits:0}).format(Number(observation.amount)); }
    catch { return `${Number(observation.amount)} ${esc(observation.currency || '')}`; }
  };
  const sessionId = () => {
    const key='viajesASCIntelligenceSession'; let id=sessionStorage.getItem(key);
    if(!id){id=globalThis.crypto?.randomUUID?.()||`asc-${Date.now()}-${Math.random().toString(36).slice(2)}`;sessionStorage.setItem(key,id);} return id;
  };
  const endpoint = () => window.TravelIntelligence?.endpoint?.() || 'https://viajes-asc-assistant.proadmexico.workers.dev';

  function addStyles(){
    if(document.getElementById('viajes-phase5-styles'))return;
    const style=document.createElement('style');style.id='viajes-phase5-styles';
    style.textContent=`.asc-window{margin-top:18px;border:1px solid rgba(232,198,106,.24);border-radius:18px;background:linear-gradient(145deg,rgba(12,19,25,.94),rgba(5,11,16,.8));overflow:hidden}.asc-window[hidden]{display:none}.asc-window__head{display:flex;justify-content:space-between;gap:20px;align-items:flex-start;padding:22px 24px;border-bottom:1px solid #1e293b}.asc-window__head p{color:#e8c66a;font:700 9px/1.3 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}.asc-window__head h2{margin-top:7px;color:#fff;font-size:23px}.asc-window__head span{display:block;margin-top:7px;color:#8b9aab;font-size:11px;line-height:1.55}.asc-window__head button{border:1px solid #334155;border-radius:8px;padding:10px 13px;color:#cbd5e1;font-size:11px;font-weight:700}.asc-window__status{padding:13px 24px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:11px;line-height:1.6}.asc-window__status[data-state="loading"]{color:#67e8f9}.asc-window__status[data-state="ready"]{color:#86efac}.asc-window__status[data-state="partial"]{color:#fcd34d}.asc-window__status[data-state="error"]{color:#fda4af}.asc-window__roles{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1px;background:#1e293b}.asc-role{padding:16px;background:#09131c}.asc-role span{color:#e8c66a;font:700 8px/1.3 ui-monospace,monospace;text-transform:uppercase}.asc-role strong{display:block;margin-top:6px;color:#fff;font-size:14px}.asc-role small{display:block;margin-top:5px;color:#7f8da0;font-size:9px}.asc-window__table{overflow:auto}.asc-window table{width:100%;min-width:880px;border-collapse:collapse}.asc-window th{padding:10px 12px;border-bottom:1px solid #263446;color:#64748b;font:700 8px/1.2 ui-monospace,monospace;text-align:left;text-transform:uppercase}.asc-window td{padding:13px 12px;border-bottom:1px solid #182432;color:#aab6c5;font-size:10px;vertical-align:middle}.asc-window tr[data-top="true"]{background:rgba(232,198,106,.045)}.asc-window td strong{color:#fff}.asc-window__score{font-size:17px!important;font-weight:700;color:#fff!important}.asc-window__factor{display:inline-flex;margin:2px;padding:4px 6px;border-radius:5px;background:#0d1924;color:#93a4b8;font-size:8px}.asc-window__choose{border:1px solid rgba(103,232,249,.4);border-radius:7px;padding:7px 9px;color:#67e8f9;font-size:9px;font-weight:700;white-space:nowrap}.asc-window__choose:hover{background:rgba(103,232,249,.08)}.asc-window__foot{padding:14px 24px;color:#64748b;font-size:9px;line-height:1.6}.asc-window__empty{padding:22px 24px;color:#94a3b8;font-size:11px;line-height:1.65}@media(max-width:900px){.asc-window__roles{grid-template-columns:1fr}.asc-window__head{display:grid}}@media(max-width:600px){.asc-window__head,.asc-window__status,.asc-window__foot{padding-left:18px;padding-right:18px}.asc-window__head button{width:100%}}`;
    document.head.appendChild(style);
  }

  function ensurePanel(){
    let panel=document.getElementById('travelWindowEngine');if(panel)return panel;
    panel=document.createElement('section');panel.id='travelWindowEngine';panel.className='asc-window';panel.hidden=true;panel.setAttribute('aria-labelledby','travelWindowTitle');
    panel.innerHTML=`<header class="asc-window__head"><div><p>Fase 5 · Motor inverso de fechas</p><h2 id="travelWindowTitle">¿Cuándo conviene viajar?</h2><span id="travelWindowSubtitle">Periodo + duración → ventanas candidatas → investigación comparativa → Top 3 → elegir fecha.</span></div><button id="travelWindowRetry" type="button" disabled>Recalcular ventanas</button></header><div id="travelWindowStatus" class="asc-window__status" data-state="idle">Seleccione “Ayúdame a elegir cuándo viajar” para activar el motor.</div><div id="travelWindowRoles" class="asc-window__roles" hidden></div><div id="travelWindowBody" class="asc-window__table"></div><div class="asc-window__foot">ASC Travel Window Score utiliza únicamente factores con evidencia disponible. Los factores sin datos no reciben una puntuación inventada; la cobertura de evidencia se muestra por ventana.</div>`;
    (document.getElementById('travelIntelligenceResearch')||document.getElementById('travelAssistant'))?.insertAdjacentElement('afterend',panel);
    document.getElementById('travelWindowRetry')?.addEventListener('click',()=>state.profile&&prepare(state.profile,window.__VIAJES_ASC_TRAVEL_RESEARCH__||null));
    return panel;
  }
  function setStatus(message,mode='idle'){const el=document.getElementById('travelWindowStatus');if(!el)return;el.textContent=message;el.dataset.state=mode;}

  function evenlySpaced(windows,limit=8){
    if(windows.length<=limit)return windows;
    const out=[],seen=new Set(),step=(windows.length-1)/(limit-1);
    for(let i=0;i<limit;i++){const item=windows[Math.round(i*step)];if(item&&!seen.has(item.id)){seen.add(item.id);out.push(item);}}
    return out;
  }

  function preliminary(shortlist){
    const partial=core.mergeWindowResearch(shortlist,{windows:[]});
    state.ranked=partial;state.strategies=core.selectWindowStrategies(partial);render(partial,state.strategies);
  }

  function render(rows=state.ranked,strategies=state.strategies){
    const panel=ensurePanel();panel.hidden=false;
    const roles=document.getElementById('travelWindowRoles'),body=document.getElementById('travelWindowBody');
    const top=strategies?.top3||[];
    roles.hidden=!top.length;
    roles.innerHTML=top.map(role=>`<div class="asc-role"><span>${esc(role.label)}</span><strong>${fmtDate(role.window.start)} → ${fmtDate(role.window.end)}</strong><small>Score ${fmt(role.window.asc_travel_window_score)} · ${esc(role.window.verdict||'')}</small></div>`).join('');
    if(!rows.length){body.innerHTML='<div class="asc-window__empty">No hay ventanas válidas dentro del periodo indicado.</div>';return;}
    const topIds=new Set(top.map(role=>role.window.id));
    body.innerHTML=`<table><thead><tr><th>Ventana</th><th>ASC Score</th><th>Oportunidad</th><th>Precio observado</th><th>Event Premium</th><th>Evidencia</th><th>Veredicto</th><th></th></tr></thead><tbody>${rows.map(row=>{
      const total=row.total_observed;const factors=row.factors||{};const factorBits=[['Eventos',factors.extraordinary_events],['Valor',factors.price_quality],['Vuelo',factors.flight],['Hotel',factors.lodging],['Clima',factors.weather],['Sat.',factors.saturation],['Log.',factors.logistics]].filter(([,v])=>finite(v)).map(([k,v])=>`<span class="asc-window__factor">${k} ${fmt(v)}</span>`).join('');
      return `<tr data-top="${topIds.has(row.id)}"><td><strong>${fmtDate(row.start)} → ${fmtDate(row.end)}</strong><br>${row.opportunity_count||0} oportunidad(es) detectada(s)</td><td class="asc-window__score">${fmt(row.asc_travel_window_score)}</td><td>${fmt(row.extraordinary_events)}<br>${factorBits}</td><td>${money(total)}${total?'':'<br><span>pendiente</span>'}</td><td>${finite(row.event_premium_pct)?`${Number(row.event_premium_pct)>=0?'+':''}${fmt(row.event_premium_pct)}%`:'—'}</td><td>${Math.round((row.evidence_coverage||0)*100)}%</td><td>${esc(row.verdict||'PENDIENTE')}</td><td><button class="asc-window__choose" type="button" data-window-id="${esc(row.id)}">Elegir esta ventana</button></td></tr>`;
    }).join('')}</tbody></table>`;
    body.querySelectorAll('[data-window-id]').forEach(button=>button.addEventListener('click',()=>selectWindow(button.dataset.windowId)));
  }

  function prepare(profile,research=null){
    if(!profile||profile.planning?.mode!=='inverse_dates')return;
    state.profile=profile;const panel=ensurePanel();panel.hidden=false;
    const range=core.parseApproxPeriod(profile.planning?.period_approx||profile.dates?.month||'');state.range=range;
    if(!range){state.all=[];state.shortlist=[];state.ranked=[];state.strategies=null;setStatus('No pude convertir el periodo aproximado en un rango calendario. Use, por ejemplo, “septiembre 2026”, “septiembre-octubre 2026”, “Q4 2026” o “próximos 3 meses”.','error');render([]);return;}
    const duration=Math.max(2,Math.min(30,Number(profile.planning?.duration_days||profile.dates?.nights_min||4)));
    state.all=core.generateCandidateWindows(range,duration,90);
    const items=research?.items||[];
    state.shortlist=items.length?core.shortlistWindows(state.all,items,8):evenlySpaced(state.all,8).map(window=>core.prelimWindow(window,[]));
    preliminary(state.shortlist);
    const retry=document.getElementById('travelWindowRetry');if(retry)retry.disabled=false;
    setStatus(`${state.all.length} ventanas posibles detectadas en ${range.label}. ${state.shortlist.length} pasan a comparación ejecutiva${items.length?' con eventos ya investigados':' mientras se espera investigación verificable'}.`,'partial');
    if(items.length)researchWindows(profile,state.shortlist);
  }

  async function researchWindows(profile,shortlist){
    if(state.loading||!shortlist.length)return;state.loading=true;const retry=document.getElementById('travelWindowRetry');if(retry)retry.disabled=true;
    setStatus('Comparando ventanas: precio observable, clima, saturación y logística con trazabilidad…','loading');
    state.controller?.abort();state.controller=new AbortController();const timer=setTimeout(()=>state.controller.abort(),60000);
    try{
      const response=await fetch(`${endpoint().replace(/\/$/,'')}/research`,{method:'POST',headers:{'content-type':'application/json','x-asc-session':sessionId()},body:JSON.stringify({action:'research_windows',profile,windows:shortlist.map(w=>({id:w.id,start:w.start,end:w.end,matched_item_ids:w.matched_items||[],preliminary_score:w.preliminary_score}))}),signal:state.controller.signal});
      const payload=await response.json().catch(()=>({}));if(!response.ok)throw new Error(payload.error||`HTTP ${response.status}`);
      const comparison=payload.window_research||payload;state.ranked=core.mergeWindowResearch(shortlist,comparison);state.strategies=core.selectWindowStrategies(state.ranked);window.__VIAJES_ASC_WINDOW_COMPARISON__={...comparison,windows:state.ranked,strategies:state.strategies};render();
      const coverage=state.ranked.length?Math.round((state.ranked.reduce((sum,w)=>sum+(w.evidence_coverage||0),0)/state.ranked.length)*100):0;
      setStatus(`Comparación completada · ${state.ranked.length} ventanas · cobertura media de evidencia ${coverage}% · Top 3 estratégico disponible.`,'ready');
      window.dispatchEvent(new CustomEvent('viajes:windows-ready',{detail:{profile,comparison:window.__VIAJES_ASC_WINDOW_COMPARISON__}}));
    }catch(error){
      const message=error?.name==='AbortError'?'La comparación excedió el tiempo de respuesta.':`Comparación externa pendiente: ${error.message}`;
      setStatus(`${message} Se conserva el ranking parcial basado únicamente en evidencia ya disponible; no se inventan precios ni factores faltantes.`,'partial');
      window.dispatchEvent(new CustomEvent('viajes:windows-error',{detail:{profile,error:String(error?.message||error)}}));
    }finally{clearTimeout(timer);state.loading=false;if(retry)retry.disabled=false;}
  }

  function selectWindow(id){
    const chosen=state.ranked.find(window=>window.id===id)||state.shortlist.find(window=>window.id===id);if(!chosen||!state.profile)return;
    const profile=globalThis.structuredClone?structuredClone(state.profile):JSON.parse(JSON.stringify(state.profile));
    const nights=Math.max(1,Math.round((Date.parse(`${chosen.end}T00:00:00Z`)-Date.parse(`${chosen.start}T00:00:00Z`))/86400000));
    profile.dates={...(profile.dates||{}),start:chosen.start,end:chosen.end,flex_days:0,nights_min:nights,nights_max:nights};
    profile.planning={...(profile.planning||{}),previous_mode:'inverse_dates',mode:'known_dates',selected_window:{id:chosen.id,start:chosen.start,end:chosen.end,asc_travel_window_score:chosen.asc_travel_window_score??null,verdict:chosen.verdict||null,selected_at:new Date().toISOString()}};
    window.__VIAJES_ASC_SELECTED_WINDOW__=chosen;window.__VIAJES_ASC_ACTIVE_TRIP_PROFILE__=profile;
    const start=document.getElementById('startDate'),end=document.getElementById('endDate');if(start)start.value=chosen.start;if(end)end.value=chosen.end;
    document.getElementById('queryForm')?.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    const summary=document.getElementById('assistantActiveSummary');if(summary){summary.hidden=false;summary.innerHTML=`<div><strong>Ventana elegida · ${esc(profile.destination_scope?.values?.join(', ')||'Destino')}</strong><span>${esc(chosen.start)} → ${esc(chosen.end)} · ASC Window Score ${fmt(chosen.asc_travel_window_score)} · ${esc(chosen.verdict||'seleccionada')}.</span></div>`;}
    setStatus(`Ventana seleccionada: ${fmtDate(chosen.start)} → ${fmtDate(chosen.end)}. Fechas transferidas a Vuelos, Estancias, Presupuesto e investigación exacta.`,'ready');
    window.dispatchEvent(new CustomEvent('viajes:window-selected',{detail:{profile,window:chosen}}));
    window.dispatchEvent(new CustomEvent('viajes:known-dates-request',{detail:{profile}}));
    setTimeout(()=>document.getElementById('travelIntelligenceResearch')?.scrollIntoView({behavior:'smooth',block:'start'}),160);
  }

  addStyles();ensurePanel();
  window.addEventListener('viajes:inverse-date-request',event=>prepare(event.detail?.profile,null));
  window.addEventListener('viajes:research-ready',event=>{const profile=event.detail?.profile;if(profile?.planning?.mode==='inverse_dates')prepare(profile,event.detail?.research);});
  window.TravelWindowEngine={prepare,researchWindows,selectWindow,getState:()=>({...state})};
})();
