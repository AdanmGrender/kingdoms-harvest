# Design — `hub_b_escena` (feature 3, B1.1)

> Cómo se construye. Requirements en `requirements.md` (R1, R3–R52; R2 eliminado). Contrato visual:
> `docs/art-direction-b.md` §1, §2, §3/B1, §7. Capas y reglas: `docs/architecture.md`. Evidencia:
> `docs/conventions.md` §Verificación.
>
> **Revisión 2 (owner, 2026-10-20):** nitidez a resolución de dispositivo entra al alcance (§2.2), el hub viejo se
> elimina sin fallback (§2.3, §7.2) y el arte copia explícitamente la estética del spike de combate (§8).

## 0. Alcance

**Entra:** escena Phaser nueva para el hub con arte B por capas, un sprite por `building_id` en ranuras fijas,
trabajadores animados en los 7 productores, humo, cielo/ambiente por tormenta, paridad de tap/construcción con el hub
actual, placeholders ante assets faltantes; **render a resolución de dispositivo** (canvas × DPR, texto y sprites
nítidos, arte dimensionado para DPR 2-3); **retiro completo del hub viejo** (rama `hubMode` de `WorldScene`,
plomería y assets huérfanos); evidencia visual, nitidez y fps.

**No entra (otras features / decisiones explícitas):**

| Fuera de alcance | Dónde va / por qué |
|---|---|
| Objetos de recolección en la escena | feature 4 `hub_b_recoleccion` |
| 3 sprites por tramo de nivel | feature 5 `hub_b_tramos_nivel` (esta feature usa 1 sprite por id; el nombre de archivo deja lugar a `_t2`/`_t3`) |
| Reporte del Escribano | feature 6 `reporte_escribano` |
| Ciclo día/noche **visual** en el hub B | no está en el `acceptance`; se mantiene solo el **evento** `time:updated` (R28) para no romper `TopResourceBar` |
| Intensidad del Fuego Votivo según salud del Bastión | no está en el `acceptance`; el fuego titila con intensidad fija |
| NPCs, animales y aldeanos paseando (y sus taps a `dialog`/`animal`/`villager`) | **se eliminan del hub** junto con el hub viejo (owner, 2026-10-20). Futuro: "habitantes del hub B" (§11) |
| Resolución de dispositivo en las entradas de preview (`?preview=world`, `?iso=1`) | sus escenas asumen px CSS (drag de cámara, zoom 1.0, barra de carga); quedan como hoy (R46) |
| Borrar `WorldScene`/`IsoScene`/`IsoWorldScene` | siguen vivas en las entradas de preview (§2.3); su limpieza es otra feature (§11) |
| Tipografía IM Fell en el texto "+N KH" | kit de fuentes = fase B3; el texto conserva `MedievalSharp` |
| Cambios de server, `shared/`, API o economía | prohibido (R36) |

## 1. Estado actual (verificado en el código)

### 1.1 Montaje y render

- `client/src/components/hub/BastionHub.jsx`: columna `fixed inset-0 flex flex-col` con `QuestRail` (`pt-20`), un
  `div.flex-1.relative` que monta `<PhaserGame hubMode />` y la botonera inferior (`pb-28`). El contenedor
  `#phaser-container` de `PhaserGame` es `absolute 100%` **dentro del `flex-1`**, pero `handleResize` redimensiona el
  juego a `window.innerWidth × innerHeight` → el canvas no coincide con el viewport (R5 lo corrige).
- `client/src/game/PhaserGame.jsx`: crea **un** `Phaser.Game` con `gameConfig` y publica en el registry `store`,
  `eventBridge`, `isoMode`, `hubMode`. En DEV expone `window.__phaserGame`. El listener anónimo de
  `orientationchange` nunca se quita (fuga menor que se corrige de paso).
- `client/src/game/config.js`: `Phaser.AUTO`, `pixelArt: true`, `antialias: false`, `roundPixels: true`,
  `scale: { mode: Scale.RESIZE, width/height '100%' }`, escenas `[BootScene, WorldScene, IsoScene, IsoWorldScene]`.
  **Consecuencia (causa de la falta de nitidez):** en `Scale.RESIZE` Phaser 3.90 fija `canvas.width/height` al tamaño
  del padre en px CSS (`ScaleManager.updateScale`, rama RESIZE: `this.canvas.width = styleWidth`) e ignora `zoom`; en
  un teléfono DPR 2 el búfer es 412×860 y el navegador lo amplía ×2. Además `pixelArt: true` fuerza filtro NEAREST.
- Phaser 3.90 (`client/node_modules/phaser`): la opción `resolution` del Game Config **no existe** (se quitó en
  3.60; `core/Config.js` no la lee). Sí existen: `scale.zoom` (escala CSS del canvas, `ScaleManager.resize` pone
  `style.width = width × zoom` y `canvas.width = width`), el modo `Scale.NONE`, la conversión de puntero
  `transformX = (pageX − left) × displayScale.x` con `displayScale = baseSize / canvasBounds`, y
  `TextStyle.resolution` (default 0 → 1) / `Text.setResolution`. Ojo: `render.pixelArt` por defecto vale
  `zoom !== 1` (`Config.js` l. 401) → con zoom ≠ 1 hay que poner `pixelArt: false` explícito. El filtro LINEAR de
  WebGL requiere `antialias: true` (`WebGLRenderer.createTextureFromSource`, l. 2178). Los mipmaps solo se generan
  para texturas potencia de dos y con `render.mipmapFilter` global (l. 2181-2187).

### 1.2 El hub viejo (lo que se elimina)

- `client/src/game/scenes/BootScene.js`: `preload()` carga todo el arte legacy (tilesets, NPCs, animales, efectos,
  `bld_<id>`, anclas `zone_*`), incluidos `zone_hub` (l. 153) y `hub_bastion` (l. 156); `create()` hace chroma-key,
  crea animaciones y elige `IsoWorldScene` / `IsoScene` (`?iso=1`) / `WorldScene`.
- `client/src/game/scenes/WorldScene.js` (771 líneas), rama `hubMode`: l. 75-82 (`this.hubMode`,
  `this.hubZonesBuilt`), l. 97-106 (sin `ZoneStreamer` en hub), l. 113-121 (`hubPainterly`: no crea edificios ni
  parcelas), l. 124-136 (`buildHubZones()` + `buildHubAnchor()`), l. 143-157 (re-centrado en resize), métodos
  `buildHubZones()` (l. 160-198) y `buildHubAnchor()` (l. 200-226), `setupCamera()` rama hub (l. 568-575, zoom 1.1
  fijo y `CameraSystem` deshabilitado).
- `client/src/game/entities/NPC.js` l. 55 y 72, `client/src/game/entities/Villager.js` l. 54, 82 y 88: condicionan
  glow y etiquetas a `scene.hubMode`.
- Assets solo del hub viejo: `client/public/assets/game/dioramas/hub_bastion.png` (1024², 1.43 MB) y
  `client/public/assets/game/zones/zone_hub.png` (1.46 MB). `git grep` de `hub_bastion|zone_hub` fuera de `specs/`
  solo encuentra BootScene, WorldScene, `scripts/gen_zones.sh` (l. 42-47, genera `zone_hub`) y
  `docs/project-spec.md` (l. 758, 768).
- **No** son del hub: `battle_ruins.png`, `battle_tide.png`, `boss_arena.png` en la misma carpeta los usa
  `client/src/components/campaign/CombatInstancePanel.jsx` (l. 7, 120) como fondo CSS → se conservan (R49).
- `WorldScene` **sigue viva** fuera del hub: `App.jsx` (l. 31-33, 194-201) monta `<PhaserGame />` sin hub en la rama
  `ISO_PREVIEW` (`?preview=world` → `WorldScene`, `?iso=1` → `IsoScene`); `ISO_MODE` (`config.js`) habilita
  `IsoWorldScene`. `scripts/screenshot-game.js` también la usa.

