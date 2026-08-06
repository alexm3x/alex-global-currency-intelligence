(() => {
  "use strict";

  const FX_HISTORY_API = "https://api.frankfurter.dev/v1";
  const CACHE_PREFIX = "agci:fx-history:v1:";
  const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
  const OBSERVED_PREFIX = "agci:observed-fx:v1:";
  const supportedFxCodes = new Set([
    "AUD", "BRL", "CAD", "CHF", "CNY", "EUR", "GBP", "IDR", "INR", "JPY", "KRW", "MXN", "TRY"
  ]);

  let activeChart = null;
  let activeRequest = null;
  const dialog = document.getElementById("currencyDialog");
  const content = document.getElementById("dialogContent");
  const { buildCompositeHistory, normalizeLiveRate, round } = window.AGCICurrencyHistoryCore || {};

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  function getCurrency(country) {
    if (typeof DATA === "undefined" || !Array.isArray(DATA)) return null;
    return DATA.find(item => item.country === country) || null;
  }

  function isoDate(date) {
    return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  }

  function formatShortDate(value) {
    return new Intl.DateTimeFormat("es-MX", { day: "2-digit", month: "short" }).format(new Date(`${value}T12:00:00`));
  }

  function rateDigits(value) {
    if (value >= 100) return 2;
    if (value >= 10) return 3;
    return 4;
  }

  function formatRate(value) {
    if (!Number.isFinite(value)) return "—";
    return new Intl.NumberFormat("es-MX", {
      minimumFractionDigits: rateDigits(value),
      maximumFractionDigits: rateDigits(value)
    }).format(value);
  }

  function readJson(key) {
    try { return JSON.parse(localStorage.getItem(key) || "null"); }
    catch { return null; }
  }

  function writeJson(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); }
    catch { /* History still works when storage is unavailable. */ }
  }

  function recordLiveObservation(currency) {
    const value = normalizeLiveRate(currency);
    if (!Number.isFinite(value)) return;
    const key = `${OBSERVED_PREFIX}${currency.code}`;
    const observations = readJson(key) || [];
    const date = isoDate(new Date(currency.marketUpdatedAt || Date.now()));
    const next = observations.filter(item => item.date !== date);
    next.push({ date, value: round(value, 6), source: "AGCI intraday" });
    next.sort((a, b) => a.date.localeCompare(b.date));
    writeJson(key, next.slice(-30));
  }

  function mergeLiveObservation(points, currency) {
    recordLiveObservation(currency);
    const liveValue = normalizeLiveRate(currency);
    if (!Number.isFinite(liveValue)) return points;
    const liveDate = isoDate(new Date(currency.marketUpdatedAt || Date.now()));
    const merged = points.filter(point => point.date !== liveDate);
    merged.push({ date: liveDate, value: round(liveValue, 6), source: "AGCI intraday" });
    return merged.sort((a, b) => a.date.localeCompare(b.date)).slice(-30);
  }

  function observedFallback(currency) {
    const points = readJson(`${OBSERVED_PREFIX}${currency.code}`) || [];
    return points.filter(point => point && point.date && Number.isFinite(Number(point.value)));
  }

  async function fetchFxHistory(currency, signal) {
    const cacheKey = `${CACHE_PREFIX}${currency.code}`;
    const cached = readJson(cacheKey);
    if (cached && Date.now() - cached.savedAt < CACHE_TTL_MS && Array.isArray(cached.points)) {
      return { points: mergeLiveObservation(cached.points, currency), source: cached.source, cached: true };
    }

    if (!supportedFxCodes.has(currency.code)) {
      const observed = observedFallback(currency);
      if (observed.length > 1) return { points: observed, source: "AGCI intraday archive", cached: true };
      throw new Error(`La fuente histórica no cubre ${currency.code} y AGCI aún no cuenta con dos observaciones propias archivadas.`);
    }

    const end = new Date();
    const start = new Date(end);
    start.setDate(start.getDate() - 30);
    const endpoint = `${FX_HISTORY_API}/${isoDate(start)}..${isoDate(end)}?from=USD&to=${encodeURIComponent(currency.code)}`;
    const response = await fetch(endpoint, { cache: "no-store", signal, headers: { Accept: "application/json" } });
    if (!response.ok) throw new Error(`La fuente histórica respondió HTTP ${response.status}.`);
    const payload = await response.json();
    const points = Object.entries(payload.rates || {}).map(([date, rates]) => ({
      date,
      value: Number(rates?.[currency.code]),
      source: "Frankfurter / ECB"
    })).filter(point => Number.isFinite(point.value)).sort((a, b) => a.date.localeCompare(b.date));
    if (points.length < 2) throw new Error("No se recibieron suficientes observaciones reales para construir la gráfica.");
    const merged = mergeLiveObservation(points, currency);
    const result = { points: merged, source: "Frankfurter / ECB + AGCI intraday" };
    writeJson(cacheKey, { ...result, savedAt: Date.now() });
    return { ...result, cached: false };
  }

  function renderShell(currency) {
    const thesis = currency.thesis || "Señal compuesta basada en valoración, fundamentos, momentum y riesgo.";
    const momentumColor = currency.momentum >= 60 ? "#23c483" : "#d1ad68";
    const rateColor = currency.momentum >= 60 ? "#d1ad68" : "#23c483";
    content.innerHTML = `
      <article class="currency-history-panel" style="--momentum-color:${momentumColor};--rate-color:${rateColor}">
        <header class="currency-history-header">
          <div>
            <p class="currency-history-eyebrow">AGCI Currency Intelligence · 30 días</p>
            <h2 class="currency-history-title" id="currencyDialogTitle">${escapeHtml(currency.country)} <span>${escapeHtml(currency.code)}</span></h2>
            <p class="currency-history-subtitle">${escapeHtml(thesis)}</p>
          </div>
          <span class="currency-history-signal">${escapeHtml(currency.signal)}</span>
        </header>
        <section class="currency-history-metrics" aria-label="Indicadores destacados">
          <div class="currency-history-metric"><span>AGCI actual</span><strong>${currency.score.toFixed(1)}</strong></div>
          <div class="currency-history-metric"><span>Momentum</span><strong style="color:${momentumColor}">${currency.momentum}</strong></div>
          <div class="currency-history-metric"><span>1 USD en ${escapeHtml(currency.code)}</span><strong id="historyLatestRate">—</strong></div>
          <div class="currency-history-metric"><span>Variación 30D</span><strong id="historyPeriodChange">—</strong></div>
        </section>
        <div class="currency-history-chart-head">
          <div><h3>Score compuesto vs. mercado</h3><p>Observaciones diarias; los fines de semana no generan nueva cotización.</p></div>
          <div class="currency-history-legend" aria-label="Leyenda">
            <span><i style="--series-color:${momentumColor}"></i>AGCI Composite</span>
            <span><i style="--series-color:${rateColor}"></i>USD/${escapeHtml(currency.code)}</span>
          </div>
        </div>
        <div class="currency-history-chart-wrap">
          <canvas id="currencyHistoryChart" role="img" aria-label="Histórico de 30 días del score AGCI y USD/${escapeHtml(currency.code)}"></canvas>
          <div class="currency-history-loading" id="currencyHistoryState"><span>Validando y preparando el histórico real…</span></div>
        </div>
        <footer class="currency-history-source">
          <span id="currencyHistorySource"><strong>Fuente FX:</strong> conectando…</span>
          <span><strong>Metodología:</strong> score histórico reconstruido con modelo AGCI v0.3; no representa un archivo diario observado.</span>
        </footer>
      </article>`;
    dialog.classList.add("currency-history-dialog");
    dialog.setAttribute("aria-labelledby", "currencyDialogTitle");
    if (!dialog.open) dialog.showModal();
  }

  function externalTooltip(context, currency) {
    const { chart, tooltip } = context;
    const parent = chart.canvas.parentNode;
    let element = parent.querySelector(".agci-chart-tooltip");
    if (!element) {
      element = document.createElement("div");
      element.className = "agci-chart-tooltip";
      parent.appendChild(element);
    }
    if (tooltip.opacity === 0) {
      element.style.opacity = "0";
      return;
    }
    const score = tooltip.dataPoints?.find(point => point.dataset.yAxisID === "score");
    const rate = tooltip.dataPoints?.find(point => point.dataset.yAxisID === "fx");
    const date = score?.label || rate?.label || "";
    element.innerHTML = `<time>${escapeHtml(date)}</time>
      <div><span>AGCI Composite</span><strong>${score ? Number(score.raw).toFixed(1) : "—"}</strong></div>
      <div><span>USD/${escapeHtml(currency.code)}</span><strong>${rate ? formatRate(Number(rate.raw)) : "—"}</strong></div>`;
    const { offsetLeft, offsetTop } = chart.canvas;
    element.style.opacity = "1";
    element.style.left = `${offsetLeft + tooltip.caretX}px`;
    element.style.top = `${offsetTop + tooltip.caretY}px`;
  }

  const crosshairPlugin = {
    id: "agciCrosshair",
    afterDatasetsDraw(chart) {
      const active = chart.tooltip?.getActiveElements?.() || [];
      if (!active.length) return;
      const x = active[0].element.x;
      const { top, bottom } = chart.chartArea;
      const context = chart.ctx;
      context.save();
      context.beginPath();
      context.moveTo(x, top);
      context.lineTo(x, bottom);
      context.lineWidth = 1;
      context.strokeStyle = "rgba(255,255,255,.12)";
      context.stroke();
      context.restore();
    }
  };

  function renderChart(currency, points, source) {
    if (!window.Chart) throw new Error("Chart.js no pudo cargarse. Verifique la conexión y vuelva a intentarlo.");
    const state = document.getElementById("currencyHistoryState");
    const canvas = document.getElementById("currencyHistoryChart");
    if (!canvas) return;
    const first = points[0];
    const last = points.at(-1);
    const periodChange = ((last.value / first.value) - 1) * 100;
    const currencyStrengthChange = -periodChange;
    const momentumColor = currency.momentum >= 60 ? "#23c483" : "#d1ad68";
    const rateColor = currency.momentum >= 60 ? "#d1ad68" : "#23c483";

    document.getElementById("historyLatestRate").textContent = formatRate(last.value);
    const changeNode = document.getElementById("historyPeriodChange");
    changeNode.textContent = `${currencyStrengthChange >= 0 ? "+" : ""}${currencyStrengthChange.toFixed(2)}%`;
    changeNode.style.color = currencyStrengthChange >= 0 ? "#23c483" : "#ef7d74";
    document.getElementById("currencyHistorySource").innerHTML = `<strong>Fuente FX:</strong> ${escapeHtml(source)} · corte ${escapeHtml(formatShortDate(last.date))}`;
    if (state) state.remove();

    activeChart?.destroy();
    activeChart = new Chart(canvas, {
      type: "line",
      data: {
        labels: points.map(point => formatShortDate(point.date)),
        datasets: [
          {
            label: "AGCI Composite",
            data: points.map(point => point.score),
            yAxisID: "score",
            borderColor: momentumColor,
            backgroundColor: momentumColor,
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 3,
            pointHoverBorderWidth: 0,
            tension: .34
          },
          {
            label: `USD/${currency.code}`,
            data: points.map(point => point.value),
            yAxisID: "fx",
            borderColor: rateColor,
            backgroundColor: rateColor,
            borderWidth: 1.25,
            pointRadius: 0,
            pointHoverRadius: 3,
            pointHoverBorderWidth: 0,
            tension: .28
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        normalized: true,
        interaction: { mode: "index", intersect: false },
        animation: { duration: 420, easing: "easeOutQuart" },
        layout: { padding: { top: 8, right: 4, bottom: 0, left: 2 } },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false, external: context => externalTooltip(context, currency) }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false },
            ticks: { color: "#66747b", maxTicksLimit: 6, maxRotation: 0, font: { size: 9 } }
          },
          score: {
            position: "left",
            suggestedMin: Math.max(0, Math.min(...points.map(point => point.score)) - 3),
            suggestedMax: Math.min(100, Math.max(...points.map(point => point.score)) + 3),
            grid: { display: false },
            border: { display: false },
            ticks: { color: momentumColor, maxTicksLimit: 5, font: { size: 9 }, callback: value => Number(value).toFixed(0) }
          },
          fx: {
            position: "right",
            grid: { display: false },
            border: { display: false },
            ticks: { color: rateColor, maxTicksLimit: 5, font: { size: 9 }, callback: value => formatRate(Number(value)) }
          }
        }
      },
      plugins: [crosshairPlugin]
    });
  }

  function showError(message) {
    const state = document.getElementById("currencyHistoryState");
    if (!state) return;
    state.className = "currency-history-error";
    state.innerHTML = `<span><strong>Histórico no disponible</strong><br>${escapeHtml(message)}<br>No se muestran estimaciones de tipo de cambio.</span>`;
  }

  async function openCurrencyHistory(country) {
    const currency = getCurrency(country);
    if (!currency || !dialog || !content) return;
    activeRequest?.abort();
    activeRequest = new AbortController();
    activeChart?.destroy();
    activeChart = null;
    renderShell(currency);
    try {
      const history = await fetchFxHistory(currency, activeRequest.signal);
      const points = buildCompositeHistory(currency, history.points);
      renderChart(currency, points, history.source);
    } catch (error) {
      if (error.name !== "AbortError") showError(error.message || "Error no identificado.");
    }
  }

  function enhanceCurrencyTriggers(root = document) {
    root.querySelectorAll?.("[data-currency]").forEach(element => {
      if (element.matches("button,a")) return;
      element.setAttribute("role", "button");
      element.setAttribute("tabindex", "0");
      element.setAttribute("aria-label", `Abrir histórico de ${element.dataset.currency}`);
    });
  }

  document.addEventListener("click", event => {
    const trigger = event.target.closest?.("[data-currency]");
    if (!trigger) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    openCurrencyHistory(trigger.dataset.currency);
  }, true);

  document.addEventListener("keydown", event => {
    const trigger = event.target.closest?.("[data-currency][role='button']");
    if (!trigger || !["Enter", " "].includes(event.key)) return;
    event.preventDefault();
    openCurrencyHistory(trigger.dataset.currency);
  });

  dialog?.addEventListener("close", () => {
    activeRequest?.abort();
    activeChart?.destroy();
    activeChart = null;
    dialog.classList.remove("currency-history-dialog");
  });

  dialog?.addEventListener("click", event => {
    const bounds = dialog.getBoundingClientRect();
    const outside = event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom;
    if (outside) dialog.close();
  });

  enhanceCurrencyTriggers();
  new MutationObserver(records => {
    if (records.some(record => record.addedNodes.length)) enhanceCurrencyTriggers();
  }).observe(document.body, { childList: true, subtree: true });

  window.AGCICurrencyHistory = { open: openCurrencyHistory };
})();
