# Design — `combate_b` (feature 7, B2)

Base: `feature/combate_b` @`46d156d`. Solo `client/` (+ arte en `client/public/assets/b/`, scripts/manifiestos de `art-b/`). Citas `archivo:línea` verificadas en esa base; las del brief del explorer (`briefs/combate_b.md`) se marcan «(brief)».

## 1. Idea y alcance

Hoy no existe escena Phaser de combate: el combate de campaña es React/DOM (`CombatInstancePanel.jsx`, montado desde `OverlayManager.jsx`) y deduce las animaciones comparando HP entre renders (`CombatInstancePanel.jsx:67-103`, brief), sin leer `roundLog` ni `events`. El único `Phaser.Game` del cliente corre el hub (`PhaserGame.jsx:72`, brief; `BastionHub.jsx:13` monta `<PhaserGame entry="hub" />`).

`combate_b` agrega **`CombatScene`**: una escena Phaser que *reproduce* lo que el servidor ya resolvió. Cada respuesta de `POST /campaign/step` trae `{state, roundLog, result, unlocked}` (`campaignService.js:186-200`, brief). La escena lee `state.events.slice(...roundLog.eventRange)` (contrato F13: `specs/combate_motor_v2/design.md` §5; `engine.js:133`, brief) y anima. **No decide nada** (R3).

**Dentro**: escena, planificador de beats, adaptador v1, formación, mapa de arte, calidad, HUD adaptado, arte B (decisión del owner), mediciones.
**Fuera de alcance** (ver §14): sinergias (F15), `enemies[]` en `CAMPAIGN`, cambio de `engineVersion`, retiro físico de `assets/game/*`, `WaveDefensePanel`, sonido, PvP, cambios de server.

## 2. Arquitectura: tres capas, solo una toca Phaser

```
client/src/game/combat/
  eventPlanner.js     (puro)  planRound(events, ctx) -> Beat[]        R6-R16
  v1Adapter.js        (puro)  deriveEvents(prevState, state, roundLog) R20-R23
  eventSource.js      (puro)  selectEventSource(state, prev)           R21-R22
  formation.js        (puro)  computeFormation(heroes, enemies)        R24-R27
  artMap.js           (puro)  heroArt/enemyArt/bgArt/collectAssetKeys  R28-R32
  combatQuality.js    (puro)  QUALITY, resolveQuality()                R46-R47
  CombatScene.js      (Phaser) ejecuta Beat[] con tweens/partículas
  createCombatGame.js (Phaser) config del Game (FIT 824x1720)
client/src/components/campaign/
  CombatStage.jsx     (React)  contenedor var(--kh-frame-h) + ciclo de vida del Game
  CombatInstancePanel.jsx (modificado) HUD + orquestación
```

Los puros no importan `phaser` ni `shared/` (R3) y se testean con Vitest sin canvas. `CombatScene.js` es delgado: recibe `Beat[]` y los traduce a Phaser. El diseño de Beat:

```ts
Beat = {
  id: string,                       // `${t}:${kind}`
  kind: 'hit'|'skill'|'death'|'end'|'status'|'dot'|'heal'|'passive'|'text',
  at: number, dur: number,          // ms relativos al inicio de la ronda, ya comprimidos (§5)
  actorId: string|null, targetId: string|null,   // 'h<slot>' | 'e<i>'
  scope?: 'squad',
  text?: string, color?: string, intensity?: number,   // para 'text'/'passive'
  hpAfter?: number, status?: {type, op}, synthetic?: boolean
}
```

## 3. Decisiones con archivo:línea

