# AGCI WhatsApp Executive Intelligence

## Purpose

Provide timely, traceable and low-noise decision support through WhatsApp without exposing credentials or changing the approved AGCI financial methodology.

## Implemented capabilities

- Secure `POST /alert` delivery through Meta WhatsApp.
- Authenticated `POST /digest` executive brief generated from the market-data endpoint.
- Public `/health`, `/status` and `/source-health` operational checks.
- Scheduled evaluation every hour with local-time delivery windows.
- Default executive brief times: 06:00, 12:00 and 17:00 Mexico City.
- Automation safety switch: disabled by default.
- Source freshness validation before sending a digest.
- Critical data-governance alert if the source is stale.
- Configurable watchlist.
- Quiet hours with critical-alert bypass.
- Optional KV deduplication and history retention.
- Portal links in executive messages.
- Safe public operational status in the AGCI Alert Center.

## Required encrypted secrets

- `WHATSAPP_ACCESS_TOKEN`
- `WHATSAPP_PHONE_NUMBER_ID`
- `WHATSAPP_TO`
- `AGCI_ALERT_API_KEY`

Never store these values in GitHub, frontend JavaScript, screenshots, public documentation or plaintext variables.

## Safe runtime variables

```text
WHATSAPP_TEMPLATE_NAME=hello_world
WHATSAPP_TEMPLATE_LANGUAGE=en_US
AUTOMATION_ENABLED=false
DIGEST_TIMES=06:00,12:00,17:00
MARKET_DATA_URL=https://agci-market-data.proadmexico.workers.dev/
PORTAL_URL=https://alexm3x.github.io/alex-global-currency-intelligence/
WATCHLIST=USD/MXN,EUR/USD,NVDA,NFLX,ORCL,TSLA,COWZ,QQQ
MAX_SOURCE_AGE_MINUTES=180
ALERT_TIMEZONE=America/Mexico_City
QUIET_START=22:00
QUIET_END=07:00
```

## Production activation sequence

1. Create and obtain Meta approval for `agci_market_alert` in `es_MX`.
2. Template body variables must be ordered as:
   - `{{1}}` title
   - `{{2}}` message
   - `{{3}}` severity
3. Set:

```text
WHATSAPP_TEMPLATE_NAME=agci_market_alert
WHATSAPP_TEMPLATE_LANGUAGE=es_MX
```

4. Rotate `AGCI_ALERT_API_KEY` and store it as a Secret.
5. Confirm `/health` reports `deliveryMode: production`.
6. Test authenticated `POST /alert`.
7. Test authenticated `POST /digest`.
8. Only after successful tests set:

```text
AUTOMATION_ENABLED=true
```

## Optional Cloudflare KV bindings

Create two KV namespaces and bind them to the Worker:

- `ALERT_DEDUP`: prevents repeated messages.
- `ALERT_HISTORY`: retains delivery records.

Recommended variables:

```text
DEDUP_TTL_SECONDS=21600
HISTORY_TTL_SECONDS=7776000
```

The Worker remains functional without these bindings, but `/health` will show them as pending.

## Endpoints

### Public

- `GET /health`
- `GET /status`
- `GET /source-health`

These endpoints never return tokens, phone numbers or API keys.

### Authenticated

Header:

```text
x-agci-key: <AGCI_ALERT_API_KEY>
```

- `POST /alert`
- `POST /digest`

Example alert:

```json
{
  "id": "agci-usdmxn-2026-08-03-001",
  "severity": "critical",
  "title": "USD/MXN material change",
  "message": "AGCI score changed materially. Review the updated analysis and invalidation level in the portal."
}
```

## Decision-governance rules

- The WhatsApp layer presents existing AGCI outputs; it does not change scoring or recommendations.
- A stale source blocks the digest and creates a data-governance alert.
- Critical alerts bypass quiet hours.
- Digest and important alerts respect quiet hours.
- Every production message should link to the underlying portal analysis.
- Editorial, methodology, legal and source changes require approval.

## Audit checklist

- Worker responds with HTTP 200 at `/health`.
- `configured` is true.
- `deliveryMode` is production before enabling automation.
- Market source is available and not stale.
- Meta returns a `messageId`.
- Deduplication and history bindings are active where required.
- No secrets appear in Cloudflare plaintext variables.
- Portal Alert Center correctly reports automation and freshness status.
