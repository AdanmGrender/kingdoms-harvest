# Review — feature 3 `hub_b_escena`

**Veredicto:** APPROVED

## Re-revisión (2026-10-20)

Revisado en `feature/hub_b_escena` @ `e2cb07b`. Los 2 cambios requeridos de la revisión 1 están resueltos.

1. **Cambio requerido 1 (R47, comentarios del hub viejo) — resuelto en `e2cb07b`.**
   - `git show e2cb07b --stat` → `client/src/App.jsx` (+3/−3), `client/src/game/entities/NPC.js` (−2),
     `client/src/game/entities/Villager.js` (+1/−2), `specs/hub_b_escena/tasks.md` (+6).
   - Solo comentarios: `git diff -U0 e2cb07b~1 e2cb07b -- client | grep -E '^[+-][^+-]' | grep -vE '^[+-]\s*//'` →
     vacío (exit 1); ninguna línea de código cambiada. `addRimGlow(this)` / `addRimGlow(this.sprite)` siguen igual.
   - `NPC.js:53-54` borradas (queda "Contorno claro fino → el personaje resalta del piso grimdark oscuro.");
     `Villager.js:52-53` → esa misma línea; `App.jsx:221-223` → "hub Bastión (HubSceneB a pantalla completa +
     QuestRail, vía BastionHub)".
   - `git grep -nE "painterly|base compacta" -- client/src/game client/src/App.jsx client/src/components/hub` → una sola
     línea: `client/src/App.jsx:229: si no, sangra pixel/candy sobre los overlays painterly (combate,` (overlays de
     combate/héroes, permitido). Nada del hub viejo.
   - Grep original de R47/T23 (`hubMode|hub_bastion|zone_hub|buildHubAnchor|buildHubZones|hubZonesBuilt|hubPainterly|hub=legacy`
     sobre `client/src client/public scripts docs/project-spec.md`) → vacío, exit 1.
   - La evidencia del fix está en T23 (`tasks.md:548-553`) con el grep ampliado y el Vitest citados.
2. **Cambio requerido 2 (cabecera de `tasks.md`) — resuelto en `f3b2782`.** `tasks.md:8` ahora dice "Aprobada por el
   owner el 2026-10-20 (commit `e970838`); estado `in_progress`." (antes: "Estado: `spec_ready`, esperando aprobación").

Suites corridas por el reviewer en `e2cb07b`:
- `cd server && npx jest --runInBand --forceExit` → `Test Suites: 25 passed, 25 total`, **`Tests: 388 passed, 388 total`**.
- `cd client && npx vitest run` → `Test Files 1 failed | 5 passed (6)`, **`Tests 1 failed | 146 passed (147)`**; único
  fallo = `src/tests/GameHUD.test.jsx > GameHUD > renders player level as Lv5` (known_failure tolerado). Igual que en la
  revisión 1, sin regresiones.

Tasks y trazabilidad (verificación puntual):
- 24 tasks `- [x] T<n>`, ninguna `- [ ]`, todas con `Evidencia:` (script sobre `tasks.md`); `## Bloqueado` → "(vacío)".
- 52 `### R<n>` en `requirements.md`; cada `R1`..`R52` aparece en `tasks.md` (R2 solo como eliminado en la cabecera).
  R47 queda cubierto ahora: T9/T23 + grep ampliado arriba. El resto de la trazabilidad se verificó en la revisión 1
  (abajo) y los commits nuevos no la tocan.
- R47: [x] (antes `[ ]`). T9 y T23: sin observaciones pendientes.

Observaciones no bloqueantes (siguen en pie, salvo la primera):
- Los punteros colgados a `docs/superpowers/` quedaron corregidos en `f3b2782` (`docs/project-spec.md`,
  `scripts/gen_art_b.js`, `spikes/001-combat-b/README.md`); `git grep -n "docs/superpowers" -- docs scripts spikes` →
  vacío. Sigue pendiente para el leader confirmar con el owner que sacar `docs/superpowers/` del repo era intencional.
