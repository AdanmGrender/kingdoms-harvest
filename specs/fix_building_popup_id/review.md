# Review — feature 12 `fix_building_popup_id`

**Veredicto:** APPROVED

Revisado en `feature/fix_building_popup_id` (HEAD previo a este commit: `2831624`), base `feat/art-direction-b`. Feature `sdd: false`: no hay `requirements.md`/`design.md`; los criterios son los `acceptance` de `feature_list.json` (A1, A2), trazados en `tasks.md`.

## Trazabilidad

| Criterio | Task | Evidencia | Verificación del reviewer |
|---|---|---|---|
| A1 — tocar un edificio en el hub muestra nombre real y acciones | T2 (`f75145b`) | Fix en `BuildingInfoPopup.jsx:50-51` (`selected.buildingId ?? selected.building_id`) | `HubSceneB.js:456` emite `buildSelectionPayload(...)`; `hubLayout.js:213-217` devuelve `buildingId: record.building_id`. El popup ahora resuelve ese id contra `BUILDING_META` (`BuildingInfoPopup.jsx:10-29`). Acciones Mejorar/Info sin cambios. |
| A2 — test Vitest que cubra payload `{buildingId}` | T1 (`ad39914`) | `client/src/tests/BuildingInfoPopup.test.jsx` (3 casos) | Caso 1 usa `buildSelectionPayload` real (payload `buildingId`); caso 2 legado `building_id`; caso 3 recorre todo `BUILDINGS`. Ejecutado: 3/3 verde. |
| Suites completas sin regresiones | T3 | `tasks.md` T3 | Reproducido, ver abajo. |

## Tasks

- 3 tasks `- [x]` (T1, T2, T3), ninguna `- [ ]`; cada una con `Evidencia:` concreta. `## Bloqueado` vacío. OK.

## Revisión de diff (`git diff feat/art-direction-b...feature/fix_building_popup_id`)

- `client/src/components/hud/BuildingInfoPopup.jsx`: cambio mínimo (+/-35 con el mirror). Ids y emisores intactos. `blacksmith` eliminado: `grep -rn blacksmith client/ server/ shared/` sin resultados (solo queda un prompt de texto en `tools/generate-with-comfyui.js:175`, no es código de juego). Nombres y `maxLevel` coinciden con `shared/gameConfig.js` BUILDINGS (verificado: `farm_plot` Huerto Votivo/10, `smithy` Herrería/5, `embassy` Casa del Emisario/3, `trap` Foso de Estacas/8, etc.) y con `docs/lore-glosario.md:65-79`.
- Sin lógica de negocio nueva en cliente: solo se añadió el fallback de lectura del id y el espejo de catálogo.
- `BUILDING_META` sigue siendo un espejo hardcodeado (`BuildingInfoPopup.jsx:9-10`), no un import de `shared/`. Es el patrón vigente del repo (ver `client/src/game/hub/hubLayout.js:2`, `BootScene.js:133`) y el test "cada edificio" (`BuildingInfoPopup.test.jsx`, último `it`) detecta cualquier desincronía contra `BUILDINGS`. **No bloqueante.** Observación: la descripción de la feature dice "toma name/maxLevel de shared/gameConfig.js"; la implementación es espejo sincronizado por test. Aceptado.
- `client/src/game/hub/hubLayout.js` y su contrato R22 (`hubLayout.test.js`): sin cambios en el diff.
- Convenciones (`docs/conventions.md`): comentarios en español explicando el *por qué* (`BuildingInfoPopup.jsx:9, 50`); voseo y lore v2 en textos visibles. OK.

## Tests reproducidos por el reviewer

Worktree con `npm ci` en `client/` y `server/`. Nota de entorno: `npm ci` en la raíz falla al descargar Chrome de puppeteer (`EPERM`/descarga corrupta); es un problema del entorno Windows y no afecta a las suites de client ni server.

- `cd client && npx vitest run src/tests/BuildingInfoPopup.test.jsx` → `Test Files 1 passed (1)`, `Tests 3 passed (3)`.
- `cd client && npx vitest run` → `Test Files 1 failed | 6 passed (7)`, `Tests 1 failed | 149 passed (150)`. Único fallo: `src/tests/GameHUD.test.jsx > GameHUD > renders player level as Lv5`, listado en `feature_list.json` `rules.known_failures`. Tolerado.
- `cd server && npx jest --runInBand --forceExit` → `Test Suites: 25 passed, 25 total`, `Tests: 388 passed, 388 total`.

## Cambios requeridos

Ninguno.

## Observaciones no bloqueantes

- `CHANGELOG.md` recibe la sección `### Fixed` bajo `## [Unreleased]` (añadida en esta aprobación).
- Sin evidencia visual (screenshot) del popup en el hub: la regla de `docs/conventions.md` exige evidencia visual solo para escena/arte/layout; este cambio es lógica de componente cubierta por test. Aceptado.
