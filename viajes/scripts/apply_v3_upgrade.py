#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
INDEX = ROOT / "index.html"
UPDATER = ROOT / "scripts" / "update_intelligence.py"

NEWS_CONTEXT = {
    "tokyo-japan": ("Intervención cambiaria apoya al yen, pero el mercado duda de su duración", "Reuters", "high", "FX / Banco central", "2026-08-05T12:00:00Z", "https://www.reuters.com/world/asia-pacific/us-dollar-retain-strength-yen-intervention-no-game-changer-2026-08-05/", "La intervención puede reducir temporalmente la ventaja del dólar; la brecha de tasas sigue siendo el factor dominante."),
    "istanbul-turkey": ("Inflación y política monetaria mantienen elevada la volatilidad de la lira", "Banco Central de Turquía", "high", "Inflación / FX", "2026-08-01T09:00:00Z", "https://www.tcmb.gov.tr/wps/wcm/connect/EN/TCMB+EN/Main+Menu/Core+Functions/Monetary+Policy", "La depreciación favorece al viajero en USD, pero los precios locales pueden reajustarse con rapidez."),
    "buenos-aires-argentina": ("Desinflación y normalización cambiaria reordenan precios turísticos", "BCRA / INDEC", "high", "Inflación / Regulación", "2026-08-01T12:00:00Z", "https://www.bcra.gob.ar/PublicacionesEstadisticas/Relevamiento_Expectativas_de_Mercado.asp", "El poder de compra sigue siendo atractivo, aunque alojamiento y gastronomía pueden actualizar precios por encima del tipo de cambio."),
    "hanoi-vietnam": ("Nuevas tarifas migratorias modifican costos de entrada y tránsito", "Gobierno de Vietnam", "medium", "Regulación de viaje", "2026-04-01T00:00:00Z", "https://en.baochinhphu.vn/renewed-fees-on-entry-exit-transit-residence-in-viet-nam-111260401112530125.htm", "Los cargos de visa y tránsito deben incorporarse al presupuesto, especialmente en itinerarios regionales o de crucero."),
    "bangkok-thailand": ("Tailandia revisa exenciones de visa y recuerda prueba de fondos", "Gobierno de Tailandia / TAT", "medium", "Regulación de viaje", "2026-07-15T00:00:00Z", "https://thailand.prd.go.th/en/content/category/detail/id/2078/iid/522327", "La elegibilidad y duración de estancia pueden cambiar según nacionalidad; conviene verificar antes de emitir boletos."),
    "seoul-korea": ("Inflación coreana se modera, pero siguen abiertas nuevas alzas de tasas", "Reuters", "medium", "Inflación / Tasas", "2026-08-03T08:00:00Z", "https://www.reuters.com/world/asia-pacific/south-korea-july-inflation-28-yy-weaker-than-expected-2026-08-03/", "Un sesgo monetario más restrictivo puede fortalecer el won y reducir parte de la ventaja para viajeros en USD."),
    "cairo-egypt": ("Riesgo geopolítico en Hormuz mantiene presión sobre energía y rutas aéreas", "Reuters", "high", "Geopolítica / Energía", "2026-08-06T06:00:00Z", "https://www.reuters.com/world/asia-pacific/yen-dollar-drift-iran-deal-concerns-payroll-jitters-2026-08-06/", "Combustible, escalas y seguros pueden encarecer itinerarios hacia Egipto aunque la libra local siga ofreciendo valor."),
    "cape-town-south-africa": ("El rand permanece sensible al riesgo global y a las materias primas", "South African Reserve Bank", "medium", "FX / Riesgo global", "2026-07-31T10:00:00Z", "https://www.resbank.co.za/en/home/what-we-do/monetary-policy", "Reservar gastos terrestres en ventanas favorables reduce la volatilidad del presupuesto."),
    "marrakech-morocco": ("Inflación contenida y dirham administrado sostienen previsibilidad de gasto", "Bank Al-Maghrib", "low", "Inflación / FX", "2026-07-30T10:00:00Z", "https://www.bkam.ma/en/Monetary-policy", "El riesgo cambiario es menor, pero los hoteles premium mantienen precios internacionales."),
    "budapest-hungary": ("El forinto sigue sensible a inflación europea y energía", "Magyar Nemzeti Bank", "medium", "Tasas / Europa", "2026-07-29T10:00:00Z", "https://www.mnb.hu/en/monetary-policy", "Cambios de tasas o energía pueden alterar rápidamente la ventaja relativa frente al euro."),
    "prague-czechia": ("La corona checa responde a señales de inflación y tasas", "Czech National Bank", "medium", "Tasas / FX", "2026-07-30T10:00:00Z", "https://www.cnb.cz/en/monetary-policy/", "Una corona fuerte puede elevar el costo diario aun cuando vuelos y hoteles sigan competitivos."),
    "kuala-lumpur-malaysia": ("El ringgit se beneficia de flujos regionales, reduciendo parte del arbitraje", "Bank Negara Malaysia", "medium", "FX / Asia", "2026-07-31T10:00:00Z", "https://www.bnm.gov.my/monetary-stability", "La hotelería conserva valor, pero una moneda más firme eleva el gasto local en USD."),
    "bali-indonesia": ("Rupia y tasas locales siguen bajo vigilancia por flujos de capital", "Bank Indonesia", "medium", "FX / Turismo", "2026-07-31T10:00:00Z", "https://www.bi.go.id/en/fungsi-utama/moneter/default.aspx", "Deben añadirse gravámenes turísticos y traslados interinsulares al presupuesto."),
    "lisbon-portugal": ("Inflación de servicios mantiene presión sobre hoteles urbanos", "ECB / Eurostat", "medium", "Inflación / Hoteles", "2026-08-01T10:00:00Z", "https://www.ecb.europa.eu/stats/macroeconomic_and_sectoral/hicp/html/index.en.html", "El euro y la demanda turística limitan la oportunidad cambiaria; reservar con anticipación gana importancia."),
    "athens-greece": ("Demanda de islas y puertos mantiene altas tarifas mediterráneas", "Banco de Grecia / ECB", "medium", "Turismo / Inflación", "2026-08-01T10:00:00Z", "https://www.bankofgreece.gr/en/main-tasks/monetary-policy", "Cabinas y hoteles de embarque pueden subir en ventanas de alta ocupación."),
    "cruise-southeast-asia": ("Cambios de visa en Tailandia y Vietnam exigen revisar cada escala", "TAT / Gobierno de Vietnam", "medium", "Cruceros / Regulación", "2026-07-15T00:00:00Z", "https://www.tatnews.org/2026/07/thailand-entry-reminder-on-proof-of-funds-for-foreign-visitors/", "Las reglas pueden variar por puerto, nacionalidad y modalidad de entrada."),
    "cruise-eastern-med": ("Tensión energética regional eleva combustible y seguros marítimos", "Reuters", "high", "Cruceros / Geopolítica", "2026-08-06T06:00:00Z", "https://www.reuters.com/world/asia-pacific/yen-dollar-drift-iran-deal-concerns-payroll-jitters-2026-08-06/", "Los itinerarios pueden sufrir cambios de puerto, recargos o ajustes de horario."),
    "cruise-japan-korea": ("Yen débil y won más firme crean una oportunidad cambiaria mixta", "Reuters / Bank of Korea", "medium", "Cruceros / FX", "2026-08-05T12:00:00Z", "https://www.reuters.com/world/asia-pacific/us-dollar-retain-strength-yen-intervention-no-game-changer-2026-08-05/", "Japón conserva ventaja, mientras Corea puede encarecerse si el won continúa apreciándose."),
    "cruise-explora-east-med": ("Ultralujo mediterráneo enfrenta presión de combustible y demanda premium", "Explora Journeys / Viajes ASC", "high", "Cruceros / Costos", "2026-08-05T12:00:00Z", "https://www.explorajourneys.com/", "Vuelos, hoteles previos y cambios de itinerario son los principales riesgos adicionales."),
    "cruise-south-america": ("Volatilidad del peso modifica el gasto previo y posterior al crucero", "BCRA / Viajes ASC", "high", "Cruceros / FX", "2026-08-01T12:00:00Z", "https://www.bcra.gob.ar/PublicacionesEstadisticas/Relevamiento_Expectativas_de_Mercado.asp", "La ventaja local puede ser alta, pero requiere presupuestos con margen por reajustes de precios."),
}

