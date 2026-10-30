# Review — feature 14 `combate_pasivas_estados`

**Veredicto:** APPROVED

Revisado en `feature/combate_pasivas_estados` (HEAD `7b77d73`), base `1395f33`. Ronda 1 (lente artefacto): diff y módulos leídos en frío (`effects.js`, `engine.js`, `gameConfig.js`) antes de ejecutar nada; luego contraste con `requirements.md`, `design.md` §3, §6, §9 y `tasks.md`. Después, ejecución de baseline (suites completas).

## Trazabilidad

| Requisito | Task | Evidencia | Verificación del reviewer |
|---|---|---|---|
| R-ND1 no borrar | T1, T3, T9 | `git diff -U0 1395f33 -- shared/gameConfig.js \| grep '^-[^-]'` vacío | Verificado: cero líneas borradas. `engine.js` solo añade enganches (`effects.begin`, `roundStart`, `attackMods`, `afterAttack`, `extraHit`, `incoming`, `afterHit`, `roundEnd`, `skipsAction`). |
| R-ND2 campaignSim intacto | T3 | `git diff 1395f33 -- campaignSim.js` vacío | Verificado (`--name-only` del diff completo no lo lista). |
| R-ND3 engineVersion 1 | T8 | `COMBAT.engineVersion === 1` en test | Verificado por lectura de `gameConfig.js` (sin cambios en `COMBAT`). |
| R-ND4 sin claves nuevas en enemy/heroes/log | T8 | test de claves en `combatV2.passives.test.js` | Verificado: `state.fx` es la única clave nueva (`effects.js:25`, perezosa). `engine.js:124-134` sin cambios. |
| R-ND5 sin migraciones | T9 | `git diff --name-only 1395f33 -- server/migrations` vacío | Verificado. |
| R-ND6 tests existentes intactos | T1–T9 | `git diff --name-status 1395f33 -- server/tests client/src/tests` → solo `A` (3 archivos) | Verificado. |
| R-ND7 sin Math.random | T2, T9 | `grep -rn Math.random server/src/services/combat/` vacío | Verificado. Todo azar sale de `createRng(s)` (`effects.js:179`, `rng.js:19-23`). |
| R-ND8 balance en gameConfig | T1 | `HERO_PASSIVE_FX`/`COMBAT_FX` en `gameConfig.js:1160-1206` | Ver Obs. 2 (piso de curación `Math.max(1, …)` en `effects.js:217`). |
| R-ND9 fuera de client/art | T9 | `git diff --name-only 1395f33` (11 archivos) solo en rutas permitidas | Verificado. |
| R-ND10 identificadores estables | T2, T7 | contrato de eventos en tests | Inspeccionado: sin texto de UI nuevo. |
| R1 `HERO_PASSIVE_FX` por id (18) | T1 | `heroPassives.test.js` | Verificado: 18 claves = `HEROES`. |
| R2 `passive` literal | T1 | 18 tests por héroe | Verificado: sin líneas `-` en el bloque `HEROES`. |
| R3 propiedades de HEROES | T1 | test `Object.keys(HEROES[id])` | Verificado. |
| R4 pasivas solo con heroId válido | T3 | `passivesOf` (`effects.js:173-174`) | Verificado: `heroId` null/`h1` → `[]`. |
| R5 sin fx ni RNG sin pasivas | T3 | `combatV2.engine.test.js` verde | Verificado: `ensureFx` solo en `applyStatus`, `used`, `charge`; `createRng` no avanza sin `float()`. |
| R6 ATK aditivo, daño multiplicativo | T4 | `combatV2.passives.test.js` tanda 1 | Verificado: `effects.js:274` `1 + atkSum − down`; `mul = atk × dmgMul × critMul` (`:277`). |
| R7 DEF aditiva | T4 | tanda 1 thorin | Verificado: `effects.js:359`; `damage.js` sin cambios. |
| R8 aria | T4 | aria 2v1/1v1 | Verificado (`numAdvantage`, `effects.js:191`). |
| R9 thorin | T4 | 500/1000 vs 499/1000 | Verificado (`effects.js:192`, `<` estricto). |
| R10 lyra | T5 | def 100→90 solo habilidad | Verificado (`ignore`, `effects.js:279-280`). |
| R11 zara | T7 | `atkDown 0.20` dur 2 | Verificado (`afterAttack`, `effects.js:299-308`). |
| R12 finn | T4 | ranged/melee | Verificado (`targetRanged`, `:194`). |
| R13 elena | T7 | dodge melee, ranged sin RNG | Verificado (`incoming` evalúa `holds` antes de `chanceOk`, `:335-337`). |
| R14 viktor | T4 | slots 1,3 vs 4 | Verificado (`effects.js:350`, `|Δslot|=1`, excluye a viktor, `:344-353`). |
| R15 seraph | T6 | 50→58, 98→100 | Verificado (`heal` con tope, `:158-165`). |
| R16/R16b shadow | T5 | primer golpe ×1.4 | Verificado (`firstAttack` + `f.used`, `:310-314`). |
| R17 vex | T7 | 2 hits / energía una vez | Verificado (`engine.js:69-81`, `extraHit` solo en golpe original). |
| R18 varok | T4 | ronda 1 | Verificado (`roundEq`, `:197`). |
| R19 morghal regen | T6 | +5 % con tope | Verificado. |
| R19b morghal atkDown | T7 | refresca sin acumular | Verificado (`afterHit`, `:365-372`; `applyStatus` refresca, `:59-64`). |
| R20 azyra dodge | T7 | RNG forzado | Verificado (`chance 0.20`, `passive` `dodge`). |
| R20b azyra crit | T7 | ×1.5, chance 0.10 | Verificado (`COMBAT_FX.critMult`, `:264-266`). |
| R21 fenn | T4 | 1…6 rondas | Verificado: `Math.min(cap, value × round)` (`:257`). |
| R22/R22b kryx | T5 | r3/r6, descarga ×1.6 | Verificado (`roundMultiple`, `charged`, `discharge` en `afterAttack`). |
| R23/R23b serafina | T6 | pct 0.15, 100→85 | Verificado: `absorb` tras `mitigate` (`engine.js:94`); independiente de `s.shield` (`:89`). |
| R24 gorr stun | T7 | RNG forzado | Verificado. |
| R25/R25b nyx | T5 | 14/100 ejecutado, 15/100 no, jefe no | Verificado (`execute = !s.isBoss`, `:269`). |
| R26–R28 estados | T2 | `combatV2.status.test.js` 21 tests | Verificado: `applyStatus` (`:46-71`). |
| R29 stun | T2 | skip una vez | Verificado (`skipsAction`, `:74-85`). |
| R30 DoT | T2 | burn/poison, muerte, victoria | Verificado (`dotTick`, `:89-111`). |
| R31 multiplicadores de estados | T2 | dps 40→32 | Verificado (`engine.js:89`, `effects.js:357`). |
| R32 shield pct/pool | T2 | pool 30/50 y 30/10 | Verificado (`absorb`, `:114-132`). |
| R33 inmunidad a control | T2, T5 | boss/immune bloquea stun | Verificado (`isControlImmune`, `:39-41`); `blocked` sin RNG (`:303-306`). |
| R34 muertos sin estados | T2 | `roundEnd` | Verificado (`:139-141`). |
| R35 eventos | T2 | contrato | Verificado: `kind` nuevos solo `passive/status/dot/heal`. |
| R36 `passive` solo si cambia la ronda | T7 | aria sin evento | Verificado (`ev` solo en crit/execute/charge/discharge/extraHit/dodge). |
| R37 orden de RNG | T7 | secuencias forzadas | Verificado: crit → estado → extraHit; dodge antes de DEF. |
| R38 pura | T2 | sin `require` de DB/fs | Verificado: `effects.js:5-6` solo `gameConfig` y `rng`. |
| R39 CAMPAIGN sin cambios | T1, T8 | `gameConfig.js` sin `-` | Verificado. |
| R40 `range` solo lectura | T3, T7 | enemigos melee/ranged | Verificado. |
| R41 suites verdes | T9 | ver ejecución abajo | Verificado. |

