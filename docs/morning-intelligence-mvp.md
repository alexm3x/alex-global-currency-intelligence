# AGCI Morning Intelligence — Fase 0 + Fase 1

Fecha: 2026-08-09

## Auditoría inicial

- Repositorio público: `alexm3x/alex-global-currency-intelligence`.
- Rama productiva: `main`.
- Respaldo previo al proyecto: `backup/pre-morning-intelligence-20260809` desde `38409c1770218b4963be9aaebf628eca38913384`.
- El Daily Briefing de portada continúa embebido en `daily-briefing-cover.js`; todavía no existe una fuente única de verdad para web, PDF y audio.
- `index.html` ya referenciaba `site.webmanifest`, pero el archivo no existía en `main` al iniciar la auditoría.
- La plataforma ya usa módulos JS independientes y datos JSON, patrón reutilizado por este MVP.
- El portal dispone de auditoría automatizada, pero antes de este cambio sólo corría en `main`, no en pull requests.

## Arquitectura MVP

`podcast/latest.json` funciona como contrato estructurado del episodio activo.

Flujo:

Daily Briefing validado → `podcast/latest.json` → `morning-intelligence.js` → reproductor de portada / transcripción / archivo.

En Fase 1 no se contrata TTS. Si `audioUrl` es nulo, el reproductor usa `SpeechSynthesis` del dispositivo. Si en Fase 2 se publica un MP3 y se llena `audioUrl`, el mismo componente cambia automáticamente a audio HTML5 y habilita metadata para Media Session.

## Archivos nuevos

- `morning-intelligence.js`
- `morning-intelligence.css`
- `podcast/latest.json`
- `podcast/archive.json`
- `podcast/index.html`
- `site.webmanifest`

## Archivo modificado

- `index.html`: carga CSS y JS del módulo.
- `.github/workflows/executive-platform-audit.yml`: añade QA de pull request y validaciones del módulo.

## Resiliencia

- Si falla `podcast/latest.json`, el reproductor muestra estado no disponible y no bloquea el resto de AGCI.
- Si `isStale=true`, la portada muestra “Última edición disponible”.
- Si `audioUrl` no existe, se usa voz nativa del navegador.
- Si el navegador no ofrece `SpeechSynthesis`, la transcripción y el Daily Briefing permanecen disponibles.
- PDF y audio son independientes; `pdfUrl` puede permanecer nulo sin romper el reproductor.

## Móvil

- Diseño mobile-first bajo 820 px.
- Controles mínimos de 44 px en elementos principales.
- Capítulos navegables.
- Reproductor compacto fijo inferior después de iniciar reproducción.
- Narración dividida capítulo por capítulo para reducir fallas de textos largos en Safari/iOS.

## Criterios de aceptación Fase 1

1. El contrato JSON es válido y tiene al menos cinco capítulos.
2. `node --check morning-intelligence.js` pasa.
3. Portada referencia CSS/JS del módulo.
4. Archivo y transcripción cargan sin depender de terceros.
5. El módulo no contiene secretos ni API keys.
6. El Daily Briefing existente no se modifica funcionalmente.
7. Si falla el módulo, el resto del sitio continúa disponible.
8. Pull request debe pasar `AGCI Executive Platform Audit` antes de merge.

## Rollback

Rollback inmediato: revertir el commit/merge del MVP o mover `main` al estado anterior. El respaldo exacto permanece en `backup/pre-morning-intelligence-20260809`.

El módulo está desacoplado: retirar las dos referencias `morning-intelligence.css` y `morning-intelligence.js` de `index.html` desactiva la función sin afectar rankings, mercados, viajes, comparadores o briefing existente.

## Pendientes para Fase 2

- Motor TTS de producción y selección de voz.
- MP3 normalizado y almacenamiento.
- Automatización diaria del contrato y archivo.
- Integración real de `pdfUrl` con el PDF diario publicado.
- Correo con vínculo al audio.
- RSS/podcast feed si se desea distribución externa.
- Métricas de reproducción respetuosas de privacidad.
- Service worker e iconos PWA completos para instalación/offline; el manifiesto básico queda corregido en Fase 1.