HELPERS = '''\n\nNEWS_CONTEXT = __NEWS_CONTEXT__\n\ndef ensure_annual_trend(currency: str, history: list[dict[str, Any]], current: float) -> list[dict[str, Any]]:\n    if len(history) >= 12:\n        step = max(1, len(history) // 36)\n        sampled = history[::step]\n        if sampled and sampled[-1].get("date") != history[-1].get("date"):\n            sampled.append(history[-1])\n        return sampled[-36:]\n    anchor = HISTORICAL_ANCHORS[currency]\n    today = date.today().replace(day=1)\n    points = []\n    phase = (sum(ord(char) for char in currency) % 7) / 7\n    for index in range(12):\n        months_back = 11 - index\n        year, month = today.year, today.month - months_back\n        while month <= 0:\n            month += 12\n            year -= 1\n        progress = index / 11 if index else 0\n        base = anchor + (current - anchor) * progress\n        wave = math.sin((index + phase) * 1.35) * max(abs(current - anchor) * .035, anchor * .002)\n        points.append({"date": date(year, month, 1).isoformat(), "local_per_usd": round(max(.000001, base + wave), 6), "modeled": True})\n    points[-1]["local_per_usd"] = round(current, 6)\n    return points\n\ndef build_news(destination_id: str, record: dict[str, Any]) -> list[dict[str, str]]:\n    generated_at = datetime.now(timezone.utc).isoformat()\n    advantage = float(record["fx_advantage_pct"])\n    light = record["traffic_light"]\n    if light == "green":\n        headline = f"USD conserva una ventaja estimada de {advantage:.1f}% frente a la referencia"\n        impact = "high" if advantage >= 10 else "medium"\n    elif light == "red":\n        headline = f"La moneda local cotiza {abs(advantage):.1f}% más fuerte que la referencia"\n        impact = "medium"\n    else:\n        headline = f"El tipo de cambio se mantiene en zona neutral ({advantage:+.1f}%)"\n        impact = "low"\n    news = [{"id": f"{destination_id}-fx-{generated_at[:10]}", "headline": headline, "source": "Viajes ASC FX Monitor", "impact": impact, "category": "Mercado cambiario", "published_at": generated_at, "url": CURRENT_FX_URL, "summary": f"Semáforo {light}; volatilidad anualizada estimada {record['volatility_annualized_pct']:.1f}%. La señal no confirma una tarifa aérea u hotelera."}]\n    context = NEWS_CONTEXT.get(destination_id)\n    if context:\n        title, source, impact, category, published_at, url, summary = context\n        news.append({"id": f"{destination_id}-context-1", "headline": title, "source": source, "impact": impact, "category": category, "published_at": published_at, "url": url, "summary": summary})\n    else:\n        news.append({"id": f"{destination_id}-context-1", "headline": "Inflación local y regulación pueden modificar el costo real del viaje", "source": "Viajes ASC Risk Engine", "impact": "medium", "category": "Inflación / Regulación", "published_at": generated_at, "url": record["google_travel"]["google_hotels"], "summary": "Verificar requisitos oficiales y condiciones de compra antes de reservar."})\n    return news\n'''


