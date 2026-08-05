# Alex Global Currency Intelligence

## Datos estructurales automáticos

AGCI mantiene una instantánea auditable en `data/macro-latest.json` y deriva el registro visible en `data/sources.json`. La automatización `.github/workflows/update-structural-data.yml` se ejecuta cada seis horas y conecta:

- World Bank WDI: inflación, crecimiento real y cuenta corriente.
- BIS: tasas de política monetaria y tipo de cambio efectivo real (REER).
- Cboe: VIX diario y régimen de volatilidad calculado por AGCI.

El estado “Conectado” se genera únicamente cuando la extracción y el contrato de cada proveedor son válidos. Ante una interrupción se conserva la última observación válida, se registra el error y el proveedor cambia a “Degradado”. Para ejecutar la actualización manualmente: `npm run update:data`.

Sitio editorial público de inteligencia cambiaria global.

## Estado
- Frontend editorial publicado en la rama `main`.
- Workflow de GitHub Pages incluido en `.github/workflows/pages.yml`.
- Datos actuales: demostrativos; no constituyen recomendaciones de inversión.

## Auditoría inicial
Revisar accesibilidad, navegación móvil, textos, metodología, fuentes y sustitución de datos demo por fuentes verificadas.
