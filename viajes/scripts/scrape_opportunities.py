#!/usr/bin/env python3
"""Importa oportunidades autorizadas desde HTML local o una URL permitida.

Airbnb y Google Travel/Flights deben consumirse mediante HTML guardado por el
usuario o una API/acuerdo autorizado. Este importador no evade autenticación,
CAPTCHAs, robots.txt ni otras protecciones de acceso.
"""

from __future__ import annotations

import argparse
import json
import logging
import re
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import pandas as pd
import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "oportunidades.html"
DEFAULT_CONFIG = ROOT / "opportunity-selectors.json"
DEFAULT_CSV = ROOT / "data" / "data_dashboard.csv"
DEFAULT_JSON = ROOT / "data" / "data_dashboard.json"
PROTECTED_HOSTS = {
    "airbnb.com", "www.airbnb.com",
    "google.com", "www.google.com", "travel.google.com",
}
USER_AGENT = "ViajesASCOpportunityImporter/1.0 (+authorized-data-import)"


def load_selectors(path: Path) -> dict[str, str]:
    defaults = {
        "card": "[data-opportunity], .opportunity, .listing, .offer",
        "name": "[data-name], .name, .title, h2, h3",
        "price": "[data-price], .price, .amount",
        "rating_or_airline": "[data-rating], .rating, .airline",
        "link": "a[href]",
    }
    if not path.exists():
        return defaults
    configured = json.loads(path.read_text(encoding="utf-8"))
    return {**defaults, **{key: value for key, value in configured.items() if value}}


def fetch_html(source: str, timeout: int = 25) -> tuple[str, str]:
    parsed = urlparse(source)
    if parsed.scheme in {"http", "https"}:
        host = (parsed.hostname or "").lower()
        if host in PROTECTED_HOSTS or any(host.endswith(f".{item}") for item in PROTECTED_HOSTS):
            raise ValueError(
                "La extracción directa de Airbnb/Google está deshabilitada. "
                "Use HTML guardado manualmente o una API autorizada."
            )
        response = requests.get(
            source,
            headers={"User-Agent": USER_AGENT, "Accept": "text/html,application/xhtml+xml"},
            timeout=timeout,
        )
        response.raise_for_status()
        if "html" not in response.headers.get("content-type", "").lower():
            raise ValueError("La URL no devolvió contenido HTML.")
        return response.text, source

    path = Path(source).expanduser().resolve()
    return path.read_text(encoding="utf-8"), path.as_uri()


def parse_price(raw: str | None) -> float | None:
    if not raw:
        return None
    cleaned = re.sub(r"[^\d,.-]", "", raw).strip()
    if not cleaned:
        return None
    comma, dot = cleaned.rfind(","), cleaned.rfind(".")
    if comma > dot:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    else:
        cleaned = cleaned.replace(",", "")
    try:
        return float(cleaned)
    except ValueError:
        return None


def first_text(card, selector: str, data_attribute: str | None = None) -> str:
    if data_attribute and card.has_attr(data_attribute):
        return str(card.get(data_attribute, "")).strip()
    node = card.select_one(selector)
    if node is None:
        return ""
    if data_attribute and node.has_attr(data_attribute):
        return str(node.get(data_attribute, "")).strip()
    return node.get_text(" ", strip=True)


def extract_opportunities(html: str, base_url: str, selectors: dict[str, str]) -> list[dict]:
    soup = BeautifulSoup(html, "html.parser")
    rows: list[dict] = []
    for card in soup.select(selectors["card"]):
        link_node = card.select_one(selectors["link"])
        name = first_text(card, selectors["name"], "data-name")
        raw_price = first_text(card, selectors["price"], "data-price")
        rating = first_text(card, selectors["rating_or_airline"], "data-rating")
        href = card.get("data-url") or (link_node.get("href") if link_node else "")
        if not name:
            continue
        rows.append(
            {
                "name": name,
                "price": parse_price(raw_price),
                "rating_or_airline": rating or "Por verificar",
                "url": urljoin(base_url, href) if href else "",
                "source": urlparse(base_url).hostname or "HTML local",
            }
        )
    return rows


def write_outputs(rows: list[dict], csv_path: Path, json_path: Path, source: str) -> None:
    columns = ["name", "price", "rating_or_airline", "url", "source"]
    frame = pd.DataFrame(rows, columns=columns)
    csv_path.parent.mkdir(parents=True, exist_ok=True)
    json_path.parent.mkdir(parents=True, exist_ok=True)
    frame.to_csv(csv_path, index=False, encoding="utf-8")
    payload = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "source": source,
        "count": int(len(frame)),
        "items": frame.where(pd.notnull(frame), None).to_dict(orient="records"),
    }
    json_path.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")


def run_once(source: str, config: Path, csv_path: Path, json_path: Path) -> int:
    try:
        html, base_url = fetch_html(source)
        rows = extract_opportunities(html, base_url, load_selectors(config))
        parsed_source = urlparse(source)
        source_label = parsed_source.hostname or Path(source).name
        write_outputs(rows, csv_path, json_path, source_label)
        logging.info("Se exportaron %s oportunidades.", len(rows))
        return len(rows)
    except (OSError, ValueError, requests.RequestException, json.JSONDecodeError) as error:
        logging.error("No fue posible procesar oportunidades: %s", error)
        raise


def run_daily(source: str, config: Path, csv_path: Path, json_path: Path, hour: int = 6) -> None:
    """Ejecuta el proceso una vez al día a la hora local indicada."""
    while True:
        now = datetime.now().astimezone()
        if now.hour == hour:
            try:
                run_once(source, config, csv_path, json_path)
            except Exception:  # El registro conserva el error y el ciclo continúa.
                logging.exception("Falló la actualización diaria.")
            time.sleep(3600)
        time.sleep(60)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default=str(DEFAULT_INPUT), help="Archivo HTML local o URL autorizada.")
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--csv", type=Path, default=DEFAULT_CSV)
    parser.add_argument("--json", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--daily", action="store_true", help="Mantiene el proceso activo y lo ejecuta diariamente.")
    parser.add_argument("--hour", type=int, default=6, choices=range(24), metavar="0-23")
    return parser


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
    args = build_parser().parse_args()
    if args.daily:
        run_daily(args.source, args.config, args.csv, args.json, args.hour)
    else:
        run_once(args.source, args.config, args.csv, args.json)


if __name__ == "__main__":
    main()
