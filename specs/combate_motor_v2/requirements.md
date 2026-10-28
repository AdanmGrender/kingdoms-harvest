# Requirements — `combate_motor_v2` (feature 13)

> Alcance: SOLO `server/` y `shared/gameConfig.js` (claves nuevas). Sin `client/`, sin arte, sin migraciones.
> Fuente: `docs/ROADMAP_combate_y_ciudad.md` §1 (ND1–ND10) y §2 "Feature 13". Brief: explorer t_11f39822.
> Convenciones: **v1** = `server/src/services/campaignSim.js` (`simulateRound`), **v2** = `server/src/services/combat/engine.js` (`simulateRoundV2`).
> "Principal" = primer enemigo vivo de `state.enemies` por índice (si ninguno vive, `enemies[0]`).
> Suites de referencia: `cd server && npx jest --runInBand --forceExit` (completa) y `cd client && npx vitest run`.

## A. Reglas de no destrucción (R-ND1 … R-ND10)

## R-ND1
El sistema NO DEBE borrar ni renombrar código, tablas, columnas, claves de `gameConfig` ni endpoints existentes; los únicos cambios en archivos existentes son los puntos de enganche listados en `design.md` §3.
- Verificación: `git diff --numstat <base>..HEAD` sobre `shared/gameConfig.js` muestra 0 líneas eliminadas (salvo la línea de `module.exports` que gana `COMBAT`), y sobre `campaignService.js` solo las líneas del enganche de `design.md` §3.2.

## R-ND2
El sistema NO DEBE modificar `server/src/services/campaignSim.js`.
- Verificación: `git diff <base>..HEAD -- server/src/services/campaignSim.js` vacío.

## R-ND3
El sistema DEBE definir `COMBAT.engineVersion` en `shared/gameConfig.js` con valor `1` por defecto.
- Verificación: test que importa `COMBAT` y comprueba `engineVersion === 1`; `git log -p` del cambio a `2` (si el owner lo aprueba) debe ir en un commit propio, fuera de F13.

## R-ND4
El sistema DEBE seguir devolviendo `{ state, roundLog, result, unlocked }` desde `campaignService.resolveStep` con v1 y con v2, con `roundLog` igual a la última entrada de `state.log`.
- Verificación: tests de `resolveStep` con `engine` ausente y con `engine: 2` comprueban las cuatro claves y `roundLog === state.log[state.log.length-1]`.

## R-ND4b
MIENTRAS un run use v2, el sistema DEBE mantener `state.enemy` como copia del enemigo principal (`hp`, `maxHp`, `dps` como mínimo) tras cada ronda.
- Verificación: test de motor: con 1 y con 2 enemigos, `state.enemy.hp/maxHp/dps` coinciden con los del principal.

## R-ND5
El sistema NO DEBE agregar migraciones ni columnas en F13 (el roadmap ND5 solo admite `createTable`/`addColumn` con default y `down`; esta feature no los necesita), y NO DEBE usar `dropColumn` ni `renameColumn`.
- Verificación: `git diff --name-only <base>..HEAD -- server/migrations` vacío; `engine`, `seed`, `rng` y `events` viajan dentro de `campaign_runs.state` (JSON).

## R-ND6
El sistema NO DEBE modificar `server/tests/campaignSim.test.js`, `campaignService.test.js` ni `combat-balance.test.js`, ni ningún test existente.
- Verificación: `git diff --name-status <base>..HEAD -- server/tests client/src/tests` lista solo `A` (archivos nuevos); suites servidor y cliente verdes citando `Tests: N passed` (solo se tolera el `known_failures` de `feature_list.json`).

## R-ND7
El sistema DEBE derivar todo azar del motor v2 de un RNG con semilla por run (`state.seed`), sin usar `Math.random` en `server/src/services/combat/`.
- Verificación: `grep -rn "Math.random" server/src/services/combat/` vacío; test de determinismo (R20).

## R-ND8
El sistema DEBE definir todo número de balance de v2 en claves nuevas de `shared/gameConfig.js` (`COMBAT`) y NO DEBE codificar `defK`, pesos de amenaza ni la versión de motor en `server/src/services/combat/`.
- Verificación: inspección + test que reemplaza `COMBAT.defK` y `COMBAT.threat` en caliente y comprueba que el daño/objetivo cambian.

## R-ND9
El sistema NO DEBE tocar `client/`, `art-b/` ni `client/public/` (ND9: las features de motor 13–16 no tocan `client/` salvo el adaptador de la 15; ND10: F13 no agrega arte); el trabajo vive en la rama `feature/combate_motor_v2` y `feature_list.json` y `CHANGELOG.md` se editan de forma quirúrgica.
- Verificación: `git diff --name-only <base>..HEAD` solo contiene rutas bajo `server/`, `shared/gameConfig.js`, `specs/combate_motor_v2/`, `feature_list.json` y `CHANGELOG.md`.

