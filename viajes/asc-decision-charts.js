(() => {
  'use strict';

  const COLORS = { gold:'#e8c66a', cyan:'#67e8f9', grid:'rgba(148,163,184,.10)', text:'#9fb0c4', bg:'#050b10' };
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const byId = id => document.getElementById(id);

  function safeDate(value) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? 'No disponible' : date.toLocaleString('es-MX', { dateStyle:'medium', timeStyle:'short' });
  }

  function confidence(items) {
    const values = items.map(item => item.confidence).filter(value => value !== null && value !== undefined && value !== '').map(Number).filter(Number.isFinite);
    if (!values.length) return 'No publicada';
    return `${Math.round(values.reduce((sum, value) => sum + value, 0) / values.length * 100)}%`;
  }

  function setMeta(id, entries) {
    const host = byId(id);
    if (!host) return;
    host.replaceChildren(...entries.map(entry => {
      const span = document.createElement('span');
      span.className = `decision-viz__badge decision-viz__badge--${entry.tone || 'neutral'}`;
      span.textContent = `${entry.label}: ${entry.value}`;
      return span;
    }));
  }

  const valueLabels = {
    id:'ascExactValueLabels',
    afterDatasetsDraw(chart, _args, options) {
      const dataset = chart.data.datasets[0];
      const meta = chart.getDatasetMeta(0);
      const context = chart.ctx;
      context.save();
      context.font = '700 10px IBM Plex Mono, ui-monospace, monospace';
      context.textBaseline = 'middle';
      meta.data.forEach((bar, index) => {
        context.fillStyle = index === 0 ? COLORS.gold : '#dbe7f0';
        context.fillText(options.format(dataset.data[index]), bar.x + 8, bar.y);
      });
      context.restore();
    }
  };

  function renderCost({ canvas, items, getCost, formatMoney, cabin, nights, generatedAt, source, isStale }) {
    const rows = items.map(item => ({ item, value:Number(getCost(item)) })).filter(row => Number.isFinite(row.value) && row.value > 0).sort((a, b) => a.value - b.value).slice(0, window.innerWidth <= 640 ? 6 : 8);
    const summary = byId('costChartSummary');
    setMeta('costChartMeta', [
      { label:'Unidad', value:'MXN · costo total' },
      { label:'Periodo', value:`${nights} noches` },
      { label:'Fuente', value:source ? 'Modelo ASC + FX' : 'Modelo ASC', tone:'source' },
      { label:'Actualizado', value:safeDate(generatedAt) },
      { label:'Confianza', value:confidence(rows.map(row => row.item)) },
      { label:'Estado', value:isStale ? 'Caché' : 'Estimado', tone:isStale ? 'warning' : 'estimated' }
    ]);

    if (!rows.length) {
      if (summary) summary.textContent = 'No hay costos comparables disponibles para los filtros seleccionados.';
      canvas.setAttribute('aria-label', 'Gráfico sin costos comparables disponibles.');
      return null;
    }

    const leader = rows[0];
    const next = rows[1];
    const difference = next ? next.value - leader.value : 0;
    const executive = `${leader.item.city} presenta el menor costo total estimado: ${formatMoney(leader.value)}${next ? `, ${formatMoney(difference)} menos que la siguiente alternativa` : ''}. Verifique precio y disponibilidad antes de comprar.`;
    if (summary) {
      const strong = document.createElement('strong'); strong.textContent = 'Lectura ejecutiva: ';
      summary.replaceChildren(strong, document.createTextNode(executive));
    }
    canvas.setAttribute('aria-label', `${executive} Ranking de ${rows.length} destinos en ${cabin === 'business' ? 'cabina business' : 'cabina turista'}.`);

    return new Chart(canvas, {
      type:'bar',
      plugins:[valueLabels],
      data:{
        labels:rows.map((row, index) => `${index + 1}. ${row.item.city}`),
        datasets:[{
          label:'Costo total estimado',
          data:rows.map(row => row.value),
          backgroundColor:rows.map((_row, index) => index === 0 ? 'rgba(232,198,106,.84)' : 'rgba(103,232,249,.54)'),
          borderColor:rows.map((_row, index) => index === 0 ? COLORS.gold : COLORS.cyan),
          borderWidth:1,
          borderRadius:7,
          borderSkipped:false
        }]
      },
      options:{
        indexAxis:'y', responsive:true, maintainAspectRatio:false,
        animation:reducedMotion() ? false : { duration:560, easing:'easeOutQuart' },
        interaction:{ mode:'nearest', intersect:true },
        layout:{ padding:{ right:92 } },
        plugins:{
          legend:{ display:false },
          ascExactValueLabels:{ format:formatMoney },
          tooltip:{
            backgroundColor:'rgba(5,11,16,.97)', borderColor:'rgba(103,232,249,.35)', borderWidth:1,
            titleColor:'#fff', bodyColor:'#cbd5e1', padding:12, displayColors:false,
            callbacks:{
              title:contexts => rows[contexts[0].dataIndex]?.item.city || '',
              label:context => `Costo estimado: ${formatMoney(context.raw)}`,
              afterLabel:context => context.dataIndex === 0 ? 'Lectura: menor inversión del ranking.' : `Diferencia vs. líder: ${formatMoney(context.raw - leader.value)}.`,
              footer:() => isStale ? 'Estado: dato en caché; confirme antes de comprar.' : 'Estado: estimación; confirme antes de comprar.'
            }
          }
        },
        scales:{
          x:{ beginAtZero:true, ticks:{ color:COLORS.text, callback:value => `${Math.round(value / 1000)}k` }, grid:{ color:COLORS.grid }, title:{ display:true, text:'Costo total estimado · MXN', color:'#64748b' } },
          y:{ ticks:{ color:'#d9e4ed', font:{ weight:'600' } }, grid:{ display:false } }
        }
      }
    });
  }

  window.ASCDecisionCharts = { renderCost, setMeta, safeDate };
})();
