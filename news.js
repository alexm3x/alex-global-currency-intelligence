(() => {
  const GDELT = 'https://api.gdeltproject.org/api/v2/doc/doc';
  const QUERIES = [
    'domain:federalreserve.gov ("monetary policy" OR inflation OR rates OR dollar)',
    'domain:ecb.europa.eu ("monetary policy" OR inflation OR rates OR euro)',
    'domain:banxico.org.mx (inflacion OR tasa OR peso OR politica monetaria)',
    '(central bank OR inflation OR interest rates OR currency OR fiscal policy) (dollar OR euro OR yen OR yuan OR peso OR real)'
  ];

  const currencyRules = [
    ['USD', /\b(dollar|usd|federal reserve|fed|united states|u\.s\.)\b/i],
    ['EUR', /\b(euro|eur|ecb|european central bank|eurozone)\b/i],
    ['JPY', /\b(yen|jpy|bank of japan|japan)\b/i],
    ['CNY', /\b(yuan|renminbi|cny|pboc|china)\b/i],
    ['MXN', /\b(peso mexicano|mexican peso|mxn|banxico|mexico)\b/i],
    ['BRL', /\b(real brasileño|brazilian real|brl|brazil|banco central do brasil)\b/i],
    ['GBP', /\b(pound sterling|british pound|gbp|bank of england|united kingdom|uk)\b/i],
    ['CAD', /\b(canadian dollar|cad|bank of canada|canada)\b/i],
    ['AUD', /\b(australian dollar|aud|reserve bank of australia|australia)\b/i],
    ['KRW', /\b(won|krw|bank of korea|south korea)\b/i],
    ['INR', /\b(rupee|inr|reserve bank of india|india)\b/i],
    ['CHF', /\b(swiss franc|chf|swiss national bank|switzerland)\b/i]
  ];

  const categories = [
    ['Bancos centrales', /central bank|monetary policy|federal reserve|\bfed\b|ecb|banxico|bank of japan|rate decision|interest rate/i],
    ['Inflación', /inflation|inflacion|consumer prices|cpi|pce/i],
    ['Crecimiento', /gdp|growth|recession|employment|jobs|industrial production/i],
    ['Política fiscal', /fiscal|budget|deficit|debt|tariff|trade policy/i],
    ['Riesgo', /geopolit|war|sanction|crisis|downgrade|volatility/i]
  ];

  const positiveWords = /rate hike|hawkish|strong growth|inflation falls|surplus|upgrade|reserves rise|currency support/i;
  const negativeWords = /rate cut|dovish|recession|deficit|downgrade|sanction|crisis|intervention|capital controls|inflation rises/i;

  const style = document.createElement('style');
  style.textContent = `
    .news-toolbar{display:flex;gap:10px;flex-wrap:wrap;margin:22px 0}.news-toolbar select,.news-toolbar button{padding:10px 12px;border:1px solid var(--line);background:var(--paper);color:var(--ink)}
    .news-status{font-size:12px;color:var(--muted);margin-bottom:16px}.news-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:18px}.news-card{border-top:4px solid var(--ink);background:var(--paper);padding:18px;box-shadow:0 8px 24px rgba(0,0,0,.06)}
    .news-card.official{border-top-color:#8b1e2d}.news-meta{display:flex;justify-content:space-between;gap:10px;font-size:11px;color:var(--muted);text-transform:uppercase}.news-card h3{font-family:'Source Serif 4',serif;font-size:22px;line-height:1.1;margin:12px 0}.news-card p{color:var(--muted);font-size:14px}.news-tags{display:flex;gap:7px;flex-wrap:wrap;margin:14px 0}.news-tag{font-size:10px;padding:5px 7px;border:1px solid var(--line)}
    .impact-positive{color:#16734b}.impact-negative{color:#a72b2b}.impact-neutral{color:var(--muted)}.news-card a{font-weight:700;text-decoration:none;color:var(--ink)}.news-method{margin-top:26px;padding:18px;border:1px solid var(--line);background:var(--soft)}
    @media(max-width:900px){.news-grid{grid-template-columns:1fr 1fr}}@media(max-width:620px){.news-grid{grid-template-columns:1fr}}
  `;
  document.head.appendChild(style);

  const nav = document.querySelector('.main-nav');
  if (nav && !nav.querySelector('[data-view="news"]')) {
    const btn = document.createElement('button');
    btn.dataset.view = 'news'; btn.textContent = 'Noticias';
    nav.insertBefore(btn, nav.querySelector('[data-view="briefing"]'));
    btn.addEventListener('click', () => setView('news'));
  }

  const section = document.createElement('section');
  section.id = 'news'; section.className = 'view';
  section.innerHTML = `
    <div class="page-head"><p class="rubric">FINANCIAL NEWS INTELLIGENCE</p><h2>Noticias e impacto cambiario</h2><p>Titulares recientes clasificados por moneda, tema y relevancia potencial.</p></div>
    <div class="opportunity-disclaimer"><strong>Impacto indicativo.</strong> Los titulares no modifican automáticamente el AGCI Score. Deben traducirse a variables económicas verificables.</div>
    <div class="news-toolbar"><select id="newsCurrency"><option value="">Todas las monedas</option></select><select id="newsCategory"><option value="">Todas las categorías</option></select><button id="newsRefresh">Actualizar noticias</button></div>
    <div class="news-status" id="newsStatus">Cargando noticias financieras…</div><div class="news-grid" id="newsGrid"></div>
    <article class="news-method"><p class="rubric">EDITORIAL METHOD</p><h3>Cómo interpretamos una noticia</h3><p>La relevancia aumenta cuando el titular se relaciona con tasas, inflación, crecimiento, política fiscal, intervención cambiaria o riesgo. El sesgo positivo o negativo es una lectura preliminar y nunca sustituye el análisis de datos.</p></article>`;
  document.querySelector('main').appendChild(section);

  const currencySelect = section.querySelector('#newsCurrency');
  [...new Set(currencyRules.map(x => x[0]))].forEach(code => currencySelect.insertAdjacentHTML('beforeend', `<option>${code}</option>`));
  const categorySelect = section.querySelector('#newsCategory');
  categories.forEach(([name]) => categorySelect.insertAdjacentHTML('beforeend', `<option>${name}</option>`));

  let articles = [];
  const officialDomains = /federalreserve\.gov|ecb\.europa\.eu|banxico\.org\.mx/i;

  function classify(article) {
    const text = `${article.title || ''} ${article.seendate || ''}`;
    const currency = (currencyRules.find(([,r]) => r.test(text)) || ['Global'])[0];
    const category = (categories.find(([,r]) => r.test(text)) || ['Mercados'])[0];
    let impact = 'Neutral';
    if (positiveWords.test(text)) impact = 'Positivo';
    if (negativeWords.test(text)) impact = 'Negativo';
    const relevance = /monetary policy|interest rate|inflation|inflacion|central bank|fiscal|currency|exchange rate|rate decision/i.test(text) ? 'Alta' : 'Media';
    return {...article, currency, category, impact, relevance, official: officialDomains.test(article.domain || '')};
  }

  function render() {
    const c = currencySelect.value, cat = categorySelect.value;
    const filtered = articles.filter(a => (!c || a.currency === c) && (!cat || a.category === cat)).slice(0, 18);
    section.querySelector('#newsGrid').innerHTML = filtered.length ? filtered.map(a => {
      const cls = a.impact === 'Positivo' ? 'impact-positive' : a.impact === 'Negativo' ? 'impact-negative' : 'impact-neutral';
      const date = a.seendate ? new Date(a.seendate.replace(' ', 'T')).toLocaleString('es-MX',{dateStyle:'medium',timeStyle:'short'}) : 'Fecha no disponible';
      return `<article class="news-card ${a.official ? 'official' : ''}"><div class="news-meta"><span>${a.domain || 'Fuente'}</span><span>${date}</span></div><h3>${escapeHtml(a.title || 'Sin título')}</h3><div class="news-tags"><span class="news-tag">${a.currency}</span><span class="news-tag">${a.category}</span><span class="news-tag">Relevancia ${a.relevance}</span><span class="news-tag ${cls}">Impacto ${a.impact}</span>${a.official ? '<span class="news-tag">Fuente oficial</span>' : ''}</div><a href="${a.url}" target="_blank" rel="noopener noreferrer">Leer fuente original →</a></article>`;
    }).join('') : '<p>No hay noticias que coincidan con los filtros.</p>';
  }

  function escapeHtml(s){return String(s).replace(/[&<>"]/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[m]));}

  async function fetchQuery(query) {
    const u = new URL(GDELT); u.searchParams.set('query', query); u.searchParams.set('mode','artlist'); u.searchParams.set('format','json'); u.searchParams.set('maxrecords','30'); u.searchParams.set('timespan','48h'); u.searchParams.set('sort','datedesc');
    const r = await fetch(u); if (!r.ok) throw new Error(`GDELT ${r.status}`); const j = await r.json(); return j.articles || [];
  }

  async function load() {
    section.querySelector('#newsStatus').textContent = 'Actualizando noticias…';
    try {
      const results = await Promise.allSettled(QUERIES.map(fetchQuery));
      const raw = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      const seen = new Set();
      articles = raw.filter(a => {const k = `${a.url}|${a.title}`; if (seen.has(k)) return false; seen.add(k); return true;}).map(classify).sort((a,b) => Number(b.official)-Number(a.official));
      section.querySelector('#newsStatus').textContent = `${articles.length} noticias encontradas · Actualizado ${new Date().toLocaleString('es-MX')}`;
      render();
    } catch (e) {
      section.querySelector('#newsStatus').textContent = 'Noticias no disponibles temporalmente.';
      section.querySelector('#newsGrid').innerHTML = '<p>No fue posible consultar el agregador de noticias. Intente nuevamente más tarde.</p>';
    }
  }

  currencySelect.addEventListener('change', render); categorySelect.addEventListener('change', render); section.querySelector('#newsRefresh').addEventListener('click', load);
  load();
})();