| # | Decisión | Dónde | Motivo |
|---|---|---|---|
| D1 | `CombatScene` es una escena de **un `Phaser.Game` propio** creado por `CombatStage.jsx`, no del juego del hub | nuevo `CombatStage.jsx`; hub en `PhaserGame.jsx:72` (brief) | ver §6 y alternativa A1 |
| D2 | Lienzo lógico **824×1720**, `Scale.FIT`, contenedor `height: var(--kh-frame-h)` | `styles/index.css:407` (`--kh-frame-h`); spike `main.js:6,385` (brief) | #24: prohibido `innerHeight`/`vh` propio (`PhaserGame.jsx:93` usa `window.innerHeight` solo para el hub) |
| D3 | La escena se alimenta de `state.events` por `roundLog.eventRange`; sin `events` entra el **adaptador v1** | `campaignService.js:121-139,142-148` (brief); `engine.js:133` (brief) | `COMBAT.engineVersion` está en 1 (`gameConfig.js:1155`, brief): si la escena exigiera v2 no se vería nada hoy |
| D4 | El HUD sigue en React (barras, energía, skill, `ResultBanner`) y la escena solo dibuja unidades, números flotantes y VFX | `CombatInstancePanel.jsx:118+` | conserva F9 y sus tests |
| D5 | Puerta de salida: la escena emite `combat:round-done` por `EventBridge`; el panel solo pide la ronda siguiente cuando llega | `game/EventBridge.js` (eventemitter3) | reemplaza `window.dispatchEvent('kh')` del spike (`main.js:20`, brief) |
| D6 | Fallback `unavailable`: si `new Phaser.Game` lanza o el contexto no es WebGL/Canvas, `CombatStage` renderiza un bloque vacío del mismo tamaño y avisa al panel | `CombatStage.jsx` | los tests T8 (`pantallasB.test.jsx:394-424`) montan el panel en jsdom sin canvas y esperan banner inmediato (R19c) |
| D7 | Arte por clave: `heroArt(heroId)` → `b/heroes/<class>_{idle,attack}.webp` hoy; `b/heroes/<heroId>_*.webp` si existe en el manifiesto de arte (Etapa B) | `artMap.js` | tres clases ya están en disco; el mapa decide, la escena no adivina |

## 4. Contrato de eventos y tabla de beats

Fuente de los kinds: `specs/combate_motor_v2/design.md` §5 (hit, skill, death, end) y F14 (`effects.js:52,63,69,79,102,106,124,148,163,241,266,322,338`, brief). El consumidor ignora lo desconocido (`design.md` F13 §5, reglas de versión).

| kind | Beat | Notas |
|---|---|---|
| `hit` | embestida del `actor` (≈180 ms), flash de `target`, número flotante `value`, barra al `hp` del evento | `value 0` → «Esquiva» si hay `passive/dodge` en la ronda sobre ese `target` (`effects.js:338`), si no, sin número (R9). Sin `hp` → no mueve la barra; la reconcilia R15 |
| `skill` | beat de skill por clase del `actor` (`warrior` tajo, `mage` proyectil, `ranger` flecha, `paladin` halo, `rogue` doble tajo) | `skillType:'shield'` (`target:null`) → `scope:'squad'`, aura sobre los 5 slots (R10) |
| `death` | caída del `target` (héroe: se atenúa y queda; enemigo: fade 400 ms) | R11 |
| `end` | último beat, 250 ms de pausa, luego `combat:round-done {result}` | `value` = `'victory'`/`'defeat'`; el `result` autoritativo es `data.result` (R5) |
| `status` | `apply`/`refresh`: ícono en la unidad (color por tipo); `expire`: lo retira; `blocked`: «Inmune»; `skip`: «Aturdido» y la unidad no embiste | tipos `stun, burn, poison, defDown, atkDown, shield, immune` (`gameConfig.js:1202`, brief) (R12) |
| `dot` | número pequeño, color por `status` (burn naranja, poison verde) | R13 |
| `heal` | número verde + destello; `actor == target` | R13 |
| `passive` | chispa por `fx`: `crit` (zoom 1,06 + shake 0,008 + número grande), `extraHit` (segundo corte), `charge` (halo), `dodge` (desvío) | `value` en `crit` = multiplicador (1,5); la escena no lo usa para calcular |

Colores: se toman de la paleta del kit B (`docs/art-direction/ui-kit-b.md`), sin hex nuevos fuera de ella (R45); `heal` verde apagado, `dot/burn` ámbar, `dot/poison` verde enfermizo.

