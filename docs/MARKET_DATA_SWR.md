# AGCI Market Data: Stale-While-Revalidate

## Objective

The market-data Worker must keep the Family Office interface usable when Twelve Data is unavailable, times out, returns an HTTP error, or rejects a request because of quota limits.

## Read path

1. Read the regional Cloudflare Cache API entry for the requested group.
2. If no regional entry exists, read the last-known-good snapshot from `MARKET_DATA_CACHE` KV.
3. A KV snapshot inside the group TTL is served as fresh and warms the regional cache.
4. An older KV snapshot is returned immediately with `isStale: true`; revalidation runs in `ctx.waitUntil()`.
5. If the provider succeeds, the Worker replaces the KV snapshot and both regional cache entries.
6. If the provider fails, the existing KV snapshot remains untouched. The response stays HTTP 200 and contains the last valid quotes.
7. On a KV read outage, the seven-day regional stale entry is the secondary fallback.
8. During rollout, the Worker can read the previous `stale-v2` regional keys and migrate a valid snapshot into KV.

## Response contract

Fresh response:

```json
{
  "isStale": false,
  "cache": {
    "strategy": "stale-while-revalidate",
    "persistentStore": "cloudflare-kv",
    "staleGroups": []
  }
}
```

Degraded response:

```json
{
  "isStale": true,
  "cache": {
    "strategy": "stale-while-revalidate",
    "persistentStore": "cloudflare-kv",
    "staleGroups": ["core", "extended"]
  }
}
```

The HTTP header `X-AGCI-Cache` is `FRESH` or `STALE`. Stale responses use `Cache-Control: no-store` so the browser retries while the Worker revalidates in the background.

## Storage and failure semantics

- KV keys: `market-data:v3:group:core` and `market-data:v3:group:extended`.
- KV snapshots have no expiration. Only a fully successful provider response can replace them.
- Regional stale cache retention is seven days.
- A provider error never deletes or overwrites the last-known-good snapshot.
- A completely cold installation with neither KV nor regional cache correctly returns an error; production should be warmed once after deployment before being considered ready.

## Frontend behavior

When `isStale` is `true`, the market-data status bar shows the amber badge:

> Datos en caché (Servidor origen no disponible)

Quotes remain visible and retain their original provider timestamp.
