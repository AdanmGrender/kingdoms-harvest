# Requirements — `hub_b_escena` (feature 3, B1.1)

> Hub idle vivo — escena base ilustrada. Notación EARS estricta (`docs/specs.md`).
> Cada `R<n>` indica su **Evidencia** según `docs/conventions.md` §Verificación.
> Glosario de este documento:
> - **hub B**: la escena Phaser nueva `HubSceneB` (ver `design.md`).
> - **espacio lógico**: lienzo de composición de 824×1720 (= 412×860 @2x, igual que `spikes/001-combat-b`).
> - **ranura**: posición fija `{ x, y, w, h }` de un `building_id` en el espacio lógico.
> - **registro**: elemento de `gameStore.buildings` (`building_id`, `level`, `is_building`, `position_x`, `position_y`, `id`).
> - **edificio productor**: `building_id` cuyo catálogo `BUILDINGS` de `shared/gameConfig.js` tiene `produces`
>   (hoy: `farm_plot`, `mill`, `sawmill`, `smithy`, `mine`, `tavern`, `market`).
> - **tormenta activa**: `gameStore.activeStorm` no nulo (catálogo `WARP_STORMS`: `velo_estatico`, `marea_carmesi`,
>   `lluvia_de_energia`, `susurros_del_vacio`, `calma_falsa`).
> - **viewport de referencia**: Playwright 412×860, `deviceScaleFactor: 2`, Chromium headless con
>   `--use-angle=d3d11 --enable-gpu`.

## Trazabilidad con el `acceptance` de `feature_list.json` (id 3)

| # | Criterio de aceptación | Requirements |
|---|---|---|
| A1 | Al entrar al Bastión se ve la escena B en lugar del diorama viejo, encuadrada para 412×860 sin recortes raros | R1, R2, R3, R4, R5, R6, R7, R34, R35 |
| A2 | Cada edificio construido aparece en su ranura con su sprite B; los no construidos no aparecen | R8, R9, R10, R11, R12, R13, R14 |
| A3 | Los productores muestran trabajador o efecto animado sin input (respiración/loop, humo) | R15, R16, R17 |
| A4 | Con tormenta activa el cielo/ambiente cambia de forma reconocible; sin tormenta, cielo normal | R18, R19, R20, R21 |
| A5 | Tocar un edificio abre la misma información/acción que hoy (no se pierde funcionalidad) | R22, R23, R24, R25, R26, R27, R28, R29 |
| A6 | Sin cambios de economía ni API; suites sin regresiones; consola sin errores; ≥ 50 fps headless con GPU | R30, R31, R32, R33, R36, R37, R38 |

---

## Escena y encuadre

### R1
CUANDO se monta `BastionHub` (Phaser con `hubMode`) y la URL no contiene `hub=legacy`, el sistema DEBE arrancar la
escena `HubSceneB` en lugar de `WorldScene`.
Evidencia: Vitest de `resolveStartScene` en `client/src/tests/hubLayout.test.js` + Playwright en viewport de
referencia: `window.__phaserGame.scene.isActive('HubSceneB') === true` y `isActive('WorldScene') === false` (citar
salida) + screenshot `evidencia/hub_inicial.webp`.

### R2
DONDE la URL contiene `?hub=legacy`, el sistema DEBE arrancar `WorldScene` en modo hub con el comportamiento actual.
Evidencia: Vitest de `resolveStartScene` + screenshot `evidencia/hub_legacy.webp`.

### R3
El sistema DEBE componer el hub B en el espacio lógico de 824×1720 con este orden de profundidad, de atrás hacia
adelante: cielo, base (colina y muralla), edificios y trabajadores, niebla, primer plano, partículas, gradación de
tormenta.
Evidencia: Vitest sobre la constante `HUB_DEPTHS` (orden estrictamente creciente) + screenshot
`evidencia/hub_completo.webp` con una línea de qué capas se ven.

### R4
MIENTRAS el hub B está activo en el viewport de referencia, el sistema DEBE cubrir todo el canvas con la composición
a escala uniforme (sin bandas vacías ni deformación).
Evidencia: Vitest de `computeHubViewport(412, 860)` (zoom uniforme 0.5, sin bandas) + screenshot
`evidencia/hub_completo.webp`.