## 5. Tiempos y cola

- Duración base por kind: `hit` 420 ms, `skill` 650, `death` 450, `status/dot/heal/passive` 300, `end` 250. Los beats del mismo `actor` se encadenan; los de distinto `actor` pueden solaparse 40 %.
- `ROUND_BUDGET_MS = 2500` (R16): se calcula la duración total y `factor = clamp(2500/total, 0.35, 1)`; todo `at`/`dur` se multiplica por `factor`. El auto-avance actual es cada 2 s (`CombatInstancePanel.jsx:59-64`, brief); 2,5 s + 0,3 s de pausa (R17) → ≈2,8 s por ronda, aceptable en un juego idle.
- `skip()` (toque en el lienzo): `factor` pasa a 0,1 y la ronda cierra en ≤ 300 ms (R18). No hay botón extra.
- `lastT` por combate: eventos con `t ≤ lastT` se descartan (R14).
- Al terminar una ronda: `reconcile(state)` fija HP/vivo/escudo desde el estado autoritativo (R15).

## 6. Montaje: `Phaser.Game` propio (decisión de arquitectura n.º 1)

`CombatStage.jsx` crea `createCombatGame(parent, {quality, registryData})` al montar y `game.destroy(true)` al desmontar (R38). Mientras vive, emite `combat:open` por `EventBridge`; `PhaserGame.jsx` (modificado, ≤ 15 líneas) escucha `combat:open/close` y hace `game.loop.sleep()` / `game.loop.wake()` al hub (R39). Con el hub dormido, el costo de GPU/CPU es el de una sola escena.

Alternativa A1 (descartada): agregar `CombatScene` al `Phaser.Game` del hub y alternar con `scene.start`. Motivo: el hub usa `window.innerHeight` y resolución de dispositivo (`PhaserGame.jsx:93-105`, brief), contrario al lienzo FIT por `--kh-frame-h` que exige #24; cambiar el tamaño del único juego en cada combate pone en riesgo el estado del hub (texturas, `DayNightSystem`). Costo aceptado de A2 (elegida): crear/destruir un contexto WebGL por combate (≈100–200 ms en escritorio; **no medido**, se mide en T11).

## 7. Adaptador v1 (`v1Adapter.js`)

Entrada: `prevState`, `state`, `roundLog`. Para cada héroe, `delta = prev.hp - hp`: si > 0 → `hit` (actor `e0`, `synthetic`); si el héroe pasa a `alive:false` → `death`. Para el enemigo: `delta = prev.enemy.hp - state.enemy.hp` > 0 → `hit` (actor del primer héroe vivo del slot de menor número, `synthetic`); `hp ≤ 0` → `death`. Si hay `result` → `end`. Si el panel disparó `{type:'skill', slot}`, el primer evento es un `skill` sintético del `slot` (`skillType` desconocido → `damage`). Atribución de golpes aproximada por diseño: es la misma información que usa hoy el panel y se marca `synthetic` (R20). No emite `status/dot/heal/passive` (R23).

Campos de `roundLog` v1 que usa: `round`, `enemyHp`, `heroes[{slot,hp,energy,alive}]`, `result` (`campaignSim.js:70-80`). El adaptador usa `state.heroes`/`state.enemy` como fuente principal y `roundLog` como respaldo, así no depende de campos que F13/F14 puedan agregar.

## 8. Formación (`formation.js`)

Lienzo 824×1720 (portrait). Héroes abajo, mirando a la derecha; enemigos arriba, mirando a la izquierda (`docs/art-direction-b.md:34`, brief).

- Héroes: cajas de 190×250 (alto lógico). Slots 1–3 en la fila frontal (`y≈1180`), 4–5 en la trasera (`y≈1010`), `x` repartidos con paso 230.
- Enemigos: 1 → centrado, altura = `ENEMY_HEIGHT_FRAC × 1720` (0,29 normal / 0,36 jefe, R27). 2–4 → escalonados en zigzag con escala 0,8.
- Zona de HUD: banda inferior ~16 % reservada para la fila de héroes React; la formación nunca ocupa `y > 1440`.
- `computeFormation` devuelve cajas y la prueba R24 las valida por intersección. El spike avisó de superposición con 4–5 héroes (`README.md` del spike, brief) → por eso las dos filas.

