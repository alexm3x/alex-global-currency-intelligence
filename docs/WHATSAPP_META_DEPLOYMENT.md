# AGCI Meta WhatsApp deployment

The public website never stores WhatsApp credentials or the destination number.

## 1. Meta configuration

Create or select the WhatsApp Business app and obtain:

- Permanent access token
- WhatsApp Phone Number ID
- Approved template: `agci_market_alert`
- Template language: `es_MX`

The template body must contain three variables in this order:

1. Alert title
2. Alert message
3. Severity

## 2. Deploy the Cloudflare Worker

Deploy `workers/agci-alerts-worker.js` as a separate Worker.

Add encrypted secrets:

```text
WHATSAPP_ACCESS_TOKEN
WHATSAPP_PHONE_NUMBER_ID
WHATSAPP_TO
AGCI_ALERT_API_KEY
```

Set `WHATSAPP_TO` directly in Cloudflare using the authorized E.164 destination number. Do not commit it to GitHub.

Recommended variables:

```text
ALLOWED_ORIGINS=https://alexm3x.github.io,https://intelligence.alexmexico.com
WHATSAPP_TEMPLATE_NAME=agci_market_alert
WHATSAPP_TEMPLATE_LANGUAGE=es_MX
ALERT_TIMEZONE=America/Mexico_City
QUIET_START=22:00
QUIET_END=07:00
DEDUP_TTL_SECONDS=21600
```

Optional KV binding:

```text
ALERT_DEDUP
```

## 3. Verify

Open the AGCI **Alerts** tab, enter the deployed Worker base URL and select **Verify Worker**. This calls only the public `/health` route. It does not expose or transmit the private API key.

## 4. Trigger alerts securely

Only trusted server-side jobs may call `POST /alert` with:

```http
x-agci-key: <AGCI_ALERT_API_KEY>
x-alert-id: <unique-event-id>
content-type: application/json
```

Example payload:

```json
{
  "id": "currency-JPY-strong-buy-2026-08-03",
  "severity": "critical",
  "title": "AGCI Critical Alert",
  "message": "JPY crossed the Strong Buy threshold. Review valuation, policy risk and position sizing."
}
```

## Security

Never add Meta tokens, API keys, destination numbers or Phone Number IDs to frontend JavaScript, GitHub issues or commits.
