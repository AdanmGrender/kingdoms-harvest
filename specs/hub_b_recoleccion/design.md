# Design — `hub_b_recoleccion` (feature 4, B1.2)

> Cómo se construye. Requirements en `requirements.md` (R1–R33). Base: `specs/hub_b_escena/` (escena, ranuras, input).
> Capas y reglas: `docs/architecture.md`. Evidencia: `docs/conventions.md` §Verificación. Contrato visual:
> `docs/art-direction-b.md` §3/B1 ("Recolección en escena: tap al objeto → vuela al contador"; "la escena **lee**
> producción/tope/listo-para-recoger de los endpoints actuales").

## 0. Alcance

**Entra:** objetos ilustrados en `HubSceneB` para lo que el server ya expone como "listo para recoger" (parcelas
listas y animales listos), tap → acción del store existente → endpoint existente, vuelo al contador, 4 ilustraciones
nuevas con placeholder de respaldo, recarga por socket, atributo `data-resource` en `TopResourceBar`.

**No entra:**

| Fuera de alcance | Motivo / dónde va |
|---|---|
| Objetos de leña, lingotes, bolsa de coronas (aserradero, mina, herrería, mercado, molino, taberna) | Su producción se acredita sola a `player_resources` en `gameTick` §2b; no existe estado "listo" ni endpoint `collect`. Agregarlo es un cambio de economía (R26). Feature futura (§10) |
| Cambios en `server/` y `shared/` | R26 |
| Cantidad/calidad sobre el objeto ("+4") | La cantidad la decide el server al recoger (azar, calidad, bonos); mostrarla antes sería calcular en el cliente (R27). El número real ya sale en la notificación del store |
| Reporte offline del Escribano | feature 6 `reporte_escribano` |
| Sprites por tramo de nivel | feature 5 `hub_b_tramos_nivel` |

## 1. Estado actual (verificado en el código)

- **Server (no se toca).** `POST /api/farm/harvest {plotId}` (`farmRoutes.js` → `farmService.harvestCrop`): exige
  `farm_plots.state === 'ready'`, calcula cantidad/calidad/XP/KH y devuelve `{ quantity, tokensAwarded, message, … }`.
  `POST /api/farm/animals/collect {animalId}` (`farmService.collectAnimalProduct`): exige `is_fed` y
  `next_production_at <= now`; responde `{ product, quantity, message, … }` o 400 `"El animal todavía no produjo"`.
  `gameTick` pasa las parcelas `growing → ready` y emite `crop_ready {count}`; para animales emite `animal_ready
  {animalType}` (con `notified_at`).
- **Producción de edificios.** `gameTick` §2b suma a `player_resources` cada minuto (tope `capacity`). No hay "listo
  para recoger": por eso no entra (§0).
- **Store (`client/src/store/gameStore.js`).** `plots`/`animals` (cargados por `loadPlots`/`loadAnimals` en
  `initGame` y tras cada acción). `harvestCrop(plotId)` hace el `POST`, notifica, emite `token:earned`, recarga
  parcelas y llama `refreshResources()`; **rechaza** si falla (después de notificar el error).
  `collectAnimalProduct(animalId)` hace el `POST`, notifica, `loadAnimals()`, `refreshResources()`; hoy **traga** el
  error y **no devuelve nada**. Ambos los usa `OverlayManager.jsx` (panel de granja) y siguen funcionando igual.
- **Socket (`socketService.js`).** `crop_ready` y `animal_ready` solo emiten `game:notification`; no recargan estado
  → hoy el panel de granja se entera al abrirse. Para que el objeto aparezca solo hay que recargar.
- **Escena (`HubSceneB.js`).** Ranuras `HUB_SLOTS`, `bldSprites` (Map `buildingId → { sprite, state, … }`),
  `setupInput` con `pointerup` que busca `o.getData('buildingId')` entre los objetos bajo el puntero y emite
  `entity:selected`; `tex()/hasTex()` con placeholder `hubb_placeholder`; `teardown()` desuscribe solo lo propio.
  Cámara fija con zoom `cover`; `renderScale` = DPR (px de dispositivo = px CSS × s).
- **Chrome.** `TopResourceBar.jsx` pinta `MAIN_RESOURCES` (clave `r.key`) sin atributo identificable en el DOM.
- **Arte.** `client/public/assets/b/` tiene `bg`, `buildings`, `enemies`, `heroes`, `hub`, `ui`, `workers`.
  **No existe** `pickups/` ni ningún ícono de objeto de recolección (`art-direction-b.md` prevé "~8 íconos-objeto").

## 2. Decisiones y alternativas descartadas

### 2.1 Qué es "recolectable"

**Decisión:** solo lo que hoy tiene acción de recolección en el server: parcelas listas y animales listos
(R1, R2, R24). Anfitriones: `farm_plot` y `stable`.

**Descartada — objetos "decorativos" para leña/lingotes/coronas** (mostrar un saco aunque el tap no recoja nada, o que
abra el panel del edificio): engaña al jugador (un objeto que parece cobrable y no lo es) e incumple "tocarlo lo recoge".
**Descartada — agregar acumulación + `POST /buildings/:id/collect`** para esos productores: es exactamente el cambio de
economía que el acceptance prohíbe y requiere migración, tests de server y rebalanceo del tope. Queda documentada como
feature futura (§10) y como punto a confirmar por el owner en la puerta de aprobación.

### 2.2 Cuántos íconos

**Decisión:** 4 ilustraciones: `sack` (cualquier cosecha), `egg_basket`, `milk_pail`, `wool_bale`. El jugador distingue
el cultivo concreto en el contador y la notificación; el saco de cosecha es genérico.
**Descartada — 1 ilustración por cultivo (7) + 3 de producto = 10:** supera las ~8 previstas por
`art-direction-b.md`, cuesta 6 generaciones más y los cultivos se parecen una vez ensacados.

### 2.3 Dónde viven los objetos

**Decisión:** sprites Phaser dentro de `HubSceneB` (misma cámara, profundidad entre edificio y niebla, tap con la
misma entrada de input que los edificios).
**Descartada — botones DOM sobre el canvas:** hay que reproyectar coordenadas lógicas→CSS en cada resize/viewport, no
heredan niebla/tormenta/profundidad y duplican el hit-testing.

### 2.4 Destino del vuelo

**Decisión:** el contador es DOM (`TopResourceBar`), la escena es Phaser. Se marca el contador con
`data-resource="<clave>"` y la escena lee su `getBoundingClientRect()` en el momento del vuelo, convirtiéndolo con la
función pura `cssToWorld` (usa `canvas.getBoundingClientRect()`, `renderScale` y `cam.worldView/zoom`). Si el contador
no está en el DOM (p. ej. zanahoria, huevo: `MAIN_RESOURCES` no los lista) vuela al borde superior centrado de la zona
visible (R21).
**Descartada — evento nuevo `pickup:collected` React↔Phaser** con un componente que mida el contador: añade un evento a
`project-spec.md` §9.2 (R28) y un componente solo para devolver un punto. **Descartada — destino fijo hardcodeado:**
se desalinea con el chrome real y con cualquier cambio de la barra.

### 2.5 Cómo se entera la escena de que algo está listo

**Decisión:** suscripción al store (`plots`, `animals`, `buildings`) + un `time.addEvent` de 5 s para reevaluar
`next_production_at` (R6) + recarga por socket (R7, R8). El "listo" de parcelas es `state === 'ready'` (lo fija el
server); el de animales es `is_fed && next_production_at <= now` (campos del server; el cliente solo compara una hora,
no calcula producción — si el reloj del cliente adelanta, el server rechaza y R23 restaura el objeto).
**Descartada — polling HTTP periódico:** el socket ya avisa y `loadPlots/loadAnimals` se ejecutan en cada acción.
**Descartada — `ready_at` para parcelas:** el estado `ready` lo escribe el tick; usar `ready_at` en cliente haría
aparecer objetos que el server aún rechaza (la parcela sigue `growing` hasta el siguiente tick).

### 2.6 Testabilidad

`HubSceneB` no tiene tests de escena (Phaser no corre en jsdom). **Decisión:** toda la lógica con ramas (qué objetos
existen, claves, posiciones, anti doble-tap, éxito/fallo, dispose) vive en `hubPickups.js`, módulo puro sin Phaser, con
`createPickupController` que recibe dependencias inyectadas. La escena queda como adaptador fino verificado con
Playwright. **Descartada — lógica dentro de la escena:** solo verificable con capturas.

## 3. Archivos

| Archivo | Cambio |
|---|---|
| `client/src/game/hub/hubPickups.js` | **Nuevo.** Constantes, `selectPickups`, `pickupPosition`, `pickupHitSize`, `cssToWorld`, `createPickupController`, `PICKUP_TEXTURES` |
| `client/src/game/scenes/HubSceneB.js` | Preload de `PICKUP_TEXTURES`; textura `hubb_pickup_placeholder`; `syncPickups`, `createPickup`, `destroyPickup`, `flyPickup`, `counterTarget`; prioridad del objeto en `pointerup`; temporizador y teardown |
| `client/src/store/gameStore.js` | `collectAnimalProduct` devuelve `data` en éxito y `null` en fallo (hoy `undefined`) |
| `client/src/services/socketService.js` | `crop_ready` → `loadPlots()`; `animal_ready` → `loadAnimals()` (además del toast actual) |
| `client/src/components/hud/TopResourceBar.jsx` | `data-resource={r.key}` en el contenedor de cada recurso |
| `client/src/tests/hubPickups.test.js` | **Nuevo.** Vitest del módulo puro |
| `client/src/tests/gameStore.test.js` | Casos de `collectAnimalProduct` (éxito → `data`, fallo → `null`) |
| `art-b/pickups/manifest.json`, `art-b/pickups/process.sh` | **Nuevos.** Pipeline de arte (§6) |
| `client/public/assets/b/pickups/{sack,egg_basket,milk_pail,wool_bale}.webp` | **Nuevos.** Salida del pipeline |
| `specs/hub_b_recoleccion/evidencia/` | Capturas, hoja de contacto, `fps_recoleccion.json`, log de consola |
| `.gitignore` | `/art-b/pickups/raw/` (como `/art-b/hub/raw/`) |

No se tocan: `server/**`, `shared/**`, `hubLayout.js`, `docs/project-spec.md` §9.2 (R26, R28).

## 4. Módulo puro `client/src/game/hub/hubPickups.js`

Sin `phaser`, sin store, sin DOM. Estilo JS ESM, 2 espacios, comillas simples.

```js
export const PICKUP_HOSTS = { crop: 'farm_plot', animal: 'stable' };
export const MAX_PICKUPS_PER_BUILDING = 3;
export const PICKUP_REFRESH_MS = 5000;
export const PICKUP_H = 84;          // alto mostrado, px lógicos (≈ 42 px CSS)
export const PICKUP_STEP = 70;       // separación horizontal entre objetos de un mismo anfitrión
export const PICKUP_BOB = 5;         // amplitud del balanceo, px lógicos (R11: ≤ 6)
export const PICKUP_MIN_HIT = 88;    // 44 px CSS × (824 / 412) (R18)
export const PICKUP_FLY_MS = 600;    // R20: ≤ 700

// producto de animal por animal_id (espejo de ANIMALS[id].product en shared/gameConfig.js; lo verifica el test)
export const ANIMAL_PRODUCT = { chicken: 'egg', cow: 'milk', sheep: 'wool' };
export const PICKUP_ICONS = { crop: 'sack', egg: 'egg_basket', milk: 'milk_pail', wool: 'wool_bale' };
export const PICKUP_TEXTURES = Object.values(PICKUP_ICONS)
  .map((id) => ({ key: `hubb_pk_${id}`, url: `/assets/b/pickups/${id}.webp` }));
export const PICKUP_ANCHORS = { farm_plot: { dx: 0, dy: -6 }, stable: { dx: 0, dy: -6 } };
```

### 4.1 `selectPickups({ plots, animals, builtIds, now }) → Pickup[]`

```
Pickup = { key, type: 'crop'|'animal', host, id, icon, resourceKey }
```

- Parcelas: `plot.state === 'ready'` y `builtIds.has('farm_plot')` → `{ key: 'plot:<id>', type: 'crop', host: 'farm_plot',
  id: plot.id, icon: 'sack', resourceKey: plot.crop_id }`.
- Animales: `animal.is_fed` y `Date.parse(next_production_at) <= now` y `builtIds.has('stable')` →
  `{ key: 'animal:<id>', type: 'animal', host: 'stable', id: animal.id, icon: PICKUP_ICONS[ANIMAL_PRODUCT[animal_id]],
  resourceKey: ANIMAL_PRODUCT[animal_id] }`. `animal_id` desconocido o `next_production_at` ausente/ inválido ⇒ se omite.
- Orden por `id` ascendente dentro de cada anfitrión y recorte a `MAX_PICKUPS_PER_BUILDING` (R4).
- `builtIds`: `Set` de `building_id` presentes y no en construcción en la escena (la escena lo arma desde `bldSprites`
  con `entry.state !== 'construction'`).
- Edificios productores automáticos nunca aparecen como `host` (R24).

### 4.2 `pickupPosition(slot, host, index, count) → { x, y }`

Fila centrada sobre la ranura: `x = slot.x + anchor.dx + (index − (count − 1) / 2) × PICKUP_STEP`,
`y = slot.y + anchor.dy` (origen del sprite: centro-abajo, delante del pie del edificio). Test: para las 2 ranuras y
`count` ∈ 1..3 el punto y el sprite (ancho ≤ `PICKUP_H`) quedan dentro de `SAFE_LEFT..SAFE_RIGHT` /
`SAFE_TOP..SAFE_BOTTOM` (R10). Con `farm_plot` (x 250, y 1390) y `stable` (x 525, y 1280) cumple; `y 1384 ≤ SAFE_BOTTOM`.

### 4.3 `pickupHitSize(displayW, displayH) → { w, h }`

`max(displayW, PICKUP_MIN_HIT)` × `max(displayH, PICKUP_MIN_HIT)` (R18). La escena la usa para
`setInteractive(new Phaser.Geom.Rectangle(...), Phaser.Geom.Rectangle.Contains)` centrado en el sprite, convirtiendo a
coordenadas locales de la textura dividiendo por la escala. Sin `pixelPerfect` (el objeto es pequeño).

### 4.4 `cssToWorld({ cssX, cssY }, { canvasRect, renderScale, worldView, zoom }) → { x, y }`

`gx = (cssX − canvasRect.left) × renderScale`, `gy = (cssY − canvasRect.top) × renderScale` (px de juego);
`x = worldView.x + gx / zoom`, `y = worldView.y + gy / zoom`. Fallback del destino (R21): `{ x: HUB_W / 2,
y: worldView.y + 24 }`. Se prueba con el punto del contador a DPR 1, 2 y 3.

### 4.5 `createPickupController(deps)`

```js
createPickupController({
  getSnapshot,        // () => ({ plots, animals, builtIds, now })
  actions,            // { harvestCrop(id), collectAnimalProduct(id) }  (store)
  onAdd, onRemove,    // (pickup) => void   — la escena crea/destruye el sprite
  onBusy,             // (pickup, busy:boolean) => void — atenúa el sprite mientras vuela la petición
  onCollected,        // (pickup) => void   — la escena anima el vuelo y destruye el sprite
})  → { sync(), tap(key), dispose(), has(key) }
```

- `sync()`: `selectPickups(getSnapshot())`, diff por `key` contra el conjunto actual → `onAdd`/`onRemove` (R5). No
  llama a nada si `disposed`.
- `tap(key)` (R15–R17, R19, R23): ignora si no existe, si `disposed` o si `busy.has(key)`; marca `busy`, `onBusy(p,
  true)`; `await` la acción según `type`; si resuelve con éxito (`harvestCrop` → objeto de datos; `collectAnimalProduct`
  → `data` no nulo) y no `disposed` → `onCollected(p)`; si rechaza o devuelve `null` → `onBusy(p, false)`; siempre quita
  `busy`. Después de éxito la recarga del store (`loadPlots`/`loadAnimals`) hace que `sync()` ya no lo incluya.
  Reentrada: un segundo `tap` con `busy` activo no llama a las acciones (R19).
- `dispose()` (R30): `disposed = true`, vacía `busy` y conjunto; respuestas tardías no invocan callbacks.
- Tap prioritario (R17): `HubSceneB` decide con `pickPickup(over)`: busca primero `o.getData('pickupKey')` y recién
  después `o.getData('buildingId')`; si hay objeto, llama `controller.tap(key)` y **no** emite `entity:selected` ni la
  animación del edificio.

## 5. Escena `client/src/game/scenes/HubSceneB.js` (adaptador fino)

- **`preload()`**: además de `HUB_TEXTURES`, `for (const { key, url } of PICKUP_TEXTURES) this.load.image(key, url)`.
  El `loaderror` existente ya agrega la clave a `this.missing` y avisa por `console.warn` (R14).
- **`makeTextures()`**: textura `hubb_pickup_placeholder` (64×64: saco simple dibujado con `Graphics`: elipse + cuello +
  trazo ocre `0xd9a441`, sin texto/emoji — R12), generada una vez junto al resto.
- **`create()`**: `this.pickups = createPickupController({...})` con `getSnapshot` desde `useGameStore.getState()` y
  `Date.now()`; callbacks:
  - `onAdd(p)`: `this.add.image(x, y, this.tex('hubb_pk_' + p.icon, 'hubb_pickup_placeholder')).setOrigin(0.5, 1)`;
    escala a `PICKUP_H / height`; `depth = HUB_DEPTHS.buildings + slot.y + 3`; `setData('pickupKey', p.key)`;
    `setInteractive` con el rectángulo de `pickupHitSize`; tween de balanceo `y → y − PICKUP_BOB` yoyo infinito con
    `delay` aleatorio (R11); se guarda en `this.pickupSprites: Map<key, {sprite, bob}>`.
    Tras agregar/quitar, **re-posiciona** los de ese anfitrión con `pickupPosition(slot, host, i, count)` (índices por
    orden de `id`).
  - `onRemove(p)`: `killTweensOf` + `destroy()` + borrar del Map.
  - `onBusy(p, b)`: `setAlpha(b ? 0.55 : 1)`.
  - `onCollected(p)`: `flyPickup(p)` — `counterTarget(p.resourceKey)` y un tween `x/y` hacia el destino, `scale → 0.35`,
    `alpha → 0.2`, `duration PICKUP_FLY_MS`, `ease 'Cubic.easeIn'`, `onComplete: destroy` + `ParticleSystem` ya existente
    no se usa (el brillo de `token:earned` ya lo emite el store). El sprite sale del Map en ese momento para no chocar con
    el siguiente `sync()`.
- **`counterTarget(resourceKey)`**: `document.querySelector('[data-resource="' + resourceKey + '"]')`; si existe →
  `cssToWorld` con su `getBoundingClientRect()` central; si no → fallback de §4.4. Selector construido solo con claves
  del catálogo (`crop_id`, `egg|milk|wool`), nunca con texto del usuario.
- **Suscripción**: en el `useGameStore.subscribe` existente se agrega `s.plots !== prev.plots || s.animals !==
  prev.animals || s.buildings !== prev.buildings` → `this.pickups.sync()`. `syncBuildings` ya corre antes por
  `buildings`, así que `builtIds` está actualizado (se arma de `this.bldSprites`).
- **Temporizador**: `this.pickupTimer = this.time.addEvent({ delay: PICKUP_REFRESH_MS, loop: true, callback: () =>
  this.pickups.sync() })` (R6). Primer `sync()` al final de `create()`.
- **`setupInput()`**: en `pointerup`, tras `isTap` y `shouldAcceptTap`, `const pk = (over || []).find(o =>
  o.getData && o.getData('pickupKey'))`; si existe → `this.pickups.tap(pk.getData('pickupKey'))` y `return`. Si no,
  el flujo de edificios queda intacto (R25).
- **`teardown()`** (R30): `this.pickups.dispose()`, `this.pickupTimer.remove()`, destruir `pickupSprites` y sus tweens.
  Los objetos en vuelo se destruyen con `this.tweens.killTweensOf` + `destroy`.

## 6. Arte (R12–R14)

**Estado:** no hay ilustraciones de objeto de recolección en el repo (§1). **Resolución, explícita:**

1. **Tarea de arte dentro de esta feature (T1–T3)**, con el pipeline existente: `art-b/pickups/manifest.json` (mismo
   formato que `art-b/hub/manifest.json`, bloque `STYLE MATCH` idéntico, `refs` a `art-b/hub/refs/hub_base.webp`,
   fondo liso para recorte) con 4 ítems: `pickup_sack` (saco de arpillera atado, grano asomando), `pickup_egg_basket`
   (cesta con huevos), `pickup_milk_pail` (balde de madera con leche), `pickup_wool_bale` (fardo de lana). Salida con
   `scripts/process_art_b.js` a `client/public/assets/b/pickups/<id>.webp`, `--height 128` (≥ 1.5 × 84, R13), fondo
   transparente. Hoja de contacto con `scripts/contact_sheet_b.js`.
2. **Respaldo en runtime:** `hubb_pickup_placeholder` (R14): la lógica, el tap y el vuelo funcionan sin los `webp`.
3. **Si la generación IA no está disponible** (sin clave/cuota en `gen_art_b.js`), el implementer NO inventa ni sustituye
   en silencio: deja T1–T3 en `## Bloqueado`, termina el resto con el placeholder y lo informa; el cierre de la feature
   con placeholder requiere decisión del owner (el R13 no se cumple hasta que haya arte).

`HUB_TEXTURES` (hubLayout.js) no cambia: las texturas de objetos son una lista aparte (`PICKUP_TEXTURES`).

## 7. Casos de error

| Caso | Comportamiento |
|---|---|
| `POST /farm/harvest` o `/animals/collect` rechazado (red, 400, 401) | `harvestCrop` notifica y rechaza; `collectAnimalProduct` notifica y devuelve `null` → controlador restaura el objeto (R23); el siguiente `sync()` lo corrige si el server ya no lo considera listo (se recargan datos) |
| Reloj del cliente adelantado: el animal "listo" no lo está para el server | 400 "El animal todavía no produjo" → R23: el objeto se restaura y el jugador ve el error del store; reaparece/desaparece correcto cuando `loadAnimals` o el temporizador (§5) corrigen el estado. **Riesgo menor** (§10) |
| Parcela ya cosechada desde el panel de granja | `loadPlots` actualiza `plots`; `sync()` quita el objeto (R5). Si el toque llega antes, 400 "no está listo" → R23 y luego se quita |
| Textura de objeto faltante | `hubb_pickup_placeholder` + `console.warn` (R14) |
| Contador no está en el DOM | Fallback del borde superior (R21); sin excepción |
| Respuesta tardía tras `shutdown`/`destroy` de la escena | `dispose()` la descarta (R30) |
| Modo construcción (`placing`) u overlay abierto | `shouldAcceptTap` ya bloquea el tap (R25); los objetos se siguen mostrando |
| Más de 3 recolectables en un anfitrión | Se muestran 3; al recoger uno aparece el siguiente (R4) |
| Anfitrión en construcción / no construido (p. ej. animales sin `stable`) | Sin objeto (R9); el jugador sigue pudiendo recoger desde el panel de granja |

## 8. Rendimiento

≤ 6 sprites visibles (3 por anfitrión), 6 tweens de balanceo, 1 `time.addEvent` de 5 s con `selectPickups` O(n) sobre
las listas del store: despreciable frente al presupuesto de `hub_b_escena`. Medición: mismo harness que
`specs/hub_b_escena/evidencia/fps*.json` con 6 objetos forzados en el store (R29).

## 9. Evidencia (tooling)

- Vitest: `cd client && npx vitest run src/tests/hubPickups.test.js src/tests/gameStore.test.js`, luego `npx vitest run`.
- Playwright (Chromium headless, 412×860 @2x, como `hub_b_escena`; servidor con `SKIP_AUTH=true`): sembrar parcelas
  `ready` y un animal listo en la DB de desarrollo (o interceptar `GET /farm/plots` y `/farm/animals` con `page.route`
  para no tocar datos), capturar: objetos junto a `farm_plot` y `stable`; vuelo a mitad (frame a ~300 ms); contador antes
  y después; request único a `/api/farm/harvest`; consola sin errores; con los `webp` bloqueados (`page.route` abort) →
  placeholder. Salida en `specs/hub_b_recoleccion/evidencia/*.webp` + `fps_recoleccion.json` + `consola.txt`.
- Server: sin cambios, no se corre suite de server; `git diff --stat feature/hub_b_escena...HEAD -- server shared` vacío.

## 10. Riesgos y seguimiento

- **Alcance de recursos (decisión del owner):** objetos de leña/lingotes/coronas exigen una feature de economía previa
  (estado acumulado + endpoint `collect` por edificio, migración, tests de server, tope de almacén). Proponer
  `hub_b_recoleccion_edificios` después de B1.2 si se quiere.
- **Reloj del cliente vs server** (animales): mitigado por R23; el server es la fuente de verdad.
- **Arte IA:** puede requerir regenerar; el placeholder evita bloquear la lógica (§6).
- **Contador no listado en `MAIN_RESOURCES`:** el vuelo va al borde superior; si se quiere un destino propio por
  recurso, hay que ampliar la barra (chrome, feature B3).
- **Varios `farm_plot`/`stable` construidos:** la escena dibuja una sola ranura por `building_id` (`selectHubBuildings`),
  así que los objetos de todas las parcelas se agrupan en esa ranura y el tope de 3 aplica al conjunto.
