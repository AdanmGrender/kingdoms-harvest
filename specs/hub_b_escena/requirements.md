# Requirements — `hub_b_escena` (feature 3, B1.1)

> Hub idle vivo — escena base ilustrada, nítida a resolución de dispositivo, que **reemplaza y elimina** el hub
> viejo. Notación EARS estricta (`docs/specs.md`). Cada `R<n>` indica su **Evidencia** según `docs/conventions.md`
> §Verificación.
>
> **Revisión 2 (owner, 2026-10-20):** "mejorar calidad y seguir con la estética de las primeras muestras (grimdark
> renacentista del spike de combate), mejorá la nitidez, el hub viejo lo podés desechar". Cambios: R2 eliminado
> (sin fallback `?hub=legacy`); R1, R4, R5, R6, R7, R22, R24, R29, R33, R34 revisados; R39-R52 nuevos (nitidez,
> retiro del hub viejo, estética). Los ids no se renumeran.
>
> Glosario de este documento:
> - **hub B**: la escena Phaser `HubSceneB` (ver `design.md`). Es **el** hub: no hay otro.
> - **hub viejo**: la rama `hubMode` de `WorldScene` (diorama `hub_bastion` + ancla `zone_hub` + NPCs, animales y
>   aldeanos paseando) y su plomería (`registry.hubMode`, prop `hubMode` de `PhaserGame`).
> - **entrada hub**: `PhaserGame` montado por `BastionHub`. **entrada preview**: `PhaserGame` montado por la rama
>   `ISO_PREVIEW` de `App.jsx` (`?preview=world`, `?iso=1`).
> - **s** (escala de render): `min(max(window.devicePixelRatio, 1), 3)`.
> - **px CSS** / **px de dispositivo** (= px CSS × s) / **px lógicos** (coordenadas del espacio lógico).
> - **espacio lógico**: lienzo de composición de 824×1720 (= 412×860 @2x, igual que `spikes/001-combat-b`).
> - **ranura**: posición fija `{ x, y, w, h }` de un `building_id` en el espacio lógico.
> - **registro**: elemento de `gameStore.buildings` (`building_id`, `level`, `is_building`, `position_x`, `position_y`, `id`).
> - **edificio productor**: `building_id` cuyo catálogo `BUILDINGS` de `shared/gameConfig.js` tiene `produces`
>   (hoy: `farm_plot`, `mill`, `sawmill`, `smithy`, `mine`, `tavern`, `market`).
> - **tormenta activa**: `gameStore.activeStorm` no nulo (catálogo `WARP_STORMS`: `velo_estatico`, `marea_carmesi`,
>   `lluvia_de_energia`, `susurros_del_vacio`, `calma_falsa`).
> - **viewport de referencia**: Playwright 412×860, `deviceScaleFactor: 2`, Chromium headless con
>   `--use-angle=d3d11 --enable-gpu`. **viewport alto**: igual con `deviceScaleFactor: 3`.
> - **textura de arte del hub**: textura `hubb_*` cargada desde `client/public/assets/b/` (excluye las generadas en
>   runtime: `hubb_fog`, `hubb_spark`, `hubb_ember`, `hubb_mote`, `hubb_placeholder`, `hubb_sky_fallback`).

## Trazabilidad con el `acceptance` de `feature_list.json` (id 3)

| # | Criterio de aceptación | Requirements |
|---|---|---|
| A1 | Al entrar al Bastión se ve la escena B en lugar del diorama viejo, encuadrada para 412×860 sin recortes raros | R1, R3, R4, R5, R6, R7, R34, R35 |
| A2 | Cada edificio construido aparece en su ranura con su sprite B; los no construidos no aparecen | R8, R9, R10, R11, R12, R13, R14 |
| A3 | Los productores muestran trabajador o efecto animado sin input (respiración/loop, humo) | R15, R16, R17 |
| A4 | Con tormenta activa el cielo/ambiente cambia de forma reconocible; sin tormenta, cielo normal | R18, R19, R20, R21 |
| A5 | Tocar un edificio abre la misma información/acción que hoy (no se pierde funcionalidad) | R22, R23, R24, R25, R26, R27, R28, R29 |
| A6 | Sin cambios de economía ni API; suites sin regresiones; consola sin errores; ≥ 50 fps headless con GPU | R30, R31, R32, R33, R36, R37, R38, R51 |
| A7 | El hub renderiza a la resolución del dispositivo (DPR 2-3): nítido, mismos taps, ≥ 50 fps a DPR 2 | R39, R40, R41, R42, R43, R44, R45, R46 |
| A8 | El hub viejo se elimina sin fallback (código, plomería y assets huérfanos), sin romper combate ni preview | R47, R48, R49, R50, R51 |
| A9 | El arte del hub sigue la estética grimdark renacentista del spike de combate | R35, R52 |

