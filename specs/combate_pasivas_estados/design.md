# Design — `combate_pasivas_estados` (feature 14)

> Base: `feat/art-direction-b` @`1395f33` (F13 `combate_motor_v2` ya mergeado). Rama `feature/combate_pasivas_estados`.
> Todas las citas `archivo:línea` son de la base. El motor v1 (`campaignSim.js`) NO se toca (R-ND2).

## 1. Resumen

Las 18 pasivas de `HEROES` (`shared/gameConfig.js:972-992`) son hoy texto. Se agrega:

1. **Datos**: `HERO_PASSIVE_FX` (mapa nuevo, un array de efectos por `heroId`) y `COMBAT_FX` (constantes de estados). Dos exports nuevos; los literales `HEROES` y `COMBAT` no se modifican.
2. **Motor**: `server/src/services/combat/effects.js` (módulo nuevo, puro) con los estados con duración y un intérprete de efectos *dirigido por datos* (el código no menciona ningún `heroId`).
3. **Enganches**: unas pocas llamadas a `effects.js` dentro de `simulateRoundV2` (`engine.js`). Sin llamadas, el motor se comporta exactamente como en F13 (R5).

No se toca: `campaignSim.js`, `campaignService.js`, `damage.js`, `targeting.js`, `rng.js`, `client/`, migraciones, `CAMPAIGN`.

## 2. Hallazgos del código que condicionan el diseño

| Hecho | Dónde | Consecuencia |
|---|---|---|
| El héroe del estado trae `heroId` (puede ser `null`: guarnición), `class`, `atk`, `def`, `spd`, `hp`, `maxHp`, `energy`, `skill`, `alive`. | `campaignService.js:100-113, 127-130` | `HEROES[hero.heroId]` resuelve la pasiva sin tocar `campaignService` (R4). |
| El enemigo del estado trae solo `id, hp, maxHp, dps, def, spd`; `def` ≡ 0 en todo `CAMPAIGN`; no hay `range`. | `campaignService.js:133-135` | lyra (R10) y finn/elena (R12/R13) son inertes en campaña hasta que haya datos (Q6, Q10). Se implementan y se prueban con enemigos sintéticos. |
| `isBoss` es del nodo, no del enemigo: `s.isBoss`. | `campaignService.js:117` | Inmunidad a control por jefe = `s.isBoss` para todos los enemigos del nodo (Q4). |
| `s.shield` (habilidad del paladín) es global, por ronda, y se reinicia en `engine.js:88`. | `engine.js:45, 72, 88` | El estado `shield` es distinto y vive en `state.fx.st`; no se reutiliza `s.shield` (Q3). |
| `state.rng`/`createRng(state)` ya existen; `Math.random` está prohibido en `combat/`. | `rng.js:15-23`, `combatV2.unit.test.js:53-59` | Todo azar con `createRng(s)` (R-ND7, R37). Ojo: ni en comentarios la cadena `Math.random`. |
| Los tests fijan las claves exactas de `state.enemy`, `state.log[i]`, `hit`. | `campaignServiceV2.test.js:58,75`, `combatV2.engine.test.js:203-210`, `combatV2.unit.test.js:17-23` | Cero claves nuevas en esos objetos; todo estado nuevo en `state.fx`, creado de forma perezosa (R-ND4, R5). |

## 3. Archivos a tocar

