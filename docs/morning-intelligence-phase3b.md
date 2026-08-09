# AGCI Morning Intelligence — Fase 3B Voice Studio

## Objetivo

Agregar personalización de voz y duración sin alterar la fuente editorial canónica ni activar proveedores TTS de pago.

## Componentes reutilizados

- `data/daily-briefing-latest.json` como fuente editorial única.
- `podcast/latest.json` como episodio publicado.
- reproductor, capítulos, PWA, Media Session, archivo, RSS y audio eSpeak NG existentes.
- GitHub Pages y GitHub Actions existentes.

## Componentes nuevos

### `voice-router.js`

Capa desacoplada de proveedor con cinco perfiles:

1. CIO Institucional.
2. Private Banking.
3. Markets Desk.
4. Executive Brief.
5. CIO + Analista.

Gestiona voz disponible del dispositivo, estilo, velocidad, pitch, selección por rol, estimación de duración y fallback.

### `voice-studio.js`

Inyecta Voice Studio dentro del reproductor existente. Permite:

- escuchar muestra;
- elegir perfil;
- elegir duración/enfoque;
- elegir velocidad;
- persistir preferencias en `localStorage`;
- escuchar una narración personalizada basada exclusivamente en los capítulos del episodio canónico.

### `pronunciation-dictionary.json`

Diccionario financiero es-MX para tickers, índices y términos financieros.

## Duraciones y enfoques

- Completo: 8–12 minutos.
- Ejecutivo: 5–7 minutos.
- Express: 2–3 minutos.
- Sólo Mercados.
- Sólo Inversiones.
- México + Negocios.
- IA + Tecnología.
- Viajes.

## Velocidades

0.9x, 1x, 1.1x, 1.25x, 1.5x, 1.75x y 2x.

## Fallback

1. TTS premium — arquitectura preparada, no configurado.
2. Voz local del dispositivo mediante SpeechSynthesis.
3. Audio diario publicado con eSpeak NG.
4. Transcripción.

Nunca se deben modificar hechos, tesis o datos por cambiar de voz o duración.

## PWA

`sw.js` fue actualizado para cachear:

- `voice-router.js`;
- `voice-studio.js`;
- `pronunciation-dictionary.json`.

## QA automatizado

Workflow: `.github/workflows/voice-studio-qa.yml`.

Valida:

- sintaxis JavaScript;
- cinco perfiles;
- siete velocidades;
- ocho duraciones/enfoques;
- diccionario financiero;
- carga desde `index.html`;
- caché PWA;
- persistencia local;
- preview;
- SpeechSynthesis fallback.

## QA móvil

El CSS del Voice Studio usa layout de una columna por debajo de 820 px y botones de ancho completo por debajo de 440 px. Los controles principales mantienen altura mínima de 42 px.

La validación automática no sustituye una prueba física de VoiceOver, AirPods, pantalla bloqueada o pronunciación real en Safari iOS. Estas verificaciones deben realizarse como aceptación final en dispositivo después del despliegue.

## Seguridad y privacidad

- No se añadieron API keys.
- No se añadieron tokens.
- No se activó TTS premium.
- Las preferencias permanecen en `localStorage`.
- Voice Studio consume únicamente el episodio público canónico.

## Costos

Costo recurrente nuevo de Fase 3B: **USD 0**.

## Rollback

Respaldo previo:

`backup/pre-voice-studio-phase3b-20260809`

Ante una regresión, revertir el merge de Fase 3B o restaurar `main` desde dicho respaldo.
