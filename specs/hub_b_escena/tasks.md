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
- [x] T2 — Tanda 1: `node scripts/gen_art_b.js --manifest art-b/hub/manifest.json --only
  hub_sky_calm,hub_sky_storm,hub_base,hub_fg`; procesar a `client/public/assets/b/hub/{sky_calm,sky_storm}.webp`
  (1536, sin resize) y `{base,fg}.webp` (`--width 1280`); copiar `base.webp` a `art-b/hub/refs/hub_base.webp`.
  Hoja comparativa preliminar contra el spike (`combat_crypt.webp`) y revisión escrita **antes** de la tanda 2.
  Regenerar lo que no pase (citar ids regenerados). Cubre: R34, R35, R52. Evidencia: `gen_art_b.js --only …` → 4
  crudos 1536×2752 / 2752×1536 (~25 s c/u), **ninguno regenerado**. `bash art-b/hub/process.sh 1` → `✓
  sky_calm.webp 1536x2752`, `✓ sky_storm.webp 1536x2752`, `✓ base.webp 1280x1766 bg=rgb(199,199,199) holes=0`, `✓
  fg.webp 1280x529 bg=rgb(202,202,202) holes=32`; `cmp art-b/hub/refs/hub_base.webp client/public/assets/b/hub/base.webp`
  → idénticos. Ajustes de proceso (documentados en `process.sh`): base y fg tocan el borde inferior con barro y la
  mediana de esquinas daba fondo marrón (`bg=rgb(158,139,125)`/`rgb(75,57,45)`, comía el barro) → `--erase` de 2×2 px
  en las esquinas inferiores para que la mediana sea el gris liso; fg dejaba 17 bolsillos grises cerrados entre tablas
  y pasto (< `minHole` fijo) → flag nuevo opcional `--min-hole` en `scripts/process_art_b.js` (default 0.0004 = sin
  cambio de comportamiento; tooling, como `--quality` de `design.md` §3) con `0.00001` solo para fg: blobs grises
  opacos ≥ 20 px 17 → 0 (medido con sharp); rembg (`isnet-general-use`) se probó y se descartó porque borra el barro.
  Hoja preliminar `evidencia/contact_hub_vs_spike_t1.webp` (cielos, base, fg junto a `bg/combat_crypt.webp` y
  `heroes/mage_idle.webp`). Revisión: mismo trazo de grabado con rayado cruzado y aguadas, paleta ocre/sepia/hueso con
  verde enfermizo solo en el resplandor del cielo de tormenta, humor negro (cuervo robando un sombrero emplumado en
  `sky_calm`, cuervo con yelmito en la horca de la base, calavera con gorra emplumada en fg); base sin casas ni
  personas, 5 terrazas vacías + cima libre, murallas sin huecos ni halo; sin texto ni iconografía ajena. Pasa → tanda 2.