- `BuildingInfoPopup.jsx:45` lee `building_id` y los emisores mandan `buildingId` (preexistente; ya en el backlog como
  `fix_building_popup_id` según `f3b2782`).
- `HUB_DEPTHS.skyFx` sin uso en `hubLayout.js:16`.
- `TILE_SIZES`/`BUILDING_IDS` espejados de `shared/gameConfig.js`, justificado y cubierto por test.

---

## Revisión 1 (2026-10-20) — historial

**Veredicto (revisión 1):** CHANGES_REQUESTED

Alcance revisado: `git log feat/art-direction-b..feature/hub_b_escena` (28 commits, `12e6456`..`a7f259a`) y
`git diff --stat feat/art-direction-b...feature/hub_b_escena` (102 archivos, +4453 / −2932).

Suites corridas por el reviewer (2026-10-20):
- `cd server && npx jest --runInBand --forceExit` → `Test Suites: 25 passed, 25 total`, **`Tests: 388 passed, 388 total`**.
- `cd client && npx vitest run` → `Test Files 1 failed | 5 passed (6)`, **`Tests 1 failed | 146 passed (147)`**; único
  fallo = `src/tests/GameHUD.test.jsx > GameHUD > renders player level as Lv5` (known_failure tolerado).
- `cd client && npx vite build --outDir <scratch>` → exit 0, `index-BpSduZi0.js 658.09 kB`, `phaser-Czz4FBZH.js
  1,481.77 kB`, `✓ built in 6.74s` (solo el aviso preexistente de chunks > 500 kB).
- `git diff --stat feat/art-direction-b...feature/hub_b_escena -- server shared '*package*.json'` → vacío (sin cambios
  de server/shared ni dependencias nuevas).
- `git grep -nE "hubMode|hub_bastion|zone_hub|buildHubAnchor|buildHubZones|hubZonesBuilt|hubPainterly|hub=legacy" --
  client/src client/public scripts docs/project-spec.md` → vacío, exit 1 (pero ver cambio requerido 1: el patrón no
  atrapa los comentarios "hub painterly").
- `git ls-files client/public/assets/game/dioramas client/public/assets/game/zones` → solo `battle_ruins.png`,
  `battle_tide.png`, `boss_arena.png`.
- Manifiesto (`node` sobre `art-b/hub/manifest.json`): 16 ítems, 0 con `style` ≠ `grimdark`, 16/16 con prefijo
  `STYLE MATCH`, refs = `art-b/gr/refs/{bg_combat,anchor}.webp` + `art-b/hub/refs/hub_base.webp`.
- Diff sin `.webm`/`.rar`/`.zip`/`/raw/`/`.png` añadidos ni archivos > 900 KB; `git check-ignore -v art-b/hub/raw/x.png`
  → `.gitignore:39:/art-b/hub/raw/`. `combat-demo.webm`, `movement-demo.webm` y `.superpowers/` siguen sin versionar.

Screenshots abiertos y confirmados: `hub_completo.webp` (17 edificios + trabajadores, cielo calmo sepia, capas cielo /
base / edificios / fg, chrome encima, sin bandas), `hub_inicial.webp` (cuenta real: Torre del Señor con Fuego
Votivo, Granero, Huerto; 14 ranuras vacías sin solar; cielo rojo de `marea_carmesi` activa en el server; canvas a
pantalla completa), `hub_tormenta_lluvia_de_energia.webp` (cielo de tormenta oscurecido con gradación cálida, banner
"Lluvia de Ascuas"), `hub_tap_edificio.webp` (`BuildingInfoPanel` "Agrícola · Nivel 1 / Almacena recursos del campo /
Mejorar a Nivel 2" + popup Info/Mejorar, hub atenuado detrás), `hub_fallback.webp` (cielo degradado liso y caja roble
con borde latón en la ranura del Granero; los otros 16 edificios dibujados), `nitidez_comparacion.webp` (izquierda
lavada/empastada, derecha con tablas, sacos y rueda definidos), `preview_world.webp` (mundo pixel-art legacy con
"ISO PREVIEW · no auth", NPCs con nombre).

