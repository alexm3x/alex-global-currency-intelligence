# Viajes ASC — Auditoría visual y sistema base (fases 0–1)

Fecha: 2026-08-22  
Línea base: `86a1b54f6f3a9fc6d07bcb90dc0a01946d4dfbe3`  
Respaldo remoto: `backup/viajes-pre-visual-phase01-2026-08-22`

## Alcance

Esta entrega se limita a la auditoría y al sistema visual base. No cambia datos, fórmulas, fuentes, reglas de negocio ni contratos. La conversión completa de cada gráfica y la producción final del fondo corresponden a las fases 2 y 3.

## Inventario de visualizaciones

| Visualización | Implementación actual | Decisión que soporta | Hallazgo | Tratamiento en fase 1 |
|---|---|---|---|---|
| Costo total comparable | Chart.js, barras agrupadas | Comparar inversión turista vs. business por destino | El título decía “7 noches” aunque la duración puede cambiar; el objetivo no estaba explicado | Título neutral, propósito explícito, etiqueta accesible y contenedor ejecutivo |
| Tendencia FX | Lightweight Charts con SVG de respaldo | Evaluar el momento cambiario del destino seleccionado | La selección nace en las tarjetas, pero el vínculo visual no era evidente; el canvas podía perder semántica al reemplazarse | Propósito explícito, región etiquetada y superficie preparada para la fase 2 |
| Métricas de decisión | Tarjetas numéricas | Entender FX, ahorro, riesgo y señal principal | Profundidad y estados inconsistentes entre módulos | Tokens compartidos de superficie y profundidad |
| Radar de riesgo | Barras de progreso HTML | Resumir impactos y destinos verdes | Correcto para magnitud, pero sin sistema común de elevación | Superficie normalizada; rediseño de jerarquía queda para fase 2 |
| Matriz global | Tabla comparativa | Auditar las 20 alternativas | Alta densidad en móvil y navegación horizontal | Sin cambio estructural en fase 1; se preserva la exactitud tabular |

## Inventario de controles

- Botones principales: oro, pero con sombras y presión diferentes según módulo.
- Botones secundarios: borde oscuro/cian, sin profundidad consistente.
- Tabs, chips, cierres y acciones dinámicas: estilos locales inyectados desde varios archivos JavaScript.
- Estados existentes: `hover`, `active` y `disabled` parciales; foco visible y carga no estaban gobernados por un contrato común.

## Movimiento y fondo

La página ya incluye aurora, retícula en perspectiva, globo, rutas, códigos IATA y horizonte. Los movimientos usan principalmente `transform` y cuentan con `prefers-reduced-motion`, pero faltaban:

- pausa explícita cuando la pestaña no está visible;
- respuesta ambiental muy sutil al puntero fino;
- tokens comunes de duración y curvas;
- reducción global para microinteracciones, no solo para el fondo.

## Riesgos técnicos

1. Los estilos están repartidos entre `tailwind.input.css` y bloques CSS inyectados desde JavaScript.
2. Existen Chart.js y Lightweight Charts en la misma pantalla; cualquier fase 2 debe conservar sus rutas de respaldo.
3. El fondo tiene varias capas animadas; deben mantenerse límites de opacidad, `will-change` selectivo y pausa por visibilidad.
4. El modo `forced-colors` requiere contornos reales, no únicamente sombras.
5. La caché PWA debe versionarse cuando se agreguen activos visuales.

## Sistema visual aprobado en fase 1

- Paleta: azul marino/negro, cian informativo, verde positivo, ámbar preventivo, rojo crítico y oro premium.
- Profundidad: cuatro niveles (`surface`, `raised`, `control`, `overlay`) con luz superior y sombra inferior.
- Movimiento: curva ejecutiva `cubic-bezier(.22,1,.36,1)`, respuesta corta en controles y movimiento ambiental lento.
- Controles: contrato único para reposo, `hover`, foco, presión, deshabilitado y carga.
- Accesibilidad: foco de doble anillo, `prefers-reduced-motion`, `forced-colors` y áreas táctiles mínimas.
- Gráficas: contenido plano y fiel; la sensación 3D se limita al contenedor, cabecera, controles y tooltip.

## Criterios para continuar a fases 2–3

- No alterar valores ni escalas para obtener dramatismo visual.
- Cada gráfica debe declarar: pregunta, lectura principal, unidad, fuente/fecha y acción recomendada.
- Tooltips y animaciones deben ser breves, cancelables y compatibles con teclado.
- El fondo no puede competir con formularios ni reducir el contraste del contenido.
