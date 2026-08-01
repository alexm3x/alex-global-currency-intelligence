const AGCI_MARKET_API = "https://agci-market-data.proadmexico.workers.dev/";
const MARKET_REFRESH_MS = 60 * 1000;
const MARKET_STALE_AFTER_MS = 3 * 60 * 1000;
let marketRefreshTimer = null;
let lastMarketPayload = null;

const SYMBOL_MAP = {
  "EUR/USD": { code: "EUR", invert: false },
  "GBP/USD": { code: "GBP", invert: false },
  "USD/JPY": { code: "JPY", invert: true },
  "USD/MXN": { code: "MXN", invert: true },
  "USD/BRL": { code: "BRL", invert: true },
  "USD/CNY": { code: "CNY", invert: true }
};

function formatPrice(value) {
  if (!Number.isFinite(value)) return "—";
  if (value >= 100) return value.toFixed(2);
  if (value >= 10) return value.toFixed(3);
  return value.toFixed(4);
}

function formatDate(value) {
  if (!value) return "No disponible";
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "medium",
    timeZone: "America/Mexico_City"
  }).format(new Date(value));
}

function dataAgeMs(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? Date.now() - timestamp : Infinity;
}

function freshnessLabel(updatedAt) {
  const age = dataAgeMs(updatedAt);
  if (age <= 90 * 1000) return { text: "EN VIVO", className: "live" };
  if (age <= MARKET_STALE_AFTER_MS) return { text: "RECIENTE", className: "recent" };
  return { text: "DEMORADO", className: "stale" };
}

function ensureLiveStatusStyles() {
  if (document.getElementById("agci-live-status-styles")) return;
  const style = document.createElement("style");
  style.id = "agci-live-status-styles";
  style.textContent = `
    .market-live-status{display:flex;gap:12px;align-items:center;justify-content:center;padding:7px 14px;border-bottom:1px solid rgba(128,128,128,.3);font-size:11px;letter-spacing:.06em;text-transform:uppercase}
    .market-live-dot{width:8px;height:8px;border-radius:50%;display:inline-block;background:#999}
    .market-live-status.live .market-live-dot{background:#168447;box-shadow:0 0 0 4px rgba(22,132,71,.14)}
    .market-live-status.recent .market-live-dot{background:#c28a10}
    .market-live-status.stale .market-live-dot{background:#a52a2a}
    .market-live-status button{border:0;background:transparent;text-decoration:underline;cursor:pointer;font:inherit;color:inherit}
  `;
  document.head.appendChild(style);
}

function renderLiveStatus(payload, stateMessage = "") {
  ensureLiveStatusStyles();
  let bar = document.getElementById("marketLiveStatus");
  if (!bar) {
    bar = document.createElement("div");
    bar.id = "marketLiveStatus";
    const tape = document.getElementById("marketTape");
    tape?.insertAdjacentElement("afterend", bar);
  }
  if (!bar) return;
  const freshness = freshnessLabel(payload?.updatedAt);
  bar.className = `market-live-status ${freshness.className}`;
  bar.innerHTML = `
    <span class="market-live-dot" aria-hidden="true"></span>
    <strong>${freshness.text}</strong>
    <span>Último dato: ${formatDate(payload?.updatedAt)}</span>
    <span>${stateMessage || "Actualización automática cada 60 segundos"}</span>
    <button type="button" id="marketRefreshNow">Actualizar ahora</button>`;
  document.getElementById("marketRefreshNow")?.addEventListener("click", () => loadLiveMarketData(true));
}

function renderMarketError(message) {
  const tape = document.getElementById("marketTape");
  if (tape) tape.innerHTML = `<span class="ticker"><b>DATOS DE MERCADO</b> ${message}</span>`;
  renderLiveStatus(lastMarketPayload, message);
}

