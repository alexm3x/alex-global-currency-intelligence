#!/usr/bin/env python3
"""Build the Viajes ASC travel-intelligence dataset.

The script is dependency-free and designed for GitHub Actions. It uses:
- open.er-api.com for current USD exchange rates (no API key)
- Frankfurter for historical rates when the currency is covered
- maintained baseline cost and connectivity assumptions for comparable travel budgets

It never claims flight or hotel estimates are live bookable fares. Search links are
provided so the user can verify current inventory in Google Travel or the cruise line.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import statistics
import sys
import time
from dataclasses import dataclass, asdict
from datetime import date, datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Iterable
from urllib.error import HTTPError, URLError
from urllib.parse import quote_plus
from urllib.request import Request, urlopen

ROOT = Path(__file__).resolve().parents[1]
OUTPUT_PATH = ROOT / "data" / "destinations.json"
CURRENT_FX_URL = "https://open.er-api.com/v6/latest/USD"
FRANKFURTER_URL = "https://api.frankfurter.dev/v1"
USER_AGENT = "ViajesASC/2.0 (+https://alexm3x.github.io/alex-global-currency-intelligence/viajes/)"

# Fallback rates are only used when the public FX endpoint is unavailable.
# They make the pipeline resilient and are explicitly tagged as fallback in the JSON.
FALLBACK_USD_RATES = {
    "MXN": 17.31, "JPY": 158.02, "TRY": 47.51, "ARS": 1488.45,
    "VND": 26180.0, "THB": 33.40, "KRW": 1440.53, "EGP": 50.84,
    "ZAR": 16.49, "MAD": 9.35, "HUF": 342.0, "CZK": 21.15,
    "MYR": 4.23, "IDR": 16350.0, "EUR": 0.867, "SGD": 1.29,
}

# Historical anchors are maintained planning references. When Frankfurter has
# sufficient coverage, the script replaces these anchors with a real 90-day average.
HISTORICAL_ANCHORS = {
    "JPY": 145.0, "TRY": 36.0, "ARS": 1150.0, "VND": 25500.0,
    "THB": 34.5, "KRW": 1375.0, "EGP": 49.0, "ZAR": 18.2,
    "MAD": 10.0, "HUF": 365.0, "CZK": 23.0, "MYR": 4.50,
    "IDR": 15900.0, "EUR": 0.92, "SGD": 1.34,
}

# Typical volatility fallback by currency. Replaced by calculated 30-day
# annualized volatility when the historical endpoint has enough observations.
VOLATILITY_FALLBACK = {
    "JPY": 9.5, "TRY": 22.0, "ARS": 35.0, "VND": 2.5, "THB": 6.5,
    "KRW": 8.0, "EGP": 18.0, "ZAR": 12.0, "MAD": 4.0, "HUF": 10.0,
    "CZK": 8.0, "MYR": 6.0, "IDR": 6.5, "EUR": 7.0, "SGD": 4.5,
}

@dataclass(frozen=True)
class DestinationSeed:
    id: str
    city: str
    country: str
    currency: str
    airport: str
    kind: str
    tags: tuple[str, ...]
    quality_score: float
    connectivity_score: float
    proximity_score: float
    moderate_daily_usd: float
    luxury_daily_usd: float
    economy_flight_usd: float
    business_flight_usd: float
    route_summary: str
    why_value: str
    seasonality: str
    cruise_provider: str | None = None
    cruise_route: str | None = None

DESTINATIONS: tuple[DestinationSeed, ...] = (
    DestinationSeed("tokyo-japan", "Tokio", "Japón", "JPY", "NRT", "urban", ("cultura","gastronomía","tecnología"), 99, 94, 52, 135, 430, 1100, 4200, "MEX–NRT directo o HND con conexión", "Yen históricamente competitivo y calidad urbana excepcional.", "Primavera y otoño ofrecen la mejor combinación de clima y experiencia."),
    DestinationSeed("istanbul-turkey", "Estambul", "Turquía", "TRY", "IST", "urban", ("historia","gastronomía","compras"), 94, 86, 58, 88, 285, 950, 3600, "MEX–IST directo o con escala técnica", "Lira débil, hoteles de lujo eficientes y enorme densidad histórica.", "Abril–mayo y septiembre–octubre."),
    DestinationSeed("buenos-aires-argentina", "Buenos Aires", "Argentina", "ARS", "EZE", "urban", ("cultura","gastronomía","tango"), 88, 97, 78, 76, 265, 850, 3200, "MEX–EZE directo", "Vuelo directo, peso argentino débil y gran oferta cultural.", "Marzo–mayo y agosto–noviembre."),
    DestinationSeed("hanoi-vietnam", "Hanói y Vietnam Central", "Vietnam", "VND", "HAN", "urban", ("historia","gastronomía","naturaleza"), 91, 68, 34, 66, 225, 1250, 4600, "MEX–HAN con 1–2 escalas", "Costo diario muy bajo y experiencia cultural de alta intensidad.", "Octubre–abril; evitar picos de lluvia regional."),
    DestinationSeed("bangkok-thailand", "Bangkok", "Tailandia", "THB", "BKK", "urban", ("gastronomía","bienestar","compras"), 96, 73, 35, 72, 255, 1200, 4500, "MEX–BKK con 1 escala lógica", "Lujo accesible, excelente hotelería y amplia conectividad regional.", "Noviembre–febrero; septiembre es más barato pero lluvioso."),
    DestinationSeed("seoul-korea", "Seúl", "Corea del Sur", "KRW", "ICN", "urban", ("cultura","tecnología","gastronomía"), 97, 94, 50, 102, 325, 1100, 4300, "MEX–ICN directo", "Vuelo directo, won competitivo y hotelería más eficiente que Tokio.", "Abril–mayo y septiembre–noviembre."),
    DestinationSeed("cairo-egypt", "El Cairo", "Egipto", "EGP", "CAI", "urban", ("historia","arqueología","lujo"), 89, 73, 53, 70, 235, 1050, 4000, "MEX–CAI con 1 escala", "Patrimonio irrepetible y estructura hotelera atractiva.", "Octubre–abril; septiembre puede ofrecer valor adicional."),
    DestinationSeed("cape-town-south-africa", "Ciudad del Cabo", "Sudáfrica", "ZAR", "CPT", "beach", ("naturaleza","vino","gastronomía"), 96, 64, 30, 112, 365, 1300, 4800, "MEX–CPT con 1 escala", "Naturaleza y gastronomía de clase mundial con rand favorable.", "Septiembre–abril."),
    DestinationSeed("marrakech-morocco", "Marrakech", "Marruecos", "MAD", "RAK", "urban", ("historia","diseño","bienestar"), 90, 72, 57, 96, 335, 1150, 4200, "MEX–RAK con 1 escala", "Riads, diseño y lujo experiencial a menor costo que Europa occidental.", "Marzo–mayo y septiembre–noviembre."),
    DestinationSeed("budapest-hungary", "Budapest", "Hungría", "HUF", "BUD", "urban", ("historia","termales","gastronomía"), 90, 78, 55, 96, 305, 1000, 3900, "MEX–BUD con 1 escala", "Capital europea con costo inferior a París, Londres o Viena.", "Abril–junio y septiembre–octubre."),
    DestinationSeed("prague-czechia", "Praga", "Chequia", "CZK", "PRG", "urban", ("historia","arquitectura","gastronomía"), 92, 78, 54, 115, 345, 1000, 3900, "MEX–PRG con 1 escala", "Alta calidad histórica con costos aún inferiores a Europa occidental.", "Abril–mayo y septiembre–octubre."),
    DestinationSeed("kuala-lumpur-malaysia", "Kuala Lumpur", "Malasia", "MYR", "KUL", "urban", ("gastronomía","compras","lujo"), 88, 68, 32, 76, 245, 1250, 4500, "MEX–KUL con 1–2 escalas", "Hotelería cinco estrellas excepcionalmente competitiva.", "Febrero–agosto, según patrón de lluvias."),
    DestinationSeed("bali-indonesia", "Bali", "Indonesia", "IDR", "DPS", "beach", ("playa","bienestar","naturaleza"), 93, 62, 28, 92, 325, 1300, 4800, "MEX–DPS con 1–2 escalas", "Villas, bienestar y gastronomía con fuerte valor por dólar.", "Mayo–septiembre; hombros de temporada para mejor precio."),
    DestinationSeed("lisbon-portugal", "Lisboa", "Portugal", "EUR", "LIS", "urban", ("historia","gastronomía","costa"), 91, 84, 68, 132, 395, 950, 3600, "MEX–LIS con 1 escala", "Calidad europea y conectividad razonable, aunque hotelería elevada.", "Marzo–mayo y octubre–noviembre."),
    DestinationSeed("athens-greece", "Atenas", "Grecia", "EUR", "ATH", "urban", ("historia","islas","crucero"), 92, 81, 59, 126, 385, 1000, 3700, "MEX–ATH con 1 escala", "Puerta eficiente al Mediterráneo oriental y a itinerarios de crucero.", "Abril–junio y septiembre–octubre."),
    DestinationSeed("cruise-southeast-asia", "Crucero Sudeste Asiático", "Singapur–Tailandia–Vietnam", "SGD", "SIN", "cruise", ("crucero","gastronomía","playa"), 91, 72, 31, 195, 480, 1250, 4600, "MEX–SIN y embarque regional", "Combina varias monedas competitivas en un solo itinerario.", "Noviembre–marzo.", "Royal Caribbean / Celebrity", "Singapur–Penang–Phuket–Vietnam"),
    DestinationSeed("cruise-eastern-med", "Crucero Mediterráneo Oriental", "Grecia–Turquía", "EUR", "ATH", "cruise", ("crucero","historia","islas"), 94, 82, 58, 210, 540, 1000, 3900, "MEX–ATH o MEX–IST", "Gran densidad histórica y acceso a puertos con monedas o costos favorables.", "Abril–junio y septiembre–octubre.", "Royal Caribbean / Celebrity", "Atenas–Santorini–Mykonos–Estambul"),
    DestinationSeed("cruise-japan-korea", "Crucero Japón y Corea", "Japón–Corea del Sur", "JPY", "NRT", "cruise", ("crucero","cultura","gastronomía"), 95, 88, 45, 220, 570, 1100, 4300, "MEX–NRT/ICN y embarque", "Aprovecha yen y won competitivos con transporte marítimo integrado.", "Abril–mayo y septiembre–noviembre.", "Celebrity / Royal Caribbean", "Yokohama–Busan–Nagasaki"),
    DestinationSeed("cruise-explora-east-med", "Explora I Mediterráneo Oriental", "Turquía–Grecia–Adriático", "EUR", "IST", "cruise", ("crucero","ultralujo","historia"), 96, 79, 56, 390, 920, 1050, 3900, "MEX–IST o MEX–ATH", "Ultralujo con itinerarios de alto valor cultural y menor fricción logística.", "Mayo–octubre.", "Explora Journeys", "Estambul–Atenas–Dubrovnik"),
    DestinationSeed("cruise-south-america", "Crucero Cono Sur y Patagonia", "Argentina–Uruguay–Chile", "ARS", "EZE", "cruise", ("crucero","naturaleza","gastronomía"), 90, 92, 75, 225, 560, 850, 3300, "MEX–EZE directo y embarque", "El peso argentino mejora el gasto previo y posterior al crucero.", "Noviembre–marzo.", "Celebrity / regional premium", "Buenos Aires–Montevideo–Patagonia"),
)


def http_json(url: str, *, attempts: int = 3, timeout: int = 20) -> dict[str, Any]:
    last_error: Exception | None = None
    for attempt in range(1, attempts + 1):
        request = Request(url, headers={"User-Agent": USER_AGENT, "Accept": "application/json"})
        try:
            with urlopen(request, timeout=timeout) as response:
                if response.status != 200:
                    raise RuntimeError(f"HTTP {response.status} from {url}")
                return json.loads(response.read().decode("utf-8"))
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError, RuntimeError) as exc:
            last_error = exc
            if attempt < attempts:
                time.sleep(2 ** (attempt - 1))
    raise RuntimeError(f"Failed to fetch {url}: {last_error}")


def get_current_rates(offline: bool) -> tuple[dict[str, float], dict[str, Any]]:
    if offline:
        return FALLBACK_USD_RATES.copy(), {"current_fx": "fallback_offline"}
    try:
        payload = http_json(CURRENT_FX_URL)
        rates = {key: float(value) for key, value in payload.get("rates", {}).items()}
        required = set(FALLBACK_USD_RATES)
        missing = sorted(required - set(rates))
        if "MXN" not in rates:
            raise RuntimeError("Current FX payload does not include MXN")
        for code in missing:
            rates[code] = FALLBACK_USD_RATES[code]
        return rates, {
            "current_fx": "live",
            "current_fx_source": CURRENT_FX_URL,
            "fallback_currencies": missing,
            "provider_updated_utc": payload.get("time_last_update_utc"),
        }
    except Exception as exc:  # noqa: BLE001 - resilience is intentional in scheduled pipeline
        return FALLBACK_USD_RATES.copy(), {
            "current_fx": "fallback_after_error",
            "current_fx_error": str(exc),
        }


def get_history(currency: str, offline: bool, days: int = 90) -> tuple[list[dict[str, Any]], str]:
    if offline:
        return [], "offline"
    end = date.today()
    start = end - timedelta(days=days)
    url = f"{FRANKFURTER_URL}/{start.isoformat()}..{end.isoformat()}?base=USD&symbols={currency}"
    try:
        payload = http_json(url, attempts=2)
        raw_rates = payload.get("rates", {})
        points = []
        for day, values in sorted(raw_rates.items()):
            value = values.get(currency)
            if value is not None:
                points.append({"date": day, "local_per_usd": round(float(value), 6)})
        if len(points) < 10:
            return [], "insufficient_coverage"
        return points, "live_frankfurter"
    except Exception:
        return [], "unavailable"


def annualized_volatility(history: list[dict[str, Any]], fallback: float) -> float:
    values = [float(point["local_per_usd"]) for point in history if point.get("local_per_usd")]
    if len(values) < 10:
        return fallback
    returns = [(values[i] / values[i - 1]) - 1 for i in range(1, len(values)) if values[i - 1] != 0]
    if len(returns) < 5:
        return fallback
    return round(statistics.stdev(returns) * math.sqrt(252) * 100, 2)


def clamp(value: float, low: float = 0.0, high: float = 100.0) -> float:
    return max(low, min(high, value))


def build_google_links(origin: str, airport: str, city: str, kind: str, cruise_provider: str | None) -> dict[str, str]:
    start = date.today() + timedelta(days=90)
    end = start + timedelta(days=7)
    flights_economy = (
        "https://www.google.com/travel/flights?q="
        + quote_plus(f"Flights from {origin} to {airport} {start.isoformat()} through {end.isoformat()} economy")
    )
    flights_business = (
        "https://www.google.com/travel/flights?q="
        + quote_plus(f"Flights from {origin} to {airport} {start.isoformat()} through {end.isoformat()} business class")
    )
    hotels = (
        "https://www.google.com/travel/search?q="
        + quote_plus(f"Hotels in {city} {start.isoformat()} through {end.isoformat()}")
    )
    links = {
        "default_start": start.isoformat(),
        "default_end": end.isoformat(),
        "google_flights_economy": flights_economy,
        "google_flights_business": flights_business,
        "google_hotels": hotels,
    }
    if kind == "cruise" and cruise_provider:
        provider_query = quote_plus(f"{cruise_provider} {city} 2026 cruise")
        links["cruise_search"] = f"https://www.google.com/search?q={provider_query}"
    return links


def build_dataset(offline: bool) -> dict[str, Any]:
    now = datetime.now(timezone.utc)
    current_rates, source_status = get_current_rates(offline)
    usd_mxn = float(current_rates["MXN"])
    histories: dict[str, list[dict[str, Any]]] = {}
    history_status: dict[str, str] = {}

    currencies = sorted({destination.currency for destination in DESTINATIONS})
    for currency in currencies:
        history, status = get_history(currency, offline)
        histories[currency] = history[-45:]
        history_status[currency] = status

    records: list[dict[str, Any]] = []
    for seed in DESTINATIONS:
        current = float(current_rates.get(seed.currency, FALLBACK_USD_RATES[seed.currency]))
        full_history = histories.get(seed.currency, [])
        historical_values = [float(point["local_per_usd"]) for point in full_history]
        historical_average = (
            statistics.fmean(historical_values)
            if len(historical_values) >= 10
            else HISTORICAL_ANCHORS[seed.currency]
        )
        fx_ratio = current / historical_average if historical_average else 1.0
        fx_advantage_pct = (fx_ratio - 1) * 100
        if fx_advantage_pct >= 5:
            traffic_light = "green"
            traffic_label = "Oportunidad cambiaria"
        elif fx_advantage_pct <= -3:
            traffic_light = "red"
            traffic_label = "Moneda local fuerte"
        else:
            traffic_light = "amber"
            traffic_label = "Neutral / vigilar"

        volatility = annualized_volatility(full_history, VOLATILITY_FALLBACK[seed.currency])
        fx_score = clamp(50 + fx_advantage_pct * 4 - max(0, volatility - 10) * 0.35)
        moderate_daily_usd = seed.moderate_daily_usd / max(0.72, fx_ratio)
        luxury_daily_usd = seed.luxury_daily_usd / max(0.72, fx_ratio)
        moderate_daily_mxn = round(moderate_daily_usd * usd_mxn)
        luxury_daily_mxn = round(luxury_daily_usd * usd_mxn)
        economy_flight_mxn = round(seed.economy_flight_usd * usd_mxn)
        business_flight_mxn = round(seed.business_flight_usd * usd_mxn)
        moderate_total_mxn = economy_flight_mxn + moderate_daily_mxn * 7
        business_total_mxn = business_flight_mxn + luxury_daily_mxn * 7
        price_score = clamp(100 - ((moderate_total_mxn - 25000) / 900))
        volatility_safety = clamp(100 - volatility * 2.2)
        roi_score = round(
            seed.quality_score * 0.30
            + fx_score * 0.25
            + price_score * 0.20
            + seed.connectivity_score * 0.15
            + volatility_safety * 0.10,
            1,
        )
        value_for_money = round(clamp(roi_score / 10, 1, 10), 1)

        record = {
            **asdict(seed),
            "tags": list(seed.tags),
            "current_local_per_usd": round(current, 6),
            "current_local_per_mxn": round(current / usd_mxn, 6),
            "historical_average_local_per_usd": round(historical_average, 6),
            "fx_advantage_pct": round(fx_advantage_pct, 2),
            "fx_score": round(fx_score, 1),
            "traffic_light": traffic_light,
            "traffic_label": traffic_label,
            "volatility_annualized_pct": volatility,
            "history_status": history_status.get(seed.currency, "unavailable"),
            "fx_trend": full_history,
            "moderate_daily_mxn": moderate_daily_mxn,
            "luxury_daily_mxn": luxury_daily_mxn,
            "economy_flight_mxn": economy_flight_mxn,
            "business_flight_mxn": business_flight_mxn,
            "moderate_total_7n_mxn": moderate_total_mxn,
            "business_total_7n_mxn": business_total_mxn,
            "price_score": round(price_score, 1),
            "roi_score": roi_score,
            "value_for_money": value_for_money,
            "google_travel": build_google_links("MEX", seed.airport, seed.city, seed.kind, seed.cruise_provider),
            "estimation_note": "Modelo comparativo; verificar inventario y precio final en los enlaces de búsqueda.",
        }
        records.append(record)

    records.sort(key=lambda item: (item["roi_score"], item["quality_score"]), reverse=True)
    for rank, record in enumerate(records, start=1):
        record["rank"] = rank

    green = sum(1 for record in records if record["traffic_light"] == "green")
    amber = sum(1 for record in records if record["traffic_light"] == "amber")
    red = sum(1 for record in records if record["traffic_light"] == "red")

    return {
        "meta": {
            "schema_version": "2.0.0",
            "generated_at": now.isoformat(),
            "timezone": "UTC",
            "origin_airports": ["MEX", "NLU"],
            "destination_count": len(records),
            "pipeline": "GitHub Actions twice daily",
            "schedule_utc": ["08:00", "20:00"],
            "offline_generation": offline,
        },
        "source_status": {
            **source_status,
            "historical_fx_source": FRANKFURTER_URL,
            "history_by_currency": history_status,
            "cost_model": "Maintained destination baselines adjusted by current FX strength",
            "flight_hotel_model": "Planning estimates; active Google Travel links for verification",
        },
        "methodology": {
            "roi_weights": {
                "destination_quality_pct": 30,
                "fx_opportunity_pct": 25,
                "total_price_pct": 20,
                "connectivity_pct": 15,
                "volatility_safety_pct": 10,
            },
            "traffic_light": {
                "green": "USD buys at least 5% more local currency than the historical reference",
                "amber": "FX position is between -3% and +5% versus the reference",
                "red": "USD buys at least 3% less local currency than the historical reference",
            },
            "budget_horizon": "One traveler, round trip from Mexico, seven nights",
        },
        "market_snapshot": {
            "usd_mxn": round(usd_mxn, 6),
            "green_destinations": green,
            "amber_destinations": amber,
            "red_destinations": red,
        },
        "destinations": records,
    }


def validate(dataset: dict[str, Any]) -> None:
    destinations = dataset.get("destinations")
    if not isinstance(destinations, list) or len(destinations) != 20:
        raise ValueError("Dataset must contain exactly 20 destinations")
    ids = [item.get("id") for item in destinations]
    if len(ids) != len(set(ids)):
        raise ValueError("Destination IDs must be unique")
    for index, item in enumerate(destinations, start=1):
        required = (
            "rank", "city", "country", "roi_score", "traffic_light",
            "moderate_total_7n_mxn", "business_total_7n_mxn", "google_travel",
        )
        missing = [key for key in required if key not in item]
        if missing:
            raise ValueError(f"Destination #{index} missing fields: {missing}")
        if item["traffic_light"] not in {"green", "amber", "red"}:
            raise ValueError(f"Invalid traffic light for {item['id']}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--offline", action="store_true", help="Use fallback FX data and skip network calls")
    parser.add_argument("--output", type=Path, default=OUTPUT_PATH)
    args = parser.parse_args()

    dataset = build_dataset(offline=args.offline)
    validate(dataset)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(dataset, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {len(dataset['destinations'])} destinations to {args.output}")
    print(f"Generated at {dataset['meta']['generated_at']}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
