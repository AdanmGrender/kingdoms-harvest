# Tasks — `hub_b_escena` (feature 3, B1.1)

> Orden de ejecución. Cada task cubre `R<n>` de `requirements.md`; diseño en `design.md`. Al cerrar una task:
> `[x]` + `Evidencia:` inline (comando + salida citada, test, o ruta de screenshot con una línea de qué verifica).
> Screenshots y hojas de contacto en `specs/hub_b_escena/evidencia/` (webp). Branch: `feature/hub_b_escena`.

## Arte

- [ ] T1 — Crear `art-b/hub/manifest.json` con el contenido exacto de `design.md` §8.2, `art-b/hub/process.sh`
  (formato de `art-b/gr/process.sh`, §8.3) y agregar `/art-b/hub/raw/` a `.gitignore`. Cubre: R35.
- [ ] T2 — Tanda 1: generar `hub_sky_calm`, `hub_sky_storm`, `hub_base`, `hub_fg`
  (`node scripts/gen_art_b.js --manifest art-b/hub/manifest.json --only hub_sky_calm,hub_sky_storm,hub_base,hub_fg`),
  procesar a `client/public/assets/b/hub/{sky_calm,sky_storm,base,fg}.webp` y copiar `base.webp` a
  `art-b/hub/refs/hub_base.webp`. Regenerar lo que no pase revisión (citar ids regenerados). Cubre: R34, R35.
- [ ] T3 — Tanda 2: generar `bld_sheet_1..6` y `wk_sheet_{farmer,woodcutter,miner,merchant}`; medir componentes
  conexos y escribir los `--crop` literales en `process.sh`; procesar a `client/public/assets/b/buildings/<id>.webp`
  (17) y `client/public/assets/b/workers/<kind>_{a,b}.webp` (8). Cubre: R34, R35.
- [ ] T4 — Crear `scripts/contact_sheet_b.js` y generar `evidencia/contact_hub_capas.webp`,
  `evidencia/contact_hub_edificios.webp`, `evidencia/contact_hub_trabajadores.webp`; escribir la revisión (sin
  figuras/cabezas extra, orientación de trabajadores a la derecha, recorte limpio, sin texto ni iconografía ajena).
  Cubre: R35.
- [ ] T5 — Listar con `sharp` todos los webp nuevos (archivo, ancho, alto, KB) y confirmar ancho ≤ 1080. Cubre: R34.

## Lógica pura

- [ ] T6 — Crear `client/src/game/hub/hubLayout.js` con constantes y funciones de `design.md` §4-§5 (sin importar
  `phaser` ni el store). Cubre: R1, R2, R3, R4, R6, R8, R9, R10, R11, R12, R13, R15, R17, R18, R19, R21, R22, R23,
  R24, R26, R31.
- [ ] T7 — Crear `client/src/tests/hubLayout.test.js` (Vitest): `resolveStartScene` (hub, `?hub=legacy`, iso);
  `HUB_DEPTHS` creciente; `computeHubViewport` en 412×860 (zoom 0.5, sin bandas), 360×780 y 768×1024; `HUB_SLOTS` vs
  `Object.keys(BUILDINGS)` y `TILE_SIZES` vs `tileWidth/tileHeight` (leídos con `createRequire` de
  `shared/gameConfig.js`); invariantes de ranuras; `selectHubBuildings` (starter de `playerService`, vacío, no-array,
  id desconocido); `pickRepresentative`; `buildingVisualState`; `WORKER_BY_BUILDING` vs ids con `produces`; humo de
  `smithy`/`tavern`; `stormAmbience` (null, 5 ids de `WARP_STORMS`, desconocido con color válido e inválido) y 6 firmas
  distintas; `isTap`; `shouldAcceptTap`; `buildSelectionPayload`; `findFreeTile` (sin solapes con los 4 registros
  iniciales, huellas 1×1/3×3/4×4, tablero lleno → `null`). Correr `cd client && npx vitest run
  src/tests/hubLayout.test.js`. Cubre: R1, R2, R3, R4, R6, R8, R9, R10, R11, R12, R13, R15, R17, R18, R19, R21, R22,
  R23, R24, R26, R31.

## Escena e integración

- [ ] T8 — Crear `client/src/game/scenes/HubSceneB.js` (`design.md` §6.1-§6.3): preload de `HUB_TEXTURES` con
  registro de faltantes, texturas generadas, filtro lineal, capas, viewport + resize, `syncBuildings` con estado en
  obra, suscripción al store con cleanup, tap → `entity:selected` / `entity:deselected`, `DayNightSystem` con overlay
  oculto, `token:earned` → `emitTokenGain`, `teardown` que quita solo sus handlers. Cubre: R3, R4, R6, R7, R10, R11,
  R13, R14, R22, R23, R24, R28, R29, R30, R31.
