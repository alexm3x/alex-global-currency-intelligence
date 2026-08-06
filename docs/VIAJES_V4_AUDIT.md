# Viajes ASC — auditoría y estabilización travel-data-v4

Fecha de auditoría: 2026-08-06  
Producción auditada: `https://alexm3x.github.io/alex-global-currency-intelligence/viajes/?v=20260806`  
Estado de respaldo: rama y etiqueta `viajes-pre-v4-20260806`, ambas ancladas al commit `24dbe19`.

## Evidencia inicial

- El campo `#budgetInput` se renderizaba con 24 px de ancho en una ventana de 1348 px.
- Una consulta de MXN 25,000 en Business mostraba Estambul (MXN 93,606), Buenos Aires (MXN 79,713) y Tokio (MXN 123,644) sin advertencia presupuestaria.
- La consola registraba repetidamente `Canvas is already in use` sobre `costChart`.
- Tailwind se cargaba desde `cdn.tailwindcss.com` y producía su advertencia explícita de uso no apto para producción.
- Los costos provenían de `Maintained destination baselines adjusted by current FX strength`; los enlaces de Google Travel eran mecanismos de verificación, no cotizaciones observadas.
- La línea base tenía 44 pruebas: 43 aprobadas y 1 fallida (`window.ViajesCurrency` ausente).

## Clasificación de datos

| Elemento | Clasificación | Tratamiento visible |
|---|---|---|
| Tipo de cambio actual | `live` cuando responde el proveedor | Fecha de actualización y estado del pipeline |
| Último set conservado | `cached` | Indicador ámbar `DATOS EN CACHÉ` y fecha |
| Costos de vuelo, hotel y gasto diario | `baseline` | `Baseline ajustado`; nunca se presenta como oferta confirmada |
| Cálculo por viajeros, habitaciones y noches | `estimated` derivado | Desglose y contingencia visibles |
| Históricos sin cobertura | no disponible | No se sustituyen silenciosamente por cotizaciones reales |

## Correcciones implementadas

- Presupuesto con ancho mínimo de 140 px, valor grande visible y resumen con separadores.
- Moneda seleccionable con conversión del presupuesto y de los resultados.
- Adultos, menores, total de viajeros y habitaciones integrados al costo.
- Duración real derivada de las fechas; vuelos escalan por viajero y estancia por habitación/noche.
- Restricción presupuestaria aplicada antes del ranking. Los resultados `outside` quedan fuera del Top 3.
- Estados `within`, `adjusted`, `outside` y `open`, con diferencia absoluta, porcentual y contingencia.
- Un solo propietario Chart.js para `costChart`; la capa visual ya no intenta recrearlo.
- CSS Tailwind compilado y versionado en `viajes/app.css`; se eliminó Tailwind CDN.
- Contrato tolerante a faltantes `travel-data-v4`, con normalización, validación, procedencia y confianza.
- Motor puro `travel-decision-core.js`, probado sin depender del DOM.
- Fallback de último set exitoso en almacenamiento local, marcado como obsoleto y sin dejar el Top 3 en blanco.
- Filtros con `aria-pressed`, controles etiquetados y rutas relativas compatibles con GitHub Pages.

## Pruebas

- `npm test`: 48/48 aprobadas.
- Validación sintáctica de todos los archivos JavaScript y scripts embebidos: aprobada.
- `git diff --check`: sin errores de espacios o parches.
- Búsqueda de credenciales en archivos modificados: sin secretos de producción.
- Caso crítico automatizado: MXN 25,000 no admite un viaje estimado de MXN 90,000.

## Limitaciones abiertas

- Los costos siguen siendo baselines de planeación hasta conectar un proveedor autorizado de vuelos/hoteles.
- No existe todavía benchmark observado con sello de tiempo suficiente para emitir `COMPRAR AHORA`.
- La traza especializada de Core Web Vitals no estuvo disponible en la sesión de auditoría; debe ejecutarse cuando el conector Chrome DevTools esté habilitado.
- El contrato v4 normaliza el payload v2 existente para compatibilidad. La siguiente actualización del generador debe emitir v4 de forma nativa.
