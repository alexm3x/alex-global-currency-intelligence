# Viajes ASC — Fases 11 a 13 — Cierre de Release

Fecha: 2026-08-19  
Release: `asc-viajes-phase13-2026-08-19`

## Fase 11 — QA institucional

Definition of Done:

- `npm test` debe pasar completo.
- `scripts/audit-viajes-site.mjs` debe terminar con 0 errores.
- `scripts/qa-viajes-release.mjs` debe terminar con 0 fallas.
- Todos los contratos desde `travel-data-v4` hasta `asc-travel-integration-v1` deben estar presentes.
- No se permite promover datos demo de Estancias a datos live.
- No se permite conversión FX implícita en costo trazable.
- No se permite presentar una alerta externa como activa sin conector real.
- Historial y Favoritos deben conservar snapshots mínimos y acotados.
- No se permite una clave OpenAI embebida en el cliente o scripts de release.

## Fase 12 — publicación consolidada

La publicación se ejecuta únicamente después de Fase 11:

1. construir y auditar el artefacto completo;
2. publicar el mismo artefacto en GitHub Pages;
3. publicar/verificar el Worker de Viajes ASC;
4. no modificar silenciosamente contratos durante el despliegue.

El manifiesto rector es `viajes/release-manifest.json`.

## Fase 13 — verificación de producción

La verificación final comprueba:

- éxito del deployment de GitHub Pages;
- estado observable de la ruta pública de Viajes ASC;
- estado independiente del dominio personalizado;
- `/health` del Worker;
- contrato de investigación y ventanas;
- CORS de producción;
- disponibilidad real o fail-safe de investigación;
- persistencia de evidencia en `docs/status/`.

Estados permitidos:

- `verified`: artefacto y dependencias operativas verificadas.
- `verified_with_external_blockers`: artefacto central verificado; una dependencia externa está indisponible y se identifica explícitamente.
- `failed`: QA, publicación, Worker health o CORS central no superaron el gate.

## Dependencias externas actualmente conocidas

### OpenAI research

La ausencia de `OPENAI_API_KEY` no puede convertirse en resultados inventados. El estado correcto es `assistant_unavailable`. El release puede quedar `verified_with_external_blockers` mientras el resto del sistema esté verificado.

### Dominio personalizado

`https://alexsaldana.com/viajes/` se verifica de forma independiente de la publicación de GitHub Pages. Un problema DNS/hosting/routing externo debe quedar registrado como bloqueo externo y no como éxito ficticio del dominio.

## Rollback

Branch de rollback previa al inicio de estas fases:

`backup/viajes-pre-phase11-13-2026-08-19`

La Fase 13 no se considera cerrada hasta que el estado final haya sido persistido por CI y los workflows relevantes hayan terminado con éxito.
