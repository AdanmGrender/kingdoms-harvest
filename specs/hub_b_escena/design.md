# Design — `hub_b_escena` (feature 3, B1.1)

> Cómo se construye. Requirements en `requirements.md` (R1–R38). Contrato visual: `docs/art-direction-b.md` §1, §2,
> §3/B1, §7. Capas y reglas: `docs/architecture.md`. Evidencia: `docs/conventions.md` §Verificación.

## 0. Alcance

**Entra:** escena Phaser nueva para el hub con arte B por capas, un sprite por `building_id` en ranuras fijas,
trabajadores animados en los 7 productores, humo, cielo/ambiente por tormenta, paridad de tap/construcción con el hub
actual, placeholders ante assets faltantes, evidencia visual y fps.

**No entra (otras features / decisiones explícitas):**

| Fuera de alcance | Dónde va / por qué |
|---|---|
| Objetos de recolección en la escena | feature 4 `hub_b_recoleccion` |
| 3 sprites por tramo de nivel | feature 5 `hub_b_tramos_nivel` (esta feature usa 1 sprite por id; el nombre de archivo deja lugar a `_t2`/`_t3`) |
| Reporte del Escribano | feature 6 `reporte_escribano` |
| Ciclo día/noche **visual** en el hub B | no está en el `acceptance`; se mantiene solo el **evento** `time:updated` (R28) para no romper `TopResourceBar` |
| Intensidad del Fuego Votivo según salud del Bastión | no está en el `acceptance`; el fuego titila con intensidad fija |
| NPCs, animales y aldeanos paseando (y sus taps a `dialog`/`animal`/`villager`) del diorama viejo | ver §11 *Pregunta para el owner*; siguen accesibles con `?hub=legacy` (R2) y en `?preview=world` |
| HiDPI real del canvas | ver §11 *Riesgos*; cambiar la resolución de `Phaser.Game` afecta a todas las escenas |
| Cambios de server, `shared/`, API o economía | prohibido (R36) |

## 1. Estado actual (verificado en el código)

- `client/src/components/hub/BastionHub.jsx`: columna `fixed inset-0 flex flex-col` con `QuestRail` (`pt-20`), un
  `div.flex-1.relative` que monta `<PhaserGame hubMode />` y la botonera inferior (`pb-28`). El contenedor
  `#phaser-container` de `PhaserGame` es `absolute 100%` **dentro del `flex-1`**, pero `handleResize` redimensiona el
  juego a `window.innerWidth × innerHeight` → el canvas no coincide con el viewport (R5 lo corrige).
- `client/src/game/PhaserGame.jsx`: crea `Phaser.Game` con `gameConfig` (`client/src/game/config.js`:
  `Phaser.AUTO`, `pixelArt: true`, `Scale.RESIZE`, escenas `[BootScene, WorldScene, IsoScene, IsoWorldScene]`) y
  publica en el registry `store`, `eventBridge`, `isoMode`, `hubMode`. En DEV expone `window.__phaserGame`.
- `client/src/game/scenes/BootScene.js`: `preload()` carga todo el arte legacy (Kenney, NPCs, `bld_<id>` PNG,
  `zone_hub`, `hub_bastion`); `create()` elige destino: `isoMode` → `IsoWorldScene`, `?iso=1` → `IsoScene`, si no
  `WorldScene`.
- `client/src/game/scenes/WorldScene.js` (771 líneas), rama `hubMode` (l. 80-157): genera el mapa procedural, y con
  `hub_bastion` cargado (`hubPainterly`, l. 117) **no** crea edificios ni parcelas (l. 118-120): solo NPCs, animales y
  aldeanos sobre el diorama `buildHubAnchor()` (l. 208-226). Cámara fija (`setupCamera`, l. 564-581).
  `setupSystems()` (l. 583-651) crea `SelectionSystem`, `BuildingPlacementSystem`, `DayNightSystem`,
  `ParticleSystem`, `AmbientSystem` y escucha `storm:started/ended`. `setupEventBridge()` (l. 653-681) escucha
  `overlay:*`, `building:startPlacement|cancelPlacement|confirmPlacement|addToScene`, `token:earned`.
- Tap de edificio hoy (camino que hay que conservar): `SelectionSystem.select()`
  (`client/src/game/systems/SelectionSystem.js`) emite `EventBridge.emit('entity:selected', { type, data })`;
  `OverlayManager` (`client/src/components/overlay/OverlayManager.jsx` l. 63-115) con `type === 'building'` hace
  `setOverlay('building', data)` → `BuildingInfoPanel` (l. 372+) que busca el registro por `data.buildingId` +
  `data.posX` y usa `data.level` / `data.isBuilding` como respaldo. `BuildingInfoPopup`
  (`client/src/components/hud/BuildingInfoPopup.jsx`) también escucha `entity:selected` (comportamiento actual, no
  se toca). Nota: `docs/project-spec.md` §9.2 documenta el payload como `{ entityType, data }`, pero el código usa
  `{ type, data }`; se corrige la doc (T15).
- Construcción hoy desde el hub: `QuickActionsSidebar` → `building:toolbar:toggle` → `BuildingToolbar` emite
  `building:startPlacement`; `BuildingPlacementSystem` emite `placement:started`/`placement:ended`; al confirmar,
  `WorldScene` emite `building:placed { buildingId, posX, posY }` y `App.jsx` (l. 116-128) llama
  `gameStore.buildNew(buildingId, posX, posY)` → `POST /api/buildings/build`. El server valida solapamiento AABB en
  grilla (`buildingService.validatePlacement`) y `posX/posY ∈ [0, 200]` (`buildingRoutes.js`).
- Estado del jugador: `client/src/store/gameStore.js` — `buildings` (de `/player/init` y `loadBuildings()` →
  `GET /api/buildings`), `activeStorm` (`loadActiveStorm()` → `GET /api/storms/active`, devuelve el catálogo de
  `WARP_STORMS` expandido con `id`, `color`, …; `socketService.js` hace `setActiveStorm` en `storm_started/ended`),
  `overlayState`. En DEV expone `window.__gameStore`. Zustand `^4.4.7` (`subscribe(listener(state, prev))`).
