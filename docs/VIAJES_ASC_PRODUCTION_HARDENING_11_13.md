# VIAJES ASC — PRODUCTION HARDENING 11–13

**Fecha:** 21 de agosto de 2026

## Decisión ejecutiva

La transformación 0–10 queda complementada por una etapa productiva orientada a fiabilidad y ejecución real. El principio rector es: ningún precio, disponibilidad, alerta o estado LIVE puede existir sin una fuente/proveedor realmente configurado.

## Fase 11 — Hardening & Production Reliability

- Gateway de proveedores aislado del Worker de investigación IA.
- CORS limitado a los orígenes públicos autorizados.
- Body limits, timeouts y normalización de errores de proveedor.
- PWA mantiene únicamente shell y recursos same-origin; nunca cachea respuestas de Booking, Duffel, mapas o APIs externas.
- Auditoría específica `audit-viajes-production-hardening.mjs`.
- QA de PR + release gate de producción.

## Fase 12 — Live Provider Integration

### Vuelos — Duffel

Arquitectura preparada para `DUFFEL_ACCESS_TOKEN`.

- Offer Requests para búsqueda de vuelos.
- Respuestas normalizadas con precio/currency/expiry.
- Cada resultado se marca `LIVE` sólo cuando proviene directamente de la respuesta del proveedor.
- Siempre se indica revalidación antes de reservar porque una oferta puede expirar o cambiar.

Referencia oficial: https://duffel.com/docs/api/v2/offer-requests

### Estancias — Booking.com Demand API v3.2

Arquitectura preparada para:

- `BOOKING_DEMAND_TOKEN`
- `BOOKING_AFFILIATE_ID`

Flujo implementado: autocomplete de destino → búsqueda de alojamiento → precio display/total → URL/deep link para continuar en Booking.com.

El Worker está inicialmente en `BOOKING_ENV=sandbox`. El paso a producción requiere credenciales y aprobación del partner de Booking.com.

Referencias oficiales:
- https://developers.booking.com/demand/docs
- https://developers.booking.com/demand/docs/accommodations/search-for-available-properties
- https://developers.booking.com/demand/docs/development-guide/authentication

## Fase 13 — Execution, Alerts & Domain Recovery

### Execution layer

El primer modo productivo es **search, look & redirect**, no checkout propio. Esto reduce riesgo regulatorio, de pagos y de soporte mientras se valida el motor de decisión.

### Alertas

La Watchlist permanece funcional localmente. No se activa una notificación externa hasta que exista un conector real y verificable.

### Copilot Research

Bloqueo actual identificado: `OPENAI_API_KEY` no está configurado como GitHub Secret para el workflow de Viajes ASC. El Worker de investigación conserva fail-safe `assistant_unavailable`.

### Dominio

`https://alexsaldana.com/viajes/` sigue siendo un bloqueo externo de routing/DNS/aplicación y no un error del bundle de Viajes ASC. La ruta GitHub Pages continúa siendo la producción verificable hasta que el host del dominio tenga un rewrite/redirect válido hacia `/viajes/`.

## Secrets necesarios para completar LIVE

| Capacidad | Secret |
|---|---|
| Copilot research | `OPENAI_API_KEY` |
| Flights LIVE | `DUFFEL_ACCESS_TOKEN` |
| Stays LIVE | `BOOKING_DEMAND_TOKEN` + `BOOKING_AFFILIATE_ID` |

No almacenar estos valores en frontend, archivos JSON, código o documentación.

## Criterio de salida

La etapa puede publicarse aun cuando los proveedores estén `UNAVAILABLE`, siempre que:

1. el Gateway esté publicado y saludable;
2. QA y auditoría pasen;
3. el frontend comunique claramente el estado de cada proveedor;
4. no exista fabricación de precios/disponibilidad;
5. Pages siga respondiendo correctamente;
6. cada dependencia externa no configurada quede documentada explícitamente.
