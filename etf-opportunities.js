(() => {
  const ETF_OPPORTUNITIES=[
    {ticker:'DIVB',name:'iShares Core Dividend ETF',theme:'Dividendos y calidad',conviction:'Alta',horizon:'12–24 meses',thesis:'Empresas con dividendos, ingresos estables y generación de efectivo diversificada.',barrons:true},
    {ticker:'COWZ',name:'Pacer U.S. Cash Cows 100 ETF',theme:'Flujo de caja libre',conviction:'Alta',horizon:'12–24 meses',thesis:'Selección sistemática de compañías estadounidenses con elevado rendimiento de flujo de caja.',barrons:true},
    {ticker:'VLUE',name:'iShares MSCI USA Value Factor ETF',theme:'Valor estadounidense',conviction:'Media-Alta',horizon:'12–24 meses',thesis:'Exposición diversificada a compañías de gran capitalización con métricas relativas de valor.',barrons:true},
    {ticker:'BUG',name:'Global X Cybersecurity ETF',theme:'Ciberseguridad',conviction:'Media-Alta',horizon:'18–36 meses',thesis:'Demanda estructural de seguridad digital, con mayor sensibilidad a valoración y volatilidad.',barrons:true},
    {ticker:'IHF',name:'iShares U.S. Healthcare Providers ETF',theme:'Salud defensiva',conviction:'Media-Alta',horizon:'12–24 meses',thesis:'Exposición a proveedores de salud con demanda relativamente estable y diversificación sectorial.',barrons:true}
  ];
  const esc=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function build(){
    const parent=document.getElementById('investmentOpportunities');
    if(!parent||document.getElementById('etfOpportunities'))return;
    const disclaimer=parent.querySelector('.opportunities-disclaimer');
    const section=document.createElement('section');section.id='etfOpportunities';section.className='etf-opportunities';section.innerHTML=`<div class="opportunity-subhead"><div><span>03</span><h3>5 ETFs recomendados</h3></div><button type="button" data-view="comparison">Comparar con Barron’s →</button></div><div class="etf-card-grid">${ETF_OPPORTUNITIES.map(x=>`<article class="etf-card"><header><span>${esc(x.ticker)}</span><i>${esc(x.theme)}</i></header><h4>${esc(x.name)}</h4><p>${esc(x.thesis)}</p><footer><span>${esc(x.conviction)}</span><span>${esc(x.horizon)}</span></footer>${x.barrons?'<small>Coincidencia editorial reciente con Barron’s</small>':''}</article>`).join('')}</div>`;
    if(disclaimer)parent.insertBefore(section,disclaimer);else parent.appendChild(section);
    const meta=parent.querySelector('.opportunities-meta strong');if(meta)meta.textContent='25';
    const metaLabel=parent.querySelector('.opportunities-meta span');if(metaLabel)metaLabel.textContent='ideas monitoreadas';
    section.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>typeof setView==='function'&&setView(b.dataset.view)));
  }
  function loadAlertCenter(){
    if(!document.querySelector('link[data-agci-alerts]')){
      const css=document.createElement('link');css.rel='stylesheet';css.href='alerts-center.css';css.dataset.agciAlerts='true';document.head.appendChild(css);
    }
    if(!document.querySelector('script[data-agci-alerts]')){
      const script=document.createElement('script');script.src='alerts-center.js';script.defer=true;script.dataset.agciAlerts='true';document.body.appendChild(script);
    }
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',()=>{build();loadAlertCenter()},{once:true});else{build();loadAlertCenter()}
})();