## 9. Mapa de arte (`artMap.js`)

- `heroArt(heroId, heroClass)`: `b/heroes/<heroId>_idle|attack.webp` si el id figura en `ART_B.heroes`; si no `b/heroes/<class>_…`; `heroId:null` → `warrior` (Guarnición, `campaignService.js:112-118`, brief). Clases sin arte (`paladin`, `rogue`) → `warrior` hasta que la Etapa B las genere.
- `enemyArt(node)`: `ENEMY_BY_NODE[node.id]` → `ENEMY_BY_TYPE[node.type]` → `bruto`. **Se crea una tabla nueva en `artMap.js`**; la del panel (`CombatInstancePanel.jsx:112-113`) se elimina con el diorama. Lista objetivo de 8 enemigos y mapeo propuesto en §11 (Q4).
- `bgArt(node)`: `combat_crypt` por defecto; por `type`/acto en Etapa B.
- `collectAssetKeys(state, node)` (R32): claves únicas de la escuadra viva + enemigos + fondo.
- Rutas: todas bajo `/assets/b/` (R28-R30). `client/public/assets/b/` ya contiene `heroes/{warrior,mage,ranger}_{idle,attack}.webp`, `enemies/bruto_{idle,hit}.webp` y `bg/combat_crypt.webp` (brief); T1 verifica con `ls`.

## 10. Calidad

| nivel | luces | postFX (vignette+bloom) | partículas vivas máx. | notas |
|---|---|---|---|---|
| `low` | 0 | no | 30 | sin `PointLight`, sombras de contacto como imagen |
| `medium` (defecto) | 2 | vignette | 80 | sin bloom |
| `high` | 4 | vignette + bloom | 160 | como el spike (`main.js:67-76,123-125`, brief) |

Valores iniciales, se ajustan con la medición de T11. `cameras.main.postFX` se comprueba antes de usarse (`main.js:123`, brief). Selector: en el panel de Configuración ya existente solo si cabe sin tocar sus tests (Q7); por defecto no hay UI y se cambia por `localStorage['kh_combat_quality']`. Patrón de referencia del hub: `HubSceneB.js:82` (`fxOn`).

## 11. Plan de arte (**decisión del owner**: gasto real)

No se genera arte en esta fase (spec). Estimaciones del brief (no medidas): 1 de cada 4 imágenes se regenera (`art-direction-b.md:110-115`); ≈0,13 USD/imagen (`PAQUETE.md:135`).

| Escenario | Imágenes netas | Llamadas (~+30 %) | Costo est. | Qué ve el jugador |
|---|---|---|---|---|
| **S0** — solo arte existente (Etapa A) | 0 | 0 | 0 USD | 3 clases; paladin/rogue usan `warrior`; enemigo único `bruto`; fondo único |
| **S1** — por clase | 2 (hojas paladin, rogue) + 14 (7 enemigos × idle/hit) + 5 fondos = 21 | ≈27 | ≈3,5 USD | 18 héroes iguales dentro de su clase |
| **S2** — por héroe | 18 hojas + 14 + 5 = 37 | ≈48 | ≈6 USD | cada héroe distinto (cumple `art-direction-b.md:88`) |

Recomendación: **S0 en Etapa A, S1 en Etapa B, S2 solo si el owner lo pide** (Q3). Lista de 8 enemigos (Q4): `bruto` (existe), `carroneros`, `aullador`, `coloso`, `boss_devorador`, `boss_heraldo` (los 6 de `WAVE_ENEMIES`, `gameConfig.js:876-883`) + 2 de acto 2 («sin rostro» y «voz del velo», nombres de nodos `a2n7`/`a2n10`). Nombres e IP originales (R35).