- [x] T3 — Tanda 2: generar `bld_throne_room`, `bld_sheet_1..6` y `wk_sheet_{farmer,woodcutter,miner,merchant}`;
  medir componentes conexos y escribir los `--crop` literales en `process.sh`; procesar a
  `client/public/assets/b/buildings/<id>.webp` (17, `--height` de la tabla §5.1; citar por id alto del recorte ≥
  `--height`, regla de no ampliación §8.3) y `client/public/assets/b/workers/<kind>_{a,b}.webp` (8, `--height 208`).
  Cubre: R34, R35, R42, R43. Evidencia: `gen_art_b.js --only` de los 11 ítems de la tanda 2 → crudos en
  `art-b/hub/raw/` (gitignored). **Regenerados:** `bld_throne_room` falló 2 veces (v1/v2: insertos y "kit de piezas")
  y `mine` de `bld_sheet_5` quedó cortada por el borde → ítem nuevo `bld_sheet_7` en el manifiesto (hoja de 2:
  torre del señor + mina, refs del spike + `hub_base`; §8.2 "regenerar … y documentarlo") del que salen
  `throne_room.webp` y `mine.webp`; `bld_throne_room` queda en el manifiesto sin usarse (crudos `_v1/_v2` descartados).
  Nota R52: el prompt de `bld_sheet_7` empieza con `STYLE MATCH:` pero con el bloque abreviado (el preset `grimdark`
  completo de `gen_art_b.js` se antepuso igual, `buildPrompt`); ver chequeo en T4. `--crop` literales = bbox de
  componentes conexos (escala 1/4, tol 38) + 8 px; `farm_plot` cortado en y=1266 (banda de niebla debajo).
  `--height` = `ceil16(1.5 × alto mostrado real)` (§5.1): con las ranuras actuales 9 edificios quedan limitados por el
  ancho de la caja (alto mostrado = w / aspecto) y con la tabla daban reducción a DPR 2 de hasta 4.04× (tower),
  3.38× (barracks), 2.75× (barn), 2.49× (house), 2.26× (mine) > 2.25 → recalculados: throne_room 704→544,
  tower 480→192, barracks 336→160, tavern 320→304, market 304→240, mill 464→416, house 272→176, barn 320→176,
  mine 336→224 (documentado en `process.sh`; T12 recalcula si cambia una ranura). `NODE=… bash art-b/hub/process.sh
  2` → 25 `✓`. Alto del recorte ≥ `--height` (no ampliación) por id: throne_room 1460≥544, mine 936≥224, library
  1428≥368, embassy 1416≥368, tower 804≥192, wall 764≥192, barracks 724≥160, tavern 944≥304, market 704≥240,
  smithy 868≥320, mill 1420≥416, house 724≥176, barn 716≥176, sawmill 1024≥320, stable 980≥288, farm_plot
  1066≥224, trap 1062≥128; trabajadores (8) recortes de 1248-1420 de alto ≥ 208, `--flip` en farmer y miner.
  Relación fuente/pantalla con `HUB_SLOTS`/`WORKER_BY_BUILDING` (sharp + `hubLayout.js`, previa a la medición en
  escena de T17): mínimo a DPR 3 = 1.007 (stable) ≥ 0.97, máximo a DPR 2 = 1.733 (farmer/merchant h 120) ≤ 2.25.
  Revisión (leader/owner y re-chequeo propio en hoja ampliada): 17 edificios y 8 trabajadores limpios, una sola
  figura/edificio por archivo, sin cabezas/miembros extra ni armas fantasma, sin halos grises, sin texto ni
  iconografía ajena; trabajadores con la acción hacia la derecha (merchant/miner en 3/4 casi frontal).
- [x] T4 — Crear `scripts/contact_sheet_b.js` y generar `evidencia/contact_hub_capas.webp`,
  `evidencia/contact_hub_edificios.webp`, `evidencia/contact_hub_trabajadores.webp` y
  `evidencia/contact_hub_vs_spike.webp`; escribir la revisión (sin figuras/cabezas extra, trabajadores mirando a la
  derecha, recorte limpio, sin texto ni iconografía ajena; trazo de grabado, paleta tierra + verde enfermizo,
  proporciones heroicas, humor negro como el spike). Chequeo con Node del manifiesto (sin `style` ≠ `grimdark`,
  `refs` permitidas, prefijo `STYLE MATCH`) citado. Cubre: R35, R52. Evidencia: `scripts/contact_sheet_b.js` ya existía (creado en T2,
  commit 1be7aa7); `KH_SCRATCH=… node scripts/contact_sheet_b.js --out …` → `✓ contact_hub_capas.webp 2813x693 (4
  imágenes)`, `✓ contact_hub_edificios.webp 2883x1031 (17)`, `✓ contact_hub_trabajadores.webp 2131x353 (8)`, `✓
  contact_hub_vs_spike.webp 2614x533 (7)` (regeneradas tras el reproceso de T3). `contact_hub_capas`: cielos calmo
  (cuervo con sombrero robado) y de tormenta (resplandor verde enfermizo), base y fg recortados limpios, sin halos
  grises ni huecos, sin texto. `contact_hub_edificios`: 17 sprites, uno por archivo, sin personas (el muñeco de
  práctica de `barracks` y el espantapájaros de `farm_plot` son pedidos del prompt), sin texto (el cartel de
  `tavern` es una jarra), sin iconografía ajena, recorte limpio. `contact_hub_trabajadores`: 8 poses, una figura
  cada una, sin cabezas/miembros extra ni armas fantasma, acción hacia la derecha. `contact_hub_vs_spike`
  (`bg/combat_crypt` + `heroes/mage_idle` junto a base, throne_room, tavern, mill, farmer_a): mismo trazo de grabado
  con rayado cruzado y aguadas oscuras, paleta umbra/sepia/ocre/hueso con naranja de vela (brasero de la torre,
  ventana de la taberna) y verde enfermizo en el musgo/cielo de tormenta como el bastón del mago, proporciones
  pesadas y exageradas (manos y pies enormes del siervo), humor negro (veleta dorada torcida, calavera con gorra
  emplumada, cuervo con yelmito en la horca). Chequeo Node de `art-b/hub/manifest.json` → `items 16
  style!=grimdark 0 refs fuera 0 prefijo STYLE MATCH 16/16`; bloque `STYLE MATCH` completo de §8.2 15/16 — falta en
  `bld_sheet_7` (regeneración de T3, prefijo abreviado `STYLE MATCH: exactly the same look as the reference combat
  art of this game — …`; el preset `grimdark` completo sí se antepuso). Se deja así para no gastar otra generación
  (las hojas de contacto muestran que `throne_room`/`mine` siguen la estética); si el reviewer exige el bloque literal
  en R52, regenerar `bld_sheet_7` con el bloque completo.
  **Desviación aceptada (R52, decisión del leader 2026-10-20):** el prompt de `bld_sheet_7` con el bloque
  `STYLE MATCH` abreviado queda **aceptado** tras revisión visual del leader (sin regeneración). Es la única excepción
  al "bloque completo de §8.2" de R52; los otros 15 ítems lo llevan literal.
