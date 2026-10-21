# Requirements — `hub_b_recoleccion` (feature 4, B1.2)

> Hub idle vivo — lo producido y **listo para recoger** aparece en la escena `HubSceneB` como objeto ilustrado junto a
> su edificio; tocarlo lo recoge con el endpoint existente y el objeto vuela al contador. Continúa `hub_b_escena`
> (escena base, ranuras, input). Notación EARS estricta (`docs/specs.md`). Cada `R<n>` indica su **Evidencia** según
> `docs/conventions.md` §Verificación.
>
> Glosario:
> - **hub B / escena**: `HubSceneB` (`client/src/game/scenes/HubSceneB.js`).
> - **recolectable**: elemento que hoy el server expone con una acción explícita de recolección: una **parcela
>   lista** (`farm_plots.state = 'ready'` → `POST /api/farm/harvest {plotId}`) o un **animal listo**
>   (`player_animals.is_fed` y `next_production_at` vencido → `POST /api/farm/animals/collect {animalId}`).
> - **objeto** (de recolección): sprite ilustrado que representa un recolectable en la escena.
> - **edificio anfitrión**: `farm_plot` para parcelas listas; `stable` (alberga animales, `gameConfig.js`) para
>   animales listos.
> - **producción automática**: la de `mill`, `sawmill`, `smithy`, `mine`, `tavern`, `market` (`gameTick` §2b) que el
>   server acredita directo a `player_resources` cada minuto, sin paso de recolección.
> - **contador**: el elemento del chrome React (`TopResourceBar`) que muestra el recurso recogido.
> - **ranura**, **espacio lógico**, **px CSS / lógicos**, **viewport de referencia** (412×860 @2x): igual que en
>   `specs/hub_b_escena/requirements.md`.

## Decisión de alcance (a confirmar por el owner en la puerta de aprobación)

La descripción de la feature menciona "saco de trigo, leña, lingotes, bolsa de coronas". Hoy **solo** parcelas y
animales tienen un endpoint de recolección; leña, lingotes y coronas (aserradero, mina/herrería, mercado) se acreditan
solos. El criterio "Sin cambios de economía" y "endpoint actual" impiden agregarles una acumulación recolectable en
esta feature. Por eso **entra** la recolección real de parcelas (saco de cosecha) y animales (huevos, leche, fibra) y
**no entran** objetos para producción automática (R24). Si el owner quiere leña/lingotes/coronas como objetos, es una
feature de economía aparte (acumulación + endpoint `collect` de edificios), no de esta.

## Trazabilidad con el `acceptance` de `feature_list.json` (id 4)

| # | Criterio de aceptación | Requirements |
|---|---|---|
| A1 | Cada recurso recolectable se ve como objeto junto a su edificio | R1, R2, R3, R4, R5, R6, R7, R8, R9, R10, R11, R12, R13, R14, R24 |
| A2 | Tocar el objeto recoge vía el endpoint actual y actualiza el contador | R15, R16, R17, R18, R19, R20, R21, R22, R23, R25, R31 |
| A3 | Sin cambios de economía | R26, R27, R28 |
| — | Calidad transversal (rendimiento, limpieza, suites) | R29, R30, R32, R33 |

## Objetos en la escena

- **R1** — WHEN `gameStore.plots` contiene una parcela con `state === 'ready'` y el edificio `farm_plot` está
  construido en la escena, la escena DEBE mostrar un objeto de tipo `crop` por esa parcela, apoyado junto a la
  ranura de `farm_plot`. *Evidencia:* Vitest (`selectPickups`) + captura Playwright.
- **R2** — WHEN `gameStore.animals` contiene un animal con `is_fed` verdadero y `next_production_at` menor o igual a
  la hora actual, y el edificio `stable` está construido en la escena, la escena DEBE mostrar un objeto de tipo
  `animal` por ese animal, apoyado junto a la ranura de `stable`. *Evidencia:* Vitest + captura.
- **R3** — La escena DEBE elegir la ilustración del objeto por catálogo: parcela lista → `sack`; producto de
  animal `egg` → `egg_basket`, `milk` → `milk_pail`, `wool` → `wool_bale` (el producto sale de `animal_id` según la
  tabla `PICKUP_ICONS`, que no contiene cantidades ni balance). *Evidencia:* Vitest.
