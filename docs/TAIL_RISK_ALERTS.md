# AGCI Tail Risk Alerts

## Objetivo

El Worker de datos de mercado evalúa 21 economías —17 divisas únicas porque cinco economías usan EUR— y detecta cambios abruptos en precio y momentum sin utilizar los scores demostrativos del frontend.

## Metodología auditable

Todos los precios se normalizan como unidades de moneda local por USD. En EUR, GBP y AUD se invierte el par provisto por Twelve Data; el momentum también cambia de signo para conservar la misma dirección económica. Para Estados Unidos se usa una cesta AGCI sintética —media geométrica de CNY, EUR, JPY, INR y GBP normalizados, con mediana de momentum— para no depender de la disponibilidad de DXY en el plan contratado.

Para cada divisa y bloque de actualización:

```text
retorno_t = 100 × (precio_t / precio_t-1 − 1)
Z_precio = (retorno_t − media histórica de retornos) / desviación histórica
Z_momentum = (momentum_t − media histórica de momentum) / desviación histórica
Score_t = limitar[0,100](50 + 10 × (0.65 × Z_precio + 0.35 × Z_momentum))
cambio_% = 100 × (Score_t − Score_t-1) / máximo(|Score_t-1|, 1)
```

Se genera un evento si `|cambio_%| > 15%` y el movimiento equivale al menos a cinco puntos. La alerta conserva Z-Score de precio, Z-Score de momentum, cambio porcentual, cambio en puntos, timestamp y divisa.

El historial requiere seis muestras mínimas. Con el ciclo normal, el sistema entra en régimen de alertamiento aproximadamente 48 horas después de la primera ejecución; durante el calentamiento sólo captura observaciones y no emite falsos positivos.

## Control de cuota

Twelve Data Basic permite ocho créditos por minuto. El universo se divide en tres lotes de 6, 6 y 5 divisas:

```text
0 */6 * * *
2 */6 * * *
4 */6 * * *
```

Cada divisa externa se consulta de forma individual para conservar compatibilidad con el plan Basic y consume un crédito. La cesta USD reutiliza cinco respuestas y no consume un crédito adicional. Los tres disparadores forman un solo ciclo lógico cada seis horas sin exceder el límite por minuto. Un error de cobertura en una divisa no cancela las demás.

## Persistencia y entrega

`TAIL_RISK_STATE` conserva:

- Historial rodante de 64 observaciones por divisa.
- Outbox de alertas pendientes; una falla de webhook no elimina el evento.
- Deduplicación por evento y canal durante siete días.

Cada webhook tiene timeout de diez segundos y hasta tres intentos con espera exponencial. Los logs son JSON estructurado y nunca incluyen tokens ni URLs privadas.

Las ejecuciones manuales y programadas se normalizan al mismo bloque UTC de seis horas. Si un bloque ya fue registrado para una divisa, una llamada repetida no agrega una observación duplicada ni altera su distribución histórica.

## Secretos requeridos

Configurar siempre:

```bash
npx wrangler secret put TWELVE_DATA_API_KEY --config wrangler.market-data.jsonc
npx wrangler secret put AGCI_TAIL_RISK_API_KEY --config wrangler.market-data.jsonc
```

Configurar al menos un proveedor:

```bash
# Telegram
npx wrangler secret put TELEGRAM_BOT_TOKEN --config wrangler.market-data.jsonc
npx wrangler secret put TELEGRAM_CHAT_ID --config wrangler.market-data.jsonc

# Discord
npx wrangler secret put DISCORD_WEBHOOK_URL --config wrangler.market-data.jsonc

# Slack
npx wrangler secret put SLACK_WEBHOOK_URL --config wrangler.market-data.jsonc
```

Los valores se ingresan de forma interactiva. No deben incluirse en GitHub, `wrangler.market-data.jsonc`, capturas o variables públicas.

En `wrangler.market-data.jsonc`, `TAIL_RISK_CHANNELS` determina los canales solicitados:

```json
"TAIL_RISK_CHANNELS": "telegram,discord,slack"
```

Sólo se utiliza un canal si sus secretos están completos. Puede mantenerse uno o combinar varios.

## Validación y despliegue

```bash
npm run check:market
npm run deploy:market
```

Wrangler 4.119 o superior crea automáticamente el namespace KV en el primer despliegue y escribe su ID en el archivo de configuración local.

Estado operativo seguro:

```http
GET /tail-risk/status
```

Ejecución manual autenticada, un shard por llamada:

```http
POST /tail-risk/run?shard=0
x-agci-key: <AGCI_TAIL_RISK_API_KEY>
```

No se debe lanzar manualmente más de un shard dentro del mismo minuto.
