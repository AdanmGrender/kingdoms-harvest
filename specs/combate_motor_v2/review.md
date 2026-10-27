# Review — feature 13 `combate_motor_v2`

**Veredicto:** APPROVED

Revisado en `feature/combate_motor_v2` (HEAD previo a este commit: `ceb6019`), base `91671d9`. Ronda 1 (lente artefacto): diff leído en frío antes de ejecutar nada, luego contraste con v1 (`campaignSim.js`) y con `requirements.md`.

## Trazabilidad

| Requisito | Task | Evidencia | Verificación del reviewer |
|---|---|---|---|
| R-ND1 no borrar | T7, T9 | `git diff --numstat 91671d9 -- shared/gameConfig.js server/src/services/campaignService.js` = `9 0` y `33 3` | Las 3 borradas de campaignService son los enganches de design §3 (`campaignService.js` diff: `require` de gameConfig, `return {` de `_buildCombatState`, llamada `simulateRound` en `resolveStep`). |
| R-ND2 campaignSim intacto | T9 | `git diff 91671d9 -- server/src/services/campaignSim.js` vacío | Verificado: vacío. |
| R-ND3 engineVersion 1 | T1 | `shared/gameConfig.js:1152` `engineVersion: 1` | Verificado; test de forma en `combatV2.unit.test.js`. |
| R-ND4 / R-ND4b | T6, T8 | `combatV2.equivalence.test.js`, `campaignServiceV2.test.js` | `engine.js:99-100` `s.enemy = {...main}`; `hp/maxHp/dps` presentes. |
| R-ND5 sin migraciones | T9 | `git diff --name-only 91671d9 -- server/migrations` vacío | Verificado: vacío. |
| R-ND6 tests existentes intactos | T9, T10 | `--name-status` sobre `server/tests client/src/tests`: solo `A` (4 archivos nuevos) | Verificado. Ver nota de cliente abajo. |
| R-ND7 sin Math.random | T2, T9 | `grep -rn Math.random server/src/services/combat/` vacío | Verificado; `combatV2.unit.test.js:57` lo exige. |
| R-ND8 números en COMBAT | T1, T5 | `engine.js:13` `K = COMBAT.defK`, `engine.js:70` `COMBAT.threat` por llamada | Verificado: `damage.js` recibe K por parámetro, sin constantes. |
| R-ND9 fuera de client/art | T9 | `git diff --name-only 91671d9..HEAD` solo `server/`, `shared/gameConfig.js`, `specs/combate_motor_v2/`, `feature_list.json` | Verificado. |
| R-ND10 errores y eventos | T4, T5 | `engine.js:33-34` mensajes en español; `combatV2.engine.test.js` contrato de eventos | Inspeccionado. |
| R1 módulos | T2–T4 | `engine.js`, `rng.js`, `targeting.js`, `damage.js` | Verificado por lectura. |
| R2 pura, sin DB | T4 | `engine.js:12` clona; sin `require` de database en `combat/` | Verificado por lectura. |
| R3 mitigación | T2 | `damage.js:4-7` `Math.round(raw*K/(K+d))`, `d===0` → `Math.round(raw)` | Verificado; tabla def 10/15/50/100/300 en unit test. |
| R4 def/spd ausentes = 0 | T4, T5 | `engine.js:39,62` (`target.def` undefined → `Math.max(0, def||0)`); `targeting.js:23` `spd||0` | Verificado por lectura. |
| R5 orden por spd | T3, T5 | `targeting.js:19-27` (spd desc, héroe antes, slot/índice asc) | Verificado; 108/108 en suites de campaña y v2. |
| R6 muertos no actúan | T4, T5 | `engine.js:59` y `:69` (`continue` si muerto) | Verificado por lectura. |
| R7 skill antes de actores | T4, T6 | `engine.js:31-52`; equivalencia con `campaignSim.test.js:28,41,49` | Verificado. |
| R8 errores de skill | T4, T5 | `engine.js:33-34` | Verificado. |
| R9 energía | T4, T5 | `engine.js:48` (`energy=0`), `:67` `ENERGY_PER_ROUND` con tope | Compara con v1 `campaignSim.js:38-45`: misma guarda `enemy.hp > 0` y misma carga. |
| R10 amenaza | T3, T5 | `targeting.js:11-16` `threat[class] ?? 1`, desempate por slot | Verificado por lectura y test. |
| R11 derrame | T4, T6 | `engine.js:73-84` | Ver observación 1. |
| R12 principal | T4, T5 | `targeting.js:4-6`, `engine.js:36,61` | Verificado. |
| R13 enemies / enemy | T4 | `engine.js:15-17`, `:99-100` | Verificado. |
| R14 resultado | T4, T6 | `engine.js:90-95` prioridad victoria > derrota > timeout | Verificado; igual a v1 `campaignSim.js:47-69`. |
| R15 log | T4, T5 | `engine.js:102-110` claves v1 + `enemies`, `eventRange` | Verificado: `eventRange` cubre el evento `end` (se emite antes del push). |
| R16 eventos versionados | T4, T5 | `engine.js:25-27` (`t` = índice), `eventsVersion = 1` | Verificado por lectura. |
| R17 kinds | T4, T5 | `engine.js:49,51,64,65,79,82,96`: solo `skill/hit/death/end` | Verificado. |
| R18 mulberry32 | T2 | `rng.js:6-13` | Comparado con mulberry32 de referencia línea a línea: coincide. |
| R19 rng en estado | T2, T5 | `rng.js:19-23`, `state.rng` | Verificado; F13 no consume azar. |
| R20 determinismo | T5 | `combatV2.engine.test.js` (10 rondas × 2) | Ejecutado: verde. |
| R21 build v2 | T7, T8 | `campaignService.js:127-145` | Verificado por lectura. |
| R22 build v1 idéntico | T7, T8 | `campaignService.js:126-127` `if (COMBAT.engineVersion !== 2) return state;` antes de tocar nada | Verificado; `campaignService.test.js:157-166` sin cambios, verde. |
| R23 semilla por run | T7, T8 | `campaignService.js:135` `crypto.randomBytes`, `rng: seed` | Verificado. |
| R24 motor por run | T7, T8 | `campaignService.js:~122-127` `_engineFor` (`state.engine`) | Verificado; `this._engineFor` se llama con `this` ligado (ruta usa `campaignService.resolveStep`). |
| R25 motor desconocido | T7, T8 | `campaignService.js` `_engineFor` lanza antes del `update` | Verificado: el throw ocurre antes de `db(...).update`. |
| R26 COMBAT forma | T1 | `shared/gameConfig.js:1152-1156` | Verificado: pesos 1.5/1.3/1.0/0.7/0.5. |
| R27 equivalencia 11 escenarios | T6 | `combatV2.equivalence.test.js` 15/15 | Ejecutado: verde. |
| R28 embudo a1n3/a1n4 con v2 | T8 | `campaignServiceV2.test.js` 12/12 | Ejecutado: verde. |
| R29 un test por requisito | T5 | `combatV2.engine.test.js`, `combatV2.unit.test.js` | Verificado por lectura de nombres. |
| R30 rutas intactas | T9 | `git diff 91671d9 -- server/src/routes/campaignRoutes.js` vacío | Verificado. |