R2 está **eliminado** (ver abajo); ningún criterio depende de él.

---

## Escena y encuadre

### R1
CUANDO se monta `BastionHub`, el sistema DEBE arrancar `HubSceneB` como única escena de juego de esa entrada
(`BootScene` solo despacha).
Evidencia: Vitest de `resolveStartScene({ entry: 'hub', … }) === 'HubSceneB'` en `client/src/tests/display.test.js`
+ Playwright en viewport de referencia: `window.__phaserGame.scene.isActive('HubSceneB') === true` y
`window.__phaserGame.scene.getScene('WorldScene') === null` (no registrada en la entrada hub) (citar salida) +
screenshot `evidencia/hub_inicial.webp`.

### R2 — eliminado
~~DONDE la URL contiene `?hub=legacy`, el sistema DEBE arrancar `WorldScene` en modo hub con el comportamiento
actual.~~ Eliminado en la revisión 2: el owner desecha el hub viejo, sin fallback. Lo reemplazan R47 y R48.

### R3
El sistema DEBE componer el hub B en el espacio lógico de 824×1720 con este orden de profundidad, de atrás hacia
adelante: cielo, base (colina y muralla), edificios y trabajadores, niebla, primer plano, partículas, gradación de
tormenta.
Evidencia: Vitest sobre la constante `HUB_DEPTHS` (orden estrictamente creciente) + screenshot
`evidencia/hub_completo.webp` con una línea de qué capas se ven.

### R4
MIENTRAS el hub B está activo, el sistema DEBE cubrir todo el canvas con la composición a escala uniforme (sin
bandas vacías ni deformación).
Evidencia: Vitest de `computeHubViewport` en px de dispositivo: `(824, 1720)` → zoom 1 (s = 2), `(1236, 2580)` →
zoom 1.5 (s = 3), `(412, 860)` → zoom 0.5 (s = 1), sin bandas en ninguno + screenshots `evidencia/hub_completo.webp`
(s = 2) y `evidencia/hub_completo_dpr3.webp` (s = 3).

### R5
El sistema DEBE ubicar el canvas del hub ocupando el viewport completo detrás del chrome React (barra superior,
riel, botonera inferior y barras laterales flotan encima).
Evidencia: Playwright en viewport de referencia y viewport alto:
`document.querySelector('#phaser-container canvas').getBoundingClientRect()` igual a
`{ x: 0, y: 0, width: 412, height: 860 }` con tolerancia ±0.5 px CSS (citar ambas salidas) + screenshot
`evidencia/hub_inicial.webp`.

### R6
CUANDO el viewport cambia de tamaño, el sistema DEBE recalcular el búfer del canvas (R39), el zoom y el centrado del
hub B con la misma regla de cobertura de R4.
Evidencia: Vitest de `computeHubViewport` para `(720, 1560)` (360×780 @2) y `(1536, 2048)` (768×1024 @2) +
Playwright: `page.setViewportSize({ width: 360, height: 780 })` en caliente → `canvas.width === 720` y
`canvas.height === 1560` (citar) + screenshot `evidencia/hub_resize_360x780.webp`.

### R7
El sistema DEBE dibujar las texturas del hub B con filtrado lineal.
Evidencia: Playwright: `window.__phaserGame.config.pixelArt === false` y `config.antialias === true`, y para cada
textura `hubb_*` cargada `window.__phaserGame.textures.get(key).source[0].scaleMode` es
`Phaser.Textures.FilterMode.LINEAR` (0) (citar salida).

## Edificios

