(() => {
  'use strict';
  const DATA_URL = 'data/daily-briefing-latest.json';
  const FALLBACK = {
    date:null, title:'Daily Strategic Briefing temporalmente no disponible',
    dek:'La fuente editorial no está disponible en este momento. No se muestran fecha ni datos anteriores como si fueran actuales.',
    stance:'—', risk:'—', horizon:'—', briefs:[], decisions:[], sections:[], watch:[]
  };
  let REPORT = FALLBACK;
  const esc = (v='') => String(v).replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  function fechaLarga(iso){
    if(!iso) return 'Fecha no disponible';
    try { const [y,m,d]=iso.split('-').map(Number); return new Intl.DateTimeFormat('es-MX',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(Date.UTC(y,m-1,d))); }
    catch { return 'Fecha no disponible'; }
  }
  async function loadReport(){
    try{
      const r=await fetch(`${DATA_URL}?v=${Date.now()}`,{cache:'no-store'});
      if(!r.ok) throw new Error(`HTTP ${r.status}`);
      const data=await r.json();
      if(data.schemaVersion!==2||!data.date||!data.title||!Array.isArray(data.sections)) throw new Error('Contrato editorial inválido');
      REPORT=data;
    }catch(err){
      console.warn('AGCI Daily Briefing fallback:',err);
      REPORT={...FALLBACK,isStale:true};
    }
  }
  function injectStylesheet(){
    if(document.querySelector('link[href^="daily-briefing-cover.css"]')) return;
    const link=document.createElement('link');link.rel='stylesheet';link.href='daily-briefing-cover.css';document.head.appendChild(link);
  }
  function buildFront(){
    const home=document.getElementById('home');
    if(!home) return;
    document.getElementById('dailyStrategicFront')?.remove();
    const front=document.createElement('section');
    front.id='dailyStrategicFront';front.className='strategic-front';
    const stale=REPORT.isStale?'<span class="briefing-note">Fuente editorial no disponible</span>':'';
    front.innerHTML=`
      <div class="strategic-front__label"><strong>DAILY STRATEGIC BRIEFING</strong><span>${esc(fechaLarga(REPORT.date))} · Ciudad de México · Lectura ejecutiva</span>${stale}</div>
      <div class="strategic-front__grid">
        <article class="strategic-front__lead">
          <p class="rubric">VISIÓN EJECUTIVA</p>
          <h2>${esc(REPORT.title)}</h2>
          <p class="strategic-front__dek">${esc(REPORT.dek||REPORT.executiveSummary||'')}</p>
          <div class="strategic-front__actions"><button data-jump="briefing">Leer informe completo</button><button class="secondary" data-jump="equityIntelligence">Ver oportunidades</button></div>
          <div class="strategic-front__briefs">${(REPORT.briefs||[]).map(x=>`<article class="strategic-brief"><span>${esc(x.kicker)}</span><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></article>`).join('')}</div>
        </article>
        <aside class="decision-rail">
          <h3>Panel de decisiones</h3>
          <div class="decision-meter"><div><small>Postura</small><strong>${esc(REPORT.stance||'—')}</strong></div><div><small>Riesgo</small><strong>${esc(REPORT.risk||'—')}</strong></div><div><small>Horizonte</small><strong>${esc(REPORT.horizon||'—')}</strong></div></div>
          ${(REPORT.decisions||[]).map(x=>`<article class="decision-item"><span>${esc(x.label)}</span><b>${esc(x.title)}</b><p>${esc(x.text)}</p></article>`).join('')}
        </aside>
      </div>`;
    const label=home.querySelector('.section-label');
    if(label) label.insertAdjacentElement('afterend',front); else home.prepend(front);
    front.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>{if(typeof setView==='function')setView(btn.dataset.jump)}));
  }
  function buildFullBriefing(){
    const section=document.getElementById('briefing');if(!section)return;
    section.innerHTML=`<article class="briefing-full">
      <header class="briefing-full__header"><p class="rubric">DAILY STRATEGIC BRIEFING · ${esc(fechaLarga(REPORT.date))}</p><h2>${esc(REPORT.title)}</h2><p class="standfirst">${esc(REPORT.dek||REPORT.executiveSummary||'')}</p></header>
      <div class="briefing-full__body"><div>${(REPORT.sections||[]).map(s=>`<section class="briefing-section"><h3>${esc(s.title)}</h3><p>${esc(s.body)}</p><h4>Por qué importa</h4><p>${esc(s.why)}</p><h4>Implicación de inversión</h4><p>${esc(s.implication)}</p><h4>Oportunidad</h4><p>${esc(s.opportunity)}</p><h4>Riesgo principal</h4><p>${esc(s.risk)}</p><h4>Próximas señales</h4><p>${esc(s.signal)}</p></section>`).join('')}</div>
      <aside class="briefing-watch"><h3>Acciones y Lista de Vigilancia</h3>${(REPORT.decisions||[]).map(x=>`<article class="decision-item"><span>${esc(x.label)}</span><b>${esc(x.title)}</b><p>${esc(x.text)}</p></article>`).join('')}<h3>Señales inmediatas</h3><ol>${(REPORT.watch||[]).map(x=>`<li>${esc(x)}</li>`).join('')}</ol><p class="briefing-note">Informe estratégico para apoyar decisiones. No sustituye análisis financiero, fiscal, legal o de inversión específico.</p></aside></div>
    </article>`;
  }
  function loadExecutiveCenter(){
    if(!document.querySelector('link[href^="executive-intelligence.css"]')){const link=document.createElement('link');link.rel='stylesheet';link.href='executive-intelligence.css';document.head.appendChild(link)}
    if(!document.querySelector('script[src^="executive-intelligence.js"]')){const script=document.createElement('script');script.src='executive-intelligence.js';script.defer=true;document.body.appendChild(script)}
  }
  document.addEventListener('DOMContentLoaded',async()=>{injectStylesheet();await loadReport();buildFront();buildFullBriefing();loadExecutiveCenter();document.dispatchEvent(new CustomEvent('agci:daily-briefing-ready',{detail:{date:REPORT.date,isStale:Boolean(REPORT.isStale)}}));});
})();