## R-ND10
El sistema DEBE redactar todo mensaje de error nuevo visible al jugador en español rioplatense según `docs/lore-glosario.md`, y los ids de `events[].kind` DEBEN ser identificadores técnicos estables (no texto de UI).
- Verificación: inspección de los `throw new Error(...)` nuevos; test de contrato de eventos (R17).

## B. Motor v2

## R1
El sistema DEBE exponer `simulateRoundV2(state, action)` en `server/src/services/combat/engine.js`, con `rng.js`, `targeting.js` y `damage.js` como módulos hermanos en `server/src/services/combat/`.
- Verificación: test que importa los cuatro módulos y comprueba sus exports (`design.md` §2).

## R2
El sistema DEBE implementar `simulateRoundV2` como función pura que devuelve `{ state, result }`, no muta su entrada y no accede a DB.
- Verificación: test con `Object.freeze` profundo sobre la entrada (o comparación JSON antes/después) y `grep -n "require('../../config/database')" server/src/services/combat/` vacío.

## R3
El sistema DEBE calcular el daño como `Math.round(raw × K / (K + def))`, con `K = COMBAT.defK` y `def` del objetivo.
- Verificación: test unitario de `damage.js` con tabla (def 0, 10, 50; K del config) y comprobación de que con `def = 0` el resultado es `Math.round(raw)`.

## R4
SI un héroe o enemigo no trae `def` o `spd` ENTONCES el sistema DEBE tratarlos como `0`.
- Verificación: test con estado de forma v1 (sin `def`/`spd`) corrido con v2: no lanza y equivale a `def = spd = 0`.

## R5
El sistema DEBE ordenar a los actores de la ronda por `spd` descendente, desempatando héroes antes que enemigos y luego por `slot` (héroes) o índice (enemigos) ascendente.
- Verificación: test con `spd` distintos (enemigo más rápido actúa antes que un héroe lento: los `events` salen en ese orden) y con `spd` iguales (héroes primero, slot ascendente).

## R6
El sistema NO DEBE hacer actuar a un héroe o enemigo muerto en la ronda.
- Verificación: test: un héroe muerto por un enemigo más rápido en la misma ronda no pega ni carga energía; un enemigo muerto no emite `hit`.

## R7
CUANDO la acción es `{type:'skill', slot}`, el sistema DEBE aplicar la habilidad del héroe antes del orden de actores, con la semántica de v1: `damage` = `atk × mult`, `execute` = `atk × (isBoss ? 4 : 2)`, `shield` = `state.shield = mult`, sobre el enemigo principal y con la mitigación de R3.
- Verificación: tests equivalentes a `campaignSim.test.js:28,41,49` ejecutados con v2 (R27).

## R8
SI la habilidad pedida no tiene héroe vivo en ese `slot` ENTONCES el sistema DEBE lanzar `Error('Héroe inválido para la habilidad')`, y SI al héroe le falta energía ENTONCES DEBE lanzar `Error('Energía insuficiente')`.
- Verificación: test con `toThrow(/energía/i)` (igual a `campaignSim.test.js:37`) y caso de slot inexistente o muerto.

## R9
El sistema DEBE consumir la energía de la habilidad (a 0) y sumar `ENERGY_PER_ROUND` (importado de `campaignSim.js`, sin duplicar) a cada héroe vivo al actuar, con tope `ENERGY_MAX`, también en la ronda en que muere el último enemigo.
- Verificación: test: tras `skill` el héroe queda con `34`; en ronda de victoria los héroes vivos cargan energía (igual que v1).

## R10
CUANDO un enemigo vivo actúa, el sistema DEBE elegir objetivos ordenando a los héroes vivos por amenaza descendente (`COMBAT.threat[class]`, `1` si la clase no está) y, a igualdad, por `slot` ascendente.
- Verificación: test con warrior, mage y ranger: el warrior recibe el golpe primero ("el guerrero recibe más golpes"); con clases iguales, el frontal (slot menor) primero.

## R11
CUANDO el daño de un enemigo supera el HP del objetivo, el sistema DEBE derramar el sobrante, ya mitigado, al siguiente héroe vivo en el orden de R10.
- Verificación: test equivalente a `campaignSim.test.js:95` con v2 (dos guerreros, frontal HP 20, dps 30 → segundo HP 40).

## R12
CUANDO un héroe vivo actúa, el sistema DEBE atacar al enemigo principal con `atk` mitigado por la `def` de ese enemigo.
- Verificación: test con 2 enemigos: el segundo no recibe daño mientras el primero vive; al morir el primero, el siguiente golpe va al segundo.