| Archivo | Cambio | Tipo |
|---|---|---|
| `shared/gameConfig.js` | Agregar `HERO_PASSIVE_FX` y `COMBAT_FX` después de `COMBAT` (línea ~1158) y 2 nombres en `module.exports` (línea 1160-). Ninguna línea existente se borra salvo la del cierre del export si se reformatea (preferir agregar líneas). | modifica (aditivo) |
| `server/src/services/combat/effects.js` | Estados + intérprete de `passiveFx`. | **nuevo** |
| `server/src/services/combat/engine.js` | Enganches §3.1. | modifica (solo call-sites) |
| `server/tests/heroPassives.test.js` | 18 tests de texto + esquema + datos. | **nuevo** |
| `server/tests/combatV2.status.test.js` | Tests unitarios de `effects.js` (7 estados, duración, stack, shield, inmunidad, DoT). | **nuevo** |
| `server/tests/combatV2.passives.test.js` | Tests de comportamiento por pasiva en `simulateRoundV2` + determinismo + compat. | **nuevo** |
| `feature_list.json`, `CHANGELOG.md` | Edición quirúrgica (estado; línea bajo `## [Unreleased]` al cerrar). La descripción `HERO_CATALOG` del id 14 se puede corregir a `HEROES` (ND9, cambio quirúrgico opcional). | modifica |

NO se tocan: `campaignSim.js`, `campaignService.js`, `damage.js`, `targeting.js`, `rng.js`, `client/`, `server/migrations/`, tests existentes.

### 3.1 Puntos de enganche en `engine.js` (call-sites; cada uno es una línea o un bloque corto)

| # | Línea base | Enganche | Qué hace |
|---|---|---|---|
| H1 | tras `engine.js:23-27` (definición de `round`, `from`, `emit`) | `const fx = effects.begin(s, round, emit)` | Crea el contexto (`createRng(s)`, índice de pasivas de los héroes vivos). Si no hay pasivas ni estados, `fx.active === false` y todo lo demás es no-op (R5). |
| H2 | antes de `engine.js:30` | `const killedByDot = fx.roundStart(...)` | Fase de inicio de ronda (§6): DoT (`dot`), regen (`heal`), escudo grupal, carga de kryx. Puede dejar a todos los enemigos muertos. |
| H3 | `engine.js:31` | `if (action && action.type === 'skill' && !killedByDot)` | Si el DoT mató a todos, la habilidad no se ejecuta ni gasta energía. Con `killedByDot === false` es idéntico a hoy. |
| H4 | `engine.js:39` y `:42` | `const m = fx.attackMods(hero, target, { skill: true })` y `mitigate(hero.atk * sk.mult * m.dmg, m.def(target.def), K)` | `m` = `{ atk, dmg, ignoreDef, crit, execute }`. Sin pasiva: `atk = dmg = 1`, `ignoreDef = 0` ⇒ misma cuenta. |
| H5 | tras `engine.js:40` y `:43` | `fx.afterAttack(hero, target, { skill: true })` | Aplica estados al objetivo (zara, gorr), consume carga de kryx / bandera de shadow, ejecución de nyx, emite `passive`/`status`. |
| H6 | `engine.js:60-66` | Igual que H4/H5 con `{ skill: false }`; tras el `death` de `:65`, `fx.extraHit(...)` (vex). | El segundo golpe de vex es un `hit` normal (misma emisión que `:64`). |
| H7 | `engine.js:59` y `:69` | `if (fx.skipsAction(a)) continue;` | Salta la acción de una unidad aturdida (R29). Va **después** de los `continue` por muerte (`:59`, `:69`) para no gastar `dur` de unidades muertas. |
| H8 | `engine.js:72` | `dmg` pasa a `fx.incoming(a, order[0], rawDps)`; si devuelve `{ dodged: true }` el golpe vale 0 | Aplica `atkDown` del atacante, `defMod/defDown` del defensor, esquivar, `shield` pct/pool (§7). Con `s.shield` activo se mantiene el factor existente. |
| H9 | tras `engine.js:79` | `fx.afterHit(a, order[0])` | Pasivas `defend` que reaccionan al golpe (morghal ⇒ `atkDown` al atacante). |
| H10 | `engine.js:88` | `fx.roundEnd(...)` justo antes de `s.shield = 0` | Resta `dur`, retira expirados y entradas de muertos (R27, R34). |
| H11 | antes de `engine.js:90` | (nada) | El resultado se calcula igual; las muertes por DoT ya dejaron `alive`/`hp` coherentes. |

