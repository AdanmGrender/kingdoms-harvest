# Review — combate_b · Etapa A (T1–T7) (rama `feature/combate_b`, commit revisado 34afc99)

## Veredicto
**APPROVED — solo Etapa A (T1–T7), ronda 1** (lente artefacto + verificación de ejecución).
La feature **sigue `in_progress`**: T8–T12 (Etapas B y C) están pendientes. Por eso no se toca `feature_list.json` ni `CHANGELOG.md`; eso se hace al aprobar la feature completa (T12).

## Trazabilidad
- R3–R32, R36–R47 y R53 aparecen en `Cubre:` de al menos una task `[x]` de T1–T7.
- R1, R2 y R4 verificadas por diff contra `46d156d`: `git diff --name-only 46d156d...feature/combate_b` no incluye `server/`, `shared/`, `client/src/store/gameStore.js` ni `client/public/assets/game/`.
- R33–R35 (arte), R28/R43/R48–R52 (medición, cierre) quedan para Etapas B/C; no se evalúan aquí.

## Tasks
- T1–T7 `[x]`, cada una con `Evidencia:` inline. T8–T12 `[ ]` por diseño de la corrida (Etapa B/C, fuera de alcance).
- `## Bloqueado`: vacío. No hay justificaciones pendientes.

## Verificación reproducida (reviewer)
- Focalizados (`combatPlanner`, `combatAdapter`, `combatLayout`, `combatScene`, `combatStage`, `combatPanel`, `pantallasB`): `Test Files 7 passed (7)`, `Tests 173 passed (173)`.
- Cliente completo (`cd client && npx vitest run`): `Test Files 1 failed | 32 passed (33)`, `Tests 587 passed (587)`. El único archivo que falla es `iconSheet.test.js` (`Cannot find module 'sharp'`); no toca ningún archivo del diff, así que es el mismo fallo preexistente que declara el implementador.
- `cd client && npm run build` → `✓ built in 8.38s`.
- Servidor: no re-ejecutado; `git diff --name-only 46d156d...feature/combate_b` no incluye `server/`, así que su `545 passed` es el de la base por construcción.
- Vite no escucha en `:5173`; `:5180` y `:3101` son del owner y no se tocaron.

## Revisión de código (archivo:línea, diff contra `46d156d`)
Comprobado sin hallazgos bloqueantes:
- `client/src/game/combat/formation.js:14` — `BACK_Y = 990` (no ≈1010 de design §8). Justificado: la fila trasera escala a 188 px de alto; con 1010 llega a y=1198 y pisa la frontal (y=1180); con 990 llega a 1178. El desvío está documentado en el código y en `tasks.md` T4.
- `client/src/game/combat/eventPlanner.js:311-314` — `skip()`: `speed = 10`; si el resto supera 300 ms reales, `speed *= rest/300`. Con eso el resto de la cola se vacía en ≤ 300 ms reales (R18).
- `client/src/game/combat/combatQuality.js` + `CombatScene.js:95,115` — `low` no crea luces ni postFX (`lights = 0`, `postFX = false`); `cam.postFX` guardado (R47).
- `client/src/components/campaign/CombatStage.jsx:43,65-68` — `cancelled` evita crear el juego tras desmontar; `game.destroy(true)` una sola vez (R38).
- `client/src/game/PhaserGame.jsx:87-88,137-138` — `loop.sleep()`/`wake()` con `EventBridge.off` en el cleanup; no hay listeners colgados (R39).
- `client/src/components/campaign/CombatInstancePanel.jsx` — sin `100vh`/`dvh`, sin rutas `/assets/game/`, retratos con `SpriteIcon` de clase (R42, Q6). El `enemyPct` (línea 118) lee `state.enemy`, que `server/src/services/combat/engine.js:124` define como copia del enemigo principal: no rompe con v2.
- `client/src/tests/pantallasB.test.jsx:81-82` — se quitaron las dos filas `CAPS` del panel. Está justificado: R27 (requirements.md) pide literalmente esa sustitución, y el `describe` nuevo la cubre (`ENEMY_HEIGHT_FRAC`, `computeFormation`). Ningún valor esperado se relajó.
- Tests: no hay `.skip`/`.only`/snapshots en los tests nuevos; la aserción de R27 es de comportamiento (alturas calculadas), no de texto fuente.

## Observaciones no bloqueantes (para Etapa B/C o seguimiento)
1. `CombatInstancePanel.jsx:118`: la barra de vida del HUD sigue solo al enemigo principal (`state.enemy`). Con 2–4 enemigos en escena hay una sola barra. Cumple el texto de requirements.md:178 («barra de vida del enemigo»), pero conviene decidir antes de Etapa B si se quiere una barra por enemigo.
2. `specs/combate_b/design.md` §8 sigue diciendo «y≈1010»; alinear el documento con `formation.js:14` (990) en la siguiente edición.
3. `specs/combate_b/tasks.md`: bajo cada T1–T7 queda una sub-línea `  - Evidencia:` vacía (residuo de plantilla); la evidencia real está inline. Limpiar en T12.
4. `feature_list.json` tiene `known_failures: []`, pero `iconSheet.test.js` falla de forma preexistente (`sharp`, ya anotado en `PAQUETE.md`, Trampas). Registrarlo en `known_failures` al cerrar la feature (T12). No es nuevo y no bloquea esta etapa.

## Cambios requeridos
Ninguno para la Etapa A. Central puede lanzar la Etapa B (T8–T10) con el gate de arte del owner.
