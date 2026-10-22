# Requirements — `hub_b_tramos_nivel` (feature 5, B1.3)

> Hub idle vivo — cada edificio del hub tiene 3 dibujos según su nivel (tramo `bajo` / `medio` / `alto`) más un dibujo
> propio **en reconstrucción** (`obra`) que se ve mientras se mejora; al mejorarlo el dibujo cambia en la escena sin
> recargar. Continúa `hub_b_escena` (escena, ranuras) y `hub_b_recoleccion`. Es solo piel: el tramo y la obra son
> visuales, no número de juego. Notación EARS estricta (`docs/specs.md`). Cada `R<n>` indica su **Evidencia** según
> `docs/conventions.md` §Verificación.
>
> Glosario:
> - **escena**: `HubSceneB` (`client/src/game/scenes/HubSceneB.js`). **ranura / caja**: `HUB_SLOTS[id]` (`x,y,w,h`, ancla centro-abajo).
> - **nivel**: `level` del registro representativo del edificio (`pickRepresentative`, `hubLayout.js`). **max**: `maxLevel` de `BUILDINGS[id]` en `shared/gameConfig.js`.
> - **tramo**: `bajo`, `medio` o `alto`. **variante**: un tramo u `obra`.
> - **obra**: dibujo del edificio en reconstrucción (andamios, vigas expuestas, lonas, piedra a medio poner, silueta reconocible). Uno por edificio.
> - **textura**: clave Phaser `hubb_bld_<id>` (bajo), `hubb_bld_<id>_medio`, `hubb_bld_<id>_alto`, `hubb_bld_<id>_obra`.
> - **webp de variante**: `client/public/assets/b/buildings/<id>.webp` (bajo, el actual), `<id>_medio.webp`, `<id>_alto.webp`, `<id>_obra.webp`.
> - **puerta de arte**: revisión de **p-kh** sobre hoja de contacto, registrada en `evidencia/aprobacion_arte.md` (como `ui_kit_b` §7).

## Decisiones del owner (ya tomadas; no son preguntas)

- Mientras `is_building` es verdadero (el server lo pone al **iniciar** la mejora, `buildingService.js:175-179`), el edificio muestra su dibujo `obra`. **Reemplaza** el tint gris (`HubSceneB.js:23`, `:225`). Al terminar muestra el tramo del nivel nuevo.
- 3 tramos por edificio calculados desde el `maxLevel` real; la fórmula y tabla son la **única pregunta abierta** (`design.md` §11).
- Un dibujo `obra` por edificio (17), no un andamio genérico superpuesto. Gemini: carta blanca; estimación en `design.md` §7.
- Los 3 tramos y la obra comparten ancla y pie del sprite (no "salta" al cambiar).
- El `<id>.webp` actual se **reutiliza como tramo `bajo`**; hay que generar 51 webp: 17 × `medio`, 17 × `alto`, 17 × `obra`.

## Trazabilidad con el `acceptance` de `feature_list.json` (id 5)

| # | Criterio de aceptación | Requirements |
|---|---|---|
| A1 | 3 sprites por edificio y regla de tramo documentada | R1–R9, R10–R24 |
| A2 | Mejorar un edificio actualiza su sprite sin recargar | R25–R38, R44 |
| — | Sin cambios de servidor/economía y calidad transversal | R39–R43 |

## Regla de tramo

### R1
El sistema DEBE definir tres tramos de aspecto —`bajo`, `medio`, `alto`— para cada uno de los 17 edificios de `BUILDING_IDS`.
Evidencia: Vitest (`hubLayout.test.js`): `TIERS` = `['bajo','medio','alto']` y `buildingTier` devuelve los 3 valores para cada id.

### R2
El sistema DEBE calcular el tramo de un edificio con `buildingTier(buildingId, level)`: `bajo` si `level ≤ round(max/3)`, `medio` si `level ≤ round(2·max/3)`, `alto` en otro caso.
Evidencia: Vitest: tabla exhaustiva de los 17 ids contra los cortes de `design.md` §3 (embassy 1/2/3; max 5 → 1-2/3/4-5; max 8 → 1-3/4-5/6-8; max 10 → 1-3/4-7/8-10; wall 1-5/6-10/11-15).

### R3
SI `level` no es un número finito o es menor que 1 ENTONCES `buildingTier` DEBE devolver `bajo`.
Evidencia: Vitest: `undefined`, `null`, `NaN`, `'x'`, `0`, `-3`.

### R4
SI `level` es mayor que `max` ENTONCES `buildingTier` DEBE devolver `alto`.
Evidencia: Vitest: `max + 1` y `999` para cada id.