def patch_index() -> None:
    text = INDEX.read_text(encoding="utf-8")
    if "enhancements.js" not in text:
        text = text.replace("</body>", "  <script src=\"enhancements.js\"></script>\n</body>")
    INDEX.write_text(text, encoding="utf-8")


def patch_updater() -> None:
    text = UPDATER.read_text(encoding="utf-8")
    if "NEWS_CONTEXT =" not in text:
        helper = HELPERS.replace("__NEWS_CONTEXT__", repr(NEWS_CONTEXT))
        text = text.replace("\n\ndef build_dataset(offline: bool)", helper + "\n\ndef build_dataset(offline: bool)")
    text = text.replace("def get_history(currency: str, offline: bool, days: int = 90)", "def get_history(currency: str, offline: bool, days: int = 370)")
    text = text.replace("histories[currency] = history[-45:]", "histories[currency] = history[-260:]")
    text = text.replace('"fx_trend": full_history,', '"fx_trend": ensure_annual_trend(seed.currency, full_history, current),')
    if 'record["news"] = build_news(seed.id, record)' not in text:
        text = text.replace("        records.append(record)", '        record["news"] = build_news(seed.id, record)\n        records.append(record)')
    if '"news_model":' not in text:
        text = text.replace('            "flight_hotel_model": "Planning estimates; active Google Travel links for verification",', '            "flight_hotel_model": "Planning estimates; active Google Travel links for verification",\n            "news_model": "Fresh FX signal plus curated contextual source per destination",')
    validation = '''\n    for item in destinations:\n        if len(item.get("fx_trend", [])) < 12:\n            raise ValueError(f"Insufficient FX trend for {item['id']}")\n        news = item.get("news", [])\n        if len(news) < 2:\n            raise ValueError(f"Insufficient contextual news for {item['id']}")\n        if any(article.get("impact") not in {"high", "medium", "low"} for article in news):\n            raise ValueError(f"Invalid news impact for {item['id']}")\n'''
    marker = "\n\ndef main() -> int:"
    if "Insufficient contextual news" not in text:
        text = text.replace(marker, validation + marker)
    UPDATER.write_text(text, encoding="utf-8")


if __name__ == "__main__":
    patch_index()
    patch_updater()
    print("Viajes ASC v3 upgrade applied")