`engine.js` sigue exportando solo `simulateRoundV2`. `effects.js` exporta `{ begin, applyStatus, hasStatus, statusSum }` y el resto por la API de `begin`.

## 4. Esquema de datos

### 4.1 `HERO_PASSIVE_FX` (`shared/gameConfig.js`)

```js
// Una clave por id de HEROES. Cada valor es un array de efectos.
// Efecto: { trigger, cond?, effect, value?, chance?, dur?, mode?, scope?, cap? }
const HERO_PASSIVE_FX = {
  aria: [{ trigger: 'stat', cond: { k: 'numAdvantage' }, effect: 'atkMod', value: 0.15 }],
  ...
};
```

| Campo | Valores | Significado |
|---|---|---|
| `trigger` | `stat` (al calcular un golpe propio o recibido), `attack` (cuando el portador ataca), `defend` (cuando lo atacan), `roundStart` | Cuándo se evalúa. |
| `cond` | `{ k, v? }` con `k` ∈ `numAdvantage`, `selfHpBelow`, `isSkill`, `targetRanged`, `attackerMelee`, `allyAdjacent`, `roundEq`, `roundMultiple`, `firstAttack`, `charged`, `targetWounded`, `targetHpBelow` | Condición. Ausente = siempre. |
| `effect` | `atkMod`, `atkModPerRound`, `defMod`, `ignoreDef`, `dmgMult`, `crit`, `dodge`, `extraHit`, `heal`, `applyStatus`, `execute`, `charge` | Qué hace. |
| `value` | número | Magnitud (fracción, p. ej. `0.15` = 15 %; para `dmgMult`/`crit`, el multiplicador `1.4`). |
| `chance` | 0..1 | Probabilidad (consume RNG solo si la condición se cumple, R37). |
| `dur` | entero ≥ 1 | Duración del estado aplicado. |
| `mode` | `pct` \| `pool` | Solo `shield`. |
| `scope` | `self`, `allies` (todos los héroes vivos), `adjacent` (slot ±1), `target` (objetivo del golpe), `attacker` | Sobre quién actúa. Por defecto `self`. |
| `cap` | número | Tope del acumulado (`atkModPerRound`). |

Validación: `heroPassives.test.js` recorre el mapa y falla con un `trigger`/`effect`/`k` fuera de los enums, un `heroId` ajeno a `HEROES` o un efecto sin los campos que su `effect` exige (`applyStatus` ⇒ `value`, `dur` y un `type` en `COMBAT_FX.statusTypes`).

### 4.2 Las 18 entradas (balance en datos, ND8)

El texto de la 2ª columna es el literal que verifica R2 (copiar tal cual en el test).