### 1.3 Contratos que el hub B conserva

- Tap de edificio: `SelectionSystem.select()` emite `EventBridge.emit('entity:selected', { type, data })`;
  `OverlayManager` (`client/src/components/overlay/OverlayManager.jsx` l. 63-115) con `type === 'building'` hace
  `setOverlay('building', data)` → `BuildingInfoPanel` (l. 372+) que busca el registro por `data.buildingId` +
  `data.posX` y usa `data.level` / `data.isBuilding` como respaldo. `BuildingInfoPopup`
  (`client/src/components/hud/BuildingInfoPopup.jsx`) también escucha `entity:selected` (no se toca; no se posiciona
  con coordenadas de escena). `docs/project-spec.md` §9.2 documenta `{ entityType, data }` pero el código usa
  `{ type, data }`; se corrige la doc.
- Construcción: `QuickActionsSidebar` → `building:toolbar:toggle` → `BuildingToolbar` emite
  `building:startPlacement`; `BuildingPlacementSystem` emite `placement:started`/`placement:ended`; al confirmar se
  emite `building:placed { buildingId, posX, posY }` y `App.jsx` (l. 116-128) llama
  `gameStore.buildNew(buildingId, posX, posY)` → `POST /api/buildings/build`. El server valida solapamiento AABB
  (`buildingService.validatePlacement`) y `posX/posY ∈ [0, 200]` (`buildingRoutes.js`).
- Estado: `client/src/store/gameStore.js` — `buildings`, `activeStorm` (`loadActiveStorm()`, `setActiveStorm` desde
  `socketService.js`), `overlayState`; en DEV `window.__gameStore`. Zustand `^4.4.7` (`subscribe(listener(s, prev))`).
- Catálogos (`shared/gameConfig.js`, CommonJS): `BUILDINGS` con 17 ids — `farm_plot, barn, mill, sawmill, smithy,
  stable, house, mine, wall, tower, barracks, trap, tavern, market, embassy, throne_room, library`; con `produces`:
  `farm_plot, mill, sawmill, smithy, mine, tavern, market`. `WARP_STORMS`: `velo_estatico` (Niebla Sorda, `#7a5a8a`),
  `marea_carmesi` (Marea Carmesí, `#b32821`), `lluvia_de_energia` (Lluvia de Ascuas, `#4fd8c8`),
  `susurros_del_vacio` (Susurros de la Mácula, `#4a4550`), `calma_falsa` (Calma Falsa, `#d9a441`). El cliente **no**
  importa `shared/` en runtime (usa espejos comentados).
- Sistemas reutilizables: `DayNightSystem` (emite `time:updated`; crea un rectángulo overlay con `scrollFactor 0`),
  `ParticleSystem.emitTokenGain(x, y, amount)` (`Text` de 14 px a resolución 1, depth 25 — pensado para cámara zoom
  1), `AmbientSystem.enabledInSettings()` (lee `localStorage.kh_ambient_fx`).
- Referencia visual: `spikes/001-combat-b/main.js` — `Scale.FIT` a 824×1720 fijo (l. 385), fondo *cover* con deriva
  (`scale × 1.04`, tween a `× 1.025`, l. 61-65), `pointlight` con parpadeo `Stepped`, niebla generada, respiración por
  tween de `scaleX/scaleY`, brasas `ADD`, viñeta + bloom en `cameras.main.postFX`, normalización de pose por alto.

## 2. Decisiones y alternativas descartadas

### 2.1 Escena

**Decisión:** escena Phaser **nueva** `HubSceneB` + módulos **puros** `client/src/game/display.js` (entrada y
resolución) y `client/src/game/hub/hubLayout.js` (layout, ambiente, taps). `HubSceneB` es **el** hub; no hay
fallback.

| Alternativa | Por qué se descarta |
|---|---|
| Extender la rama `hubMode` de `WorldScene` | 771 líneas acopladas a mapa procedural, tiles Kenney, `ZoneStreamer`, `CameraSystem`, `SelectionSystem` por distancia y entidades pixel-art. Mezclar dos familias de arte en la misma escena es justo lo que `docs/art-direction-b.md` §0 identifica como causa del look amateur. |
| Una única ilustración pintada del Bastión con edificios incluidos (como `hub_bastion.png`) | No puede mostrar solo lo construido (A2) ni cambiar edificio por nivel (feature 5); taps por zonas de imagen son frágiles. |
| Hub en DOM/React con `<img>` posicionadas y CSS | Rompe la regla "Phaser = escenas" (`docs/architecture.md` §1); sin partículas/PointLight/postFX baratos; duplicaría el pipeline de animación del spike. |
| Importar `shared/gameConfig.js` desde el cliente en runtime | Es CommonJS fuera de la raíz de Vite; hoy el cliente no lo hace (usa espejos). Se mantiene el patrón espejo y un test Vitest garantiza la sincronía (lee `shared/` con `createRequire`). |
| Solares vacíos para ids no construidos | Suma 17 sprites/estados y ruido visual; el `acceptance` permite "no aparecen". La base pinta terrazas vacías genéricas. **Elegido: no se dibuja nada** (R11). |
| Variantes de cielo pintadas por tormenta (5 imágenes) | Se usan 2 cielos (`sky_calm`, `sky_storm` neutro) + tinte + capas/partículas por tormenta: más barato y cada tormenta sigue siendo distinguible (R19). Si el owner quiere más carácter, se agregan cielos al manifiesto sin cambiar código. |

### 2.2 Nitidez: canvas a resolución de dispositivo

**Decisión:** en la **entrada hub**, `Scale.NONE` con tamaño de juego = tamaño CSS × `s` y `scale.zoom = 1 / s`
(`s = min(max(devicePixelRatio, 1), 3)`), `pixelArt: false`, `antialias: true`, `roundPixels: false`.

Cómo funciona en Phaser 3.90 (ver §1.1): `ScaleManager.resize(W·s, H·s)` deja `canvas.width/height = W·s × H·s`
(R39) y `style.width/height = W × H` px CSS (R5); el navegador ya no reescala. El input sigue siendo correcto sin
código extra: `displayScale = baseSize / canvasBounds = s`, así que `pointer.x/y` llegan en px de dispositivo y
`camera.getWorldPoint` / el hit-test `pixelPerfect` trabajan en coordenadas de mundo como siempre (R41). El layout
lógico no cambia: `computeHubViewport(scale.width, scale.height)` recibe px de dispositivo y da zoom de cámara 1 a
s = 2 (el espacio lógico 824×1720 se dibuja 1:1, como el spike) y 1.5 a s = 3 (R4, R40).

| Alternativa | Por qué se descarta |
|---|---|
| Mantener `Scale.RESIZE` y agrandar `canvas.width` a mano + zoom de cámara `s` | `updateScale` (rama RESIZE) reescribe `canvas.width = parentSize` en cada refresh y `displayScale` queda en 1 → pelea con el ScaleManager, input desalineado y parpadeos en cada resize. |
| `Scale.FIT` a 824×1720 fijo, como el spike | Bandas en relaciones de aspecto distintas de 0.479 (R4), sigue ampliando ×1.5 en DPR 3 y el canvas deja de coincidir con el viewport sobre el que flota el chrome React (R5). |
| Opción `resolution` del Game Config | No existe desde Phaser 3.60 (no la lee `core/Config.js` 3.90). |
| `image-rendering` / `zoom` CSS sobre el canvas | No agrega píxeles: solo cambia cómo se amplía un búfer chico. |
| Aplicar `s` a todas las entradas | `WorldScene`/`IsoScene`/`BootScene` asumen px CSS (drag de `CameraSystem`, zoom 1.0, barra de carga): se verían a la mitad de tamaño. Se limita a la entrada hub; preview queda igual (R46). |
| Tope `s ≤ 2` | Desperdicia la pantalla de los teléfonos DPR 3 (nitidez visible en texto y trazos de grabado). Se mantiene 3 y se reserva el tope 2 como palanca de rendimiento con acuerdo del owner (§6.6). |

