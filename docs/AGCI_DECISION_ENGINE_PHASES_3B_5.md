# AGCI Decision Engine — Fases 3B, 4 y 5

## Fase 3B — CIAR automático

Objetivo: eliminar la actualización manual del snapshot CIAR sin publicar datos privados de Gmail o IBKR.

Flujo operativo:

1. Gmail privado recibe `FYI: Changes in Analyst Ratings` de IBKR.
2. Se procesan únicamente las filas `SYMBOL@EXCHANGE Buy Outperform Hold Underperform Sell`.
3. El parser determinístico calcula:
   - total de analistas;
   - bullish share;
   - consensus score 1–5;
   - cambio neto ponderado;
   - señal agregada.
4. Se conserva la lectura más reciente por ticker dentro de la ventana de 45 días.
5. Se publica únicamente `data/ciar-latest.json` sanitizado.
6. Nunca se publican Gmail message IDs, correo de la cuenta, Account(s), posiciones, balances ni órdenes.

El parser canónico es `scripts/parse-ibkr-ratings.mjs`.

La sincronización externa se ejecuta mediante el agente conectado Gmail → GitHub. El repositorio no contiene credenciales Gmail.

## Fase 4 — Learning Loop

Objetivo: medir la calidad de las decisiones reales en vez de asumir que una metodología mejor explicada es necesariamente mejor.

Workflow: `.github/workflows/decision-learning.yml`.

Frecuencia: días hábiles, después del cierre regular de EE.UU.

Cada snapshot conserva:

- ticker;
- precio observado;
- Fair Value;
- terreno de compra;
- Decision Score;
- Preparation Score;
- margen de seguridad requerido;
- Context Balance;
- lectura CIAR;
- clasificación del Daily Strategic Briefing;
- contexto macro.

Horizontes de evaluación iniciales:

- 1 día;
- 5 días;
- 20 días.

Reglas:

- No se crean precios históricos sintéticos.
- No se hace backfill de decisiones que AGCI no registró realmente.
- Se requieren al menos 5 observaciones por grupo antes de publicar una métrica como medible.
- El precio futuro no se interpreta como “Fair Value correcto”. Sólo sirve para evaluar comportamiento posterior a una decisión.
- `OBSERVAR` no se fuerza a una etiqueta binaria de acierto/error.

El aprendizaje se publica en `data/decision-learning-latest.json`.

## Fase 5 — Variable Governance

Registro: `data/decision-variable-registry.json`.

Estados permitidos:

1. `disabled`
2. `experimental`
3. `validated`
4. `promoted`

Sólo `promoted` puede llevar peso distinto de cero.

Requisitos mínimos para promoción:

- fuente trazable;
- timestamp;
- tratamiento explícito de N/D;
- muestra histórica suficiente;
- utilidad incremental medible;
- control de doble conteo;
- rollback documentado.

El helper `promoteVariable()` exige por código al menos 20 observaciones futuras antes de aceptar una promoción programática.

Variables iniciales validadas como evidencia, peso 0:

- CIAR analyst consensus;
- Daily Strategic Briefing tactical view;
- macro risk regime.

Variables preparadas para el futuro:

- insider activity;
- options flow;
- credit spreads;
- earnings transcript change detection;
- institutional flows.

## Principio de gobernanza

Fase 3 añade contexto.

Fase 4 mide si ese contexto ayudó.

Fase 5 permite que una variable gane influencia únicamente si la evidencia histórica justifica la promoción.

La complejidad no recibe peso por existir.
