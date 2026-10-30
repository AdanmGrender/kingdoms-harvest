# Requirements — `combate_pasivas_estados` (feature 14)

> Alcance: SOLO `server/` y `shared/gameConfig.js` (claves nuevas). Sin `client/`, sin arte, sin migraciones.
> Fuente: `docs/ROADMAP_combate_y_ciudad.md` §1 (ND1–ND10) y §2 "Feature 14". Brief: explorer t_e9c08579 (`briefs/combate_pasivas_estados.md`). Depende de F13 `combate_motor_v2` (ya en la base `1395f33`).
> Convenciones: **v1** = `server/src/services/campaignSim.js`; **v2** = `server/src/services/combat/engine.js` (`simulateRoundV2`). **Catálogo de héroes = `HEROES`** (`shared/gameConfig.js:972-992`); el roadmap y `feature_list.json:205` lo llaman `HERO_CATALOG`, nombre que no existe en el repo.
> "Unidad" = héroe (`h<slot>`) o enemigo (`e.id`). "Estado" = efecto con duración sobre una unidad (§C). "Pasiva" = entrada de `HEROES[id].passive`. "Ronda" = una llamada a `simulateRoundV2`.
> Suites de referencia: `cd server && npx jest --runInBand --forceExit` (completa) y `cd client && npx vitest run`.
> Las preguntas abiertas Q1–Q15 están en `design.md` §9; los R que dependen de una respuesta lo indican con `[Qn]` y fijan la **recomendación** del spec-author (el owner puede cambiarla en el gate).

## A. Reglas de no destrucción (R-ND1 … R-ND10)

## R-ND1
El sistema NO DEBE borrar ni renombrar código, tablas, columnas, claves de `gameConfig` ni endpoints existentes; los únicos cambios en archivos existentes son los enganches de `design.md` §3 (llamadas en `engine.js`, claves nuevas y export en `gameConfig.js`).
- Verificación: `git diff --numstat <base>..HEAD` sobre `shared/gameConfig.js` muestra 0 líneas eliminadas salvo la de `module.exports`; sobre `engine.js` solo las líneas de enganche de `design.md` §3.1; `campaignService.js` sin cambios.

## R-ND2
El sistema NO DEBE modificar `server/src/services/campaignSim.js`, y un run sin `state.engine` (o con `engine: 1`) DEBE resolverse sin ninguna pasiva ni estado.
- Verificación: `git diff <base>..HEAD -- server/src/services/campaignSim.js` vacío; test: `simulateRound` v1 sobre un héroe con `heroId: 'aria'` no produce `fx`, `statuses` ni eventos nuevos.

## R-ND3
El sistema NO DEBE cambiar el valor de `COMBAT.engineVersion` (queda en `1`).
- Verificación: test de forma `COMBAT.engineVersion === 1`; los tests de F14 que necesitan v2 usan `engine: 2` explícito en el estado o `withEngine(2, …)` con restauración en `finally`.

## R-ND4
El sistema DEBE conservar el contrato `{ state, roundLog, result, unlocked }` de `campaignService.resolveStep` y NO DEBE agregar claves a `state.enemy`, a `state.heroes[i]` ni a `state.log[i]`; todo dato nuevo vive en `state.fx` (opcional).
- Verificación: `campaignServiceV2.test.js:58,75` y `combatV2.engine.test.js:203-210` siguen verdes sin cambios; test nuevo: tras una ronda con pasivas activas, `Object.keys(state.enemy)`, `Object.keys(state.heroes[i])` y `Object.keys(state.log[i])` son iguales a las de una ronda sin pasivas.

## R-ND5
El sistema NO DEBE agregar migraciones ni columnas (`state.fx` viaja dentro de `campaign_runs.state`, JSON) y NO DEBE usar `dropColumn` ni `renameColumn`.
- Verificación: `git diff --name-only <base>..HEAD -- server/migrations` vacío.

## R-ND6
El sistema NO DEBE modificar, borrar ni saltear ningún test existente; los tests nuevos van en archivos nuevos; los tests de embudo (guarnición vs `a1n3`/`a1n4`) DEBEN seguir verdes con v2.
- Verificación: `git diff --name-status <base>..HEAD -- server/tests client/src/tests` lista solo `A`; `campaignServiceV2.test.js` embudo y `campaignService.test.js` (298-) verdes.

