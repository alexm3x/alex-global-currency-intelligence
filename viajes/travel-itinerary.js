(() => {
  'use strict';
  if (window.__VIAJES_ASC_ITINERARY_ENGINE__) return;
  window.__VIAJES_ASC_ITINERARY_ENGINE__ = true;

  const core = window.TravelItineraryCore;
  if (!core) { console.error('Viajes ASC Phase 7: itinerary core unavailable'); return; }
  const state = { profile:null, research:null, logistics:null, itinerary:null };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeHref = value => { try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  const fmtDate = value => { try { return new Intl.DateTimeFormat('es-MX',{weekday:'long',day:'2-digit',month:'long',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`)); } catch { return value || '—'; } };
  const fmtTime = stop => !stop?.time ? 'Horario por confirmar' : `${String(Math.floor(stop.time.start/60)%24).padStart(2,'0')}:${String(stop.time.start%60).padStart(2,'0')}${stop.time.end!==null?`–${String(Math.floor(stop.time.end/60)%24).padStart(2,'0')}:${String(stop.time.end%60).padStart(2,'0')}`:''}`;
  const labels = { morning:'Mañana', lunch:'Comida', afternoon:'Tarde', evening:'Noche', flexible:'Flexible / por confirmar' };

  function styles(){
    if(document.getElementById('viajes-phase7-styles'))return;
    const style=document.createElement('style');style.id='viajes-phase7-styles';
    style.textContent=`.asc-itin{margin-top:18px;border:1px solid rgba(232,198,106,.25);border-radius:18px;background:linear-gradient(145deg,rgba(12,19,25,.95),rgba(6,12,17,.84));overflow:hidden}.asc-itin[hidden]{display:none}.asc-itin__head{padding:22px 24px;border-bottom:1px solid #1e293b}.asc-itin__head p{color:#e8c66a;font:700 9px/1.3 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}.asc-itin__head h2{margin-top:7px;color:#fff;font-size:23px}.asc-itin__head span{display:block;margin-top:7px;color:#8b9aab;font-size:11px;line-height:1.55}.asc-itin__status{padding:13px 24px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:11px}.asc-itin__status[data-state=ready]{color:#86efac}.asc-itin__status[data-state=partial]{color:#fcd34d}.asc-itin__metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#1e293b}.asc-itin__metrics div{padding:14px;background:#08131c}.asc-itin__metrics span{display:block;color:#64748b;font:700 8px/1.2 ui-monospace,monospace;text-transform:uppercase}.asc-itin__metrics strong{display:block;margin-top:5px;color:#fff;font-size:15px}.asc-itin__days{display:grid;gap:14px;padding:18px 24px 24px}.asc-itin-day{border:1px solid #263446;border-radius:12px;background:rgba(5,11,16,.72);overflow:hidden}.asc-itin-day__head{display:flex;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid #1e293b}.asc-itin-day__head strong{color:#fff;font-size:13px;text-transform:capitalize}.asc-itin-day__head em{font-style:normal;color:#e8c66a;font:700 9px/1.2 ui-monospace,monospace}.asc-period{display:grid;grid-template-columns:120px minmax(0,1fr);gap:14px;padding:13px 16px;border-bottom:1px solid #16222f}.asc-period:last-child{border-bottom:0}.asc-period>strong{color:#67e8f9;font:700 9px/1.4 ui-monospace,monospace;text-transform:uppercase}.asc-period__items{display:grid;gap:8px}.asc-itin-item{padding:10px 11px;border:1px solid #223142;border-radius:9px;background:#09141d}.asc-itin-item__top{display:flex;justify-content:space-between;gap:12px}.asc-itin-item h3{color:#fff;font-size:12px}.asc-itin-item b{color:#e8c66a;font:700 8px/1.2 ui-monospace,monospace}.asc-itin-item p{margin-top:4px;color:#8493a7;font-size:10px;line-height:1.5}.asc-itin-item small{display:block;margin-top:5px;color:#64748b;font-size:8px}.asc-itin-item a{display:inline-block;margin-top:6px;color:#67e8f9;font-size:9px;font-weight:700}.asc-planning-block{padding:9px 10px;border:1px dashed #334155;border-radius:8px;color:#94a3b8;font-size:9px}.asc-itin-alt{padding:12px 16px;border-top:1px solid #1e293b;color:#7f8da0;font-size:9px;line-height:1.55}.asc-itin__note{padding:0 24px 18px;color:#64748b;font-size:9px;line-height:1.6}@media(max-width:900px){.asc-itin__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.asc-period{grid-template-columns:1fr}}@media(max-width:600px){.asc-itin__head,.asc-itin__status,.asc-itin__days,.asc-itin__note{padding-left:18px;padding-right:18px}.asc-itin-day__head,.asc-itin-item__top{display:grid}}`;
    document.head.appendChild(style);
  }

  function ensurePanel(){
    let panel=document.getElementById('travelItineraryEngine');if(panel)return panel;
    panel=document.createElement('section');panel.id='travelItineraryEngine';panel.className='asc-itin';panel.hidden=true;panel.setAttribute('aria-labelledby','travelItineraryTitle');
    panel.innerHTML=`<header class="asc-itin__head"><p>Fase 7 · Motor automático de itinerario</p><h2 id="travelItineraryTitle">Del listado de oportunidades a un día ejecutable</h2><span>Prioridad → horarios fijos → ritmo → pausas → alternativas → itinerario diario.</span></header><div id="travelItineraryStatus" class="asc-itin__status" data-state="idle">Esperando análisis logístico de Fase 6.</div><div id="travelItineraryMetrics" class="asc-itin__metrics" hidden></div><div id="travelItineraryDays" class="asc-itin__days"></div><div class="asc-itin__note">Viajes ASC no inventa restaurantes, horarios de eventos ni actividades. Los bloques de comida/descanso son únicamente espacios de planificación y no implican reserva, disponibilidad ni costo.</div>`;
    (document.getElementById('travelLogisticsEngine')||document.getElementById('travelWindowEngine')||document.getElementById('travelIntelligenceResearch'))?.insertAdjacentElement('afterend',panel);
    return panel;
  }
  function status(message,mode='idle'){const el=document.getElementById('travelItineraryStatus');if(el){el.textContent=message;el.dataset.state=mode;}}
  function itemMarkup(stop){const href=safeHref(stop.source_url);return `<article class="asc-itin-item"><div class="asc-itin-item__top"><h3>${esc(stop.name)}</h3><b>${esc(stop.executive_classification||'')}</b></div><p>${esc(fmtTime(stop))} · ${esc([stop.venue,stop.location].filter(Boolean).join(' · ')||'Ubicación pendiente')}</p><small>Opportunity ${stop.opportunity_index ?? '—'} · Experience ${stop.asc_experience_score ?? '—'} · ${esc(stop.schedule_basis)}</small>${href?`<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">Fuente →</a>`:''}</article>`}
  function blockMarkup(block){return `<div class="asc-planning-block">${esc(block.label)} · bloque de planificación · sin precio asignado</div>`}

  function render(itinerary){
    const panel=ensurePanel();panel.hidden=false;const metrics=document.getElementById('travelItineraryMetrics'),days=document.getElementById('travelItineraryDays');const m=itinerary.metrics||{};
    metrics.hidden=false;metrics.innerHTML=`<div><span>Días activos</span><strong>${m.active_days||0}</strong></div><div><span>Actividades</span><strong>${m.activities||0}</strong></div><div><span>Imperdibles</span><strong>${m.must_do||0}</strong></div><div><span>Alternativas</span><strong>${m.alternates||0}</strong></div><div><span>Días a revisar</span><strong>${m.overloaded||0}</strong></div>`;
    const active=(itinerary.days||[]).filter(day=>day.selected.length||day.planning_blocks.length);
    if(!active.length){days.innerHTML='<div class="asc-itin__note">No hay suficientes actividades verificadas para construir un itinerario. Fase 7 permanece lista sin rellenar espacios con recomendaciones inventadas.</div>';status(itinerary.verdict,'partial');return;}
    days.innerHTML=active.map(day=>{const periodMarkup=Object.keys(labels).map(period=>{const activities=day.periods?.[period]||[];const blocks=(day.planning_blocks||[]).filter(block=>block.period===period);if(!activities.length&&!blocks.length)return'';return `<section class="asc-period"><strong>${esc(labels[period])}</strong><div class="asc-period__items">${activities.map(itemMarkup).join('')}${blocks.map(blockMarkup).join('')}</div></section>`}).join('');const alt=day.alternates.length?`<div class="asc-itin-alt"><strong>Alternativas si cambia el día:</strong> ${day.alternates.map(x=>esc(x.name)).join(' · ')}</div>`:'';return `<section class="asc-itin-day"><header class="asc-itin-day__head"><strong>${esc(fmtDate(day.date))}</strong><em>${esc(day.verdict)}</em></header>${periodMarkup}${alt}</section>`}).join('');
    status(`${itinerary.verdict} · ${m.activities||0} actividad(es) priorizada(s) · ${m.overloaded||0} día(s) requieren revisión.`,m.overloaded?'partial':'ready');
  }

  function build(profile,research,logistics){if(!profile||!logistics)return;state.profile=profile;state.research=research||{items:[]};state.logistics=logistics;const itinerary=core.buildItinerary(profile,state.research,logistics);state.itinerary=itinerary;window.__VIAJES_ASC_ITINERARY__=itinerary;render(itinerary);window.dispatchEvent(new CustomEvent('viajes:itinerary-ready',{detail:{profile,research:state.research,logistics,itinerary}}));}

  styles();ensurePanel();
  window.addEventListener('viajes:logistics-ready',event=>build(event.detail?.profile,event.detail?.research,event.detail?.logistics));
  window.TravelItinerary={build,getResult:()=>state.itinerary};
})();
