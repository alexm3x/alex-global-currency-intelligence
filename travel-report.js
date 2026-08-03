(() => {
  const DATA_URL = 'viajes/viajes_data.json';
  const PDF_URL = 'viajes/Viajes_ASC_Resumen_Ejecutivo.pdf.b64';
  const REFRESH_MS = 15 * 60 * 1000;
  let currentData = null;

  const moneyMXN = value => new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: 'MXN', maximumFractionDigits: 0
  }).format(Number(value) || 0);

  const moneyUSD = value => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', maximumFractionDigits: 0
  }).format(Number(value) || 0);

  const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, char => ({
    '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;'
  }[char]));

  function injectStyles() {
    if (document.getElementById('travelCss')) return;
    const style = document.createElement('style');
    style.id = 'travelCss';
    style.textContent = `
      .travel-status{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;border-block:1px solid var(--rule);padding:11px 0;margin-bottom:22px;font-size:11px;text-transform:uppercase}
      .travel-actions{display:flex;gap:8px;flex-wrap:wrap}
      .travel-actions button{padding:9px 12px;border:1px solid var(--ink);background:var(--ink);color:var(--paper);cursor:pointer}
      .travel-actions .secondary{background:transparent;color:var(--ink)}
      .travel-hero{display:grid;grid-template-columns:1.5fr .8fr;gap:28px;border-top:5px solid var(--ink);padding-top:18px}
      .travel-hero h2{font:700 50px/1.02 "Source Serif 4",serif;margin:8px 0 12px}
      .travel-dek{font:18px/1.5 "Source Serif 4",serif;color:var(--muted)}
      .travel-kpis{display:grid;grid-template-columns:1fr 1fr;gap:1px;background:var(--rule);border:1px solid var(--rule)}
      .travel-kpi{background:var(--paper);padding:15px}
      .travel-kpi span{font-size:9px;text-transform:uppercase;color:var(--muted)}
      .travel-kpi strong{display:block;font:700 27px "Source Serif 4",serif;margin-top:4px}
      .travel-note{margin-top:16px;padding:13px 15px;border-left:5px solid var(--blue);background:var(--soft);font-size:12px;color:var(--muted)}
      .travel-head{display:flex;justify-content:space-between;align-items:end;gap:18px;border-top:4px solid var(--ink);padding-top:12px;margin-top:36px}
      .travel-head h3{font:700 33px "Source Serif 4",serif;margin:4px 0 10px}
      .travel-head p{max-width:760px;color:var(--muted);font-size:12px}
      .travel-ranking{overflow:auto}
      .travel-rank{display:grid;grid-template-columns:42px 1.1fr 70px 110px 110px 120px 1.5fr;gap:12px;align-items:center;border-top:1px solid var(--rule);padding:14px 7px;font-size:12px;min-width:930px}
      .travel-rank:last-child{border-bottom:1px solid var(--ink)}
      .travel-rank:hover{background:var(--soft)}
      .travel-num,.travel-score{font:700 27px "Source Serif 4",serif}
      .travel-city strong{display:block;font:700 21px "Source Serif 4",serif}
      .travel-city small,.travel-rank small{color:var(--muted)}
      .travel-scorebar{height:5px;background:var(--rule);margin-top:5px;overflow:hidden}
      .travel-scorebar i{display:block;height:100%;background:var(--blue)}
      .travel-budgets{display:grid;grid-template-columns:1fr 1fr;gap:26px}
      .travel-budget{border-top:4px solid var(--ink);padding-top:13px}
      .travel-budget h4{font:700 29px "Source Serif 4",serif;margin:2px 0}
      .travel-budget>p{font-size:12px;color:var(--muted)}
      .travel-row{display:flex;justify-content:space-between;gap:20px;border-top:1px solid var(--rule);padding:10px 0;font-size:12px}
      .travel-row.total{border-top:2px solid var(--ink);font-size:15px}
      .travel-cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:13px}
      .travel-card{border:1px solid var(--rule);padding:15px;min-width:0}
      .travel-card h4{font:700 23px "Source Serif 4",serif;margin:6px 0}
      .travel-card b{font:700 34px "Source Serif 4",serif}
      .travel-card p,.travel-card dd{font-size:11px;color:var(--muted);line-height:1.4}
      .travel-card dt{font-size:9px;text-transform:uppercase;margin-top:8px}
      .travel-card dd{margin:2px 0}
      .travel-method{margin-top:30px;padding:18px;border:1px solid var(--rule);background:var(--soft)}
      .travel-weights{display:grid;grid-template-columns:repeat(5,1fr);gap:10px}
      .travel-weights span{background:var(--paper);border:1px solid var(--rule);padding:10px;font-size:10px}
      .travel-weights b{display:block;font:700 25px "Source Serif 4",serif}
      .travel-error{padding:25px;border:1px solid var(--rule);background:var(--soft)}
      @media(max-width:1180px){.travel-cards{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:900px){.travel-cards{grid-template-columns:1fr 1fr}.travel-rank{grid-template-columns:36px 1fr 65px 100px 100px}.travel-rank>*:nth-child(6),.travel-rank>*:nth-child(7){display:none}.travel-weights{grid-template-columns:repeat(3,1fr)}}
      @media(max-width:700px){.travel-hero,.travel-budgets{grid-template-columns:1fr}.travel-hero h2{font-size:39px}.travel-cards{grid-template-columns:1fr}.travel-weights{grid-template-columns:1fr 1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureShell() {
    const nav = document.querySelector('.main-nav');
    if (nav && !nav.querySelector('[data-view="travel"]')) {
      const button = document.createElement('button');
      button.dataset.view = 'travel';
      button.textContent = 'Viajes ASC';
      const briefingButton = nav.querySelector('[data-view="briefing"]');
      nav.insertBefore(button, briefingButton || null);
      button.addEventListener('click', () => {
        if (typeof setView === 'function') setView('travel');
      });
    }

    let section = document.getElementById('travel');
    if (!section) {
      section = document.createElement('section');
      section.id = 'travel';
      section.className = 'view';
      section.innerHTML = '<p>Cargando Viajes ASC...</p>';
      document.querySelector('main')?.appendChild(section);
    }
    return section;
  }

  function budgetRows(profile) {
    const items = [
      ['flight','Vuelo'], ['hotel','Hotel'], ['food','Comidas'],
      ['transport','Transporte'], ['experiences','Experiencias'], ['contingency','Contingencia']
    ];
    return items.map(([key,label]) => `
      <div class="travel-row">
        <span>${label}</span>
        <strong>${moneyMXN(profile[key]?.total_mxn)}</strong>
      </div>`).join('');
  }

  function render(data) {
    currentData = data;
    const section = ensureShell();
    const active = data.weekly_destination || {};
    const rates = data.exchange_rates || {};
    const tourist = data.profiles?.tourist || {};
    const business = data.profiles?.business || {};
    const ranking = data.opportunity_rankings?.destinations || [];
    const weights = data.opportunity_rankings?.methodology?.weights || {};
    const updated = new Intl.DateTimeFormat('es-MX', {
      dateStyle: 'long', timeStyle: 'short', timeZone: 'America/Mexico_City'
    }).format(new Date(data.meta.last_updated));

    section.innerHTML = `
      <div class="page-head">
        <p class="rubric">VIAJES ASC · INTELIGENCIA TURÍSTICA FINANCIERA</p>
        <h2>Top 10 global de oportunidades</h2>
        <p>Calidad mundial, precio-dólar, valor hotelero, tarifa aérea y conectividad desde México.</p>
      </div>

      <div class="travel-status">
        <span><b>Actualización automática</b> · ${escapeHtml(updated)} · ${ranking.length} destinos</span>
        <div class="travel-actions">
          <button id="travelRefresh" type="button">Actualizar</button>
          <button class="secondary" id="travelPdf" type="button">Abrir PDF</button>
        </div>
      </div>

      <section class="travel-hero">
        <div>
          <p class="rubric">DESTINO SEMANAL ACTIVO</p>
          <h2>${escapeHtml(active.city)}, ${escapeHtml(active.country)}</h2>
          <p class="travel-dek">${escapeHtml(active.why_now)}</p>
          <div class="travel-note">
            <b>${data.daily_deals?.length ? 'Oportunidades activas' : 'Sin cambio accionable'}</b><br>
            ${escapeHtml(data.monitoring?.notes)}
          </div>
        </div>
        <aside class="travel-kpis">
          <div class="travel-kpi"><span>Ranking global #1</span><strong>${escapeHtml(ranking[0]?.city || '—')}</strong></div>
          <div class="travel-kpi"><span>Vuelo Turista activo</span><strong>${moneyMXN(tourist.flight?.total_mxn)}</strong></div>
          <div class="travel-kpi"><span>Total Turista</span><strong>${moneyMXN(tourist.total_mxn)}</strong></div>
          <div class="travel-kpi"><span>Total Business</span><strong>${moneyMXN(business.total_mxn)}</strong></div>
          <div class="travel-kpi"><span>Tipo de cambio</span><strong>${Number(rates.mxn_to_local || 0).toLocaleString('es-MX',{maximumFractionDigits:2})} ${escapeHtml(rates.local_currency_code)}</strong></div>
          <div class="travel-kpi"><span>Alertas confirmadas</span><strong>${data.daily_deals?.length || 0}</strong></div>
        </aside>
      </section>

      <div class="travel-head">
        <div><p class="rubric">ÍNDICE ASC</p><h3>Ranking global Top 10</h3></div>
        <p>${escapeHtml(data.opportunity_rankings?.methodology?.note)}</p>
      </div>

      <div class="travel-ranking">
        ${ranking.map(item => `
          <article class="travel-rank">
            <div class="travel-num">${String(item.rank).padStart(2,'0')}</div>
            <div class="travel-city">
              <strong>${escapeHtml(item.city)}</strong>
              <small>${escapeHtml(item.country)} · ${escapeHtml(item.global_reference)}</small>
            </div>
            <div>
              <small>ASC</small>
              <div class="travel-score">${Number(item.asc_score).toFixed(1)}</div>
              <div class="travel-scorebar"><i style="width:${Math.max(0,Math.min(100,Number(item.asc_score)))}%"></i></div>
            </div>
            <div><small>Vuelo MEX</small><strong>${moneyMXN(item.flight_mxn)}</strong></div>
            <div><small>Hotel</small><strong>${moneyUSD(item.hotel_avg_usd)}</strong></div>
            <div><small>Costo base</small><strong>${moneyMXN(item.base_access_mxn)}</strong></div>
            <div>${escapeHtml(item.why)}</div>
          </article>`).join('')}
      </div>

      <div class="travel-head">
        <div><p class="rubric">DESTINO ACTIVO</p><h3>Presupuesto semanal</h3></div>
        <p>Un viajero, siete noches. Tarifas observadas y asignaciones de planeación; no son vinculantes.</p>
      </div>

      <div class="travel-budgets">
        <article class="travel-budget">
          <p class="rubric">TURISTA</p>
          <h4>${escapeHtml(tourist.label)}</h4>
          <p>${escapeHtml(tourist.assumption)}</p>
          ${budgetRows(tourist)}
          <div class="travel-row total"><span>Total</span><strong>${moneyMXN(tourist.total_mxn)}</strong></div>
        </article>
        <article class="travel-budget">
          <p class="rubric">BUSINESS</p>
          <h4>${escapeHtml(business.label)}</h4>
          <p>${escapeHtml(business.assumption)}</p>
          ${budgetRows(business)}
          <div class="travel-row total"><span>Total</span><strong>${moneyMXN(business.total_mxn)}</strong></div>
        </article>
      </div>

      <div class="travel-head">
        <div><p class="rubric">COMPARATIVO</p><h3>Lectura de los 10 destinos</h3></div>
        <p>El orden cambia únicamente con variaciones materiales y verificadas.</p>
      </div>

      <div class="travel-cards">
        ${ranking.map(item => `
          <article class="travel-card">
            <span class="rubric">#${item.rank}</span>
            <h4>${escapeHtml(item.city)}</h4>
            <b>${Number(item.asc_score).toFixed(1)}</b>
            <p>${escapeHtml(item.why)}</p>
            <dl>
              <dt>Moneda</dt><dd>${Number(item.local_per_mxn).toLocaleString('es-MX',{maximumFractionDigits:2})} ${escapeHtml(item.currency)}/MXN</dd>
              <dt>Ruta</dt><dd>${escapeHtml(item.route)}</dd>
              <dt>Tiempo</dt><dd>${escapeHtml(item.time)}</dd>
              <dt>Hotel Turista</dt><dd>${moneyUSD(item.hotel_avg_usd)}/noche</dd>
              <dt>Lujo</dt><dd>${moneyUSD(item.hotel_5star_usd)}/noche</dd>
              <dt>Riesgo</dt><dd>${escapeHtml(item.risk)}</dd>
            </dl>
          </article>`).join('')}
      </div>

      <article class="travel-method">
        <p class="rubric">METODOLOGÍA</p>
        <h3>${escapeHtml(data.opportunity_rankings?.methodology?.name)}</h3>
        <div class="travel-weights">
          <span><b>${weights.global_quality_importance_pct || 0}%</b>Calidad global</span>
          <span><b>${weights.fx_dollar_opportunity_pct || 0}%</b>Oportunidad FX</span>
          <span><b>${weights.hotel_value_pct || 0}%</b>Valor hotelero</span>
          <span><b>${weights.airfare_value_pct || 0}%</b>Tarifa aérea</span>
          <span><b>${weights.connectivity_from_mexico_pct || 0}%</b>Conectividad</span>
        </div>
      </article>`;

    section.querySelector('#travelRefresh')?.addEventListener('click', () => load(true));
    section.querySelector('#travelPdf')?.addEventListener('click', openPdf);
  }

  async function openPdf() {
    const button = document.getElementById('travelPdf');
    const original = button?.textContent || 'Abrir PDF';
    if (button) { button.disabled = true; button.textContent = 'Preparando...'; }
    try {
      const response = await fetch(`${PDF_URL}?t=${Date.now()}`, {cache:'no-store'});
      if (!response.ok) throw new Error(`PDF HTTP ${response.status}`);
      const binary = atob((await response.text()).trim());
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
      const objectUrl = URL.createObjectURL(new Blob([bytes], {type:'application/pdf'}));
      window.open(objectUrl, '_blank', 'noopener');
      setTimeout(() => URL.revokeObjectURL(objectUrl), 120000);
    } catch (error) {
      console.error('Viajes ASC PDF error:', error);
      alert('El PDF no está disponible temporalmente.');
    } finally {
      if (button) { button.disabled = false; button.textContent = original; }
    }
  }

  async function load(force = false) {
    const section = ensureShell();
    try {
      const suffix = force ? `?t=${Date.now()}` : '';
      const response = await fetch(`${DATA_URL}${suffix}`, {cache:'no-store'});
      if (!response.ok) throw new Error(`JSON HTTP ${response.status}`);
      const data = await response.json();
      if (!Array.isArray(data.opportunity_rankings?.destinations) ||
          data.opportunity_rankings.destinations.length !== 10) {
        throw new Error('El archivo Viajes ASC no contiene 10 destinos');
      }
      render(data);
    } catch (error) {
      console.error('Viajes ASC data error:', error);
      if (!currentData) {
        section.innerHTML = `
          <div class="travel-error">
            <h2>Viajes ASC no disponible</h2>
            <p>No fue posible cargar la actualización. Recargue la página o intente nuevamente.</p>
          </div>`;
      }
    }
  }

  injectStyles();
  ensureShell();
  load(true);

  setInterval(() => {
    if (document.visibilityState === 'visible') load(true);
  }, REFRESH_MS);

  window.addEventListener('online', () => load(true));
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') load(true);
  });
})();