### R8
El sistema DEBE definir exactamente una ranura `{ x, y, w, h }` por cada `building_id` del catálogo `BUILDINGS` de
`shared/gameConfig.js` (17 ids).
Evidencia: Vitest: claves de `HUB_SLOTS` iguales a `Object.keys(BUILDINGS)` leído con `createRequire` desde
`shared/gameConfig.js`.

### R9
El sistema DEBE ubicar cada ranura dentro de la banda visible no tapada por el chrome (caja dentro de
`0..824` en x y de `SAFE_TOP..SAFE_BOTTOM` en y; ancla dentro de `SAFE_LEFT..SAFE_RIGHT`; anclas a ≥ 80 px lógicos
entre sí).
Evidencia: Vitest sobre `HUB_SLOTS` + medición Playwright del chrome real que confirma los valores de
`SAFE_*` (citar los rects medidos).

### R10
MIENTRAS el jugador tiene al menos un registro de un `building_id`, el sistema DEBE dibujar el sprite B de ese id
en su ranura.
Evidencia: Vitest de `selectHubBuildings` + screenshots `evidencia/hub_inicial.webp` (cuenta nueva real:
`throne_room`, `farm_plot`, `barn`) y `evidencia/hub_completo.webp` (17 ids inyectados en el store DEV).

### R11
MIENTRAS el jugador no tiene ningún registro de un `building_id`, el sistema NO DEBE dibujar nada en la ranura de
ese id (sin solar vacío).
Evidencia: Vitest de `selectHubBuildings` + screenshot `evidencia/hub_inicial.webp`.

### R12
CUANDO hay varios registros con el mismo `building_id`, el sistema DEBE representar ese id con un único sprite
asociado al registro elegido por la regla: el construido (`is_building` falso) de mayor `level`; a igual nivel, el
de menor `id`; si ninguno está construido, el en obra de menor `id`.
Evidencia: Vitest de `pickRepresentative`.

### R13
MIENTRAS el registro representado está en obra (`is_building` verdadero), el sistema DEBE dibujar el sprite con el
tratamiento "en obra" (atenuado y desaturado) y sin trabajador.
Evidencia: Vitest de `buildingVisualState` + screenshot `evidencia/hub_obra.webp`.

### R14
CUANDO cambia `gameStore.buildings` (init, `loadBuildings`, fin de obra), el sistema DEBE actualizar los sprites
del hub B sin recargar la página.
Evidencia: Playwright: `window.__gameStore.setState({ buildings })` en DEV antes/después →
screenshots `evidencia/hub_inicial.webp` y `evidencia/hub_completo.webp` de la misma sesión, sin recarga (citar).

## Producción animada

### R15
El sistema DEBE asignar un tipo de trabajador a cada edificio productor y a ningún otro `building_id`.
Evidencia: Vitest: claves de `WORKER_BY_BUILDING` iguales a los ids de `BUILDINGS` con `produces`.

### R16
MIENTRAS un edificio productor está dibujado y su registro representado está construido, el sistema DEBE animar su
trabajador en loop (alternancia de 2 poses + respiración) sin input del jugador.
Evidencia: Playwright: dos lecturas separadas ≥ 1.5 s de `texture.key` del trabajador muestran poses distintas
(citar) + screenshots `evidencia/hub_worker_a.webp` y `evidencia/hub_worker_b.webp`.

### R17
MIENTRAS la herrería (`smithy`) o la taberna (`tavern`) están dibujadas y construidas, el sistema DEBE emitir humo
desde su chimenea.
Evidencia: Vitest (`HUB_SLOTS.smithy.smoke` y `HUB_SLOTS.tavern.smoke` definidos) + screenshot
`evidencia/hub_completo.webp` con el humo señalado.

## Tormentas

### R18
MIENTRAS no hay tormenta activa, el sistema DEBE mostrar el cielo calmo (`sky_calm`) sin niebla, partículas ni
gradación de tormenta.
Evidencia: Vitest de `stormAmbience(null)` + screenshot `evidencia/hub_completo.webp`.

### R19
MIENTRAS hay una tormenta activa con id del catálogo, el sistema DEBE aplicar el ambiente asignado a ese id en la
tabla de `design.md` §5.3, distinto del calmo y distinto del de las otras cuatro tormentas.
Evidencia: Vitest: `stormAmbience` cubre los 5 ids de `WARP_STORMS` (leídos con `createRequire`), firmas distintas
entre sí y de la calma + screenshots `evidencia/hub_tormenta_<id>.webp` (5).