Ejecutado por el reviewer (rama `ceb6019`):

- `cd server && npx jest --runInBand --forceExit tests/combatV2 tests/campaignServiceV2 tests/campaignSim tests/campaignService.test` → `Test Suites: 6 passed, 6 total`, `Tests: 108 passed, 108 total`.
- `cd server && npx jest --runInBand --forceExit` → `Test Suites: 29 passed, 29 total`, `Tests: 459 passed, 459 total`.

## Tasks

- T1–T10: todas `[x]` con `Evidencia:` inline. `## Bloqueado` vacío. OK.
- Nota de T10 (cliente): `npx vitest run` no se pudo ejecutar. No hay `vitest` en `client/node_modules/.bin` del worktree ni del repo principal (`D:/Proyectos/kingdoms-harvest/client`), así que el fallo es previo a esta rama. La rama no toca `client/` (R-ND9, verificado). Aceptado como caveat, no como bloqueo. Ver Trampas en PAQUETE.

## Revisión de diff (`git diff 91671d9...feature/combate_motor_v2`)

- `shared/gameConfig.js:1152-1156` y `:1202`: bloque `COMBAT` antes de `module.exports` y exportado. Cero líneas borradas. OK.
- `server/src/services/campaignService.js:113-145`: bifurcación limpia; v1 devuelve `state` sin tocar. `crypto` importado al tope. OK.
- `server/src/services/combat/*.js`: puros, sin DB, sin `Math.random`, comentarios en español explicando el *por qué*. Convenciones de `docs/conventions.md` respetadas (2 espacios, `;`, comillas simples).
- `server/tests/*`: archivos nuevos. Son tests de comportamiento (valores esperados, hot-swap de `COMBAT` con `finally`), salvo el de `Math.random` que es un invariante de fuente exigido por R-ND7.

## Cambios requeridos

Ninguno.

## Observaciones no bloqueantes

1. `server/src/services/combat/engine.js:72,76-78`: el derrame usa `dmg` ya mitigado por la `def` del primer objetivo; el siguiente héroe no se mitiga con su propia `def`. Es lo que pide R11 («sobrante, ya mitigado»). Si el owner quiere mitigación por objetivo en F14/F15, es una decisión de diseño a registrar, no un defecto de F13.
2. `engine.js:75`: con `dmg === 0` el primer objetivo emite un `hit` con `value: 0` (R17 lo permite). Es intencional según el comentario.
3. Líneas de 120–148 columnas en `combatV2.engine.test.js` (138, 194, 201, 214, 227, 262, 263), `combatV2.equivalence.test.js` (167, 185), `combatV2.unit.test.js` (106), `campaignServiceV2.test.js` (151). La convención es «≲120»; no es bloqueante.
4. `campaignService.js:~123` `statsBySlot` se construye desde el `squad` completo (incluye héroes en recuperación). Inocuo: `heroes` ya los filtra antes.