Ejecutado por el reviewer (worktree `feature/combate_pasivas_estados`):

- `cd server && npx jest --runInBand --forceExit` → `Test Suites: 33 passed, 33 total`, `Tests: 545 passed, 545 total`.
- `cd client && NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules npx vitest run` → `Test Files 26 passed (26)`, `Tests 421 passed (421)`.
- `cd client && NODE_PATH=... npx vitest run src/tests/iconSheet.test.js` → `15 passed`. El fallo `Cannot find module 'sharp'` que reportó el implementador es de entorno: `sharp` vive en la raíz del repo principal (`kingdoms-harvest/node_modules/sharp`), no en `client/node_modules`. No es defecto de la rama (`client/` sin cambios).
- Los junctions del worktree apuntan a `kingdoms-harvest/{client,server}/node_modules`; no quedó junction sobrante en la raíz.

Nota sobre R20 y R36: el evento `hit` con valor 0 que se emite al esquivar (`engine.js:91`) además del `passive` `dodge` (`effects.js:338`), tal como fija `design.md` §5/H8.

## Tasks

- T1–T9: todas `[x]` con `Evidencia:` inline. `## Bloqueado` vacío. OK.
- Las cifras de cada Evidencia coinciden con la ejecución del reviewer (33/545 servidor; 406 de la rama más 15 de `iconSheet` con el entorno correcto en cliente).

## Observaciones (no bloquean)

1. **Nombre engañoso en `engine.js:31`.** `const killedByDot = fx.roundStart();` recibe en realidad "la partida ya terminó" (`effects.js:244` devuelve `killedByDot && (sin enemigos || sin héroes)`). La lógica es correcta (la habilidad se omite solo si la partida acabó; `engine.js:34`), pero el nombre induce a error. Sugerencia para un commit posterior: renombrar a `battleOver`.
2. **Piso de curación codificado.** `effects.js:217` usa `Math.max(1, Math.round(...))`: un piso de 1 HP en `combat/`, en contra de la letra de R-ND8. Es un redondeo mínimo y no un número de balance, así que no bloquea; si se quiere estricto, moverlo a `COMBAT_FX` (p. ej. `healMinHp: 1`).
3. **Derrame y escudo.** Un escudo `pct`/`pool` de `order[0]` reduce el daño total antes del derrame a `order[1]` (`engine.js:94-106`). Es el comportamiento que fija `design.md` §169 (todo modificador del defensor se evalúa sobre `order[0]`; el sobrante viene ya mitigado). Anotado solo como referencia para F15+.
4. **CHANGELOG.** La línea de la feature ya estaba bajo `## [Unreleased]` / `### Added` y nombra `(combate_pasivas_estados)`, con la nota de lyra/finn inertes (Q6). No se duplica.

## Cambios requeridos

Ninguno.