### R20
CUANDO `gameStore.activeStorm` cambia (socket `storm_started`/`storm_ended` o el poll de `StormBanner`), el sistema
DEBE pasar al nuevo ambiente con un fundido de como máximo 1.5 s, sin recargar la página.
Evidencia: Playwright: `window.__gameStore.getState().setActiveStorm(...)` y luego `setActiveStorm(null)` en la
misma sesión → screenshots `evidencia/hub_tormenta_<id>.webp` y vuelta a calma (citar).

### R21
SI `activeStorm` trae un id que no está en la tabla ENTONCES el sistema DEBE aplicar el ambiente genérico de
tormenta (cielo `sky_storm` teñido con `activeStorm.color` si es un color `#rrggbb` válido) sin lanzar error.
Evidencia: Vitest de `stormAmbience({ id: 'desconocida', color: '#123456' })` y con color inválido.

## Interacción (paridad con hoy)

### R22
CUANDO el jugador hace tap (≤ 500 ms y ≤ 12 px CSS de desplazamiento, es decir ≤ 12 × s px de dispositivo) sobre un
píxel opaco del sprite de un edificio dibujado y no hay overlay abierto, el sistema DEBE emitir por `EventBridge`
`entity:selected` con `{ type: 'building', data: { buildingId, posX, level, isBuilding } }` del registro
representado.
Evidencia: Vitest de `isTap` (con `slop` 24 y 36) y `buildSelectionPayload` + Playwright: tap sobre el Granero →
screenshot `evidencia/hub_tap_edificio.webp` con `BuildingInfoPanel` abierto (mismo panel que abre `OverlayManager`
hoy).

### R23
MIENTRAS `gameStore.overlayState` no es nulo, el sistema NO DEBE emitir `entity:selected` desde el hub B.
Evidencia: Vitest de `shouldAcceptTap`.

### R24
CUANDO el jugador hace tap sobre el hub B fuera de cualquier edificio y no hay overlay abierto, el sistema DEBE
emitir `entity:deselected`, igual que hoy `SelectionSystem`.
Evidencia: Vitest de `shouldAcceptTap` + Playwright: tap en el cielo con un listener de `entity:deselected`
registrado vía `await import('/src/game/EventBridge.js')` (citar el evento recibido; ver también R41).

### R25
CUANDO el hub B recibe `building:startPlacement { buildingId }`, el sistema DEBE mostrar un fantasma
semitransparente del sprite en la ranura de ese id y emitir `placement:started { buildingId }`.
Evidencia: Playwright: toolbar de construcción (`QuickActionsSidebar` → `BuildingToolbar`) → screenshot
`evidencia/hub_construir_fantasma.webp` con los botones Confirmar/Cancelar visibles.

### R26
CUANDO el hub B recibe `building:confirmPlacement` con una colocación activa, el sistema DEBE emitir
`building:placed { buildingId, posX, posY }` con la celda libre que devuelve `findFreeTile` (sin solaparse con los
registros existentes según `tileWidth`/`tileHeight` del catálogo y dentro de `0..200`).
Evidencia: Vitest de `findFreeTile` (incluye los 4 registros iniciales de `playerService`) + Playwright contra el
server local: construir un edificio barato → respuesta `POST /api/buildings/build` 200 (citar) y screenshot
`evidencia/hub_construir_ok.webp` con el sprite en obra.

### R27
CUANDO el hub B recibe `building:cancelPlacement`, o termina un `building:confirmPlacement`, el sistema DEBE quitar
el fantasma y emitir `placement:ended`.
Evidencia: Playwright: Cancelar → los botones Confirmar/Cancelar desaparecen (citar) + inspección del handler.

### R28
MIENTRAS el hub B está activo, el sistema DEBE emitir `time:updated` con el contrato actual de `DayNightSystem`
(`{ period, icon, dayCount, timeOfDay }`).
Evidencia: Playwright: `const EB = (await import('/src/game/EventBridge.js')).default` y un listener registrado en la
página recibe al menos un `time:updated` en ≤ 15 s, o lectura de `scene.dayNight.elapsed` creciente (citar).