| id | `passive` (literal) | `passiveFx` |
|---|---|---|
| aria | `Fuego Certero: +15% ATK al atacar con ventaja numérica` | `stat` · `numAdvantage` · `atkMod 0.15` |
| thorin | `Bastión: +30% DEF cuando HP < 50%` | `stat` · `selfHpBelow 0.5` · `defMod 0.30` |
| lyra | `Don Brujo: sus hechizos ignoran 10% de DEF enemiga` | `attack` · `isSkill` · `ignoreDef 0.10` |
| zara | `Maldición del Vacío: −20% ATK al enemigo objetivo durante 2 turnos` | `attack` · `applyStatus atkDown 0.20 dur 2 scope target` |
| finn | `Tiro Preciso: +20% ATK contra enemigos a distancia` | `stat` · `targetRanged` · `atkMod 0.20` |
| elena | `Evasión: 15% de esquivar ataques cuerpo a cuerpo` | `defend` · `attackerMelee` · `dodge chance 0.15` |
| viktor | `Aura Protectora: aliados adyacentes +10% DEF` | `stat` · `allyAdjacent` · `defMod 0.10 scope adjacent` |
| seraph | `Letanía de Hierro: restaura 8% HP al inicio de cada ronda` | `roundStart` · `heal 0.08 scope self` |
| shadow | `Golpe Silencioso: primer ataque hace +40% daño` | `attack` · `firstAttack` · `dmgMult 1.40` |
| vex | `Ráfaga Doble: 25% de golpear dos veces por turno` | `attack` · `extraHit chance 0.25` |
| varok | `Asalto Imparable: +25% ATK durante la primera ronda de cada combate` | `stat` · `roundEq 1` · `atkMod 0.25` |
| morghal | `Carne Putrefacta: regenera 5% HP por ronda; quien lo golpea queda envenenado (−5% ATK)` | `roundStart` · `heal 0.05` **y** `defend` · `applyStatus atkDown 0.05 dur 2 scope attacker` |
| azyra | `Presciencia del Vacío: prevé los golpes — 20% de esquivar y +10% de probabilidad de crítico` | `defend` · `dodge chance 0.20` **y** `attack` · `crit chance 0.10` |
| fenn | `Frenesí Feral: +8% ATK acumulativo por ronda de combate (máx +40%)` | `stat` · `atkModPerRound 0.08 cap 0.40` |
| kryx | `Fragua al Rojo: cada 3 rondas su siguiente descarga hace +60% daño` | `roundStart` · `roundMultiple 3` · `charge` **y** `attack` · `isSkill`+`charged` · `dmgMult 1.60` |
| serafina | `Fe Inquebrantable: escudo de fe grupal que absorbe 15% del daño recibido cada ronda` | `roundStart` · `applyStatus shield mode pct 0.15 dur 1 scope allies` |
| gorr | `Golpe Aplastante: 20% de aturdir al objetivo, que pierde su siguiente ataque` | `attack` · `applyStatus stun dur 1 chance 0.20 scope target` |
| nyx | `Sentencia Silenciosa: ejecuta enemigos bajo 15% HP y hace +50% daño a objetivos heridos` | `attack` · `targetHpBelow 0.15` · `execute` **y** `attack` · `targetWounded` · `dmgMult 1.50` |

Los literales usan `−` (U+2212) en zara y morghal, `—` en azyra, y `%` sin espacio.

### 4.3 `COMBAT_FX` (`shared/gameConfig.js`)

```js
const COMBAT_FX = {
  statusTypes: ['stun', 'burn', 'poison', 'defDown', 'atkDown', 'shield', 'immune'],
  controlTypes: ['stun'],         // los que bloquea la inmunidad a control (R33)
  critMult: 1.5,                  // multiplicador de crítico (Q8)
  dotMinDamage: 1,                // piso del DoT por tick
  rangedValue: 'ranged',          // valor de enemy.range que cuenta como "a distancia"
};
```

### 4.4 Estado con duración (`state.fx`)

```js
// state.fx aparece SOLO si algo lo escribe (R5). Serializable en campaign_runs.state.
state.fx = {
  st:     { h1: [{ type: 'atkDown', value: 0.2, dur: 2, src: 'h3' }], e0: [...] },  // estados por unidad
  used:   { h4: true },     // shadow: primer ataque ya gastado
  charge: { h5: true },     // kryx: descarga cargada (máx. 1)
};
```

`shield` agrega `mode: 'pct'|'pool'`. `src` = id de la unidad que lo aplicó (para R28). Los ids de unidad son `h<slot>` (`engine.js:9`) y `e<i>` (`campaignService.js:134`). `immune` admite `dur: null` (permanente).

| Tipo | Efecto | Duración |
|---|---|---|
| `stun` | La unidad salta su acción (R29). | en acciones perdidas (`dur` 1 = una acción); no baja por ronda |
| `burn` / `poison` | −`value × maxHp` (mín. `dotMinDamage`) al inicio de ronda (R30). Misma mecánica; difieren en el `type` para reglas y UI futuras. | `dur` rondas |
| `defDown` | `def × (1 − Σ value)` (R31). | `dur` rondas |
| `atkDown` | `atk`/`dps` × `(1 − Σ value)` (R31). | `dur` rondas |
| `shield` | Reduce el daño recibido, modo `pct` o `pool` (R32). | `dur` rondas |
| `immune` | Bloquea `controlTypes` (R33). | `dur` o `null` |

