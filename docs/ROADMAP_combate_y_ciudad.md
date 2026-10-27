# Roadmap: combate v2 y ciudad viva (features 13–22)

> Estado: **PROPUESTA**, pendiente de aprobación del owner. Nada de esto está implementado.
> Fecha: 2026-10-27. Autor: Central (director de operaciones).
> Origen: análisis de diseño de dos juegos de referencia, *Kingdom in Chaos* (KiC) y *Last Asylum: Plague* (LA).
> Se leyeron solo datos y textos; no se copió código ni se rompieron protecciones. El detalle está fuera del repo:
> - `D:/Proyectos/_conocimiento/juegos_ref/INFORME_juegos_ref.md`
> - `D:/Proyectos/_conocimiento/juegos_ref/COMBATE_propuesta_KH.md`

Este documento dice **qué se agrega**, **cómo se implementa** y **cómo encaja sin romper lo que ya existe**.
Cada feature sigue el flujo SDD de siempre (`docs/specs.md`):

1. brief del explorer;
2. `specs/<name>/{requirements,design,tasks}.md` (spec-author);
3. **puerta del owner ("aprobado")**;
4. implementer;
5. reviewer.

Acá están las **fichas** de cada spec. Los EARS completos los redacta el spec-author cuando le toca el turno a cada feature: si se escriben antes, quedan viejos.

---

## 0. Punto de partida (lo que ya existe y se protege)

| Pieza actual | Archivo | Qué hace hoy |
|---|---|---|
| Simulador de campaña | `server/src/services/campaignSim.js` (`simulateRound`) | Simulación por rondas, pura y autoritativa en el servidor. Los héroes pegan su `atk` a **un** enemigo, y el enemigo descarga su `dps` en orden de slot. Las habilidades van por clase (`HERO_SKILLS`) y se cargan con energía. |
| Servicio de campaña | `server/src/services/campaignService.js` | `_buildCombatState` arma el estado. `resolveStep` persiste `campaign_runs.state` (JSON) y responde `{state, roundLog, result, unlocked}`. Guarnición de atk 60 para el jugador nuevo. |
| Cliente | `client/src/store/gameStore.js` (`enterNode`, `stepInstance`) | Muestra el estado que devuelve el servidor. |
| Héroes | `shared/gameConfig.js` (`HERO_CATALOG`, `HERO_SKILLS`, `HERO_ITEMS`) | 18 héroes con `atk/def/hp/spd/mgk` y una **pasiva escrita solo como texto**. `def`, `spd`, `mgk` y las pasivas **no se usan** en combate. |
| Recuperación | `heroService.js` (`recovery_until`, `recovering`) | Los héroes heridos no entran a la escuadra. |
| Aldeanos | tabla `villagers` (`role`, `assigned_building_id`, `hunger`, `happiness`), `villagerService.js`, `VILLAGER_ROLES` | Hay roles y asignación a edificios, pero sin bonus de producción por oficio. |
| Almacén y saqueo | `barn.storagePerLevel`, `player_resources.capacity`, `lootRate: 0.15` (combatService) | Hay capacidad, pero nada protege del saqueo. |
| Offline | `idleService.js` (`OFFLINE_CAP_MS` = 12 h) | Reporte "Mientras no estabas". |
| Tests que **no se tocan** | `campaignSim.test.js` (11), `campaignService.test.js` (incluye el embudo: la guarnición limpia a1n3 y a1n4 es muro), `combat-balance.test.js`, `heroService`, `squadService`, `idleService` | Contrato vigente. |

**Cola SDD vigente, intacta:** 5 `hub_b_tramos_nivel` (aprobada por el reviewer, falta el merge) → 6 `reporte_escribano` → 9 `pantallas_b` → 7 `combate_b` → 10 `apk_fase1_verificacion`.

---

## 1. Reglas de no destrucción (valen para TODAS las features 13–22)

Cada spec las copia como requisitos `R-ND*` con evidencia. El reviewer rechaza si falta alguna.

