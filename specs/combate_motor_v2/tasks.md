# Tasks — `combate_motor_v2`

Orden: config → módulos puros con sus tests → enganche en el servicio → tests de integración y embudo → cierre. Cada tarea cierra con `Evidencia:` inline. Todas parten de `feature/combate_motor_v2`. Ninguna toca `campaignSim.js`, `client/`, migraciones ni tests existentes.

- [ ] T1 — `shared/gameConfig.js`: agregar y exportar `COMBAT = { engineVersion: 1, defK: 100, threat: {...} }` (design §2.1). Test de forma en `combatV2.unit.test.js`. Cubre: R-ND3, R-ND8, R26.
- [ ] T2 — `combat/rng.js` (mulberry32, `nextFloat`, `createRng`) y `combat/damage.js` (`mitigate`) con tests de vectores y tabla de `def`. Cubre: R3, R18, R19, R-ND7.
- [ ] T3 — `combat/targeting.js` (`principalEnemy`, `heroTargetOrder`, `actorOrder`) con tests de orden por `spd`, amenaza y desempates. Cubre: R5, R10.
- [ ] T4 — `combat/engine.js` `simulateRoundV2` según design §2.5: skills, actores, derrame, resultado, alias `enemy`, `log` con `eventRange` y `events[]` v1; sin `Math.random` ni DB. Cubre: R1, R2, R4, R6, R7, R8, R9, R11, R12, R13, R14, R15, R16, R17, R-ND4b, R-ND8.
- [ ] T5 — `combatV2.engine.test.js`: `spd`, amenaza, `def` en héroe y enemigo, multi-enemigo, `enemy` solo vs `enemies`, determinismo con partida de 10 rondas, contrato de eventos (claves/tipos y snapshot), cambio en caliente de `COMBAT`, `state` serializado a JSON y vuelto a correr. Cubre: R2, R5, R6, R10, R12, R13, R16, R17, R19, R20, R29, R-ND7, R-ND8, R-ND10.
- [ ] T6 — `combatV2.equivalence.test.js`: los 11 escenarios de `campaignSim.test.js` con `simulateRoundV2` y comparación v1↔v2 campo a campo por escenario. Cubre: R7, R8, R11, R14, R15, R27.
- [ ] T7 — `campaignService.js`: import de `COMBAT` y `simulateRoundV2`, `_engineFor`, y bifurcación en `_buildCombatState` (`def`/`spd`, `engine`, `seed`, `rng`, `events`, `eventsVersion`, `enemies`/alias; leer antes `computeStats` y `CAMPAIGN` para el mapeo). Con `engineVersion 1` el estado queda idéntico. Cubre: R-ND1, R-ND4, R21, R22, R23, R24, R25.
- [ ] T8 — `campaignServiceV2.test.js`: forma del estado v1 literal (R22) y v2 (R21), `seed` distinta y `rng === seed` (R23), selector por `state.engine` en ambos sentidos (R24), `engine: 3` lanza sin tocar el run (R25), contrato `{state, roundLog, result, unlocked}` con ambos motores (R-ND4), embudo guarnición `a1n3` victory / `a1n4` defeat con `COMBAT.engineVersion = 2` (restaurar en `finally`). Cubre: R-ND4, R21, R22, R23, R24, R25, R28.
- [ ] T9 — Verificación de no destrucción: `git diff` de `campaignSim.js`, `campaignRoutes.js`, `server/migrations`, `client`, `art-b` vacíos; `git diff --numstat` de `gameConfig.js` y `campaignService.js` sin líneas borradas salvo los enganches de design §3; `git diff --name-status -- server/tests client/src/tests` solo `A`; `grep Math.random server/src/services/combat/` vacío. Cubre: R-ND1, R-ND2, R-ND5, R-ND6, R-ND7, R-ND9, R30.
- [ ] T10 — Cierre: `cd server && npx jest --runInBand --forceExit` y `cd client && npx vitest run` completas; `feature_list.json` en `in_progress` durante la obra. (La línea de `CHANGELOG.md` la agrega el reviewer al aprobar, AGENTS.md §3.) Cubre: R-ND6, R-ND9, R-ND10, R28.

## Bloqueado

(vacío)