**Puertas de arte para p-kh** (R34): P1 tras generar héroes (hoja de contacto en fondo oscuro, 16:9→recorte, 640 px de alto); P2 tras enemigos; P3 tras fondos. Cada puerta: hoja de contacto con `scripts/contact_sheet_b.js` (brief), veredicto en `evidencia/aprobacion_arte.md`, regeneraciones registradas. Sin P1/P2/P3 aprobadas no se commitea el lote. Pipeline: `scripts/gen_art_b.js --manifest <json> [--only ids] [--force]` (`GEMINI_API_KEY` del owner, nunca en el repo) y `scripts/process_art_b.js` con recortes medidos a mano (brief). Ojo: `art-b/gr/raw/` no existe en el worktree; los crudos se regeneran, no se recuperan.

## 12. HUD: qué cambia en `CombatInstancePanel.jsx`

- **Se quita**: diorama (`:124`), imagen de enemigo (`:142`), retrato `/assets/game/heroes/…` (`:188`), `ENEMY_BY_NODE/BG_BY_TYPE` (`:112-113`), el cálculo `prevEnemyHp/lunge/recoil` (`:67-103`).
- **Se agrega**: `<CombatStage …/>` ocupando el marco; el panel pasa a la escena `state`, `roundLog`, `lastAction`; escucha `combat:round-done`.
- **Se conserva**: barra de vida del enemigo, fila de héroes con energía y toque de skill, «Avanzar ronda», `.kh-close`, `ResultBanner`, `EmberField` y velo de derrota (R40-R41).
- Retratos de la fila (Q6): ícono de clase del kit B (`SpriteIcon`) o miniatura `b/heroes/<class>_idle` recortada; sin `assets/game/` (R42).
- Todos los tamaños de HUD usan `calc(var(--kh-frame-h) * …)` o `%`, como en F9.
- Las dos filas `CAPS` de `pantallasB.test.jsx:81-82` dejan de aplicar (el panel ya no tiene enemigo DOM) y se sustituyen por R27 (R44); el resto de ese archivo, incluidos los barridos AA (`:26`) y T8 (`:394-432`), no cambia.

## 13. Casos de error

| Caso | Dónde | Comportamiento |
|---|---|---|
| `state.events` ausente (v1) | `selectEventSource` | adaptador v1 (R20) |
| `eventsVersion !== 1` | `selectEventSource` | adaptador + un warn (R22) |
| `kind` desconocido / evento malformado | `planRound` | se ignora, un warn por causa (R8) |
| `roundLog.eventRange` ausente con `events` presente | `planRound` | usa `events.filter(e => e.round === roundLog.round)` |
| Textura no carga | `CombatScene.preload` | placeholder generado + warn (R31) |
| `new Phaser.Game` lanza / sin canvas | `CombatStage` | modo `unavailable`, banner inmediato (R19c) |
| Cierre del panel con ronda en curso | `CombatStage` | `destroy(true)`, sin `setState` posterior (R38) |
| La escena no emite `round-done` | panel | tras 4000 ms se libera el bloqueo (R19b) |
| Respuesta con `result` pero sin `events` y estado v2 | `planRound` | solo `end`; la escena igual reconcilia (R15) |
| Skill pedida durante reproducción | panel | se encola, se envía al quedar ociosa (R17) |

## 14. Alternativas descartadas y fuera de alcance

- **A1** — mismo `Phaser.Game` que el hub: ver §6.
- **A2 (descartada)** — dejar la animación por deltas de HP en el panel React y solo cambiar el arte. Motivo: no cumple «el combate lo reproduce la escena contra `state.events`», y el adaptador v1 ya cubre el caso sin eventos.
- **A3 (descartada)** — exigir `engineVersion 2` antes del merge y no escribir adaptador. Motivo: la decisión de pasar a v2 es del owner y va en commit propio (`gameConfig.js:1153`, brief); con v1 el combate quedaría sin escena.
- **A4 (descartada)** — portar el spike con su RNG de daño (`main.js:9-19`). Motivo: viola server-authoritative.
- **A5 (descartada)** — calcular pasivas/estados en el cliente a partir de `HERO_PASSIVE_FX`. Motivo: duplica reglas; basta con representar `status/passive/heal/dot`.
- **Fuera de alcance**: sinergias (F15) · `enemies[]` en `CAMPAIGN` y balance (ND6, otra feature; la escena ya soporta grupos) · conmutar `engineVersion` · `finn`/`range` (ningún nodo define `range`, `gameConfig.js:1206`, brief) · `WaveDefensePanel` (Marea, bestiario propio, `:11-20`, brief) · borrar `assets/game/*` (R52; `HeroPanel.jsx:62` los usa) · sonido · multijugador.