**Texto:** Phaser `Text` rasteriza en su propio canvas a `style.resolution` (default 1) × `fontSize`, en px de
mundo; con cámara zoom 1.5 se ampliaría. El hub crea su texto con `resolution = textResolutionFor(cam.zoom) =
max(1, zoom)` (R44) y `fontSize = 14 × HUB_W / 412 = 28` px lógicos → 14 px CSS en pantalla para cualquier `s` (R29).

**Mipmaps: no.** WebGL1 de Phaser 3.90 solo los genera para texturas potencia de dos, la opción es global
(`render.mipmapFilter`) y suma ~33 % de VRAM. En su lugar el arte se procesa a la altura justa para que en pantalla la
relación fuente/destino quede en `[0.97, 2.25]` entre DPR 3 y DPR 2 (R42, R43; §8.4): sin ampliación y con reducción
bilineal ≤ 2.25×, que no produce aliasing visible.

### 2.3 Retiro del hub viejo (sin fallback)

**Decisión:** se borra la rama `hubMode` y toda su plomería; la entrada se identifica con `entry: 'hub' | 'preview'`
(prop de `PhaserGame`, clave de registry `entry`) en lugar de `hubMode`, para que el grep de R47 quede vacío y el
nombre describa lo que es (qué entrada monta el juego). `WorldScene` **se conserva** sin la rama hub porque la usa
`?preview=world` (y `scripts/screenshot-game.js`); borrarla junto con `IsoScene`, `IsoWorldScene`, entidades y
sistemas legacy es una limpieza grande y de riesgo propio → feature aparte (§11).

| Alternativa | Por qué se descarta |
|---|---|
| Conservar `?hub=legacy` como red de seguridad | El owner lo descarta explícitamente; además obligaba a cargar todo el arte legacy en cada arranque del hub y a mantener dos hubs. |
| Dejar `hubMode` como nombre del flag | Ambiguo tras el retiro (no hay "modo"); impide verificar con grep que no quedó código del hub viejo. |
| Borrar `WorldScene` ya | Rompe `?preview=world` y `scripts/screenshot-game.js`; fuera del pedido. |

## 3. Archivos

| Archivo | Acción | Qué |
|---|---|---|
| `client/src/game/display.js` | **crear** | Módulo puro: escala de render, tamaño de búfer, ajustes por entrada, escena inicial, resolución de texto (§4.1). |
| `client/src/game/hub/hubLayout.js` | **crear** | Módulo puro del hub: constantes y funciones de §4.2. |
| `client/src/game/scenes/HubSceneB.js` | **crear** | Escena Phaser del hub B (§6). |
| `client/src/tests/display.test.js` | **crear** | Vitest de `display.js`. |
| `client/src/tests/hubLayout.test.js` | **crear** | Vitest de `hubLayout.js` y de la sincronía con `shared/`. |
| `client/src/game/config.js` | modificar | `buildGameConfig(settings)` (§7.1); se quita el `default export` estático (único consumidor: `PhaserGame`). |
| `client/src/game/PhaserGame.jsx` | modificar | Prop `entry`, config por entrada, resize con `s`, registry `entry`/`renderScale`, limpieza de listeners (§7.1). |
| `client/src/game/scenes/BootScene.js` | modificar | Entrada hub: sin preload legacy, despacha a `HubSceneB`; quita `zone_hub`/`hub_bastion`; usa `resolveStartScene` (§7.1). |
| `client/src/game/systems/ParticleSystem.js` | modificar | `emitTokenGain(x, y, amount, opts = {})` con `fontSize`, `resolution`, `depth` opcionales (defaults = valores actuales). |
| `client/src/components/hub/BastionHub.jsx` | modificar | Canvas a viewport completo detrás del chrome; `<PhaserGame entry="hub" />` (§7.1). |
| `client/src/game/scenes/WorldScene.js` | modificar | Quitar la rama `hubMode` completa (§7.2). |
| `client/src/game/entities/NPC.js`, `client/src/game/entities/Villager.js` | modificar | Quitar condiciones `scene.hubMode` (comportamiento = el actual fuera del hub). |
| `client/public/assets/game/dioramas/hub_bastion.png`, `client/public/assets/game/zones/zone_hub.png` | **borrar** | Assets huérfanos del hub viejo (R48). |
| `scripts/gen_zones.sh` | modificar (tooling) | Quitar el bloque `zone_hub` (l. 42-47). |
| `client/public/assets/b/hub/*.webp`, `b/buildings/*.webp`, `b/workers/*.webp` | **crear** | Arte generado (§8). |
| `art-b/hub/manifest.json`, `art-b/hub/process.sh`, `art-b/hub/refs/hub_base.webp` | **crear** | Pipeline de arte de la feature (§8). |
| `.gitignore` | modificar | `/art-b/hub/raw/` (crudos 2K no se versionan). |
| `scripts/process_art_b.js` | modificar (tooling, solo si hace falta) | Flag `--quality N` (default 88, sin cambio de comportamiento) si un webp supera 900 KB (R34). |
| `scripts/contact_sheet_b.js` | **crear** (tooling) | Hoja de contacto oscura de una lista/directorio de webp → `.webp` (Playwright, `goto(file://...)`). |
| `scripts/hub_b_evidence.js` | **crear** (tooling) | Corrida Playwright de evidencia: screenshots, consola, DPR 2/3, taps, texturas, nitidez, fps (§9). |
| `docs/project-spec.md` §9.2, l. 758, l. 768 | modificar | Payload `{ type, data }` de `entity:selected`; `HubSceneB` como emisor; reemplazar la descripción del hub viejo (`registry.hubMode`, `buildHubAnchor`, `zone_hub`) por el hub B. |
| `docs/architecture.md` §9, `docs/art-direction-b.md` §5 | modificar | "fondos ≤ 1080 px" → "fondos ≤ 1080 px; capas del hub hasta 1536 px (render a DPR 3, ver `specs/hub_b_escena/design.md` §8.4)". |

No se agregan dependencias (Phaser 3.90, Zustand, `sharp` y `playwright` ya están en los `package.json`).

## 4. Módulos puros

### 4.1 `client/src/game/display.js`

ESM, sin `phaser` ni store. Cabecera: "Resolución de render y escena inicial por entrada del juego (hub/preview)".

```js
export const MAX_RENDER_SCALE = 3;
export const TAP_SLOP_CSS = 12;                                        // px CSS (R22)
export function computeRenderScale(dpr) {}                             // finito ? min(max(dpr, 1), MAX) : 1 (R39)
export function computeBackingSize(cssW, cssH, s) {}                   // → { width: round(cssW·s), height: round(cssH·s), zoom: 1/s }
export function buildDisplaySettings({ entry, cssWidth, cssHeight, dpr }) {}
// hub     → { entry, mode: 'NONE', renderScale: s, width, height, zoom, pixelArt: false, antialias: true,
//             roundPixels: false, scenes: ['BootScene', 'HubSceneB'] }
// preview → { entry, mode: 'RESIZE', renderScale: 1, width: '100%', height: '100%', zoom: 1, pixelArt: true,
//             antialias: false, roundPixels: true, scenes: ['BootScene', 'WorldScene', 'IsoScene', 'IsoWorldScene'] }
export function resolveStartScene({ entry, isoMode, search }) {}      // 'hub' → 'HubSceneB'; isoMode → 'IsoWorldScene';
                                                                       // ?iso=1 → 'IsoScene'; si no → 'WorldScene'
export function textResolutionFor(zoom) {}                             // max(1, zoom) (R44)
```

`entry` desconocido se trata como `'preview'` (comportamiento actual). `cssWidth/cssHeight` ≤ 0 → se usa 1 (nunca
canvas de 0 px).

### 4.2 `client/src/game/hub/hubLayout.js`

