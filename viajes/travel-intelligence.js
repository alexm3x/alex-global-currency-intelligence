(() => {
  'use strict';
  if (window.__VIAJES_ASC_INTELLIGENCE_ENGINE__) return;
  window.__VIAJES_ASC_INTELLIGENCE_ENGINE__ = true;

  const core = window.TravelIntelligenceCore;
  if (!core) { console.error('Viajes ASC Intelligence: scoring core unavailable'); return; }

  const DEFAULT_ENDPOINT = 'https://viajes-asc-assistant.proadmexico.workers.dev';
  const state = { profile: null, result: null, loading: false, controller: null };
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
  const safeHref = value => { try { const url = new URL(String(value || '')); return url.protocol === 'https:' ? url.href : ''; } catch { return ''; } };
  const fmt = value => Number.isFinite(Number(value)) ? new Intl.NumberFormat('es-MX', { maximumFractionDigits: 1 }).format(Number(value)) : '—';
  const money = price => {
    if (!price || !Number.isFinite(Number(price.amount))) return price?.note ? esc(price.note) : 'No observado';
    try { return new Intl.NumberFormat('es-MX', { style:'currency', currency:price.currency || 'USD', maximumFractionDigits:0 }).format(Number(price.amount)); }
    catch { return `${Number(price.amount)} ${esc(price.currency || '')}`; }
  };

  function endpoint() {
    const configured = document.querySelector('meta[name="viajes-assistant-api"]')?.content?.trim() || window.VIAJES_ASC_CONFIG?.assistantEndpoint?.trim();
    return configured || DEFAULT_ENDPOINT;
  }
  function sessionId() {
    const key = 'viajesASCIntelligenceSession'; let id = sessionStorage.getItem(key);
    if (!id) { id = globalThis.crypto?.randomUUID?.() || `asc-${Date.now()}-${Math.random().toString(36).slice(2)}`; sessionStorage.setItem(key, id); }
    return id;
  }
  function styles() {
    if (document.getElementById('viajes-intelligence-engine-styles')) return;
    const style = document.createElement('style'); style.id = 'viajes-intelligence-engine-styles';
    style.textContent = `.asc-intel{border:1px solid rgba(103,232,249,.2);border-radius:18px;background:linear-gradient(145deg,rgba(7,17,25,.9),rgba(5,11,16,.76));overflow:hidden;box-shadow:0 26px 80px rgba(0,0,0,.28)}.asc-intel[hidden]{display:none}.asc-intel__head{display:flex;justify-content:space-between;gap:18px;align-items:flex-start;padding:22px 24px;border-bottom:1px solid #1e293b}.asc-intel__head p{color:#e8c66a;font:700 9px/1.3 ui-monospace,monospace;letter-spacing:.14em;text-transform:uppercase}.asc-intel__head h2{margin-top:7px;color:#fff;font-size:24px;font-weight:650}.asc-intel__head span{display:block;margin-top:7px;color:#8493a7;font-size:11px;line-height:1.55}.asc-intel__head button{border:1px solid #334155;border-radius:8px;padding:10px 13px;color:#cbd5e1;font-size:11px;font-weight:700;white-space:nowrap}.asc-intel__head button:hover{border-color:#67e8f9;color:#67e8f9}.asc-intel__head button:disabled{opacity:.45;cursor:not-allowed}.asc-intel__status{padding:14px 24px;border-bottom:1px solid #1e293b;color:#94a3b8;font-size:11px;line-height:1.6}.asc-intel__status[data-state="loading"]{color:#67e8f9}.asc-intel__status[data-state="error"]{color:#fda4af;background:rgba(244,63,94,.05)}.asc-intel__status[data-state="ready"]{color:#86efac;background:rgba(34,197,94,.04)}.asc-intel__metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:1px;background:#1e293b;border-bottom:1px solid #1e293b}.asc-intel__metrics div{padding:14px 16px;background:#071119}.asc-intel__metrics span{display:block;color:#64748b;font:600 8px/1.3 ui-monospace,monospace;text-transform:uppercase;letter-spacing:.08em}.asc-intel__metrics strong{display:block;margin-top:6px;color:#fff;font-size:16px}.asc-intel__summary{padding:18px 24px;border-bottom:1px solid #1e293b}.asc-intel__summary strong{color:#fff;font-size:14px}.asc-intel__summary p{margin-top:7px;color:#94a3b8;font-size:12px;line-height:1.65}.asc-intel__collision{margin-top:12px;padding:11px 12px;border:1px solid rgba(232,198,106,.35);border-radius:9px;background:rgba(232,198,106,.06);color:#f4d982;font:700 10px/1.5 ui-monospace,monospace;text-transform:uppercase}.asc-intel__grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;padding:18px 24px 24px}.asc-event{min-width:0;border:1px solid #263446;border-radius:12px;background:rgba(5,11,16,.72);padding:16px}.asc-event__top{display:flex;gap:12px;justify-content:space-between;align-items:flex-start}.asc-event__tag{display:inline-flex;padding:5px 7px;border:1px solid rgba(103,232,249,.3);border-radius:999px;color:#67e8f9;font:700 8px/1 ui-monospace,monospace;text-transform:uppercase}.asc-event h3{margin-top:10px;color:#fff;font-size:15px;line-height:1.35}.asc-event__scores{display:flex;gap:6px}.asc-score{min-width:54px;padding:7px;border:1px solid #334155;border-radius:8px;text-align:center}.asc-score span{display:block;color:#64748b;font:600 7px/1.2 ui-monospace,monospace;text-transform:uppercase}.asc-score strong{display:block;margin-top:4px;color:#fff;font-size:14px}.asc-event__meta{display:flex;flex-wrap:wrap;gap:6px;margin-top:12px}.asc-event__meta span{padding:5px 7px;border-radius:6px;background:#0b1620;color:#94a3b8;font-size:9px}.asc-event__why{margin-top:12px;color:#9ba9ba;font-size:11px;line-height:1.6}.asc-event__foot{display:flex;justify-content:space-between;gap:10px;align-items:center;margin-top:13px;padding-top:12px;border-top:1px solid #1e293b}.asc-event__foot small{color:#64748b;font-size:9px}.asc-event__foot a{color:#67e8f9;font-size:10px;font-weight:700}.asc-event__foot a:hover{color:#fff}.asc-status--confirmed{color:#86efac!important}.asc-status--pending{color:#fcd34d!important}.asc-status--estimated{color:#c4b5fd!important}.asc-empty{grid-column:1/-1;padding:24px;border:1px dashed #334155;border-radius:12px;color:#94a3b8;font-size:12px;line-height:1.7}@media(max-width:900px){.asc-intel__metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.asc-intel__grid{grid-template-columns:1fr}}@media(max-width:600px){.asc-intel__head{display:grid;padding:18px}.asc-intel__head button{width:100%}.asc-intel__status,.asc-intel__summary{padding-left:18px;padding-right:18px}.asc-intel__grid{padding:14px 18px 20px}.asc-event__top{display:grid}.asc-event__scores{justify-content:flex-start}}`;
    document.head.appendChild(style);
  }
  function ensurePanel() {
    let panel = document.getElementById('travelIntelligenceResearch'); if (panel) return panel;
    panel = document.createElement('section'); panel.id = 'travelIntelligenceResearch'; panel.className = 'asc-intel'; panel.hidden = true; panel.setAttribute('aria-labelledby', 'travelIntelligenceResearchTitle');
    panel.innerHTML = `<header class="asc-intel__head"><div><p>Fases 3 + 4 · Investigación + Scoring</p><h2 id="travelIntelligenceResearchTitle">Inteligencia temporal del viaje</h2><span id="travelIntelligenceSubtitle">Eventos, cultura, deportes y experiencias con fuente, fecha de consulta y puntuación ASC.</span></div><button id="travelIntelligenceRetry" type="button" disabled>Actualizar investigación</button></header><div id="travelIntelligenceStatus" class="asc-intel__status" data-state="idle">Prepare un viaje inteligente para iniciar la investigación.</div><div id="travelIntelligenceMetrics" class="asc-intel__metrics" hidden></div><div id="travelIntelligenceSummary" class="asc-intel__summary" hidden></div><div id="travelIntelligenceGrid" class="asc-intel__grid"></div>`;
    document.getElementById('travelAssistant')?.insertAdjacentElement('afterend', panel);
    document.getElementById('travelIntelligenceRetry')?.addEventListener('click', () => state.profile && research(state.profile));
    return panel;
  }
  function status(message, mode = 'idle') { const el = document.getElementById('travelIntelligenceStatus'); if (!el) return; el.textContent = message; el.dataset.state = mode; }
  function render(result) {
    const panel = ensurePanel(); panel.hidden = false;
    const metrics = document.getElementById('travelIntelligenceMetrics'); const summary = document.getElementById('travelIntelligenceSummary'); const grid = document.getElementById('travelIntelligenceGrid');
    const m = result.metrics || {}; const sourceCount = Array.isArray(result.sources) ? result.sources.length : 0;
    metrics.hidden = false; metrics.innerHTML = `<div><span>Fuentes verificadas</span><strong>${sourceCount}</strong></div><div><span>Oportunidades</span><strong>${m.total_items || 0}</strong></div><div><span>Confirmadas</span><strong>${m.confirmed_items || 0}</strong></div><div><span>Extraordinarias</span><strong>${m.extraordinary_items || 0}</strong></div>`;
    summary.hidden = false; const collision = m.collision?.detected ? `<div class="asc-intel__collision">🔥 ${esc(m.collision.label)} · ${m.collision.count} oportunidades de alta relevancia coinciden</div>` : '';
    summary.innerHTML = `<strong>${esc(result.summary || 'Investigación completada')}</strong><p>Información verificada: ${esc(result.verified_at || new Date().toISOString())}. Los precios variables se muestran como precio observado; si no existe evidencia suficiente, permanecen como no observados.</p>${collision}`;
    const items = Array.isArray(result.items) ? result.items : [];
    if (!items.length) { grid.innerHTML = '<div class="asc-empty"><strong>No se encontraron oportunidades suficientemente verificadas.</strong><br>Viajes ASC no rellenará el espacio con eventos, precios o enlaces inventados. Ajuste fechas o vuelva a consultar más adelante.</div>'; return; }
    grid.innerHTML = items.map(item => {
      const href = safeHref(item.source_url); const date = [item.date_start, item.time].filter(Boolean).join(' · ') || 'Fecha pendiente'; const place = [item.venue, item.location].filter(Boolean).join(' · ') || 'Lugar pendiente'; const cls = `asc-status--${esc(item.verification_status || 'pending')}`; const premium = Number.isFinite(Number(item.event_premium_pct)) ? ` · Event Premium ${Number(item.event_premium_pct) >= 0 ? '+' : ''}${fmt(item.event_premium_pct)}%` : '';
      return `<article class="asc-event"><div class="asc-event__top"><div><span class="asc-event__tag">${esc(item.category || 'experiencia')}</span><h3>${esc(item.name || 'Oportunidad')}</h3></div><div class="asc-event__scores"><div class="asc-score"><span>Experience</span><strong>${fmt(item.asc_experience_score)}</strong></div><div class="asc-score"><span>Opportunity</span><strong>${fmt(item.opportunity_index)}</strong></div></div></div><div class="asc-event__meta"><span>${esc(date)}</span><span>${esc(place)}</span><span>${money(item.price_observed)}</span><span class="${cls}">${esc(item.verification_status || 'pending')}</span></div><p class="asc-event__why">${esc(item.why_relevant || '')}</p><div class="asc-event__foot"><small>${esc(item.executive_classification || '')}${premium}</small>${href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">Fuente oficial / verificada →</a>` : '<small>Link pendiente de confirmación</small>'}</div></article>`;
    }).join('');
  }
  async function research(profile) {
    if (!profile || state.loading) return; state.profile = profile; const panel = ensurePanel(); panel.hidden = false; state.loading = true; const retry = document.getElementById('travelIntelligenceRetry'); if (retry) retry.disabled = true;
    status('Investigando coincidencias temporales y validando fuentes…', 'loading'); document.getElementById('travelIntelligenceGrid').innerHTML = '<div class="asc-empty">Consultando fuentes actuales. Solo se mostrarán resultados que superen las reglas de trazabilidad.</div>';
    state.controller?.abort(); state.controller = new AbortController(); const timer = setTimeout(() => state.controller.abort(), 45000);
    try {
      const response = await fetch(`${endpoint().replace(/\/$/, '')}/research`, { method:'POST', headers:{ 'content-type':'application/json', 'x-asc-session':sessionId() }, body:JSON.stringify({ action:'research_trip', profile }), signal:state.controller.signal });
      const payload = await response.json().catch(() => ({})); if (!response.ok) throw new Error(payload.error || `HTTP ${response.status}`);
      const scored = core.scoreResearch(payload.research || payload); state.result = scored; window.__VIAJES_ASC_TRAVEL_RESEARCH__ = scored; render(scored); status(`Investigación completada · ${scored.metrics?.confirmed_items || 0} oportunidades confirmadas · contrato ${scored.scoring?.contract || 'ASC'}.`, 'ready'); window.dispatchEvent(new CustomEvent('viajes:research-ready', { detail:{ profile, research:scored } }));
    } catch (error) {
      const message = error?.name === 'AbortError' ? 'La investigación excedió el tiempo de respuesta.' : `Motor de investigación no disponible: ${error.message}`; status(`${message} No se mostrarán datos no verificados.`, 'error'); document.getElementById('travelIntelligenceGrid').innerHTML = '<div class="asc-empty">No fue posible confirmar información actual. El resto del dashboard continúa operativo con sus datos publicados; esta capa temporal queda pendiente de una nueva consulta.</div>'; window.dispatchEvent(new CustomEvent('viajes:research-error', { detail:{ profile, error:String(error?.message || error) } }));
    } finally { clearTimeout(timer); state.loading = false; if (retry) retry.disabled = false; }
  }

  styles(); ensurePanel();
  window.addEventListener('viajes:known-dates-request', event => research(event.detail?.profile));
  window.addEventListener('viajes:inverse-date-request', event => research(event.detail?.profile));
  window.TravelIntelligence = { research, getResult:() => state.result, scoreWindow:(factors, weights) => core.travelWindowScore(factors, weights), endpoint };
})();

(() => {
  if (window.__VIAJES_ASC_WINDOW_ENGINE_LOADER__) return;
  window.__VIAJES_ASC_WINDOW_ENGINE_LOADER__ = true;
  const script=document.createElement('script');
  script.src='travel-window-engine.js';
  script.id='viajes-phase5-window-engine-script';
  script.defer=true;
  script.addEventListener('error',()=>console.error('Viajes ASC Phase 5: no fue posible cargar travel-window-engine.js'),{once:true});
  document.body.appendChild(script);
})();

(() => {
  if (window.__VIAJES_ASC_LOGISTICS_LOADER__) return;
  window.__VIAJES_ASC_LOGISTICS_LOADER__ = true;
  const load=(src,id)=>new Promise((resolve,reject)=>{
    const existing=document.getElementById(id);
    if(existing){if(existing.dataset.loaded==='true')resolve();else existing.addEventListener('load',resolve,{once:true});return;}
    const script=document.createElement('script');script.src=src;script.id=id;script.defer=true;
    script.addEventListener('load',()=>{script.dataset.loaded='true';resolve();},{once:true});
    script.addEventListener('error',()=>reject(new Error(`No fue posible cargar ${src}`)),{once:true});
    document.body.appendChild(script);
  });
  load('travel-logistics-core.js','viajes-phase6-logistics-core-script')
    .then(()=>load('travel-logistics.js','viajes-phase6-logistics-ui-script'))
    .catch(error=>console.error('Viajes ASC Phase 6:',error.message));
})();
