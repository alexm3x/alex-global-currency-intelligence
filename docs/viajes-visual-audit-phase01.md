# Viajes ASC — Auditoría y transformación visual (fases 0–3)

Fecha: 2026-08-22  
Línea base: `86a1b54f6f3a9fc6d07bcb90dc0a01946d4dfbe3`  
Respaldo remoto: `backup/viajes-pre-visual-phase01-2026-08-22`

Continuación fases 2–3: 2026-08-22

Línea base fases 2–3: `9c4cde951ec0c33e483669ceb8c25a91ef09d977`

Respaldo remoto fases 2–3: `backup/viajes-pre-visual-phase23-2026-08-22`

## Alcance

La primera entrega estableció la auditoría y el sistema visual base. La segunda completa las fases 2 y 3 sin cambiar datos, fórmulas, fuentes, reglas de negocio ni contratos.

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

## Fase 2 — Gráficos intuitivos

- El costo total se convierte en ranking horizontal ascendente con posición visible, valor exacto y resaltado de la alternativa de menor inversión.
- El cálculo respeta la cabina, noches, integrantes y habitaciones seleccionados; no utiliza un total fijo de siete noches.
- Los tooltips explican costo, diferencia frente al líder y estado estimado/caché.
- Cada tarjeta declara unidad, periodo, fuente, actualización, confianza disponible y estado del dato.
- Cada gráfico publica una conclusión textual equivalente para lectores de pantalla.
- La tendencia FX utiliza exclusivamente `fx_trend`; se eliminó la generación de puntos sintéticos cuando falta historia.
- El gráfico FX ofrece periodos 3M, 6M y 12M sobre las observaciones existentes, línea de referencia real y tooltip de fecha/valor.
- Las instancias anteriores se destruyen antes de reconstruirse.

## Fase 3 — Fondo profesional

- Se conservaron las capas existentes de ambiente, aurora, retícula, globo, rutas y horizonte.
- Se añadieron coordenadas, seis nodos de datos, tres señales ejecutivas y un velo de contraste.
- El parallax utiliza como máximo 9 px por puntero y 12 px por desplazamiento vertical; nunca mueve el contenido.
- El movimiento se pausa cuando la pestaña queda oculta.
- `prefers-reduced-motion` inmoviliza las capas y elimina pulsos.
- En móvil, equipos con memoria limitada o ahorro de datos, el sistema activa movimiento limitado y elimina capas no esenciales.
- Las animaciones nuevas utilizan `transform`, `translate`, `opacity` y un número acotado de nodos DOM.

## Riesgos residuales para fases 4–5

1. Los módulos dinámicos que inyectan CSS mantienen estilos locales; la fase 4 deberá adoptar gradualmente los componentes comunes.
2. Lightweight Charts se carga desde un CDN y conserva un SVG de respaldo cuando el proveedor no está disponible.
3. La aplicación se publica actualmente en modo oscuro; la validación integral de un modo claro pertenece a la fase 5.