ESM, sin imports de `phaser` ni del store. Cabecera: "Espejo de `BUILDINGS` y `WARP_STORMS` de
`shared/gameConfig.js` — mantener en sync (lo verifica `hubLayout.test.js`)".

```js
export const HUB_W = 824;
export const HUB_H = 1720;
// Banda visible no tapada por el chrome en 412×860 (valores lógicos = css × 2). Se confirman midiendo el DOM (T11).
export const SAFE_TOP = 250;      // bajo TopResourceBar + QuestRail
export const SAFE_BOTTOM = 1390;  // sobre botonera de BastionHub + BottomNavBar
export const SAFE_LEFT = 110;     // a la derecha de QuickActionsSidebar (left-2, w-11)
export const SAFE_RIGHT = 714;    // a la izquierda de EventSidebar/SocialSidebar
export const HUB_DEPTHS = { sky: 0, skyFx: 5, base: 10, buildings: 100 /* + y */, fog: 1600, fg: 1700,
  particles: 1800, grade: 1950, flash: 1960 };
export const TOKEN_FONT_PX = 28;  // 14 px CSS × (HUB_W / 412) (R29)

export const BUILDING_IDS = [/* los 17 ids, orden de BUILDINGS */];
export const TILE_SIZES = { farm_plot: [2, 2], /* … */ barracks: [3, 3], trap: [1, 1], market: [3, 2],
  embassy: [3, 3], throne_room: [4, 4] /* resto [2, 2] */ };        // espejo de tileWidth/tileHeight
export const HUB_SLOTS = { /* tabla §5.1: { x, y, w, h, smoke?: { dx, dy } } */ };
export const WORKER_BY_BUILDING = { /* tabla §5.2: building_id → { kind, dx, dy, h, periodMs } */ };
export const WORKER_KINDS = ['farmer', 'woodcutter', 'miner', 'merchant'];
export const STORM_AMBIENCE = { /* tabla §5.3 */ };
export const CALM_AMBIENCE = { /* fila "sin tormenta" */ };
export const HUB_TEXTURES = [ /* { key, url } de §8.3, la única lista que carga HubSceneB */ ];

export function computeHubViewport(width, height) {}               // px de dispositivo → { zoom, scrollX, scrollY } (cover)
export function pickRepresentative(records) {}                     // R12
export function selectHubBuildings(buildings) {}                   // → [{ buildingId, record, slot, state, worker|null }]
export function buildingVisualState(record) {}                     // → 'built' | 'construction'
export function stormAmbience(activeStorm) {}                      // → ambiente (§5.3); null → CALM_AMBIENCE
export function ambienceSignature(amb) {}                          // string estable para comparar ambientes (R19)
export function isTap(down, up, slop = 12) {}                      // down/up: { x, y, t } — ≤ 500 ms y ≤ slop px
export function shouldAcceptTap(overlayState) {}                   // false si hay overlay (R23)
export function buildSelectionPayload(record) {}                   // → { type: 'building', data: { buildingId, posX, level, isBuilding } }
export function findFreeTile(buildings, buildingId, opts = {}) {}  // → { posX, posY } | null
```

Reglas:

- `computeHubViewport(w, h)` (w, h en px de dispositivo = `this.scale.width/height`): `zoom = max(w / HUB_W, h /
  HUB_H)` (cover, escala uniforme); centra el rectángulo lógico (centro de cámara = `(HUB_W/2, HUB_H/2)`). 824×1720
  → 1; 1236×2580 → 1.5; 412×860 → 0.5 (R4, R6). Si el viewport es más ancho que 824:1720 recorta arriba/abajo (cielo
  y primer plano, fuera de la banda segura); si es más angosto, recorta un poco los costados.
- `isTap`: duración ≤ 500 ms y distancia ≤ `slop`; `HubSceneB` pasa `TAP_SLOP_CSS × renderScale` porque
  `pointer.x/y` vienen en px de dispositivo (R22).
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
los invariantes de R9 (testeados), no los números. La columna `--height` es la altura de proceso del webp
(`ceil16(1.5 × h)`, §8.4); si cambia `h` o el sprite queda limitado por ancho, se recalcula con la altura mostrada
real para cumplir R42/R43.

| Fila | building_id | x | y | w | h | `--height` | Extra |
|---|---|---|---|---|---|---|---|
| A (cima) | `library` | 175 | 700 | 220 | 240 | 368 | |
| A | `throne_room` | 412 | 720 | 300 | 460 | 704 | Fuego Votivo en `(0, −0.92h)` |
| A | `embassy` | 650 | 700 | 220 | 240 | 368 | |
| B | `tower` | 130 | 900 | 140 | 320 | 480 | |
| B | `barracks` | 300 | 905 | 200 | 220 | 336 | |
| B | `tavern` | 500 | 910 | 190 | 210 | 320 | `smoke: { dx: −40, dy: −190 }` |
| B | `market` | 690 | 915 | 210 | 200 | 304 | |
| C | `mill` | 135 | 1110 | 190 | 300 | 464 | |
| C | `house` | 300 | 1100 | 160 | 180 | 272 | |
| C | `barn` | 470 | 1115 | 200 | 210 | 320 | región de nitidez R45 |
| C | `smithy` | 670 | 1120 | 210 | 210 | 320 | `smoke: { dx: 45, dy: −195 }` |
| D | `sawmill` | 130 | 1310 | 220 | 210 | 320 | |
| D | `farm_plot` | 330 | 1320 | 220 | 140 | 224 | |
| D | `stable` | 520 | 1310 | 200 | 190 | 288 | |
| D | `mine` | 690 | 1305 | 200 | 220 | 336 | |
| E (frente) | `wall` | 230 | 1385 | 280 | 120 | 192 | |
| E | `trap` | 560 | 1385 | 150 | 80 | 128 | |

Invariantes (R9, testeados): `x − w/2 ≥ 0`, `x + w/2 ≤ 824`, `y − h ≥ SAFE_TOP`, `y ≤ SAFE_BOTTOM`,
`SAFE_LEFT ≤ x ≤ SAFE_RIGHT`, distancia entre anclas ≥ 80.

### 5.2 Trabajadores (`WORKER_BY_BUILDING`)

`kind` reutiliza los ids de rol de `VILLAGER` en `shared/gameConfig.js` (`farmer`, `woodcutter`, `miner`,
`merchant`). Posición relativa al ancla de la ranura; alto en px lógicos; profundidad = la del edificio + 1. Webp a
`--height 208` (= `ceil16(1.5 × 130)`; a DPR 2 reduce 1.6-1.7×, a DPR 3 queda en 1.07-1.16×, sin ampliar; §8.4).

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
(como ya hace `WorldScene`), `EventBridge`, `DayNightSystem`, `ParticleSystem`, `AmbientSystem`, `display.js` y
`hubLayout.js`. No importa componentes React.

### 6.1 Ciclo de vida

- `init()`: `this.renderScale = this.registry.get('renderScale') || 1`.
- `preload()`: carga `HUB_TEXTURES` (§8.3). `this.load.on('loaderror', f => this.missing.add(f.key))` +
  `console.warn` (no `error`) con la clave.
