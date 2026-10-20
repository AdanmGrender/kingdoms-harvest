# Tasks — `hub_b_escena` (feature 3, B1.1)

> Orden de ejecución. Cada task cubre `R<n>` de `requirements.md`; diseño en `design.md`. Al cerrar una task:
> `[x]` + `Evidencia:` inline (comando + salida citada, test, o ruta de screenshot con una línea de qué verifica).
> Screenshots y hojas de contacto en `specs/hub_b_escena/evidencia/` (webp). Branch: `feature/hub_b_escena`.
>
> **Revisión 2 (owner, 2026-10-20):** nitidez a resolución de dispositivo, retiro del hub viejo sin fallback y
> estética del spike explícita. R2 está eliminado: ninguna task lo cubre. Estado: `spec_ready`, esperando aprobación.

## Arte

- [x] T1 — Crear `art-b/hub/manifest.json` con el contenido exacto de `design.md` §8.2 (15 ítems, bloque
  `STYLE MATCH` en todos, sin campo `style`), `art-b/hub/process.sh` (formato de `art-b/gr/process.sh`, salidas y
  alturas de §8.3/§5.1) y agregar `/art-b/hub/raw/` a `.gitignore`. Cubre: R35, R52. Evidencia: manifiesto extraído
  literal del bloque ```json de `design.md` §8.2; `node -e` sobre `art-b/hub/manifest.json` → `items 15 style 0
  STYLE MATCH 15`; `bash -n art-b/hub/process.sh` → `syntax-ok` (acepta `1|2` para correr una tanda); `git
  check-ignore -v art-b/hub/raw/x.png` → `.gitignore:39:/art-b/hub/raw/`.
- [ ] T2 — Tanda 1: `node scripts/gen_art_b.js --manifest art-b/hub/manifest.json --only
  hub_sky_calm,hub_sky_storm,hub_base,hub_fg`; procesar a `client/public/assets/b/hub/{sky_calm,sky_storm}.webp`
  (1536, sin resize) y `{base,fg}.webp` (`--width 1280`); copiar `base.webp` a `art-b/hub/refs/hub_base.webp`.
  Hoja comparativa preliminar contra el spike (`combat_crypt.webp`) y revisión escrita **antes** de la tanda 2.
  Regenerar lo que no pase (citar ids regenerados). Cubre: R34, R35, R52.
- [ ] T3 — Tanda 2: generar `bld_throne_room`, `bld_sheet_1..6` y `wk_sheet_{farmer,woodcutter,miner,merchant}`;
  medir componentes conexos y escribir los `--crop` literales en `process.sh`; procesar a
  `client/public/assets/b/buildings/<id>.webp` (17, `--height` de la tabla §5.1; citar por id alto del recorte ≥
  `--height`, regla de no ampliación §8.3) y `client/public/assets/b/workers/<kind>_{a,b}.webp` (8, `--height 208`).
  Cubre: R34, R35, R42, R43.
- [ ] T4 — Crear `scripts/contact_sheet_b.js` y generar `evidencia/contact_hub_capas.webp`,
  `evidencia/contact_hub_edificios.webp`, `evidencia/contact_hub_trabajadores.webp` y
  `evidencia/contact_hub_vs_spike.webp`; escribir la revisión (sin figuras/cabezas extra, trabajadores mirando a la
  derecha, recorte limpio, sin texto ni iconografía ajena; trazo de grabado, paleta tierra + verde enfermizo,
  proporciones heroicas, humor negro como el spike). Chequeo con Node del manifiesto (sin `style` ≠ `grimdark`,
  `refs` permitidas, prefijo `STYLE MATCH`) citado. Cubre: R35, R52.
- [ ] T5 — Listar con `sharp` todos los webp nuevos (archivo, ancho, alto, KB) con el total; confirmar ancho ≤ 1536,
  ≤ 900 KB c/u y ≤ 4.5 MB en total (si alguno se pasa: `--quality 80` solo para ese archivo, `design.md` §8.4).
  Cubre: R34.

## Lógica pura

- [ ] T6 — Crear `client/src/game/display.js` (`design.md` §4.1) y `client/src/tests/display.test.js`:
  `computeRenderScale` (`0.5, 1, 2, 2.625, 3, 4, undefined, NaN`), `computeBackingSize` (412×860 @2 → 824×1720 zoom
  0.5; @3 → 1236×2580), `buildDisplaySettings` hub vs preview (preview idéntico a la config actual: `RESIZE`,
  `pixelArt: true`, 4 escenas legacy; hub: `NONE`, `pixelArt: false`, `antialias: true`, `['BootScene',
  'HubSceneB']`), `resolveStartScene` (hub, `isoMode`, `?iso=1`, preview por defecto, entry desconocido),
  `textResolutionFor` (`0.5, 1, 1.5`). Correr `cd client && npx vitest run src/tests/display.test.js`.
  Cubre: R1, R22, R39, R44, R46.
- [ ] T7 — Crear `client/src/game/hub/hubLayout.js` con constantes y funciones de `design.md` §4.2-§5 (sin importar
  `phaser` ni el store). Cubre: R3, R4, R6, R8, R9, R10, R11, R12, R13, R15, R17, R18, R19, R21, R22, R23, R24, R26,
  R29, R31.
- [ ] T8 — Crear `client/src/tests/hubLayout.test.js` (Vitest): `HUB_DEPTHS` creciente; `computeHubViewport` en
  824×1720 (zoom 1), 1236×2580 (1.5), 412×860 (0.5), 720×1560 y 1536×2048, sin bandas; `HUB_SLOTS` vs
  `Object.keys(BUILDINGS)` y `TILE_SIZES` vs `tileWidth/tileHeight` (leídos con `createRequire` de
  `shared/gameConfig.js`); invariantes de ranuras; `selectHubBuildings` (starter de `playerService`, vacío, no-array,
  id desconocido); `pickRepresentative`; `buildingVisualState`; `WORKER_BY_BUILDING` vs ids con `produces`; humo de
  `smithy`/`tavern`; `stormAmbience` (null, 5 ids de `WARP_STORMS`, desconocido con color válido e inválido) y 6
  firmas distintas; `isTap` (slop 12, 24, 36); `shouldAcceptTap`; `buildSelectionPayload`; `TOKEN_FONT_PX === 28`;
  `findFreeTile` (sin solapes con los 4 registros iniciales, huellas 1×1/3×3/4×4, tablero lleno → `null`). Correr
  `cd client && npx vitest run src/tests/hubLayout.test.js`. Cubre: R3, R4, R6, R8, R9, R10, R11, R12, R13, R15, R17,
  R18, R19, R21, R22, R23, R24, R26, R29, R31.

## Retiro del hub viejo

- [ ] T9 — Antes de tocar nada: screenshot informativo del hub viejo `evidencia/hub_viejo_antes.webp` (registro de
  lo que se reemplaza) y `git grep -n "hub_bastion\|zone_hub\|hubMode"` citado. Luego aplicar el inventario de
  `design.md` §7.2: rama `hubMode` de `WorldScene.js` (l. 75-82, 97-106, 113-121, 124-136, 143-157, métodos
  `buildHubZones`/`buildHubAnchor`, rama hub de `setupCamera`), condiciones `scene.hubMode` de `NPC.js` y
  `Villager.js`, cargas `zone_hub`/`hub_bastion` de `BootScene.js`, bloque `zone_hub` de `scripts/gen_zones.sh`,
  `git rm` de `client/public/assets/game/dioramas/hub_bastion.png` y `client/public/assets/game/zones/zone_hub.png`,
  y `docs/project-spec.md` l. 758/768 reescritas para el hub B. **No** tocar `battle_ruins/battle_tide/boss_arena` ni
  `CombatInstancePanel.jsx`. Cubre: R47, R48, R49.

## Escena e integración

- [ ] T10 — Entrada y resolución (`design.md` §7.1): `buildGameConfig(settings)` en `client/src/game/config.js`;
  `PhaserGame.jsx` con prop `entry`, medición del contenedor, registry `entry`/`renderScale`, `handleResize` con
  `setZoom(1/s)` + `resize(round(w·s), round(h·s))` y cleanup de `resize` y `orientationchange`; `BootScene` despacha
  a `HubSceneB` sin preload legacy en la entrada hub; `ParticleSystem.emitTokenGain(x, y, amount, opts)` con defaults
  actuales; `BastionHub.jsx` con canvas a viewport completo, capa de chrome `pointer-events-none` y
  `<PhaserGame entry="hub" />`. Cubre: R1, R5, R6, R7, R39, R46, R50.
- [ ] T11 — Crear `client/src/game/scenes/HubSceneB.js` (`design.md` §6.1-§6.3): `renderScale` del registry, preload
  de `HUB_TEXTURES` con registro de faltantes, texturas generadas, filtro lineal, capas, viewport + resize,
  `syncBuildings` con estado en obra, suscripción al store con cleanup, tap con `slop = 12 × s` →
  `entity:selected` / `entity:deselected`, `DayNightSystem` con overlay oculto, `token:earned` → `emitTokenGain` con
  `fontSize 28`, `resolution = textResolutionFor(zoom)` y depth de partículas, `teardown` que quita solo sus
  handlers. Cubre: R3, R4, R6, R7, R10, R11, R13, R14, R22, R23, R24, R28, R29, R30, R31, R41, R44.
- [ ] T12 — Medir con Playwright los rects reales de `TopResourceBar`, `QuestRail`, botonera, `BottomNavBar` y barras
  laterales; confirmar o ajustar `SAFE_*` y `HUB_SLOTS` (re-correr T8; si cambia algún `h`, recalcular su `--height`
  y reprocesar, `design.md` §5.1). Cubre: R9.
- [ ] T13 — Trabajadores y humo (`design.md` §5.2, §6.2): alternancia de poses con normalización por alto,
  respiración, desfase aleatorio; humo de `smithy` y `tavern`; Fuego Votivo en `throne_room`. Cubre: R16, R17.
- [ ] T14 — Ambiente de tormenta (`design.md` §5.3, §6.5): cielos con cross-fade, tinte, `grade`, niebla, emisores
  `embers_fall`/`motes_rise`, `flash`, `cloudDrift`; todo condicionado a `AmbientSystem.enabledInSettings()` salvo
  cielo/tinte/`grade`. Cubre: R18, R19, R20, R21, R38.
- [ ] T15 — Construcción desde el hub (`design.md` §6.4): `building:startPlacement` → fantasma +
  `placement:started`; `building:confirmPlacement` → `findFreeTile` → `building:placed` (o notificación);
  `building:cancelPlacement` → `placement:ended`. Cubre: R25, R26, R27.

## Evidencia visual y medición

- [ ] T16 — Crear `scripts/hub_b_evidence.js` (`design.md` §9) y correrlo en el viewport de referencia (DSF 2) contra
  Vite dev (`:5173`) + server local (`:3001`) con cuenta nueva por `kh_device_id`. Guardar y citar, con una línea por
  archivo: `hub_inicial.webp` (cuenta real: Torre del Señor, Huerto, Granero; ranuras vacías sin nada;
  `isActive('HubSceneB')`, `getScene('WorldScene') === null`, rect del canvas y `canvas.width/height` 824×1720
  citados), `hub_completo.webp` (17 ids inyectados, misma sesión sin recarga, humo visible, cielo calmo),
  `hub_obra.webp`, `hub_worker_a.webp` + `hub_worker_b.webp` (texture keys distintas citadas),
  `hub_tormenta_{velo_estatico,marea_carmesi,lluvia_de_energia,susurros_del_vacio,calma_falsa}.webp` + vuelta a
  calma, `hub_resize_360x780.webp` (`canvas` 720×1560 citado), `hub_token.webp` (cuerpo 14 px CSS citado),
  `hub_fx_off.webp` (emisores 0 y `postFX.list.length` 0), `config.pixelArt/antialias` y filtro lineal de cada
  `hubb_*`, `time:updated` recibido, lista de texturas no-`hubb_` vacía. Cubre: R1, R3, R4, R5, R6, R7, R10, R11, R13,
  R14, R16, R17, R18, R19, R20, R28, R29, R38, R39, R50.
- [ ] T17 — Corrida en el viewport alto (`--dpr 3`) y comparación con DSF 2: `canvas` 1236×2580 y rect 412×860
  citados; `hub_completo_dpr3.webp`; tabla de bounds en px CSS de los 17 edificios en ambos DSF (diferencia máxima
  ≤ 1 px CSS); tabla de texturas de arte del hub (`key, realHeight, displayHeight × zoom, ratio`) en DSF 3 (mínimo ≥
  0.97) y DSF 2 (máximo ≤ 2.25), pegada acá; `Text` de "+N KH" con cuerpo 14 px CSS y `style.resolution ≥ zoom` +
  `hub_token_dpr3.webp`. Cubre: R4, R5, R29, R39, R40, R42, R43, R44.
- [ ] T18 — Taps e interacción real en DSF 2 y DSF 3 (`hasTouch`, `page.touchscreen.tap`): centro de `barn` y de
  `throne_room` → `entity:selected` con su `buildingId` (4 payloads citados), cielo → `entity:deselected` (2
  citados); en DSF 2 además: tap sobre el Granero → `hub_tap_edificio.webp` con `BuildingInfoPanel` abierto;
  toolbar de construcción → `hub_construir_fantasma.webp`; Cancelar (botones desaparecen); construir un edificio
  barato → `POST /api/buildings/build` 200 citado + `hub_construir_ok.webp` (en obra). Cubre: R22, R24, R25, R26, R27,
  R41.
- [ ] T19 — Nitidez (`node scripts/hub_b_evidence.js --sharpness`): línea base con `devicePixelRatio` forzado a 1
  (reproduce el render anterior: canvas a px CSS ampliado ×2 por el navegador; no hay "antes" del hub B en el código,
  así que esta es la línea base válida) y corrida normal, misma región de la ranura `barn`; citar ambas varianzas del
  laplaciano y el cociente (≥ 1.5); `nitidez_s1.webp`, `nitidez_s2.webp`, `nitidez_comparacion.webp`. Cubre: R45.
- [ ] T20 — Entradas que no son el hub: `?preview=world` en DSF 2 → `canvas.width === 412`,
  `isActive('WorldScene')`, 0 `pageerror`, `preview_world.webp`; dioramas de combate: `GET
  /assets/game/dioramas/{battle_ruins,battle_tide,boss_arena}.png` → 200 y `git diff --stat` vacío de esos archivos y
  `CombatInstancePanel.jsx` (citar). Cubre: R46, R49.
- [ ] T21 — Robustez y consola: corrida con `page.route` abortando `**/assets/b/buildings/barn.webp` y
  `**/assets/b/hub/sky_calm.webp` → `hub_fallback.webp`, 0 `pageerror` (citar los `console.error` de red excluidos);
  corrida limpia de carga + 30 s en reposo → 0 `console.error` y 0 `pageerror`. Actualizar `docs/project-spec.md`
  §9.2 (payload `{ type, data }` de `entity:selected` y `HubSceneB` como emisor). Cubre: R30, R32.
- [ ] T22 — fps: 17 edificios + `lluvia_de_energia`, Chromium `--use-angle=d3d11 --enable-gpu`, 20 muestras de
  `loop.actualFps` + rAF; DSF 2 → `evidencia/fps.json` (promedio ≥ 50, citar promedio y mínimo); DSF 3 →
  `evidencia/fps_dpr3.json` (informativo, citar). Si DSF 2 < 50: aplicar las palancas de `design.md` §6.6 en orden y
  documentarlas acá. Cubre: R33.

## Cierre

- [ ] T23 — Verificaciones de alcance: `git grep -nE
  "hubMode|hub_bastion|zone_hub|buildHubAnchor|buildHubZones|hubZonesBuilt|hubPainterly|hub=legacy" -- client/src
  client/public scripts docs/project-spec.md` vacío (exit 1, citar); `git ls-files client/public/assets/game/dioramas
  client/public/assets/game/zones` sin `hub_bastion.png` ni `zone_hub.png` (citar); `git diff --stat
  feat/art-direction-b...HEAD -- server shared` vacío (citar). Actualizar el tope de fondos en
  `docs/architecture.md` §9 y `docs/art-direction-b.md` §5 (`design.md` §3). Cubre: R36, R47, R48.
- [ ] T24 — Build y suites: `cd client && npx vite build` (exit 0, citar `✓ built in …` y chunks);
  `cd server && npx jest --runInBand --forceExit` (citar `Tests: N passed`) y `cd client && npx vitest run` (citar
  totales; único fallo tolerado: `GameHUD.test.jsx > renders player level as Lv5`). Sin temporales, crudos 2K ni
  `.webm` en el diff. Cubre: R37, R51.

## Bloqueado

(vacío)
