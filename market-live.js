const AGCI_MARKET_API = "https://agci-market-data.proadmexico.workers.dev/";

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
    timeStyle: "short",
    timeZone: "America/Mexico_City"
  }).format(new Date(value));
}

function renderMarketError(message) {
  const tape = document.getElementById("marketTape");
  if (tape) {
    tape.innerHTML = `<span class="ticker"><b>DATOS DE MERCADO</b> ${message}</span>`;
  }
}

async function loadLiveMarketData() {
  try {
    const response = await fetch(AGCI_MARKET_API, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const payload = await response.json();
    if (!Array.isArray(payload.quotes)) throw new Error("Formato de datos inválido");

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

    const status = document.querySelector(".data-status");
    if (status) {
      status.innerHTML = `
        <span><b>MARKET DATA</b> Twelve Data · actualización cada 6 horas</span>
        <span>Última actualización: ${formatDate(payload.updatedAt)}</span>
        <span>Próxima actualización: ${formatDate(payload.nextUpdateAt)}</span>
        <button data-view="governance">Ver gobierno de datos</button>`;
      status.querySelector("button")?.addEventListener("click", () => {
        if (typeof setView === "function") setView("governance");
      });
    }

    const edition = document.querySelector(".edition");
    if (edition) edition.textContent = "Edición Global · Mercado actualizado cada 6 horas";

    const byline = document.querySelector(".byline");
    if (byline) byline.textContent = `AGCI Research Desk · Mercado actualizado ${formatDate(payload.updatedAt)}`;

  } catch (error) {
    console.error("AGCI market data error:", error);
    renderMarketError("No disponible temporalmente; se muestran datos de respaldo.");
  }
}

document.addEventListener("DOMContentLoaded", loadLiveMarketData);
