(() => {
  const EQUITY_OPPORTUNITIES = [
    {sector:'Tecnología', ticker:'MSFT', company:'Microsoft', score:91, conviction:'Alta', horizon:'12–24 meses', thesis:'Plataforma empresarial, nube e inteligencia artificial con ingresos recurrentes.'},
    {sector:'Tecnología', ticker:'GOOGL', company:'Alphabet', score:89, conviction:'Alta', horizon:'12–24 meses', thesis:'Generación de caja, liderazgo digital y capacidad de monetización en IA.'},
    {sector:'Tecnología', ticker:'AVGO', company:'Broadcom', score:86, conviction:'Media-Alta', horizon:'12–24 meses', thesis:'Infraestructura crítica para centros de datos y software empresarial.'},
    {sector:'Salud', ticker:'LLY', company:'Eli Lilly', score:88, conviction:'Alta', horizon:'18–36 meses', thesis:'Cartera innovadora y exposición a mercados terapéuticos estructurales.'},
    {sector:'Salud', ticker:'UNH', company:'UnitedHealth Group', score:84, conviction:'Media-Alta', horizon:'12–24 meses', thesis:'Escala, diversificación operativa y capacidad histórica de generación de efectivo.'},
    {sector:'Salud', ticker:'ISRG', company:'Intuitive Surgical', score:82, conviction:'Media-Alta', horizon:'18–36 meses', thesis:'Base instalada, ingresos recurrentes y liderazgo en cirugía asistida.'},
    {sector:'Financiero', ticker:'JPM', company:'JPMorgan Chase', score:90, conviction:'Alta', horizon:'12–24 meses', thesis:'Balance sólido, escala y diversificación de ingresos.'},
    {sector:'Financiero', ticker:'GS', company:'Goldman Sachs', score:83, conviction:'Media-Alta', horizon:'12–24 meses', thesis:'Apalancamiento operativo a mercados de capitales y gestión de activos.'},
    {sector:'Financiero', ticker:'V', company:'Visa', score:87, conviction:'Alta', horizon:'18–36 meses', thesis:'Red global, márgenes elevados y crecimiento secular de pagos digitales.'},
    {sector:'Industrial', ticker:'GE', company:'GE Aerospace', score:87, conviction:'Alta', horizon:'12–24 meses', thesis:'Cartera de motores, servicios de largo plazo y demanda aeroespacial.'},
    {sector:'Industrial', ticker:'CAT', company:'Caterpillar', score:82, conviction:'Media-Alta', horizon:'12–24 meses', thesis:'Exposición a infraestructura, minería y disciplina de capital.'},
    {sector:'Industrial', ticker:'ETN', company:'Eaton', score:85, conviction:'Media-Alta', horizon:'18–36 meses', thesis:'Electrificación, centros de datos y modernización de redes.'},
    {sector:'Consumo', ticker:'AMZN', company:'Amazon', score:89, conviction:'Alta', horizon:'12–24 meses', thesis:'Nube, publicidad y mejora estructural de eficiencia operativa.'},
    {sector:'Consumo', ticker:'COST', company:'Costco', score:84, conviction:'Media-Alta', horizon:'18–36 meses', thesis:'Modelo de membresía, fidelidad y resiliencia de ventas.'},
    {sector:'Consumo', ticker:'HD', company:'Home Depot', score:80, conviction:'Media', horizon:'12–24 meses', thesis:'Escala, exposición a reparación residencial y recuperación cíclica potencial.'}
  ];

  const escapeHtml = value => String(value).replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));

  function topCurrencies() {
    if (!Array.isArray(window.DATA) && typeof DATA === 'undefined') return [];
    const source = typeof DATA !== 'undefined' ? DATA : window.DATA;
    return [...source]
      .filter(item => item && Number.isFinite(Number(item.score)) && !['Evitar','Reducir'].includes(item.signal))
      .sort((a,b) => Number(b.score) - Number(a.score))
      .slice(0,5);
  }

  function renderFxCard(item, index) {
    const change = Number(item.change || 0);
    return `<button class="opportunity-card fx-card" data-currency="${escapeHtml(item.country)}" aria-label="Abrir análisis de ${escapeHtml(item.code)}">
      <span class="opportunity-rank">${String(index + 1).padStart(2,'0')}</span>
      <span class="opportunity-code">${escapeHtml(item.code)}</span>
      <strong>${escapeHtml(item.currency)}</strong>
      <small>${escapeHtml(item.country)}</small>
      <div class="opportunity-metrics"><span>AGCI <b>${escapeHtml(item.score)}</b></span><span class="${change >= 0 ? 'positive' : 'negative'}">Δ ${change > 0 ? '+' : ''}${change.toFixed(1)}</span></div>
      <i>${escapeHtml(item.signal)}</i>
    </button>`;
  }

  function renderEquityCard(item) {
    return `<article class="equity-opportunity-card">
      <div><span class="equity-ticker">${escapeHtml(item.ticker)}</span><span class="equity-score">${escapeHtml(item.score)}</span></div>
      <h4>${escapeHtml(item.company)}</h4>
      <p>${escapeHtml(item.thesis)}</p>
      <footer><span>${escapeHtml(item.conviction)}</span><span>${escapeHtml(item.horizon)}</span></footer>
    </article>`;
  }

  function buildDashboard() {
    const home = document.getElementById('home');
    if (!home || document.getElementById('investmentOpportunities')) return;
    const currencies = topCurrencies();
    const sectors = [...new Set(EQUITY_OPPORTUNITIES.map(item => item.sector))];
    const section = document.createElement('section');
    section.id = 'investmentOpportunities';
    section.className = 'investment-opportunities';
    section.setAttribute('aria-labelledby','opportunitiesTitle');
    section.innerHTML = `
      <header class="opportunities-header">
        <div><p class="rubric">PRIORIDAD DE INVERSIÓN</p><h2 id="opportunitiesTitle">Oportunidades de compra</h2><p>Radar ejecutivo: cinco divisas y quince acciones estadounidenses, organizadas por sector.</p></div>
        <div class="opportunities-meta"><strong>20</strong><span>ideas monitoreadas</span><small>Corte editorial: 2 ago 2026</small></div>
      </header>
      <div class="opportunities-summary" aria-label="Resumen de oportunidades">
        <div><span>Divisa líder</span><strong>${currencies[0] ? escapeHtml(currencies[0].code) : '—'}</strong></div>
        <div><span>Acción líder</span><strong>MSFT</strong></div>
        <div><span>Sector destacado</span><strong>Tecnología</strong></div>
        <div><span>Horizonte</span><strong>12–24 meses</strong></div>
      </div>
      <section class="fx-opportunities" aria-labelledby="fxTitle">
        <div class="opportunity-subhead"><div><span>01</span><h3 id="fxTitle">Top 5 divisas</h3></div><button type="button" data-jump="markets">Ver ranking completo →</button></div>
        <div class="fx-opportunity-grid">${currencies.map(renderFxCard).join('')}</div>
      </section>
      <section class="equity-opportunities" aria-labelledby="equityTitle">
        <div class="opportunity-subhead"><div><span>02</span><h3 id="equityTitle">15 acciones de Estados Unidos</h3></div><p>3 oportunidades por cada uno de los 5 sectores principales seleccionados.</p></div>
        <div class="sector-tabs" role="tablist" aria-label="Sectores de acciones">${sectors.map((sector,index)=>`<button type="button" role="tab" aria-selected="${index===0}" data-sector-tab="${escapeHtml(sector)}">${escapeHtml(sector)}</button>`).join('')}</div>
        <div class="sector-panels">${sectors.map((sector,index)=>`<section class="sector-panel${index===0?' active':''}" data-sector-panel="${escapeHtml(sector)}"><header><h3>${escapeHtml(sector)}</h3><span>3 oportunidades</span></header><div class="equity-card-grid">${EQUITY_OPPORTUNITIES.filter(item=>item.sector===sector).map(renderEquityCard).join('')}</div></section>`).join('')}</div>
      </section>
      <p class="opportunities-disclaimer">Las acciones constituyen una lista editorial de investigación y no cotizaciones ni recomendaciones personalizadas. Los scores de divisas conservan la metodología AGCI vigente; el screening accionario es provisional y deberá validarse con información financiera y precios actualizados antes de invertir.</p>`;
    const label = home.querySelector('.section-label');
    if (label) label.insertAdjacentElement('afterend', section); else home.prepend(section);

    section.querySelectorAll('[data-jump]').forEach(button => button.addEventListener('click', () => typeof setView === 'function' && setView(button.dataset.jump)));
    section.querySelectorAll('[data-sector-tab]').forEach(button => button.addEventListener('click', () => {
      const sector = button.dataset.sectorTab;
      section.querySelectorAll('[data-sector-tab]').forEach(tab => tab.setAttribute('aria-selected', String(tab === button)));
      section.querySelectorAll('[data-sector-panel]').forEach(panel => panel.classList.toggle('active', panel.dataset.sectorPanel === sector));
    }));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', buildDashboard);
  else buildDashboard();
})();