### R5
El sistema DEBE ubicar el canvas del hub ocupando el viewport completo detrás del chrome React (barra superior,
riel, botonera inferior y barras laterales flotan encima).
Evidencia: Playwright: `document.querySelector('#phaser-container canvas').getBoundingClientRect()` igual a
`{ x: 0, y: 0, width: 412, height: 860 }` (citar salida) + screenshot `evidencia/hub_inicial.webp`.

### R6
CUANDO el canvas cambia de tamaño, el sistema DEBE recalcular zoom y centrado del hub B con la misma regla de
cobertura de R4.
Evidencia: Vitest de `computeHubViewport` para 412×860, 360×780 y 768×1024 + screenshot
`evidencia/hub_resize_360x780.webp` (viewport cambiado en caliente con `page.setViewportSize`).

### R7
El sistema DEBE dibujar las texturas del hub B con filtrado lineal aunque la configuración global de Phaser use
`pixelArt: true`.
Evidencia: Playwright: para cada textura `hubb_*` cargada, el modo de filtro de su `TextureSource`
(`window.__phaserGame.textures.get(key).source[0].scaleMode` en Phaser 3.90) es `Phaser.Textures.FilterMode.LINEAR`
(0) (citar salida).

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
tabla de `design.md` §5, distinto del calmo y distinto del de las otras cuatro tormentas.
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
CUANDO el jugador hace tap (≤ 500 ms y ≤ 12 px de desplazamiento) sobre un píxel opaco del sprite de un edificio
dibujado y no hay overlay abierto, el sistema DEBE emitir por `EventBridge` `entity:selected` con
`{ type: 'building', data: { buildingId, posX, level, isBuilding } }` del registro representado.
Evidencia: Vitest de `isTap` y `buildSelectionPayload` + Playwright: tap sobre el Granero → screenshot
`evidencia/hub_tap_edificio.webp` con `BuildingInfoPanel` abierto (mismo panel que abre `OverlayManager` hoy).

### R23
MIENTRAS `gameStore.overlayState` no es nulo, el sistema NO DEBE emitir `entity:selected` desde el hub B.
Evidencia: Vitest de `shouldAcceptTap`.

### R24
CUANDO el jugador hace tap sobre el hub B fuera de cualquier edificio y no hay overlay abierto, el sistema DEBE
emitir `entity:deselected`, igual que hoy `SelectionSystem`.
Evidencia: Vitest de `shouldAcceptTap` + inspección documentada del handler en `HubSceneB.js` (citar líneas).

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
"+N KH" como hoy (`ParticleSystem.emitTokenGain`).
Evidencia: Playwright: `EB.emit('token:earned', { amount: 5 })` vía import dinámico → screenshot
`evidencia/hub_token.webp`.

## Robustez, rendimiento y no regresión

### R30
SI una textura del hub B falla al cargar ENTONCES el sistema DEBE dibujar un placeholder en su lugar y seguir
funcionando sin excepción.
Evidencia: Playwright con `page.route` abortando `**/assets/b/buildings/barn.webp` y `**/assets/b/hub/sky_calm.webp`
→ screenshot
`evidencia/hub_fallback.webp` y cero `pageerror` (los `console.error` de red de las URLs bloqueadas se citan y se
excluyen explícitamente).

### R31
SI `gameStore.buildings` contiene un `building_id` fuera del catálogo o un valor no-array ENTONCES el sistema DEBE
ignorarlo sin lanzar error.
Evidencia: Vitest de `selectHubBuildings` con entradas inválidas (`undefined`, `null`, id desconocido).

### R32
MIENTRAS el hub B carga y queda 30 s en reposo (sin bloqueos intencionales de red), el sistema NO DEBE producir
mensajes `console.error` ni `pageerror`.
Evidencia: log de consola capturado por Playwright (citar conteo 0) en la corrida de `scripts/hub_b_evidence.js`.

### R33
MIENTRAS el hub B muestra los 17 edificios y la tormenta `lluvia_de_energia` en el viewport de referencia, el
sistema DEBE sostener ≥ 50 fps de promedio durante 20 s.
Evidencia: muestras de `window.__phaserGame.loop.actualFps` cada 1 s + contador de `requestAnimationFrame`
(promedio y mínimo citados) en `evidencia/fps.json`.

### R34
El sistema DEBE servir todos los assets nuevos del hub como `.webp` bajo `client/public/assets/b/` con un ancho
máximo de 1080 px.
Evidencia: salida del listado con `sharp` (archivo, ancho, alto, KB) citada en tasks.

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
