(() => {
  const WORKER_URL = 'https://agci-market-data.proadmexico.workers.dev/';
  const TOP20_ECONOMIES = new Set([
    'Estados Unidos','China','Alemania','Japón','India','Reino Unido','Francia','Italia',
    'Brasil','Canadá','Rusia','Corea del Sur','Australia','España','México','Indonesia',
    'Turquía','Países Bajos','Arabia Saudita','Suiza'
  ]);

  const nav = document.querySelector('.main-nav');
  if (nav && !nav.querySelector('[data-view="opportunities"]')) {
    const button = document.createElement('button');
    button.dataset.view = 'opportunities';
    button.textContent = 'Oportunidades';
    nav.insertBefore(button, nav.querySelector('[data-view="briefing"]'));
    button.addEventListener('click', () => setView('opportunities'));
  }

  const section = document.createElement('section');
  section.id = 'opportunities';
  section.className = 'view';
  section.innerHTML = `
    <div class="page-head">
      <p class="rubric">AGCI BUY OPPORTUNITIES</p>
      <h2>Top 5 monedas frente al dólar</h2>
      <p>Monedas de economías elegibles del universo Top 20, clasificadas por convicción AGCI, momentum y confirmación de mercado.</p>
    </div>
    <div class="opportunity-disclaimer">
      <strong>Modelo de oportunidad, no recomendación personalizada.</strong>
      Las cotizaciones conectadas se actualizan aproximadamente cada seis horas. Los componentes macroeconómicos del AGCI Score continúan en fase de integración.
    </div>
    <div class="opportunity-meta" id="opportunityMeta">Cargando confirmación de mercado…</div>
    <div class="opportunity-grid" id="opportunityGrid"></div>
    <article class="opportunity-method">
      <div>
        <p class="rubric">SELECTION ENGINE</p>
        <h3>Cómo se seleccionan</h3>
      </div>
      <div class="opportunity-formula">
        <span><b>70%</b> AGCI Score</span>
        <span><b>20%</b> Momentum</span>
        <span><b>10%</b> Movimiento frente a USD</span>
      </div>
      <p>Se excluye el dólar, se elimina la duplicidad de monedas compartidas y se selecciona una sola representación por código monetario. Una señal positiva de mercado mejora la confirmación; una señal negativa la reduce, sin sustituir la valoración y los fundamentos.</p>
    </article>`;
  document.querySelector('main').appendChild(section);

  function marketMoveVsUsd(quote) {
    if (!quote || !Number.isFinite(Number(quote.percentChange))) return null;
    const move = Number(quote.percentChange);
    return quote.symbol.endsWith('/USD') ? move : -move;
  }

  function uniqueEligibleCurrencies() {
    const byCode = new Map();
    DATA.filter(d => TOP20_ECONOMIES.has(d.country) && d.code !== 'USD').forEach(d => {
      const current = byCode.get(d.code);
      if (!current || d.score > current.score) byCode.set(d.code, d);
    });
    return [...byCode.values()];
  }

  function normalizedConfirmation(move) {
    if (move === null) return 50;
    return Math.max(0, Math.min(100, 50 + move * 12.5));
  }

  function render(quotes = [], updatedAt = null, nextUpdateAt = null) {
    const quoteMap = new Map(quotes.map(q => [q.symbol, q]));
    const pairMap = {
      EUR:'EUR/USD', GBP:'GBP/USD', AUD:'AUD/USD', JPY:'USD/JPY', MXN:'USD/MXN',
      BRL:'USD/BRL', CNY:'USD/CNY', INR:'USD/INR', CAD:'USD/CAD', KRW:'USD/KRW',
      IDR:'USD/IDR', TRY:'USD/TRY', CHF:'USD/CHF', SAR:'USD/SAR', RUB:'USD/RUB'
    };

    const ranked = uniqueEligibleCurrencies().map(d => {
      const quote = quoteMap.get(pairMap[d.code]);
      const usdMove = marketMoveVsUsd(quote);
      const confirmation = normalizedConfirmation(usdMove);
      const opportunityScore = d.score * 0.70 + d.momentum * 0.20 + confirmation * 0.10;
      return {...d, quote, usdMove, confirmation, opportunityScore};
    }).sort((a,b) => b.opportunityScore - a.opportunityScore).slice(0,5);

    document.getElementById('opportunityGrid').innerHTML = ranked.map((d,i) => {
      const moveText = d.usdMove === null ? 'Sin cotización conectada' : `${d.usdMove >= 0 ? '+' : ''}${d.usdMove.toFixed(2)}% vs USD`;
      const marketClass = d.usdMove === null ? 'neutral-market' : d.usdMove >= 0 ? 'positive' : 'negative';
      const confidence = d.usdMove === null ? 'Parcial' : d.usdMove >= 0 ? 'Confirmada' : 'En observación';
      return `
        <article class="opportunity-card" data-currency="${d.country}">
          <div class="opportunity-rank">0${i+1}</div>
          <div class="opportunity-head">
            <div><span class="currency-code">${d.code}</span><small>${d.country} · ${d.currency}</small></div>
            <div class="opportunity-score"><span>Opportunity</span><strong>${d.opportunityScore.toFixed(1)}</strong></div>
          </div>
          <h3>${d.signal}</h3>
          <p>${d.thesis || 'Oportunidad determinada por valoración, fundamentos, momentum y riesgo.'}</p>
          <div class="opportunity-metrics">
            <span><small>AGCI</small><b>${d.score}</b></span>
            <span><small>Momentum</small><b>${d.momentum}</b></span>
            <span><small>Riesgo</small><b>${d.risk}</b></span>
          </div>
          <div class="market-confirmation ${marketClass}"><span>${moveText}</span><b>${confidence}</b></div>
          <button type="button">Abrir ficha →</button>
        </article>`;
    }).join('');

    const meta = document.getElementById('opportunityMeta');
    if (updatedAt) {
      const updated = new Date(updatedAt).toLocaleString('es-MX', {dateStyle:'medium', timeStyle:'short'});
      const next = nextUpdateAt ? new Date(nextUpdateAt).toLocaleString('es-MX', {dateStyle:'medium', timeStyle:'short'}) : 'aprox. 6 horas';
      meta.innerHTML = `<span><b>Mercado actualizado:</b> ${updated}</span><span><b>Próxima actualización:</b> ${next}</span>`;
    } else {
      meta.textContent = 'Ranking calculado con AGCI Score; confirmación de mercado no disponible temporalmente.';
    }
  }

  document.addEventListener('click', e => {
    const card = e.target.closest('.opportunity-card');
    if (card && typeof openCurrency === 'function') openCurrency(card.dataset.currency);
  });

  fetch(WORKER_URL, {cache:'no-store'})
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(data => render(data.quotes || [], data.updatedAt, data.nextUpdateAt))
    .catch(() => render());
})();