async function loadLiveMarketData(force = false) {
  try {
    const separator = AGCI_MARKET_API.includes("?") ? "&" : "?";
    const endpoint = force ? `${AGCI_MARKET_API}${separator}t=${Date.now()}` : AGCI_MARKET_API;
    const response = await fetch(endpoint, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    if (!Array.isArray(payload.quotes)) throw new Error("Formato de datos inválido");
    lastMarketPayload = payload;

    const validQuotes = payload.quotes.filter(q => !q.error && Number.isFinite(Number(q.price)));
    const tape = document.getElementById("marketTape");
    if (tape) {
      tape.innerHTML = validQuotes.map(q => {
        const pct = Number(q.percentChange);
        const changeText = Number.isFinite(pct) ? `${pct >= 0 ? "+" : ""}${pct.toFixed(2)}%` : "—";
        return `<span class="ticker"><b>${q.symbol}</b>${formatPrice(Number(q.price))} <em class="${pct >= 0 ? "up" : "down"}">${changeText}</em></span>`;
      }).join("");
    }

    validQuotes.forEach(q => {
      const mapping = SYMBOL_MAP[q.symbol];
      if (!mapping || !Array.isArray(window.DATA || DATA)) return;
      const pct = Number(q.percentChange);
      if (!Number.isFinite(pct)) return;
      const adjusted = mapping.invert ? -pct : pct;
      DATA.filter(d => d.code === mapping.code).forEach(d => {
        d.change = Number(adjusted.toFixed(2));
        d.marketPrice = Number(q.price);
        d.marketSymbol = q.symbol;
        d.marketUpdatedAt = payload.updatedAt || q.datetime || null;
      });
    });

    if (typeof renderPreview === "function") renderPreview();
    if (typeof renderTable === "function") renderTable();

    const age = dataAgeMs(payload.updatedAt);
    const mode = payload.mode === "near-real-time-rest" || age <= MARKET_STALE_AFTER_MS
      ? "Datos casi en tiempo real"
      : "El frontend consulta cada minuto, pero el Worker aún entrega una caché más larga";
    renderLiveStatus(payload, mode);

    const status = document.querySelector(".data-status");
    if (status) {
      status.innerHTML = `
        <span><b>MARKET DATA</b> Twelve Data · consulta automática cada minuto</span>
        <span>Última actualización del proveedor: ${formatDate(payload.updatedAt)}</span>
        <span>Estado: ${freshnessLabel(payload.updatedAt).text}</span>
        <button data-view="governance">Ver gobierno de datos</button>`;
      status.querySelector("button")?.addEventListener("click", () => {
        if (typeof setView === "function") setView("governance");
      });
    }

    const edition = document.querySelector(".edition");
    if (edition) edition.textContent = `Edición Global · Mercado ${freshnessLabel(payload.updatedAt).text.toLowerCase()}`;

    const byline = document.querySelector(".byline");
    if (byline) byline.textContent = `AGCI Research Desk · Mercado actualizado ${formatDate(payload.updatedAt)}`;
  } catch (error) {
    console.error("AGCI market data error:", error);
    renderMarketError("No disponible temporalmente; se conserva el último dato válido.");
  }
}

function startMarketAutoRefresh() {
  clearInterval(marketRefreshTimer);
  marketRefreshTimer = setInterval(() => {
    if (document.visibilityState === "visible") loadLiveMarketData();
  }, MARKET_REFRESH_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") loadLiveMarketData(true);
  });
  window.addEventListener("online", () => loadLiveMarketData(true));
}

function loadOpportunitiesModule() {
  if (!document.querySelector('link[href="opportunities.css"]')) {
    const css = document.createElement('link');
    css.rel = 'stylesheet';
    css.href = 'opportunities.css';
    document.head.appendChild(css);
  }
  if (!document.querySelector('script[src="opportunities.js"]')) {
    const script = document.createElement('script');
    script.src = 'opportunities.js';
    script.defer = true;
    document.body.appendChild(script);
  }
}

function loadNewsModule() {
  if (!document.querySelector('script[src="news.js"]')) {
    const script = document.createElement('script');
    script.src = 'news.js';
    script.defer = true;
    document.body.appendChild(script);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  loadLiveMarketData(true);
  startMarketAutoRefresh();
  loadOpportunitiesModule();
  loadNewsModule();
});
