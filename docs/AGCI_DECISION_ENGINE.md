# AGCI Decision Engine

## Filosofía

**Preparar → Valorar → Esperar → Comprar → Revisar**

El motor separa deliberadamente la calidad de una compañía de la calidad de una inversión al precio actual. Su función es organizar evidencia y definir condiciones de actuación, no producir predicciones binarias.

## Estado por fases

### Fase 1 — Preparación y decisión
Implementado:
- pestaña Motor de Decisión;
- universo de hasta 10 acciones;
- Decision Score;
- Preparation Score;
- explicación de factores favorables y frenos;
- Radar de Terreno de Compra;
- distancia al umbral de compra;
- persistencia local de la lista e historial de snapshots.

### Fase 2 — Valoración y terreno
Implementado con datos disponibles:
- Fair Value AGCI por mediana de anclas comparables verificables;
- P/E comparable;
- P/S comparable;
- EV/EBITDA comparable;
- FCF Yield comparable;
- margen de seguridad adaptativo;
- zonas de Alta convicción, Compra atractiva, Compra, Observación, Espera y Sobrevaloración;
- position sizing indicativo condicionado por preparación y riesgo.

No se genera un precio objetivo cuando faltan precio, acciones en circulación o anclas suficientes.

### Fase 3 — Evidencia externa correlacionada
Preparada para integrar, sin mezclar metodologías automáticamente:
- CIAR;
- reportes IBKR importados por el usuario;
- contexto macro AGCI;
- Daily Strategic Briefing;
- cambios de estimaciones y analistas cuando exista fuente autorizada.

### Fase 4 — Aprendizaje histórico
Siguiente evolución:
- persistencia del historial fuera del navegador;
- comparación decisión vs. resultado;
- atribución de errores por valoración, calidad, riesgo y timing;
- revisión sistemática de tesis.

### Fase 5 — Variables modulares
El núcleo acepta pesos como configuración y deberá incorporar variables futuras mediante un contrato estable.

## Contrato de variable futura

```json
{
  "id": "analyst_revisions_90d",
  "name": "Revisiones de analistas 90d",
  "category": "expectations",
  "value": null,
  "score": null,
  "weight": null,
  "source": "",
  "timestamp": "",
  "confidence": null,
  "status": "available|missing|stale|conflict"
}
```

Reglas:
1. Una variable nueva no puede cambiar el score si `value`, `source` o `confidence` no son auditables.
2. `missing` no equivale a cero.
3. `stale` debe reducir confianza, no fabricar actualización.
4. `conflict` debe conservar las fuentes en conflicto y excluir la variable del score hasta resolver gobernanza.
5. Los pesos deben permanecer fuera de la lógica de presentación y sumar 100% en cada versión de metodología publicada.

## Metodología v1 del Decision Score

- Calidad: 20%
- Valoración: 20%
- Crecimiento: 15%
- Rentabilidad: 15%
- Balance: 10%
- Momentum: 5%
- Control de riesgo: 15%

El Preparation Score es independiente y nunca debe sumarse como si fuera una señal de retorno esperado.

## Fair Value AGCI v1

La implementación actual usa anclas relativas al grupo comparable disponible. La estimación central es la mediana de las anclas válidas para reducir sensibilidad a un múltiplo extremo.

Esto es una **estimación relativa**, no un DCF intrínseco completo. Una fase posterior puede añadir DCF, reverse DCF y escenarios Bull/Base/Bear como metodologías separadas, conservando cada salida y sus supuestos sin promediarlas ciegamente.

## Gobernanza

Fuentes actuales:
- SEC EDGAR Company Facts para fundamentales;
- Twelve Data a través del Worker AGCI para cotización;
- comparables sectoriales curados en el Worker AGCI.

Principios:
- nunca sustituir `N/D` por cero;
- no inventar consensos ni forecasts;
- mostrar frescura y estado de caché;
- explicar cada decisión;
- revisar móvil y escritorio antes de publicación;
- cualquier nueva metodología debe llevar versión y pruebas automatizadas.
