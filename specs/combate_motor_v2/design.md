# Design — `combate_motor_v2` (feature 13)

Base: rama `feature/combate_motor_v2` (HEAD `91671d9`). Solo `server/` y `shared/gameConfig.js`.

## 1. Idea

Un motor v2 puro al lado de v1. v1 (`campaignSim.js`) no se toca (R-ND2). `campaignService.resolveStep` elige motor por `state.engine` del run guardado (R24); `_buildCombatState` solo escribe `engine: 2` cuando `COMBAT.engineVersion === 2` (por defecto `1`, R-ND3). Con `def = 0`, un enemigo y `spd` iguales, v2 produce el mismo estado que v1 (R27).

## 2. Archivos

| Archivo | Cambio |
|---|---|
| `shared/gameConfig.js` | Agrega `COMBAT` (antes de `module.exports`) y lo exporta. Nada más. |
| `server/src/services/combat/engine.js` (nuevo) | `simulateRoundV2(state, action)` |
| `server/src/services/combat/rng.js` (nuevo) | `mulberry32` con estado serializable |
| `server/src/services/combat/targeting.js` (nuevo) | orden de actores, objetivo por amenaza, enemigo principal |
| `server/src/services/combat/damage.js` (nuevo) | `mitigate(raw, def, K)` |
| `server/src/services/campaignService.js` | 3 puntos de enganche (§3.2) |
| `server/tests/combatV2.unit.test.js` (nuevo) | rng, damage, targeting |
| `server/tests/combatV2.engine.test.js` (nuevo) | spd, amenaza, def, multi-enemigo, eventos, determinismo |
| `server/tests/combatV2.equivalence.test.js` (nuevo) | los 11 escenarios de v1 con v2 + comparación v1↔v2 |
| `server/tests/campaignServiceV2.test.js` (nuevo) | embudo con v2, selector de motor, forma del estado |
| `feature_list.json` | `status` (surgical) |

No se tocan: `campaignSim.js`, `campaignRoutes.js`, `server/migrations/`, `client/`, tests existentes.

### 2.1 `shared/gameConfig.js`

```js
// Motor de combate de campaña. engineVersion 1 = campaignSim.js (v1); 2 = combat/engine.js.
// Pasar a 2 es decisión del owner, en commit propio. Volver a 1 revierte para runs nuevos.
const COMBAT = {
  engineVersion: 1,
  defK: 100,                                   // daño = raw × K/(K+DEF)
  threat: { warrior: 1.5, paladin: 1.3, rogue: 1.0, ranger: 0.7, mage: 0.5 },
};
```
`defK = 100` es la recomendación pendiente del owner (requirements, pregunta 1). El objeto se exporta por referencia: los tests lo mutan (`COMBAT.engineVersion = 2`) y restauran en `finally`; por eso el servicio lee `COMBAT.engineVersion` **en cada llamada** (no lo copia a una constante de módulo).

### 2.2 `combat/rng.js`

```js
// mulberry32 sin estado oculto: el estado vive en el state del run.
function nextFloat(rngState) → { value: number /*[0,1)*/, rng: number /*uint32 nuevo*/ }
function createRng(state)    → { float(): number }   // lee state.rng, lo actualiza en el clon
module.exports = { nextFloat, createRng };
```
Algoritmo mulberry32 estándar (`a = (a + 0x6D2B79F5) | 0; t = Math.imul(a ^ a >>> 15, 1 | a); ...`). `state.rng` es uint32 (`>>> 0`). F13 no tiene consumidores de azar (el objetivo es determinista, pregunta 3), así que `state.rng` no avanza; el módulo y el contrato de persistencia quedan listos y probados para F14 (aturdir, crítico).

### 2.3 `combat/damage.js`

```js
function mitigate(raw, def, K) { return Math.round(raw * K / (K + Math.max(0, def || 0))); }
```
Con `def = 0`: `Math.round(raw)`, idéntico al redondeo de v1 en skills (`campaignSim.js:21,23`) y en el golpe enemigo (`:52`); el golpe de héroe `atk` es entero, por lo que `mitigate(atk, 0, K) === atk`.

### 2.4 `combat/targeting.js`

```js
function principalEnemy(enemies)            // primer vivo por índice, o enemies[0]
function heroTargetOrder(heroes, threat)    // vivos, por threat[class] ?? 1 desc, luego slot asc
function actorOrder(heroes, enemies)        // [{side:'h'|'e', ref}] por spd desc; empate: h antes que e; luego slot/índice asc
```
Actor id público: `h<slot>` (héroes) y `e<índice>` (enemigos, base 0).

### 2.5 `combat/engine.js` — `simulateRoundV2(state, action)`

Importa `ENERGY_MAX`, `ENERGY_PER_ROUND` de `../campaignSim` (solo lectura; no se duplican) y `COMBAT` de `shared/gameConfig`.