- `create()`:
  1. `makeTextures()` — texturas generadas como en el spike: `hubb_fog`, `hubb_spark`, `hubb_ember`, `hubb_mote`,
     `hubb_placeholder` (rectángulo roble `0x332f2b` con borde latón `0xd9a441`), `hubb_sky_fallback` (gradiente).
     Son difusas por naturaleza; quedan fuera de R42/R43.
  2. Filtro lineal: la config de la entrada hub ya crea todo en LINEAR (`pixelArt: false`, `antialias: true`); además,
     por robustez, `this.textures.get(key).setFilter(Phaser.Textures.FilterMode.LINEAR)` para cada `HUB_TEXTURES`
     cargada (R7).
  3. Capas fijas: cielo (`sky_calm` y `sky_storm` superpuestas, cross-fade por alpha, *cover* `× 1.04` con deriva a
     `× 1.025` como el spike), base (`origin (0.5, 1)` en `(412, 1720)`, ancho 824), primer plano (`origin (0.5, 1)`,
     depth `fg`).
  4. `this.applyViewport()` con `computeHubViewport(this.scale.width, this.scale.height)`:
     `cameras.main.setZoom(zoom).centerOn(HUB_W/2, HUB_H/2)`; `this.scale.on('resize', …)` lo repite (R6).
  5. `this.syncBuildings(state.buildings)` y `this.applyStorm(state.activeStorm, { instant: true })`.
  6. `this.unsub = useGameStore.subscribe((s, prev) => { … })`: si cambia `s.buildings` → `syncBuildings`; si cambia
     `s.activeStorm` → `applyStorm` (R14, R20).
  7. `this.dayNight = new DayNightSystem(this)`; su overlay se oculta (`this.dayNight.overlay.setVisible(false)`;
     su `resizeOverlay` en px de pantalla no importa oculto): solo interesa `time:updated` (R28). `update(t, dt)`
     llama `this.dayNight.update(dt)`.
  8. `this.particles = new ParticleSystem(this)`; listener `token:earned` →
     `this.particles.emitTokenGain(HUB_W / 2, view.y + view.height / 3, amount, { fontSize: TOKEN_FONT_PX,
     resolution: textResolutionFor(cam.zoom), depth: HUB_DEPTHS.particles })` con `view = cam.worldView` (R29, R44).
  9. FX según `AmbientSystem.enabledInSettings()` (R38): si está activo, `cameras.main.postFX.addVignette(0.5, 0.48,
     0.92, 0.42)` (sin bloom), Fuego Votivo (`pointlight` `0xe8933a` con parpadeo `Stepped` + emisor de chispas
     chico) y emisores de ambiente. `PointLight` y postFX son de shader: independientes de la resolución.
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

### 6.3 Tap (R22-R24, R41)

- Cada sprite de edificio: `setInteractive({ pixelPerfect: true, alphaTolerance: 8 })` → solo píxeles opacos;
  Phaser entrega el objeto más arriba (`topOnly`), así que la profundidad por `y` resuelve solapes. El hit-test usa
  coordenadas de mundo, iguales para cualquier `s` (§2.2).
- `pointerdown` en la escena guarda `{ x: pointer.x, y: pointer.y, t }` (px de dispositivo); `pointerup` arma `up` y,
  si `isTap(down, up, TAP_SLOP_CSS * this.renderScale)` y `shouldAcceptTap(useGameStore.getState().overlayState)`:
  - con objetivo edificio → breve "pop" (`scale ×1.04` yoyo 120 ms) y
    `EventBridge.emit('entity:selected', buildSelectionPayload(record))`;
  - sin objetivo → `EventBridge.emit('entity:deselected')` (como `SelectionSystem.deselect()`).
- Mismo evento y payload que hoy consume `OverlayManager` → `BuildingInfoPanel`: no se toca React (R22). Ningún
  componente React se posiciona con coordenadas de escena (verificado: `BuildingInfoPopup` y `OverlayManager` no
  reciben x/y), así que el cambio de px CSS a px de dispositivo no afecta al DOM.

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
- `camera:centerOnCastle` (botón de `QuickActionsSidebar`) es un no-op en el hub B (cámara fija).

### 6.5 Tormenta (`applyStorm(storm, { instant })`, R18-R21)

`amb = stormAmbience(storm)`; si la firma no cambió, no hace nada. Si cambió: cross-fade de cielos y tinte
(`tweens` ≤ 1200 ms; `instant` → sin tween), `grade` (rectángulo que cubre el espacio lógico con margen; la cámara
es fija), activa/desactiva bancos de niebla, emisores (`embers_fall`: brasas cayendo en diagonal en todo el ancho;
`motes_rise`: motas verdes subiendo desde la banda media), `flash` (`time.addEvent` con intervalo aleatorio en
`everyMs`, rectángulo `ADD` α 0→0.35→0 en 220 ms) y `cloudDrift` (pausa/reanuda el tween del cielo). Los emisores se
crean una vez y se prenden/apagan (`emitting = false`) para no generar basura.

### 6.6 Presupuesto de rendimiento (R33)

A DPR 2 el búfer es 824×1720 (el mismo que renderizaba el spike); a DPR 3, 1236×2580 (2.25× de píxeles). Sin bloom;
viñeta sola. Emisores: ambiente ≤ 1 activo (frecuencia ≥ 90 ms, ≤ 80 partículas vivas), humo ≤ 2 (≤ 12 vivas c/u),
Fuego Votivo ≤ 15 vivas. Tweens: ≤ 7 respiraciones de trabajadores + cielo + niebla. Texturas según §8.4. Memoria de
GPU estimada ≈ 55 MB (2 cielos 1536×2752 ≈ 34 MB, base ≈ 9 MB, resto ≈ 12 MB) — menor que hoy, porque la entrada hub
deja de cargar todo el arte legacy (R50). Si la medición a DPR 2 da < 50 fps: primero bajar frecuencia de
partículas, después la viñeta; como último recurso `MAX_RENDER_SCALE = 2` (requiere acuerdo del owner porque cambia
R39/R42 a DPR 3); documentarlo en tasks. `pixelPerfect` solo se evalúa en taps (no por frame).

## 7. Integración

### 7.1 Entrada, config y montaje

- `client/src/game/config.js`: conserva `ISO_MODE` y la config base (input, physics, `backgroundColor`,
  `disableContextMenu`, audio). Nuevo `export function buildGameConfig(settings)` que mapea
  `buildDisplaySettings(...)` a Phaser: `scale: { mode: Phaser.Scale[settings.mode], autoCenter: hub ? NO_CENTER :
  CENTER_BOTH, width, height, zoom }`, `pixelArt`, `antialias`, `roundPixels` (top-level **y** `render`, porque
  `Config.js` lee `render` primero) y `scene` = clases de `settings.scenes` (`{ BootScene, WorldScene, IsoScene,
  IsoWorldScene, HubSceneB }`). Para `preview` el resultado es idéntico a la config actual (R46).
- `client/src/game/PhaserGame.jsx`: prop `entry = 'preview'`. Antes de crear el juego mide el contenedor
  (`#phaser-container` → `clientWidth/clientHeight`, con `window.inner*` de respaldo) y arma
  `settings = buildDisplaySettings({ entry, cssWidth, cssHeight, dpr: window.devicePixelRatio })`;
  `new Phaser.Game({ ...buildGameConfig(settings), parent: 'phaser-container' })`. Registry: `store`,
  `eventBridge`, `isoMode`, `entry`, `renderScale`. `handleResize`: en `hub` recalcula `s` y el búfer con
  `computeBackingSize`; si cambió `s`, `game.scale.setZoom(1 / s)` y `registry.set('renderScale', s)`; luego
  `game.scale.resize(width, height)` (R6, R39). En `preview`, igual que hoy (`resize(innerWidth, innerHeight)`). El
  handler de `orientationchange` pasa a ser una función con nombre y se quita en el cleanup junto con `resize`.
- `client/src/game/scenes/BootScene.js`: `preload()` empieza con `if (this.registry.get('entry') === 'hub') return;`
  (sin barra de carga ni arte legacy, R50); `create()` calcula
  `target = resolveStartScene({ entry: this.registry.get('entry'), isoMode: !!this.registry.get('isoMode'), search:
  window.location.search })` y, si es `HubSceneB`, hace `this.scene.start(target)` **antes** del chroma-key y de las
  animaciones legacy. Se borran las cargas `zone_hub` y `hub_bastion` (y sus comentarios).
- `client/src/game/systems/ParticleSystem.js`: `emitTokenGain(x, y, amount, { fontSize = 14, resolution = 1,
  depth = 25 } = {})` — defaults = comportamiento actual (WorldScene no cambia); aplica `setResolution(resolution)`.