- **R4** — La escena NO DEBE mostrar más de 3 objetos por edificio anfitrión a la vez (`MAX_PICKUPS_PER_BUILDING`),
  ordenados por `id` ascendente; los restantes aparecen cuando se recogen los visibles. *Evidencia:* Vitest.
- **R5** — WHEN una parcela deja de estar lista o un animal deja de estar listo (recogido, reasignado o eliminado),
  la escena DEBE destruir su objeto en la siguiente sincronización, sin sprites ni tweens huérfanos. *Evidencia:*
  Vitest (diff de claves) + Vitest del controlador `createPickupController` con el store simulado.
- **R6** — WHILE la escena está abierta, la escena DEBE reevaluar los animales cada `PICKUP_REFRESH_MS` (5 s) para
  mostrar el objeto cuando vence `next_production_at`, sin recargar la página. *Evidencia:* Vitest con reloj falso
  sobre `selectPickups(now)`.
- **R7** — WHEN el socket recibe `crop_ready`, el cliente DEBE recargar las parcelas (`loadPlots`) para que el objeto
  aparezca sin recargar la página. *Evidencia:* Vitest sobre el handler o captura Playwright con el evento emitido.
- **R8** — WHEN el socket recibe `animal_ready`, el cliente DEBE recargar los animales (`loadAnimals`). *Evidencia:*
  igual a R7.
- **R9** — IF el edificio anfitrión no está en la escena o está en construcción, THEN la escena NO DEBE mostrar sus
  objetos. *Evidencia:* Vitest (`selectPickups` con `builtIds`).
- **R10** — Cada objeto DEBE quedar dentro de la zona visible no tapada por el chrome (`SAFE_LEFT`..`SAFE_RIGHT`,
  `SAFE_TOP`..`SAFE_BOTTOM` de `hubLayout.js`) y con `depth` por encima de su edificio y por debajo de `HUB_DEPTHS.fog`.
  *Evidencia:* Vitest sobre `pickupPosition` + captura a 412×860 @2x.
- **R11** — Cada objeto DEBE tener un balanceo vertical en bucle sin input del jugador, de amplitud pequeña (≤ 6 px
  lógicos), para leerse como interactivo. *Evidencia:* captura + medición de fps (R29).
- **R12** — Los objetos NO DEBEN usar emojis ni texto de sistema como ícono. *Evidencia:* captura + inspección de
  `PICKUP_TEXTURES` (solo texturas `hubb_pk_*` o el placeholder de R14).

## Arte

- **R13** — El juego DEBE incluir 4 ilustraciones webp de objeto con fondo transparente en
  `client/public/assets/b/pickups/{sack,egg_basket,milk_pail,wool_bale}.webp`, con la estética del hub (grabado
  grimdark renacentista, bloque `STYLE MATCH` del manifiesto del hub) y alto de origen ≥ 1.5× el alto mostrado.
  *Evidencia:* `art-b/pickups/manifest.json` + hoja de contacto en `evidencia/` + `ls`.
- **R14** — IF una textura de objeto falta o falla al cargar, THEN la escena DEBE dibujar el objeto con la textura
  generada `hubb_pickup_placeholder`, registrar un `console.warn` y seguir permitiendo el tap. *Evidencia:* test con
  textura inexistente + captura con los `webp` ausentes.

## Recolección (tap)

- **R15** — WHEN el jugador toca un objeto de tipo `crop` (tap válido según `isTap` y `shouldAcceptTap`), la escena
  DEBE invocar `gameStore.harvestCrop(plotId)`, que llama a `POST /api/farm/harvest`. *Evidencia:* Vitest (mock del
  store) + captura de red en Playwright (request único a `/api/farm/harvest`).
- **R16** — WHEN el jugador toca un objeto de tipo `animal` (tap válido), la escena DEBE invocar
  `gameStore.collectAnimalProduct(animalId)`, que llama a `POST /api/farm/animals/collect`. *Evidencia:* igual a R15.
- **R17** — WHEN un tap cae sobre un objeto y sobre el sprite de un edificio superpuestos, la escena DEBE atender
  solo el objeto, sin emitir `entity:selected` por ese tap. *Evidencia:* Vitest del controlador (resolución de tap) + captura.