- [x] T5 — Listar con `sharp` todos los webp nuevos (archivo, ancho, alto, KB) con el total; confirmar ancho ≤ 1536,
  ≤ 900 KB c/u y ≤ 4.5 MB en total (si alguno se pasa: `--quality 80` solo para ese archivo, `design.md` §8.4).
  Cubre: R34. Evidencia: `node --input-type=module` con `sharp` sobre `client/public/assets/b/{hub,buildings,workers}`
  (29 webp): hub/base 1280×1766 714.7 KB; hub/fg 1280×529 163.6 KB; hub/sky_calm 1536×2752 721.9 KB; hub/sky_storm
  1536×2752 780.1 KB; buildings/barn 302×176 16.4; barracks 322×160 18.5; embassy 313×368 38.1; farm_plot 302×224
  22.1; house 258×176 15.5; library 279×368 32.0; market 329×240 31.4; mill 295×416 35.1; mine 302×224 22.0; sawmill
  323×320 32.8; smithy 307×320 31.1; stable 293×288 28.3; tavern 291×304 29.4; throne_room 453×544 66.1; tower
  226×192 12.6; trap 128×128 7.6; wall 338×192 21.5; workers/farmer_a 143×208 10.6; farmer_b 177×208 11.3;
  merchant_a 141×208 11.1; merchant_b 162×208 11.9; miner_a 126×208 9.5; miner_b 185×208 10.6; woodcutter_a
  141×208 10.4; woodcutter_b 203×208 11.8 (KB) → `files 29 maxW 1536 maxKB 780.1 total 2.86MB`: ancho ≤ 1536, ≤ 900
  KB c/u, total 2.86 MB ≤ 4.5 MB; ningún archivo necesitó `--quality 80`.

## Lógica pura

- [x] T6 — Crear `client/src/game/display.js` (`design.md` §4.1) y `client/src/tests/display.test.js`:
  `computeRenderScale` (`0.5, 1, 2, 2.625, 3, 4, undefined, NaN`), `computeBackingSize` (412×860 @2 → 824×1720 zoom
  0.5; @3 → 1236×2580), `buildDisplaySettings` hub vs preview (preview idéntico a la config actual: `RESIZE`,
  `pixelArt: true`, 4 escenas legacy; hub: `NONE`, `pixelArt: false`, `antialias: true`, `['BootScene',
  'HubSceneB']`), `resolveStartScene` (hub, `isoMode`, `?iso=1`, preview por defecto, entry desconocido),
  `textResolutionFor` (`0.5, 1, 1.5`). Correr `cd client && npx vitest run src/tests/display.test.js`.
  Cubre: R1, R22, R39, R44, R46. Evidencia: `display.js` revisado contra §4.1 (cabecera, `MAX_RENDER_SCALE 3`, `TAP_SLOP_CSS 12`,
  `computeRenderScale` no finito → 1, `computeBackingSize` con `round`, hub `NONE`/`pixelArt false`/`antialias
  true`/`roundPixels false`/`['BootScene','HubSceneB']`, preview = config actual, entry desconocido → preview, css ≤ 0
  → 1, `resolveStartScene` y `textResolutionFor = max(1, zoom)`); sin cambios necesarios. `npx vitest run
  src/tests/display.test.js` → `Tests 26 passed (26)` (incluye `2.625 → 2.625`, `NaN → 1`, 412×860 @2 → 824×1720
  zoom 0.5, @3 → 1236×2580, preview `toEqual` la config actual, `?iso=1` → `IsoScene`). Suite completa `npx vitest
  run` → `Test Files 1 failed | 4 passed (5)`, `Tests 1 failed | 64 passed (65)`; único fallo = known_failure
  `GameHUD.test.jsx > renders player level as Lv5`.
