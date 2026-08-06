(() => {
  const API_URL = "https://agci-equity-fundamentals.proadmexico.workers.dev";
  const STORAGE_KEY = "agci:equity-comparator:v1";
  const DEFAULT_SYMBOLS = ["MSFT", "GOOGL", "AMZN", "JPM", "V", "LLY", "ISRG", "GE", "COST", "XOM"];
  const MAX_SYMBOLS = 10;
  let symbols = readSymbols();
  let lastPayload = null;

  const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const finite = value => value !== null && value !== undefined && value !== "" && Number.isFinite(Number(value));
  const valueAt = (object, path) => path.split(".").reduce((value, key) => value?.[key], object);

  function readSymbols() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
      return Array.isArray(saved) && saved.length ? normalize(saved).slice(0, MAX_SYMBOLS) : [...DEFAULT_SYMBOLS];
    } catch {
      return [...DEFAULT_SYMBOLS];
    }
  }

  function normalize(values) {
    return [...new Set(values.map(value => String(value).trim().toUpperCase()).filter(value => /^[A-Z][A-Z0-9.-]{0,9}$/.test(value)))];
  }

  function saveSymbols() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(symbols));
  }

  function build() {
    const nav = document.querySelector(".main-nav");
    const main = document.querySelector("main");
    if (!nav || !main || document.getElementById("equityComparator")) return;

    const button = document.createElement("button");
    button.type = "button";
    button.dataset.view = "equityComparator";
    button.textContent = "Comparador de Acciones";
    nav.appendChild(button);

    const section = document.createElement("section");
    section.id = "equityComparator";
    section.className = "view equity-comparator-view";
    section.innerHTML = `
      <div class="equity-page-head">
        <div>
          <p class="rubric">AGCI FUNDAMENTAL LAB · FASE 1</p>
          <h2>Comparador Fundamental de Acciones</h2>
          <p>Capture hasta diez acciones estadounidenses y compárelas con empresas semejantes utilizando valuación, crecimiento, rentabilidad y solidez financiera.</p>
        </div>
        <div class="equity-principle"><span>PRINCIPIO</span><strong>Una cotización menor no significa una valuación más barata.</strong></div>
      </div>

      <section class="equity-list-manager" aria-labelledby="equityListTitle">
        <div class="equity-list-heading">
          <div><span>01</span><div><h3 id="equityListTitle">Lista de análisis</h3><p>Los símbolos se guardan únicamente en este navegador.</p></div></div>
          <div class="equity-list-meta"><b id="equitySymbolCount">0/10</b><span>Mercado: Estados Unidos · Moneda: USD</span></div>
        </div>
        <div id="equityTickerSlots" class="equity-ticker-slots"></div>
        <form id="equityTickerForm" class="equity-ticker-form">
          <label for="equityTickerInput">Agregar símbolo</label>
          <div><input id="equityTickerInput" type="text" maxlength="10" autocomplete="off" placeholder="Ej. AAPL" aria-describedby="equityTickerHint"><button type="submit">Agregar</button></div>
          <small id="equityTickerHint">Use el ticker oficial registrado ante la SEC. Máximo 10 acciones.</small>
        </form>
        <div class="equity-actions">
          <button id="equityAnalyze" type="button" class="primary">Analizar lista</button>
          <button id="equityRestore" type="button">Restaurar ejemplo</button>
          <button id="equityExport" type="button" disabled>Exportar CSV</button>
          <span id="equityActionMessage" role="status" aria-live="polite"></span>
        </div>
      </section>

      <div id="equityFreshness" class="equity-freshness" hidden></div>
      <div id="equityLoading" class="equity-loading" hidden><span></span><div><strong>Consultando datos financieros</strong><small>SEC EDGAR, cotizaciones disponibles y comparables sectoriales.</small></div></div>
      <div id="equityResults" aria-live="polite"></div>

      <aside class="equity-method-note">
        <strong>Alcance de la Fase 1</strong>
        <p>Estados financieros anuales 10-K de SEC EDGAR y precios de Twelve Data cuando la cuota permite actualizarlos. P/E Forward, PEG y estimaciones permanecen como N/A; no se inventan ni sustituyen datos faltantes con cero. El resultado es investigación comparativa, no una recomendación personalizada.</p>
      </aside>`;
    main.appendChild(section);

    button.addEventListener("click", () => typeof setView === "function" && setView("equityComparator"));
    document.getElementById("equityTickerForm")?.addEventListener("submit", addSymbol);
    document.getElementById("equityAnalyze")?.addEventListener("click", analyze);
    document.getElementById("equityRestore")?.addEventListener("click", restore);
    document.getElementById("equityExport")?.addEventListener("click", exportCsv);
    renderSlots();
  }

  function renderSlots() {
    const target = document.getElementById("equityTickerSlots");
    const counter = document.getElementById("equitySymbolCount");
    if (!target) return;
    target.innerHTML = Array.from({ length: MAX_SYMBOLS }, (_, index) => {
      const symbol = symbols[index];
      return symbol
        ? `<div class="equity-ticker-slot filled"><span>${String(index + 1).padStart(2, "0")}</span><strong>${escapeHtml(symbol)}</strong><button type="button" data-remove-symbol="${escapeHtml(symbol)}" aria-label="Eliminar ${escapeHtml(symbol)}">×</button></div>`
        : `<div class="equity-ticker-slot empty"><span>${String(index + 1).padStart(2, "0")}</span><em>Disponible</em></div>`;
    }).join("");
    if (counter) counter.textContent = `${symbols.length}/${MAX_SYMBOLS}`;
    target.querySelectorAll("[data-remove-symbol]").forEach(button => button.addEventListener("click", () => {
      symbols = symbols.filter(symbol => symbol !== button.dataset.removeSymbol);
      saveSymbols();
      renderSlots();
      message(`${button.dataset.removeSymbol} fue eliminado.`);
    }));
  }

  function addSymbol(event) {
    event.preventDefault();
    const input = document.getElementById("equityTickerInput");
    const candidate = normalize([input?.value || ""])[0];
    if (!candidate) return message("Ingrese un símbolo válido, por ejemplo AAPL.", "error");
    if (symbols.includes(candidate)) return message(`${candidate} ya está en la lista.`, "error");
    if (symbols.length >= MAX_SYMBOLS) return message("La lista ya contiene el máximo de 10 acciones.", "error");
    symbols.push(candidate);
    saveSymbols();
    if (input) input.value = "";
    renderSlots();
    message(`${candidate} fue agregado.`);
  }

  function restore() {
    symbols = [...DEFAULT_SYMBOLS];
    saveSymbols();
    lastPayload = null;
    renderSlots();
    document.getElementById("equityResults").innerHTML = "";
    document.getElementById("equityExport").disabled = true;
    message("Lista de ejemplo restaurada.");
  }

  async function analyze() {
    if (!symbols.length) return message("Agregue al menos una acción antes de analizar.", "error");
    const loading = document.getElementById("equityLoading");
    const results = document.getElementById("equityResults");
    const button = document.getElementById("equityAnalyze");
    loading.hidden = false;
    button.disabled = true;
    results.innerHTML = "";
    message("Preparando comparación…");
    try {
      const response = await fetch(`${API_URL}/compare?symbols=${encodeURIComponent(symbols.join(","))}`, { cache: "no-store" });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.detail || payload.error || `HTTP ${response.status}`);
      if (!Array.isArray(payload.analyses)) throw new Error("El servicio devolvió un contrato inválido.");
      lastPayload = payload;
      renderPayload(payload);
      document.getElementById("equityExport").disabled = false;
      message(`${payload.analyzedSymbols?.length || 0} acciones analizadas. Calidad de datos: ${qualityLabel(payload.dataQuality)}.`);
    } catch (error) {
      results.innerHTML = `<div class="equity-error"><strong>El comparador no pudo conectarse.</strong><p>${escapeHtml(error.message || "Error desconocido")}</p><p>Su lista quedó guardada. Intente nuevamente cuando el servicio de fundamentales esté disponible.</p></div>`;
      message("No fue posible completar la consulta.", "error");
    } finally {
      loading.hidden = true;
      button.disabled = false;
    }
  }

  function renderPayload(payload) {
    renderFreshness(payload);
    const valid = payload.analyses.filter(item => item.company);
    const errors = [
      ...(payload.invalidSymbols || []).map(ticker => ({ ticker, error: "Símbolo no registrado por la SEC" })),
      ...(payload.errors || [])
    ];
    const results = document.getElementById("equityResults");
    results.innerHTML = `
      <section class="equity-executive-summary">
        <div><span>Acciones analizadas</span><strong>${valid.length}</strong></div>
        <div><span>Valuación atractiva</span><strong>${valid.filter(item => item.classification === "Valuación atractiva").length}</strong></div>
        <div><span>Alertas de valor</span><strong>${valid.filter(item => item.classification === "Posible trampa de valor").length}</strong></div>
        <div><span>Cobertura promedio</span><strong>${valid.length ? Math.round(valid.reduce((sum, item) => sum + Number(item.confidence || 0), 0) / valid.length) : 0}%</strong></div>
      </section>
      <section class="equity-table-section">
        <div class="equity-section-head"><div><span>02</span><div><h3>Tabla ejecutiva</h3><p>Ordene por puntuación y abra el detalle para revisar la evidencia.</p></div></div></div>
        <div class="equity-table-wrap"><table><thead><tr>
          <th>Ticker</th><th>Empresa</th><th>Industria</th><th>Precio</th><th>P/E</th><th>P/S</th><th>EV/EBITDA</th><th>FCF Yield</th><th>Ingresos YoY</th><th>Margen op.</th><th>ROE</th><th>ROIC</th><th>Deuda neta/EBITDA</th><th>Score</th><th>Comparable</th><th>Confianza</th><th>Estado</th>
        </tr></thead><tbody>${valid.sort((a, b) => Number(b.score?.total || 0) - Number(a.score?.total || 0)).map(renderRow).join("")}</tbody></table></div>
      </section>
      <section class="equity-detail-section">
        <div class="equity-section-head"><div><span>03</span><div><h3>Diagnóstico por acción</h3><p>Comparación contra la mediana del grupo disponible.</p></div></div></div>
        <div class="equity-detail-grid">${valid.map(renderDetail).join("")}</div>
      </section>
      ${errors.length ? `<section class="equity-data-errors"><strong>Datos no disponibles</strong>${errors.map(item => `<p><b>${escapeHtml(item.ticker)}</b> · ${escapeHtml(item.error)}</p>`).join("")}</section>` : ""}
      <p class="equity-source-line">Fuentes: ${payload.sources.map(source => `${escapeHtml(source.provider)} · ${escapeHtml(source.dataset)}`).join(" | ")} · Periodo: ${escapeHtml(payload.methodology.statementPeriod)}</p>`;
  }

  function renderFreshness(payload) {
    const bar = document.getElementById("equityFreshness");
    bar.hidden = false;
    bar.className = `equity-freshness ${payload.isStale ? "stale" : "fresh"}`;
    bar.innerHTML = payload.isStale
      ? `<span></span><strong>Datos en caché (Servidor origen no disponible)</strong><small>Último set exitoso: ${formatDate(payload.lastSuccessfulUpdate)}</small>`
      : `<span></span><strong>Datos fundamentales disponibles</strong><small>Última consulta exitosa: ${formatDate(payload.lastSuccessfulUpdate)}</small>`;
  }

  function renderRow(item) {
    const company = item.company;
    return `<tr>
      <td><strong>${escapeHtml(item.ticker)}</strong></td>
      <td>${escapeHtml(company.companyName)}</td>
      <td>${escapeHtml(company.industry)}</td>
      <td>${money(company.price)}</td>
      <td>${number(company.ratios.peTTM, 1)}</td>
      <td>${number(company.ratios.priceToSales, 1)}</td>
      <td>${number(company.ratios.evEbitda, 1)}</td>
      <td>${percent(company.ratios.fcfYield)}</td>
      <td>${percent(company.growth.revenueYoY)}</td>
      <td>${percent(company.ratios.operatingMargin)}</td>
      <td>${percent(company.ratios.roe)}</td>
      <td>${percent(company.ratios.roic)}</td>
      <td>${number(company.ratios.netDebtToEbitda, 1)}</td>
      <td><span class="equity-score score-${scoreBand(item.score.total)}">${number(item.score.total, 0)}</span></td>
      <td>${item.preferredComparable ? escapeHtml(item.preferredComparable.ticker) : '<span class="na">N/A</span>'}</td>
      <td>${number(item.confidence, 0)}%</td>
      <td><span class="equity-classification">${escapeHtml(item.classification)}</span></td>
    </tr>`;
  }

  function renderDetail(item) {
    const c = item.company;
    const metrics = [
      ["Valuación", item.score.valuation], ["Crecimiento", item.score.growth], ["Calidad", item.score.quality],
      ["Solidez", item.score.financialStrength], ["Momentum", item.score.momentum]
    ];
    return `<details class="equity-detail-card" ${item === lastPayload.analyses.find(entry => entry.company) ? "open" : ""}>
      <summary><span><b>${escapeHtml(item.ticker)}</b><small>${escapeHtml(c.companyName)}</small></span><span class="equity-score score-${scoreBand(item.score.total)}">${number(item.score.total, 0)}</span><em>${escapeHtml(item.classification)}</em></summary>
      <div class="equity-detail-body">
        <p class="equity-conclusion">${escapeHtml(item.conclusion)}</p>
        <div class="equity-score-bars">${metrics.map(([label, value]) => `<div><span>${label}</span><i><b style="width:${finite(value) ? Math.max(0, Math.min(100, value)) : 0}%"></b></i><strong>${finite(value) ? Math.round(value) : "N/A"}</strong></div>`).join("")}</div>
        <div class="equity-detail-columns">
          <div><h4>Comparables</h4>${item.comparables.length ? item.comparables.map(peer => `<p><b>${escapeHtml(peer.ticker)}</b> · ${escapeHtml(peer.rationale)}</p>`).join("") : "<p>N/A · El universo gratuito no encontró un grupo suficiente.</p>"}</div>
          <div><h4>Riesgos y controles</h4>${item.risks.map(risk => `<p>${escapeHtml(risk)}</p>`).join("")}</div>
        </div>
        <div class="equity-ratio-strip">
          ${ratioTile("EV/EBITDA", c.ratios.evEbitda, item.medians["ratios.evEbitda"], false)}
          ${ratioTile("P/E", c.ratios.peTTM, item.medians["ratios.peTTM"], false)}
          ${ratioTile("ROIC", c.ratios.roic, item.medians["ratios.roic"], true, true)}
          ${ratioTile("Ingresos YoY", c.growth.revenueYoY, item.medians["growth.revenueYoY"], true, true)}
        </div>
        <small class="equity-period">10-K con cierre ${escapeHtml(c.fiscalPeriodEnd || "no disponible")} · Cobertura ${c.dataCoverage}% · ${c.isStale ? "caché" : "último dato exitoso"}</small>
      </div>
    </details>`;
  }

  function ratioTile(label, value, medianValue, higherBetter, asPercent = false) {
    const favorable = finite(value) && finite(medianValue) ? (higherBetter ? value >= medianValue : value <= medianValue) : null;
    const formatter = asPercent ? percent : number;
    return `<div class="equity-ratio-tile ${favorable === null ? "neutral" : favorable ? "favorable" : "caution"}"><span>${escapeHtml(label)}</span><strong>${formatter(value)}</strong><small>Mediana ${formatter(medianValue)}</small></div>`;
  }

  function exportCsv() {
    if (!lastPayload) return;
    const headers = ["Ticker", "Empresa", "Industria", "Precio", "P/E", "P/S", "EV/EBITDA", "FCF Yield", "Ingresos YoY", "Margen operativo", "ROE", "ROIC", "Deuda neta/EBITDA", "Score", "Comparable", "Confianza", "Clasificación", "Última actualización"];
    const rows = lastPayload.analyses.filter(item => item.company).map(item => {
      const c = item.company;
      return [item.ticker, c.companyName, c.industry, c.price, c.ratios.peTTM, c.ratios.priceToSales, c.ratios.evEbitda, c.ratios.fcfYield, c.growth.revenueYoY, c.ratios.operatingMargin, c.ratios.roe, c.ratios.roic, c.ratios.netDebtToEbitda, item.score.total, item.preferredComparable?.ticker, item.confidence, item.classification, c.lastSuccessfulUpdate];
    });
    const csv = [headers, ...rows].map(row => row.map(value => `"${String(value ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `agci-comparador-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }

  function message(text, kind = "normal") {
    const target = document.getElementById("equityActionMessage");
    if (!target) return;
    target.textContent = text;
    target.className = kind === "error" ? "error" : "";
  }

  function number(value, digits = 2) {
    return finite(value) ? Number(value).toLocaleString("es-MX", { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '<span class="na" title="Dato no disponible o no aplicable">N/A</span>';
  }

  function percent(value) {
    return finite(value) ? Number(value).toLocaleString("es-MX", { style: "percent", minimumFractionDigits: 1, maximumFractionDigits: 1 }) : '<span class="na" title="Dato no disponible o no aplicable">N/A</span>';
  }

  function money(value) {
    return finite(value) ? Number(value).toLocaleString("es-MX", { style: "currency", currency: "USD", maximumFractionDigits: 2 }) : '<span class="na" title="Precio no disponible bajo la cuota actual">N/A</span>';
  }

  function formatDate(value) {
    if (!value || !Number.isFinite(Date.parse(value))) return "No disponible";
    return new Intl.DateTimeFormat("es-MX", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date(value));
  }

  function qualityLabel(value) {
    return ({ complete: "completa", partial: "parcial", limited: "limitada" })[value] || "no determinada";
  }

  function scoreBand(value) {
    return Number(value) >= 70 ? "good" : Number(value) >= 50 ? "neutral" : "risk";
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build, { once: true });
  else build();
})();