### R29
CUANDO llega `token:earned { amount }` con `amount > 0`, el sistema DEBE mostrar en el hub B el texto flotante
"+N KH" (`ParticleSystem.emitTokenGain`) con un cuerpo en pantalla de 14 px CSS, como hoy en el mundo.
Evidencia: Playwright en viewport de referencia y viewport alto: `EB.emit('token:earned', { amount: 5 })` → lectura
del `Text` creado: `parseFloat(style.fontSize) × cameras.main.zoom / s` = 14 ± 0.5 (citar ambas) + screenshot
`evidencia/hub_token.webp`.

## Robustez, rendimiento y no regresión

### R30
SI una textura del hub B falla al cargar ENTONCES el sistema DEBE dibujar un placeholder en su lugar y seguir
funcionando sin excepción.
Evidencia: Playwright con `page.route` abortando `**/assets/b/buildings/barn.webp` y `**/assets/b/hub/sky_calm.webp`
→ screenshot `evidencia/hub_fallback.webp` y cero `pageerror` (los `console.error` de red de las URLs bloqueadas se
citan y se excluyen explícitamente).

### R31
SI `gameStore.buildings` contiene un `building_id` fuera del catálogo o un valor no-array ENTONCES el sistema DEBE
ignorarlo sin lanzar error.
Evidencia: Vitest de `selectHubBuildings` con entradas inválidas (`undefined`, `null`, id desconocido).

### R32
MIENTRAS el hub B carga y queda 30 s en reposo (sin bloqueos intencionales de red), el sistema NO DEBE producir
mensajes `console.error` ni `pageerror`.
Evidencia: log de consola capturado por Playwright (citar conteo 0) en la corrida de `scripts/hub_b_evidence.js`.

### R33
MIENTRAS el hub B muestra los 17 edificios y la tormenta `lluvia_de_energia` en el viewport de referencia (canvas
de 824×1720 px de dispositivo, R39), el sistema DEBE sostener ≥ 50 fps de promedio durante 20 s.
Evidencia: muestras de `window.__phaserGame.loop.actualFps` cada 1 s + contador de `requestAnimationFrame`
(promedio y mínimo citados) en `evidencia/fps.json`. La misma medición en el viewport alto (s = 3, canvas
1236×2580) se guarda en `evidencia/fps_dpr3.json` como **informativa**: no bloquea el cierre (en headless puede
quedar limitada por GPU/rasterizado), pero se cita.

### R34
El sistema DEBE servir todos los assets nuevos del hub como `.webp` bajo `client/public/assets/b/` dentro del
presupuesto: ancho ≤ 1536 px, ≤ 900 KB por archivo y ≤ 4.5 MB en total.
Evidencia: salida del listado con `sharp` (archivo, ancho, alto, KB y total) citada en tasks.

### R35
El sistema DEBE usar como arte del hub solo assets que pasaron revisión en hoja de contacto sobre fondo oscuro (sin
cabezas o figuras extra, recorte limpio, sin texto ni iconografía de terceros).
Evidencia: `evidencia/contact_hub_capas.webp`, `evidencia/contact_hub_edificios.webp`,
`evidencia/contact_hub_trabajadores.webp` + confirmación de revisión escrita en tasks.

### R36
El sistema NO DEBE modificar endpoints, servicios, migraciones ni catálogos de economía (`server/`, `shared/`).
Evidencia: `git diff --stat feat/art-direction-b...HEAD -- server shared` vacío (citar).

### R37
CUANDO se cierra la feature, el sistema DEBE pasar las suites completas de server (Jest) y cliente (Vitest) sin
fallos nuevos (solo se tolera el `known_failure` GameHUD Lv5).
Evidencia: `cd server && npx jest --runInBand --forceExit` (`Tests: N passed`) y `cd client && npx vitest run`
(citar totales y el único fallo tolerado).

### R38
DONDE el ajuste de ambiente `kh_ambient_fx` está desactivado (`SettingsPanel`), el sistema NO DEBE crear emisores de
partículas ni postFX en el hub B (la tormenta se reconoce solo por cielo y gradación).
Evidencia: Playwright con `localStorage.kh_ambient_fx = 'false'` → conteo de `ParticleEmitter` en la escena = 0 y
`cameras.main.postFX.list.length === 0` (citar) + screenshot `evidencia/hub_fx_off.webp`.