- Catálogos (`shared/gameConfig.js`, CommonJS): `BUILDINGS` con 17 ids — `farm_plot, barn, mill, sawmill, smithy,
  stable, house, mine, wall, tower, barracks, trap, tavern, market, embassy, throne_room, library`; con `produces`:
  `farm_plot, mill, sawmill, smithy, mine, tavern, market`. `WARP_STORMS`: `velo_estatico` (Niebla Sorda, `#7a5a8a`),
  `marea_carmesi` (Marea Carmesí, `#b32821`), `lluvia_de_energia` (Lluvia de Ascuas, `#4fd8c8`), `susurros_del_vacio`
  (Susurros de la Mácula, `#4a4550`), `calma_falsa` (Calma Falsa, `#d9a441`). El cliente **no** importa
  `shared/` en runtime (solo espejos comentados, p. ej. `BootScene` "Mirror de shared/gameConfig.js BUILDINGS").
- Referencia visual: `spikes/001-combat-b/main.js` — espacio lógico 824×1720, fondo *cover* con deriva lenta
  (l. 61-65), `pointlight` con parpadeo `Stepped` (l. 67-77), niebla con textura generada (l. 43-44, 79-83),
  respiración por tween de `scaleX/scaleY` (l. 97-98), brasas con `add.particles` y `blendMode: 'ADD'`
  (l. 108-112), viñeta + bloom con `cameras.main.postFX` (l. 123-126), normalización de pose por alto (`pose()`,
  l. 177-181), profundidad = y.
- Sistemas reutilizables: `DayNightSystem` (emite `time:updated`; crea un rectángulo overlay), `ParticleSystem`
  (`emitTokenGain(x, y, amount)`), `AmbientSystem.enabledInSettings()` (lee `localStorage.kh_ambient_fx`).

## 2. Decisión principal y alternativas descartadas

**Decisión:** escena Phaser **nueva** `HubSceneB` + módulo **puro** `client/src/game/hub/hubLayout.js`.
`BootScene` elige `HubSceneB` cuando `hubMode` está activo (salvo `?hub=legacy`). `WorldScene` queda **intacta**
como fallback.

| Alternativa | Por qué se descarta |
|---|---|
| Extender la rama `hubMode` de `WorldScene` | 771 líneas acopladas a mapa procedural, tiles Kenney, `ZoneStreamer`, `CameraSystem`, `SelectionSystem` por distancia y entidades pixel-art. Mezclar dos familias de arte en la misma escena es justo lo que `docs/art-direction-b.md` §0 identifica como causa del look amateur. Además rompería el fallback. |
| Una única ilustración pintada del Bastión con edificios incluidos (como `hub_bastion.png`) | No puede mostrar solo lo construido (A2) ni cambiar edificio por nivel (feature 5); taps por zonas de imagen son frágiles. |
| Hub en DOM/React con `<img>` posicionadas y CSS | Rompe la regla "Phaser = escenas" (`docs/architecture.md` §1); sin partículas/PointLight/postFX baratos; duplicaría el pipeline de animación del spike. |
| Importar `shared/gameConfig.js` desde el cliente en runtime | Es CommonJS fuera de la raíz de Vite; hoy el cliente no lo hace (usa espejos). Se mantiene el patrón espejo y un test Vitest garantiza la sincronía (lee `shared/` con `createRequire`). |
| Solares vacíos para ids no construidos | Suma 17 sprites/estados y ruido visual; el `acceptance` permite "no aparecen". La base pinta terrazas vacías genéricas, así que la ausencia no se ve como un hueco. **Elegido: no se dibuja nada** (R11). |
| Variantes de cielo pintadas por tormenta (5 imágenes) | Se usan 2 cielos (`sky_calm`, `sky_storm` neutro) + tinte + capas/partículas por tormenta: más barato y cada tormenta sigue siendo distinguible (R19). Si el owner quiere más carácter, se agregan cielos al manifiesto sin cambiar código (la tabla de ambientes nombra la textura). |

## 3. Archivos

| Archivo | Acción | Qué |
|---|---|---|
| `client/src/game/hub/hubLayout.js` | **crear** | Módulo puro (sin `phaser`, sin store): constantes y funciones de §4. |
| `client/src/game/scenes/HubSceneB.js` | **crear** | Escena Phaser del hub B (§6). |
| `client/src/tests/hubLayout.test.js` | **crear** | Vitest de todas las funciones puras y de la sincronía con `shared/`. |
| `client/src/game/config.js` | modificar | Agregar `HubSceneB` a `scene: [...]` (sin tocar el resto de la config). |
| `client/src/game/scenes/BootScene.js` | modificar | `create()` usa `resolveStartScene(...)` de `hubLayout.js`; el resto igual. |
| `client/src/components/hub/BastionHub.jsx` | modificar | Canvas a viewport completo detrás del chrome (§7). |
| `client/public/assets/b/hub/*.webp`, `b/buildings/*.webp`, `b/workers/*.webp` | **crear** | Arte generado (§8). |
| `art-b/hub/manifest.json`, `art-b/hub/process.sh`, `art-b/hub/refs/hub_base.webp` | **crear** | Pipeline de arte de la feature (§8). |
| `.gitignore` | modificar | `/art-b/hub/raw/` (crudos 2K no se versionan). |
| `scripts/contact_sheet_b.js` | **crear** (tooling) | Hoja de contacto oscura de un directorio de webp → `.webp` (Playwright, `goto(file://...)`). |
| `scripts/hub_b_evidence.js` | **crear** (tooling) | Corrida Playwright de evidencia: screenshots, consola, fps (§9). |
| `docs/project-spec.md` §9.2 | modificar | Payload real de `entity:selected` (`{ type, data }`) y `HubSceneB` como emisor de `entity:*`, `placement:*`, `building:placed`, `time:updated`. |

