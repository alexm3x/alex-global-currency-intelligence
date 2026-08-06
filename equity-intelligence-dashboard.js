(() => {
  const FUNDAMENTALS_API = 'https://agci-equity-fundamentals.proadmexico.workers.dev';
  const LIST_KEY = 'agci:equity-intelligence:list:v1';
  const IBKR_KEY = 'agci:equity-intelligence:ibkr:v1';
  const DEFAULTS = ['AAPL','MSFT','AMZN','GOOGL','JPM'];
  let analyses = [];
  let ibkrRows = readJson(IBKR_KEY, []);

  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const num = (v, d=1) => Number.isFinite(Number(v)) ? Number(v).toFixed(d) : 'N/A';
  const pct = v => Number.isFinite(Number(v)) ? `${(Number(v) * (Math.abs(Number(v)) <= 2 ? 100 : 1)).toFixed(1)}%` : 'N/A';

  function readJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function symbols() {
    const own = readJson(LIST_KEY, null);
    const comparator = readJson('agci:equity-comparator:v1', null);
    return normalize(own?.length ? own : comparator?.length ? comparator : DEFAULTS).slice(0, 20);
  }
  function normalize(list) { return [...new Set(list.map(v => String(v).trim().toUpperCase()).filter(v => /^[A-Z][A-Z0-9.-]{0,9}$/.test(v)))]; }
  function saveList(list) { localStorage.setItem(LIST_KEY, JSON.stringify(normalize(list).slice(0,20))); }

  function build() {
    const nav = document.querySelector('.main-nav');
    const main = document.querySelector('main');
    if (!nav || !main || $('equityIntelligence')) return;
    const button = document.createElement('button');
    button.type = 'button';
    button.dataset.view = 'equityIntelligence';
    button.textContent = 'Equity Intelligence';
    const comparator = nav.querySelector('[data-view="equityComparator"]');
    comparator?.insertAdjacentElement('afterend', button) || nav.appendChild(button);

    const section = document.createElement('section');
    section.id = 'equityIntelligence';
    section.className = 'view eqi-view';
    section.innerHTML = `
      <div class="eqi-head"><div><p class="rubric">AGCI · DEEP EQUITY RESEARCH</p><h2>Tablero de Inteligencia de Acciones</h2><p>Lista propia, fundamentales, contexto editorial, referencias Barron's e integración local de reportes IBKR.</p></div><div class="eqi-badge">20 posiciones<br><strong>máximo</strong></div></div>
      <div class="eqi-tabs" role="tablist">
        <button class="active" data-eqi-tab="portfolio">Lista y tablero</button>
        <button data-eqi-tab="correlation">Perspectivas correlacionadas</button>
        <button data-eqi-tab="ibkr">Reporte IBKR</button>
        <button data-eqi-tab="sources">Fuentes y gobernanza</button>
      </div>
      <div class="eqi-panel active" data-eqi-panel="portfolio">
        <section class="eqi-input-card"><div><h3>Lista de acciones</h3><p>Separe tickers con coma, espacio o salto de línea.</p></div><textarea id="eqiSymbols" rows="3" aria-label="Lista de acciones"></textarea><div class="eqi-actions"><button id="eqiAnalyze" class="primary">Construir tablero</button><button id="eqiSync">Sincronizar comparador</button><button id="eqiClear">Limpiar</button><span id="eqiStatus" role="status"></span></div></section>
        <div id="eqiSummary" class="eqi-summary"></div><div id="eqiResults"></div>
      </div>
      <div class="eqi-panel" data-eqi-panel="correlation"><div id="eqiCorrelation" class="eqi-correlation-empty"><h3>Perspectivas correlacionadas</h3><p>Construya primero el tablero para cruzar fundamentales, riesgos, fuentes editoriales y señales IBKR importadas.</p></div></div>
      <div class="eqi-panel" data-eqi-panel="ibkr">
        <section class="eqi-input-card"><div><h3>Importar reporte IBKR</h3><p>Cargue un CSV exportado por Interactive Brokers. El archivo se procesa localmente y no se envía al servidor.</p></div><input id="eqiIbkrFile" type="file" accept=".csv,text/csv"><textarea id="eqiIbkrPaste" rows="6" placeholder="También puede pegar CSV: Symbol,Rating,Target Price,Analyst,Date"></textarea><div class="eqi-actions"><button id="eqiParseIbkr" class="primary">Procesar reporte</button><button id="eqiClearIbkr">Eliminar datos IBKR</button><span id="eqiIbkrStatus" role="status"></span></div></section><div id="eqiIbkrTable"></div>
      </div>
      <div class="eqi-panel" data-eqi-panel="sources"><section class="eqi-governance"><h3>Fuentes y límites</h3><div><strong>Fundamentales</strong><p>SEC EDGAR y el servicio AGCI de fundamentales.</p></div><div><strong>Barron's</strong><p>Se muestran enlaces de consulta y referencias editoriales; el sistema no evade paywalls ni reproduce artículos.</p></div><div><strong>IBKR</strong><p>Los reportes se importan por el usuario y permanecen en este navegador.</p></div><div><strong>Noticias en línea</strong><p>Los enlaces abren búsquedas externas; cada fuente conserva su propia fecha, autoría y metodología.</p></div><p class="eqi-disclaimer">El tablero organiza evidencia. No sustituye investigación independiente ni constituye recomendación personalizada.</p></section></div>`;
    main.appendChild(section);
    button.addEventListener('click', () => typeof setView === 'function' && setView('equityIntelligence'));
    section.querySelectorAll('[data-eqi-tab]').forEach(b => b.addEventListener('click', () => openTab(b.dataset.eqiTab)));
    $('eqiSymbols').value = symbols().join(', ');
    $('eqiAnalyze').addEventListener('click', analyze);
    $('eqiSync').addEventListener('click', syncComparator);
    $('eqiClear').addEventListener('click', () => { $('eqiSymbols').value=''; saveList([]); $('eqiResults').innerHTML=''; $('eqiSummary').innerHTML=''; });
    $('eqiParseIbkr').addEventListener('click', parseIbkr);
    $('eqiClearIbkr').addEventListener('click', () => { ibkrRows=[]; localStorage.removeItem(IBKR_KEY); renderIbkr(); });
    $('eqiIbkrFile').addEventListener('change', async e => { const f=e.target.files?.[0]; if (f) $('eqiIbkrPaste').value = await f.text(); });
    renderIbkr();
  }

  function openTab(name) {
    document.querySelectorAll('[data-eqi-tab]').forEach(b => b.classList.toggle('active', b.dataset.eqiTab===name));
    document.querySelectorAll('[data-eqi-panel]').forEach(p => p.classList.toggle('active', p.dataset.eqiPanel===name));
  }

  function syncComparator() {
    const list = normalize($('eqiSymbols').value.split(/[\s,;]+/)).slice(0,10);
    localStorage.setItem('agci:equity-comparator:v1', JSON.stringify(list));
    saveList(list);
    $('eqiStatus').textContent = `${list.length} símbolos enviados al comparador.`;
  }

  async function analyze() {
    const list = normalize($('eqiSymbols').value.split(/[\s,;]+/)).slice(0,20);
    if (!list.length) return $('eqiStatus').textContent='Ingrese al menos un ticker.';
    saveList(list); $('eqiAnalyze').disabled=true; $('eqiStatus').textContent='Consultando fundamentales…';
    try {
      const batches=[]; for(let i=0;i<list.length;i+=10) batches.push(list.slice(i,i+10));
      const payloads = await Promise.all(batches.map(async batch => {
        const r=await fetch(`${FUNDAMENTALS_API}/compare?symbols=${encodeURIComponent(batch.join(','))}`, {cache:'no-store'});
        const p=await r.json().catch(()=>({})); if(!r.ok) throw new Error(p.detail||p.error||`HTTP ${r.status}`); return p;
      }));
      analyses = payloads.flatMap(p=>p.analyses||[]).filter(x=>x.company);
      renderDashboard(); renderCorrelation(); $('eqiStatus').textContent=`${analyses.length} acciones analizadas.`;
    } catch(e) { $('eqiResults').innerHTML=`<div class="eqi-error"><strong>No fue posible construir el tablero.</strong><p>${esc(e.message)}</p></div>`; $('eqiStatus').textContent='Error de conexión.'; }
    finally { $('eqiAnalyze').disabled=false; }
  }

  function renderDashboard() {
    const scores=analyses.map(a=>Number(a.score?.total||0));
    const avg=scores.length?scores.reduce((a,b)=>a+b,0)/scores.length:0;
    const attractive=analyses.filter(a=>/atractiva/i.test(a.classification||'')).length;
    const warnings=analyses.filter(a=>/trampa|riesgo/i.test(`${a.classification} ${a.conclusion}`)).length;
    $('eqiSummary').innerHTML=`<div><span>Acciones</span><strong>${analyses.length}</strong></div><div><span>Score promedio</span><strong>${num(avg,0)}</strong></div><div><span>Valuación atractiva</span><strong>${attractive}</strong></div><div><span>Alertas</span><strong>${warnings}</strong></div>`;
    $('eqiResults').innerHTML=`<div class="eqi-grid">${analyses.sort((a,b)=>Number(b.score?.total||0)-Number(a.score?.total||0)).map(card).join('')}</div>`;
  }

  function card(a) {
    const c=a.company, r=c.ratios||{}, g=c.growth||{}, ib=ibkrRows.find(x=>x.symbol===a.ticker);
    return `<article class="eqi-card"><header><div><strong>${esc(a.ticker)}</strong><span>${esc(c.companyName)}</span></div><b>${num(a.score?.total,0)}</b></header><p class="eqi-class">${esc(a.classification)}</p><div class="eqi-metrics"><div><span>P/E</span><b>${num(r.peTTM)}</b></div><div><span>EV/EBITDA</span><b>${num(r.evEbitda)}</b></div><div><span>FCF Yield</span><b>${pct(r.fcfYield)}</b></div><div><span>ROIC</span><b>${pct(r.roic)}</b></div><div><span>Ingresos YoY</span><b>${pct(g.revenueYoY)}</b></div><div><span>Deuda/EBITDA</span><b>${num(r.netDebtToEbitda)}</b></div></div><p>${esc(a.conclusion||'Sin conclusión disponible.')}</p>${ib?`<div class="eqi-ibkr-note"><strong>IBKR: ${esc(ib.rating||'N/A')}</strong><span>Objetivo: ${esc(ib.target||'N/A')} · ${esc(ib.date||'')}</span></div>`:''}<footer><a target="_blank" rel="noopener noreferrer" href="https://www.barrons.com/search?query=${encodeURIComponent(a.ticker)}">Barron's</a><a target="_blank" rel="noopener noreferrer" href="https://www.google.com/search?q=${encodeURIComponent(a.ticker+' stock latest earnings news')}">Noticias</a><a target="_blank" rel="noopener noreferrer" href="https://www.sec.gov/edgar/browse/?CIK=${encodeURIComponent(a.ticker)}&owner=exclude">SEC</a></footer></article>`;
  }

  function renderCorrelation() {
    if (!analyses.length) return;
    $('eqiCorrelation').className='';
    $('eqiCorrelation').innerHTML=`<section class="eqi-correlation-head"><h3>Matriz de evidencia correlacionada</h3><p>No combina metodologías en un único “precio objetivo”; muestra coincidencias y divergencias entre señales.</p></section><div class="eqi-table-wrap"><table><thead><tr><th>Ticker</th><th>AGCI fundamental</th><th>Valuación</th><th>Calidad</th><th>IBKR</th><th>Barron's / línea</th><th>Lectura</th></tr></thead><tbody>${analyses.map(a=>{const ib=ibkrRows.find(x=>x.symbol===a.ticker); const val=Number(a.score?.valuation||0), quality=Number(a.score?.quality||0); const reading=ib?`${a.classification}; contrastar con ${ib.rating||'rating IBKR'}`:`${a.classification}; falta importar IBKR`; return `<tr><td><strong>${esc(a.ticker)}</strong></td><td>${num(a.score?.total,0)}</td><td>${num(val,0)}</td><td>${num(quality,0)}</td><td>${ib?esc(ib.rating||'Disponible'):'Sin dato'}</td><td><a target="_blank" rel="noopener noreferrer" href="https://www.barrons.com/search?query=${encodeURIComponent(a.ticker)}">Abrir búsqueda</a></td><td>${esc(reading)}</td></tr>`}).join('')}</tbody></table></div>`;
  }

  function parseCsv(text) {
    const lines=text.trim().split(/\r?\n/).filter(Boolean); if(lines.length<2) return [];
    const split=line=>line.match(/("(?:[^"]|"")*"|[^,]*)/g).map(x=>x.replace(/^"|"$/g,'').replace(/""/g,'"')).filter((_,i,a)=>i<a.length-1);
    const headers=split(lines[0]).map(h=>h.trim().toLowerCase());
    return lines.slice(1).map(line=>{const v=split(line); const get=(...names)=>{const i=headers.findIndex(h=>names.some(n=>h.includes(n))); return i>=0?v[i]?.trim():''}; return {symbol:String(get('symbol','ticker')).toUpperCase(),rating:get('rating','recommendation'),target:get('target price','price target','target'),analyst:get('analyst','firm'),date:get('date')};}).filter(r=>/^[A-Z][A-Z0-9.-]{0,9}$/.test(r.symbol));
  }
  function parseIbkr() { ibkrRows=parseCsv($('eqiIbkrPaste').value); localStorage.setItem(IBKR_KEY,JSON.stringify(ibkrRows)); $('eqiIbkrStatus').textContent=`${ibkrRows.length} registros importados localmente.`; renderIbkr(); if(analyses.length){renderDashboard();renderCorrelation();} }
  function renderIbkr() { $('eqiIbkrTable').innerHTML=ibkrRows.length?`<div class="eqi-table-wrap"><table><thead><tr><th>Symbol</th><th>Rating</th><th>Target</th><th>Analyst/Firm</th><th>Date</th></tr></thead><tbody>${ibkrRows.map(r=>`<tr><td><strong>${esc(r.symbol)}</strong></td><td>${esc(r.rating)}</td><td>${esc(r.target)}</td><td>${esc(r.analyst)}</td><td>${esc(r.date)}</td></tr>`).join('')}</tbody></table></div>`:'<p class="eqi-empty">No hay datos IBKR importados.</p>'; }

  if (document.readyState==='loading') document.addEventListener('DOMContentLoaded',build); else build();
})();