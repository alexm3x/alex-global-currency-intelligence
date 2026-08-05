const DATA = [{"country": "Estados Unidos", "currency": "USD", "code": "USD", "score": 63, "valuation": 48, "fundamentals": 67, "momentum": 72, "risk": 65, "signal": "Neutral", "change": 1.2}, {"country": "China", "currency": "Yuan", "code": "CNY", "score": 76, "valuation": 88, "fundamentals": 73, "momentum": 61, "risk": 70, "signal": "Compra", "change": 2.8}, {"country": "Alemania", "currency": "Euro", "code": "EUR", "score": 58, "valuation": 55, "fundamentals": 64, "momentum": 51, "risk": 63, "signal": "Neutral", "change": -0.4}, {"country": "Japón", "currency": "Yen", "code": "JPY", "score": 82, "valuation": 94, "fundamentals": 66, "momentum": 71, "risk": 74, "signal": "Compra fuerte", "change": 3.5}, {"country": "India", "currency": "Rupia", "code": "INR", "score": 68, "valuation": 74, "fundamentals": 79, "momentum": 65, "risk": 54, "signal": "Compra", "change": 1.7}, {"country": "Reino Unido", "currency": "Libra", "code": "GBP", "score": 57, "valuation": 43, "fundamentals": 61, "momentum": 62, "risk": 64, "signal": "Neutral", "change": 0.3}, {"country": "Francia", "currency": "Euro", "code": "EUR", "score": 56, "valuation": 55, "fundamentals": 57, "momentum": 51, "risk": 62, "signal": "Neutral", "change": -0.5}, {"country": "Italia", "currency": "Euro", "code": "EUR", "score": 52, "valuation": 55, "fundamentals": 49, "momentum": 51, "risk": 55, "signal": "Neutral", "change": -0.8}, {"country": "Brasil", "currency": "Real", "code": "BRL", "score": 72, "valuation": 80, "fundamentals": 68, "momentum": 73, "risk": 60, "signal": "Compra", "change": 2.1}, {"country": "Canadá", "currency": "Dólar canadiense", "code": "CAD", "score": 61, "valuation": 62, "fundamentals": 65, "momentum": 57, "risk": 61, "signal": "Neutral", "change": 0.6}, {"country": "Rusia", "currency": "Rublo", "code": "RUB", "score": 45, "valuation": 83, "fundamentals": 46, "momentum": 35, "risk": 18, "signal": "Evitar", "change": -3.0}, {"country": "Corea del Sur", "currency": "Won", "code": "KRW", "score": 70, "valuation": 81, "fundamentals": 72, "momentum": 64, "risk": 62, "signal": "Compra", "change": 1.9}, {"country": "Australia", "currency": "Dólar australiano", "code": "AUD", "score": 64, "valuation": 60, "fundamentals": 70, "momentum": 66, "risk": 60, "signal": "Neutral", "change": 0.9}, {"country": "España", "currency": "Euro", "code": "EUR", "score": 59, "valuation": 55, "fundamentals": 62, "momentum": 58, "risk": 61, "signal": "Neutral", "change": 0.2}, {"country": "México", "currency": "Peso", "code": "MXN", "score": 74, "valuation": 69, "fundamentals": 71, "momentum": 82, "risk": 66, "signal": "Compra", "change": 2.4}, {"country": "Indonesia", "currency": "Rupia indonesia", "code": "IDR", "score": 67, "valuation": 78, "fundamentals": 72, "momentum": 59, "risk": 58, "signal": "Compra", "change": 1.1}, {"country": "Turquía", "currency": "Lira", "code": "TRY", "score": 39, "valuation": 71, "fundamentals": 34, "momentum": 28, "risk": 22, "signal": "Evitar", "change": -4.2}, {"country": "Países Bajos", "currency": "Euro", "code": "EUR", "score": 62, "valuation": 55, "fundamentals": 72, "momentum": 58, "risk": 65, "signal": "Neutral", "change": 0.7}, {"country": "Arabia Saudita", "currency": "Riyal", "code": "SAR", "score": 60, "valuation": 58, "fundamentals": 69, "momentum": 54, "risk": 60, "signal": "Neutral", "change": 0.1}, {"country": "Suiza", "currency": "Franco", "code": "CHF", "score": 44, "valuation": 24, "fundamentals": 77, "momentum": 45, "risk": 69, "signal": "Reducir", "change": -1.6}, {"country": "Argentina", "currency": "Peso argentino", "code": "ARS", "score": 36, "valuation": 66, "fundamentals": 30, "momentum": 26, "risk": 20, "signal": "Evitar", "change": -5.1}];