### R5
SI `buildingId` no tiene `maxLevel` conocido en `hubLayout.js` ENTONCES `buildingTier` DEBE devolver `bajo`.
Evidencia: Vitest: id desconocido, `undefined`, `null`.

### R6
El sistema DEBE mantener en `hubLayout.js` un espejo `BUILDING_MAX_LEVEL` con el `maxLevel` de los 17 edificios, igual al de `shared/gameConfig.js`.
Evidencia: Vitest (`hubLayout.test.js`): mismas claves que `BUILDINGS` y mismo valor por clave (como el espejo de `HUB_SLOTS`, `hubLayout.test.js:116-137`).

### R7
El sistema DEBE documentar la regla de tramo, su tabla de cortes por `maxLevel`, la variante `obra`, la convención de nombres de archivo/clave y el pipeline de producción en `docs/art-direction/hub-tramos-nivel.md`.
Evidencia: inspección del archivo (tabla de 17 ids con sus cortes coincide con R2).

### R8
El sistema DEBE actualizar la tabla "Dónde vive cada imagen" de `docs/art-direction/guia-manual-arte.md` con los webp de tramo y de obra y la clave que los carga.
Evidencia: `git diff` de `docs/art-direction/guia-manual-arte.md` con la fila nueva.

### R9
El tramo NO DEBE depender de `is_building` ni de otro dato distinto de `building_id` y `level`.
Evidencia: Vitest: la firma de `buildingTier` solo recibe id y nivel; `selectHubBuildings` con el mismo `level` y `is_building` 0/1 da el mismo `tier`.

## Arte

### R10
El sistema DEBE generar los 51 webp nuevos (17 `medio`, 17 `alto`, 17 `obra`) desde un manifest propio `art-b/tramos/manifest.json`, con `art-b/tramos/process.sh` y `/art-b/tramos/raw/` en `.gitignore`.
Evidencia: archivos creados; `git check-ignore art-b/tramos/raw/x.png` devuelve la ruta.

### R11
El sistema DEBE entregar 4 webp por edificio en `client/public/assets/b/buildings/`: `<id>.webp`, `<id>_medio.webp`, `<id>_alto.webp` y `<id>_obra.webp`, 68 en total.
Evidencia: `ls client/public/assets/b/buildings | wc -l` = 68 y `evidencia/tramos_assets.txt` sin faltantes.

### R12
El sistema NO DEBE modificar los 17 `<id>.webp` existentes.
Evidencia: `git diff --stat 2f048a1 -- client/public/assets/b/buildings/` sin líneas de los 17 nombres base.

### R13
Cada webp nuevo DEBE tener fondo transparente real: las 4 esquinas con alpha 0 y borde exterior de 1 px 100 % transparente.
Evidencia: `scripts/verify_tiers_b.js` → `evidencia/tramos_assets.txt` (51/51 OK).

### R14
Cada webp nuevo DEBE tener su pie apoyado en el borde inferior del lienzo (alguna fila del último 2 % de alto con alpha > 8) para que el pie caiga en `slot.y` en todas las variantes.
Evidencia: `scripts/verify_tiers_b.js` → `evidencia/tramos_assets.txt` y hoja de contacto con línea de base.

### R15
La relación de aspecto (ancho/alto) de cada webp nuevo DEBE estar dentro de ±15 % de la de su `<id>.webp`, porque la caja de la ranura se derivó del aspecto del bajo.
Evidencia: `scripts/verify_tiers_b.js` → columna `ratio`.

### R16
El centro horizontal del contenido opaco (alpha > 8) de cada webp nuevo DEBE quedar a ≤ 6 % del ancho respecto del centro horizontal del contenido de su `<id>.webp`, para que el sprite no salte lateralmente al cambiar de variante.
Evidencia: `scripts/verify_tiers_b.js` → columna `dcx` en `evidencia/tramos_assets.txt` (51/51 ≤ 6 %).

### R17
El peso de cada webp nuevo NO DEBE superar 150 KB, y el total de los 51 NO DEBE superar 2,2 MB.
Evidencia: `evidencia/tramos_assets.txt` (suma) y `ls -l`.

### R18
Cada webp `medio` y `alto` DEBE ser reconocible como el mismo edificio que su `bajo` (misma huella y silueta general) y distinguible de él a 412 px de ancho; cada `obra` DEBE mostrar andamios, vigas expuestas, lonas y piedra a medio poner con la silueta del edificio reconocible.
Evidencia: hoja de contacto `evidencia/tramos_contacto.webp` (17 filas × 4 columnas: bajo, medio, alto, obra; fondo `#1a1512`) y veredicto de p-kh en `evidencia/aprobacion_arte.md`.