## R-ND7
El sistema DEBE derivar todo azar de las pasivas y estados (crítico, esquivar, aturdir, doble golpe) de `createRng(state)` (`state.rng`, semilla `state.seed`), con un orden de consumo fijo, y NO DEBE usar `Math.random` en `server/src/services/combat/` (ni en comentarios: `combatV2.unit.test.js:53-59`).
- Verificación: `grep -rn "Math.random" server/src/services/combat/` vacío; test de determinismo: misma semilla + misma secuencia de acciones con pasivas de azar activas ⇒ `state`, `events` y `result` idénticos; semillas distintas ⇒ difieren.

## R-ND8
El sistema DEBE definir todo número de balance de pasivas y estados en claves nuevas de `shared/gameConfig.js` (exports nuevos `HERO_PASSIVE_FX` y `COMBAT_FX`; no se agrega nada dentro de los literales `HEROES` ni `COMBAT`) y NO DEBE modificar el texto `passive` de ningún héroe ni codificar números de balance en `server/src/services/combat/`.
- Verificación: `git diff -U0 <base>..HEAD -- shared/gameConfig.js` sin líneas `-` salvo `module.exports`; test que muta en caliente un `value` de `HERO_PASSIVE_FX` y comprueba que cambia el daño.

## R-ND9
El sistema NO DEBE tocar `client/`, `art-b/`, `client/public/` ni `server/src/services/campaignService.js`; `feature_list.json` y `CHANGELOG.md` se editan de forma quirúrgica en la rama `feature/combate_pasivas_estados`.
- Verificación: `git diff --name-only <base>..HEAD` solo contiene `server/src/services/combat/`, `shared/gameConfig.js`, `server/tests/` (A), `specs/combate_pasivas_estados/`, `feature_list.json`, `CHANGELOG.md`.

## R-ND10
El sistema DEBE usar identificadores técnicos estables y en inglés/camelCase para `kind`, `status` y `passiveId` en eventos y estado, y NO DEBE introducir texto visible al jugador.
- Verificación: test de contrato de eventos nuevos (claves y tipos, R20); inspección: ningún `throw new Error` ni string de UI nuevo.

## B. Pasivas como datos

## R1
El sistema DEBE definir en `shared/gameConfig.js` un mapa nuevo `HERO_PASSIVE_FX` con una entrada por cada id de `HEROES` (18), donde cada entrada es un array de efectos `{ trigger, cond, effect, value, dur, chance, scope }` según `design.md` §4. [Q1]
- Verificación: test: `Object.keys(HERO_PASSIVE_FX).sort()` es igual a `Object.keys(HEROES).sort()`, cada array es no vacío y cada efecto pasa el validador de esquema (`trigger`, `effect` y `cond` dentro de los enums de `design.md` §4).

## R2
El sistema DEBE conservar el texto `passive` de cada uno de los 18 héroes idéntico, carácter por carácter, al de la base `1395f33`.
- Verificación: 18 tests (uno por héroe, `server/tests/heroPassives.test.js`) que comparan `HEROES[id].passive` con el literal de `design.md` §5 (incluye `−` U+2212 en zara/morghal, `—` en azyra y `%` sin espacio); más `git diff -U0 -- shared/gameConfig.js` sin líneas `-` en el bloque `HEROES`.

## R3
El sistema NO DEBE modificar ninguna otra propiedad de `HEROES[id]` (`name`, `class`, `rarity`, `sprite`, `baseStats`).
- Verificación: test que fija `Object.keys(HEROES[id]).sort()` a `['baseStats','class','id','name','passive','rarity','sprite']` para los 18.

## R4
El sistema DEBE resolver las pasivas de un héroe del estado v2 buscando `HEROES[hero.heroId]` en `HERO_PASSIVE_FX`, y NO DEBE aplicar pasivas a héroes con `heroId` ausente, `null` o desconocido (p. ej. la guarnición y los ids `h1`, `h2` de los tests de F13).
- Verificación: test: guarnición (`heroId: null`) y héroes `heroId: 'h1'` producen exactamente el mismo `state` que antes de F14 (sin `fx`, sin eventos nuevos, sin consumo de RNG); los tests de `combatV2.equivalence.test.js` siguen verdes.