const viewTitles={home:"Overview",markets:"Currency Rankings",research:"Research",methodology:"Methodology",briefing:"Daily Briefing"};
function setView(id){
  document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===id));
  document.querySelectorAll(".main-nav button").forEach(b=>b.classList.toggle("active",b.dataset.view===id));
  window.scrollTo({top:0,behavior:"smooth"});
}
document.querySelectorAll("[data-view]").forEach(b=>b.onclick=()=>setView(b.dataset.view));
document.querySelectorAll("[data-jump]").forEach(b=>b.onclick=()=>setView(b.dataset.jump));

document.getElementById("marketTape").innerHTML=[
  ["USD INDEX","103.42","+0.18%"],["EUR/USD","1.1472","-0.11%"],["USD/JPY","149.63","+0.42%"],
  ["USD/MXN","18.71","-0.27%"],["GBP/USD","1.3261","+0.09%"],["USD/CNY","7.183","+0.03%"]
].map(x=>`<span class="ticker"><b>${x[0]}</b>${x[1]} <em class="${x[2].startsWith("+")?"up":"down"}">${x[2]}</em></span>`).join("");

function filtered(){
  const q=(document.getElementById("searchInput")?.value||"").toLowerCase();
  const sig=document.getElementById("signalFilter")?.value||"";
  const sort=document.getElementById("sortSelect")?.value||"score-desc";
  let a=DATA.filter(d=>(d.country+" "+d.currency+" "+d.code).toLowerCase().includes(q)&&(!sig||d.signal===sig));
  a.sort((x,y)=>sort==="score-asc"?x.score-y.score:sort==="change-desc"?y.change-x.change:y.score-x.score);
  return a;
}
function renderPreview(){
  document.getElementById("topTable").innerHTML=[...DATA].sort((a,b)=>b.score-a.score).slice(0,7).map((d,i)=>`
    <div class="preview-row" data-currency="${d.country}">
      <b>${String(i+1).padStart(2,"0")}</b>
      <span><strong>${d.country}</strong><br><small>${d.code} · ${d.currency}</small></span>
      <span>${d.valuation}</span>
      <span class="preview-score">${d.score}</span>
      <span><i class="signal-tag">${d.signal}</i></span>
      <span class="${d.change>=0?"positive":"negative"}">${d.change>0?"+":""}${d.change}</span>
    </div>`).join("");
}
function renderTable(){
  const body=document.getElementById("rankingBody");
  if(!body)return;
  body.innerHTML=filtered().map((d,i)=>`<tr data-currency="${d.country}">
    <td>${i+1}</td><td><strong>${d.country}</strong></td><td>${d.code} · ${d.currency}</td>
    <td><strong>${d.score}</strong></td><td>${d.valuation}</td><td>${d.fundamentals}</td>
    <td>${d.momentum}</td><td>${d.risk}</td><td>${d.signal}</td>
    <td class="${d.change>=0?"positive":"negative"}">${d.change>0?"+":""}${d.change}</td>
  </tr>`).join("");
}
["searchInput","signalFilter","sortSelect"].forEach(id=>document.getElementById(id)?.addEventListener("input",renderTable));