Solo `atkDown`, `shield` y `stun` tienen hoy fuente en las 18 pasivas (zara/morghal, serafina, gorr). `burn`, `poison`, `defDown` e `immune` se construyen y se prueban a nivel de `effects.js` (R26–R34) para que F15/F16 (habilidades, jefes) los usen con datos, sin tocar el motor (Q5).

## 5. Fórmula de daño y orden de modificadores (Q7)

Golpe de héroe (hit o habilidad de daño):

```
atkEf  = max(0, hero.atk × (1 + Σ atkMod − Σ atkDown(hero)))      // aditivos entre sí
rawEf  = atkEf × (skill ? sk.mult : 1) × Π dmgMult × crit         // multiplicativos
defEf  = max(0, target.def × (1 − Σ defDown(target)) × (1 − ignoreDef))
daño   = mitigate(rawEf, defEf, COMBAT.defK)                      // damage.js:sin cambios
```

Golpe enemigo contra `order[0]` (misma estructura que `engine.js:72`):

```
dpsEf  = a.dps × (1 − Σ atkDown(a)) × (1 − s.shield)              // s.shield existente intacto
defEf  = max(0, order[0].def × (1 + Σ defMod(order[0]) − Σ defDown(order[0])))
dmg    = mitigate(dpsEf, defEf, K)
dmg    = shield pct/pool del defensor  (round(dmg × (1 − pct)) o pool)
```

`Σ defMod` incluye thorin (propio) y viktor (de aliados adyacentes). Todo modificador del defensor se evalúa sobre `order[0]`, igual que `def` hoy; el sobrante que derrama al siguiente héroe (`engine.js:76-78`) ya viene mitigado y no se vuelve a modificar. Esquivar anula el golpe completo: se emite `passive`/`dodge` y un `hit` de valor 0 sobre `order[0]`.

## 6. Orden de ejecución y RNG

Orden dentro de `simulateRoundV2` (cada paso respeta el original `engine.js`):

1. **Inicio de ronda** (H2, nuevo), en este orden: DoT sobre héroes `h1…hN`, luego enemigos `e0…eM` ⇒ regen (`seraph`, `morghal`, por slot) ⇒ escudos grupales (`serafina`) ⇒ carga de `kryx`. Sin RNG. Una muerte por DoT emite `dot` y luego `death`.
2. **Habilidad** (`engine.js:31-52`), con H4/H5.
3. **Actores** por `actorOrder` (`engine.js:56`): héroe ⇒ H6; enemigo ⇒ H7, H8, H9.
4. **Fin de ronda** (H10): expirar, limpiar muertos; `s.shield = 0`.

Consumo de RNG: una tirada por *acción* a lo sumo por rol, en este orden fijo:
- Héroe que ataca: ① `crit` (azyra) → ② `applyStatus` con `chance` (gorr, solo si el objetivo no es inmune) → ③ `extraHit` (vex, solo en el golpe original).
- Enemigo que ataca: ① `dodge` (elena solo si el atacante es melee; azyra siempre).
- No se consume RNG si la condición no se cumple (R37). Con `chance: 1` o sin `chance` tampoco.
- `createRng(s)` se instancia una vez por ronda en H1; deja `s.rng` avanzado en el estado devuelto (R-ND7).

## 7. Eventos nuevos (contrato; `eventsVersion` sigue en 1)

Mismas claves base que F13 (`t, round, actor, target, kind, value`). Se ignoran por clientes viejos (el cliente actual solo lee `enemy`/`log`).

