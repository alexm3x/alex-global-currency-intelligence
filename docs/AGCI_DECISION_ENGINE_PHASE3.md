# AGCI Decision Engine — Fase 3

## Objetivo

Agregar evidencia contextual al Motor de Decisión sin contaminar la valoración ni convertir narrativa en precio objetivo.

## Capas

1. **CIAR / IBKR FYI + Reuters**: consenso agregado, amplitud alcista, cambio neto, tamaño de muestra y frescura. Ventana máxima: 45 días.
2. **Daily Strategic Briefing AGCI**: clasificación, confianza, tesis y catalizadores explícitos por ticker cuando existen.
3. **Macro AGCI**: postura/riesgo del briefing, VIX, media de 20 días, régimen de volatilidad y tasa de política de EE.UU. desde `data/macro-latest.json`.

## Regla metodológica

La Fase 3 no cambia:

- Fair Value AGCI.
- Terreno de compra.
- Margen de seguridad.
- Decision Score base.

Produce un **Context Balance** separado: Soporte fuerte, Soporte, Mixto, Cautela o Cautela alta. Ese balance modifica únicamente la disciplina de ejecución y la lectura de convicción.

## Puntos transparentes

### CIAR
- Strong Positive: +2
- Positive: +1
- Neutral Positive: +0.5
- Mixed / Neutral: 0
- Negative: -1
- Strong Negative: -2
- Fuera de 45 días: 0 y se marca stale.

### Daily Strategic Briefing
- Comprar / Comprar en tramos: +2
- Comprar en corrección: +1
- Mantener / Vigilar: 0
- Reducir: -1
- Evitar: -2
- Catalizador explícito en watch list: -0.5 hasta su resolución.

### Macro
- Riesgo elevado: -1
- Riesgo moderado: -0.5
- Riesgo bajo: +0.5
- VIX bajo: +0.5
- VIX alto: -0.5

## Privacidad

El snapshot público CIAR no contiene IDs de cuenta, correos, posiciones, balances ni órdenes de IBKR. Sólo publica agregados de analistas necesarios para el motor.

## Cobertura incompleta

La ausencia de CIAR o de una tesis específica del Daily Briefing se presenta como N/D. No se sustituye por neutral ni se imputa una señal.

## Proxy GOOG / GOOGL

Cuando el snapshot sólo contiene GOOG y la decisión corresponde a GOOGL, la interfaz identifica explícitamente que se usa un proxy del mismo emisor. No se presenta como dato exacto de la clase solicitada.