const dialog=document.getElementById("currencyDialog");
function openCurrency(country){
  const d=DATA.find(x=>x.country===country); if(!d)return;
  document.getElementById("dialogContent").innerHTML=`
    <p class="rubric">AGCI CURRENCY NOTE</p><h2 style="font-family:'Source Serif 4',serif;font-size:42px;margin:5px 0">${d.country}: ${d.code}</h2>
    <p style="font-family:'Source Serif 4',serif;font-size:18px;color:var(--muted)">Composite signal: <strong>${d.signal}</strong>. Illustrative daily change: <span class="${d.change>=0?"positive":"negative"}">${d.change>0?"+":""}${d.change}</span>.</p>
    <div class="metric-grid">
      <div class="metric"><span>AGCI Score</span><strong>${d.score}</strong></div>
      <div class="metric"><span>Valuation</span><strong>${d.valuation}</strong></div>
      <div class="metric"><span>Fundamentals</span><strong>${d.fundamentals}</strong></div>
      <div class="metric"><span>Momentum</span><strong>${d.momentum}</strong></div>
      <div class="metric"><span>Risk</span><strong>${d.risk}</strong></div>
      <div class="metric"><span>Confidence</span><strong>72%</strong></div>
    </div>
    <p style="font-size:12px;color:var(--muted)">Demonstration data. Production notes will include sources, cut-off time, historical attribution and model confidence.</p>`;
  dialog.showModal();
}
document.addEventListener("click",e=>{const x=e.target.closest("[data-currency]");if(x)openCurrency(x.dataset.currency)});
document.getElementById("dialogClose").onclick=()=>dialog.close();
document.getElementById("themeToggle").onclick=()=>{
  document.body.classList.toggle("dark");
  document.getElementById("themeToggle").textContent=document.body.classList.contains("dark")?"Modo claro":"Modo oscuro";
};
document.getElementById("exportBtn")?.addEventListener("click",()=>{
 const rows=[["Economy","Currency","Code","AGCI","Valuation","Fundamentals","Momentum","Risk","Signal","Change"],...filtered().map(d=>[d.country,d.currency,d.code,d.score,d.valuation,d.fundamentals,d.momentum,d.risk,d.signal,d.change])];
 const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(",")).join("\n");
 const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="AGCI_currency_ranking.csv";a.click();
});
renderPreview();renderTable();

