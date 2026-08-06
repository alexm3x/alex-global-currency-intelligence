(() => {
  const STORAGE_KEY = 'viajes-asc:planner-preferences';
  const AIRPORTS = {
    'Seúl':'ICN','Bangkok':'BKK','Estambul':'IST','Tokio':'NRT','Madrid':'MAD',
    'Buenos Aires':'EZE','Ciudad del Cabo':'CPT','El Cairo':'CAI','Marrakech':'RAK','Lisboa':'LIS'
  };
  const TYPES = {
    'Seúl':['urbano'],
    'Bangkok':['urbano','playa','crucero'],
    'Estambul':['urbano','crucero'],
    'Tokio':['urbano','crucero'],
    'Madrid':['urbano'],
    'Buenos Aires':['urbano','crucero'],
    'Ciudad del Cabo':['playa','crucero'],
    'El Cairo':['urbano','crucero'],
    'Marrakech':['urbano'],
    'Lisboa':['urbano','playa','crucero']
  };
  const BUDGETS = {
    moderado:{label:'Moderado',cap:60000,hotel:'3 estrellas o boutique',cabin:'economy'},
    premium:{label:'Premium',cap:120000,hotel:'4–5 estrellas',cabin:'premium economy'},
    lujo:{label:'Lujo',cap:250000,hotel:'5 estrellas',cabin:'business'},
    ultra:{label:'Ultra lujo',cap:Infinity,hotel:'lujo superior',cabin:'business'}
  };

  const escPlanner = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[char]));

  function injectPlannerStyles(){
    if(document.getElementById('plannerStyles')) return;
    const style=document.createElement('style');
    style.id='plannerStyles';
    style.textContent=`
      .planner-shell{margin-bottom:28px;background:linear-gradient(135deg,var(--surface),color-mix(in srgb,var(--surface) 82%,var(--blue)));border:1px solid var(--line);box-shadow:var(--shadow);overflow:hidden}
      .planner-header{display:grid;grid-template-columns:1.3fr .7fr;gap:24px;padding:30px;border-bottom:1px solid var(--line)}
      .planner-header h2{font-size:38px;margin:6px 0 10px}.planner-header p{margin:0;color:var(--muted);line-height:1.55}.planner-badge{align-self:center;justify-self:end;border:1px solid var(--line);padding:13px 16px;text-align:right}.planner-badge span{display:block;font-size:9px;text-transform:uppercase;color:var(--muted)}.planner-badge strong{font-family:"Playfair Display",Georgia,serif;font-size:24px}
      .planner-form{display:grid;grid-template-columns:1fr 1fr 1fr auto;gap:14px;padding:24px 30px;align-items:end}.planner-field{display:grid;gap:7px}.planner-field label{font-size:11px;font-weight:700}.planner-field select,.planner-field input{width:100%;padding:12px;border:1px solid var(--line);background:var(--paper);color:var(--ink);font:inherit}.planner-submit{padding:13px 17px;border:1px solid var(--ink);background:var(--ink);color:var(--paper);cursor:pointer;font-weight:700;white-space:nowrap}
      .planner-foot{display:flex;justify-content:space-between;gap:16px;align-items:center;padding:0 30px 22px;font-size:11px;color:var(--muted)}.planner-reset{border:0;background:none;color:var(--blue);font-weight:700;cursor:pointer}
      .planner-results{padding:0 30px 30px}.planner-results[hidden]{display:none}.planner-result-head{display:flex;justify-content:space-between;gap:20px;align-items:end;border-top:4px solid var(--ink);padding-top:13px;margin-top:5px}.planner-result-head h3{font-size:31px;margin:4px 0}.planner-result-head p{max-width:680px;color:var(--muted);font-size:12px}.planner-recs{display:grid;grid-template-columns:repeat(3,1fr);gap:15px}.planner-rec{background:var(--surface);border:1px solid var(--line);padding:20px;position:relative}.planner-rec .rec-rank{font-family:"Playfair Display",Georgia,serif;font-size:42px;color:var(--gold)}.planner-rec h4{font-size:27px;margin:2px 0 8px}.planner-rec p{font-size:12px;line-height:1.5;color:var(--muted)}.planner-rec-metrics{display:grid;grid-template-columns:repeat(2,1fr);gap:1px;background:var(--line);margin:15px 0}.planner-rec-metrics div{background:var(--surface);padding:10px}.planner-rec-metrics span{display:block;font-size:8px;text-transform:uppercase;color:var(--muted)}.planner-rec-metrics strong{font-size:13px}.fx-light{display:inline-flex;gap:6px;align-items:center;font-size:10px;font-weight:700;text-transform:uppercase}.fx-light i{width:9px;height:9px;border-radius:50%;display:block}.fx-green i{background:#198754}.fx-amber i{background:#d69e16}.fx-red i{background:#b83a3a}.planner-links{display:flex;gap:8px;flex-wrap:wrap}.planner-links a{padding:9px 10px;border:1px solid var(--ink);color:var(--ink);text-decoration:none;font-size:10px;font-weight:700}.planner-links a.primary-link{background:var(--ink);color:var(--paper)}
      .planner-empty{padding:18px;border:1px dashed var(--line);color:var(--muted)}
      @media(max-width:1000px){.planner-form{grid-template-columns:1fr 1fr}.planner-submit{width:100%}.planner-recs{grid-template-columns:1fr 1fr}}
      @media(max-width:700px){.planner-header{grid-template-columns:1fr;padding:23px}.planner-badge{justify-self:start;text-align:left}.planner-form{grid-template-columns:1fr;padding:20px 23px}.planner-foot{padding:0 23px 20px;align-items:flex-start;flex-direction:column}.planner-results{padding:0 23px 23px}.planner-result-head{align-items:flex-start;flex-direction:column}.planner-recs{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function createPlanner(){
    const overview=document.getElementById('overview');
    const hero=document.getElementById('hero');
    if(!overview || !hero || document.getElementById('travelPlanner')) return;
    const section=document.createElement('section');
    section.id='travelPlanner';
    section.className='planner-shell';
    section.innerHTML=`
      <div class="planner-header">
        <div>
          <span class="eyebrow">ESTRATEGIA PERSONALIZADA</span>
          <h2>Antes de recomendarte un viaje</h2>
          <p>Responde tres preguntas. Viajes ASC combinará presupuesto, temporada, estilo de viaje, conectividad y ventaja cambiaria para priorizar las mejores opciones.</p>
        </div>
        <div class="planner-badge"><span>Origen predeterminado</span><strong>Ciudad de México · MEX/AIFA</strong></div>
      </div>
      <form id="plannerForm" class="planner-form">
        <div class="planner-field">
          <label for="plannerBudget">¿Cuál es el presupuesto o nivel de lujo?</label>
          <select id="plannerBudget" required>
            <option value="moderado">Moderado · hasta MXN 60,000</option>
            <option value="premium">Premium · MXN 60,000–120,000</option>
            <option value="lujo">Lujo · MXN 120,000–250,000</option>
            <option value="ultra">Ultra lujo · más de MXN 250,000</option>
          </select>
        </div>
        <div class="planner-field">
          <label for="plannerMonth">¿Qué fechas o mes tienes en mente?</label>
          <input id="plannerMonth" type="month" required>
        </div>
        <div class="planner-field">
          <label for="plannerStyle">¿Qué tipo de viaje prefieres?</label>
          <select id="plannerStyle" required>
            <option value="urbano">Destino urbano</option>
            <option value="playa">Playa o naturaleza</option>
            <option value="crucero">Crucero</option>
          </select>
        </div>
        <button class="planner-submit" type="submit">Generar estrategia</button>
      </form>
      <div class="planner-foot"><span>Las recomendaciones usan la edición vigente y enlaces externos de búsqueda. Las tarifas finales deben confirmarse.</span><button id="plannerReset" class="planner-reset" type="button">Restablecer preferencias</button></div>
      <div id="plannerResults" class="planner-results" hidden></div>`;
    overview.insertBefore(section,hero);

    const saved=readPreferences();
    if(saved){
      section.querySelector('#plannerBudget').value=saved.budget;
      section.querySelector('#plannerMonth').value=saved.month;
      section.querySelector('#plannerStyle').value=saved.style;
    } else {
      const nextMonth=new Date();
      nextMonth.setMonth(nextMonth.getMonth()+2);
      section.querySelector('#plannerMonth').value=`${nextMonth.getFullYear()}-${String(nextMonth.getMonth()+1).padStart(2,'0')}`;
    }

    section.querySelector('#plannerForm').addEventListener('submit',event=>{
      event.preventDefault();
      const preferences={
        budget:section.querySelector('#plannerBudget').value,
        month:section.querySelector('#plannerMonth').value,
        style:section.querySelector('#plannerStyle').value
      };
      localStorage.setItem(STORAGE_KEY,JSON.stringify(preferences));
      renderRecommendations(preferences);
    });
    section.querySelector('#plannerReset').addEventListener('click',()=>{
      localStorage.removeItem(STORAGE_KEY);
      section.querySelector('#plannerBudget').value='moderado';
      section.querySelector('#plannerStyle').value='urbano';
      section.querySelector('#plannerResults').hidden=true;
    });

    const nav=document.querySelector('.main-nav');
    if(nav && !nav.querySelector('[data-planner]')){
      const button=document.createElement('button');
      button.type='button';
      button.dataset.planner='true';
      button.textContent='Planificador';
      nav.insertBefore(button,nav.firstChild);
      button.addEventListener('click',()=>{
        if(typeof setView==='function') setView('overview');
        setTimeout(()=>section.scrollIntoView({behavior:'smooth',block:'start'}),150);
      });
    }

    if(saved) setTimeout(()=>renderRecommendations(saved),400);
  }

  function readPreferences(){
    try{
      const value=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');
      return value && value.budget && value.month && value.style ? value : null;
    }catch{return null;}
  }

  function monthLabel(value){
    if(!value) return 'fecha flexible';
    const [year,month]=value.split('-').map(Number);
    return new Intl.DateTimeFormat('es-MX',{month:'long',year:'numeric'}).format(new Date(year,month-1,1));
  }

  function fxSignal(item){
    const score=Number(item.fx_score ?? 50);
    if(score>=85) return {label:'Verde · ventaja cambiaria alta',className:'fx-green',points:8};
    if(score>=70) return {label:'Ámbar · ventaja moderada',className:'fx-amber',points:3};
    return {label:'Rojo · moneda relativamente fuerte',className:'fx-red',points:-4};
  }

  function preferenceBonus(item,style){
    const types=TYPES[item.city]||['urbano'];
    return types.includes(style)?12:-7;
  }

  function budgetCost(item,budget){
    if(budget==='moderado') return Number(item.base_access_mxn||0);
    return Number(item.flight_mxn||0)+(Number(item.hotel_5star_mxn||0)*7);
  }

  function budgetBonus(item,budget){
    const cost=budgetCost(item,budget);
    const cap=BUDGETS[budget].cap;
    if(!Number.isFinite(cap)) return 5;
    if(cost<=cap*.75) return 10;
    if(cost<=cap) return 5;
    if(cost<=cap*1.2) return -3;
    return -12;
  }

  function destinationQuery(item,preferences,business=false){
    const airport=AIRPORTS[item.city]||'';
    const cabin=business?'business class':BUDGETS[preferences.budget].cabin;
    return encodeURIComponent(`Flights from MEX or NLU to ${airport} ${item.city} ${monthLabel(preferences.month)} ${cabin}`);
  }

  function hotelQuery(item,preferences){
    return encodeURIComponent(`${item.city} ${BUDGETS[preferences.budget].hotel} ${monthLabel(preferences.month)}`);
  }

  function renderRecommendations(preferences){
    const results=document.getElementById('plannerResults');
    if(!results) return;
    if(typeof dataCache==='undefined' || !dataCache?.opportunity_rankings?.destinations){
      results.hidden=false;
      results.innerHTML='<div class="planner-empty">Los datos del ranking todavía están cargando. Presiona “Generar estrategia” nuevamente en unos segundos.</div>';
      return;
    }
    const ranked=dataCache.opportunity_rankings.destinations.map(item=>{
      const signal=fxSignal(item);
      const score=Number(item.asc_score||0)+preferenceBonus(item,preferences.style)+budgetBonus(item,preferences.budget)+signal.points;
      return {...item,personalScore:score,signal,personalCost:budgetCost(item,preferences.budget)};
    }).sort((a,b)=>b.personalScore-a.personalScore).slice(0,3);

    results.hidden=false;
    results.innerHTML=`
      <div class="planner-result-head">
        <div><span class="eyebrow">RESULTADO PERSONALIZADO</span><h3>Tus tres mejores opciones</h3></div>
        <p>${escPlanner(BUDGETS[preferences.budget].label)} · ${escPlanner(monthLabel(preferences.month))} · ${preferences.style==='urbano'?'viaje urbano':preferences.style==='playa'?'playa o naturaleza':'crucero'}.</p>
      </div>
      <div class="planner-recs">${ranked.map((item,index)=>{
        const airport=AIRPORTS[item.city]||item.city;
        const flights=`https://www.google.com/travel/flights?q=${destinationQuery(item,preferences,false)}`;
        const business=`https://www.google.com/travel/flights?q=${destinationQuery(item,preferences,true)}`;
        const hotels=`https://www.google.com/travel/hotels/${encodeURIComponent(item.city)}?q=${hotelQuery(item,preferences)}`;
        return `<article class="planner-rec">
          <div class="rec-rank">0${index+1}</div>
          <span class="fx-light ${item.signal.className}"><i></i>${escPlanner(item.signal.label)}</span>
          <h4>${escPlanner(item.city)}</h4>
          <p>${escPlanner(item.why)}</p>
          <div class="planner-rec-metrics">
            <div><span>Índice ASC</span><strong>${Number(item.asc_score).toFixed(1)}</strong></div>
            <div><span>Base estimada</span><strong>${mxn(item.personalCost)}</strong></div>
            <div><span>Ruta</span><strong>MEX/AIFA–${escPlanner(airport)}</strong></div>
            <div><span>Hotel</span><strong>${usd(preferences.budget==='moderado'?item.hotel_avg_usd:item.hotel_5star_usd)}</strong></div>
          </div>
          <div class="planner-links">
            <a class="primary-link" href="${flights}" target="_blank" rel="noopener noreferrer">Vuelos Turista</a>
            <a href="${business}" target="_blank" rel="noopener noreferrer">Vuelos Business</a>
            <a href="${hotels}" target="_blank" rel="noopener noreferrer">Hoteles</a>
          </div>
        </article>`;
      }).join('')}</div>`;
    results.scrollIntoView({behavior:'smooth',block:'start'});
  }

  injectPlannerStyles();
  createPlanner();
})();