## 15. Preguntas abiertas (gate del owner)

| Q | Pregunta | Recomendación |
|---|---|---|
| Q1 | ¿Un `Phaser.Game` aparte con hub dormido (§6) o la misma instancia? | Aparte + `loop.sleep()` del hub. |
| Q2 | ¿Se pasa `COMBAT.engineVersion` a 2 antes o después de F7? | Después, en commit propio; F7 soporta ambos (R20-R22, R50). Sin v2 no se ven `status`/`passive`. |
| Q3 | ¿Arte S0, S1 o S2 (§11, ≈0 / ≈3,5 / ≈6 USD)? | S0 ahora (Etapa A); S1 en Etapa B; S2 opcional. |
| Q4 | ¿Lista de 8 enemigos y su mapeo a nodos? | La de §11; mapeo `a1n3`→`bruto`, `a1n7`→`carroneros`, `a1n4/a1n8` (wave)→`aullador`, `a1n5`→`boss_heraldo`, `a1n9`→`boss_devorador`, `a2n5`→`coloso`; el resto cae a `bruto` hasta que exista arte. |
| Q5 | ¿Oleadas con `enemies[]` en `CAMPAIGN` entran en F7? | No: otra feature (toca balance y `combat-balance.test.js`). |
| Q6 | ¿Retrato de la fila de héroes: miniatura del arte B o ícono de clase del kit? | Ícono de clase del kit (0 arte nuevo). |
| Q7 | ¿Selector de calidad visible en Configuración? | No en F7 (tocaría los tests de `SettingsPanel`); solo `localStorage`. |
| Q8 | ¿Presupuesto de ronda 2500 ms + 300 ms (§5) y un toque salta? | Sí. |
| Q9 | ¿Dispositivo de la medición de fps (R48)? | Emulador `kh_pixel7` (`D:/Android/avd`) + escritorio; si el emulador no entrega ≥ 50 fps por falta de GPU, se declara y se mide también en `low`. |
| Q10 | ¿Los efectos de pantalla (shake/zoom) respetan una preferencia de movimiento reducido? | Sí: `prefers-reduced-motion` → sin shake ni zoom; los beats siguen. |
| Q11 | ¿Se retira `assets/game/{dioramas,enemies,heroes}` del repo? | No en F7; solo se dejan de referenciar desde combate. Borrado en una feature aparte tras auditar `HeroPanel` y `WaveDefensePanel`. |
| Q12 | `[Gate de status]` La tarea de spec pidió dejar `in_progress`; `docs/specs.md` reserva `in_progress` para después del gate humano. | Se dejó `in_progress` por pedido explícito de la tarea; si el owner prefiere el proceso estricto, volver a `spec_ready`. |

### Respuestas del owner (2026-10-31, "apruebo todo")
Todas según la recomendación de la tabla: Q1 Phaser.Game aparte + `loop.sleep()` del hub · Q2 `engineVersion` sigue en 1; el paso a 2 va después de F7, en commit propio · Q3 S0 en Etapa A, S1 en Etapa B (≈27 llamadas, ≈3,5 USD), S2 no · Q4 lista y mapeo de §11 · Q5 oleadas fuera de F7 · Q6 ícono de clase del kit · Q7 calidad solo en `localStorage` · Q8 2500+300 ms, un toque salta · Q9 emulador `kh_pixel7` + escritorio · Q10 `prefers-reduced-motion` sin shake/zoom · Q11 no se borra `assets/game/` en F7 · Q12 queda `in_progress`.