### R19
Cada webp nuevo NO DEBE contener texto, marcos, nombres ni símbolos de terceros, ni paleta ajena a la dirección B (`docs/art-direction-b.md` §1).
Evidencia: revisión de p-kh sobre la hoja de contacto (`aprobacion_arte.md`).

### R20
La ranura de `throne_room` (brasero, `HUB_SLOTS.throne_room.fire`) y las de `tavern` y `smithy` (humo, `smoke`) DEBEN conservar su punto en los 3 tramos: el brasero o la chimenea del dibujo cae a ≤ 20 px lógicos del offset de la ranura.
Evidencia: hoja `evidencia/tramos_anclas.webp` con cruces en `fire`/`smoke` sobre los 3 tramos de esos 3 edificios y veredicto de p-kh.

### R21
El sistema DEBE generar primero una prueba de 3 imágenes (`medio`, `alto` y `obra` de un solo edificio) y pararse hasta tener el veredicto de p-kh sobre esa prueba antes de generar las 48 restantes.
Evidencia: `evidencia/tramos_prueba.webp` y la sección "Prueba" de `evidencia/aprobacion_arte.md` con veredicto antes de la tanda.

### R22
El sistema NO DEBE integrar ningún webp nuevo (ni agregarlo a `HUB_TEXTURES`) hasta que `evidencia/aprobacion_arte.md` tenga veredicto `APROBADO` de p-kh sobre la hoja de contacto completa.
Evidencia: `aprobacion_arte.md` con fecha anterior al commit que cambia `HUB_TEXTURES`.

### R23
SI p-kh rechaza una variante ENTONCES el sistema DEBE regenerar solo las rechazadas y repetir la revisión de esas celdas, sin sustituirlas por otro dibujo ni por el de otra variante.
Evidencia: `aprobacion_arte.md` con la lista de rechazados y su segunda revisión.

### R24
El sistema DEBE tener la regla de tramo, el nombre de archivo y la clave de cada webp en `docs/art-direction/hub-tramos-nivel.md` coherentes con `HUB_TEXTURES`.
Evidencia: Vitest: cada fila de `HUB_TEXTURES` de edificios tiene su `<id>[_variante].webp` listado en la tabla del documento (lectura del `.md` en el test).

## Escena

### R25
El sistema DEBE tener en `HUB_TEXTURES` 4 entradas por edificio —`hubb_bld_<id>`, `hubb_bld_<id>_medio`, `hubb_bld_<id>_alto`, `hubb_bld_<id>_obra`—, 80 entradas en total (4 + 68 + 8), con claves únicas y urls que cumplen `/^\/assets\/b\/(hub|buildings|workers)\/[a-z_]+\.webp$/`.
Evidencia: Vitest (`hubLayout.test.js`, test de `HUB_TEXTURES` actualizado).

### R26
`selectHubBuildings` DEBE incluir en cada elemento `tier` (`bajo`|`medio`|`alto`, de `buildingTier(buildingId, record.level)`) y `variant` (`obra` si el estado es `construction`, si no el `tier`).
Evidencia: Vitest: STARTER (nivel 1, construidos → `bajo`/`bajo`), `barn` nivel 4 → `medio`, nivel 8 → `alto`, `barn` nivel 4 con `is_building` 1 → `tier` `medio` y `variant` `obra`.

### R27
CUANDO la escena crea el sprite de un edificio, la escena DEBE usar la textura de su `variant`.
Evidencia: Playwright 412×860 @2x: `barn` nivel 1 construido → `hubb_bld_barn`; nivel 4 → `hubb_bld_barn_medio`; `is_building` → `hubb_bld_barn_obra`.

### R28
CUANDO la `variant` de un edificio cambia entre dos `syncBuildings`, la escena DEBE reemplazar la textura del sprite existente por la de la variante nueva, sin destruirlo, recrearlo ni recargar la página.
Evidencia: Playwright: tras `upgradeBuilding` el sprite es el mismo objeto (`bldSprites.get(id).sprite` idéntico), su clave de textura cambió a `_obra` y luego al tramo; el contador de `load`/navegaciones no cambió.

### R29
CUANDO la textura de un sprite de edificio cambia, la escena DEBE recalcular la escala como `min(slot.w/ancho, slot.h/alto)` con las dimensiones de la textura nueva y guardarla en `baseScale`.
Evidencia: Playwright: `displayWidth ≤ slot.w` y `displayHeight ≤ slot.h` tras el cambio, y `getData('baseScale')` igual a la escala.

### R30
CUANDO la textura de un sprite de edificio cambia, la escena DEBE recrear su área interactiva `pixelPerfect` para que el toque siga el dibujo nuevo.
Evidencia: Playwright: tap en un píxel opaco de la variante nueva que era transparente en la anterior emite `entity:selected`.