- **ND1. Solo aditivo.** No se borra ni se renombra código, tablas, columnas, claves de `gameConfig` ni endpoints.
  - Lo nuevo vive en módulos nuevos.
  - Lo viejo solo recibe **puntos de enganche** (una llamada, un campo opcional).
- **ND2. El motor v1 sigue vivo.** `campaignSim.js` no se modifica.
  - El motor nuevo va en `server/src/services/combat/` y se elige con `state.engine`.
  - Un run sin `engine` (todos los que ya hay en `campaign_runs`) se resuelve con v1.
  - Así, un combate que esté a mitad de camino en producción no se rompe.
- **ND3. Interruptor y vuelta atrás.**
  - `COMBAT.engineVersion` en `gameConfig.js` vale `1` hasta que el owner apruebe pasar a `2`, en un commit propio.
  - Para volver atrás alcanza con poner `1` de nuevo.
- **ND4. Contrato de respuesta estable.**
  - `resolveStep` sigue devolviendo `{state, roundLog, result, unlocked}`.
  - Los campos nuevos son opcionales (`state.enemies[]`, `state.events[]`, `state.forecast`).
  - `state.enemy` se mantiene como alias del enemigo principal, para que el cliente actual siga andando sin cambios.
- **ND5. Migraciones aditivas.** Solo `createTable` o `addColumn` con default, y cada una con su `down`. Nunca `dropColumn` ni `renameColumn` sobre datos existentes.
- **ND6. Los tests existentes no se tocan.**
  - No se borran, no se saltean y no se cambia lo esperado.
  - La excepción es una justificación archivo:línea **aprobada por el owner**.
  - Los tests de balance de embudo (guarnición vs a1n3/a1n4) se vuelven a correr **también con v2**. Si v2 los rompe, se ajustan los datos nuevos (por ejemplo la `def` de los enemigos), nunca el test.
- **ND7. Determinismo.**
  - Todo azar del motor v2 (crítico, esquivar, aturdir) sale de un RNG con **semilla por run** (`state.seed`), no de `Math.random`.
  - Con la misma semilla y la misma acción, el resultado es el mismo. Hay test.
- **ND8. Datos, no código.** Todo número de balance va en `gameConfig.js`, en claves nuevas.
  - El texto de `passive` de cada héroe queda igual.
  - Se agrega al lado `passiveFx` (datos ejecutables).
- **ND9. Ramas aisladas.** Cada feature va en su worktree `kingdoms-harvest-wt/<name>` y su rama `feature/<name>`, creada desde la rama de integración.
  - `feature_list.json` y `CHANGELOG.md` se editan de forma quirúrgica.
  - Las features de motor (13–16) **no tocan** `client/`, salvo el adaptador de la feature 15.
- **ND10. Canon y arte.**
  - Nombres y textos según `docs/lore.md` y `docs/lore-glosario.md`.
  - Todo arte nuevo pasa por la puerta de p-kh y respeta el contrato visual B (`ui_kit_b`).

---

## 2. Bloque COMBATE (de KiC + LA)

### Feature 13: `combate_motor_v2`, reglas base (Fase A)

**Qué agrega**
- Un motor v2 puro en `server/src/services/combat/`:
  - `engine.js` (`simulateRoundV2`);
  - `rng.js` (mulberry32 con semilla);
  - `targeting.js`;
  - `damage.js`.
- **Fórmula de daño con defensa:** `daño = ATK × K/(K + DEF)`. `K` va en `COMBAT.defK`. Con `DEF = 0` da exactamente el daño de v1.
- **Velocidad:** orden de acción dentro de la ronda (más `spd` actúa antes). Desempata el slot.
- **Amenaza por clase (de KiC):** `COMBAT.threat = {warrior:1.5, paladin:1.3, rogue:1.0, ranger:0.7, mage:0.5}`. El enemigo elige su objetivo por amenaza ponderada, no por slot.
- **Varios enemigos por oleada:** nodo con `enemies: [...]`. Si el nodo sigue con `enemy: {...}`, se toma como `[enemy]`.
- **Log de eventos versionado:** `state.events[]` con `{t, actor, target, kind:'hit'|'skill'|'death'|..., value}`. Es el **contrato que va a reproducir la escena de `combate_b` (feature 7)**.