| `kind` | Claves extra | Cuándo |
|---|---|---|
| `passive` | `passiveId` (heroId), `fx` ∈ `dodge`/`crit`/`execute`/`extraHit`/`charge`/`discharge` | Disparo que cambia el resultado (R36). `actor` = portador, `target` según el caso. |
| `status` | `status` (type), `op` ∈ `apply`/`refresh`/`expire`/`skip`/`blocked`, `dur` | Cambios de estados (R26–R33). `value` = magnitud. |
| `dot` | `status` (`burn`\|`poison`) | Daño por tick; `value` = HP quitado, `target` = unidad. |
| `heal` | `passiveId` | Regen (seraph/morghal); `value` = HP curado (después del tope). |

Modificadores permanentes (aria, thorin, finn, viktor, varok, fenn, lyra) y los multiplicadores de daño de shadow y nyx (×1.5) no emiten evento; solo la ejecución de nyx y los disparos listados arriba.

## 8. Casos de error y bordes

| Caso | Comportamiento |
|---|---|
| `heroId` ausente / `null` / no está en `HERO_PASSIVE_FX` | Sin pasiva, sin RNG, sin eventos (R4). |
| `state.fx` ausente al reanudar un run viejo | `begin` lo trata como `{}`; no se crea hasta que algo escriba (R5). |
| Estado con `type` desconocido en `state.fx.st` (dato corrupto) | Se ignora al calcular; se retira en `roundEnd`. No lanza. |
| Aplicar estado a unidad muerta | No-op, sin evento (R34). |
| Aplicar `stun` a inmune / jefe | `status` `op: 'blocked'`, sin crear estado, **sin consumir RNG** (R33, R37). |
| DoT mata al último enemigo antes de la habilidad | `killedByDot` ⇒ no hay habilidad ni fase de actores; `result: 'victory'` (R30). |
| DoT mata a todos los héroes | `result: 'defeat'` por la regla existente (`engine.js:93`). |
| `value`/`dur` ≤ 0 o no numérico en datos | El test de esquema de `heroPassives.test.js` falla (no hay validación en runtime: son datos del repo). |
| `ignoreDef` con `def: 0` | Efecto nulo (documentado, R10). |
| Estado de entrada | No se muta (el clon `JSON.parse(JSON.stringify(state))` de `engine.js:12` ya lo garantiza, R38). |

## 9. Preguntas abiertas (el owner responde en los comentarios de la tarea [GATE])

> Cada una trae la recomendación del spec-author. Si el owner no responde, se implementa la recomendación.

**Q1 — ¿Dónde vive `passiveFx`?** (brief P1) Opción A: campo dentro de cada `HEROES[id]`; B: mapa nuevo `HERO_PASSIVE_FX` por id. **Recomendación: B.** No cambia ningún objeto existente (ND1), el test R3 fija las claves de `HEROES[id]`, y la UI/`heroService` que leen `HEROES` no ven datos nuevos. Costo: dos tablas que mantener alineadas (lo cubre el test de claves, R1).

**Q2 — ¿Qué es "ventaja numérica" (aria)?** (brief P2) **Recomendación:** héroes vivos > enemigos vivos al momento del golpe. Con la guarnición (1 vs 1) no aplica; en nodos de varios enemigos (F13) aplica menos. Alternativa: contar solo al inicio de ronda — descartada por ser menos reactiva y no ganar nada.

**Q3 — Escudo de serafina: ¿por unidad, grupal o ambos? ¿Convive con `s.shield`?** (brief P3) **Recomendación:** estado `shield` por unidad, aplicado por serafina a todos los héroes vivos, `pct 0.15`, `dur 1`, renovado cada inicio de ronda mientras viva; `s.shield` del paladín queda intacto y ambos se aplican (`s.shield` sobre el `dps`, el estado sobre el daño ya mitigado). El modo `pool` existe en `effects.js` para habilidades futuras, sin uso en F14. Alternativa descartada: reutilizar `s.shield` — es global, de ronda, y lo reinicia `engine.js:88`; mezclaría las dos fuentes.