No se agregan dependencias (Phaser 3.90, Zustand, `sharp` y `playwright` ya están en los `package.json`).

## 4. Módulo puro `client/src/game/hub/hubLayout.js`

ESM, sin imports de `phaser` ni del store (testeable en Vitest/jsdom). Cabecera: "Espejo de `BUILDINGS` y
`WARP_STORMS` de `shared/gameConfig.js` — mantener en sync (lo verifica `hubLayout.test.js`)".

```js
export const HUB_W = 824;
export const HUB_H = 1720;
// Banda visible no tapada por el chrome en 412×860 (valores lógicos = css × 2). Se confirman midiendo el DOM (T9).
export const SAFE_TOP = 250;      // bajo TopResourceBar + QuestRail
export const SAFE_BOTTOM = 1390;  // sobre botonera de BastionHub + BottomNavBar
export const SAFE_LEFT = 110;     // a la derecha de QuickActionsSidebar (left-2, w-11)
export const SAFE_RIGHT = 714;    // a la izquierda de EventSidebar/SocialSidebar
export const HUB_DEPTHS = { sky: 0, skyFx: 5, base: 10, buildings: 100 /* + y */, fog: 1600, fg: 1700,
  particles: 1800, grade: 1950, flash: 1960 };

export const BUILDING_IDS = [/* los 17 ids, orden de BUILDINGS */];
export const TILE_SIZES = { farm_plot: [2, 2], /* … */ barracks: [3, 3], trap: [1, 1], market: [3, 2],
  embassy: [3, 3], throne_room: [4, 4] /* resto [2, 2] */ };        // espejo de tileWidth/tileHeight
export const HUB_SLOTS = { /* tabla §5.1: { x, y, w, h, smoke?: { dx, dy } } */ };
export const WORKER_BY_BUILDING = { /* tabla §5.2: building_id → { kind, dx, dy, h, periodMs } */ };
export const WORKER_KINDS = ['farmer', 'woodcutter', 'miner', 'merchant'];
export const STORM_AMBIENCE = { /* tabla §5.3 */ };
export const CALM_AMBIENCE = { /* fila "sin tormenta" */ };
export const HUB_TEXTURES = [ /* { key, url } de §8.3, la única lista que carga HubSceneB */ ];

export function resolveStartScene({ hubMode, isoMode, search }) {}  // → 'IsoWorldScene'|'IsoScene'|'HubSceneB'|'WorldScene'
export function computeHubViewport(width, height) {}               // → { zoom, scrollX, scrollY } (cover, uniforme)
export function pickRepresentative(records) {}                     // R12
export function selectHubBuildings(buildings) {}                   // → [{ buildingId, record, slot, state, worker|null }]
export function buildingVisualState(record) {}                     // → 'built' | 'construction'
export function stormAmbience(activeStorm) {}                      // → ambiente (§5.3); null → CALM_AMBIENCE
export function ambienceSignature(amb) {}                          // string estable para comparar ambientes (R19)
export function isTap(down, up) {}                                 // down/up: { x, y, t } — ≤ 500 ms y ≤ 12 px
export function shouldAcceptTap(overlayState) {}                   // false si hay overlay (R23)
export function buildSelectionPayload(record) {}                   // → { type: 'building', data: { buildingId, posX, level, isBuilding } }
export function findFreeTile(buildings, buildingId, opts = {}) {}  // → { posX, posY } | null
```

Reglas:

- `resolveStartScene`: mismo orden que hoy — `isoMode` → `IsoWorldScene`; `?iso=1` → `IsoScene`; luego
  `hubMode && hub !== 'legacy'` → `HubSceneB`; si no `WorldScene` (R1, R2).
- `computeHubViewport(w, h)`: `zoom = max(w / HUB_W, h / HUB_H)` (cover, escala uniforme); centra el rectángulo
  lógico: `scrollX/scrollY` tales que el centro de cámara = `(HUB_W/2, HUB_H/2)`. Para 412×860 → `zoom 0.5`, sin
  recorte (R4, R6). Si el viewport es más ancho que 824:1720 recorta arriba/abajo (cielo y primer plano, fuera de la
  banda segura); si es más angosto, recorta un poco los costados.
- `pickRepresentative(records)`: entre `!is_building`, mayor `level`, desempate menor `id`; si no hay construidos,
  el de menor `id` (R12).
- `selectHubBuildings(buildings)`: si no es array → `[]`; agrupa por `building_id`; descarta ids fuera de
  `HUB_SLOTS` (R31); un resultado por id con `state = buildingVisualState(rep)` y `worker` solo si
  `state === 'built'` y el id está en `WORKER_BY_BUILDING` (R10, R11, R13, R16).
- `stormAmbience(storm)`: `null/undefined` → `CALM_AMBIENCE`; id en tabla → esa fila; si no → ambiente genérico con
  `skyTint = parseHex(storm.color)` o `0x8a8478` si el color no es `#rrggbb` (R18, R19, R21).
- `findFreeTile(buildings, buildingId, { origin = { x: 78, y: 60 }, max = 200 })`: huella del catálogo
  (`TILE_SIZES`, default `[2, 2]` como el server); recorre en espiral desde `origin` (posición inicial de
  `throne_room` en `server/src/services/playerService.js`) y devuelve la primera celda `[0, max − w] × [0, max − h]`
  sin solapamiento AABB con ningún registro (misma fórmula que `buildingService.validatePlacement`); `null` si no hay
  lugar (R26). El server sigue siendo la autoridad: si rechaza, el error lo notifica `buildNew` como hoy.

## 5. Tablas de datos (contenido inicial de `hubLayout.js`)

### 5.1 Ranuras (`HUB_SLOTS`, espacio lógico 824×1720, ancla = centro-abajo del sprite)

El sprite se escala para entrar en la caja `w × h` (`scale = min(w/texW, h/texH)`), origen `(0.5, 1)`, profundidad
`HUB_DEPTHS.buildings + y`. Valores **iniciales**: el implementer los ajusta mirando las capturas; el contrato son
los invariantes de R9 (testeados), no los números.