## R5
MIENTRAS ningún héroe vivo tenga pasivas y ninguna unidad tenga estados, `simulateRoundV2` NO DEBE agregar la clave `fx` al estado, NO DEBE emitir eventos nuevos y NO DEBE consumir RNG.
- Verificación: `combatV2.engine.test.js` (hits 203-205, `log[0]` 207-210, determinismo 283-290) y `combatV2.equivalence.test.js` verdes; test: `state.rng` no cambia en una partida sin pasivas.

## R6
El sistema DEBE aplicar los modificadores de ATK de forma aditiva entre sí (`atk × (1 + Σ atkMod)`, con piso 0), y los multiplicadores de daño (`dmgMult`, crítico) de forma multiplicativa sobre ese resultado, antes de `mitigate`. [Q7]
- Verificación: test con aria (+15 %) y varok (+25 %) en ronda 1 ⇒ `atk × 1.40`; con shadow (+40 %) en primer golpe además ⇒ `× 1.40 × 1.40`.

## R7
El sistema DEBE calcular la DEF efectiva como `def × (1 + Σ defMod)` (piso 0, aditivo) y pasarla a `mitigate`, sin cambiar la firma de `mitigate(raw, def, K)`.
- Verificación: test: thorin con HP < 50 % y `def: 20` ⇒ `mitigate` recibe 26; `git diff -- server/src/services/combat/damage.js` vacío.

## B.1 Las 18 pasivas (una `R` por pasiva; cada una exige un test de comportamiento)

## R8
CUANDO un héroe con la pasiva de aria golpea y los héroes vivos superan en número a los enemigos vivos, el sistema DEBE sumar `+0.15` a su ATK para ese golpe. [Q2]
- Verificación: test aria 2 héroes vs 1 enemigo: daño `mitigate(atk×1.15)`; 1 vs 1: `mitigate(atk)`.

## R9
MIENTRAS el HP de un héroe con la pasiva de thorin sea menor al 50 % de su `maxHp`, el sistema DEBE sumar `+0.30` a su DEF al calcular el golpe que recibe.
- Verificación: test en los bordes: HP 50/100 (no aplica) y 49/100 (aplica); `def` 20 ⇒ 26.

## R10
CUANDO un héroe con la pasiva de lyra usa una habilidad de daño, el sistema DEBE ignorar el 10 % de la DEF del objetivo.
- Verificación: test con enemigo `def: 100`, K 100: `mitigate(raw, 90)`; con golpe normal de lyra: `mitigate(raw, 100)` (no aplica). Contra `def: 0` el efecto es nulo y se documenta.

## R11
CUANDO un héroe con la pasiva de zara golpea, el sistema DEBE aplicar al objetivo el estado `atkDown` de `0.20` con duración 2.
- Verificación: test: el objetivo recibe `atkDown` (evento `status` `apply`), el `dps` del enemigo en la ronda siguiente se reduce 20 %, y el estado expira tras 2 rondas.

## R12
CUANDO un héroe con la pasiva de finn golpea a un enemigo con `range: 'ranged'`, el sistema DEBE sumar `+0.20` a su ATK para ese golpe. [Q6]
- Verificación: test con enemigo `range: 'ranged'` (+20 %) y con enemigo sin `range` o `'melee'` (sin bono).

## R13
CUANDO un enemigo golpea a un héroe con la pasiva de elena y el enemigo es cuerpo a cuerpo (`range` ausente o `'melee'`), el sistema DEBE esquivar el golpe con probabilidad `0.15`. [Q6]
- Verificación: test con RNG forzado (`state.rng` elegido para float < 0.15 y ≥ 0.15): daño 0 y evento `passive` `dodge` en el primero; golpe normal en el segundo; con enemigo `ranged` no se consume RNG.

## R14
CUANDO un enemigo golpea al héroe aliado adyacente (|slot − slot| = 1, ambos vivos) de un héroe vivo con la pasiva de viktor, el sistema DEBE sumar `+0.10` a la DEF de ese aliado en ese golpe. [Q9]
- Verificación: test con viktor en slot 2 y aliados en slots 1, 3 (+10 %) y 4 (sin bono); sin bono para viktor mismo; sin bono si viktor está muerto.

## R15
CUANDO comienza una ronda, el sistema DEBE restaurar al héroe vivo con la pasiva de seraph el 8 % de su `maxHp` (sin pasar de `maxHp`).
- Verificación: test: HP 50/100 ⇒ 58 al inicio de la ronda 2 con evento `heal`; HP 98/100 ⇒ 100 (tope).