**Q4 — Inmunidad de jefes y ejecución de nyx.** (brief P4) **Recomendación:** `s.isBoss` ⇒ los enemigos son inmunes a `controlTypes` (`stun` hoy), pero reciben `atkDown`/`defDown`/DoT. La *ejecución* de nyx tampoco funciona en jefes (el texto no lo dice; es la regla estándar del género y evita matar a un jefe de un golpe). `isBoss` es del nodo (`campaignService.js:117`), no de cada enemigo: en un nodo jefe con escoltas, todos son inmunes. Alternativa: marcar `isBoss` por enemigo — requiere tocar `campaignService` y `CAMPAIGN` (fuera de F14).

**Q5 — Veneno de morghal: ¿DoT o ATK↓?** (brief P5) **Recomendación: `atkDown 0.05`, `dur 2`** (el paréntesis del texto dice "−5% ATK"). `poison` queda como estado de DoT disponible en el motor para uso futuro (jefes/habilidades) y cubierto por tests; ninguna pasiva de F14 lo aplica. Si el owner prefiere DoT para morghal, el cambio es solo de datos (`HERO_PASSIVE_FX.morghal`).

**Q6 — Enemigos sin `range`/`def`: ¿se agregan datos a `CAMPAIGN`?** (brief P6) **Recomendación: NO en F14.** Con `def: 0` y sin `range`, lyra y finn no tienen efecto y elena esquiva siempre-melee en campaña; viktor, thorin, aria, etc. sí funcionan. F14 implementa `range` como campo opcional de lectura (`'ranged'`/`'melee'` por defecto) y lo prueba con enemigos sintéticos. Agregar `def`/`range` a nodos reales mueve el embudo (ND6) y es trabajo de la feature de contenido/balance (F15–F17). Se documenta en `CHANGELOG` que lyra y finn son inertes en campaña hasta entonces. Nota: `campaignService._buildCombatState` solo copia `hp, dps, def, spd` al enemigo (`:133-135`), así que `range` tampoco llegaría al motor sin un cambio de 1 línea allí; queda fuera de F14 (R-ND9).

**Q7 — ¿Modificadores aditivos o multiplicativos? ¿Cap?** (brief P7) **Recomendación:** los de ATK/DEF **aditivos entre sí** (`1 + Σ`), los de daño (`dmgMult`, crítico) **multiplicativos** al final (fórmulas §5). El cap de fenn (+40 %) va en datos (`cap`). Un héroe tiene una sola pasiva, así que hoy las combinaciones reales son: pasiva propia + estados de enemigos (`atkDown`) + auras (viktor/serafina de otro héroe). Alternativa: todo multiplicativo — más difícil de leer y sin ganancia.

**Q8 — Crítico (azyra): multiplicador y alcance.** (brief P8) **Recomendación:** mecánica mínima: `COMBAT_FX.critMult = 1.5`, tirada con `chance 0.10` (el texto dice "+10 % de probabilidad", la base es 0). Solo azyra lo usa; no hay estadística de crítico de héroe. Alternativa: diferir el crítico y la pasiva completa — descartado: el aceptable exige las 18 ejecutables.

**Q9 — Adyacencia (viktor).** **Recomendación:** `|slot_a − slot_b| = 1` entre héroes vivos (slots 1-5 son la única noción de posición); viktor no se bufa a sí mismo; sin aura si viktor está muerto. Alternativa: fila/columna 2D — no existe el dato.

**Q10 — Balance y `def` de enemigos de campaña.** **Recomendación:** F14 no cambia ningún dato de `CAMPAIGN` (R39). Con `def: 0` y v2 apagado (`engineVersion: 1`), el embudo no se mueve. Los tests de embudo con v2 se corren y deben seguir verdes; si alguna pasiva los mueve (p. ej. un héroe con aria en `a1n4`), se ajusta el dato de la pasiva, nunca el test (ND6).

**Q11 — Eventos nuevos en `events[]`.** (brief P10) **Recomendación:** sí, `passive`/`status`/`dot`/`heal` (§7), solo cuando algo ocurre; `eventsVersion` sigue en 1 porque son aditivos. F15 (cliente) consume los que le sirvan. Alternativa: no emitir eventos y dejarlos a F15 — descartada: F15 no podría reproducir pasivas sin ellos.

