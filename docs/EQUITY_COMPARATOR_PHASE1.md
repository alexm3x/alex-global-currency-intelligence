# Comparador Fundamental de Acciones — Fase 1

## Alcance

La Fase 1 añade a AGCI un comparador nativo para una lista manual de hasta diez acciones estadounidenses. La lista se conserva en `localStorage`; no se envían preferencias personales a un servidor.

El servicio `agci-equity-fundamentals` separa el análisis accionario de los Workers de mercado y alertas existentes. La fuente fundamental es SEC EDGAR Company Facts. Twelve Data aporta cotizaciones únicamente cuando el secreto `TWELVE_DATA_API_KEY` está configurado y la cuota permite actualizarlas.

## Contrato

`GET /compare?symbols=MSFT,ORCL,CRM`

Respuesta resumida:

```json
{
  "contractVersion": "1.0.0",
  "requestedSymbols": ["MSFT", "ORCL", "CRM"],
  "analyzedSymbols": ["MSFT", "ORCL", "CRM"],
  "invalidSymbols": [],
  "generatedAt": "2026-08-05T00:00:00.000Z",
  "lastSuccessfulUpdate": "2026-08-05T00:00:00.000Z",
  "isStale": false,
  "staleSymbols": [],
  "dataQuality": "partial",
  "analyses": [],
  "errors": []
}
```

Cada análisis contiene la compañía, comparables, medianas, puntuación por componente, confianza, clasificación, comparable preferido, riesgos y una conclusión explicable.

## Periodos y datos faltantes

- Los fundamentales son el último ejercicio anual 10-K disponible.
- No se mezclan estimaciones con datos reportados.
- P/E Forward, PEG y estimaciones se entregan como `null` y se muestran como `N/A`.
- Los ratios con denominadores negativos o inválidos se entregan como `null`.
- Un cero financiero real no se utiliza como sustituto de un dato ausente.

## Comparables

La versión gratuita utiliza grupos de industria estadounidenses curados en `PEER_GROUPS`. La selección prioriza otros símbolos de la lista del usuario que estén en el mismo grupo y completa hasta cinco candidatos con el universo curado. Este universo es explícitamente no exhaustivo y podrá reemplazarse por un clasificador global licenciado sin cambiar el contrato del frontend.

## Puntuación

- Valuación: 30%.
- Crecimiento: 20%.
- Calidad y rentabilidad: 20%.
- Solidez financiera: 20%.
- Momentum disponible: 10%.

Los indicadores se transforman en percentiles dentro del grupo disponible. La confianza combina cobertura fundamental y número de comparables. Una aparente valuación favorable con baja calidad o débil solidez se clasifica como posible trampa de valor.

## Caché y resiliencia

KV conserva el último set exitoso:

- Mapa de símbolos SEC: 24 horas antes de revalidar.
- Company Facts compactados: 6 horas antes de revalidar.
- Cotizaciones: 15 minutos antes de revalidar.

Los datos vencidos se sirven de inmediato con `isStale: true` y se revalidan mediante `ctx.waitUntil()`. El frontend muestra el indicador ámbar correspondiente.

## Despliegue

```bash
npm install
npm test
npm run check:equities
npx wrangler secret put TWELVE_DATA_API_KEY --config wrangler.equity-fundamentals.jsonc
npm run deploy:equities
```

La configuración incluye el entorno separado `staging`. El secreto de Twelve Data nunca debe guardarse en el repositorio.

## Limitaciones conocidas

- Cobertura inicial exclusiva de emisoras registradas ante la SEC.
- Los bancos, REITs y empresas sin utilidades requieren modelos sectoriales adicionales en una fase posterior.
- La cuota gratuita puede dejar algunas cotizaciones como `N/A`; los fundamentales continúan disponibles.
- El comparable preferido es una lectura cuantitativa relativa, no una recomendación automática de compra.
