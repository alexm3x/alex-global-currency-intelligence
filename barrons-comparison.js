(() => {
  const BARRONS_ITEMS = {
    currencies: [
      {asset:'JPY', agci:'Compra fuerte', barrons:'Cautela / presión bajista', alignment:'Divergencia', date:'31 jul 2026', note:'Barron’s destacó intervención, debilidad estructural del yen y volatilidad en bonos.', url:'https://www.barrons.com/articles/bonds-treasury-yields-japan-yen-97bb1997'},
      {asset:'USD', agci:'Neutral', barrons:'Fortaleza táctica', alignment:'Parcial', date:'3 mar 2026', note:'Barron’s resaltó el papel del dólar como refugio y su ventaja relativa ante shocks energéticos.', url:'https://www.barrons.com/articles/dollar-euro-yen-iran-ff6f881b'},
      {asset:'EUR', agci:'Neutral', barrons:'Cautela', alignment:'Coincidencia', date:'11 jun 2026', note:'Cobertura de Barron’s señaló presión posterior a la decisión del BCE y menor claridad sobre tasas.', url:'https://www.barrons.com/livecoverage/stock-market-news-today-061126/card/euro-falls-after-ecb-decision-womFxoKgwKGnlCR3bgba'}
    ],
    equities: [
      {asset:'LHX', agci:'No incluida', barrons:'Oportunidad destacada', alignment:'Solo Barron’s', date:'2 ago 2026', note:'Barron’s identificó a L3Harris como una de las oportunidades más atractivas del sector defensa.', url:'https://www.barrons.com/articles/l3harris-technologies-defense-stock-buy-73a1d0ad'},
      {asset:'PANW', agci:'No incluida', barrons:'Mención favorable', alignment:'Solo Barron’s', date:'31 jul 2026', note:'Barron’s la mencionó entre posiciones relevantes dentro de exposición a ciberseguridad.', url:'https://www.barrons.com/articles/dividend-value-etf-buy-2e49d9cf'},
      {asset:'JPM', agci:'Alta convicción', barrons:'Exposición favorable vía dividendos', alignment:'Coincidencia parcial', date:'31 jul 2026', note:'JPMorgan aparece entre las posiciones relevantes de una estrategia de dividendos destacada por Barron’s.', url:'https://www.barrons.com/articles/dividend-value-etf-buy-2e49d9cf'}
    ],
    etfs: [
      {asset:'DIVB', agci:'Recomendada', barrons:'Destacada', alignment:'Coincidencia', date:'31 jul 2026', note:'Exposición a dividendos, flujo de caja y sectores defensivos.', url:'https://www.barrons.com/articles/dividend-value-etf-buy-2e49d9cf'},
      {asset:'COWZ', agci:'Recomendada', barrons:'Destacada', alignment:'Coincidencia', date:'31 jul 2026', note:'Sesgo hacia compañías con generación robusta de flujo de caja libre.', url:'https://www.barrons.com/articles/dividend-value-etf-buy-2e49d9cf'},
      {asset:'BUG', agci:'Recomendada', barrons:'Destacada', alignment:'Coincidencia', date:'31 jul 2026', note:'Exposición temática a ciberseguridad con valoración todavía exigente.', url:'https://www.barrons.com/articles/dividend-value-etf-buy-2e49d9cf'}
    ]
  };

  const esc = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function rows(items){return items.map(x=>`<tr><td><strong>${esc(x.asset)}</strong></td><td>${esc(x.agci)}</td><td>${esc(x.barrons)}</td><td><span class="alignment-tag">${esc(x.alignment)}</span></td><td>${esc(x.date)}</td><td>${esc(x.note)}</td><td><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">Fuente ↗</a></td></tr>`).join('');}
  function activateTab(button){
    const key=button.dataset.compareTab;
    document.querySelectorAll('[data-compare-tab]').forEach(tab=>{
      const selected=tab===button;
      tab.setAttribute('aria-selected',String(selected));
      tab.tabIndex=selected?0:-1;
    });
    document.querySelectorAll('[data-compare-panel]').forEach(panel=>panel.classList.toggle('active',panel.dataset.comparePanel===key));
    document.getElementById(`comparison-panel-${key}`)?.focus({preventScroll:true});
  }
  function build(){
    const nav=document.querySelector('.main-nav');
    const main=document.querySelector('main');
    if(!nav||!main||document.getElementById('comparison'))return;
    nav.insertAdjacentHTML('beforeend','<button data-view="comparison">AGCI vs Barron’s</button>');
    main.insertAdjacentHTML('beforeend',`<section id="comparison" class="view comparison-view"><div class="page-head"><p class="rubric">EDITORIAL CROSS-CHECK</p><h2>AGCI vs Barron’s</h2><p>Comparativo de señales propias frente a cobertura y oportunidades publicadas por Barron’s.</p></div><div class="comparison-note"><strong>Criterio de lectura</strong><p>AGCI utiliza sus propios scores. Barron’s se presenta únicamente como referencia editorial externa basada en artículos públicos o accesibles mediante suscripción. Una mención no equivale necesariamente a una recomendación formal.</p></div><div class="comparison-tabs" role="tablist" aria-label="Categorías del comparativo"><button id="comparison-tab-currencies" role="tab" aria-controls="comparison-panel-currencies" aria-selected="true" tabindex="0" data-compare-tab="currencies">Divisas</button><button id="comparison-tab-equities" role="tab" aria-controls="comparison-panel-equities" aria-selected="false" tabindex="-1" data-compare-tab="equities">Acciones</button><button id="comparison-tab-etfs" role="tab" aria-controls="comparison-panel-etfs" aria-selected="false" tabindex="-1" data-compare-tab="etfs">ETFs</button></div>${Object.entries(BARRONS_ITEMS).map(([key,items],i)=>`<div id="comparison-panel-${key}" role="tabpanel" aria-labelledby="comparison-tab-${key}" tabindex="-1" class="comparison-panel${i===0?' active':''}" data-compare-panel="${key}"><div class="comparison-table-wrap"><table><thead><tr><th>Activo</th><th>AGCI</th><th>Barron’s</th><th>Lectura</th><th>Fecha</th><th>Diagnóstico</th><th>Artículo</th></tr></thead><tbody>${rows(items)}</tbody></table></div></div>`).join('')}<p class="comparison-disclaimer">Barron’s y sus marcas pertenecen a sus respectivos propietarios. AGCI no está afiliada con Barron’s. Este módulo resume referencias editoriales y enlaza a la fuente original; no reproduce artículos ni contenido de pago.</p></section>`);
    document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>typeof setView==='function'&&setView(b.dataset.view)));
    const tabs=[...document.querySelectorAll('[data-compare-tab]')];
    tabs.forEach((button,index)=>{
      button.addEventListener('click',()=>activateTab(button));
      button.addEventListener('keydown',event=>{
        if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
        event.preventDefault();
        let next=index;
        if(event.key==='ArrowRight')next=(index+1)%tabs.length;
        if(event.key==='ArrowLeft')next=(index-1+tabs.length)%tabs.length;
        if(event.key==='Home')next=0;
        if(event.key==='End')next=tabs.length-1;
        tabs[next].focus();
        activateTab(tabs[next]);
      });
    });
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build);else build();
})();