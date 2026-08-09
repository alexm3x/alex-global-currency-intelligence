# AGCI Morning Intelligence — Fase 3

## Alcance implementado

Fase 3 convierte el MVP y la automatización de Fase 2 en una experiencia de audio más cercana a un producto institucional móvil.

### Audio premium sin costo recurrente

- Formato CIO + Analista.
- Dos variantes de voz de eSpeak NG (`es+m3` y `es+f3`).
- Cada capítulo se renderiza por separado y se concatena antes de normalizar el episodio final.
- Normalización objetivo: -16 LUFS, true peak -1.5 dB.
- El generador amplía la profundidad usando exclusivamente el mismo `data/daily-briefing-latest.json`; no introduce hechos nuevos.
- Gate de duración productiva: 470–780 segundos.
- Los `start` de capítulos se recalculan con la duración real de cada segmento.

### PWA y resiliencia

- `sw.js` cachea shell, JSON y episodios solicitados.
- La navegación usa network-first con respaldo de caché.
- JSON usa stale-while-revalidate.
- MP3 puede guardarse para reproducción offline.
- El service worker incluye handlers de push/notificationclick para una futura integración, pero Fase 3 no activa ningún proveedor de push.

### Experiencia móvil

- Media Session API para play, pause, stop, seek -15/+30, capítulo anterior y siguiente.
- Metadata visible en controles del dispositivo cuando el navegador lo soporta.
- Reanudación de posición por episodio.
- Player sticky existente preservado.
- Velocidad preferida persistente.
- Enfoques locales: briefing completo, mercados/inversión, México/negocios, IA y viajes.

### Privacidad y analítica

Las métricas se almacenan únicamente en `localStorage` del dispositivo:

- reproducciones;
- finalizaciones;
- segundos escuchados;
- capítulos abiertos;
- compartidos;
- guardados offline.

No se transmite identificador ni telemetría a un servidor. Para inspección local de QA existe `window.AGCIListeningMetrics.snapshot()`.

### Instalación

El manifiesto PWA incluye identidad AGCI y shortcuts a Morning Intelligence, Daily Briefing y archivo. Cuando el navegador expone `beforeinstallprompt`, el player ofrece `Instalar AGCI`.

## Fuente única

`data/daily-briefing-latest.json` continúa siendo la fuente editorial canónica. El podcast, la transcripción, el RSS y el Daily Briefing web deben conservar la misma fecha editorial.

## Rollback

Rama de respaldo previa a Fase 3:

`backup/pre-morning-intelligence-phase3-20260809`

Ante un fallo productivo, restaurar los archivos de esa rama o revertir el merge de Fase 3. El último MP3 válido permanece archivado en `podcast/episodes/YYYY/MM/`.

## Dependencias externas

Ninguna dependencia de pago fue activada. eSpeak NG y ffmpeg se instalan de forma efímera en GitHub Actions.

## Pendiente para una voz humana premium

La arquitectura admite reemplazar el paso de eSpeak NG por un proveedor TTS de mayor naturalidad. Ese cambio debe evaluarse por calidad, privacidad, licencia y costo antes de activarse.
