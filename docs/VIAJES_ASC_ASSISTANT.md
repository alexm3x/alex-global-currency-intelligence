# Asistente de Viaje ASC — implementación vertical

## Estado implementado

La primera versión integra el flujo completo en la parte superior de `viajes/index.html`:

1. cuestionario progresivo de siete pasos;
2. entidad versionada `trip_profile` compatible con `travel-data-v4`;
3. validación de destino, presupuesto, fechas, viajeros y habitaciones;
4. extracción determinista de preferencias y restricciones del comentario abierto;
5. conclusión editable con viabilidad, tensión y estrategia;
6. confirmación explícita antes de consultar los módulos de costo;
7. adaptación automática a los controles existentes del dashboard;
8. ranking con presupuesto previo, inquietudes y coincidencia del destino;
9. tres salidas diferenciadas: Mejor equilibrio, Mejor precio y Mejor experiencia;
10. fallback determinista si OpenAI o una fuente externa no está disponible.

No se duplicó el Home ni se alteraron las pestañas Estancias inteligentes u Oportunidades importadas.

## Mapa de integración

- `viajes/travel-assistant.js`: UI, estado temporal, consentimiento de guardado y adaptador al dashboard.
- `viajes/travel-assistant-core.js`: contrato, sanitización, validación, conclusión, reglas de inquietudes y selección de tres recomendaciones.
- `viajes/travel-assistant.css`: diseño premium, diálogo accesible y experiencia móvil a pantalla completa.
- `viajes/index.html`: punto de entrada y conexión con `applyQuery`, `travel-decision-core` y datos publicados.
- `cloudflare/viajes-assistant-worker.js`: enriquecimiento opcional con OpenAI mediante salida estructurada; no consulta ni inventa precios.
- `wrangler.viajes-assistant.jsonc`: configuración separada, rate limiting y observabilidad.
- `tests/viajes-assistant.test.mjs`: contrato, presupuesto, seguridad, ranking, integración y fallback.

## Privacidad y seguridad

- El perfil es temporal por defecto y permanece en `sessionStorage`.
- Solo se guarda en `localStorage` cuando el usuario lo autoriza.
- No se piden nombres, pasaportes ni datos médicos.
- El comentario se limita a 1,500 caracteres, se sanitiza y nunca se interpreta como instrucción operativa.
- La clave `OPENAI_API_KEY` solo existe como secreto del Worker.
- El Worker valida origen, método, acción, tamaño de cuerpo, perfil y frecuencia; registra métricas sin guardar el perfil.
- Ninguna salida ejecuta reservas, compras o pagos.

## Activación opcional de OpenAI

El portal ya funciona sin OpenAI. Para activar el enriquecimiento:

1. Crear el secreto del Worker: `npx wrangler secret put OPENAI_API_KEY --config wrangler.viajes-assistant.jsonc`.
2. Validar: `npm run check:viajes-assistant`.
3. Desplegar: `npm run deploy:viajes-assistant`.
4. Añadir en `viajes/index.html` un meta tag con la URL desplegada:

   `<meta name="viajes-assistant-api" content="https://URL-DEL-WORKER/">`

La URL no es secreta. Nunca agregar la clave al HTML, JavaScript, configuración o repositorio.

## Respaldo y rollback

El punto de restauración es el commit inmediatamente anterior a esta integración. La función es desacoplada: para rollback se revierten los archivos del asistente y las referencias añadidas a `viajes/index.html`; los módulos y datos existentes no requieren migración.

## Límites deliberados

- OpenAI interpreta el perfil y redacta la conclusión; no genera precios.
- Los costos continúan procediendo de `viajes/data/destinations.json` y de los módulos actuales.
- Si un destino fijo no existe en el universo publicado, el sistema muestra **Búsqueda incompleta** y solicita modificar criterios.
- Los importes baseline, estimados y en caché mantienen su etiqueta y requieren verificación antes de reservar.