## Nitidez (resolución de dispositivo)

### R39
MIENTRAS el hub B está activo, el sistema DEBE dimensionar el búfer del canvas a
`round(anchoCSS × s) × round(altoCSS × s)` px de dispositivo.
Evidencia: Vitest de `computeRenderScale` (`0.5→1`, `1→1`, `2→2`, `2.625→2.625`, `3→3`, `4→3`, `undefined→1`) y de
`computeBackingSize` + Playwright: `canvas.width === 824 && canvas.height === 1720` (viewport de referencia) y
`canvas.width === 1236 && canvas.height === 2580` (viewport alto) (citar ambas).

### R40
El sistema DEBE mantener la misma composición en px CSS para cualquier `s` (cada edificio en la misma posición y
tamaño de pantalla).
Evidencia: Playwright con los 17 ids inyectados, en viewport de referencia y viewport alto: para cada sprite de
edificio, bounds en px CSS (`(bounds − cam.worldView) × cam.zoom / s`) iguales entre `s = 2` y `s = 3` con
tolerancia ±1 px CSS (citar la diferencia máxima y la tabla en tasks) + screenshots `evidencia/hub_completo.webp` y
`evidencia/hub_completo_dpr3.webp`.

### R41
CUANDO el jugador hace tap en el centro en px CSS de un edificio dibujado con `s = 2` o `s = 3`, el sistema DEBE
emitir `entity:selected` con el `buildingId` de ese edificio.
Evidencia: Playwright (`hasTouch: true`, `page.touchscreen.tap(x, y)` en px CSS calculados desde los bounds del
sprite, apuntando a un píxel opaco) en viewport de referencia y viewport alto: `barn` y `throne_room` recibidos por un
listener de `entity:selected` (citar los 4 payloads) + tap en el cielo → `entity:deselected` en ambos `s` (citar).

### R42
MIENTRAS el hub B se muestra con `s = 3`, el sistema NO DEBE ampliar ninguna textura de arte del hub (alto de la
fuente ≥ 0.97 × alto en px de dispositivo; el 3 % cubre la respiración ×1.014 y la deriva del cielo).
Evidencia: Playwright en viewport alto con los 17 ids y los 4 tipos de trabajador visibles: tabla `key,
frame.realHeight, displayHeight × cam.zoom, ratio` de cada objeto con textura de arte del hub; mínimo ≥ 0.97 (citar
mínimo; tabla en tasks).

### R43
MIENTRAS el hub B se muestra con `s = 2`, el sistema NO DEBE reducir ninguna textura de arte del hub más de 2.25×
(sin mipmaps, una reducción mayor produce aliasing).
Evidencia: misma tabla de R42 en viewport de referencia; máximo ≤ 2.25 (citar máximo).

### R44
CUANDO el hub B crea un objeto `Text` (texto flotante "+N KH"), el sistema DEBE rasterizarlo con una resolución ≥ el
zoom de la cámara del hub.
Evidencia: Vitest de `textResolutionFor(zoom)` (`0.5→1`, `1→1`, `1.5→1.5`) + Playwright en viewport alto: el `Text`
de R29 tiene `style.resolution ≥ cameras.main.zoom` (citar) + recorte ampliado `evidencia/hub_token_dpr3.webp`.

### R45
MIENTRAS el hub B se muestra en el viewport de referencia, el sistema DEBE dar en la región fija del Granero una
nitidez (varianza del laplaciano en escala de grises) ≥ 1.5 × la de la línea base con `s = 1` (comportamiento
anterior: canvas a px CSS ampliado por el navegador).
Evidencia: `node scripts/hub_b_evidence.js --sharpness`: dos capturas en viewport de referencia con
`kh_ambient_fx = 'false'`, 17 ids y sin tormenta — la línea base con `window.devicePixelRatio` forzado a 1 por
`addInitScript` (el juego arma el canvas a 412×860 y el navegador lo amplía ×2, como antes de esta revisión) y la
normal —; recorte del rectángulo de la ranura `barn` en px de captura; métrica con `sharp`
(`greyscale().convolve(laplaciano 3×3).stats()` → desvío²) para ambas, citadas con su cociente; recortes
`evidencia/nitidez_s1.webp`, `evidencia/nitidez_s2.webp` y `evidencia/nitidez_comparacion.webp` (lado a lado,
ampliados ×3 con vecino más cercano).

