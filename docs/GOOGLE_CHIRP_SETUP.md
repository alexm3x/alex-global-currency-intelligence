# AGCI Morning Intelligence — Google Chirp 3 HD

## Estado

La integración está preparada para usar Google Cloud Text-to-Speech con Chirp 3 HD como audio principal. Si Google Cloud aún no está configurado o falla, el workflow conserva el fallback actual para no interrumpir la publicación diaria.

## Voces configuradas

- CIO: `es-US-Chirp3-HD-Achird`
- Analista: `es-US-Chirp3-HD-Achernar`
- Locale: `es-US`

Google Chirp 3 HD no ofrece actualmente `es-MX`; AGCI usa `es-US`, la variante de español disponible más adecuada para una audiencia latinoamericana.

## Única configuración externa requerida

1. En Google Cloud Console, seleccione o cree el proyecto que usará AGCI.
2. Confirme que la facturación esté habilitada para el proyecto.
3. Habilite **Cloud Text-to-Speech API** (`texttospeech.googleapis.com`).
4. Cree una cuenta de servicio dedicada, por ejemplo `agci-morning-tts`.
5. Conceda a esa cuenta únicamente los permisos necesarios para consumir Cloud Text-to-Speech en el proyecto. Evite roles amplios como Owner o Editor.
6. Para una activación rápida, cree una clave JSON de esa cuenta de servicio. Trátela como contraseña y no la suba al repositorio.
7. En GitHub: repositorio `alexm3x/alex-global-currency-intelligence` → Settings → Secrets and variables → Actions → New repository secret.
8. Nombre exacto del secret: `GCP_CREDENTIALS`.
9. Pegue como valor el contenido completo del JSON de la cuenta de servicio y guarde.
10. Ejecute manualmente el workflow **AGCI Morning Intelligence Daily** o espere la siguiente ejecución programada.

## Validación esperada

Cuando Chirp esté activo, `podcast/latest.json` debe contener:

- `primaryPlayback: "publishedAudio"`
- `voiceMode: "google-chirp3-hd"`
- `audioEngine.model: "Chirp 3 HD"`
- `audioUrl` apuntando al MP3 del episodio del día.

El reproductor del sitio usará el MP3 publicado como experiencia principal. La voz del navegador queda únicamente como fallback.

## Seguridad

La clave JSON nunca debe guardarse en archivos del repositorio. La opción más segura a futuro es migrar desde una clave JSON a Workload Identity Federation de Google Cloud para eliminar credenciales de larga duración.