| Fila | building_id | x | y | w | h | Extra |
|---|---|---|---|---|---|---|
| A (cima) | `library` | 175 | 700 | 220 | 240 | |
| A | `throne_room` | 412 | 720 | 300 | 460 | Fuego Votivo en `(0, −0.92h)` |
| A | `embassy` | 650 | 700 | 220 | 240 | |
| B | `tower` | 130 | 900 | 140 | 320 | |
| B | `barracks` | 300 | 905 | 200 | 220 | |
| B | `tavern` | 500 | 910 | 190 | 210 | `smoke: { dx: −40, dy: −190 }` |
| B | `market` | 690 | 915 | 210 | 200 | |
| C | `mill` | 135 | 1110 | 190 | 300 | |
| C | `house` | 300 | 1100 | 160 | 180 | |
| C | `barn` | 470 | 1115 | 200 | 210 | |
| C | `smithy` | 670 | 1120 | 210 | 210 | `smoke: { dx: 45, dy: −195 }` |
| D | `sawmill` | 130 | 1310 | 220 | 210 | |
| D | `farm_plot` | 330 | 1320 | 220 | 140 | |
| D | `stable` | 520 | 1310 | 200 | 190 | |
| D | `mine` | 690 | 1305 | 200 | 220 | |
| E (frente) | `wall` | 230 | 1385 | 280 | 120 | |
| E | `trap` | 560 | 1385 | 150 | 80 | |

Invariantes (R9, testeados): `x − w/2 ≥ 0`, `x + w/2 ≤ 824`, `y − h ≥ SAFE_TOP`, `y ≤ SAFE_BOTTOM`,
`SAFE_LEFT ≤ x ≤ SAFE_RIGHT`, distancia entre anclas ≥ 80.

### 5.2 Trabajadores (`WORKER_BY_BUILDING`)

`kind` reutiliza los ids de rol de `VILLAGER` en `shared/gameConfig.js` (`farmer`, `woodcutter`, `miner`,
`merchant`). Posición relativa al ancla de la ranura; alto en px lógicos; profundidad = la del edificio + 1.

| building_id | kind | dx | dy | h | periodMs (cambio de pose) |
|---|---|---|---|---|---|
| `farm_plot` | `farmer` | 80 | 0 | 125 | 900 |
| `mill` | `farmer` | 75 | 5 | 120 | 1100 |
| `sawmill` | `woodcutter` | 90 | 5 | 130 | 700 |
| `smithy` | `miner` | −100 | 5 | 130 | 650 |
| `mine` | `miner` | −95 | 5 | 130 | 750 |
| `tavern` | `merchant` | −85 | 8 | 120 | 1400 |
| `market` | `merchant` | −95 | 8 | 125 | 1600 |

Animación (técnica del spike): `setTexture(pose a|b)` + normalización por alto (`spike pose()`), alternando cada
`periodMs` con desfase aleatorio inicial; respiración continua `scaleY ×1.014 / scaleX ×0.996`, `Sine.easeInOut`,
1300-1700 ms. Si falta una pose, el trabajador queda solo con respiración; si faltan ambas, no se dibuja (el humo y el
edificio siguen).

### 5.3 Ambiente por tormenta (`STORM_AMBIENCE` + `CALM_AMBIENCE`)

Campos: `sky` (textura), `skyTint`, `grade` (`{ color, alpha }` rectángulo de pantalla completa en
`HUB_DEPTHS.grade`), `fog` (bancos de niebla en la banda media), `particles` (`none | embers_fall | motes_rise`),
`flash` (`null | { color, everyMs: [min, max] }`), `cloudDrift` (deriva lenta del cielo), `fireBoost` (multiplicador
de intensidad del Fuego Votivo).

| Estado | Nombre visible | sky | skyTint | grade | fog | particles | flash | cloudDrift |
|---|---|---|---|---|---|---|---|---|
| sin tormenta | — | `sky_calm` | — | — | no | `none` | — | sí |
| `velo_estatico` | Niebla Sorda | `sky_storm` | `0x9a8aa6` | `0x7a5a8a` / 0.18 | **sí** (5 bancos, α 0.55) | `none` | — | sí |
| `marea_carmesi` | Marea Carmesí | `sky_storm` | `0xc0453a` | `0xb32821` / 0.22 | no | `none` | `0xb32821` cada 5-9 s | sí |
| `lluvia_de_energia` | Lluvia de Ascuas | `sky_storm` | `0x8a7a6a` | `0xe8933a` / 0.10 | no | `embers_fall` (naranja `0xe8933a` + `0x4fd8c8`) | — | sí |
| `susurros_del_vacio` | Susurros de la Mácula | `sky_storm` | `0x7f9a5a` | `0x4a4550` / 0.25 | no | `motes_rise` (verde `0x9fd35a`) | — | sí |
| `calma_falsa` | Calma Falsa | `sky_calm` | `0xe0b860` | `0xd9a441` / 0.14 | no | `none` | — | **no** (aire quieto) |
| id desconocido | — | `sky_storm` | `storm.color` o `0x8a8478` | mismo color / 0.15 | no | `none` | — | sí |

`ambienceSignature` serializa `sky|skyTint|fog|particles|flash|cloudDrift`; el test exige 6 firmas distintas (calma +
5). Con `kh_ambient_fx` desactivado (R38) se omiten `fog`, `particles`, `flash` y postFX; quedan cielo, tinte y
`grade`, que siguen distinguiendo las 5 tormentas.

## 6. Escena `client/src/game/scenes/HubSceneB.js`

`export default class HubSceneB extends Phaser.Scene` con `key: 'HubSceneB'`. Importa `Phaser`, `useGameStore`
(como ya hace `WorldScene`), `EventBridge`, `DayNightSystem`, `ParticleSystem`, `AmbientSystem` y `hubLayout.js`.
No importa componentes React.

### 6.1 Ciclo de vida