- [x] T7 — Crear `client/src/game/hub/hubLayout.js` con constantes y funciones de `design.md` §4.2-§5 (sin importar
  `phaser` ni el store). Cubre: R3, R4, R6, R8, R9, R10, R11, R12, R13, R15, R17, R18, R19, R21, R22, R23, R24, R26,
  R29, R31. Evidencia: `client/src/game/hub/hubLayout.js` revisado contra §4.2-§5 y §8.3: 26 exports (`HUB_W/H`,
  `SAFE_*`, `HUB_DEPTHS`, `TOKEN_FONT_PX`, `BUILDING_IDS`, `TILE_SIZES`, `HUB_SLOTS` = tabla §5.1 con `smoke` en
  tavern/smithy y `fire { dx: 0, dy: −423 }` = −0.92h en throne_room, `WORKER_KINDS`, `WORKER_BY_BUILDING` = §5.2,
  `CALM_AMBIENCE`/`STORM_AMBIENCE` = §5.3, `HUB_TEXTURES` = §8.3, y las 10 funciones de §4.2 con sus reglas: cover
  `max(w/824, h/1720)` centrado con `scroll = centro − tamaño/2`, representante construido/mayor nivel/menor id,
  genérico `0x8a8478` o `#rrggbb`, firma `sky|skyTint|fog|particles|flash|cloudDrift`, `isTap` ≤ 500 ms y ≤ slop,
  `findFreeTile` en anillos desde `(78, 60)` con la AABB de `buildingService.validatePlacement` y huella por defecto
  2×2); sin cambios necesarios. `grep -nE "^import|require\(" client/src/game/hub/hubLayout.js` → sin resultados
  (exit 1: no importa `phaser` ni el store). Verificado por los 82 tests de T8.
- [x] T8 — Crear `client/src/tests/hubLayout.test.js` (Vitest): `HUB_DEPTHS` creciente; `computeHubViewport` en
  824×1720 (zoom 1), 1236×2580 (1.5), 412×860 (0.5), 720×1560 y 1536×2048, sin bandas; `HUB_SLOTS` vs
  `Object.keys(BUILDINGS)` y `TILE_SIZES` vs `tileWidth/tileHeight` (leídos con `createRequire` de
  `shared/gameConfig.js`); invariantes de ranuras; `selectHubBuildings` (starter de `playerService`, vacío, no-array,
  id desconocido); `pickRepresentative`; `buildingVisualState`; `WORKER_BY_BUILDING` vs ids con `produces`; humo de
  `smithy`/`tavern`; `stormAmbience` (null, 5 ids de `WARP_STORMS`, desconocido con color válido e inválido) y 6
  firmas distintas; `isTap` (slop 12, 24, 36); `shouldAcceptTap`; `buildSelectionPayload`; `TOKEN_FONT_PX === 28`;
  `findFreeTile` (sin solapes con los 4 registros iniciales, huellas 1×1/3×3/4×4, tablero lleno → `null`). Correr
  `cd client && npx vitest run src/tests/hubLayout.test.js`. Cubre: R3, R4, R6, R8, R9, R10, R11, R12, R13, R15, R17,
  R18, R19, R21, R22, R23, R24, R26, R29, R31. Evidencia: `client/src/tests/hubLayout.test.js` (lee `BUILDINGS` y
  `WARP_STORMS` con `createRequire` de `shared/gameConfig.js`). `npx vitest run src/tests/hubLayout.test.js` → `Tests
  82 passed (82)`: `HUB_DEPTHS` estrictamente creciente en el orden de R3 y edificios+trabajadores bajo `fog`;
  `computeHubViewport` 824×1720 → 1, 1236×2580 → 1.5, 412×860 → 0.5 y, para esos más 720×1560 y 1536×2048, cover
  uniforme, vista centrada dentro de 824×1720 (sin bandas) y `scroll = centro − tamaño/2`; `HUB_SLOTS`/`BUILDING_IDS`
  = `Object.keys(BUILDINGS)` (17, mismo orden), `TILE_SIZES` = `tileWidth/tileHeight`, `STORM_AMBIENCE` = ids de
  `WARP_STORMS`; invariantes R9 de las 17 ranuras (caja en 0..824 × `SAFE_TOP..SAFE_BOTTOM`, ancla en
  `SAFE_LEFT..SAFE_RIGHT`, anclas ≥ 80); `selectHubBuildings` con el starter de `playerService` (throne_room,
  farm_plot ×2 → 1 sprite id 2, barn), 17 ids, vacío, no-array (`undefined, null, 'x', 42, {}`), `null`/`undefined`/id
  desconocido/sin `building_id` ignorados, en obra sin trabajador; `pickRepresentative` (mayor nivel construido, menor
  id a igual nivel, en obra de menor id); `buildingVisualState` con booleanos y 0/1 de sql.js; `WORKER_BY_BUILDING` = 7
  ids con `produces`; humo de `smithy`/`tavern`; `stormAmbience` null/undefined → calma, 5 ids → su fila, 6 firmas
  distintas, desconocido `#123456` → tinte `0x123456`, colores inválidos → `0x8a8478` sin lanzar; `isTap` slop 12/24/36
  y 500 ms; `shouldAcceptTap`; `buildSelectionPayload`; `TOKEN_FONT_PX === 28`; `HUB_TEXTURES` 29 claves `hubb_*`;
  `findFreeTile` sin solapes con los 4 registros iniciales para huellas 1×1/2×2/3×3/4×4, 20 colocaciones sucesivas sin
  solape, tablero lleno → `null`. Suite completa `cd client && npx vitest run` → `Test Files 1 failed | 5 passed (6)`,
  `Tests 1 failed | 146 passed (147)`; único fallo = known_failure `GameHUD.test.jsx > renders player level as Lv5`.