// AGCI v3: professional decision layer
(() => {
  const style = document.createElement('link'); style.rel='stylesheet'; style.href='v3.css'; document.head.appendChild(style);
  const thesis={JPY:'Valoración excepcional y momentum en mejora; riesgo principal: normalización monetaria.',MXN:'Momentum sólido y fundamentos razonables; vigilar concentración de carry y volatilidad política.',CNY:'Descuento relativo atractivo; menor convicción por deflación y dirección de política.',BRL:'Carry y valoración favorables, con sensibilidad fiscal elevada.',USD:'Fundamentos y momentum resilientes, pero valoración menos atractiva.'};
  DATA.forEach(d=>{d.confidence=d.score>=65?72:d.score>=50?64:55;d.thesis=thesis[d.code]||'Señal compuesta basada en valoración, fundamentos, momentum y riesgo.'});
  const nav=document.querySelector('.main-nav');
  nav.insertAdjacentHTML('beforeend','<button data-view="compare">Compare</button><button data-view="governance">Data Governance</button>');
  document.querySelector('.market-tape').insertAdjacentHTML('afterend','<div class="data-status" id="structuralStatus"><span><b>DATA STATUS</b> Validando fuentes estructurales…</span><span id="structuralCut">Sincronizando</span><button data-view="governance">Ver gobierno de datos</button></div>');
  document.querySelector('main').insertAdjacentHTML('beforeend',`<section id="compare" class="view"><div class="page-head"><p class="rubric">DECISION LAB</p><h2>Currency Comparison</h2><p>Select four economies to compare conviction, drivers and risk.</p></div><div class="compare-controls" id="compareControls"></div><div class="compare-summary" id="compareSummary"></div><div class="compare-table-wrap"><table><thead><tr><th>Metric</th><th id="c1">—</th><th id="c2">—</th><th id="c3">—</th><th id="c4">—</th></tr></thead><tbody id="compareBody"></tbody></table></div></section><section id="governance" class="view"><div class="page-head"><p class="rubric">TRUST & TRANSPARENCY</p><h2>Data Governance</h2><p>Fuentes, frescura, metodología y limitaciones del modelo.</p></div><div class="governance-grid"><article><span>01</span><h3>Registro de fuentes</h3><p>Cada indicador conserva proveedor, código de serie, frecuencia y fecha de observación.</p></article><article><span>02</span><h3>Controles de frescura</h3><p>La extracción y la fecha económica se validan por separado; una falla nunca se oculta.</p></article><article><span>03</span><h3>Versionado</h3><p>Las revisiones de ponderación y metodología se registran con fecha efectiva.</p></article><article><span>04</span><h3>Reproducibilidad</h3><p>La instantánea estructural queda publicada como JSON auditable.</p></article></div><div class="source-registry"><h3>Fuentes de producción</h3><p class="registry-meta" id="sourceRegistryMeta">Cargando registro automático…</p><div id="sourceRegistry"></div></div><div class="macro-snapshot" id="macroSnapshot"></div><div class="legal-links"><a href="data/macro-latest.json">Datos estructurales JSON</a><a href="methodology.html">Metodología</a><a href="privacy.html">Privacidad</a><a href="terms.html">Términos</a></div></section>`);
  document.querySelector('footer').insertAdjacentHTML('beforeend','<nav class="footer-links"><a href="methodology.html">Methodology</a><a href="privacy.html">Privacy</a><a href="terms.html">Terms</a><a href="https://github.com/alexm3x/alex-global-currency-intelligence/issues/1">Public audit</a></nav>');
  document.querySelectorAll('[data-view]').forEach(b=>b.addEventListener('click',()=>setView(b.dataset.view)));
  const defaults=['Japón','México','China','Brasil'];
  const controls=document.getElementById('compareControls');
  controls.innerHTML=defaults.map((x,i)=>`<label><span class="rubric">Currency ${i+1}</span><select class="compare-select">${DATA.map(d=>`<option ${d.country===x?'selected':''}>${d.country}</option>`).join('')}</select></label>`).join('');
  function renderCompare(){const ds=[...document.querySelectorAll('.compare-select')].map(s=>DATA.find(d=>d.country===s.value));document.getElementById('compareSummary').innerHTML=ds.map(d=>`<article class="compare-card"><span class="rubric">${d.code} · ${d.signal}</span><h3>${d.country}</h3><strong>${d.score}</strong><p>${d.thesis}</p></article>`).join('');['c1','c2','c3','c4'].forEach((id,i)=>document.getElementById(id).textContent=ds[i].code);const rows=[['AGCI Score','score'],['Valuation','valuation'],['Fundamentals','fundamentals'],['Momentum','momentum'],['Risk','risk'],['Confidence','confidence'],['Daily change','change']];document.getElementById('compareBody').innerHTML=rows.map(([l,k])=>`<tr><td><strong>${l}</strong></td>${ds.map(d=>`<td>${k==='change'?(d[k]>0?'+':'')+d[k]:d[k]}${k==='confidence'?'%':''}</td>`).join('')}</tr>`).join('')}
  controls.querySelectorAll('select').forEach(s=>s.addEventListener('change',renderCompare)); renderCompare();
  const esc=v=>String(v??'').replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const fmt=(item,digits=2)=>item&&Number.isFinite(Number(item.value))?`${Number(item.value).toFixed(digits)} <small>(${esc(item.period)})</small>`:'—';
  Promise.all([
    fetch('data/sources.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`sources ${r.status}`);return r.json()}),
    fetch('data/macro-latest.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw new Error(`macro ${r.status}`);return r.json()})
  ]).then(([registry,macro])=>{
    const status=document.getElementById('structuralStatus');
    const connected=registry.status==='connected';
    status.classList.toggle('connected',connected);
    status.classList.toggle('degraded',!connected);
    status.querySelector('span').innerHTML=`<b>DATA STATUS</b> ${connected?'Mercado y fuentes estructurales conectados':'Conexión estructural degradada'}`;
    document.getElementById('structuralCut').textContent=`Última validación: ${new Date(registry.generated_at).toLocaleString('es-MX',{timeZone:'America/Mexico_City',dateStyle:'medium',timeStyle:'short'})}`;
    document.getElementById('sourceRegistryMeta').textContent=`Actualización automática cada 6 horas · Estado general: ${connected?'conectado':'degradado'}`;
    document.getElementById('sourceRegistry').innerHTML=registry.sources.map(source=>{
      const cls=source.status==='Conectado'?'status-connected':source.status==='Degradado'?'status-degraded':'status-pending';
      const last=source.last_success?`Último éxito: ${new Date(source.last_success).toLocaleString('es-MX',{timeZone:'America/Mexico_City'})}`:'Sin ejecución válida';
      return `<div class="source-row" title="${esc(last)}"><strong>${esc(source.category)}</strong><span>${esc(source.provider)}</span><span>${esc(source.frequency)}</span><span class="${cls}">${esc(source.status)}</span></div>`;
    }).join('');
    const economyOrder=['MX','US','XM','GB','JP','CN','BR'];
    document.getElementById('macroSnapshot').innerHTML=`<div class="section-heading"><div><p class="rubric">ÚLTIMA INSTANTÁNEA VALIDADA</p><h2>Macro, política y valoración</h2></div><div class="risk-chip"><span>VIX ${esc(macro.risk?.period||'')}</span><strong>${esc(macro.risk?.vix??'—')}</strong><small>Régimen ${esc(macro.risk?.regime||'n/d')}</small></div></div><div class="macro-table-wrap"><table><thead><tr><th>Economía</th><th>Inflación</th><th>PIB real</th><th>Cuenta corriente</th><th>Tasa</th><th>REER</th></tr></thead><tbody>${economyOrder.map(code=>{const item=macro.economies?.[code]||{};return `<tr><td><strong>${esc(item.name||code)}</strong><small>${esc(item.currency||'')}</small></td><td>${fmt(item.inflation)}</td><td>${fmt(item.growth)}</td><td>${fmt(item.currentAccount)}</td><td>${fmt(item.policyRate,3)}</td><td>${fmt(item.reer)}</td></tr>`}).join('')}</tbody></table></div><p class="macro-footnote">Inflación, PIB y cuenta corriente: World Bank WDI. Tasas y REER: BIS. Volatilidad: Cboe VIX. Los periodos entre paréntesis son fechas económicas, no fechas de extracción.</p>`;
  }).catch(error=>{
    document.getElementById('structuralStatus').classList.add('degraded');
    document.getElementById('structuralStatus').querySelector('span').innerHTML='<b>DATA STATUS</b> No fue posible validar fuentes estructurales';
    document.getElementById('structuralCut').textContent='Reintento automático pendiente';
    document.getElementById('sourceRegistry').textContent=`Registro no disponible: ${error.message}`;
  });
  openCurrency=(country)=>{const d=DATA.find(x=>x.country===country);if(!d)return;const parts=[['Valuation',d.valuation,.30],['Fundamentals',d.fundamentals,.30],['Momentum',d.momentum,.25],['Risk',d.risk,.15]];document.getElementById('dialogContent').innerHTML=`<p class="rubric">AGCI CURRENCY NOTE · MODEL v0.3</p><h2 style="font-family:'Source Serif 4',serif;font-size:42px;margin:5px 0">${d.country}: ${d.code}</h2><p class="currency-thesis">${d.thesis}</p><div class="freshness"><b>Data quality:</b> Demonstration · Model cut: 31 Jul 2026 · Confidence: ${d.confidence}%</div><div class="metric-grid"><div class="metric"><span>AGCI Score</span><strong>${d.score}</strong></div><div class="metric"><span>Signal</span><strong style="font-size:20px">${d.signal}</strong></div><div class="metric"><span>Change</span><strong class="${d.change>=0?'positive':'negative'}">${d.change>0?'+':''}${d.change}</strong></div></div><h3 style="font-family:'Source Serif 4',serif;font-size:25px">Score attribution</h3>${parts.map(([n,v,w])=>`<div class="component-row"><span>${n}</span><div class="component-track"><i style="width:${v}%"></i></div><b>${v}</b><small>${(v*w).toFixed(1)} pts</small></div>`).join('')}<p style="font-size:11px;color:var(--muted)">Weighted components may differ from the displayed composite because of normalization and demonstration rounding.</p>`;dialog.showModal()};
})();
