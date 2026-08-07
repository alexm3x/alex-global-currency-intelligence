(() => {
  const KEY = 'agci:multi-asset-lists:v1';
  const ACTIVE_KEY = 'agci:multi-asset-active:v1';
  const MAX = 10;
  const defaults = { positions: [], etfs: [], bonds: [], watchlist: [] };
  const meta = {
    positions: { label: 'Posiciones', hint: 'Acciones actualmente en cartera' },
    etfs: { label: 'ETFs', hint: 'ETFs y fondos cotizados' },
    bonds: { label: 'Bonos', hint: 'Bonos, Treasury ETFs o identificadores de renta fija' },
    watchlist: { label: 'Watch List', hint: 'Ideas bajo seguimiento' }
  };
  const esc = s => String(s ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const normalize = values => [...new Set(values.map(v=>String(v).trim().toUpperCase()).filter(v=>/^[A-Z0-9.^=-]{1,18}$/.test(v)))].slice(0,MAX);
  function load(){ try { return {...defaults,...JSON.parse(localStorage.getItem(KEY)||'{}')}; } catch { return {...defaults}; } }
  function save(data){ localStorage.setItem(KEY,JSON.stringify(data)); }
  let data=load();
  let active=localStorage.getItem(ACTIVE_KEY)||'positions';
  if(!meta[active]) active='positions';

  function mount(){
    const host=document.getElementById('equityIntelligence');
    if(!host || document.getElementById('agciMultiLists')) return;
    const anchor=host.querySelector('.eqi-head') || host.firstElementChild;
    const section=document.createElement('section');
    section.id='agciMultiLists'; section.className='aml-shell';
    section.innerHTML=`<div class="aml-head"><div><p class="rubric">PORTFOLIO LIST MANAGER</p><h3>Listas de 10 instrumentos</h3><p>Organice posiciones, ETFs, bonos y oportunidades bajo seguimiento. Cada lista admite hasta diez instrumentos.</p></div><span class="aml-limit">10 por lista</span></div><div class="aml-tabs" role="tablist">${Object.entries(meta).map(([k,m])=>`<button type="button" data-aml-tab="${k}">${m.label}<b data-aml-count="${k}">0/10</b></button>`).join('')}</div><div class="aml-panel"><div class="aml-context"><strong id="amlTitle"></strong><span id="amlHint"></span></div><div id="amlSlots" class="aml-slots"></div><form id="amlForm" class="aml-form"><input id="amlInput" maxlength="18" autocomplete="off" placeholder="Ticker o identificador"><button type="submit">Agregar</button></form><div class="aml-actions"><button type="button" id="amlUse" class="primary">Usar en tablero</button><button type="button" id="amlClear">Vaciar lista</button><span id="amlStatus" role="status"></span></div><p class="aml-note">Para acciones, el tablero muestra ratios fundamentales disponibles. En ETFs y bonos los indicadores dependen de la cobertura del proveedor; no se fabrican métricas faltantes.</p></div>`;
    anchor?.insertAdjacentElement('afterend',section);
    section.querySelectorAll('[data-aml-tab]').forEach(b=>b.addEventListener('click',()=>{active=b.dataset.amlTab;localStorage.setItem(ACTIVE_KEY,active);render();}));
    document.getElementById('amlForm').addEventListener('submit',add);
    document.getElementById('amlClear').addEventListener('click',()=>{data[active]=[];save(data);render();status('Lista vaciada.');});
    document.getElementById('amlUse').addEventListener('click',useInDashboard);
    render();
  }
  function render(){
    document.querySelectorAll('[data-aml-tab]').forEach(b=>b.classList.toggle('active',b.dataset.amlTab===active));
    Object.keys(meta).forEach(k=>{const n=document.querySelector(`[data-aml-count="${k}"]`);if(n)n.textContent=`${data[k].length}/10`;});
    const title=document.getElementById('amlTitle'),hint=document.getElementById('amlHint'),slots=document.getElementById('amlSlots');
    if(!slots)return; title.textContent=meta[active].label; hint.textContent=meta[active].hint;
    slots.innerHTML=Array.from({length:MAX},(_,i)=>{const v=data[active][i];return v?`<div class="aml-slot filled"><span>${String(i+1).padStart(2,'0')}</span><strong>${esc(v)}</strong><button type="button" data-aml-remove="${esc(v)}" aria-label="Eliminar ${esc(v)}">×</button></div>`:`<div class="aml-slot"><span>${String(i+1).padStart(2,'0')}</span><em>Disponible</em></div>`}).join('');
    slots.querySelectorAll('[data-aml-remove]').forEach(b=>b.addEventListener('click',()=>{data[active]=data[active].filter(x=>x!==b.dataset.amlRemove);save(data);render();}));
    const use=document.getElementById('amlUse'); use.textContent=active==='positions'||active==='watchlist'?'Usar en tablero fundamental':'Usar en monitor';
  }
  function add(e){e.preventDefault();const input=document.getElementById('amlInput');const v=normalize([input.value])[0];if(!v)return status('Ingrese un ticker o identificador válido.');if(data[active].includes(v))return status(`${v} ya está en esta lista.`);if(data[active].length>=MAX)return status('Esta lista ya contiene 10 instrumentos.');data[active].push(v);save(data);input.value='';render();status(`${v} agregado a ${meta[active].label}.`);}
  function useInDashboard(){
    const list=data[active].slice(0,MAX);
    if(!list.length)return status('Agregue instrumentos primero.');
    localStorage.setItem('agci:equity-intelligence:list:v1',JSON.stringify(list));
    localStorage.setItem('agci:equity-comparator:v1',JSON.stringify(list));
    const eqi=document.getElementById('eqiSymbols'); if(eqi) eqi.value=list.join(', ');
    window.dispatchEvent(new CustomEvent('agci:list-changed',{detail:{type:active,symbols:list}}));
    status(`${meta[active].label}: ${list.length} instrumentos enviados al tablero.`);
  }
  function status(t){const el=document.getElementById('amlStatus');if(el)el.textContent=t;}
  function init(){mount();const obs=new MutationObserver(()=>mount());obs.observe(document.body,{childList:true,subtree:true});setTimeout(()=>obs.disconnect(),20000);}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();