# AGCI Morning Intelligence — WhatsApp setup

La automatización ya está instalada en `.github/workflows/whatsapp-morning-intelligence.yml`.
Se ejecuta después de `AGCI Morning Intelligence Daily` y evita enviar dos veces el mismo episodio.

## Secrets requeridos en GitHub

Settings → Secrets and variables → Actions → Repository secrets

- `WHATSAPP_TOKEN` — token de acceso de Meta WhatsApp Cloud API.
- `WHATSAPP_PHONE_NUMBER_ID` — Phone Number ID del número emisor.
- `WHATSAPP_TO` — número destino en formato internacional, sólo dígitos, por ejemplo 521XXXXXXXXXX.
- `WHATSAPP_TEMPLATE_NAME` — nombre exacto de la plantilla aprobada en WhatsApp Manager.

## Variables opcionales

Settings → Secrets and variables → Actions → Variables

- `WHATSAPP_TEMPLATE_LANG` — por defecto `es_MX`.
- `WHATSAPP_GRAPH_VERSION` — por defecto `v23.0`; mantenerlo actualizado conforme a Meta.

## Plantilla recomendada

Nombre sugerido: `agci_morning_intelligence_ready`
Categoría: Utility, si Meta la acepta conforme al contenido y uso.
Idioma: Español (México).

Cuerpo sugerido:

`AGCI Morning Intelligence del {{1}} ya está disponible. Duración: {{2}}. Escuchar: {{3}}`

Parámetros enviados por el workflow:
1. Fecha del episodio.
2. Duración mm:ss.
3. URL pública del reproductor AGCI.

## Funcionamiento

Briefing actualizado → Chirp 3 HD → episodio publicado → workflow de WhatsApp → plantilla Meta → destinatario.

El workflow calcula SHA-256 de `podcast/latest.json` y lo compara con `.agci/whatsapp-last-sent.sha`. Si coincide, no envía un duplicado.

Si faltan secretos, el módulo no rompe la generación del podcast; simplemente omite el envío.
