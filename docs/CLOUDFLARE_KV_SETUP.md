# Cloudflare KV setup for AGCI alerts

Create two KV namespaces in Cloudflare:

1. `agci-alert-dedup`
2. `agci-alert-history`

Bind them to the Worker with these binding names:

```text
ALERT_DEDUP
ALERT_HISTORY
```

Recommended runtime variables:

```text
DEDUP_TTL_SECONDS=21600
HISTORY_TTL_SECONDS=7776000
```

After deployment, verify `/health` reports:

```json
{
  "deduplication": true,
  "history": true
}
```

These resources are optional. The Worker remains operational without them, but repeated alerts are not persisted across Worker invocations and delivery history is not retained.