## Trazabilidad requirements ↔ evidencia

52 encabezados `### R<n>` en `requirements.md`; R2 está eliminado (rev. 2), quedan **51 activos**.

- R1: [x] T6 (Vitest `resolveStartScene`), T10/T16 (`hubActive true`, `worldScene null`, `scenes [BootScene,HubSceneB]`), `hub_inicial.webp`
- R2: — eliminado en la revisión 2 (sin task, correcto)
- R3: [x] T8 (`HUB_DEPTHS` creciente), T16 `hub_completo.webp`
- R4: [x] T8 (`computeHubViewport` 824×1720→1, 1236×2580→1.5, 412×860→0.5), T16/T17 capturas DSF 2 y 3
- R5: [x] T10/T16/T17 `rect [0,0,412,860]` en DSF 2 y 3
- R6: [x] T8 (720×1560, 1536×2048), T16 resize en caliente `canvas [720,1560]`, `hub_resize_360x780.webp`
- R7: [x] T10/T16 `pixelArt false`, `antialias true`, `scaleModes {"0":35}`
- R8: [x] T8 `HUB_SLOTS` = `Object.keys(BUILDINGS)` vía `createRequire`
- R9: [x] T8 invariantes + T12 rects medidos del chrome real
- R10: [x] T8 `selectHubBuildings` + T16 `hub_inicial.webp` / `hub_completo.webp`
- R11: [x] T8 + `hub_inicial.webp` (confirmado: ranuras vacías sin nada)
- R12: [x] T8 `pickRepresentative`
- R13: [x] T8 `buildingVisualState` + T13/T16 (`tint 8a8478 a 0.75 worker false smoke false`) + `hub_obra.webp`
- R14: [x] T11/T16 `setState` 17 ids sin recarga (`navEntries [1,1]`, `bldSprites.size 17`)
- R15: [x] T8 `WORKER_BY_BUILDING` = 7 ids con `produces`
- R16: [x] T13/T16 poses alternando (`farmer_b @+0ms → farmer_a @+2019ms`) + `hub_worker_a/b.webp`
- R17: [x] T8 `smoke` en smithy/tavern + T13/T16 emisores `smithy@740,935`, `tavern@618,760`
- R18: [x] T8 `stormAmbience(null)` + T14/T16 estado calma
- R19: [x] T8 (5 ids + 6 firmas distintas) + 5 `hub_tormenta_<id>.webp`
- R20: [x] T14/T16 fundido (α 0.49-0.51 a 600 ms, final a 1.5 s) y vuelta a calma
- R21: [x] T8 desconocido `#123456` / color inválido → `0x8a8478`
- R22: [x] T6/T8 (`isTap` slop 24/36, `buildSelectionPayload`) + T18 payload `barn` + `hub_tap_edificio.webp`
- R23: [x] T8 `shouldAcceptTap`
- R24: [x] T8 + T18 `["entity:deselected",null]` con listener de EventBridge
- R25: [x] T15/T18 fantasma `hubb_bld_house` + botones + `hub_construir_fantasma.webp`
- R26: [x] T8 `findFreeTile` + T15/T18 `POST /api/buildings/build` 200 (`posX 76, posY 58`) + `hub_construir_ok.webp`
- R27: [x] T15/T18 Cancelar → `buttons []`, `placement:ended`; handler `HubSceneB.js:510-515`
- R28: [x] T16 `time:updated {"period":"morning",…}` recibido + `dayNight.elapsed` creciente
- R29: [x] T16/T17 cuerpo 14 px CSS en DSF 2 y 3 + `hub_token.webp`
- R30: [x] T11/T21 `--fallback`: `missing [hubb_sky_calm, hubb_bld_barn]`, `pageerrors []` + `hub_fallback.webp`
- R31: [x] T8 `selectHubBuildings` con `undefined/null/'x'/42/{}`/id desconocido
- R32: [x] T21 `--idle` 30 s → `consoleErrors []`, `pageerrors []`
- R33: [x] T22 `fps.json` promedio 173.4 / mín 146.9 (DSF 2); `fps_dpr3.json` informativo
- R34: [x] T5/T12 listado sharp: 29 webp, maxW 1536, maxKB 780.1, total 2.94 MB
- R35: [x] T2/T3/T4 hojas `contact_hub_{capas,edificios,trabajadores}.webp` + revisión escrita
- R36: [x] T23 `git diff --stat … -- server shared` vacío (re-verificado por el reviewer)
- R37: [x] T24 + corrida propia: Jest 388/388, Vitest 146/147 (solo GameHUD Lv5)
- R38: [x] T14/T16 FX off → `emitters 0, postPipelines 0`; FX on → `postPipelines 1` (enmienda del leader `0f89b55`, registrada en `requirements.md:289` y `tasks.md:299-302`) + `hub_fx_off.webp`
- R39: [x] T6 `computeRenderScale`/`computeBackingSize` + T10/T16/T17 `canvas [824,1720]` y `[1236,2580]`
- R40: [x] T17 tabla de bounds, Δ máx 0.00 px CSS + `hub_completo{,_dpr3}.webp`
- R41: [x] T11/T18 4 payloads (`barn`, `throne_room` × DSF 2/3) + `entity:deselected` en ambos
- R42: [x] T17 tabla DSF 3, mínimo 1.004 ≥ 0.97
- R43: [x] T17 tabla DSF 2, máximo 1.724 ≤ 2.25
- R44: [x] T6 `textResolutionFor` + T17 `style.resolution 1.5 ≥ zoom 1.5` + `hub_token_dpr3.webp`
- R45: [x] T19 laplaciano 359.94 → 3367.99, cociente 9.357 ≥ 1.5 (control float 11.364) + `nitidez_*.webp`
- R46: [x] T6 `buildDisplaySettings` preview + T20 `--preview` `canvas [412,860]`, `worldActive true`, `pageerrors []` + `preview_world.webp`
- R47: [ ]  ← La evidencia (grep de T23) es correcta para su patrón, pero el requirement dice "NO DEBE contener código, plomería **ni comentarios** del hub viejo" y quedan comentarios que describen la rama eliminada y contradicen el código actual (ver cambio requerido 1).
- R48: [x] T9/T23 `git rm hub_bastion.png`; `zone_hub.png` no estaba versionado; `git ls-files` sin ambos
- R49: [x] T20 dioramas de combate 200 + `git diff --stat` vacío de los 3 PNG y `CombatInstancePanel.jsx`
- R50: [x] T10/T16 `nonHubb []`
- R51: [x] T24 + corrida propia de `vite build` exit 0
- R52: [x] T1/T4 chequeo del manifiesto + `contact_hub_vs_spike.webp`; desviación aceptada de `bld_sheet_7` (bloque `STYLE MATCH` abreviado) registrada en `tasks.md:87-89` como decisión del leader

