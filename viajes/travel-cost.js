(() => {
  'use strict';
  if (window.__VIAJES_ASC_COST_ENGINE__) return;
  window.__VIAJES_ASC_COST_ENGINE__ = true;

  const core = window.TravelCostCore;
  if (!core) { console.error('Viajes ASC Phase 8: cost core unavailable'); return; }
  const state = { profile:null, research:null, itinerary:null, selectedWindow:null, cost:null };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeHref = value => { try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  const money = (amount,currency) => { if(amount===null||amount===undefined||amount===''||!Number.isFinite(Number(amount)))return'—';try{return new Intl.NumberFormat('es-MX',{style:'currency',currency:currency||'USD',maximumFractionDigits:0}).format(Number(amount));}catch{return`${Number(amount)} ${esc(currency||'')}`;} };
  const categoryLabels={flight:'Vuelo',lodging:'Alojamiento',activity:'Actividad',local_transport:'Transporte local',meals:'Comidas'};
  const basisLabels={explicit_total:'Total explícito · sumable',nightly_reference:'Tarifa nocturna · referencia',per_person_reference:'Por persona · referencia',unit_reference:'Precio unitario/desde · referencia',unknown_basis:'Base no confirmada · referencia'};

  function styles(){
    if(document.getElementById('viajes-phase8-styles'))return;
    const style=document.createElement('style');style.id='viajes-phase8-styles';
    style.textContent=`.asc-cost{margin-top:18px;border:1px solid rgba(74,222,128,.2);border-radius:18px;background:linear-gradient(145deg,rgba(7,18,18,.95),rgba(5,11,16,.84));overflow:hidden}.asc-cost[hidden]{display:none}.asc-cost__head{padding:22px 24px;border-bottom:1px solid #1e293b}.asc-cost__head p{color:#86efac;font:700 9px/1.3 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}.asc-cost__head h2{margin-top:7px;color:#fff;font-size:23px}.asc-cost__head span{display:block;margin-top:7px;color:#8b9aab;font-size:11px;line-height:1.55}.asc-cost__status{padding:13px 24px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:11px;line-height:1.6}.asc-cost__status[data-state=ready]{color:#86efac}.asc-cost__status[data-state=partial]{color:#fcd34d}.asc-cost__metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#1e293b}.asc-cost__metrics div{padding:14px;background:#08131c}.asc-cost__metrics span{display:block;color:#64748b;font:700 8px/1.2 ui-monospace,monospace;text-transform:uppercase}.asc-cost__metrics strong{display:block;margin-top:5px;color:#fff;font-size:15px}.asc-cost__body{padding:18px 24px 24px}.asc-cost__totals{display:flex;flex-wrap:wrap;gap:8px;margin-bottom:14px}.asc-cost__total{padding:11px 12px;border:1px solid rgba(74,222,128,.24);border-radius:9px;background:rgba(34,197,94,.05)}.asc-cost__total span{display:block;color:#64748b;font:700 8px/1.2 ui-monospace,monospace;text-transform:uppercase}.asc-cost__total strong{display:block;margin-top:4px;color:#fff;font-size:16px}.asc-cost__table{overflow:auto;border:1px solid #263446;border-radius:10px}.asc-cost table{width:100%;min-width:820px;border-collapse:collapse}.asc-cost th{padding:9px 11px;border-bottom:1px solid #263446;color:#64748b;font:700 8px/1.2 ui-monospace,monospace;text-align:left;text-transform:uppercase}.asc-cost td{padding:11px;border-bottom:1px solid #182432;color:#aab6c5;font-size:10px;vertical-align:top}.asc-cost tr:last-child td{border-bottom:0}.asc-cost td strong{color:#fff}.asc-cost__sum{color:#86efac;font-weight:700}.asc-cost__ref{color:#fcd34d}.asc-cost__warnings{display:grid;gap:7px;margin-top:14px}.asc-cost__warning{padding:9px 11px;border:1px solid #2a3949;border-radius:8px;color:#94a3b8;font-size:9px;line-height:1.5}.asc-cost__missing{margin-top:14px;color:#64748b;font-size:9px;line-height:1.6}.asc-cost__missing b{color:#cbd5e1}.asc-cost__foot{padding:0 24px 18px;color:#64748b;font-size:9px;line-height:1.6}@media(max-width:900px){.asc-cost__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}}@media(max-width:600px){.asc-cost__head,.asc-cost__status,.asc-cost__body,.asc-cost__foot{padding-left:18px;padding-right:18px}}`;
    document.head.appendChild(style);
  }

  function ensurePanel(){
    let panel=document.getElementById('travelCostEngine');if(panel)return panel;
    panel=document.createElement('section');panel.id='travelCostEngine';panel.className='asc-cost';panel.hidden=true;panel.setAttribute('aria-labelledby','travelCostTitle');
    panel.innerHTML=`<header class="asc-cost__head"><p>Fase 8 · Costo total trazable</p><h2 id="travelCostTitle">¿Cuánto del viaje está realmente presupuestado?</h2><span>Precios observados → base de cobro → subtotal sumable → referencias → faltantes → presupuesto.</span></header><div id="travelCostStatus" class="asc-cost__status" data-state="idle">Esperando itinerario de Fase 7 y precios observados verificables.</div><div id="travelCostMetrics" class="asc-cost__metrics" hidden></div><div id="travelCostBody" class="asc-cost__body"></div><div class="asc-cost__foot">El subtotal observado no es una cotización final. Solo suma precios cuya evidencia indique una base total. Tarifas por persona, por noche, “desde” o con base desconocida se muestran como referencia y quedan fuera de la suma. No se aplica conversión de moneda sin evidencia FX explícita.</div>`;
    (document.getElementById('travelItineraryEngine')||document.getElementById('travelLogisticsEngine'))?.insertAdjacentElement('afterend',panel);
    return panel;
  }
  function status(message,mode='idle'){const el=document.getElementById('travelCostStatus');if(el){el.textContent=message;el.dataset.state=mode;}}

  function render(cost){
    const panel=ensurePanel();panel.hidden=false;const metrics=document.getElementById('travelCostMetrics'),body=document.getElementById('travelCostBody');const e=cost.evidence||{};metrics.hidden=false;
    const currencies=Object.keys(cost.totals_by_currency||{});const totalLabel=currencies.length?currencies.map(cur=>money(cost.totals_by_currency[cur],cur)).join(' + '):'Sin subtotal sumable';
    metrics.innerHTML=`<div><span>Cobertura de costos</span><strong>${e.coverage||0}%</strong></div><div><span>Subtotal observado</span><strong>${esc(totalLabel)}</strong></div><div><span>Líneas sumables</span><strong>${e.included_lines||0}</strong></div><div><span>Referencias</span><strong>${e.reference_lines||0}</strong></div>`;
    const totals=currencies.length?`<div class="asc-cost__totals">${currencies.map(cur=>`<div class="asc-cost__total"><span>Subtotal observado · ${esc(cur)}</span><strong>${esc(money(cost.totals_by_currency[cur],cur))}</strong></div>`).join('')}</div>`:'';
    const rows=(cost.lines||[]).length?`<div class="asc-cost__table"><table><thead><tr><th>Categoría</th><th>Concepto</th><th>Precio observado</th><th>Base</th><th>Observado</th><th>Fuente</th></tr></thead><tbody>${cost.lines.map(line=>{const href=safeHref(line.source_url);return`<tr><td>${esc(categoryLabels[line.category]||line.category)}</td><td><strong>${esc(line.label)}</strong><br>${esc(line.note||'Sin nota de base')}</td><td>${esc(money(line.amount,line.currency))}</td><td class="${line.included_in_observed_subtotal?'asc-cost__sum':'asc-cost__ref'}">${esc(basisLabels[line.basis]||line.basis)}</td><td>${esc(line.observed_at||'Timestamp pendiente')}</td><td>${href?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">Ver fuente →</a>`:'Fuente no enlazada'}</td></tr>`}).join('')}</tbody></table></div>`:'<div class="asc-cost__warning">No hay precios observados utilizables todavía. Fase 8 permanece activa sin estimar importes faltantes.</div>';
    const budget=cost.budget_comparison?`<div class="asc-cost__warning"><strong>Presupuesto ${esc(cost.budget_comparison.currency)}:</strong> ${esc(money(cost.budget_comparison.budget,cost.budget_comparison.currency))} · subtotal observado ${esc(money(cost.budget_comparison.observed_subtotal,cost.budget_comparison.currency))} · uso ${cost.budget_comparison.usage_pct}% · remanente ${esc(money(cost.budget_comparison.remaining,cost.budget_comparison.currency))}. Sin conversión FX.</div>`:'';
    const warnings=(cost.risks||[]).map(risk=>`<div class="asc-cost__warning">${esc(risk)}</div>`).join('');
    const missing=(e.missing_categories||[]).length?`<div class="asc-cost__missing"><b>Categorías aún no presupuestadas:</b> ${(e.missing_categories||[]).map(key=>esc(categoryLabels[key]||key)).join(' · ')}</div>`:'';
    const premium=cost.event_premium_pct!==null?`<div class="asc-cost__warning">Event Premium observado: ${cost.event_premium_pct>=0?'+':''}${cost.event_premium_pct}%. Se conserva como señal; no se suma otra vez a precios ya observados.</div>`:'';
    body.innerHTML=`${totals}${rows}<div class="asc-cost__warnings">${budget}${premium}${warnings}</div>${missing}`;
    status(`${cost.total_status==='complete_observed'?'Cobertura completa de categorías observadas':'Costo parcial y trazable'} · ${e.coverage||0}% de cobertura · ${e.reference_lines||0} referencia(s) excluidas de la suma.`,cost.total_status==='complete_observed'?'ready':'partial');
  }

  function analyze(profile,research,itinerary,selectedWindow){if(!profile||!itinerary)return;state.profile=profile;state.research=research||{items:[]};state.itinerary=itinerary;state.selectedWindow=selectedWindow||window.__VIAJES_ASC_SELECTED_WINDOW__||{};const cost=core.buildCost(profile,state.research,itinerary,state.selectedWindow);state.cost=cost;window.__VIAJES_ASC_COST__=cost;render(cost);window.dispatchEvent(new CustomEvent('viajes:cost-ready',{detail:{profile,research:state.research,itinerary,cost}}));}

  styles();ensurePanel();
  window.addEventListener('viajes:itinerary-ready',event=>analyze(event.detail?.profile,event.detail?.research,event.detail?.itinerary,window.__VIAJES_ASC_SELECTED_WINDOW__||{}));
  window.TravelCost={analyze,getResult:()=>state.cost};
})();

(() => {
  if (window.__VIAJES_ASC_PHASE910_LOADER__) return;
  window.__VIAJES_ASC_PHASE910_LOADER__ = true;
  const load=(src,id)=>new Promise((resolve,reject)=>{
    const existing=document.getElementById(id);
    if(existing){if(existing.dataset.loaded==='true')resolve();else existing.addEventListener('load',resolve,{once:true});return;}
    const script=document.createElement('script');script.src=src;script.id=id;script.defer=true;
    script.addEventListener('load',()=>{script.dataset.loaded='true';resolve();},{once:true});
    script.addEventListener('error',()=>reject(new Error(`No fue posible cargar ${src}`)),{once:true});
    document.body.appendChild(script);
  });
  load('travel-pdf-core.js','viajes-phase9-pdf-core-script')
    .then(()=>load('travel-pdf.js','viajes-phase9-pdf-ui-script'))
    .then(()=>load('travel-integration-core.js','viajes-phase10-integration-core-script'))
    .then(()=>load('travel-integration.js','viajes-phase10-integration-ui-script'))
    .catch(error=>console.error('Viajes ASC Phases 9-10:',error.message));
})();