## Retiro del hub viejo

- [x] T9 — Antes de tocar nada: screenshot informativo del hub viejo `evidencia/hub_viejo_antes.webp` (registro de
  lo que se reemplaza) y `git grep -n "hub_bastion\|zone_hub\|hubMode"` citado. Luego aplicar el inventario de
  `design.md` §7.2: rama `hubMode` de `WorldScene.js` (l. 75-82, 97-106, 113-121, 124-136, 143-157, métodos
  `buildHubZones`/`buildHubAnchor`, rama hub de `setupCamera`), condiciones `scene.hubMode` de `NPC.js` y
  `Villager.js`, cargas `zone_hub`/`hub_bastion` de `BootScene.js`, bloque `zone_hub` de `scripts/gen_zones.sh`,
  `git rm` de `client/public/assets/game/dioramas/hub_bastion.png` y `client/public/assets/game/zones/zone_hub.png`,
  y `docs/project-spec.md` l. 758/768 reescritas para el hub B. **No** tocar `battle_ruins/battle_tide/boss_arena` ni
  `CombatInstancePanel.jsx`. Cubre: R47, R48, R49. Evidencia: `evidencia/hub_viejo_antes.webp` (registro informativo,
  cuenta nueva, 412×860 @2: diorama pixel-art `hub_bastion` con chrome encima; canvas 412×571 en y=123 — el desajuste
  que corrige R5). `git grep -n "hub_bastion\|zone_hub\|hubMode"` **antes** de tocar (fuera de `specs/`):
  `BastionHub.jsx:25`, `PhaserGame.jsx:11,62`, `NPC.js:55,72`, `Villager.js:54,82,88`, `BootScene.js:153,156`,
  `WorldScene.js:80,103,117,124,145,201,212-214,568`, `docs/project-spec.md:758,768`, `scripts/gen_zones.sh:44-47`
  (+ `feature_list.json:56`, texto del acceptance). Aplicado §7.2: `WorldScene` sin `hubMode`/`hubZonesBuilt`,
  `ZoneStreamer` siempre, `createBuildings()`/`createFarmPlots()` incondicionales, `zoneStreamer.update(true)` solo,
  resize = `cameras.main.setSize`, `buildHubZones`/`buildHubAnchor` borrados, `setupCamera` zoom 1.0 + `centerOn`
  (−118 líneas); `NPC.js`/`Villager.js` con glow y etiquetas siempre (comportamiento de preview); `BootScene` sin
  cargas `zone_hub`/`hub_bastion`; bloque `zone_hub` fuera de `scripts/gen_zones.sh` (`bash -n` → ok);
  `docs/project-spec.md` l. 758/768 describen el hub B. Assets: `git rm client/public/assets/game/dioramas/hub_bastion.png`;
  `zone_hub.png` **no estaba versionado** (`git check-ignore -v` → `.gitignore:28:client/public/assets/game/`), se sacó
  de `client/public/` a `D:/Proyectos/_reorganizacion/kh_hub_viejo/` (copia local, fuera del repo). `git ls-files
  client/public/assets/game/dioramas client/public/assets/game/zones` → solo `battle_ruins.png`, `battle_tide.png`,
  `boss_arena.png` (R49: intactos, `CombatInstancePanel.jsx` sin tocar). Grep de R47 tras T9: solo quedan
  `BastionHub.jsx:25` y `PhaserGame.jsx:11,62` (prop/registry, los reemplaza `entry` en T10). `?preview=world` sigue
  andando: Playwright → `canvas.width 412`, `isActive('WorldScene') true`, 9 edificios, 0 `pageerror`. `cd client &&
  npx vitest run` → `Tests 1 failed | 146 passed (147)`, único fallo = known_failure GameHUD Lv5.

