const DATA_URL = './viajes_data.json';
const PDF_URL = './Viajes_ASC_Resumen_Ejecutivo.pdf.b64';
const REFRESH_MS = 15 * 60 * 1000;
let dataCache = null;

const mxn = value => new Intl.NumberFormat('es-MX',{style:'currency',currency:'MXN',maximumFractionDigits:0}).format(Number(value)||0);
const usd = value => new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(Number(value)||0);
const esc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

function setView(id){
  document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id===id));
  document.querySelectorAll('.main-nav button').forEach(b=>b.classList.toggle('active',b.dataset.view===id));
  window.scrollTo({top:0,behavior:'smooth'});
}
document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
document.querySelectorAll('[data-jump]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.jump)));

document.getElementById('themeToggle').addEventListener('click',()=>{
  document.body.classList.toggle('dark');
  document.getElementById('themeToggle').textContent=document.body.classList.contains('dark')?'Modo claro':'Modo oscuro';
});

document.getElementById('refreshButton').addEventListener('click',()=>load(true));
document.getElementById('pdfButton').addEventListener('click',openPdf);

function renderHero(data){
  const top=data.opportunity_rankings.destinations[0];
  const active=data.weekly_destination;
  document.getElementById('hero').innerHTML=`<section class="hero"><div class="hero-copy"><span class="eyebrow">DESTINO GLOBAL #1</span><h2>${esc(top.city)}, ${esc(top.country)}</h2><p>${esc(top.why)}</p><div class="hero-meta"><span class="pill">Vuelo ${mxn(top.flight_mxn)}</span><span class="pill">Hotel ${usd(top.hotel_avg_usd)}/noche</span><span class="pill">${esc(top.route)}</span><span class="pill">Activo semanal: ${esc(active.city)}</span></div></div><div class="hero-score"><div class="score-orbit"><span>Índice ASC</span><strong>${Number(top.asc_score).toFixed(1)}</strong><small>Calidad global + oportunidad</small></div></div></section>`;
}

function renderTopCards(data){
  const top=data.opportunity_rankings.destinations.slice(0,3);
  document.getElementById('topCards').innerHTML=top.map(d=>`<article class="top-card"><div class="rank">0${d.rank}</div><span class="eyebrow">${esc(d.global_reference)}</span><h3>${esc(d.city)}</h3><p>${esc(d.why)}</p><div class="card-metrics"><div><span>ASC</span><strong>${Number(d.asc_score).toFixed(1)}</strong></div><div><span>Vuelo</span><strong>${mxn(d.flight_mxn)}</strong></div><div><span>Base</span><strong>${mxn(d.base_access_mxn)}</strong></div></div></article>`).join('');
}

function renderWeeklyPreview(data){
  const a=data.weekly_destination,t=data.profiles.tourist,b=data.profiles.business;
  document.getElementById('weeklyPreview').innerHTML=`<span class="eyebrow">DESTINO SEMANAL</span><h2>${esc(a.city)}, ${esc(a.country)}</h2><p>${esc(a.why_now)}</p><div class="card-metrics"><div><span>Turista</span><strong>${mxn(t.total_mxn)}</strong></div><div><span>Business</span><strong>${mxn(b.total_mxn)}</strong></div><div><span>Noches</span><strong>${a.recommended_nights}</strong></div></div><button class="ghost" data-jump="weekly" type="button">Abrir análisis</button>`;
  document.querySelector('#weeklyPreview [data-jump]').addEventListener('click',()=>setView('weekly'));
}

function renderRanking(data){
  document.getElementById('rankingGrid').innerHTML=data.opportunity_rankings.destinations.map(d=>`<article class="rank-card"><div class="rank-number">${String(d.rank).padStart(2,'0')}</div><div><span class="eyebrow">${esc(d.country)}</span><h3>${esc(d.city)}</h3><p>${esc(d.why)}</p><div class="detail-grid"><div><span>Vuelo</span><strong>${mxn(d.flight_mxn)}</strong></div><div><span>Hotel</span><strong>${usd(d.hotel_avg_usd)}</strong></div><div><span>Base</span><strong>${mxn(d.base_access_mxn)}</strong></div><div><span>Moneda</span><strong>${Number(d.local_per_mxn).toLocaleString('es-MX',{maximumFractionDigits:2})} ${esc(d.currency)}</strong></div></div></div><div class="rank-score"><span>Índice ASC</span><strong>${Number(d.asc_score).toFixed(1)}</strong><div class="score-line"><i style="width:${Math.max(0,Math.min(100,Number(d.asc_score)))}%"></i></div></div></article>`).join('');
}

function renderWeekly(data){
  const a=data.weekly_destination,x=data.exchange_rates,l=data.logistics,t=data.profiles.tourist,b=data.profiles.business;
  document.getElementById('weeklyTitle').textContent=`${a.city}, ${a.country}`;
  document.getElementById('weeklyDek').textContent=a.why_now;
  document.getElementById('weeklyContent').innerHTML=`<div class="weekly-layout"><article class="weekly-story"><span class="eyebrow">POR QUÉ AHORA</span><h3>${esc(a.season_label)}</h3><p>${esc(a.why_now)}</p><h3>Logística desde México</h3><p><strong>${esc(l.route)}</strong><br>${esc(l.estimated_total_time)} · ${esc(l.stops)}</p><p>${esc(l.notes)}</p></article><aside class="weekly-aside"><div class="kpi-grid"><div class="kpi"><span>Accesibilidad</span><strong>${esc(a.accessibility_level)}</strong></div><div class="kpi"><span>Noches</span><strong>${a.recommended_nights}</strong></div><div class="kpi"><span>MXN / moneda local</span><strong>${Number(x.mxn_to_local).toLocaleString('es-MX',{maximumFractionDigits:2})}</strong></div><div class="kpi"><span>USD / moneda local</span><strong>${Number(x.usd_to_local).toLocaleString('es-MX',{maximumFractionDigits:2})}</strong></div><div class="kpi"><span>Total Turista</span><strong>${mxn(t.total_mxn)}</strong></div><div class="kpi"><span>Total Business</span><strong>${mxn(b.total_mxn)}</strong></div></div></aside></div>`;
}

function budgetRows(p){return [['flight','Vuelo'],['hotel','Hotel'],['food','Comidas'],['transport','Transporte'],['experiences','Experiencias'],['contingency','Contingencia']].map(([k,l])=>`<div class="budget-row"><span>${l}</span><strong>${mxn(p[k]?.total_mxn)}</strong></div>`).join('')}
function renderBudgets(data){
  const t=data.profiles.tourist,b=data.profiles.business;
  document.getElementById('budgetContent').innerHTML=`<div class="budget-grid"><article class="budget-card"><span class="eyebrow">TURISTA</span><h3>${esc(t.label)}</h3><p>${esc(t.assumption)}</p>${budgetRows(t)}<div class="budget-row total"><span>Total sugerido</span><strong>${mxn(t.total_mxn)}</strong></div><p>${esc(t.recommendation)}</p></article><article class="budget-card"><span class="eyebrow">BUSINESS</span><h3>${esc(b.label)}</h3><p>${esc(b.assumption)}</p>${budgetRows(b)}<div class="budget-row total"><span>Total sugerido</span><strong>${mxn(b.total_mxn)}</strong></div><p>${esc(b.recommendation)}</p></article></div>`;
}

function renderMethod(data){
  const w=data.opportunity_rankings.methodology.weights;
  const items=[['Calidad global',w.global_quality_importance_pct,'Importancia mundial, historia, experiencia y atractivo real.'],['Oportunidad FX',w.fx_dollar_opportunity_pct,'Poder de compra del MXN y USD frente a la moneda local.'],['Valor hotelero',w.hotel_value_pct,'Costo comparable del alojamiento Turista.'],['Tarifa aérea',w.airfare_value_pct,'Precio redondo desde MEX y eficiencia de la ruta.'],['Conectividad',w.connectivity_from_mexico_pct,'Vuelos directos, escalas y duración total.']];
  document.getElementById('methodContent').innerHTML=`<div class="method-grid">${items.map(([n,p,d])=>`<article class="method-card"><strong>${p}%</strong><h3>${n}</h3><p>${d}</p></article>`).join('')}</div><article class="method-note"><h3>${esc(data.opportunity_rankings.methodology.name)}</h3><p>${esc(data.opportunity_rankings.methodology.note)}</p><p><strong>Umbrales:</strong> FX favorable desde +0.5% para MXN; vuelos desde -8%; hoteles desde -10% o beneficio material equivalente.</p></article>`;
}

function render(data){
  dataCache=data;
  const date=new Intl.DateTimeFormat('es-MX',{dateStyle:'long',timeStyle:'short',timeZone:'America/Mexico_City'}).format(new Date(data.meta.last_updated));
  document.getElementById('editionStatus').textContent=`Actualizado ${date}`;
  renderHero(data);renderTopCards(data);renderWeeklyPreview(data);renderRanking(data);renderWeekly(data);renderBudgets(data);renderMethod(data);
}

async function load(force=false){
  try{
    document.getElementById('editionStatus').textContent='Actualizando…';
    const r=await fetch(DATA_URL+(force?`?t=${Date.now()}`:''),{cache:'no-store'});
    if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const d=await r.json();
    if(!Array.isArray(d.opportunity_rankings?.destinations)||d.opportunity_rankings.destinations.length!==10)throw new Error('Top 10 incompleto');
    render(d);
  }catch(err){console.error(err);document.getElementById('editionStatus').textContent='Datos no disponibles';}
}

async function openPdf(){
  const button=document.getElementById('pdfButton'),label=button.textContent;
  button.disabled=true;button.textContent='Preparando…';
  try{
    const r=await fetch(PDF_URL+`?t=${Date.now()}`,{cache:'no-store'});if(!r.ok)throw new Error(`HTTP ${r.status}`);
    const binary=atob((await r.text()).trim()),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    const url=URL.createObjectURL(new Blob([bytes],{type:'application/pdf'}));window.open(url,'_blank','noopener');setTimeout(()=>URL.revokeObjectURL(url),120000);
  }catch(err){console.error(err);alert('El PDF no está disponible temporalmente.');}
  finally{button.disabled=false;button.textContent=label;}
}

load(true);setInterval(()=>document.visibilityState==='visible'&&load(true),REFRESH_MS);window.addEventListener('online',()=>load(true));document.addEventListener('visibilitychange',()=>document.visibilityState==='visible'&&load(true));
