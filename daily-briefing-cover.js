(() => {
  const REPORT = {
    date: '1 de agosto de 2026',
    title: 'Participar con selectividad: rentabilidad, liquidez y resiliencia antes que narrativa',
    dek: 'El entorno favorece decisiones disciplinadas: inteligencia artificial con beneficios verificables, crecimiento industrial mexicano con filtros de calidad, energía sensible a tasas y geopolítica, y activos inmobiliarios capaces de soportar refinanciamiento más caro.',
    stance: 'Selectivo',
    risk: 'Elevado',
    horizon: '1–12 meses',
    briefs: [
      {kicker:'MERCADOS E INVERSIÓN',title:'La calidad de utilidades importa más que el entusiasmo',text:'Priorizar empresas con flujo de caja, capacidad de fijación de precios y balances sólidos. Evitar pagar múltiplos extremos por crecimiento todavía no demostrado.'},
      {kicker:'MÉXICO Y NEGOCIOS',title:'El crecimiento industrial sigue ofreciendo oportunidades, pero no todas son iguales',text:'La demanda vinculada con manufactura, logística, energía e infraestructura favorece proyectos con contratos visibles, ubicación estratégica y disciplina financiera.'},
      {kicker:'IA Y TECNOLOGÍA',title:'La siguiente fase exige monetización, no solo adopción',text:'Buscar proveedores con ingresos recurrentes, ahorro medible para clientes, seguridad de datos y ventajas difíciles de replicar.'},
      {kicker:'MACRO Y GEOPOLÍTICA',title:'Tasas, petróleo y conflictos siguen definiendo la prima de riesgo',text:'Mantener liquidez y coberturas suficientes para reaccionar a sorpresas de inflación, política monetaria, comercio y escalamiento geopolítico.'}
    ],
    decisions: [
      {label:'CARTERA',title:'Aumentar calidad, no concentración',text:'Favorecer posiciones diversificadas con flujo de caja y limitar exposiciones cuyo caso dependa de una sola narrativa.'},
      {label:'INMOBILIARIO',title:'Probar cada activo contra refinanciamiento caro',text:'Revisar cobertura de deuda, vencimientos, ocupación, rentas reales y necesidades futuras de capital.'},
      {label:'NEGOCIOS',title:'Invertir donde exista demanda verificable',text:'Priorizar proyectos con contratos, clientes recurrentes o ahorros demostrables; retrasar expansiones apoyadas solo en expectativas.'},
      {label:'RIESGO',title:'Conservar capacidad de reacción',text:'Mantener reservas de liquidez, límites por posición y señales claras para reducir exposición.'}
    ],
    sections: [
      {title:'1. Mercados e inversiones',body:'La oportunidad sigue siendo real, pero está concentrada en activos capaces de convertir crecimiento en flujo de caja. La dispersión entre ganadores y perdedores puede aumentar conforme el costo de capital obliga al mercado a distinguir entre promesas y resultados.',why:'La expansión de múltiplos sin mejora proporcional en beneficios reduce el margen de seguridad.',implication:'Mantener exposición selectiva a crecimiento rentable, combinarla con liquidez y activos defensivos, y evitar posiciones sobredimensionadas.',opportunity:'Empresas con márgenes resistentes, balances fuertes y demanda estructural.',risk:'Inflación persistente, tasas más altas durante más tiempo y decepciones de utilidades.',signal:'Revisiones de beneficios, spreads de crédito, liquidez y amplitud del mercado.'},
      {title:'2. Bienes raíces y negocios',body:'Los activos inmobiliarios deben evaluarse por su capacidad de producir efectivo después de deuda, mantenimiento y nuevas inversiones. Las oportunidades más sólidas se concentran en ubicaciones con demanda verificable y estructuras financieras capaces de absorber refinanciamientos más caros.',why:'Una buena narrativa de ubicación no compensa un calendario de deuda débil o una ocupación frágil.',implication:'Elevar el estándar de cobertura, exigir escenarios de estrés y separar apreciación potencial de rentabilidad operativa.',opportunity:'Logística, industrial y activos con contratos estables y barreras de entrada.',risk:'Vacancia, renovación costosa, cap rates al alza y deuda de corto plazo.',signal:'Absorción, renovaciones, costo de deuda y capex pendiente.'},
      {title:'3. Inteligencia artificial y tecnología',body:'La inversión tecnológica entra en una fase donde el mercado pedirá productividad, ingresos y ahorro cuantificable. La adopción seguirá creciendo, pero el valor económico se concentrará en plataformas y proveedores que resuelvan problemas concretos.',why:'El gasto en infraestructura puede crecer antes de que todos los modelos de negocio demuestren rentabilidad.',implication:'Distinguir habilitadores rentables de aplicaciones fácilmente sustituibles y vigilar concentración de clientes y proveedores.',opportunity:'Automatización empresarial, ciberseguridad, datos y herramientas con retorno medible.',risk:'Comoditización, regulación, dependencia tecnológica y presión en márgenes.',signal:'Ingresos recurrentes, retención, costo por inferencia y productividad del cliente.'},
      {title:'4. México y entorno global',body:'México conserva ventajas de integración industrial y proximidad con Estados Unidos, pero la selección debe incorporar energía, agua, infraestructura, seguridad y certidumbre regulatoria. Asia y Europa presentan oportunidades diferenciadas, mientras petróleo y conflictos continúan afectando inflación y monedas.',why:'La competitividad industrial puede coexistir con cuellos de botella que reduzcan retornos.',implication:'Favorecer proyectos con infraestructura disponible, contratos sólidos y sensibilidad controlada a política comercial y tipo de cambio.',opportunity:'Manufactura avanzada, logística, energía e infraestructura vinculada con cadenas regionales.',risk:'Cambios comerciales, restricciones de capacidad, volatilidad cambiaria y tensiones geopolíticas.',signal:'Inversión fija, exportaciones, anuncios de capacidad, energía y decisiones comerciales.'}
    ],
    watch: ['Inflación y mensajes de bancos centrales','Revisiones de utilidades y flujo de caja','Petróleo, transporte y primas geopolíticas','Condiciones de crédito y refinanciamiento','Inversión industrial y exportaciones de México','Monetización real de proyectos de IA']
  };

  function injectStylesheet() {
    if (document.querySelector('link[href="daily-briefing-cover.css"]')) return;
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'daily-briefing-cover.css';
    document.head.appendChild(link);
  }

  function buildFront() {
    const home = document.getElementById('home');
    if (!home || document.getElementById('dailyStrategicFront')) return;
    const front = document.createElement('section');
    front.id = 'dailyStrategicFront';
    front.className = 'strategic-front';
    front.innerHTML = `
      <div class="strategic-front__label"><strong>DAILY STRATEGIC BRIEFING</strong><span>${REPORT.date} · Ciudad de México · Lectura ejecutiva</span></div>
      <div class="strategic-front__grid">
        <article class="strategic-front__lead">
          <p class="rubric">EXECUTIVE VIEW</p>
          <h2>${REPORT.title}</h2>
          <p class="strategic-front__dek">${REPORT.dek}</p>
          <div class="strategic-front__actions"><button data-jump="briefing">Leer informe completo</button><button class="secondary" data-jump="opportunities">Ver oportunidades</button></div>
          <div class="strategic-front__briefs">${REPORT.briefs.map(x=>`<article class="strategic-brief"><span>${x.kicker}</span><h3>${x.title}</h3><p>${x.text}</p></article>`).join('')}</div>
        </article>
        <aside class="decision-rail">
          <h3>Decision Panel</h3>
          <div class="decision-meter"><div><small>Postura</small><strong>${REPORT.stance}</strong></div><div><small>Riesgo</small><strong>${REPORT.risk}</strong></div><div><small>Horizonte</small><strong>${REPORT.horizon}</strong></div></div>
          ${REPORT.decisions.map(x=>`<article class="decision-item"><span>${x.label}</span><b>${x.title}</b><p>${x.text}</p></article>`).join('')}
        </aside>
      </div>`;
    const label = home.querySelector('.section-label');
    if (label) label.insertAdjacentElement('afterend', front); else home.prepend(front);
    front.querySelectorAll('[data-jump]').forEach(btn=>btn.addEventListener('click',()=>typeof setView==='function'&&setView(btn.dataset.jump)));
  }

  function buildFullBriefing() {
    const section = document.getElementById('briefing');
    if (!section) return;
    section.innerHTML = `<article class="briefing-full">
      <header class="briefing-full__header"><p class="rubric">DAILY STRATEGIC BRIEFING · ${REPORT.date}</p><h2>${REPORT.title}</h2><p class="standfirst">${REPORT.dek}</p></header>
      <div class="briefing-full__body"><div>${REPORT.sections.map(s=>`<section class="briefing-section"><h3>${s.title}</h3><p>${s.body}</p><h4>Por qué importa</h4><p>${s.why}</p><h4>Implicación de inversión</h4><p>${s.implication}</p><h4>Oportunidad</h4><p>${s.opportunity}</p><h4>Riesgo principal</h4><p>${s.risk}</p><h4>Próximas señales</h4><p>${s.signal}</p></section>`).join('')}</div>
      <aside class="briefing-watch"><h3>Actions & Watchlist</h3>${REPORT.decisions.map(x=>`<article class="decision-item"><span>${x.label}</span><b>${x.title}</b><p>${x.text}</p></article>`).join('')}<h3>Señales inmediatas</h3><ol>${REPORT.watch.map(x=>`<li>${x}</li>`).join('')}</ol><p class="briefing-note">Informe estratégico para apoyar decisiones integrales. No sustituye análisis financiero, fiscal, legal o de inversión específico.</p></aside></div>
    </article>`;
  }

  document.addEventListener('DOMContentLoaded',()=>{injectStylesheet();buildFront();buildFullBriefing();});
})();