- `client/src/components/hub/BastionHub.jsx`: raíz `fixed inset-0`; primer hijo `<div className="absolute inset-0">`
  con `<PhaserGame entry="hub" />` (canvas = viewport, R5); segundo hijo
  `<div className="absolute inset-0 flex flex-col pointer-events-none">` con el `QuestRail` (`pt-20`,
  `pointer-events-auto`), un `flex-1` vacío (deja pasar taps al canvas) y la botonera (`pointer-events-auto`). Se
  borran los comentarios "PRUEBA de arte"/"Escenario vivo". Sin cambios en los botones.

### 7.2 Retiro del hub viejo (inventario exacto, R47-R49)

| Dónde | Qué se quita / cambia |
|---|---|
| `WorldScene.js` l. 75-82 | comentario "Modo hub", `this.hubMode`, `this.hubZonesBuilt` |
| `WorldScene.js` l. 97-106 | el `ZoneStreamer` se crea siempre |
| `WorldScene.js` l. 113-121 | `hubPainterly`: `createBuildings()` y `createFarmPlots()` incondicionales |
| `WorldScene.js` l. 124-136 | queda solo `this.zoneStreamer.update(true)` |
| `WorldScene.js` l. 143-157 | el handler de resize queda en `this.cameras.main.setSize(...)` |
| `WorldScene.js` l. 160-226 | métodos `buildHubZones()` y `buildHubAnchor()` completos |
| `WorldScene.js` `setupCamera()` l. 568-575 | rama hub; queda zoom 1.0 + `centerOn(spawn)` |
| `NPC.js` l. 55, 72; `Villager.js` l. 54, 82, 88 | `scene.hubMode` → comportamiento actual de preview (glow siempre, etiquetas visibles) |
| `BootScene.js` l. 149-156 | cargas `zone_hub` y `hub_bastion` |
| `PhaserGame.jsx` | prop `hubMode` y `registry.set('hubMode', …)` → `entry` |
| `BastionHub.jsx` | `<PhaserGame hubMode />` → `<PhaserGame entry="hub" />` |
| `client/public/assets/game/dioramas/hub_bastion.png`, `client/public/assets/game/zones/zone_hub.png` | `git rm` (antes: `git grep` citado, R48) |
| `scripts/gen_zones.sh` l. 42-47 | bloque `zone_hub` |
| `docs/project-spec.md` l. 758, 768 | descripción del hub viejo → hub B |
| **Se conservan** | `battle_ruins.png`, `battle_tide.png`, `boss_arena.png` y `CombatInstancePanel.jsx` (R49); `WorldScene`, `IsoScene`, `IsoWorldScene` y el resto del arte legacy que usa `?preview=world` |

## 8. Arte

### 8.1 Pipeline

`node scripts/gen_art_b.js --manifest art-b/hub/manifest.json [--only …]` (preset `grimdark` por defecto — el mismo
del spike —, modelo `gemini-3-pro-image` 2K; crudos en `art-b/hub/raw/<id>.png`, ignorados por git) →
`NODE="/c/Program Files/nodejs/node.exe" bash art-b/hub/process.sh` → `client/public/assets/b/…` →
`scripts/contact_sheet_b.js` → revisión a ojo (≈1 de cada 4 se regenera).

Orden en dos tandas: **tanda 1** = `hub_sky_calm`, `hub_sky_storm`, `hub_base`, `hub_fg`; se procesa `hub_base` y se
copia a `art-b/hub/refs/hub_base.webp`; la tanda 1 se compara contra el spike (`contact_hub_vs_spike`, R52) **antes**
de seguir. **Tanda 2** = `bld_throne_room`, hojas de edificios (ref de estilo del spike + `hub_base` para paleta y
escala) y de trabajadores (ancla del spike).

Costo: 15 imágenes × ~0.13 USD ≈ **2.0 USD**; con ~30 % de regeneraciones ≈ **2.6 USD**.

### 8.2 `art-b/hub/manifest.json` (contenido exacto)

Todos los prompts empiezan con el mismo bloque **`STYLE MATCH`** (el preset `grimdark` ya describe la técnica; el
bloque ata explícitamente el hub al spike de combate, que el owner aprobó). No hay campo `style` (→ `grimdark`).