## Escena e integración

- [x] T10 — Entrada y resolución (`design.md` §7.1): `buildGameConfig(settings)` en `client/src/game/config.js`;
  `PhaserGame.jsx` con prop `entry`, medición del contenedor, registry `entry`/`renderScale`, `handleResize` con
  `setZoom(1/s)` + `resize(round(w·s), round(h·s))` y cleanup de `resize` y `orientationchange`; `BootScene` despacha
  a `HubSceneB` sin preload legacy en la entrada hub; `ParticleSystem.emitTokenGain(x, y, amount, opts)` con defaults
  actuales; `BastionHub.jsx` con canvas a viewport completo, capa de chrome `pointer-events-none` y
  `<PhaserGame entry="hub" />`. Cubre: R1, R5, R6, R7, R39, R46, R50. Evidencia: `config.js` sin `default export`,
  `buildGameConfig(settings)` (`Phaser.Scale[mode]`, `NO_CENTER` en hub, `zoom`, `pixelArt/antialias/roundPixels`
  arriba y en `render`, escenas por nombre); `PhaserGame.jsx` prop `entry` (default `'preview'`), mide
  `#phaser-container`, registry `entry`/`renderScale`, `handleResize` hub = `computeRenderScale` →
  `computeBackingSize` → `setZoom(1/s)` si cambió `s` + `resize`, `orientationchange` con nombre y quitado en el
  cleanup; `BootScene` vuelve en `preload()` si `entry === 'hub'` y en `create()` despacha con `resolveStartScene` antes
  del chroma-key; `ParticleSystem.emitTokenGain(x, y, amount, { fontSize = 14, resolution = 1, depth = 25 })` (trazo y
  recorrido × `fontSize/14`, defaults = mundo); `BastionHub` = canvas `absolute inset-0` + capa de chrome
  `pointer-events-none` (riel y botonera `pointer-events-auto`, `flex-1` vacío), comentarios de prueba borrados.
  `HubSceneB.js` stub (carga `HUB_TEXTURES`, base + viewport) para que la entrada compile; se completa en T11.
  Playwright (cuenta nueva, Vite dev + server Docker): DSF 2 → `{"hub":true,"world":null,"entry":"hub","s":2,
  "canvas":[824,1720],"rect":[0,0,412,860],"pixelArt":false,"antialias":true,"roundPixels":false,"nonHubb":[],
  "linear":{"0":29},"zoom":1}`; `setViewportSize(360, 780)` en caliente → `"canvas":[720,1560],"rect":[0,0,360,780]`,
  zoom 0.907 (cover); DSF 3 → `"s":3,"canvas":[1236,2580],"rect":[0,0,412,860]`, zoom 1.5, 29 `hubb_*` en LINEAR (0),
  0 texturas no-`hubb_`; `?preview=world` → `{"w":412,"h":860,"world":true,"pixelArt":true,"entry":"preview",
  "scenes":["BootScene","WorldScene","IsoScene","IsoWorldScene"]}`, 0 `pageerror`. Grep de R47 (`git grep -nE
  "hubMode|hub_bastion|…|hub=legacy" -- client/src client/public scripts docs/project-spec.md`) → vacío, exit 1.
  Consola: 0 `pageerror`; el único `console.error` propio de la página es `favicon.ico 404` (preexistente, no hay
  favicon en `client/public/`; a resolver/excluir en T21) — corridas seguidas con cuentas nuevas disparan además el
  rate-limit del server (429), ajeno al hub. `cd client && npx vitest run` → `Tests 1 failed | 146 passed (147)`
  (único fallo: known_failure GameHUD Lv5).