Algoritmo (sobre un clon `JSON.parse(JSON.stringify(state))`, como v1):
1. **Normalizar**: si `!s.enemies`, `s.enemies = [s.enemy]`; a cada enemigo sin `id`, `id = 'e'+i`; `s.events ||= []`; `s.eventsVersion = 1`; `s.rng` y `s.seed` quedan como vienen (un estado v1-like sin semilla usa `0`). `def`/`spd` ausentes = 0.
2. `round = s.round + 1`; `from = s.events.length`.
3. **Skill** (si `action.type === 'skill'`): héroe vivo en `slot` o `Error('Héroe inválido para la habilidad')`; `energy < ENERGY_MAX` → `Error('Energía insuficiente')`. `damage`: `mitigate(atk × mult, principal.def, K)`; `execute`: `mitigate(atk × (isBoss ? 4 : 2), …)`; `shield`: `s.shield = mult`. Energía a 0. Evento `skill`; si el principal muere → evento `death`.
4. **Actores** en `actorOrder`. Un héroe vivo: si hay enemigo vivo, pega al principal con `mitigate(atk, enemy.def, K)` (evento `hit`, y `death` si cae); luego `energy = min(ENERGY_MAX, energy + ENERGY_PER_ROUND)` (también si ya no quedan enemigos, como v1). Un enemigo vivo (solo si queda algún héroe vivo): `dmg = mitigate(dps × (1 − shield), h.def, K)` contra el primer objetivo de `heroTargetOrder`; si `dmg > h.hp`, aplica `h.hp` y sigue con el sobrante, ya mitigado, al siguiente (R11). Un evento `hit` por héroe afectado y `death` si cae. Un actor muerto antes de su turno no actúa (R6).
5. `s.shield = 0` al terminar la fase de actores (equivale a v1, que lo reinicia tras el golpe enemigo).
6. **Resultado**: sin enemigo vivo → `victory`; si no, sin héroe vivo → `defeat`. `s.round = round`; si `result === null && s.round >= s.maxRounds` → `defeat`. Si hay `result`, evento `end`.
7. **Alias**: `s.enemy = {…principal}` (`hp`, `maxHp`, `dps`, y los extras que tenga).
8. **Log**: `{ round, enemyHp: max(0, principal.hp), heroes:[{slot,hp:max(0,hp),energy,alive}], result, enemies:[{id,hp:max(0,hp)}], eventRange:[from, s.events.length] }`.

Diferencia deliberada con v1: v1 itera por slot y cada fase es "todos los héroes, luego el enemigo"; v2 intercala por `spd`. Con `spd` iguales (héroes antes que enemigos, slot ascendente) el orden efectivo coincide con v1. Con 1 enemigo, el resultado de ronda es el mismo.

## 3. Puntos de enganche en `campaignService.js`

### 3.1 Import
```js
const { CAMPAIGN, HERO_SKILLS, SWEEP, COMBAT } = require('../../../shared/gameConfig');
const { simulateRoundV2 } = require('./combat/engine');
```
(Se amplía la desestructuración existente de la línea 2; se agrega una línea de `require`.)

### 3.2 `_buildCombatState` (líneas 114–117) y héroes (99–112)
Con `COMBAT.engineVersion !== 2` el retorno es literalmente el de hoy (R22). Con `=== 2`:
- cada héroe del squad suma `def: h.stats.def ?? 0, spd: h.stats.spd ?? 0`; la guarnición suma `def: 0, spd: 0`;
- el estado suma `engine: 2`, `seed`, `rng: seed`, `events: []`, `eventsVersion: 1`, `enemies` y mantiene `enemy` (alias).
- `enemies`: `node.enemies` si existe (`[{hp, dps, def?, spd?, name?}]`), si no `[node.enemy]`; cada uno `{ id: 'e'+i, hp, maxHp: hp, dps, def: def ?? 0, spd: spd ?? 0 }`; `enemy` = copia de `enemies[0]` con solo `{hp, maxHp, dps}`.
- `seed`: `crypto.randomBytes(4).readUInt32BE(0)` al construir el estado (antes de insertar el run; el `run.id` aún no existe). Queda guardado, así que el run es reproducible aunque la semilla nazca aleatoria.

Forma v1 literal que debe seguir saliendo con `engineVersion 1` (para el test de R22):
`{ round, maxRounds, isBoss, shield, heroes, enemy:{hp,maxHp,dps}, log:[] }`.

### 3.3 `resolveStep` (línea 163)
```js
const out = this._engineFor(state)(state, action);
```
```js
_engineFor(state) {
  if (state.engine === undefined || state.engine === 1) return simulateRound;
  if (state.engine === 2) return simulateRoundV2;
  throw new Error('Motor de combate desconocido');
}
```
El error ocurre antes de `db.update`, así que el run no cambia (R25). El resto de `resolveStep` (persistencia, claim, `roundLog = log[last]`, respuesta) queda igual (R-ND4).

## 4. Errores