- `preload()`: carga `HUB_TEXTURES` (§8.3). `this.load.on('loaderror', f => this.missing.add(f.key))` +
  `console.warn` (no `error`) con la clave. No toca la barra de carga de `BootScene`.
- `create()`:
  1. `makeTextures()` — texturas generadas como en el spike: `hubb_fog`, `hubb_spark`, `hubb_ember`, `hubb_mote`,
     `hubb_placeholder` (rectángulo roble `0x332f2b` con borde latón `0xd9a441`), `hubb_sky_fallback` (gradiente).
  2. Filtro lineal: para cada `key` de `HUB_TEXTURES` cargada,
     `this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR)` (R7; la config global `pixelArt: true` se
     mantiene por las escenas legacy).
  3. Capas fijas: cielo (`sky_calm` y `sky_storm` superpuestas, cross-fade por alpha), base (`origin (0.5, 1)` en
     `(412, 1720)`, ancho 824), primer plano (`origin (0.5, 1)`, depth `fg`). Deriva lenta del cielo como el spike.
  4. `this.applyViewport()` con `computeHubViewport(this.scale.width, this.scale.height)`:
     `cameras.main.setZoom(zoom).centerOn(HUB_W/2, HUB_H/2)`; `this.scale.on('resize', …)` lo repite (R6).
  5. `this.syncBuildings(state.buildings)` y `this.applyStorm(state.activeStorm, { instant: true })`.
  6. `this.unsub = useGameStore.subscribe((s, prev) => { … })`: si cambia `s.buildings` → `syncBuildings`; si cambia
     `s.activeStorm` → `applyStorm` (R14, R20). Cubre init, `loadBuildings`, socket y poll sin eventos nuevos.
  7. `this.dayNight = new DayNightSystem(this)`; su overlay se oculta (`this.dayNight.overlay.setVisible(false)`):
     solo interesa el evento `time:updated` (R28). `update(t, dt)` llama `this.dayNight.update(dt)`.
  8. `this.particles = new ParticleSystem(this)`; listener `token:earned` → `emitTokenGain` en el centro-arriba del
     viewport (R29).
  9. FX según `AmbientSystem.enabledInSettings()` (R38): si está activo, `cameras.main.postFX.addVignette(0.5, 0.48,
     0.92, 0.42)` (sin bloom, para cuidar fps), Fuego Votivo (`pointlight` `0xe8933a` con parpadeo `Stepped` + emisor de
     chispas chico) y emisores de ambiente.
  10. Input (§6.3) y listeners de placement (§6.4).
  11. `this.events.once('shutdown', this.teardown, this)` y `once('destroy', …)`: `this.unsub()`, `EventBridge.off`
      de **cada handler propio** (nunca `removeAllListeners`, que borraría los de React), destruir sistemas.
- Si `this.missing` contiene una textura, cada uso pasa por `this.tex(key, fallbackKey)`: devuelve `key` si existe y
  no está en `missing`, si no `fallbackKey` (`hubb_placeholder` para edificios, `hubb_sky_fallback` para cielos,
  `null` → no dibujar para base/fg/trabajadores). Ninguna ruta lanza (R30).

### 6.2 `syncBuildings(buildings)`

`const list = selectHubBuildings(buildings)`; mantiene `this.bldSprites: Map<buildingId, { sprite, worker, smoke,
record }>`: crea los nuevos, actualiza `record`/estado de los existentes, destruye los que ya no están. Estado
`construction` → `setTint(0x8a8478)` + `setAlpha(0.75)`, sin trabajador ni humo (R13). Construido → `clearTint()`,
trabajador (§5.2) y humo si la ranura tiene `smoke` (emisor `hubb_fog` chico, `alpha 0.5→0`, sube y deriva, R17).

### 6.3 Tap (R22-R24)

- Cada sprite de edificio: `setInteractive({ pixelPerfect: true, alphaTolerance: 8 })` → solo píxeles opacos;
  Phaser entrega el objeto más arriba (`topOnly`), así que la profundidad por `y` resuelve solapes.
- `pointerdown` en la escena guarda `{ x, y, t }`; `pointerup` arma `up` y, si `isTap(down, up)` y
  `shouldAcceptTap(useGameStore.getState().overlayState)`:
  - con objetivo edificio → breve "pop" (`scale ×1.04` yoyo 120 ms) y
    `EventBridge.emit('entity:selected', buildSelectionPayload(record))`;
  - sin objetivo → `EventBridge.emit('entity:deselected')` (como `SelectionSystem.deselect()`).
- Mismo evento y payload que hoy consume `OverlayManager` → `BuildingInfoPanel`: no se toca React (R22).

### 6.4 Construcción (R25-R27)

- `building:startPlacement { buildingId }` → si el id tiene ranura: fantasma = sprite del id (o placeholder) en su
  ranura, `alpha 0.5` con pulso; `this.placing = buildingId`; `EventBridge.emit('placement:started', { buildingId })`.
  Si el id ya está dibujado, el fantasma se dibuja igual sobre la ranura (la construcción de una instancia extra es
  válida en el server; visualmente se sigue mostrando un sprite por id, R12).
- `building:confirmPlacement` con `this.placing` → `pos = findFreeTile(state.buildings, id)`; si `pos`:
  `EventBridge.emit('building:placed', { buildingId: id, ...pos })` (lo atiende `App.jsx` → `buildNew`); si `null`:
  `EventBridge.emit('game:notification', { text: 'No queda lugar en el Bastión para esa obra', type: 'error' })`.
  En ambos casos quita el fantasma y emite `placement:ended`.
- `building:cancelPlacement` → quita el fantasma, `placement:ended`.
- `building:addToScene` (lo emite `App.jsx` tras construir) no hace falta: `buildNew` llama `loadBuildings()` y la
  suscripción al store redibuja. Se ignora a propósito.
- `camera:centerOnCastle` (botón de `QuickActionsSidebar`) es un no-op en el hub B (cámara fija), igual que en el hub
  actual con `CameraSystem` deshabilitado.