**Q12 — Tests de texto en archivo nuevo.** (brief P12) **Recomendación:** sí, `server/tests/heroPassives.test.js` (18 `test`); es un archivo nuevo, no modifica ninguno existente (ND6).

**Q13 — ¿F14 muestra algo en la UI?** (brief P13) **Recomendación:** no. El cliente cambia solo en F15 (ND9); `state.fx` y los eventos nuevos viajan en el JSON de respuesta sin consumidor.

**Q14 — `onDeath` y otros triggers.** (brief P11) **Recomendación:** omitidos; ninguna de las 18 pasivas los usa. El enum `trigger` se puede extender con datos sin tocar el motor… salvo para un trigger nuevo, que pide un enganche nuevo (documentado).

**Q15 — ¿Pasar `engineVersion` a 2?** **No es de F14.** Queda en `1` (R-ND3). Las pasivas solo corren con runs que ya tengan `engine: 2`, es decir, solo después de que el owner apruebe el cambio, en su commit propio. Hasta entonces, F14 es verificable solo por tests.

## 10. Alternativas descartadas

1. **Programar cada pasiva como código en el motor** (`if (heroId === 'aria') …`). Descartada: viola ND8 ("datos, no código"), hace `engine.js` un hotspot enorme y obliga a tocarlo por cada héroe nuevo. El intérprete de datos tiene 12 `effect` y los 18 héroes se reducen a configuración.
2. **Campo `passiveFx` dentro de `HEROES[id]`.** Descartada (Q1): cambia objetos existentes y rompe la lectura "solo aditivo"; un mapa aparte lo evita.
3. **Reusar `s.shield` para el escudo de serafina.** Descartada (Q3): es global y por ronda; no soporta por unidad ni `pool`.
4. **Guardar estados dentro de `heroes[i]` / `enemies[i]`** (`h.statuses`). Descartada: `heroes[i]` y `log[i].heroes` tienen claves fijadas por tests (`combatV2.engine.test.js:207-210`, `campaignServiceV2.test.js:58,75`). Un `state.fx` aparte, perezoso, no toca esas claves.
5. **Resolver los estados con timers/relojes (ms).** Descartada: el combate es por rondas y debe ser determinista y reproducible desde `state.seed`.
6. **Agregar parámetros opcionales a `mitigate(raw, def, K)`.** Descartada: la firma ya es la que prueban F13 y `combatV2.unit`; el motor computa `rawEf`/`defEf` antes de llamar (§5), `damage.js` queda sin tocar.

## 11. Riesgos y mitigaciones

| Riesgo | Mitigación |
|---|---|
| Romper `combatV2.engine.test.js` o el test de equivalencia v1↔v2 | `fx.active === false` sin pasivas/estados ⇒ ruta idéntica a F13 (R5); correr esos tests tras cada tanda. |
| `engine.js` crece y se convierte en hotspot | Solo call-sites (§3.1); toda la lógica vive en `effects.js`. |
| Colisión con F15 (`combate_b`, adaptador de cliente) en `engine.js` | F15 no toca `engine.js` (solo el adaptador); F14 anuncia los eventos nuevos en §7 para que F15 los reproduzca. |
| `Math.random` aparece en comentarios | El test lo detecta por cadena (`combatV2.unit.test.js:53-59`): no escribirla ni en comentarios. |
| Texto `passive` alterado al "pasar a datos" | 18 tests de literales (R2) + `git diff -U0` sin `-` en `HEROES`. |
| Nuevos exports rompen un test que cuente claves del módulo | `grep -rn "Object.keys(require('../../shared/gameConfig'))"` y similares antes de cerrar T1. |
| Pasivas inertes en campaña (lyra, finn, parte de elena) parecen "bug" | Q6 + línea en `CHANGELOG` + tests con enemigos sintéticos. |