**Cómo encaja**
- `campaignService.resolveStep` elige el motor según `state.engine` (ND2).
- `_buildCombatState` agrega `engine`, `seed`, `def` y `spd` a cada héroe solo si `engineVersion === 2`.

**Tests nuevos**
- Equivalencia: con `def=0`, un enemigo y `spd` iguales, v2 da el mismo resultado que v1 en los 11 escenarios de `campaignSim.test.js`.
- Determinismo con semilla.
- Amenaza: el guerrero recibe más golpes.
- Embudo de balance con v2.

**Archivos:** solo `server/` y `shared/gameConfig.js` (claves nuevas). Sin arte.

**Por qué va primero:** define el log de eventos que consume la feature 7. Si 7 se construye antes, habría que rehacer su escena.

### Feature 14: `combate_pasivas_estados` (Fase A)

**Qué agrega**
- `combat/effects.js`: los **estados con duración**, que son aturdido, quemadura, veneno, DEF↓, ATK↓, escudo e inmune a control (los jefes).
- Un **motor de pasivas por datos**: `passiveFx: [{trigger, cond, effect, value, dur}]`.
  - Triggers: `onHit`, `onHurt`, `roundStart`, `everyN`, `hpBelow`, `firstAttack`.
  - Las **18 pasivas que hoy son texto** se traducen a datos y cada una lleva un test con su redacción (ej. Torgan "+30 % DEF con HP < 50 %"; Gorr "20 % de aturdir").
- **Pasivas que escalan con la vida perdida (de KiC):** "cada X % de HP perdido, +Y". Es un `cond` de tipo `hpLostStep`.

**Cómo encaja**
- Es un hook dentro del motor v2. v1 no se toca.
- `passive` (texto) se mantiene para la UI.

**Tests:** 18 tests (uno por pasiva) y la duración y expiración de cada estado.

### Feature 15: `combate_sinergias` (Fase B)

**Qué agrega**
- **Triángulo de clases (de LA):** guerrero > explorador > mago > guerrero. El que tiene ventaja recibe un 20 % menos de daño de la clase a la que vence (`COMBAT.classTriangle`). Paladín y pícaro quedan neutrales.
  - Los enemigos tienen `class` opcional; si no la tienen, son neutrales.
- **Bonus por composición (de LA):** 2/3/4/5 héroes de la misma clase o facción dan +X % a HP, ATK y DEF (`COMBAT.compositionBonus`).
  - Equipo "balanceado" (tanque + daño + apoyo): bonus propio.
  - Reusa `FACTIONS`. No suma con el bonus de facción global, que es fuera de combate; la regla exacta se define en el spec.
- **Apoyo que potencia (de KiC):** la habilidad del paladín cura o escuda, y con X % de probabilidad le da +ATK al aliado afectado.
- **Pronóstico antes de pelear:**
  - `GET /api/campaign/forecast/:nodeId` devuelve `ventaja / parejo / desventaja` y los bonus activos.
  - Endpoint nuevo; los existentes no cambian.
- **Adaptador mínimo en el cliente:** un chip de pronóstico en el panel de campaña, con los componentes de `ui_kit_b`.
  - El diseño fino va en `pantallas_b` (feature 9) o en `combate_b` (feature 7), según el orden aprobado.

**Tests**
- Matriz del triángulo.
- Umbrales de composición.
- El pronóstico coincide con los multiplicadores aplicados.
- El embudo sigue verde.

### Feature 16: `combate_profundidad` (Fase C)