### 6.5 Tormenta (`applyStorm(storm, { instant })`, R18-R21)

`amb = stormAmbience(storm)`; si la firma no cambió, no hace nada. Si cambió: cross-fade de cielos y tinte
(`tweens` ≤ 1200 ms; `instant` → sin tween), `grade` (rectángulo que cubre el espacio lógico con margen; la cámara
es fija, no hace falta `scrollFactor`), activa/desactiva bancos de niebla, emisores (`embers_fall`: brasas cayendo en diagonal en todo el ancho;
`motes_rise`: motas verdes subiendo desde la banda media), `flash` (`time.addEvent` con intervalo aleatorio en
`everyMs`, rectángulo `ADD` α 0→0.35→0 en 220 ms) y `cloudDrift` (pausa/reanuda el tween del cielo). Los emisores se
crean una vez y se prenden/apagan (`emitting = false`) para no generar basura.

### 6.6 Presupuesto de rendimiento (R33)

Sin bloom; viñeta sola. Emisores: ambiente ≤ 1 activo (frecuencia ≥ 90 ms, ≤ 80 partículas vivas), humo ≤ 2
(≤ 12 vivas c/u), Fuego Votivo ≤ 15 vivas. Tweens: ≤ 17 respiraciones de trabajadores (7 máx.) + cielo + niebla.
Texturas webp ≤ 1080 px de ancho (base/cielos 1080×1920; edificios ≤ 512 px de alto; trabajadores 320 px de alto).
Si la medición da < 50 fps: primero bajar frecuencia de partículas, después la viñeta; documentarlo en tasks.
`pixelPerfect` solo se evalúa en taps (no por frame); reemplazarlo por hit-area rectangular cambiaría R22 y requiere
acuerdo del owner.

## 7. Integración

- `client/src/game/config.js`: `import HubSceneB from './scenes/HubSceneB';` y
  `scene: [BootScene, WorldScene, IsoScene, IsoWorldScene, HubSceneB]`. Nada más.
- `client/src/game/scenes/BootScene.js` `create()`: reemplazar el bloque de selección por
  `this.scene.start(resolveStartScene({ hubMode: !!this.game.registry.get('hubMode'), isoMode: !!isoModeFlag,
  search: window.location.search }))`. El `preload()` legacy no cambia (lo necesita el fallback; optimizarlo queda
  fuera).
- `client/src/components/hub/BastionHub.jsx`: raíz `fixed inset-0`; primer hijo `<div className="absolute inset-0">`
  con `<PhaserGame hubMode />` (canvas = viewport, R5); segundo hijo
  `<div className="absolute inset-0 flex flex-col pointer-events-none">` con el `QuestRail` (`pt-20`,
  `pointer-events-auto`), un `flex-1` vacío (deja pasar taps al canvas) y la botonera (`pointer-events-auto`). Se
  borran los comentarios "PRUEBA de arte"/"Escenario vivo" que ya no aplican. Sin cambios en los botones.

## 8. Arte

### 8.1 Pipeline

`node scripts/gen_art_b.js --manifest art-b/hub/manifest.json [--only …]` (preset `grimdark` por defecto, modelo
`gemini-3-pro-image` 2K; crudos en `art-b/hub/raw/<id>.png`, ignorados por git) →
`NODE="/c/Program Files/nodejs/node.exe" bash art-b/hub/process.sh` → `client/public/assets/b/…` →
`scripts/contact_sheet_b.js` → revisión a ojo (≈1 de cada 4 se regenera).

Orden en dos tandas: **tanda 1** = `hub_sky_calm`, `hub_sky_storm`, `hub_base`, `hub_fg`; se procesa `hub_base` y se
copia a `art-b/hub/refs/hub_base.webp`. **Tanda 2** = hojas de edificios (ref de estilo + `hub_base` para paleta y
escala) y de trabajadores.

Costo: 14 imágenes × ~0.13 USD ≈ **1.8 USD**; con ~30 % de regeneraciones ≈ **2.4 USD**.

### 8.2 `art-b/hub/manifest.json` (contenido exacto)