- [x] T11 — Crear `client/src/game/scenes/HubSceneB.js` (`design.md` §6.1-§6.3): `renderScale` del registry, preload
  de `HUB_TEXTURES` con registro de faltantes, texturas generadas, filtro lineal, capas, viewport + resize,
  `syncBuildings` con estado en obra, suscripción al store con cleanup, tap con `slop = 12 × s` →
  `entity:selected` / `entity:deselected`, `DayNightSystem` con overlay oculto, `token:earned` → `emitTokenGain` con
  `fontSize 28`, `resolution = textResolutionFor(zoom)` y depth de partículas, `teardown` que quita solo sus
  handlers. Cubre: R3, R4, R6, R7, R10, R11, R13, R14, R22, R23, R24, R28, R29, R30, R31, R41, R44. Evidencia:
  `HubSceneB.js` (536 líneas) según §6.1-§6.3: `init` lee `renderScale`; `preload` carga `HUB_TEXTURES` con
  `loaderror` → `missing` + `console.warn`; `makeTextures` (`hubb_fog/spark/ember/mote/placeholder/sky_fallback`);
  `setFilter(LINEAR)` por textura cargada; capas cielo ×2 (cover × 1.04, deriva × 1.025 por contador común), base y fg
  a 824 de ancho, `grade`/flash a pantalla completa, todo con `HUB_DEPTHS`; `applyViewport` + `scale.on('resize')`;
  `syncBuildings` (crea/actualiza/destruye; en obra `setTint(0x8a8478)` + α 0.75 sin trabajador ni humo); sprites con
  `setInteractive({ pixelPerfect: true, alphaTolerance: 8 })`; suscripción al store (`buildings`, `activeStorm`);
  `DayNightSystem` con overlay oculto; `token:earned` → `emitTokenGain(…, { fontSize: 28, resolution:
  textResolutionFor(zoom), depth: particles })`; tap `isTap(down, up, 12 × s)` + `shouldAcceptTap` →
  `entity:selected` con pop ×1.04 / `entity:deselected`; `teardown` (`once('shutdown'|'destroy')`) quita la
  suscripción, `scale.off` y **solo** sus handlers de EventBridge. El mismo archivo trae ya la lógica de T13-T15
  (trabajadores, ambiente, construcción); se verifica y ajusta en esas tasks. Playwright (Vite + server Docker, cuenta
  nueva): DSF 2 → sprites `["farm_plot","barn","throne_room"]` para los registros reales `throne_room, farm_plot ×2,
  barn` (R10/R11/R12); `__gameStore.setState({ buildings: 17 ids })` → `bldSprites.size 17` sin recarga (R14); taps
  `page.touchscreen.tap` en el centro CSS de los bounds → `[["sel","barn","building"],["sel","throne_room","building"],
  ["desel"]]` (tap en el cielo `(206, 200)`) y `overlayState.type === 'building'` (abre `BuildingInfoPanel`) en DSF 2
  **y** DSF 3 (R22/R24/R41); `token:earned {amount: 5}` → `Text` `fontSize 28px`, `resolution 1` a zoom 1 (DSF 2) y
  `1.5` a zoom 1.5 (DSF 3), cuerpo `28 × zoom / s = 14` px CSS en ambos (R29/R44); `dayNight.elapsed` 122056 →
  123556 en 1.5 s (R28). Con `page.route` abortando `barn.webp` y `sky_calm.webp`: `barn` usa `hubb_placeholder`,
  cielo `hubb_sky_fallback`, `missing = [hubb_sky_calm, hubb_bld_barn]`, 2 `console.warn` propios y 0 `pageerror`
  (R30). Sin `pageerror` en ninguna corrida. `cd client && npx vitest run` → `Tests 1 failed | 146 passed (147)`
  (known_failure GameHUD Lv5); `vite build` (a un outDir temporal) → `✓ built in 6.91s`.