## R13
CUANDO el estado trae `enemies[]` el sistema DEBE usarlo, y SI solo trae `enemy` ENTONCES DEBE tratarlo como `enemies = [enemy]`; en ambos casos el estado devuelto DEBE traer `enemies[]` y `enemy`.
- Verificación: test con estado solo-`enemy` y con `enemies` de 2 elementos.

## R14
El sistema DEBE devolver `result = 'victory'` cuando no queda enemigo vivo, `'defeat'` cuando no queda héroe vivo y `'defeat'` al llegar `round >= maxRounds` sin lo anterior, con prioridad victoria > derrota por muerte > timeout, y `null` si no aplica.
- Verificación: tests equivalentes a `campaignSim.test.js:23,58,64` con v2.

## R15
El sistema DEBE agregar a `state.log` exactamente una entrada por ronda con las claves de v1 (`round`, `enemyHp` del principal, `heroes[{slot,hp,energy,alive}]`, `result`) y, además, `enemies[{id,hp}]` y `eventRange: [from, to]` (índices en `state.events`, `to` exclusivo).
- Verificación: test equivalente a `campaignSim.test.js:77` con v2 más comprobación de `eventRange` contra `state.events`.

## R16
El sistema DEBE producir `state.events[]` acumulativo y `state.eventsVersion = 1`, donde cada evento tiene `{ t, round, actor, target, kind, value }` con las reglas de `design.md` §5 (contrato versionado para `combate_b`).
- Verificación: test de contrato que valida tipos y claves obligatorias de cada evento de una partida completa.

## R17
El sistema DEBE emitir solo los `kind` `hit`, `skill`, `death` y `end` en `eventsVersion = 1`, en orden de resolución determinista, con `t` entero creciente desde 0 sin huecos y `round` igual al `round` de la entrada de `log` de esa ronda.
- Verificación: test de contrato con snapshot de la secuencia `[kind, actor, target, value]` de una partida de referencia.

## R18
El sistema DEBE implementar en `rng.js` un generador mulberry32 sembrado con `seed` que devuelve `[0,1)` y expone su estado interno serializable.
- Verificación: test con vectores de referencia fijos de mulberry32 para una semilla dada.

## R19
El sistema DEBE persistir `state.seed` (semilla inicial) y `state.rng` (estado actual del generador, entero sin signo de 32 bits) dentro de `state`, y avanzar `state.rng` solo cuando se consume un número aleatorio.
- Verificación: test: tras `JSON.parse(JSON.stringify(state))` la ronda siguiente es idéntica; en F13 (sin consumidores de azar) `state.rng` no cambia entre rondas.

## R20
CUANDO se llama dos veces a `simulateRoundV2` con el mismo `state` (misma semilla) y la misma acción, el sistema DEBE devolver resultados `deepEqual`.
- Verificación: test de determinismo con partida completa de 10 rondas ejecutada dos veces.

## R21
CUANDO `COMBAT.engineVersion === 2`, `_buildCombatState` DEBE agregar al estado `engine: 2`, `seed`, `rng`, `events: []`, `eventsVersion: 1`, `enemies[]` (con `enemy` como alias) y copiar `def` y `spd` (`?? 0`) de `h.stats` a cada héroe (la guarnición lleva `def: 0, spd: 0`).
- Verificación: test de `enterNode` con `COMBAT.engineVersion = 2` (restaurado en `finally`) que inspecciona `state` y el JSON guardado en `campaign_runs.state`.

## R22
CUANDO `COMBAT.engineVersion === 1`, `_buildCombatState` DEBE devolver exactamente el estado de hoy, sin `engine`, `seed`, `rng`, `events`, `enemies`, `def` ni `spd`.
- Verificación: test `deepEqual` del `state` de `enterNode` contra la forma v1 literal (`design.md` §3.2) y el test `campaignService.test.js:157-166` (`enterNode` de combate, `state.enemy.hp === 400`) sin cambios.

## R23
CUANDO se crea un run con v2, el sistema DEBE generar `state.seed` como entero sin signo de 32 bits aleatorio al crear el run y guardarlo en el estado; `state.rng` inicial DEBE ser igual a `state.seed`.
- Verificación: test: dos `enterNode` consecutivos del mismo nodo producen semillas distintas (con alta probabilidad; 2 intentos) y `rng === seed`.

## R24
CUANDO `resolveStep` carga un run con `state.engine === 2`, el sistema DEBE resolverlo con `simulateRoundV2`, y SI `state.engine` es `undefined` o `1` ENTONCES DEBE resolverlo con `simulateRound` (v1), con independencia del valor actual de `COMBAT.engineVersion`.
- Verificación: test: run creado con `engineVersion = 1` sigue en v1 tras poner `2` (y a la inversa: run v2 sigue en v2 tras volver a `1`), observable por la ausencia/presencia de `state.events`.

