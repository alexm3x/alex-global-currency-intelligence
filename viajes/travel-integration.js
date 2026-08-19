(() => {
  'use strict';
  if (window.__VIAJES_ASC_INTEGRATION_HUB__) return;
  window.__VIAJES_ASC_INTEGRATION_HUB__ = true;

  const core = window.TravelIntegrationCore;
  if (!core) { console.error('Viajes ASC Phase 10: integration core unavailable'); return; }
  const KEYS={history:'viajesASCTripHistory',favorites:'viajesASCTripFavorites',alerts:'viajesASCTripAlerts',opportunity:'viajesASCOpportunityContext'};
  const state={snapshot:null,profile:null,research:null,logistics:null,itinerary:null,cost:null,report:null,selectedWindow:null};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const parse=(key,fallback=[])=>{try{const value=JSON.parse(localStorage.getItem(key)||'null');return value??fallback;}catch{return fallback;}};
  const write=(key,value)=>{try{localStorage.setItem(key,JSON.stringify(value));return true;}catch{return false;}};
  const trigger=(el,type='change')=>el?.dispatchEvent(new Event(type,{bubbles:true}));
  const setValue=(id,value)=>{const el=document.getElementById(id);if(!el||value===null||value===undefined||value==='')return false;if(el.tagName==='SELECT'&&![...el.options].some(option=>option.value===String(value)))return false;el.value=String(value);trigger(el,'input');trigger(el,'change');return true;};
  const workspace=name=>{const button=document.querySelector(`[data-workspace-tab="${name}"]`);if(button){button.click();return true;}window.dispatchEvent(new CustomEvent('viajes:workspace',{detail:{name}}));return false;};

  function styles(){
    if(document.getElementById('viajes-phase10-styles'))return;const style=document.createElement('style');style.id='viajes-phase10-styles';style.textContent=`.asc-integrations{margin-top:18px;border:1px solid rgba(103,232,249,.24);border-radius:18px;background:linear-gradient(145deg,rgba(7,18,24,.95),rgba(6,11,16,.9));overflow:hidden}.asc-integrations[hidden]{display:none}.asc-integrations__head{padding:22px 24px;border-bottom:1px solid #1e293b}.asc-integrations__head p{color:#67e8f9;font:700 9px/1.3 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}.asc-integrations__head h2{margin-top:7px;color:#fff;font-size:23px}.asc-integrations__head span{display:block;margin-top:7px;color:#8b9aab;font-size:11px;line-height:1.55}.asc-integrations__status{padding:13px 24px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:11px}.asc-integrations__status[data-state=ready]{color:#86efac}.asc-integrations__grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#1e293b}.asc-module{padding:16px;background:#08131c}.asc-module span{display:block;color:#64748b;font:700 8px/1.2 ui-monospace,monospace;text-transform:uppercase}.asc-module strong{display:block;margin-top:5px;color:#fff;font-size:12px;line-height:1.4}.asc-module p{margin-top:5px;color:#718096;font-size:9px;line-height:1.5}.asc-module button{margin-top:10px;width:100%;border:1px solid #334155;border-radius:7px;padding:8px;background:#0c1720;color:#d7e3ee;font:700 9px ui-monospace,monospace;cursor:pointer}.asc-module button:hover{border-color:#67e8f9;color:#67e8f9}.asc-module button:disabled{opacity:.4;cursor:not-allowed}.asc-integrations__foot{padding:14px 24px 20px;color:#64748b;font-size:9px;line-height:1.6}.asc-integrations__history{color:#cbd5e1}@media(max-width:1100px){.asc-integrations__grid{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:620px){.asc-integrations__grid{grid-template-columns:1fr}}`;
    document.head.appendChild(style);
  }

  function ensurePanel(){
    let panel=document.getElementById('travelIntegrationHub');if(panel)return panel;panel=document.createElement('section');panel.id='travelIntegrationHub';panel.className='asc-integrations';panel.hidden=true;panel.setAttribute('aria-labelledby','travelIntegrationTitle');panel.innerHTML=`<header class="asc-integrations__head"><p>Fase 10 · Integración transversal</p><h2 id="travelIntegrationTitle">Una sola decisión, todos los módulos</h2><span>Vuelos/Tablero · Estancias · Oportunidades · Favoritos · Alertas · Presupuesto · Mapas · Historial.</span></header><div id="travelIntegrationStatus" class="asc-integrations__status" data-state="idle">Esperando expediente de Fase 9.</div><div id="travelIntegrationGrid" class="asc-integrations__grid"></div><div class="asc-integrations__foot">Las integraciones transfieren parámetros y contexto; no convierten datos demostrativos en precios reales. “Crear vigilancia” guarda únicamente una intención local: no activa correo, WhatsApp, push ni ninguna notificación externa.</div>`;(document.getElementById('travelPdfEngine')||document.getElementById('travelCostEngine'))?.insertAdjacentElement('afterend',panel);return panel;
  }
  function status(message,mode='idle'){const el=document.getElementById('travelIntegrationStatus');if(el){el.textContent=message;el.dataset.state=mode;}}

  function syncDashboard(){
    const s=state.snapshot;if(!s)return;setValue('startDate',s.dates.start);setValue('endDate',s.dates.end);setValue('originInput',s.origin);if(s.budget.amount!==null)setValue('budgetInput',s.budget.amount);if(s.budget.currency)setValue('currencyInput',s.budget.currency);if(typeof window.applyQuery==='function'){try{window.applyQuery();}catch{}}
    window.dispatchEvent(new CustomEvent('viajes:integration-sync',{detail:{target:'flights_dashboard',snapshot:s}}));status('Parámetros sincronizados con Vuelos/Tablero y Presupuesto. Los resultados siguen sujetos a las fuentes de esos módulos.','ready');document.getElementById('queryForm')?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  function syncStays(){
    const s=state.snapshot;if(!s)return;setValue('stayDestination',s.destination);setValue('stayCheckIn',s.dates.start);setValue('stayCheckOut',s.dates.end);if(s.travelers.total>0)setValue('stayGuests',s.travelers.total);if(s.travelers.rooms>0)setValue('stayBedrooms',s.travelers.rooms);if(s.budget.amount!==null)setValue('stayBudget',s.budget.amount);if(s.budget.currency)setValue('stayCurrency',s.budget.currency);workspace('stays');window.dispatchEvent(new CustomEvent('viajes:integration-sync',{detail:{target:'stays',snapshot:s,status:'demo_data_remains_demo'}}));status('Parámetros enviados a Estancias Inteligentes. Sus datos demostrativos conservan su etiqueta demo y no alimentan el costo trazable de Fase 8.','ready');
  }

  function syncOpportunities(){
    const s=state.snapshot;if(!s)return;write(KEYS.opportunity,{contract:'asc-travel-opportunity-context-v1',saved_at:new Date().toISOString(),destination:s.destination,dates:s.dates,origin:s.origin,trip_id:s.trip_id});workspace('imports');window.dispatchEvent(new CustomEvent('viajes:integration-sync',{detail:{target:'opportunities',snapshot:s}}));status('Contexto del viaje enviado a Oportunidades. Las ofertas importadas siguen requiriendo verificación en su fuente.','ready');
  }

  function saveHistory(){
    if(!state.snapshot)return false;const record=core.storageRecord(state.snapshot);const rows=core.mergeBounded(parse(KEYS.history,[]),record,20,'trip_id');return write(KEYS.history,rows);
  }
  function saveFavorite(){
    if(!state.snapshot)return;const record=core.favoriteRecord(state.snapshot);const rows=core.mergeBounded(parse(KEYS.favorites,[]),record,12,'favorite_id');write(KEYS.favorites,rows);render(state.snapshot);status('Viaje guardado en Favoritos locales. No se copiaron comentarios libres ni datos sensibles del cuestionario.','ready');
  }
  function saveAlert(){
    if(!state.snapshot)return;const record=core.alertIntent(state.snapshot);const rows=core.mergeBounded(parse(KEYS.alerts,[]),record,20,'trip_id');write(KEYS.alerts,rows);render(state.snapshot);status('Vigilancia local guardada. Notificación externa: NO ACTIVA.','ready');
  }
  function openMap(){const first=state.snapshot?.maps?.[0]?.url;if(!first){status('No hay una ruta cartográfica verificada para abrir todavía.','partial');return;}window.open(first,'_blank','noopener,noreferrer');}
  function showHistory(){const rows=parse(KEYS.history,[]);const latest=rows.slice(0,5).map(row=>`${row.destination||'Destino'} · ${row.dates?.start||'sin fecha'}`).join(' | ');status(rows.length?`Historial local: ${rows.length} viaje(s). ${latest}`:'Historial local vacío.','ready');}

  function moduleCard(name,title,copy,action,label,disabled=false){return `<article class="asc-module"><span>${esc(name)}</span><strong>${esc(title)}</strong><p>${esc(copy)}</p><button type="button" data-integration-action="${esc(action)}" ${disabled?'disabled':''}>${esc(label)}</button></article>`;}
  function render(snapshot){
    const panel=ensurePanel();panel.hidden=false;const grid=document.getElementById('travelIntegrationGrid');const favorites=parse(KEYS.favorites,[]).length,alerts=parse(KEYS.alerts,[]).length,history=parse(KEYS.history,[]).length;grid.innerHTML=[
      moduleCard('Vuelos + Presupuesto','Sincronizar búsqueda',`${snapshot.origin||'Origen pendiente'} → ${snapshot.destination||'Destino pendiente'} · ${snapshot.dates.start||'—'} a ${snapshot.dates.end||'—'}`,'dashboard','Enviar al tablero'),
      moduleCard('Estancias inteligentes','Transferir parámetros','Destino, fechas, huéspedes y presupuesto. Los escenarios demo permanecen demo.','stays','Abrir Estancias'),
      moduleCard('Oportunidades','Contexto del viaje','Guarda destino/fechas para contrastar importaciones sin declararlas compatibles automáticamente.','opportunities','Abrir Oportunidades'),
      moduleCard('Favoritos',`${favorites} guardado(s)`,'Persistencia local mínima del viaje; sin comentarios libres ni perfil completo.','favorite','Guardar favorito'),
      moduleCard('Alertas',`${alerts} vigilancia(s) local(es)`,'Guarda intención de vigilar precio/eventos/disponibilidad. No activa canal externo.','alert','Crear vigilancia local'),
      moduleCard('Mapas',`${snapshot.maps.length} ruta(s)`,'Abre únicamente rutas generadas por Fase 6 cuando existe evidencia geográfica suficiente.','map','Abrir primera ruta',snapshot.maps.length===0),
      moduleCard('Historial',`${history} viaje(s)`,'Historial local acotado a 20 snapshots ejecutivos para retomar decisiones.','history','Ver historial'),
      moduleCard('PDF + expediente',snapshot.contract,'El PDF y JSON conservan fuentes, contratos y reglas de no-fabricación de Fases 3–9.','pdf','Volver al PDF')
    ].join('');
    grid.querySelectorAll('[data-integration-action]').forEach(button=>button.addEventListener('click',()=>{const action=button.dataset.integrationAction;if(action==='dashboard')syncDashboard();else if(action==='stays')syncStays();else if(action==='opportunities')syncOpportunities();else if(action==='favorite')saveFavorite();else if(action==='alert')saveAlert();else if(action==='map')openMap();else if(action==='history')showHistory();else if(action==='pdf')document.getElementById('travelPdfEngine')?.scrollIntoView({behavior:'smooth',block:'center'});}));
    status(`Integration Hub listo · ${snapshot.destination||'destino pendiente'} · contratos hasta Fase 9 enlazados · historial local ${history}.`,'ready');
  }

  function build(detail={}){
    state.profile=detail.profile||window.__VIAJES_ASC_ACTIVE_TRIP_PROFILE__||{};state.research=detail.research||window.__VIAJES_ASC_TRAVEL_RESEARCH__||{};state.logistics=detail.logistics||window.__VIAJES_ASC_LOGISTICS__||{};state.itinerary=detail.itinerary||window.__VIAJES_ASC_ITINERARY__||{};state.cost=detail.cost||window.__VIAJES_ASC_COST__||{};state.report=detail.report||window.__VIAJES_ASC_PDF_REPORT__||{};state.selectedWindow=detail.selectedWindow||window.__VIAJES_ASC_SELECTED_WINDOW__||{};state.snapshot=core.buildSnapshot(state.profile,state.research,state.logistics,state.itinerary,state.cost,state.report,state.selectedWindow);window.__VIAJES_ASC_INTEGRATION__=state.snapshot;saveHistory();render(state.snapshot);window.dispatchEvent(new CustomEvent('viajes:integration-ready',{detail:{snapshot:state.snapshot}}));
  }

  styles();ensurePanel();window.addEventListener('viajes:pdf-ready',event=>build(event.detail||{}));window.TravelIntegration={build,getSnapshot:()=>state.snapshot,syncDashboard,syncStays,syncOpportunities,saveFavorite,saveAlert,showHistory};
})();