- [ ] T9 — Integración: `HubSceneB` en `client/src/game/config.js`; `BootScene.create()` con `resolveStartScene`;
  `BastionHub.jsx` con canvas a viewport completo y capa de chrome `pointer-events-none` (`design.md` §7). Medir con
  Playwright los rects reales de `TopResourceBar`, `QuestRail`, botonera, `BottomNavBar` y barras laterales; confirmar
  o ajustar `SAFE_*` y `HUB_SLOTS` (re-correr T7). Cubre: R1, R2, R5, R9.
- [ ] T10 — Trabajadores y humo (`design.md` §5.2, §6.2): alternancia de poses con normalización por alto,
  respiración, desfase aleatorio; humo de `smithy` y `tavern`; Fuego Votivo en `throne_room`. Cubre: R16, R17.
- [ ] T11 — Ambiente de tormenta (`design.md` §5.3, §6.5): cielos con cross-fade, tinte, `grade`, niebla, emisores
  `embers_fall`/`motes_rise`, `flash`, `cloudDrift`; todo condicionado a `AmbientSystem.enabledInSettings()` salvo
  cielo/tinte/`grade`. Cubre: R18, R19, R20, R21, R38.
- [ ] T12 — Construcción desde el hub (`design.md` §6.4): `building:startPlacement` → fantasma +
  `placement:started`; `building:confirmPlacement` → `findFreeTile` → `building:placed` (o notificación);
  `building:cancelPlacement` → `placement:ended`. Cubre: R25, R26, R27.

## Evidencia visual y medición

- [ ] T13 — Crear `scripts/hub_b_evidence.js` (`design.md` §9) y correrlo contra Vite dev (`:5173`) + server local
  (`:3001`) con cuenta nueva por `kh_device_id`. Guardar y citar, con una línea por archivo:
  `hub_inicial.webp` (cuenta real: Torre del Señor, Huerto, Granero; ranuras vacías sin nada; `isActive('HubSceneB')`
  y rect del canvas citados), `hub_completo.webp` (17 ids inyectados, mismo session sin recarga, humo visible, cielo
  calmo), `hub_obra.webp`, `hub_worker_a.webp` + `hub_worker_b.webp` (texture keys distintas citadas),
  `hub_tormenta_velo_estatico.webp`, `hub_tormenta_marea_carmesi.webp`, `hub_tormenta_lluvia_de_energia.webp`,
  `hub_tormenta_susurros_del_vacio.webp`, `hub_tormenta_calma_falsa.webp` + vuelta a calma, `hub_resize_360x780.webp`,
  `hub_legacy.webp`, `hub_token.webp`, `hub_fx_off.webp` (conteo de emisores 0 y `postFX.list.length` 0), filtro
  lineal de cada `hubb_*` y `time:updated` recibido. Cubre: R1, R2, R3, R4, R5, R6, R7, R10, R11, R13, R14, R16, R17,
  R18, R19, R20, R28, R29, R38.
- [ ] T14 — Flujos reales de interacción en la misma corrida: tap sobre el Granero → `hub_tap_edificio.webp` con
  `BuildingInfoPanel` abierto; toolbar de construcción → `hub_construir_fantasma.webp`; Cancelar (botones
  desaparecen); construir un edificio barato → `POST /api/buildings/build` 200 citado + `hub_construir_ok.webp` (en
  obra). Cubre: R22, R24, R25, R26, R27.
- [ ] T15 — Robustez y consola: corrida con `page.route` abortando `**/assets/b/buildings/barn.webp` y
  `**/assets/b/hub/sky_calm.webp` → `hub_fallback.webp`, 0 `pageerror` (citar los `console.error` de red excluidos);
  corrida limpia de carga + 30 s en reposo → 0 `console.error` y 0 `pageerror`. Actualizar `docs/project-spec.md`
  §9.2 (payload `{ type, data }` de `entity:selected` y `HubSceneB` como emisor). Cubre: R30, R32.
- [ ] T16 — fps: 17 edificios + `lluvia_de_energia`, viewport 412×860 @2x, Chromium `--use-angle=d3d11
  --enable-gpu`, 20 muestras de `loop.actualFps` + rAF → `evidencia/fps.json`; citar promedio y mínimo (≥ 50 de
  promedio). Cubre: R33.

## Cierre

- [ ] T17 — Verificar que no hay cambios de server/shared: `git diff --stat feat/art-direction-b...HEAD -- server
  shared` vacío (citar). Cubre: R36.
- [ ] T18 — Suites completas: `cd server && npx jest --runInBand --forceExit` (citar `Tests: N passed`) y
  `cd client && npx vitest run` (citar totales; único fallo tolerado: `GameHUD.test.jsx > renders player level as
  Lv5`). Sin temporales, crudos 2K ni `.webm` en el diff. Cubre: R37.

## Bloqueado

(vacío)