## Tasks completas

- T1: [x]
- T2: [x]
- T3: [x]
- T4: [x]
- T5: [x]
- T6: [x]
- T7: [x]
- T8: [x]
- T9: [x]  ← dejó los comentarios del hub viejo en `NPC.js`/`Villager.js` (cambio requerido 1)
- T10: [x]
- T11: [x]
- T12: [x]
- T13: [x]
- T14: [x]
- T15: [x]
- T16: [x]
- T17: [x]
- T18: [x]
- T19: [x]
- T20: [x]
- T21: [x]
- T22: [x]
- T23: [x]  ← su grep de R47 no cubre comentarios con "hub painterly" / "base compacta"
- T24: [x]

24/24 `[x]` con `Evidencia:`; `## Bloqueado` vacío.

## Cambios requeridos

1. **R47 — comentarios del hub viejo que sobreviven y contradicen el código.** T9 quitó las condiciones
   `scene.hubMode` pero dejó los comentarios que las explicaban, que ahora dicen lo contrario de lo que hace la línea
   siguiente:
   - `client/src/game/entities/NPC.js:53-54` — "En hub painterly NO: el rim-glow los hacía ver como recortes pegados
     flotando sobre el diorama (costura pixel-vs-painterly)." seguido de `addRimGlow(this);` incondicional (l. 55).
   - `client/src/game/entities/Villager.js:52-53` — "Rim-glow solo fuera del hub: en el hub painterly hacía ver a los
     personajes como recortes flotando (costura). Ver NPC.js." seguido de `addRimGlow(this.sprite);` incondicional (l. 54).
   - `client/src/App.jsx:221` — "Entrada por defecto = hub Bastión (base compacta + QuestRail)": "base compacta" es la
     descripción del hub viejo (cámara fija de `WorldScene`); hoy es `HubSceneB` a pantalla completa.
   Borrar las líneas de NPC/Villager (o dejar solo "Contorno claro fino → el personaje resalta del piso grimdark
   oscuro.") y reescribir App.jsx:221 para el hub B. Luego volver a correr el grep de R47 **ampliado** con
   `painterly|base compacta` sobre `client/src/game client/src/App.jsx client/src/components/hub` y citar la salida en
   T9/T23 (los "painterly" de `CombatInstancePanel.jsx:181`, `OverlayManager.jsx:127`, `App.jsx:229` y
   `scripts/gen_art_b.js:44` describen arte de combate/overlays, no el hub, y pueden quedar), más `cd client && npx
   vitest run` (sin regresiones).
2. `specs/hub_b_escena/tasks.md:7-8` — la nota de cabecera sigue diciendo "Estado: `spec_ready`, esperando
   aprobación"; actualizarla a `in_progress` citando la fuente de la aprobación del owner (commit `e970838`), como
   pide el flujo del harness.

## Observaciones no bloqueantes

- **Fuera de alcance, para el leader:** el commit `e970838` ("hub_b_escena aprobado por el owner → in_progress") borra
  9 archivos de `docs/superpowers/` (−2673 líneas; la copia está sin versionar en `.superpowers/`) y cambia rutas en
  `docs/deploy-local.md:11` y `scripts/gen_heroes_locked.sh:5`. No es trabajo del implementer, pero deja referencias
  colgadas: `docs/project-spec.md:753-754`, `docs/project-spec.md:772`, `scripts/gen_art_b.js:25`,
  `spikes/001-combat-b/README.md:75`. Confirmar con el owner si el movimiento era intencional y, si sí, corregir esos
  punteros (o sacar ese cambio de esta rama).
- `client/src/components/hud/BuildingInfoPopup.jsx:45` lee `selected.building_id`, pero todos los emisores
  (`HubSceneB.js:456` vía `buildSelectionPayload`, `WorldScene.js:515`) mandan `data.buildingId` → el popup muestra
  "Edificio" con el emoji 🏠 (visible en `hub_tap_edificio.webp`). Es preexistente (paridad con hoy, R22 se cumple con
  `BuildingInfoPanel`), pero vale una feature de seguimiento.
- `client/src/game/hub/hubLayout.js:16` declara `HUB_DEPTHS.skyFx` y ningún objeto lo usa.
- `TILE_SIZES`/`BUILDING_IDS` de `hubLayout.js` son espejos de `shared/gameConfig.js`; está justificado en
  `design.md` §2.1 (alternativa descartada) y la sincronía la cubre `hubLayout.test.js`. `findFreeTile` solo propone la
  celda; el server sigue validando (`buildingService.validatePlacement`), así que no es lógica de negocio en el cliente.
- Arquitectura OK en lo revisado: `HubSceneB` habla con React solo por `EventBridge` y quita **solo** sus handlers en
  `teardown` (`HubSceneB.js:526-538`, más `unsub` del store y `scale.off`); `PhaserGame.jsx` quita `resize` y
  `orientationchange` con nombre y limpia el timer (`PhaserGame.jsx:109-112`); ningún `import` de React en Phaser ni de
  Phaser en componentes; sin TODO/`console.log` nuevos (el `console.log` de `PhaserGame.jsx:40` es preexistente); sin
  renombres de ids; sin IP ajena en arte ni favicon.
