# Tasks — `combate_pasivas_estados` (feature 14)

> Orden de ejecución. Cada tarea cierra con `Evidencia:` (comando + salida real) antes de marcarse. Un commit por tarea en `feature/combate_pasivas_estados`.
> Antes de T1, crear los junctions de `node_modules` del worktree (los pone el owner/implementer; el spec no corre nada).
> Regla transversal (R-ND6): tras cada tarea, correr `cd server && npx jest --runInBand --forceExit` y comprobar que ningún test existente cambió (`git diff --name-status -- server/tests client/src/tests` solo con `A`). Q1–Q15 de `design.md` §9: si el owner no responde en el gate, se aplican las recomendaciones.
> Cobertura de R-ND1…R-ND10 y R41 se reafirma en T9 (aunque se respetan desde T1).

- [x] T1 — Datos: agregar `HERO_PASSIVE_FX` (18 entradas, `design.md` §4.2) y `COMBAT_FX` (§4.3) a `shared/gameConfig.js` y exportarlos; sin tocar `HEROES` ni `COMBAT`. Crear `server/tests/heroPassives.test.js` con: 18 tests de texto literal (uno por héroe, `design.md` §4.2), test de claves de `HEROES[id]`, test de que `HERO_PASSIVE_FX` y `HEROES` tienen las mismas 18 claves y de esquema (enums de `trigger`/`effect`/`cond.k`, campos requeridos). Cubre: R1, R2, R3, R-ND1, R-ND8, R-ND10, R39 (parcial: `CAMPAIGN` sin diff).
  Evidencia: `npx jest tests/heroPassives.test.js` → `Test Suites: 1 passed, 1 total / Tests: 23 passed, 23 total`; `git diff -U0 -- shared/gameConfig.js | grep '^-'` → solo `--- a/shared/gameConfig.js` (cero líneas borradas, HEROES/COMBAT intactos); jest completo server → `Test Suites: 31 passed / Tests: 487 passed` (línea base de esta rama: 30/464; +1 suite, +23 tests); `git diff --name-status -- server/tests client/src/tests` vacío para tests existentes (solo `??` el nuevo). Sin tests que cuenten claves de gameConfig (grep vacío).

- [x] T2 — Estados: crear `server/src/services/combat/effects.js` con el almacén `state.fx.st` (aplicar, refrescar sin acumular, leer sumas, expirar por ronda, `stun` por acción, DoT, `shield` pct/pool, inmunidad a control y de jefes) y los eventos `status`/`dot`/`heal`. Sin enganches todavía. Tests en `server/tests/combatV2.status.test.js`. Cubre: R26, R27, R28, R29, R30, R31, R32, R33, R34, R35, R-ND7, R38.
  Evidencia: `npx jest tests/combatV2.status.test.js` → `Test Suites: 1 passed / Tests: 21 passed`; `grep -n "Math.random\|require(" effects.js` → solo `5:const { COMBAT_FX } = require('../../../../shared/gameConfig');` (sin database/fs/Math.random); jest completo server → `Test Suites: 32 passed / Tests: 508 passed`; `git diff --name-status -- server/tests client/src/tests` vacío (tests existentes intactos). Nota: `effects.js` exporta aquí el almacén (applyStatus/hasStatus/statusSum/skipsAction/dotTick/absorb/roundEnd/heal); el intérprete `begin` se agrega en T3.

- [ ] T3 — Enganches del motor: en `engine.js` agregar `effects.begin` y las llamadas H1–H10 (`design.md` §3.1) más el intérprete de efectos de `effects.js` (atkMod/defMod/dmgMult/ignoreDef/crit/dodge/extraHit/heal/applyStatus/execute/charge). Todavía sin ejecutar ninguna pasiva real salvo con datos sintéticos de test. Verificar que con todas las pasivas desactivadas el motor es idéntico a F13. Cubre: R4, R5, R6, R7, R35, R36, R37, R-ND2, R-ND4, R-ND9, R40.
  Evidencia: _(suites F13 verdes: `npx jest tests/combatV2.engine.test.js tests/combatV2.equivalence.test.js tests/combatV2.unit.test.js tests/campaignServiceV2.test.js`; `git diff --stat -- server/src/services/campaignSim.js server/src/services/campaignService.js` vacío)_

- [ ] T4 — Tanda 1 de pasivas (modificadores de ATK/DEF puros): aria, thorin, finn, viktor, varok, fenn. Tests de comportamiento en `server/tests/combatV2.passives.test.js` (sección tanda 1) con casos de borde de cada condición. Cubre: R8, R9, R12, R14, R18, R21, R6, R7.
  Evidencia: _(salida de `npx jest tests/combatV2.passives.test.js -t "tanda 1"`)_

- [ ] T5 — Tanda 2 (modificadores de daño y objetivo, sin azar): lyra, shadow, kryx, nyx (ejecución y herido). Cubre: R10, R16, R16b, R22, R22b, R25, R25b.
  Evidencia: _(salida de `-t "tanda 2"`)_

- [ ] T6 — Tanda 3 (curación y escudo): seraph, morghal (regen), serafina. Cubre: R15, R19, R23, R23b.
  Evidencia: _(salida de `-t "tanda 3"`)_

- [ ] T7 — Tanda 4 (azar y estados aplicados): zara, morghal (atkDown al atacante), elena, azyra (esquivar y crítico), vex, gorr. Con RNG forzado (`state.rng` calculado a mano con `nextFloat`). Cubre: R11, R13, R17, R19b, R20, R20b, R24, R37.
  Evidencia: _(salida de `-t "tanda 4"`)_

- [ ] T8 — Determinismo, compatibilidad y balance: tests de misma semilla ⇒ mismo resultado con pasivas de azar, semillas distintas ⇒ difieren, guarnición y `heroId: 'h1'` sin pasivas, claves de `state.enemy`/`heroes[i]`/`log[i]` sin cambios, entrada sin mutar, `COMBAT.engineVersion === 1`, mutación en caliente de un `value` de `HERO_PASSIVE_FX`, embudo guarnición vs `a1n3`/`a1n4` con `engine: 2` y escuadras de las 18 pasivas sobre `a1n1`…`a1n4` (sin asserts nuevos de balance: solo `victory`/`defeat` donde los tests de F13 ya los fijan). Cubre: R-ND3, R-ND4, R-ND5, R-ND6, R-ND7, R-ND8, R4, R5, R38, R39.
  Evidencia: _(salida de la suite nueva + `git diff --name-only <base>..HEAD -- server/migrations` vacío)_

- [ ] T9 — Verificación final: `cd server && npx jest --runInBand --forceExit` y `cd client && npx vitest run` completas, más `cd client && npx vite build` (o `npm run build`); citar `Test Suites: N passed`, `Tests: M passed` y comparar con la línea base F13 (server 29 suites / 459 tests). Comprobar R-ND1…R-ND10 con los comandos de verificación de `requirements.md` §A; `git diff --name-only <base>..HEAD` solo en rutas permitidas (R-ND9); `grep -rn "Math.random" server/src/services/combat/` vacío. Actualizar `CHANGELOG.md` bajo `## [Unreleased]` (incluyendo que lyra/finn son inertes en campaña hasta que haya `def`/`range` en enemigos, Q6). Cubre: R41, R-ND1, R-ND2, R-ND3, R-ND4, R-ND5, R-ND6, R-ND7, R-ND8, R-ND9, R-ND10, R35.
  Evidencia: _(líneas finales de jest y vitest; salida del build; salida de los greps)_

## Bloqueado

_(vacío)_