## R25
SI `state.engine` tiene un valor distinto de `undefined`, `1` o `2` ENTONCES `resolveStep` DEBE lanzar `Error('Motor de combate desconocido')` sin modificar el run.
- Verificación: test con `state.engine = 3` insertado a mano: lanza y `campaign_runs.state` queda igual.

## R26
El sistema DEBE definir en `shared/gameConfig.js` y exportar `COMBAT = { engineVersion: 1, defK, threat: {warrior, paladin, rogue, ranger, mage} }` con `defK` positivo y los pesos del roadmap (`warrior 1.5, paladin 1.3, rogue 1.0, ranger 0.7, mage 0.5`).
- Verificación: test de forma de `COMBAT` (tipos, `defK > 0`, 5 clases con peso > 0).

## C. Equivalencia y balance

## R27
El sistema DEBE reproducir con v2 los 11 escenarios de `server/tests/campaignSim.test.js` (con `def = 0`, 1 enemigo y `spd` iguales) con los mismos valores esperados.
- Verificación: nuevo `server/tests/combatV2.equivalence.test.js` que replica los 11 escenarios con `simulateRoundV2` y, además, compara v1 vs v2 campo a campo (`round`, `result`, `enemy.hp/maxHp/dps`, `heroes[].hp/energy/alive`, claves de v1 de cada entrada de `log`) en cada escenario.

## R28
El sistema DEBE dar `victory` a la guarnición en `a1n3` y `defeat` en `a1n4` también con `COMBAT.engineVersion = 2`, por `enterNode` + `resolveStep` con `advance` puro.
- Verificación: nuevo `server/tests/campaignServiceV2.test.js` con copia del escenario de `campaignService.test.js:298-323` bajo v2, que además verifica `state.engine === 2` y `state.events.length > 0`. Si v2 lo rompe se ajustan datos nuevos, nunca el test.

## R29
El sistema DEBE cumplir en tests nuevos: orden por `spd` (R5), amenaza (R10), mitigación por `def` (R3, héroe y enemigo), multi-enemigo (R12/R13) y cambio en caliente de `COMBAT` (R-ND8).
- Verificación: `server/tests/combatV2.engine.test.js` y `combatV2.unit.test.js` con un test por requisito.

## R30
El sistema NO DEBE cambiar la ruta `POST /api/campaign/step` ni `/enter` (validación, acciones aceptadas ni forma de respuesta).
- Verificación: `git diff <base>..HEAD -- server/src/routes/campaignRoutes.js` vacío.

## Preguntas abiertas (decisión del owner)

Ninguna bloquea el spec; cada una trae el valor por defecto que se implementa si el owner no dice otra cosa.

1. **Valor de `COMBAT.defK`.** Con `K/(K+DEF)` y `def` de héroes del catálogo entre 5 y 15 (`gameConfig.js:442-484`), `K = 100` da -9 % a -13 % de daño a `def 10-15` y -33 % a `def 50`; `K = 50` da -17 % / -23 % / -50 %. **Recomendación: `defK = 100`** (curva suave; la defensa pesa pero no vuelve inmortal a un tanque). Es un dato, se cambia en un commit propio.
2. **¿Los enemigos de campaña reciben `def` en F13?** Hoy ningún nodo de `CAMPAIGN` tiene `def`. **Recomendación: no tocar `CAMPAIGN` en F13**; v2 soporta `enemy.def` opcional (default 0) y los números de `def` de enemigos se ajustan en una pasada de balance posterior, cuando el owner pase a `engineVersion = 2`, para no mover el embudo (guarnición `a1n3` gana / `a1n4` pierde) sin necesidad.
3. **Selección de objetivo del enemigo: determinista o ponderada al azar.** El roadmap dice "amenaza ponderada". Un sorteo ponderado rompería la equivalencia con v1 (dos guerreros iguales: el v1 siempre golpea al slot frontal primero, `campaignSim.test.js:95`). **Recomendación: determinista** (orden por amenaza descendente, luego slot, con derrame) en F13; si el owner quiere sorteo, se agrega en F14/F15 con `state.rng` (ya disponible) y un modo `COMBAT.targeting`.
4. **¿Algún nodo de `CAMPAIGN` con `enemies[]` en F13?** **Recomendación: no**; F13 solo habilita el soporte y lo prueba con estados sintéticos. El cliente actual muestra solo `state.enemy` (el principal); mostrar varios es de `combate_b`/F15, no de esta feature.