### R46
DONDE la entrada es de preview (`?preview=world` o `?iso=1`), el sistema DEBE conservar la configuración de render
actual (`Scale.RESIZE` a px CSS, `pixelArt: true`, escenas `BootScene, WorldScene, IsoScene, IsoWorldScene`).
Evidencia: Vitest de `buildDisplaySettings({ entry: 'preview', … })` + Playwright `?preview=world` en viewport de
referencia: `canvas.width === 412`, `scene.isActive('WorldScene') === true`, 0 `pageerror` (citar) + screenshot
`evidencia/preview_world.webp`.

## Retiro del hub viejo

### R47
El sistema NO DEBE contener código, plomería ni comentarios del hub viejo.
Evidencia: `git grep -nE "hubMode|hub_bastion|zone_hub|buildHubAnchor|buildHubZones|hubZonesBuilt|hubPainterly|hub=legacy"
-- client/src client/public scripts docs/project-spec.md` sin resultados (citar salida vacía y exit code 1).

### R48
El sistema NO DEBE versionar los assets del hub viejo que quedan sin referencias
(`client/public/assets/game/dioramas/hub_bastion.png`, `client/public/assets/game/zones/zone_hub.png`).
Evidencia: antes de borrar, `git grep -n "hub_bastion\|zone_hub"` citado (solo aparecen las referencias que retira
R47); después, `git ls-files client/public/assets/game/dioramas client/public/assets/game/zones` sin esos dos
archivos (citar).

### R49
El sistema DEBE conservar los dioramas de combate `battle_ruins`, `battle_tide` y `boss_arena` que usa
`CombatInstancePanel`.
Evidencia: `git diff --stat feat/art-direction-b...HEAD -- client/public/assets/game/dioramas/battle_ruins.png
client/public/assets/game/dioramas/battle_tide.png client/public/assets/game/dioramas/boss_arena.png
client/src/components/campaign/CombatInstancePanel.jsx` vacío + `GET /assets/game/dioramas/<id>.png` → 200 en Vite
dev para los 3 (citar).

### R50
MIENTRAS la entrada es el hub, el sistema NO DEBE cargar texturas del arte legacy (tilesets, NPCs, animales,
`bld_<id>`, `zone_*`, efectos, ambiente legacy).
Evidencia: Playwright tras `isActive('HubSceneB')`:
`Object.keys(window.__phaserGame.textures.list).filter(k => !k.startsWith('hubb_') && !k.startsWith('__'))` → `[]`
(citar). (No se usa el log de red: el menú y paneles React piden imágenes de `/assets/game/` por su cuenta.)

### R51
CUANDO se cierra la feature, el sistema DEBE compilar el build de producción del cliente sin errores.
Evidencia: `cd client && npx vite build` con exit code 0 (citar la línea `✓ built in …` y el tamaño de los chunks).

## Estética

### R52
El sistema DEBE generar todo el arte del hub con el estilo del spike de combate: preset `grimdark` de
`scripts/gen_art_b.js` y referencias de estilo de `art-b/gr/refs/` (más `art-b/hub/refs/hub_base.webp`, derivada de
ellas).
Evidencia: chequeo con Node sobre `art-b/hub/manifest.json` (ningún ítem con `style` distinto de `grimdark`; cada
`refs` ⊂ `art-b/gr/refs/*` ∪ `{ art-b/hub/refs/hub_base.webp }`; cada `prompt` empieza con el bloque `STYLE MATCH`
de `design.md` §8.2) citado + hoja comparativa `evidencia/contact_hub_vs_spike.webp` (base, 3 edificios y 1
trabajador junto a `client/public/assets/b/bg/combat_crypt.webp` y `client/public/assets/b/heroes/mage_idle.webp`)
con revisión escrita (trazo de grabado, paleta tierra + verde enfermizo, proporciones heroicas, humor negro).
