# Viajes ASC — Fase 1 + Fase 2

Fecha: 2026-08-19

## Alcance

Auditoría real del repositorio y evolución del punto de entrada `Inteligencia de viaje` hacia los dos modos definidos por el Prompt Maestro, sin sustituir módulos existentes.

## Fase 1 — Auditoría

### Arquitectura observada

- Frontend principal de Viajes ASC en `viajes/index.html`, publicado como sitio estático mediante GitHub Pages.
- Navegación superior existente con tres espacios: `Inteligencia de viaje`, `Estancias inteligentes` y `Oportunidades importadas`.
- Asistente desacoplado mediante:
  - `viajes/travel-assistant.js`
  - `viajes/travel-assistant-core.js`
  - `viajes/travel-assistant.css`
- Contrato actual `travel-data-v4`, con perfil normalizado, sanitización, reglas de inquietudes, ranking y persistencia temporal/local.
- Integración del asistente con controles existentes del dashboard mediante `originInput`, fechas, viajeros, habitaciones, presupuesto, moneda e intereses.
- Enriquecimiento opcional mediante `cloudflare/viajes-assistant-worker.js`; el endpoint no está embebido en el HTML y el portal conserva fallback determinista.
- `Estancias inteligentes` mantiene un entorno demostrativo y no debe confundirse con disponibilidad o tarifas en vivo.
- `Oportunidades importadas` permanece desacoplado y no se modifica en esta fase.
- Build CSS con Tailwind; pruebas Node en `tests/*.test.mjs`; scripts de validación/despliegue del worker en `package.json`.
- Publicación web mediante `.github/workflows/pages.yml`, disparada automáticamente con cada push a `main`.

### Hallazgos funcionales

1. El asistente existente combinaba destino abierto, fechas flexibles y búsqueda tradicional dentro de un único cuestionario.
2. No existía una decisión inicial explícita entre `Ya sé cuándo viajo` y `Ayúdame a elegir cuándo viajar`.
3. El flujo heredado obligaba presupuesto y origen para validar el perfil; el nuevo Prompt Maestro define como mínimos del Modo A únicamente destino, llegada y salida.
4. El contrato existente es reutilizable y no requiere ser reemplazado para construir la UX del Motor Inverso.
5. Existe una ruta clara de integración futura: eventos de navegador y objeto de perfil pueden actuar como contrato entre UX, investigación y scoring.
6. El sitio ya dispone de módulos que deberán reutilizarse en fases posteriores: vuelos/costos del dashboard, Estancias Inteligentes, Oportunidades, preferencias, persistencia y alertas.
7. La arquitectura actual aún no constituye un motor de investigación temporal completo: eventos, exposiciones, deportes, disponibilidad y precios en vivo deben incorporarse con fuentes verificadas en fases posteriores.
8. No debe presentarse el Motor Inverso como si ya comparara precios o eventos hasta integrar Fases 3–5.

## Riesgos y controles

- No inventar disponibilidad, eventos, precios o enlaces.
- Mantener los datos temporales por defecto y persistencia local solo con autorización.
- No duplicar Estancias Inteligentes ni Oportunidades.
- Conservar compatibilidad con `travel-data-v4` mientras se añade metadata de planeación.
- Mantener un punto de rollback antes del cambio.

### Punto de rollback

Rama creada antes de la implementación:

`backup/viajes-pre-inteligencia-fechas-2026-08-19`

Base auditada:

`02f27c98a3d4c0b0608ea052678612361d7c1af5`

## Fase 2 — UX implementada

Se evolucionó `viajes/travel-assistant.js` sin modificar la estructura de navegación ni los módulos existentes.

### Nueva entrada

La tarjeta superior ahora se presenta como:

**Inteligencia de Viaje**

Texto:

`Descubra cuándo viajar, qué está ocurriendo durante sus fechas y cómo aprovechar mejor su estancia.`

CTA:

`CREAR VIAJE INTELIGENTE`

### Modo A — Ya sé cuándo viajo

Campos obligatorios:

- Destino
- Fecha de llegada
- Fecha de salida

Campos adicionales reutilizables/opcionales:

- Ciudad de origen
- Viajeros
- Integrantes
- Intereses
- Presupuesto y moneda
- Ritmo
- Hotel
- Zona preferida
- Cabina
- Preferencia de vuelo directo
- Inquietudes
- Comentarios

Al confirmar, el perfil se transfiere a los controles existentes del dashboard y se emite:

`viajes:known-dates-request`

### Modo B — Ayúdame a elegir cuándo viajar

Campos principales:

- Destino
- Ciudad de origen
- Periodo aproximado
- Duración
- Flexibilidad

El flujo prepara un perfil compatible con el contrato existente y añade:

`profile.planning.mode = "inverse_dates"`

También expone:

`window.__VIAJES_ASC_INVERSE_DATE_REQUEST__`

Y emite el evento:

`viajes:inverse-date-request`

Este contrato permite que las Fases 3–5 conecten investigación, generación de ventanas y scoring sin reconstruir la UX.

### Reutilización de datos

El nuevo flujo reutiliza, cuando existen:

- origen
- fechas
- adultos
- menores
- habitaciones
- presupuesto
- moneda
- perfil activo o guardado

### Intereses disponibles

La UX incorpora selección múltiple para cultura, gastronomía, compras, museos, deportes, conciertos, teatro, moda, arte, arquitectura, vida nocturna, experiencias premium, negocios, familia, naturaleza, eventos especiales y descanso.

### Seguridad y trazabilidad

La pantalla final declara expresamente que no se inventarán eventos, precios, disponibilidad ni enlaces y que la investigación posterior deberá conservar fuente, fecha y estado de verificación.

## Estado al cierre de Fase 2

Implementado:

- Entrada `Inteligencia de Viaje`
- Decisión Modo A / Modo B
- Formularios diferenciados
- Reutilización de datos existentes
- Presupuesto opcional
- Preferencias ampliadas
- Perfil compatible con el ecosistema actual
- Contrato de integración para Motor Inverso
- Persistencia temporal/local existente
- Punto de rollback

Pendiente por diseño del Prompt Maestro:

- Fase 3: investigación actualizada de eventos y experiencias
- Fase 4: Experience Score, Opportunity Index, Travel Window Score y Event Premium
- Fase 5: generación y comparación real de ventanas
- Fases 6–13: logística, itinerario, costos, PDF, integración ampliada, QA y verificación integral

## Criterio de publicación

El cambio se integra sobre `main`. El workflow `Deploy AGCI to GitHub Pages` publica automáticamente el contenido del repositorio después de cada push a `main`.