**Qué agrega**
- **Cargas que escalan con el equipo (de LA):** ej. el mago acumula [Brasa], con un tope igual a 2 + la cantidad de magos aliados. Otra habilidad las detona.
- **Puntos de combo del pícaro (de KiC):** +1 por golpe, con un máximo de 5. La habilidad gasta todos (× por punto).
- **Habilidad mejorada:** una versión "superior" de la habilidad de clase que se desbloquea por estrellas del héroe.
  - Columna nueva y aditiva `heroes.skill_tier`, con default 0.
- **Afijos de equipo:** lista fija (robo de vida, espinas, % de aturdir, resistencia a control).
  - Campo `affixes` opcional en `HERO_ITEMS`; los ítems existentes quedan sin afijos.

**Migración:** solo `addColumn` con default (ND5).

### Feature 17: `combate_tacticas` (Fase D, **opcional**)

**Qué agrega:** 1 táctica (carta) por batalla, elegida antes de entrar y jugable una vez. Por ejemplo "Muralla de escudos" (inmune a control 1 ronda) o "Grito de guerra".
- Va como `action.type = 'tactic'` en `resolveStep`.
- Las acciones viejas (`skill`, `advance`) siguen igual.

**Requiere arte:** íconos de cartas, con la puerta de p-kh. Se decide después de jugar con 13–15.

**Qué NO se toma:** la física y el tiempo real de KiC, robar o bloquear cartas en PvP, y la monetización de héroes.

---

## 3. Bloque CIUDAD (las 5 ideas de LA)

### Feature 18: `aldeanos_oficio`

**Qué agrega**
- Rasgo y **bonus por oficio**: un aldeano asignado a un edificio de su `VILLAGER_ROLES[role].workBuildings` suma +X % de producción a ese edificio.
- Estrellas o experiencia del aldeano que mejoran el bonus.
- Carácter con una frase de lore.

**Cómo encaja**
- Columnas aditivas en `villagers`: `trait`, `stars` default 0, `xp` default 0.
- `gameTick` y `idleService` multiplican la tasa por `villagerBonus(building)`, que es **1.0 si no hay aldeano**. La producción actual no cambia para nadie hasta que asigne a alguien.

**Tests**
- Sin aldeanos la producción es idéntica a la de hoy (regresión de `gameTick.test.js` e `idleService.test.js`).
- Con el aldeano correcto, +X %.
- Con un oficio equivocado, sin bonus.

### Feature 19: `zonas_niebla_relato`

**Qué agrega**
- El hub B se divide en **zonas cubiertas de niebla**.
- Cada zona se abre por nivel del bastión (`throne_room`) y muestra un **registro corto** (2–4 líneas de lore), que queda en el Códice.

**Cómo encaja**
- Reusa los bancos de niebla que ya tiene `HubSceneB` (`FOG_BANKS`) y el sistema de ranuras de `hub_b_escena`.
- Tabla nueva `player_zones` (o derivada del nivel, sin tabla; se decide en el design).
- **Ningún edificio ya construido queda cubierto:** las zonas con edificios del jugador arrancan abiertas (requisito explícito).

**Arte:** variación de niebla y marco del registro, con la puerta de p-kh. **Va después de `pantallas_b` (9)**, para usar su estilo.

### Feature 20: `almacenes_proteccion`

**Qué agrega**
- El granero, el aserradero, etc. protegen del saqueo una cantidad por nivel: `protectedPerLevel`.
- El saqueo de `combatService` calcula `lootRate × max(0, recurso − protegido)`.
- Tope de acumulación offline visible: lo muestra el reporte del Escribano.

**Cómo encaja**
- Clave nueva `protectedPerLevel` en los edificios de almacén. Si falta, vale 0 y el saqueo queda idéntico a hoy.
- **Va después de `reporte_escribano` (6)**, que ya muestra el "tope de granero": se reusa su vista.

**Tests**
- Sin almacén, el saqueo es idéntico (regresión).
- Con almacén, lo protegido no se roba.

### Feature 21: `desbloqueos_tabla`