## R16
CUANDO un héroe con la pasiva de shadow ejecuta su primera acción de daño del combate (golpe normal o habilidad de daño), el sistema DEBE multiplicar el daño por `1.40`.
- Verificación: test: primer golpe ×1.4, segundo ×1.0, también tras serializar/reanudar el estado (bandera en `state.fx`).

## R16b
El sistema NO DEBE repetir el multiplicador de shadow en las acciones de daño posteriores de ese héroe.
- Verificación: mismo test de R16 (segundo golpe y golpes tras serializar/reanudar el estado ×1.0).

## R17
CUANDO un héroe con la pasiva de vex golpea, el sistema DEBE ejecutar un segundo golpe normal inmediato con probabilidad `0.25`, sin que el segundo golpe pueda generar otro y sin dar energía extra.
- Verificación: test con RNG forzado: 2 eventos `hit` consecutivos del mismo actor (primero) y 1 (segundo); la energía sube `ENERGY_PER_ROUND` una sola vez.

## R18
MIENTRAS sea la ronda 1 del combate, el sistema DEBE sumar `+0.25` al ATK de los héroes con la pasiva de varok, y NO DEBE sumarlo desde la ronda 2.
- Verificación: test: ronda 1 `mitigate(atk×1.25)`, ronda 2 `mitigate(atk)`.

## R19
CUANDO comienza una ronda, el sistema DEBE restaurar el 5 % del `maxHp` al héroe vivo con la pasiva de morghal (sin pasar de `maxHp`).
- Verificación: test: regeneración ronda a ronda con evento `heal`; tope en `maxHp`.

## R19b
CUANDO un enemigo golpea a un héroe con la pasiva de morghal, el sistema DEBE aplicar al enemigo atacante el estado `atkDown` de `0.05` con duración 2. [Q5]
- Verificación: test: tras recibir un golpe el enemigo tiene `atkDown` 0.05 y su `dps` baja 5 % en la ronda siguiente; un segundo golpe refresca la duración sin acumular.

## R20
CUANDO un enemigo golpea a un héroe con la pasiva de azyra, el sistema DEBE esquivar el golpe con probabilidad `0.20`.
- Verificación: test con RNG forzado (float < 0.20 y ≥ 0.20): daño 0 y evento `passive` `dodge` en el primero; golpe normal en el segundo.

## R20b
CUANDO un héroe con la pasiva de azyra golpea, el sistema DEBE aplicar un crítico de multiplicador `COMBAT_FX.critMult` con probabilidad `0.10`. [Q8]
- Verificación: test con RNG forzado: daño × `critMult` y evento `passive` `crit`; sin crítico, daño normal. El orden de consumo de RNG está fijado en `design.md` §6.

## R21
MIENTRAS transcurre el combate, el sistema DEBE sumar al ATK del héroe con la pasiva de fenn `+0.08` por cada ronda jugada hasta un máximo de `+0.40`.
- Verificación: test: rondas 1…6 ⇒ +0.08, +0.16, +0.24, +0.32, +0.40, +0.40 (cuenta `state.round + 1`, no depende de que fenn haya actuado).

## R22
CUANDO comienza una ronda cuyo número es múltiplo de 3, el sistema DEBE cargar la pasiva de kryx (máximo 1 carga).
- Verificación: test: rondas 3 y 6 cargan; sin habilidad disponible la carga persiste (serializada en `state.fx`) y no se acumula.

## R22b
CUANDO un héroe con la pasiva de kryx usa una habilidad de daño con la carga activa, el sistema DEBE multiplicar el daño por `1.60` y consumir la carga.
- Verificación: test: la descarga con carga hace ×1.6; la siguiente sin carga ×1.0.

## R23
CUANDO comienza una ronda y un héroe con la pasiva de serafina está vivo, el sistema DEBE aplicar a cada héroe vivo un estado `shield` en modo `pct` de `0.15` con duración 1. [Q3]
- Verificación: test: con serafina viva cada héroe vivo recibe `shield` `pct 0.15` (evento `status` `apply`); con serafina muerta al inicio de la ronda, ninguno; el escudo expira al fin de ronda.

## R23b
MIENTRAS un héroe tenga `shield` en modo `pct`, el sistema DEBE reducir el golpe enemigo que recibe en ese porcentaje después de la mitigación, de forma independiente de `s.shield` (habilidad del paladín).
- Verificación: test: daño del golpe `round(dmg × 0.85)`; con `s.shield` activo además, ambas reducciones se aplican (primero `s.shield` sobre el `dps`, luego el estado).