| Caso | Dónde | Resultado |
|---|---|---|
| Skill sin héroe vivo en el slot | engine | `Error('Héroe inválido para la habilidad')` (mismo texto que v1) |
| Skill sin energía llena | engine | `Error('Energía insuficiente')` (mismo texto que v1) |
| `state.engine` desconocido | `_engineFor` | `Error('Motor de combate desconocido')`; la ruta lo devuelve como 400 vía `safeErrorMessage` |
| Entrada con `enemy`/`enemies` ausentes | engine | sin manejo especial: lanza `TypeError`, igual que v1 con `enemy` ausente (no es un caso alcanzable por el servicio) |
| Acción distinta de `skill`/`advance` | engine | tratada como `advance`, como v1 |

## 5. Contrato `state.events[]` (versión 1) — para `combate_b` (feature 7)

La escena de `combate_b` DEBE reproducir `stepInstance` leyendo `state.events` y `roundLog.eventRange`, no recomputando combate. Este contrato es la API entre servidor y escena.

**Campos de `state`**: `eventsVersion: 1`, `events: Event[]` (acumulativo del run), `enemies`, `enemy` (alias).
**Cómo leer una ronda**: `data.roundLog.eventRange = [from, to]` → `data.state.events.slice(from, to)`.

```ts
Event = {
  t: number,            // entero ≥ 0, global al run, +1 por evento, sin huecos
  round: number,        // = roundLog.round de esa ronda (1-based)
  actor: string|null,   // 'h<slot>' héroe, 'e<índice>' enemigo, null en 'end'
  target: string|null,  // ídem; null en 'end' y en skill de escudo
  kind: 'hit'|'skill'|'death'|'end',
  value: number|string  // ver tabla
}
```

| kind | actor | target | value | campos extra |
|---|---|---|---|---|
| `hit` | atacante | golpeado | daño aplicado tras mitigación (a héroes: topado por su HP, como v1; a enemigos: sin tope) | `hp`: HP del objetivo tras el golpe (≥ 0) |
| `skill` | héroe | enemigo principal (null si `shield`) | daño (`damage`/`execute`) o `mult` (`shield`) | `skillId`, `skillType` |
| `death` | quien mató (o null) | muerto | `0` | — |
| `end` | null | null | `'victory'` o `'defeat'` | — |

Orden dentro de una ronda: `skill` (+`death`) → actores por `spd` (cada `hit` seguido de su `death`) → `end`.
Reglas de versión: agregar campos o `kind` nuevos NO sube `eventsVersion` (el consumidor ignora lo desconocido); renombrar o quitar un campo, cambiar un tipo o el significado de `value` SÍ lo sube y lo anuncia a `combate_b`. Las features 14–16 agregan `kind` (p. ej. `status`, `heal`) en la versión 1. Un test de contrato fija claves y tipos (R16, R17).

## 6. Alternativas descartadas

1. **Parametrizar `campaignSim.js` con flags (`def`, `spd`) en vez de un módulo nuevo.** Descartada: rompe ND2 (v1 intacto), pone en riesgo los 11 tests y los runs a mitad de camino, y hace inseparable el rollback.
2. **Objetivo del enemigo por sorteo ponderado (`threat` como pesos).** Descartada para F13: con dos héroes de igual amenaza el sorteo deja de reproducir v1 (frontal primero), y mueve el embudo según la semilla. Queda como pregunta abierta 3; `state.rng` ya está para agregarlo después.
3. **Semilla = `run.id`.** Descartada: el `id` se asigna en el `insert`, después de armar el estado; guardarla requeriría un `update` extra y una escritura más por run. Una semilla aleatoria guardada en el estado da el mismo determinismo.
4. **`engineVersion` como columna de `campaign_runs`.** Descartada: viola ND5 (migración) sin necesidad; `state.engine` en el JSON basta y ya se persiste.
5. **Duplicar `ENERGY_MAX`/`ENERGY_PER_ROUND` en `combat/`.** Descartada (ND8): se importan de `campaignSim.js`, una sola fuente.
6. **Eventos solo por ronda (sin acumulado).** Descartada: la escena de `combate_b` puede reproducir un run entero desde `state` sin depender del orden de las respuestas.

## 7. Riesgos

- **Balance de `def`:** con `engineVersion 2` los héroes reales (def 5–20) reciben menos daño que en v1; el embudo (guarnición, def 0) no cambia (R28). Cualquier retoque de `def` de enemigos es dato nuevo, no del test (pregunta 2).
- **`stats.def/spd`:** `computeStats` (`heroService.js:18-36`) recorre todo `baseStats` del héroe, así que `def`/`spd` llegan en `h.stats`; se usa `?? 0` por robustez (héroes sin esas claves).
- **Tamaño de `state.events`:** ≤ ~14 rondas × pocos eventos; el JSON de `campaign_runs.state` crece unos pocos KB. Aceptado.
- **Cliente:** `CombatInstancePanel` lee `state.round`, `state.maxRounds`, `state.heroes` y `state.enemy.hp/maxHp`; todos siguen presentes (R-ND4b). No se toca `client/`.
