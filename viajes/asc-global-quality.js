(() => {
  'use strict';
  if (window.__VIAJES_ASC_GLOBAL_QUALITY__) return;
  window.__VIAJES_ASC_GLOBAL_QUALITY__ = true;

  const $ = (s, r=document) => r.querySelector(s);
  const $$ = (s, r=document) => [...r.querySelectorAll(s)];
  const metrics = { lcp:null, cls:0, inp:null };
  let installPrompt = null;

  function addHeadAssets(){
    if (!$('link[rel="manifest"]')) {
      const link=document.createElement('link'); link.rel='manifest'; link.href='manifest.webmanifest'; document.head.appendChild(link);
    }
    if (!$('meta[name="mobile-web-app-capable"]')) {
      const meta=document.createElement('meta'); meta.name='mobile-web-app-capable'; meta.content='yes'; document.head.appendChild(meta);
    }
  }

  function styles(){
    if ($('#asc-global-quality-styles')) return;
    const s=document.createElement('style'); s.id='asc-global-quality-styles';
    s.textContent=`
      .asc-quality-pill{display:inline-flex;align-items:center;gap:7px;min-height:34px;padding:7px 10px;border:1px solid rgba(51,65,85,.85);border-radius:999px;background:rgba(5,11,16,.62);color:#94a3b8;font-size:9px;font-weight:800}.asc-quality-pill i{width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 10px rgba(52,211,153,.65)}.asc-quality-pill.is-offline i{background:#e8c66a;box-shadow:none}.asc-palette{width:min(720px,calc(100vw - 26px));max-height:min(720px,calc(100dvh - 26px));margin:auto;border:1px solid rgba(103,232,249,.25);border-radius:18px;background:#071119;color:#e2e8f0;box-shadow:0 35px 120px rgba(0,0,0,.75)}.asc-palette::backdrop{background:rgba(1,5,9,.76);backdrop-filter:blur(9px)}.asc-palette__head{display:grid;grid-template-columns:1fr auto;gap:10px;padding:14px;border-bottom:1px solid #1e293b}.asc-palette__head input{min-height:46px;border:1px solid #334155;border-radius:10px;background:#050b10;padding:10px 12px;color:#fff;outline:none}.asc-palette__head input:focus{border-color:#67e8f9}.asc-palette__head button{width:46px;border:1px solid #334155;border-radius:10px;color:#94a3b8}.asc-palette__list{padding:8px;max-height:520px;overflow:auto}.asc-palette__item{display:grid;grid-template-columns:1fr auto;width:100%;gap:10px;align-items:center;min-height:50px;padding:10px 12px;border-radius:10px;color:#cbd5e1;text-align:left}.asc-palette__item:hover,.asc-palette__item:focus-visible{background:rgba(103,232,249,.07);color:#fff}.asc-palette__item small{color:#64748b}.asc-health-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;padding:14px}.asc-health-card{padding:12px;border:1px solid #1e293b;border-radius:10px;background:#050b10}.asc-health-card span{display:block;color:#64748b;font:700 8px/1.2 ui-monospace,monospace;text-transform:uppercase}.asc-health-card strong{display:block;margin-top:6px;color:#fff;font-size:12px}.asc-health-note{padding:0 14px 14px;color:#64748b;font-size:9px;line-height:1.55}@media(max-width:760px){.asc-palette{width:100vw;height:100dvh;max-height:100dvh;border:0;border-radius:0}.asc-health-grid{grid-template-columns:1fr}}
    `; document.head.appendChild(s);
  }

  function observePerformance(){
    if (!('PerformanceObserver' in window)) return;
    try { new PerformanceObserver(list=>{const entries=list.getEntries(); const last=entries.at(-1); if(last) metrics.lcp=Math.round(last.startTime);}).observe({type:'largest-contentful-paint',buffered:true}); } catch {}
    try { new PerformanceObserver(list=>{for(const e of list.getEntries()) if(!e.hadRecentInput) metrics.cls+=e.value;}).observe({type:'layout-shift',buffered:true}); } catch {}
    try { new PerformanceObserver(list=>{for(const e of list.getEntries()) metrics.inp=Math.max(metrics.inp||0,Math.round(e.duration||0));}).observe({type:'event',buffered:true,durationThreshold:40}); } catch {}
  }

  function swState(){
    const controller=navigator.serviceWorker?.controller;
    return controller ? 'Activo' : ('serviceWorker' in navigator ? 'Preparado' : 'No soportado');
  }

  async function registerPWA(){
    if (!('serviceWorker' in navigator)) return;
    if (!(location.protocol==='https:' || ['localhost','127.0.0.1'].includes(location.hostname))) return;
    try { await navigator.serviceWorker.register('./sw.js',{scope:'./'}); updateStatus(); }
    catch(error){ console.warn('Viajes ASC PWA registration:',error.message); }
  }

  function currentDataState(){
    const badge=$('#pipelineBadge')?.textContent?.trim();
    return badge || 'Estado no expuesto';
  }

  function travelDNAState(){
    if (localStorage.getItem('viajesASCGuestMode')==='true') return 'Guest Mode';
    return localStorage.getItem('viajesASCTravelDNA') ? 'Configurado' : 'No configurado';
  }

  function healthHTML(){
    const lcp=metrics.lcp==null?'Pendiente':`${metrics.lcp} ms`;
    const cls=metrics.cls ? metrics.cls.toFixed(3) : '0.000';
    const inp=metrics.inp==null?'Pendiente':`${metrics.inp} ms`;
    return `<div class="asc-health-grid"><div class="asc-health-card"><span>Conexión</span><strong>${navigator.onLine?'ONLINE':'OFFLINE'}</strong></div><div class="asc-health-card"><span>PWA</span><strong>${swState()}</strong></div><div class="asc-health-card"><span>Travel DNA</span><strong>${travelDNAState()}</strong></div><div class="asc-health-card"><span>Pipeline</span><strong>${currentDataState()}</strong></div><div class="asc-health-card"><span>LCP observado</span><strong>${lcp}</strong></div><div class="asc-health-card"><span>CLS observado</span><strong>${cls}</strong></div><div class="asc-health-card"><span>INP proxy observado</span><strong>${inp}</strong></div><div class="asc-health-card"><span>Offline viajes</span><strong>Local disponible</strong></div></div><p class="asc-health-note">Las métricas son observaciones de esta sesión, no una certificación de laboratorio. Las cotizaciones, mapas externos y disponibilidad de proveedores requieren conexión y verificación en la fuente.</p>`;
  }

  function route(action){
    const mappings={home:'#travelAssistant',dna:'#ascOSLauncher',trips:'#ascTripCommandCenter',stays:'#smartStaysPanel',opportunities:'#opportunityImportPanel'};
    if(action==='health'){ openHealth(); return; }
    if(action==='install'){ if(installPrompt){ installPrompt.prompt(); installPrompt=null; } return; }
    if(action==='dna'){ document.querySelector('[data-open-dna]')?.click(); return; }
    const target=$(mappings[action]||'#travelAssistant');
    target?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'});
  }

  const actions=[
    ['home','Inicio','Volver al centro de decisión'],['dna','Travel DNA','Editar preferencias personales'],['trips','Trip Command Center','Abrir viajes, watchlist y alertas'],['stays','Estancias','Ir a inteligencia de alojamiento'],['opportunities','Oportunidades','Revisar oportunidades importadas'],['health','ASC System Health','Estado, PWA y métricas de sesión'],['install','Instalar Viajes ASC','Disponible cuando el navegador lo permita']
  ];

  function buildPalette(){
    if ($('#ascCommandPalette')) return;
    const d=document.createElement('dialog'); d.id='ascCommandPalette'; d.className='asc-palette';
    d.innerHTML=`<div class="asc-palette__head"><input id="ascPaletteSearch" type="search" placeholder="Search Viajes ASC…" aria-label="Buscar comando"><button type="button" aria-label="Cerrar">×</button></div><div id="ascPaletteList" class="asc-palette__list"></div>`;
    document.body.appendChild(d); $('.asc-palette__head button',d).onclick=()=>d.close();
    $('#ascPaletteSearch',d).addEventListener('input',renderPalette); d.addEventListener('close',()=>$('#ascPaletteSearch',d).value=''); renderPalette();
  }

  function renderPalette(){
    const host=$('#ascPaletteList'), q=($('#ascPaletteSearch')?.value||'').toLowerCase(); if(!host)return;
    const list=actions.filter(([,a,b])=>`${a} ${b}`.toLowerCase().includes(q)).filter(([id])=>id!=='install'||installPrompt);
    host.innerHTML=list.map(([id,a,b])=>`<button class="asc-palette__item" type="button" data-palette-action="${id}"><span><strong>${a}</strong><small>${b}</small></span><small>↵</small></button>`).join('');
    $$('[data-palette-action]',host).forEach(b=>b.onclick=()=>{const id=b.dataset.paletteAction;$('#ascCommandPalette').close();route(id);});
  }

  function openPalette(){ const d=$('#ascCommandPalette'); if(!d)return; d.showModal(); setTimeout(()=>$('#ascPaletteSearch')?.focus(),0); }

  function buildHealth(){
    if ($('#ascHealthDialog')) return;
    const d=document.createElement('dialog');d.id='ascHealthDialog';d.className='asc-palette';d.innerHTML=`<div class="asc-os-head"><div><p>ASC SYSTEM HEALTH</p><h2>Global Quality</h2></div><button class="asc-os-close" type="button" aria-label="Cerrar">×</button></div><div id="ascHealthBody"></div>`;document.body.appendChild(d);$('.asc-os-close',d).onclick=()=>d.close();
  }
  function openHealth(){buildHealth();$('#ascHealthBody').innerHTML=healthHTML();$('#ascHealthDialog').showModal();}

  function buildStatus(){
    if ($('#ascQualityPill')) return; const host=$('#ascOSLauncher')||$('#ascPrimaryNav')||$('.workspace-tabs'); if(!host)return;
    const b=document.createElement('button');b.id='ascQualityPill';b.className='asc-quality-pill';b.type='button';b.setAttribute('aria-live','polite');b.innerHTML='<i></i><span>System Health</span>';b.onclick=openHealth;host.appendChild(b);updateStatus();
  }
  function updateStatus(){const b=$('#ascQualityPill');if(!b)return;b.classList.toggle('is-offline',!navigator.onLine);$('span',b).textContent=navigator.onLine?`System Health · ${swState()}`:'Offline · shell disponible';}

  function keyboard(){document.addEventListener('keydown',e=>{if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault();openPalette();}if(e.key==='Escape'&&$('#ascCommandPalette')?.open)$('#ascCommandPalette').close();});}

  function init(){
    addHeadAssets(); styles(); observePerformance(); buildPalette(); buildStatus(); keyboard(); registerPWA();
    addEventListener('online',updateStatus); addEventListener('offline',updateStatus);
    addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;renderPalette();});
    window.ASCWebVitals=metrics; window.ASCGlobalQuality={openPalette,openHealth,metrics};
    dispatchEvent(new CustomEvent('viajes:global-quality-ready',{detail:{pwa:true,commandPalette:true}}));
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