## R24
CUANDO un héroe con la pasiva de gorr golpea y el objetivo no es inmune a control, el sistema DEBE aplicarle el estado `stun` con probabilidad `0.20`.
- Verificación: test con RNG forzado: con aturdir, el enemigo pierde su siguiente acción (R29); sin aturdir, actúa normal.

## R25
CUANDO un héroe con la pasiva de nyx golpea a un enemigo no jefe con HP menor al 15 % de su `maxHp`, el sistema DEBE dejarlo en HP 0. [Q4]
- Verificación: test: enemigo 14/100 muere con un golpe aunque el daño sea 1; 15/100 no es ejecutado; jefe 14/100 recibe daño normal, no ejecución.

## R25b
CUANDO un héroe con la pasiva de nyx golpea a un enemigo con `hp < maxHp`, el sistema DEBE multiplicar el daño por `1.50`.
- Verificación: test: enemigo 15/100 recibe ×1.5; 100/100 ×1.0; jefe herido también ×1.5.

## C. Estados con duración (`combat/effects.js`)

## R26
El sistema DEBE soportar los siete tipos de estado `stun`, `burn`, `poison`, `defDown`, `atkDown`, `shield` e `immune` sobre héroes y enemigos, guardados en `state.fx.st[unitId]` como `{ type, value, dur, src }` (más `mode: 'pct'|'pool'` solo en `shield`), con `dur` en rondas (o `null` = permanente solo para `immune`).
- Verificación: test unitario de `effects.js`: aplicar cada tipo crea la entrada con los campos exactos; el estado serializa a JSON y vuelve idéntico.

## R27
CUANDO termina una ronda, el sistema DEBE restar 1 a la `dur` de cada estado (excepto `stun` e `immune` permanente).
- Verificación: test: los estados que llegan a 0 se retiran con evento `status` `op: 'expire'`; un estado `dur 2` aplicado en la ronda 1 está activo en las rondas 1 y 2 y expira al fin de la 2; `dur 1` activo solo esa ronda.

## R28
CUANDO se aplica un estado del mismo tipo y la misma fuente sobre una unidad que ya lo tiene, el sistema DEBE refrescar `dur` al valor mayor y quedarse con el `value` mayor, sin acumular instancias.
- Verificación: test: dos aplicaciones de `atkDown 0.05` dur 2 ⇒ una sola entrada, `value 0.05`; aplicación de `atkDown 0.20` posterior ⇒ `value 0.20`.

## R29
CUANDO una unidad con `stun` debería actuar, el sistema DEBE saltar esa acción (sin golpe y sin energía) y restar 1 a la `dur` del `stun`.
- Verificación: test: el evento es `status` `op: 'skip'`; el `stun` se retira al llegar a 0 y NO expira por el paso de la ronda; aturdir al enemigo en la ronda 1 después de que ya actuó ⇒ pierde su acción de la ronda 2; aturdirlo antes de que actúe ⇒ pierde la de la ronda 1; una sola vez.

## R30
CUANDO comienza una ronda, el sistema DEBE restar a cada unidad con `burn` o `poison` `value × maxHp` (mínimo 1) de HP.
- Verificación: test: se emite un evento `dot`; la unidad que llega a HP ≤ 0 muere con el mismo manejo de `death` y victoria/derrota que un golpe; enemigo con `burn 0.05` y `maxHp 400` ⇒ −20 HP por ronda durante `dur`; un héroe muerto por `poison` marca `alive: false` y evento `death`; DoT que mata al último enemigo da `victory`.

## R31
El sistema DEBE multiplicar el `dps` de un enemigo por `1 − Σ atkDown` (piso 0) y el ATK de un héroe por `1 + Σ atkMod − Σ atkDown` (piso 0), y la DEF efectiva de una unidad por `1 − Σ defDown + Σ defMod` (piso 0).
- Verificación: test: enemigo `dps 40` con `atkDown 0.20` golpea 32; héroe `def 20` con `defDown 0.50` recibe `mitigate(…, 10)`.

