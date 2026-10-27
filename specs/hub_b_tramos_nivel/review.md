# Review — `hub_b_tramos_nivel` (T11–T13, ronda 2)

- Revisor: reviewer (SDD), task t_37d2fad3, run 66
- Rama: `feature/hub_b_tramos_nivel`, HEAD `01e6767`
- Ronda: 2 (lente ejecución). Previa: ronda 1 `changes_requested` (run 64, `911b075`).
- Alcance: correcciones 1–4 de la ronda 1 + ejecución del script de evidencia.

## Veredicto

**CHANGES_REQUESTED**

Las 4 correcciones de la ronda 1 están aplicadas y verificadas. Queda un hallazgo nuevo: la evidencia de R38 no cumple lo que su propio `requirements.md` exige.

## Verificado (ronda 2, ejecución)

- `cd client && npx vitest run --test-timeout=30000` → **21 files, 328 passed**.
- `node scripts/hub_b_tramos_evidence.js --url http://localhost:5173` → **exit 0**. Aserciones de texturas 17/17 en bajo/medio/alto/obra, ciclo barn bajo→obra→medio, toque (1 `entity:selected` barn, escala = baseScale), fantasma tower = `hubb_bld_tower`, fps (3596 muestras), 0 navegaciones, 0 pageerror/console.error/http≥400, bloqueo `*_alto` y bloqueo total. La ejecución regeneró `evidencia/`; lo restauré con `git checkout` (árbol limpio, HEAD `01e6767`).
- Corrección 1 (`client/src/tests/hubLayout.test.js:394`): test de texto R132 eliminado. Sustituido por `HUB_TEXTURES: cada URL de edificio (4 por id) apunta a un webp que existe en client/public`, que comprueba existencia en disco. OK.
- Corrección 2 (`scripts/hub_b_tramos_evidence.js`): sin fallback de fps (`:332` falla con < 100 muestras; `:333` falla con avg/min < 50). Toque (`:280-289`), bloqueo de webp (`:347-350`) y "sin navegación" (`:126`, `:340`) tienen aserción real. OK.
- Corrección 3: `git diff feat/art-direction-b...HEAD -- CHANGELOG.md` vacío. OK.
- Corrección 4: `tasks.md` `## Bloqueado` actualizada. T9 registra la excepción R15 (stable_alto 119 %, trap_alto 136 %) con referencia a `aprobacion_arte.md` § "Hoja completa (T10)". OK.
- Orden R21: `23ca797` (aprobación) anterior a `c6ad874` (HUB_TEXTURES). OK.
- `server/` y `shared/` sin cambios respecto de `feat/art-direction-b`. `art-b/tramos/raw/` y webp aprobados sin tocar. OK.

## Trazabilidad

| R | Estado | Evidencia |
|---|---|---|
| R1–R37, R39–R44 | Cubiertos por T1–T13 | Verificados en ronda 1 y en ejecución de ronda 2 |
| **R38** | **Incompleto** | Ver Cambios requeridos 1 |

## Tasks

- T1–T13: todas `[x]` con `Evidencia:` inline. Ninguna en `## Bloqueado`.

## Cambios requeridos

1. **R38 sin evidencia conforme al spec** (`specs/hub_b_tramos_nivel/requirements.md:189-190`). R38 pide: `POST /api/buildings/upgrade` único, sin navegación, y capturas `evidencia/obra_antes.webp`, `obra_durante.webp`, `obra_despues.webp`. El script:
   - `scripts/hub_b_tramos_evidence.js:236-246` simula la mejora con `setBuildings`/`setState`, no llama al endpoint. Consecuencia: el criterio A2 (`feature_list.json` id 5, "Mejorar un edificio actualiza su sprite sin recargar") no se prueba de extremo a extremo.
   - Las capturas se llaman `mejora_antes/durante/despues.webp` (`:238,242,246`), no `obra_*.webp`.
   - `tasks.md` T12 admite la limitación ("R38 solo cubierto en la parte visual"), pero no basta: R38 declara un mínimo de evidencia.

   Corrección mínima, una de dos:
   - (a) Que el script dispare la mejora real con `POST /api/buildings/upgrade` (vía `page.request` o desde la UI) en la misma sesión, sin `framenavigated`, y capture `obra_antes/durante/despues.webp`. Luego actualizar `tasks.md` T12 y el `Cubre:` de R38.
   - (b) Si la vía real no es viable en este alcance, registrar una excepción explícita de R38 aprobada por el owner (como la de R15), con archivo:línea de `requirements.md:189-190`. Hasta entonces no se cierra.

   Tras la corrección, volver a correr `node scripts/hub_b_tramos_evidence.js` y comprobar exit 0.

## Notas (no bloquean)

- La puerta T10 la resolvió el owner, no p-kh (spec `requirements.md:16,108,112,123`). Queda registrado en `aprobacion_arte.md`. Central debe tenerlo presente al cerrar.
- `fps_tramos.json`: avg 180,1 en dos corridas independientes, min varía (137 y 108,7). Es rAF en headless; un avg de 180 supera 60 Hz, así que la cifra es indicativa. El script mide de verdad (sin valor por defecto), no bloquea.
- Las 7 imágenes de la web de Gemini pueden variar de estilo. El owner lo aceptó en `aprobacion_arte.md`.

## Próximo paso

El implementador resuelve R38 (opción a o b) y pide review con `kanban_request_review`. El reviewer verificará en ronda 3 (contrato): R38 contra su spec, `vitest` y la ejecución del script.