### R31
CUANDO la textura de un sprite de edificio cambia, la escena DEBE detener los tweens de ese sprite y fijar su escala en `baseScale`.
Evidencia: Playwright: tap y mejora a < 120 ms; `scale` final igual a `baseScale`, sin residuo del rebote.

### R32
MIENTRAS la `variant` de un edificio no cambia entre dos `syncBuildings`, la escena NO DEBE reemplazar su textura ni recrear su área interactiva.
Evidencia: Vitest con doble de sprite: N `syncBuildings` con la misma variante → 0 `setTexture` y 0 `setInteractive` tras el primero.

### R33
MIENTRAS un edificio está en construcción, la escena DEBE mostrar su textura `obra` sin tint ni opacidad reducida, y NO DEBE usar el tint `0x8a8478` ni `alpha 0,75`.
Evidencia: Playwright: sprite en construcción con `isTinted` falso y `alpha` 1; `grep CONSTRUCTION_TINT client/src/game/scenes/HubSceneB.js` sin resultados.

### R34
CUANDO termina la construcción (`is_building` pasa a falso), la escena DEBE mostrar la textura del tramo calculado con el `level` nuevo y reponer el trabajador y el humo del edificio como hoy.
Evidencia: Playwright: tras recibir `is_building = 0` la textura es `hubb_bld_<id>[_tramo]`, y el trabajador y el humo vuelven a existir.

### R35
SI falta la textura de una variante (carga fallida o ausente) ENTONCES la escena DEBE usar la del tramo inmediato inferior —para `obra`, la del tramo `bajo`— y si tampoco está, `hubb_placeholder`, sin lanzar excepción.
Evidencia: Vitest de `variantTextureCandidates` (`alto → medio → bajo`, `obra → bajo`) y Playwright con `*_alto.webp` bloqueado (muestra el `medio`) y con todas bloqueadas (placeholder), 0 `pageerror`.

### R36
El fantasma de colocación (`startPlacement`) DEBE usar la textura del tramo `bajo` (`hubb_bld_<id>`).
Evidencia: Playwright: `building:startPlacement {buildingId:'tower'}` → el fantasma usa `hubb_bld_tower`.

### R37
CUANDO llega el evento de socket `building_complete`, el cliente DEBE recargar los edificios con `loadBuildings()` y conservar el aviso `game:notification` actual.
Evidencia: Vitest (como `pickupSources.test.jsx`, describe `socketService`): el handler llama `loadBuildings` y emite el aviso.

### R38
CUANDO el jugador inicia una mejora o construcción, el hub DEBE pasar a `obra` sin recargar, y CUANDO la construcción termina, a su tramo sin recargar.
Evidencia: Playwright: capturas `evidencia/obra_antes.webp`, `obra_durante.webp`, `obra_despues.webp` de la misma sesión, `POST /api/buildings/upgrade` único y sin navegación; el fin se simula devolviendo `is_building = 0` en la recarga que dispara `building_complete`.

## Calidad transversal

### R39
El sistema NO DEBE modificar `server/` ni `shared/`, y NO DEBE crear eventos nuevos en `EventBridge`.
Evidencia: `git diff --stat 2f048a1...HEAD -- server shared` vacío; `git diff 2f048a1...HEAD -- client | grep -c "^+.*EventBridge.emit("` = 0.

### R40
El sistema DEBE mantener ≥ 50 fps en el harness de `hub_b_escena` con los 17 edificios en tramo `alto` visibles.
Evidencia: `evidencia/fps_tramos.json` (avg y min ≥ 50, 412×860 @2x, 20 s, 0 `pageerror`).

### R41
El sistema NO DEBE producir errores de consola ni respuestas HTTP ≥ 400 al cargar el hub con los 68 webp.
Evidencia: `evidencia/consola.txt` (0 `pageerror`, 0 `console.error`, 0 http ≥ 400).

### R42
El sistema DEBE tener capturas Playwright 412×860 @2x del hub con los 17 edificios en cada uno de los 3 tramos y con los 17 en `obra`.
Evidencia: `evidencia/hub_tramo_bajo.webp`, `hub_tramo_medio.webp`, `hub_tramo_alto.webp`, `hub_obra.webp`.

### R43
El sistema DEBE terminar con `cd client && npx vitest run` sin fallos nuevos (solo `known_failures`).
Evidencia: salida citando `Tests N passed` en `tasks.md`.

### R44
CUANDO el jugador mejora un edificio de modo que su nivel cruza un corte, el hub DEBE mostrar el dibujo del tramo nuevo al terminar la obra sin recargar la página.
Evidencia: Playwright: `evidencia/mejora_antes.webp` (tramo viejo) y `mejora_despues.webp` (tramo nuevo) de la misma sesión, sin navegación.