```json
[
  {
    "id": "hub_sky_calm", "kind": "scene", "aspect": "9:16",
    "refs": ["art-b/gr/refs/bg_combat.webp"],
    "prompt": "vertical portrait sky backdrop for a mobile game, ONLY sky: a brooding but calm late-afternoon sky over Renaissance German hill country, layered heavy clouds in sepia, bone and dull ochre with soft breaks of pale light, a few distant crows, the lower fifth fading into a flat hazy horizon mist, no land, no buildings, no ground"
  },
  {
    "id": "hub_sky_storm", "kind": "scene", "aspect": "9:16",
    "refs": ["art-b/gr/refs/bg_combat.webp"],
    "prompt": "vertical portrait sky backdrop for a mobile game, ONLY sky: a violent storm sky, towering churning dark storm clouds with ragged edges, distant sheets of rain, a faint glow behind the clouds, desaturated mostly neutral grey-sepia tones (it will be colour-tinted in the game), the lower fifth fading into a flat hazy horizon mist, no land, no buildings, no ground"
  },
  {
    "id": "hub_base", "kind": "scene", "aspect": "9:16",
    "refs": ["art-b/gr/refs/bg_combat.webp"],
    "prompt": "vertical portrait mobile game background of a fortified hill village seen from slightly above in three-quarter view: a muddy hill rising toward the top centre with a flattened rocky summit left EMPTY, ruined stone curtain walls and wooden palisades winding around the slopes, five broad flat EMPTY muddy terraces stepping down the hill toward the viewer (trampled earth, scattered stones, stakes, puddles, cart ruts, a winding dirt road connecting them), dead trees, a gallows and crows at the far edges; NO houses, NO buildings, NO people; everything above the hilltop and the walls (the whole sky area) is a perfectly flat uniform light grey (#d0d0d0) empty background with no clouds and no texture"
  },
  {
    "id": "hub_fg", "kind": "scene", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp"],
    "prompt": "wide foreground strip for the bottom edge of a mobile game screen, seen at ground level very close: a broken wooden fence with skulls on stakes, deep mud with wheel ruts and puddles, a crow perched on a post, tufts of dead grass and a discarded rusty morion helmet, filling only the lower half of the image; the entire upper half is a perfectly flat uniform light grey (#d0d0d0) empty background"
  },
  {
    "id": "bld_sheet_1", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "a sprite sheet with exactly THREE separate buildings of the same decaying Renaissance German walled village, side by side left to right with wide empty gaps between them, each standing on its own small patch of muddy ground, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) the lord's keep, a tall crooked stone castle keep with slate roofs, dried-blood crimson banners, wooden hoardings, arrow slits, and a big iron brazier on its tallest tower holding a large votive fire; (2) a narrow half-timbered scriptorium with tall leaded windows, stacks of books and scrolls chained at the door and a small bell turret; (3) an emissary's stone townhouse with a heavy carved door, sealed letters nailed to a board, a messenger's horn and a lantern, faded pennants"
  },
  {
    "id": "bld_sheet_2", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "a sprite sheet with exactly THREE separate buildings of the same decaying Renaissance German walled village, side by side left to right with wide empty gaps between them, each standing on its own small patch of muddy ground, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) a squat round stone cannon tower with a crude bronze cannon poking out, sandbags and a conical wooden roof; (2) a wide low segment of crumbling stone town wall with a small wooden gatehouse, a spiked portcullis and iron gibbet cages hanging; (3) a long timber barracks with racks of halberds and matchlock guns outside and a training dummy full of arrows"
  },
  {
    "id": "bld_sheet_3", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "a sprite sheet with exactly THREE separate buildings of the same decaying Renaissance German walled village, side by side left to right with wide empty gaps between them, each standing on its own small patch of muddy ground, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) a crooked half-timbered tavern with a chimney, barrels outside, a hanging tankard-shaped sign with no letters and warm candle-orange window light; (2) a shady black-market stall cluster with patched canvas awnings, crates, sacks, hanging hams and a chained strongbox; (3) a stone smithy with an open forge glowing orange, an anvil, a tall chimney, horseshoes and blades hung on the wall"
  },
  {
    "id": "bld_sheet_4", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "a sprite sheet with exactly THREE separate buildings of the same decaying Renaissance German walled village, side by side left to right with wide empty gaps between them, each standing on its own small patch of muddy ground, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) a tall wooden post windmill with ragged sails and flour sacks at its foot; (2) a small leaning half-timbered house with a patched thatched roof, a chimney and a laundry line; (3) a large wooden granary barn with a sagging roof and open doors showing grain sacks and hay"
  },
  {
    "id": "bld_sheet_5", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "a sprite sheet with exactly THREE separate buildings of the same decaying Renaissance German walled village, side by side left to right with wide empty gaps between them, each standing on its own small patch of muddy ground, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) a timber sawmill shed with a big circular saw blade, stacked logs, planks and sawdust; (2) a wooden stable with a small fenced paddock, hay bales and a horse trough; (3) a mine entrance dug into a rocky outcrop with timber supports, a lantern and a minecart on rails full of stone and iron ore"
  },
  {
    "id": "bld_sheet_6", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "a sprite sheet with exactly TWO separate objects of the same decaying Renaissance German walled village, side by side left to right with a wide empty gap between them, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) a small walled vegetable and wheat plot with crooked furrows, a scarecrow with a skull head and a tiny votive candle shrine at one corner; (2) a pit full of sharpened wooden stakes surrounded by a low rope fence and a crude skull warning post"
  },
  {
    "id": "wk_sheet_farmer", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/anchor.webp"],
    "prompt": "exactly TWO full-body figures of the SAME character side by side, LEFT pose A and RIGHT pose B, same scale, wide empty gap between them, no inset panels, no ground, three-quarter view facing right; a NEW character, not the reference: a gaunt peasant serf in a patched tunic and a straw hat with a ridiculous feather, bandaged hands, holding a long iron hoe; LEFT: hoe raised high over the shoulder; RIGHT: hoe struck down into the soil, body bent forward"
  },
  {
    "id": "wk_sheet_woodcutter", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/anchor.webp"],
    "prompt": "exactly TWO full-body figures of the SAME character side by side, LEFT pose A and RIGHT pose B, same scale, wide empty gap between them, no inset panels, no ground, three-quarter view facing right; a NEW character, not the reference: a burly woodcutter with an enormous moustache, leather apron and slashed sleeves, wielding a huge two-handed axe; LEFT: axe lifted behind the head; RIGHT: axe swung down chopping, body twisted"
  },
  {
    "id": "wk_sheet_miner", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/anchor.webp"],
    "prompt": "exactly TWO full-body figures of the SAME character side by side, LEFT pose A and RIGHT pose B, same scale, wide empty gap between them, no inset panels, no ground, three-quarter view facing right; a NEW character, not the reference: a stocky miner-smith with a soot-blackened face, an iron skullcap with a candle stuck on it, a leather apron and a heavy pick-hammer; LEFT: pick-hammer raised overhead; RIGHT: pick-hammer striking down with a few sparks"
  },
  {
    "id": "wk_sheet_merchant", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/anchor.webp"],
    "prompt": "exactly TWO full-body figures of the SAME character side by side, LEFT pose A and RIGHT pose B, same scale, wide empty gap between them, no inset panels, no ground, three-quarter view facing right; a NEW character, not the reference: a fat shifty merchant-innkeeper in slashed puffed sleeves and an absurd plumed hat, a coin purse on the belt; LEFT: holding up a jingling coin purse with a crooked grin; RIGHT: raising a foaming tankard and shouting"
  }
]
```

Si el ancla "contagia" su montante a los trabajadores, cambiar la ref a `art-b/gr/refs/mage_idle.webp` (skill
`kh-art-pipeline-b`). Si una hoja de edificios fusiona dos edificios o dibuja uno solo, regenerar ese edificio suelto
con `kind: "actor"` (ítem extra `bld_<id>` en el manifiesto) y documentarlo.