```json
[
  {
    "id": "hub_sky_calm", "kind": "scene", "aspect": "9:16",
    "refs": ["art-b/gr/refs/bg_combat.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — vertical portrait sky backdrop for a mobile game, ONLY sky: a brooding but calm late-afternoon sky over Renaissance German hill country, layered heavy clouds rendered with engraved hatching in sepia, bone and dull ochre with soft breaks of pale light, a few distant crows and one absurd crow flying off with a stolen plumed hat, the lower fifth fading into a flat hazy horizon mist, no land, no buildings, no ground"
  },
  {
    "id": "hub_sky_storm", "kind": "scene", "aspect": "9:16",
    "refs": ["art-b/gr/refs/bg_combat.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — vertical portrait sky backdrop for a mobile game, ONLY sky: a violent storm sky, towering churning dark storm clouds with ragged hatched edges, distant sheets of rain drawn as engraved strokes, a faint sickly glow behind the clouds, desaturated mostly neutral grey-sepia tones (it will be colour-tinted in the game), the lower fifth fading into a flat hazy horizon mist, no land, no buildings, no ground"
  },
  {
    "id": "hub_base", "kind": "scene", "aspect": "9:16",
    "refs": ["art-b/gr/refs/bg_combat.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — vertical portrait mobile game background of a fortified hill village seen from slightly above in three-quarter view: a muddy hill rising toward the top centre with a flattened rocky summit left EMPTY, ruined stone curtain walls and rotting wooden palisades winding around the slopes, five broad flat EMPTY muddy terraces stepping down the hill toward the viewer (trampled earth, scattered stones, stakes, puddles, cart ruts, a winding dirt road connecting them), dead trees, a gallows with a crow wearing a tiny dented helmet, crumbling shrine niches with guttering candles at the far edges; NO houses, NO buildings, NO people; everything above the hilltop and the walls (the whole sky area) is a perfectly flat uniform light grey (#d0d0d0) empty background with no clouds and no texture"
  },
  {
    "id": "hub_fg", "kind": "scene", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — wide foreground strip for the bottom edge of a mobile game screen, seen at ground level very close: a broken wooden fence with skulls on stakes (one skull wearing a ridiculous feathered cap), deep mud with wheel ruts and puddles, a crow perched on a post, tufts of dead grass and a discarded rusty morion helmet, filling only the lower half of the image; the entire upper half is a perfectly flat uniform light grey (#d0d0d0) empty background"
  },
  {
    "id": "bld_throne_room", "kind": "ui", "aspect": "3:4",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — ONE single building filling most of the image height, standing on its own small patch of muddy ground, three-quarter view from slightly above, no people, no animals, no text, no letters: the lord's keep, a tall crooked stone castle keep with oversized slate roofs, dried-blood crimson banners, wooden hoardings, arrow slits, a ridiculous gilded weathercock bent by the wind, and a big iron brazier on its tallest tower holding a large votive fire"
  },
  {
    "id": "bld_sheet_1", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — a sprite sheet with exactly TWO separate buildings of the same decaying Renaissance German walled village, side by side left to right with a wide empty gap between them, each standing on its own small patch of muddy ground, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) a narrow leaning half-timbered scriptorium with tall leaded windows, stacks of books and scrolls chained at the door, a small bell turret and a faint sickly green glow in one window; (2) an emissary's stone townhouse with a heavy carved door, sealed letters nailed to a board, a comically huge messenger's horn hanging by the door, a lantern and faded pennants"
  },
  {
    "id": "bld_sheet_2", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — a sprite sheet with exactly THREE separate buildings of the same decaying Renaissance German walled village, side by side left to right with wide empty gaps between them, each standing on its own small patch of muddy ground, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) a squat round stone cannon tower with an oversized crude bronze cannon poking out, sandbags and a conical wooden roof; (2) a wide low segment of crumbling stone town wall with a small wooden gatehouse, a spiked portcullis and iron gibbet cages hanging, one cage holding only a pair of boots; (3) a long timber barracks with racks of halberds and matchlock guns outside and a training dummy full of arrows"
  },
  {
    "id": "bld_sheet_3", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — a sprite sheet with exactly THREE separate buildings of the same decaying Renaissance German walled village, side by side left to right with wide empty gaps between them, each standing on its own small patch of muddy ground, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) a crooked half-timbered tavern with a chimney, barrels outside, a hanging tankard-shaped sign with no letters and warm candle-orange window light; (2) a shady black-market stall cluster with patched canvas awnings, crates, sacks, hanging hams and a chained strongbox; (3) a stone smithy with an open forge glowing orange, an anvil, a tall chimney, horseshoes and oversized blades hung on the wall"
  },
  {
    "id": "bld_sheet_4", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — a sprite sheet with exactly THREE separate buildings of the same decaying Renaissance German walled village, side by side left to right with wide empty gaps between them, each standing on its own small patch of muddy ground, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) a tall wooden post windmill with ragged patched sails and flour sacks at its foot; (2) a small leaning half-timbered house with a patched thatched roof, a chimney and a laundry line with absurd striped puffed breeches; (3) a large wooden granary barn with a sagging roof and open doors showing grain sacks and hay"
  },
  {
    "id": "bld_sheet_5", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — a sprite sheet with exactly THREE separate buildings of the same decaying Renaissance German walled village, side by side left to right with wide empty gaps between them, each standing on its own small patch of muddy ground, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) a timber sawmill shed with a big circular saw blade, stacked logs, planks and sawdust; (2) a wooden stable with a small fenced paddock, hay bales, a horse trough and a horseshoe nailed upside down; (3) a mine entrance dug into a rocky outcrop with timber supports, a lantern and a minecart on rails full of stone and iron ore"
  },
  {
    "id": "bld_sheet_6", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/bg_combat.webp", "art-b/hub/refs/hub_base.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — a sprite sheet with exactly TWO separate objects of the same decaying Renaissance German walled village, side by side left to right with a wide empty gap between them, three-quarter view from slightly above, consistent scale and lighting, no people, no animals, no text, no letters: (1) a small walled vegetable and wheat plot with crooked furrows, a scarecrow with a skull head and a ridiculous plumed hat, and a tiny votive candle shrine at one corner; (2) a pit full of sharpened wooden stakes surrounded by a low rope fence and a crude skull warning post"
  },
  {
    "id": "wk_sheet_farmer", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/anchor.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — exactly TWO full-body figures of the SAME character side by side, LEFT pose A and RIGHT pose B, same scale, wide empty gap between them, no inset panels, no ground, three-quarter view facing right; a NEW character, not the reference: a gaunt peasant serf with oversized hands and feet in a patched tunic and a straw hat with a ridiculous feather, bandaged hands, holding a long iron hoe; LEFT: hoe raised high over the shoulder; RIGHT: hoe struck down into the soil, body bent forward"
  },
  {
    "id": "wk_sheet_woodcutter", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/anchor.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — exactly TWO full-body figures of the SAME character side by side, LEFT pose A and RIGHT pose B, same scale, wide empty gap between them, no inset panels, no ground, three-quarter view facing right; a NEW character, not the reference: a burly woodcutter with an enormous moustache, leather apron and slashed puffed sleeves, wielding a huge two-handed axe; LEFT: axe lifted behind the head; RIGHT: axe swung down chopping, body twisted"
  },
  {
    "id": "wk_sheet_miner", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/anchor.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — exactly TWO full-body figures of the SAME character side by side, LEFT pose A and RIGHT pose B, same scale, wide empty gap between them, no inset panels, no ground, three-quarter view facing right; a NEW character, not the reference: a stocky miner-smith with a soot-blackened face, an iron skullcap with a candle stuck on it, a leather apron and an oversized heavy pick-hammer; LEFT: pick-hammer raised overhead; RIGHT: pick-hammer striking down with a few sparks"
  },
  {
    "id": "wk_sheet_merchant", "kind": "ui", "aspect": "16:9",
    "refs": ["art-b/gr/refs/anchor.webp"],
    "prompt": "STYLE MATCH: exactly the same look as the reference combat art of this game — hand-inked 16th-century woodcut and copperplate engraving, rough scratchy ink lines, dense cross-hatching, dark ink washes, earthy umber, sepia, ochre, rust and bone palette with rare sickly green glow and candle orange, heroic chunky exaggerated proportions, decaying half-timbered Renaissance German town, grotesque darkly humorous details. — exactly TWO full-body figures of the SAME character side by side, LEFT pose A and RIGHT pose B, same scale, wide empty gap between them, no inset panels, no ground, three-quarter view facing right; a NEW character, not the reference: a fat shifty merchant-innkeeper in slashed puffed sleeves and an absurd plumed hat, a coin purse on the belt; LEFT: holding up a jingling coin purse with a crooked grin; RIGHT: raising a foaming tankard and shouting"
  }
]
```

Si el ancla "contagia" su montante a los trabajadores, cambiar la ref a `art-b/gr/refs/mage_idle.webp` (skill
`kh-art-pipeline-b`). Si una hoja de edificios fusiona dos edificios o dibuja uno solo, regenerar ese edificio suelto
como `bld_<id>` (mismo bloque `STYLE MATCH`, `aspect: "3:4"`) y documentarlo.

### 8.3 Salidas (`HUB_TEXTURES`) y `art-b/hub/process.sh`

| Clave de textura | Archivo | Origen | Proceso |
|---|---|---|---|
| `hubb_sky_calm` | `client/public/assets/b/hub/sky_calm.webp` | `hub_sky_calm` | `--scene` sin resize (ancho nativo 1536) |
| `hubb_sky_storm` | `client/public/assets/b/hub/sky_storm.webp` | `hub_sky_storm` | `--scene` sin resize (1536) |
| `hubb_base` | `client/public/assets/b/hub/base.webp` | `hub_base` | recorte de fondo (sin `--scene`), `--width 1280`; ajustar `--tol` si la piedra gris abre falsos huecos |
| `hubb_fg` | `client/public/assets/b/hub/fg.webp` | `hub_fg` | recorte de fondo, `--width 1280` |
| `hubb_bld_throne_room` | `client/public/assets/b/buildings/throne_room.webp` | `bld_throne_room` | recorte de fondo, `--height 704` |
| `hubb_bld_<id>` (16) | `client/public/assets/b/buildings/<id>.webp` | `bld_sheet_1..6` | `--crop x,y,w,h` por componente conexo, `--height` de la tabla §5.1 |
| `hubb_wk_<kind>_a` / `_b` (8) | `client/public/assets/b/workers/<kind>_a.webp` / `_b.webp` | `wk_sheet_<kind>` | `--crop` en la columna vacía, `--height 208`, `--flip` si mira a la izquierda |

`process.sh` sigue el formato de `art-b/gr/process.sh` (`set -e`, `N="${NODE:-node}"`, `R=art-b/hub/raw`,
`O=client/public/assets/b`, función `p`). Las coordenadas de `--crop` se miden **después** de generar (componentes
conexos sobre píxeles no-fondo) y se escriben como literales; además copia `$O/hub/base.webp` a
`art-b/hub/refs/hub_base.webp` al final de la tanda 1. **Regla de no ampliación en proceso:** el `--height` (o
`--width`) de salida nunca supera el alto (ancho) del recorte de origen; si un edificio de hoja no llega, se regenera
suelto (§8.2).

### 8.4 Resolución y peso (R34, R42, R43)

