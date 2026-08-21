# Viajes ASC — Global Transformation Audit 2026

Fecha de auditoría: 2026-08-21

## Decisión ejecutiva

Viajes ASC ya posee una base funcional superior a la de un portal estático simple: contrato `travel-data-v4`, asistente de viaje, motor inverso de fechas, inteligencia de estancias, oportunidades, multidestino, costos, itinerario, PDF y release gate automatizado. La transformación internacional debe conservar ese núcleo y cambiar prioritariamente la experiencia de entrada, la arquitectura visual y la personalización progresiva.

La estrategia aprobada es **evolución aditiva**, no reescritura total.

## Estado comprobado

- Repositorio: `alexm3x/alex-global-currency-intelligence`.
- Rama productiva: `main`.
- Publicación principal: GitHub Pages.
- Ruta productiva auditable: `https://alexm3x.github.io/alex-global-currency-intelligence/viajes/`.
- QA de release existente: 75 checks aprobados en la última evidencia revisada.
- Worker `viajes-asc-assistant`: health 200 y CORS operativo en la última evidencia.
- Bloqueadores externos existentes: dominio personalizado `/viajes/` no resuelve la aplicación y research externo del asistente se encuentra en fail-safe.

## Hallazgos priorizados

### P0 — Crítico

No se detectó un fallo P0 del núcleo publicado en la evidencia de release revisada.

### P1 — Alto

1. **Dominio personalizado no entrega Viajes ASC**. `alexsaldana.com/viajes/` aparece como bloqueador externo y devuelve 404 después del redirect.
2. **Investigación web del asistente no operativa**. El sistema preserva fail-safe correctamente, pero limita la promesa de inteligencia en vivo.
3. **Arquitectura de entrada fragmentada**. El usuario entra a una terminal con múltiples módulos antes de recibir una decisión clara y personalizada.
4. **Navegación de producto insuficiente para escala internacional**. El workspace actual organiza Intelligence / Estancias / Importaciones, pero no expresa Descubrir / Planear / Reservar / Mis viajes / Intelligence.

### P2 — Medio

1. Home demasiado orientado a terminal y no suficientemente orientado a intención de viaje.
2. Personalización existente concentrada en el cuestionario; falta una entrada en lenguaje natural visible desde la primera pantalla.
3. Falta navegación móvil persistente de producto.
4. Apariencia predominantemente oscura sin control de preferencia de usuario a nivel de experiencia global.
5. La plataforma tiene múltiples motores maduros, pero su valor se descubre tarde en el recorrido.

### P3 — Mejora

1. Incorporar Command Palette completa en desktop.
2. Consolidar favoritos/watchlist en un Trip Command Center único.
3. Llevar todo el sistema visual a tokens compartidos en vez de estilos históricos distribuidos.
4. Añadir telemetría de conversión para las nuevas acciones rápidas.

## Componentes a conservar

- `travel-data-v4` y contratos derivados.
- Travel Assistant y motor inverso de fechas.
- Travel Intelligence.
- Logistics, itinerary, cost, PDF e integration layers.
- Stays Intelligence.
- Opportunity Engine / importaciones.
- Multi-destination planner.
- Pipeline de actualización y estrategia de caché/fallback.
- QA institucional y verificación de producción.

## Componentes a refactorizar progresivamente

- Navegación superior.
- Home / primera decisión.
- Jerarquía visual del dashboard.
- Sistema de apariencia y tokens.
- Navegación móvil.
- Acceso a módulos existentes desde intención en lenguaje natural.

## Arquitectura objetivo

1. **Experience Shell** — navegación, Design System, responsive, accesibilidad y apariencia.
2. **Intent Layer** — lenguaje natural y progressive profiling.
3. **Travel DNA** — preferencias persistentes y transparentes.
4. **Data Layer** — `travel-data-v4` y normalización.
5. **Provider Layer** — adaptadores independientes.
6. **Intelligence Layer** — ASC Score, Match, Opportunity, Cost Index.
7. **Execution Layer** — flights, stays, experiences, itineraries y PDF.
8. **Monitoring Layer** — watchlists y alertas.

## Fase 1 implementada en esta rama

Se crea una capa `asc-global-experience.js` que no reemplaza los motores existentes y añade:

- navegación global orientada al ciclo del viajero;
- command center en lenguaje natural;
- ocho acciones rápidas conectadas a funcionalidades reales;
- jerarquía Home más cercana a un producto internacional;
- selector Auto / Oscuro / Claro;
- navegación móvil persistente;
- skip link y mejoras de focus visible;
- respeto a `prefers-reduced-motion`;
- puente del texto natural hacia el cuestionario existente sin inventar resultados;
- eventos `viajes:global-navigation` y `viajes:natural-language-intent` preparados para analytics posteriores.

## Criterios de aceptación de Fase 1

- No romper ningún ID ni contrato existente.
- No alterar el cálculo de precios, FX, scores o disponibilidad.
- No ocultar los disclosures de datos sintéticos.
- Todas las nuevas acciones deben tener destino funcional.
- Mobile navigation debe respetar safe-area.
- Apariencia debe persistir localmente y soportar preferencia del sistema.
- Reduced motion debe respetarse.
- JavaScript nuevo debe pasar validación sintáctica antes de merge.
- El Pages release gate existente debe aprobar después del merge.

## Siguiente bloque recomendado

**Fase 2 — Personalization Foundation**: convertir el perfil existente en `ASC Travel DNA`, separar preferencias permanentes de contexto del viaje, crear onboarding de cinco preguntas y Guest Mode explícito, manteniendo consentimiento y edición de preferencias.