- [x] T12 — Medir con Playwright los rects reales de `TopResourceBar`, `QuestRail`, botonera, `BottomNavBar` y barras
  laterales; confirmar o ajustar `SAFE_*` y `HUB_SLOTS` (re-correr T8; si cambia algún `h`, recalcular su `--height`
  y reprocesar, `design.md` §5.1). Cubre: R9. Evidencia: Playwright DSF 2 (412×860, cuenta nueva) — unión de los rects
  de las hojas visibles de cada bloque de chrome, px CSS `[x0, y0, x1, y1]`: `TopResourceBar` `[26,18,391,61]`
  (contenedor hasta y 66), `QuestRail` hasta **y 123** (con su banda; hojas `[64,88,283,114]`), botonera de
  `BastionHub` `[12,698,400,748]` (empieza en **y 698**), `BottomNavBar` `[12,788,400,852]`, `QuickActionsSidebar`
  `[8,80,52,384]` (termina en **x 52**), `EventSidebar` `[356,80,404,328]` (empieza en **x 356**), `SocialSidebar`
  `[360,564,404,764]`, `StormBanner` ausente sin tormenta. En lógicos (× 2): `SAFE_TOP 250` ≥ 246 ✓, `SAFE_BOTTOM 1390`
  ≤ 1396 ✓, `SAFE_LEFT 110` ≥ 104 ✓, `SAFE_RIGHT` **714 → 712** (= 356 × 2; ninguna ancla lo pasa). **Ranuras
  agrandadas** (decisión del leader: el hub tiene que leerse en un teléfono; tower se veía de 119 px lógicos y barracks de
  99): 5 filas sobre las terrazas de `hub_base` (cima 730, terraza 1 955, terraza 2 1125, terraza 3 1280/1390), cada
  caja = alto objetivo × aspecto del webp (+2 px) para que el alto mostrado sea `h`; `--height = ceil16(1.5 × h)`
  recalculado en `art-b/hub/process.sh` y **reprocesado desde los crudos existentes** (sin generación nueva):
  library (150, 730) 222×290 → `--height 448`; throne_room (412, 730) 332×396 → `--height 608`; embassy (668, 730) 232×270 → `--height 416`; tower (165, 955) 226×190 → `--height 288`; barracks (415, 955) 304×150 → `--height 240`; tavern (655, 955) 204×210 → `--height 320`; mill (135, 1125) 173×240 → `--height 368`; house (290, 1125) 193×130 → `--height 208`; barn (490, 1125) 243×140 → `--height 224`; smithy (690, 1125) 194×200 → `--height 304`; market (140, 1280) 236×170 → `--height 256`; sawmill (345, 1280) 199×195 → `--height 304`; stable (525, 1280) 181×175 → `--height 272`; mine (680, 1280) 225×165 → `--height 256`; farm_plot (250, 1390) 205×150 → `--height 240`; wall (470, 1390) 231×130 → `--height 208`; trap (660, 1390) 102×100 → `--height 160`. Tower 119 → 190 px lógicos (×1.6), barracks 99 → 150 (×1.5); alto del recorte de origen ≥
  `--height` en los 17 (no ampliación). Fuego Votivo `(65, −322)`, humo tavern `(−37, −195)` y smithy `(50, −190)`
  medidos sobre la captura (brasero y chimeneas reales); trabajadores `sawmill dx 85`, `smithy dx −70`, `mine dx −60
  dy 10` para no pisar el granero/establo. `NODE=… bash art-b/hub/process.sh 2` → 25 `✓` (17 edificios cambiados, 8
  trabajadores byte-idénticos). `npx vitest run src/tests/hubLayout.test.js` → `Tests 82 passed (82)` (invariantes
  R9 con los valores nuevos; anclas a ≥ 111.8 entre sí). Relación fuente/pantalla medida en escena con los 17 ids y 7
  trabajadores (`frame.realHeight / (displayHeight × zoom)`, 28 objetos de arte): DSF 3 mínimo **1.004** (market) ≥
  0.97, máximo 1.15 (merchant); DSF 2 máximo **1.723** (merchant/farmer h 120) ≤ 2.25, mínimo 1.506. Presupuesto R34
  tras el reproceso: `files 29 maxW 1536 maxKB 780.1 total 2.94MB` (edificios 10.9-78.5 KB). Hojas
  `evidencia/contact_hub_edificios.webp` (3349×572, 17) y `evidencia/contact_hub_vs_spike.webp` (2023×413, 7)
  regeneradas con los webp nuevos: mismos recortes, limpios, uno por archivo, sin texto. `cd client && npx vitest
  run` → `Tests 1 failed | 146 passed (147)` (known_failure GameHUD Lv5).
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