### 8.3 Salidas (`HUB_TEXTURES`) y `art-b/hub/process.sh`

| Clave de textura | Archivo | Origen | Proceso |
|---|---|---|---|
| `hubb_sky_calm` | `client/public/assets/b/hub/sky_calm.webp` | `hub_sky_calm` | `--scene --width 1080` |
| `hubb_sky_storm` | `client/public/assets/b/hub/sky_storm.webp` | `hub_sky_storm` | `--scene --width 1080` |
| `hubb_base` | `client/public/assets/b/hub/base.webp` | `hub_base` | recorte de fondo (sin `--scene`), `--width 1080`; ajustar `--tol` si la piedra gris abre falsos huecos |
| `hubb_fg` | `client/public/assets/b/hub/fg.webp` | `hub_fg` | recorte de fondo, `--width 1080` |
| `hubb_bld_<id>` (17) | `client/public/assets/b/buildings/<id>.webp` | `bld_sheet_1..6` | `--crop x,y,w,h` por componente conexo, `--height 512` (`throne_room` `--height 640`) |
| `hubb_wk_<kind>_a` / `_b` (8) | `client/public/assets/b/workers/<kind>_a.webp` / `_b.webp` | `wk_sheet_<kind>` | `--crop` en la columna vacía, `--height 320`, `--flip` si mira a la izquierda |

`process.sh` sigue el formato de `art-b/gr/process.sh` (`set -e`, `N="${NODE:-node}"`, `R=art-b/hub/raw`,
`O=client/public/assets/b`, función `p`). Las coordenadas de `--crop` se miden **después** de generar (componentes
conexos sobre píxeles no-fondo, como el kit de UI de `art-b/gr`) y se escriben como literales; además copia
`$O/hub/base.webp` a `art-b/hub/refs/hub_base.webp` al final de la tanda 1.

## 9. Evidencia (tooling)

- `scripts/contact_sheet_b.js --dir <carpeta> --out <webp> [--cols N]`: genera un `.html` temporal en
  `$TMPDIR`/scratch con las imágenes sobre `#1a1512`, lo abre con Playwright (`goto(file://…)`) y guarda la captura
  convertida a webp con `sharp`. Tres hojas: capas, edificios, trabajadores (R35).
- `scripts/hub_b_evidence.js`: Chromium `channel: 'chromium'`, `args: ['--use-angle=d3d11', '--enable-gpu']`,
  viewport 412×860, `deviceScaleFactor: 2`; `addInitScript` fija `localStorage.kh_device_id` (cuenta nueva por
  corrida) contra Vite dev (`http://localhost:5173`, que hace proxy a `:3001`); despacha el menú con
  `window.__gameStore.getState().enterGame()` y el reporte offline con `dismissOfflineReport()`; espera
  `window.__phaserGame.scene.isActive('HubSceneB')`. Pasos: screenshots de R1-R38 (lista en `tasks.md`), inyección
  de estado DEV (`__gameStore.setState({ buildings })`, `setActiveStorm(...)` con objetos copiados de `WARP_STORMS`),
  `EventBridge` vía `await import('/src/game/EventBridge.js')` (mismo singleton de Vite dev), consola
  (`console`/`pageerror`), fps (20 muestras de `loop.actualFps` + rAF). Guarda webp en `specs/hub_b_escena/evidencia/`
  y `fps.json`. La inyección de estado es **solo presentación** (no toca el server); el flujo real (cuenta nueva,
  tap, construir) también se registra.

## 10. Casos de error

| Caso | Manejo |
|---|---|
| Textura 404 / decodificación | `loaderror` → `missing`; placeholder o no dibujar (§6.1); `console.warn`, nunca `error` propio (R30) |
| `buildings` no-array / id desconocido / registro sin `building_id` | `selectHubBuildings` lo ignora (R31) |
| `activeStorm` con id desconocido o color inválido | ambiente genérico (R21) |
| WebGL no disponible (`postFX` indefinido) | se omite viñeta/PointLight (`if (cam.postFX)`, como el spike) |
| `findFreeTile` sin lugar | notificación en español, sin `building:placed` |
| Server rechaza la obra | lo notifica `buildNew` (`addNotification(error)`), igual que hoy |
| Cambio de escena / desmontaje de `BastionHub` | `teardown` desuscribe store y quita **solo** sus handlers de `EventBridge` |

## 11. Riesgos y preguntas para el owner

- **Pregunta (owner):** el hub actual permite tocar NPCs (`dialog`), animales (`animal`) y aldeanos (`villager`) que
  pasean sobre el diorama. El hub B de esta feature no los incluye (no están en el `acceptance` y mezclarían arte
  pixel con B). Quedan accesibles con `?hub=legacy`. Si son imprescindibles en el hub por defecto, hace falta una
  feature aparte (p. ej. "habitantes B del hub") antes de borrar el fallback.
- **Riesgo resolución:** el juego usa `Scale.RESIZE` a px CSS, así que en DPR 2 el canvas renderiza a 412×860 y se
  reescala (el spike renderizaba a 824×1720). La escena se ve correcta pero menos nítida que el spike. Arreglarlo
  toca `PhaserGame`/`config.js` para todas las escenas → seguimiento aparte.
- **Riesgo recorte de `hub_base`:** el flood-fill del cielo gris puede comer piedra clara → bajar `--tol` o rembg
  (skill `kh-art-pipeline-b`); plan B: generar la base con cielo pintado y usar `sky_*` solo como overlay con
  degradado (documentarlo si se usa).
- **Riesgo hojas multi-edificio:** el prefijo de `gen_art_b.js` dice "Draw exactly ONE subject" cuando hay refs; las
  hojas de pose de héroes funcionaron igual, pero si falla se generan edificios sueltos (§8.2).
- **Valores `SAFE_*`:** estimados desde las clases Tailwind del chrome; se confirman midiendo el DOM en T9 y se ajusta
  la tabla de ranuras si hace falta (el test cuida los invariantes).