**Qué agrega**
- Una tabla única `FUNCTION_UNLOCKS = [{fn, building, level, textKey}]` en `gameConfig.js`.
- Un helper `isUnlocked(player, fn)` en el servidor.
- En la UI, el texto genérico "Se abre con {edificio} Nv.{n}".

**Cómo encaja**
- **Primera etapa:** solo se **registran** los umbrales que ya existen (`SYSTEM_UNLOCK_LEVEL`, `requires` de tropas, etc.) con **los mismos valores**. Un test compara la tabla con las constantes viejas.
- **Etapa posterior y opcional:** se migran los chequeos uno por uno, cada uno con su test de regresión.

No cambia ningún umbral.

### Feature 22: `enfermeria_flujo` (minijuego)

**Qué agrega**
- La enfermería como capa activa: los héroes heridos (`recovery_until`) pasan por estaciones (camilla → botica → reposo).
- El jugador puede **acelerar** la recuperación atendiendo cada estación (tap) o con un aldeano de oficio sanador (sinergia con la 18).

**Cómo encaja**
- Usa la recuperación que ya existe en `heroService`. Sin interacción, el tiempo de recuperación queda **igual que hoy**: el minijuego solo resta tiempo.
- Edificio o escena nueva, con arte y la puerta de p-kh.

**Va al final:** es la más grande en arte y la menos necesaria para el núcleo.

---

## 4. Orden propuesto e integración con la cola actual

| Paso | Feature | Por qué en este orden |
|---|---|---|
| ya | 5 `hub_b_tramos_nivel` (merge pendiente del OK) | Ya aprobada por el reviewer. |
| 1 | 6 `reporte_escribano` | Ya estaba en cola. La 20 la reusa. |
| 2 ‖ | **13 `combate_motor_v2`**, en paralelo con 6 o 9 | Solo servidor, sin arte y sin conflictos de archivos con 6 o 9. Tiene que estar antes de la 7. |
| 3 | 9 `pantallas_b` | Ya estaba en cola. Da el estilo para el pronóstico (15) y las zonas (19). |
| 4 ‖ | **14 `combate_pasivas_estados`** | Motor; hace que las 18 pasivas funcionen. |
| 5 | 7 `combate_b` | Su spec se escribe **contra el log de eventos v2** (13), así la escena sale una sola vez. |
| 6 | **15 `combate_sinergias`** | Lo que más le gustó al owner. Se ve en la escena nueva. |
| 7 | 10 `apk_fase1_verificacion` | Ya estaba en cola. Verifica la APK con el combate nuevo. |
| 8 | **18 `aldeanos_oficio`** → **20 `almacenes_proteccion`** → **21 `desbloqueos_tabla`** | Ciudad, mayormente servidor y poco arte. |
| 9 | **16 `combate_profundidad`** → **19 `zonas_niebla_relato`** → **22 `enfermeria_flujo`** → (17 opcional) | Profundidad y contenido con arte. |

‖ = puede ir en paralelo (máximo 2 workers Sonnet a la vez, según la regla de cupo).

**Única dependencia dura entre lo nuevo y lo viejo:** 13 antes que 7. Todo lo demás es aditivo y puede reordenarse sin romper nada.

---

## 5. Cómo se implementa cada una (el mismo molde)

1. Central crea el worktree `kingdoms-harvest-wt/<name>` y la rama `feature/<name>`.
2. Explorer escribe `briefs/<name>.md`, con los archivos y tests exactos que toca y los puntos de enganche.
3. Spec-author redacta `requirements.md` (EARS, con los R-ND1…ND10 incluidos), `design.md` y `tasks.md`.
4. **Puerta del owner.**
5. Implementer ejecuta `tasks.md` con evidencia inline. La suite completa del servidor y del cliente tiene que estar verde.
6. Reviewer verifica la trazabilidad R ↔ evidencia y los R-ND.
7. Merge con el OK del owner.

**Criterio común de aceptación:** `npm test` (servidor y cliente) verde, sin tests nuevos saltados y sin cambios en lo esperado de los tests existentes.
