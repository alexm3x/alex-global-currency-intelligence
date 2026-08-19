(() => {
  'use strict';
  if (window.__VIAJES_ASC_LOGISTICS_ENGINE__) return;
  window.__VIAJES_ASC_LOGISTICS_ENGINE__ = true;

  const core = window.TravelLogisticsCore;
  if (!core) { console.error('Viajes ASC Phase 6: logistics core unavailable'); return; }

  const state = { profile:null, research:null, analysis:null };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const safeHref = value => { try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  const fmtDate = value => { try { return new Intl.DateTimeFormat('es-MX',{weekday:'short',day:'2-digit',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(`${value}T00:00:00Z`)); } catch { return value || '—'; } };
  const fmtTime = time => !time ? 'Horario pendiente' : `${String(Math.floor(time.start/60)%24).padStart(2,'0')}:${String(time.start%60).padStart(2,'0')}${time.end!==null?`–${String(Math.floor(time.end/60)%24).padStart(2,'0')}:${String(time.end%60).padStart(2,'0')}`:''}`;

  function styles(){
    if(document.getElementById('viajes-phase6-styles'))return;
    const style=document.createElement('style');style.id='viajes-phase6-styles';
    style.textContent=`.asc-logistics{margin-top:18px;border:1px solid rgba(103,232,249,.22);border-radius:18px;background:linear-gradient(145deg,rgba(7,17,25,.94),rgba(5,11,16,.82));overflow:hidden}.asc-logistics[hidden]{display:none}.asc-logistics__head{display:flex;justify-content:space-between;gap:20px;padding:22px 24px;border-bottom:1px solid #1e293b}.asc-logistics__head p{color:#67e8f9;font:700 9px/1.3 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}.asc-logistics__head h2{margin-top:7px;color:#fff;font-size:23px}.asc-logistics__head span{display:block;margin-top:7px;color:#8b9aab;font-size:11px;line-height:1.55}.asc-logistics__status{padding:13px 24px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:11px}.asc-logistics__status[data-state="ready"]{color:#86efac}.asc-logistics__status[data-state="partial"]{color:#fcd34d}.asc-logistics__status[data-state="error"]{color:#fda4af}.asc-logistics__metrics{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:1px;background:#1e293b}.asc-logistics__metrics div{padding:14px;background:#08131c}.asc-logistics__metrics span{display:block;color:#64748b;font:700 8px/1.2 ui-monospace,monospace;text-transform:uppercase}.asc-logistics__metrics strong{display:block;margin-top:5px;color:#fff;font-size:15px}.asc-logistics__days{display:grid;gap:14px;padding:18px 24px 24px}.asc-day{border:1px solid #263446;border-radius:12px;background:rgba(5,11,16,.7);overflow:hidden}.asc-day__head{display:flex;justify-content:space-between;gap:14px;padding:14px 16px;border-bottom:1px solid #1e293b}.asc-day__head strong{color:#fff;font-size:13px}.asc-day__head span{color:#8fa0b5;font-size:9px}.asc-day__head em{font-style:normal;color:#e8c66a;font:700 9px/1.2 ui-monospace,monospace}.asc-day__stops{display:grid}.asc-stop{display:grid;grid-template-columns:90px minmax(0,1fr) auto;gap:12px;align-items:start;padding:13px 16px;border-bottom:1px solid #16222f}.asc-stop:last-child{border-bottom:0}.asc-stop__time{color:#67e8f9;font:700 9px/1.4 ui-monospace,monospace}.asc-stop h3{color:#fff;font-size:12px}.asc-stop p{margin-top:4px;color:#8493a7;font-size:10px;line-height:1.5}.asc-stop small{display:block;margin-top:5px;color:#64748b;font-size:8px}.asc-segment{margin:0 16px;padding:8px 10px;border-left:2px solid #334155;color:#8fa0b5;font-size:9px;line-height:1.5}.asc-segment--impossible{border-color:#fb7185;color:#fda4af}.asc-segment--strained{border-color:#facc15;color:#fde68a}.asc-segment--ok{border-color:#4ade80;color:#86efac}.asc-segment--unverified{border-color:#94a3b8}.asc-day__foot{display:flex;justify-content:space-between;gap:12px;align-items:center;padding:12px 16px;border-top:1px solid #1e293b}.asc-day__foot span{color:#64748b;font-size:9px}.asc-day__foot a{color:#67e8f9;font-size:9px;font-weight:700}.asc-logistics__note{padding:0 24px 18px;color:#64748b;font-size:9px;line-height:1.6}.asc-logistics__empty{padding:22px 24px;color:#94a3b8;font-size:11px;line-height:1.65}@media(max-width:900px){.asc-logistics__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.asc-logistics__head{display:grid}.asc-stop{grid-template-columns:78px minmax(0,1fr)}}@media(max-width:600px){.asc-logistics__head,.asc-logistics__status,.asc-logistics__days,.asc-logistics__note{padding-left:18px;padding-right:18px}.asc-stop{grid-template-columns:1fr}.asc-day__foot{display:grid}}`;
    document.head.appendChild(style);
  }

  function ensurePanel(){
    let panel=document.getElementById('travelLogisticsEngine');if(panel)return panel;
    panel=document.createElement('section');panel.id='travelLogisticsEngine';panel.className='asc-logistics';panel.hidden=true;panel.setAttribute('aria-labelledby','travelLogisticsTitle');
    panel.innerHTML=`<header class="asc-logistics__head"><div><p>Fase 6 · Logística geográfica y temporal</p><h2 id="travelLogisticsTitle">¿Cabe realmente todo en el viaje?</h2><span>Horarios → choques → traslados → zonas → ruta diaria → factibilidad.</span></div></header><div id="travelLogisticsStatus" class="asc-logistics__status" data-state="idle">Seleccione fechas y obtenga investigación verificable para analizar la logística.</div><div id="travelLogisticsMetrics" class="asc-logistics__metrics" hidden></div><div id="travelLogisticsDays" class="asc-logistics__days"></div><div class="asc-logistics__note">Las distancias solo se calculan cuando existen coordenadas. Los tiempos de traslado derivados de distancia son estimaciones conservadoras, no tiempos de tráfico en vivo. Cuando falta evidencia, Viajes ASC marca el tramo como “requiere verificación” en lugar de inventar una duración.</div>`;
    (document.getElementById('travelWindowEngine')||document.getElementById('travelIntelligenceResearch')||document.getElementById('travelAssistant'))?.insertAdjacentElement('afterend',panel);
    return panel;
  }
  function status(message,mode='idle'){const el=document.getElementById('travelLogisticsStatus');if(!el)return;el.textContent=message;el.dataset.state=mode;}

  function segmentText(segment,from,to){
    if(!segment)return'';
    const distance=segment.distance_km!==null?`${segment.distance_km} km`:'distancia pendiente';
    const transfer=segment.transfer?.minutes?` · traslado estimado ${segment.transfer.minutes} min`:'';
    const gap=segment.temporal?.gap_minutes!==null&&segment.temporal?.gap_minutes!==undefined?` · margen ${segment.temporal.gap_minutes} min`:'';
    const labels={impossible:'Choque horario',strained:'Margen insuficiente',ok:'Tramo factible',unverified:'Traslado por verificar'};
    return `<div class="asc-segment asc-segment--${esc(segment.feasibility)}"><strong>${esc(labels[segment.feasibility]||'Tramo')}</strong> · ${esc(from.name)} → ${esc(to.name)} · ${esc(distance)}${esc(transfer)}${esc(gap)}</div>`;
  }

  function render(analysis){
    const panel=ensurePanel();panel.hidden=false;
    const metrics=document.getElementById('travelLogisticsMetrics'),days=document.getElementById('travelLogisticsDays');
    const m=analysis.metrics||{};metrics.hidden=false;
    metrics.innerHTML=`<div><span>ASC Logistics</span><strong>${m.logistics_score ?? '—'}</strong></div><div><span>Días activos</span><strong>${m.active_days||0}</strong></div><div><span>Choques</span><strong>${m.impossible||0}</strong></div><div><span>Ajustes</span><strong>${m.strained||0}</strong></div><div><span>Por verificar</span><strong>${m.unverified||0}</strong></div>`;
    const active=(analysis.days||[]).filter(day=>day.stops.length);
    if(!active.length){days.innerHTML='<div class="asc-logistics__empty">Todavía no hay actividades con fecha dentro de la estancia seleccionada. La estructura logística está lista, pero no fabricará paradas ni horarios.</div>';status('Fase 6 lista; faltan actividades fechadas para construir la ruta diaria.','partial');return;}
    days.innerHTML=active.map(day=>{
      const stopMarkup=day.stops.map((stop,index)=>`${index?segmentText(day.segments[index-1],day.stops[index-1],stop):''}<article class="asc-stop"><div class="asc-stop__time">${esc(fmtTime(stop.time))}</div><div><h3>${esc(stop.name)}</h3><p>${esc([stop.venue,stop.location].filter(Boolean).join(' · ')||'Ubicación pendiente')}</p><small>${esc(stop.category)} · ${esc(stop.verification_status)}</small></div><div>${safeHref(stop.source_url)?`<a href="${esc(safeHref(stop.source_url))}" target="_blank" rel="noopener noreferrer">Fuente</a>`:''}</div></article>`).join('');
      const map=day.maps_url?`<a href="${esc(day.maps_url)}" target="_blank" rel="noopener noreferrer">Abrir ruta del día en Maps →</a>`:'<span>Ruta cartográfica pendiente de ubicaciones suficientes</span>';
      return `<section class="asc-day"><header class="asc-day__head"><div><strong>${esc(fmtDate(day.date))}</strong><span>${day.stops.length} parada(s) · ${day.clusters.length} zona(s)</span></div><em>${esc(day.verdict)}</em></header><div class="asc-day__stops">${stopMarkup}</div><footer class="asc-day__foot"><span>Geo ${day.metrics.geo_coverage}% · Horarios ${day.metrics.time_coverage}% · Logistics ${day.metrics.logistics_score}</span>${map}</footer></section>`;
    }).join('');
    const mode=(m.impossible||m.strained)?'partial':'ready';status(`${analysis.verdict} · ${m.active_days||0} día(s) con actividades · ${m.impossible||0} choque(s) horario(s) · ${m.strained||0} traslado(s) a ajustar.`,mode);
  }

  function analyze(profile,research){
    if(!profile)return;state.profile=profile;state.research=research||window.__VIAJES_ASC_TRAVEL_RESEARCH__||{items:[]};
    const panel=ensurePanel();panel.hidden=false;
    const analysis=core.analyzeTrip(profile,state.research);state.analysis=analysis;window.__VIAJES_ASC_LOGISTICS__=analysis;render(analysis);
    window.dispatchEvent(new CustomEvent('viajes:logistics-ready',{detail:{profile,research:state.research,logistics:analysis}}));
  }

  styles();ensurePanel();
  window.addEventListener('viajes:research-ready',event=>analyze(event.detail?.profile,event.detail?.research));
  window.addEventListener('viajes:known-dates-request',event=>{state.profile=event.detail?.profile||null;const panel=ensurePanel();panel.hidden=false;if(window.__VIAJES_ASC_TRAVEL_RESEARCH__)analyze(state.profile,window.__VIAJES_ASC_TRAVEL_RESEARCH__);else status('Fechas recibidas. Esperando investigación verificable para construir la logística.','partial');});
  window.addEventListener('viajes:window-selected',event=>{const profile=event.detail?.profile||window.__VIAJES_ASC_ACTIVE_TRIP_PROFILE__;analyze(profile,window.__VIAJES_ASC_TRAVEL_RESEARCH__||{items:[]});});
  window.TravelLogistics={analyze,getResult:()=>state.analysis};
})();