## R32
MIENTRAS una unidad tenga el estado `shield`, el sistema DEBE reducir el daño que recibe según su modo: `pct` ⇒ `round(dmg × (1 − value))`; `pool` ⇒ el daño se descuenta primero de `value` y solo el sobrante daña; el `pool` agotado se retira con `status` `op: 'expire'`.
- Verificación: test: pool 30 y golpe 50 ⇒ 20 de daño, estado retirado; pool 30 y golpe 10 ⇒ 0 de daño, `value` 20.

## R33
SI una unidad es inmune a control (estado `immune`, o es un enemigo y `state.isBoss` es `true`) ENTONCES el sistema NO DEBE aplicarle estados de `COMBAT_FX.controlTypes` (`['stun']`) y DEBE emitir `status` con `op: 'blocked'`. [Q4]
- Verificación: test: gorr con RNG forzado contra enemigo de nodo jefe ⇒ no se crea `stun`, evento `blocked`; contra un enemigo con `immune` ⇒ ídem; los debuffs `atkDown`/`defDown` y DoT sí se aplican a jefes; `isBoss: false` ⇒ aturde.

## R34
CUANDO una unidad muere, el sistema DEBE dejar de aplicarle estados y retirar sus entradas de `state.fx.st` al fin de la ronda.
- Verificación: test: enemigo muerto con `burn` no genera `dot` en la ronda siguiente y su clave no queda en `state.fx.st`.

## D. Eventos, determinismo y compatibilidad

## R35
El sistema DEBE emitir como únicos `kind` nuevos `passive`, `status`, `dot` y `heal` en `events[]` con las claves de `design.md` §7, manteniendo `eventsVersion: 1` y sin cambiar las claves de `hit`, `skill`, `death` ni `end`.
- Verificación: test de contrato: claves y tipos de cada `kind` nuevo; los snapshots de F13 (`combatV2.engine.test.js:203-210`) siguen verdes.

## R36
El sistema DEBE emitir un evento `passive` por cada disparo que cambie el resultado de la ronda (esquivar, crítico, ejecución, doble golpe, carga/descarga), pero NO DEBE emitirlo para modificadores permanentes de ATK/DEF.
- Verificación: test: un golpe de aria con ventaja numérica no emite `passive`; un crítico de azyra sí (`passiveId: 'azyra'`, `fx: 'crit'`).

## R37
El sistema DEBE consumir el RNG en un orden fijo y documentado por acción (`design.md` §6) y NO DEBE consumirlo para una pasiva cuya condición no se cumple.
- Verificación: test: secuencia determinista de floats esperados para azyra (esquivar ⇒ crítico) y gorr; test de que gorr contra jefe no avanza `state.rng`.

## R38
El sistema DEBE ejecutar todas las pasivas y estados dentro de `simulateRoundV2` y de `combat/effects.js` sin DB, sin I/O y sin mutar el `state` de entrada.
- Verificación: test: `state` de entrada congelado (`structuredClone` + comparación) igual tras la llamada; `grep -n "require" server/src/services/combat/effects.js` sin `config/database` ni `fs`.

## R39
El sistema NO DEBE modificar los datos de enemigos de `CAMPAIGN` (`hp`, `dps`, `maxRounds`, `isBoss`) ni agregar `def` a enemigos de campaña en F14.
- Verificación: `git diff -U0 -- shared/gameConfig.js` sin líneas `-`; embudo guarnición `a1n3` victory / `a1n4` defeat con v2 sigue verde. [Q6, Q10]

## R40
El sistema DEBE tratar el campo opcional de enemigo `range` (`'melee'` por defecto, `'ranged'`) solo como dato de lectura en el motor, sin exigirlo ni validarlo en `CAMPAIGN`.
- Verificación: test con enemigos sin `range` (melee) y con `range: 'ranged'`; `CAMPAIGN` sin cambios (R39).

## E. Cierre

## R41
El sistema DEBE dejar las suites completas del servidor y del cliente en verde (salvo los `known_failures` de `feature_list.json`), con todos los tests existentes sin tocar y los nuevos en archivos nuevos (`heroPassives.test.js`, `combatV2.status.test.js`, `combatV2.passives.test.js`).
- Verificación: `cd server && npx jest --runInBand --forceExit` y `cd client && npx vitest run` citando `Test Suites: N passed`, `Tests: M passed` (línea base F13: server 29 suites / 459 tests); si el cliente no arranca por el entorno (`@asamuzakjp/css-color`, ver evidencia F13 T10), reproducirlo en el repo principal y citarlo.