- **R18** — El área táctil de cada objeto DEBE medir al menos 44×44 px CSS (88×88 lógicos), aunque el sprite sea
  menor. *Evidencia:* Vitest sobre `pickupHitSize`.
- **R19** — WHILE hay una recolección en vuelo para un objeto, la escena NO DEBE enviar una segunda petición para
  ese mismo objeto. *Evidencia:* Vitest (doble tap → 1 llamada al store).
- **R20** — WHEN la recolección responde con éxito, la escena DEBE animar el objeto hacia el contador del recurso
  recogido (clave del recurso = `plot.crop_id` / producto del animal) y destruirlo al llegar, en ≤ 700 ms.
  *Evidencia:* captura de frames a mitad de vuelo + fps.
- **R21** — IF el elemento del contador del recurso no existe en el DOM, THEN el objeto DEBE volar al borde superior
  centrado de la zona visible, sin error de consola. *Evidencia:* Vitest sobre `cssToWorld`/destino de fallback.
- **R22** — WHEN la recolección responde con éxito, el contador del recurso DEBE reflejar el nuevo total mediante
  `refreshResources()` del store, sin sumar nada localmente. *Evidencia:* captura del contador antes/después
  con el `POST` real o `SKIP_AUTH` y Vitest del store.
- **R23** — IF la recolección falla (error de red o del server, p. ej. "El animal todavía no produjo"), THEN la
  escena DEBE restaurar el objeto sin animar el vuelo (la notificación de error es la que ya agrega el store).
  *Evidencia:* Vitest con el store rechazando.

## Producción automática y economía

- **R24** — La escena NO DEBE mostrar objetos de recolección en `mill`, `sawmill`, `smithy`, `mine`, `tavern` ni
  `market`. *Evidencia:* Vitest (`selectPickups` solo devuelve anfitriones `farm_plot` y `stable`).
- **R25** — Tocar un edificio sin objeto superpuesto DEBE seguir emitiendo `entity:selected` y abriendo el mismo
  panel que en `hub_b_escena` (sin pérdida de funcionalidad). *Evidencia:* tests existentes de `hubLayout` en verde + captura.
- **R26** — La feature NO DEBE modificar `server/`, `shared/` ni el contrato de ningún endpoint (rutas, cuerpos,
  respuestas, cantidades, calidad, XP, KH). *Evidencia:* `git diff --stat feature/hub_b_escena...HEAD -- server shared`
  vacío.
- **R27** — El cliente NO DEBE calcular cantidades, calidad, XP ni KH de lo recogido; las cantidades las decide el
  server. *Evidencia:* revisión del diff: `hubPickups.js` y la escena no importan `CROPS`/`ANIMALS` con `yield`.
- **R28** — La feature NO DEBE agregar eventos de `EventBridge` ni cambiar los existentes (`entity:selected`,
  `token:earned`, `game:plotsUpdated`, `game:animalsUpdated`). *Evidencia:* `docs/project-spec.md` §9.2 sin cambios y
  `git diff` sin `EventBridge.emit` nuevos.

## Calidad

- **R29** — La escena DEBE sostener ≥ 50 fps medidos con 6 objetos visibles (3 por anfitrión) en el viewport de
  referencia. *Evidencia:* `evidencia/fps_recoleccion.json`.
- **R33** — La consola del navegador NO DEBE registrar errores durante la aparición, el tap y el vuelo de un objeto.
  *Evidencia:* log de consola de la corrida Playwright citado en `tasks.md`.
- **R30** — WHEN la escena se cierra (`shutdown`/`destroy`), ella DEBE destruir los objetos, sus tweens y el temporizador
  de reevaluación y descartar cualquier respuesta de recolección tardía. *Evidencia:* Vitest del controlador (`dispose` con respuesta resuelta después) sin excepciones.
- **R31** — El chrome `TopResourceBar` DEBE exponer en cada contador de recurso el atributo `data-resource="<clave>"`
  sin cambiar su aspecto, para que la escena ubique el destino del vuelo. *Evidencia:* Vitest de render + captura sin
  diferencias visibles.
- **R32** — Las suites DEBEN quedar en verde salvo `known_failures`: `cd client && npx vitest run`.
  *Evidencia:* salida citada de `npx vitest run`.