- Escala en pantalla: px de dispositivo = px lógicos × zoom de cámara (1 a DPR 2, 1.5 a DPR 3). Para no ampliar a
  DPR 3 y no reducir más de 2.25× a DPR 2, cada textura se procesa a **1.5 × su tamaño lógico mostrado**
  (redondeado arriba a múltiplo de 16): a DPR 3 queda ≈ 1.0-1.05×, a DPR 2 ≈ 1.5×. `process_art_b.js` reduce por
  promedio de área premultiplicado (sin halos), así que la fuente 2K → destino conserva el trazo de grabado.
- Fondos: base y primer plano se muestran a 824 px lógicos de ancho → 1236 a DPR 3 → **1280**. Los cielos van en
  *cover* con deriva (≈ 1031 px lógicos de ancho) → ≈ 1546 a DPR 3 → **1536** = ancho nativo 2K de Gemini 9:16 (sin
  remuestreo; ratio 0.99, dentro del 0.97 de R42). Por eso el tope de R34 sube de 1080 a 1536.
- Peso estimado (webp q88 de `process_art_b.js`; referencia: `bg/combat_crypt.webp` 1080×1920 = 462 KB): cielos
  2 × ≈ 450 KB, base ≈ 650 KB, primer plano ≈ 150 KB, edificios 17 × ≈ 55 KB ≈ 950 KB, trabajadores 8 × ≈ 15 KB
  ≈ 120 KB → **≈ 2.8 MB** (presupuesto R34: ≤ 4.5 MB, ≤ 900 KB por archivo). Se borran `hub_bastion.png` (1.43 MB)
  y `zone_hub.png` (1.46 MB) → impacto neto en la APK ≈ **−0.1 MB**. Si un archivo pasa de 900 KB: `--quality 80`
  solo para ese archivo (flag nuevo y opcional de `process_art_b.js`, §3).

## 9. Evidencia (tooling)

- `scripts/contact_sheet_b.js --out <webp> [--cols N] <archivos o carpeta>…`: genera un `.html` en el scratch con
  las imágenes sobre `#1a1512`, lo abre con Playwright (`goto(file://…)`) y guarda la captura convertida a webp con
  `sharp`. Cuatro hojas: capas, edificios, trabajadores (R35) y `contact_hub_vs_spike` (R52: `base`, `throne_room`,
  `tavern`, `mill`, `wk farmer_a` junto a `b/bg/combat_crypt.webp` y `b/heroes/mage_idle.webp`).
- `scripts/hub_b_evidence.js [--dpr 2|3] [--sharpness] [--fps]`: Chromium `channel: 'chromium'`,
  `args: ['--use-angle=d3d11', '--enable-gpu']`, viewport 412×860, `deviceScaleFactor` 2 (default) o 3,
  `hasTouch: true`; `addInitScript` fija `localStorage.kh_device_id` (cuenta nueva por corrida) contra Vite dev
  (`http://localhost:5173`, proxy a `:3001`); despacha el menú con `window.__gameStore.getState().enterGame()` y el
  reporte offline con `dismissOfflineReport()`; espera `window.__phaserGame.scene.isActive('HubSceneB')`. Pasos:
  screenshots de la lista de `tasks.md`; tamaño de canvas y rect; inyección de estado DEV
  (`__gameStore.setState({ buildings })`, `setActiveStorm(...)` con objetos copiados de `WARP_STORMS`);
  `EventBridge` vía `await import('/src/game/EventBridge.js')`; tabla de texturas (R42/R43: recorre
  `scene.children.list` con `texture.key` de arte del hub); bounds en px CSS (R40); taps con
  `page.touchscreen.tap` (R41); lista de claves de textura (R50); consola (`console`/`pageerror`); fps (20 muestras
  de `loop.actualFps` + rAF). `--sharpness` (R45): dos corridas con `kh_ambient_fx = 'false'` — la línea base con
  `addInitScript(() => Object.defineProperty(window, 'devicePixelRatio', { get: () => 1 }))` — recorte de la caja de
  la ranura `barn` (`x 370..570, y 905..1115` en px de captura a DSF 2, recalculado desde `HUB_SLOTS`), laplaciano
  3×3 `[0,1,0,1,−4,1,0,1,0]` con `sharp().greyscale().convolve()` y `stats()` → desvío². Guarda webp en
  `specs/hub_b_escena/evidencia/` y `fps.json`/`fps_dpr3.json`. La inyección de estado es **solo presentación** (no
  toca el server); el flujo real (cuenta nueva, tap, construir) también se registra.

## 10. Casos de error

| Caso | Manejo |
|---|---|
| Textura 404 / decodificación | `loaderror` → `missing`; placeholder o no dibujar (§6.1); `console.warn`, nunca `error` propio (R30) |
| `buildings` no-array / id desconocido / registro sin `building_id` | `selectHubBuildings` lo ignora (R31) |
| `activeStorm` con id desconocido o color inválido | ambiente genérico (R21) |
| WebGL no disponible (`postFX` indefinido) | se omite viñeta/PointLight (`if (cam.postFX)`, como el spike); el canvas 2D respeta igual `Scale.NONE` + zoom |
| `devicePixelRatio` ausente, `NaN`, < 1 o > 3 | `computeRenderScale` lo lleva a `[1, 3]` (R39) |
| Contenedor medido en 0 px (montaje antes del layout) | `buildDisplaySettings` usa `window.inner*` de respaldo, nunca 0 |
| DPR cambia en caliente (zoom del navegador, mover de monitor) | `handleResize` recalcula `s`, `setZoom(1/s)`, `resize` y `registry.renderScale`; la escena re-aplica viewport |
| `findFreeTile` sin lugar | notificación en español, sin `building:placed` |
| Server rechaza la obra | lo notifica `buildNew` (`addNotification(error)`), igual que hoy |
| Cambio de escena / desmontaje de `BastionHub` | `teardown` desuscribe store y quita **solo** sus handlers de `EventBridge`; `PhaserGame` quita `resize` y `orientationchange` |

## 11. Riesgos y seguimiento

- **Seguimiento (no es parte de esta feature): "habitantes del hub B".** El hub viejo tenía NPCs (`dialog`),
  animales (`animal`) y aldeanos (`villager`) paseando y tocables; se eliminan con él (owner, 2026-10-20). Si se
  quieren de vuelta, una feature aparte con arte B (hojas de pose, rutas entre terrazas) y sus taps.
- **Seguimiento: limpieza de escenas legacy.** `WorldScene`, `IsoScene`, `IsoWorldScene`, `BootScene` legacy, sus
  entidades/sistemas y el arte `client/public/assets/game/*` quedan solo para `?preview=world` / `?iso=1`. Borrarlos
  (o portar el preview) es otra feature.
- **Riesgo rendimiento a DPR 3:** 2.25× de píxeles respecto de DPR 2; en headless puede quedar < 50 fps por GPU
  (R33 lo registra como informativo). Palancas en §6.6; el tope `MAX_RENDER_SCALE = 2` necesita acuerdo del owner.
- **Riesgo recorte de `hub_base`:** el flood-fill del cielo gris puede comer piedra clara → bajar `--tol` o rembg
  (skill `kh-art-pipeline-b`); plan B: generar la base con cielo pintado y usar `sky_*` solo como overlay con
  degradado (documentarlo si se usa).
- **Riesgo hojas multi-edificio:** el prefijo de `gen_art_b.js` dice "Draw exactly ONE subject" cuando hay refs y el
  sufijo `ui` pide "front orthographic view"; las hojas de pose de héroes funcionaron igual, pero si falla se generan
  edificios sueltos (§8.2).
- **Riesgo deriva de estilo:** el bloque `STYLE MATCH` + refs del spike lo acotan; la hoja comparativa de la tanda 1
  (R52) se revisa antes de gastar la tanda 2.
- **Valores `SAFE_*`:** estimados desde las clases Tailwind del chrome; se confirman midiendo el DOM y se ajusta la
  tabla de ranuras si hace falta (el test cuida los invariantes).
