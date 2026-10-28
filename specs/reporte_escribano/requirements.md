# Requirements — `reporte_escribano` (feature 6, B1.4)

> El modal de reporte offline («Mientras no estabas») pasa a ser el **libro de cuentas del Escribano**: un pergamino del kit B
> con **los mismos datos de hoy**, el **tope de granero** a la vista y una **frase de humor negro** del Escribano que varía.
> Es solo presentación más un campo aditivo en el reporte del servidor. Notación EARS estricta (`docs/specs.md`).
> Cada `R<n>` indica su **Evidencia** según `docs/conventions.md` §Verificación.
>
> Glosario:
> - **reporte**: objeto `offlineReport` que devuelve `idleService.buildOfflineReport` (`server/src/services/idleService.js:116`) y que `/player/init` entrega al cliente (`gameStore.js:333`).
> - **modal**: `client/src/components/overlay/OfflineReportModal.jsx`. **kit B**: `client/src/components/ui/{Panel,Button,SpriteIcon}`.
> - **storage**: campo nuevo `report.storage = { [resourceId]: { amount, capacity } }` (ver R2).
> - **lleno**: `amount >= capacity` en una entrada de `storage`.
> - **frase**: línea de texto del Escribano tomada del catálogo `ESCRIBANO_LINES` (`client/src/config/escribanoLines.js`).
> - **cubo**: grupo de frases por situación: `defecto`, `lleno`, `breve`, `larga`.

## Trazabilidad con el `acceptance` de `feature_list.json` (id 6)

| # | Criterio de aceptación | Requirements |
|---|---|---|
| A1 | Mismos datos que el reporte actual, presentados con el kit B | R1–R6, R15–R32 |
| A2 | Frase del Escribano variable | R7–R14, R25 |

## Servidor — mismos datos, un campo aditivo

## R1
El sistema DEBE devolver en `buildOfflineReport` los campos `awayMs`, `resources`, `khEarned`, `catchUp`, `downtimeMs` y `events` con los mismos valores y reglas de cálculo que antes de esta feature.
Evidencia: `server/tests/idleService.test.js` sin cambios, `cd server && npx jest --runInBand --forceExit idleService` en verde.

## R2
CUANDO `buildOfflineReport` devuelve un reporte no nulo, el sistema DEBE incluir `storage` con una entrada `{ amount, capacity }` por cada recurso de `resources` y por cada recurso lleno, donde `amount` es el monto de `player_resources` tras aplicar el reporte y `capacity` es su columna `capacity`.
Evidencia: Jest nuevo `server/tests/idleServiceStorage.test.js` (recurso con delta → entrada con `capacity` real; recurso lleno sin delta → entrada presente).

## R3
SI un recurso no tiene `capacity` numérica en `player_resources` ENTONCES el sistema DEBE omitir su entrada de `storage` en lugar de inventar un valor.
Evidencia: Jest nuevo (fila con `capacity` nula → sin clave en `storage`, sin excepción).

## R4
El sistema NO DEBE cambiar cuándo `buildOfflineReport` devuelve `null`: primer login, ausencia menor a `MIN_AWAY_MS` y reporte sin contenido siguen devolviendo `null`, y un recurso lleno sin delta no cuenta como contenido.
Evidencia: Jest nuevo (recurso lleno, sin delta ni eventos → `null`) más los tests existentes `idleService.test.js:102` y `:109`.

## R5
El sistema NO DEBE borrar ni modificar líneas existentes de `server/src`: el diff de la feature sobre `server/src/services/idleService.js` solo añade líneas (ND1 del roadmap, sin tablas, migraciones, endpoints ni cambios en `playerService.js`).
Evidencia: `git diff --numstat feat/art-direction-b -- server/src` con 0 líneas borradas; `git diff --stat -- server/migrations shared` vacío.

## R6
El sistema NO DEBE modificar, borrar ni saltear ningún test existente.
Evidencia: `git diff --name-status feat/art-direction-b -- server/tests client/src/tests` solo con archivos `A` (nuevos); `cd server && npx jest --runInBand --forceExit` y `cd client && npx vitest run` en verde, citando `Tests: N passed`.

## Catálogo de frases (humor negro, variable)

## R7
El sistema DEBE exportar de `client/src/config/escribanoLines.js` el catálogo `ESCRIBANO_LINES` con cuatro cubos (`defecto`, `lleno`, `breve`, `larga`), con al menos 6 frases en `defecto` y al menos 4 en cada uno de los otros tres.
Evidencia: Vitest nuevo `escribanoLines.test.js` (conteo por cubo).

## R8
El sistema DEBE exponer `pickEscribanoLine(report)` como función pura y determinista: el mismo reporte siempre devuelve la misma frase, sin usar `Math.random` ni `Date`.
Evidencia: Vitest nuevo (misma entrada 50 veces → misma salida) y `grep -nE "Math\.random|Date" client/src/config/escribanoLines.js` vacío.

## R9
CUANDO el reporte tiene alguna entrada de `storage` llena, `pickEscribanoLine` DEBE elegir una frase del cubo `lleno`.
Evidencia: Vitest nuevo (reporte con entrada llena, cualquier `awayMs` → frase ∈ `ESCRIBANO_LINES.lleno`).

## R10
MIENTRAS el reporte no tiene entradas llenas, `pickEscribanoLine` DEBE elegir del cubo `larga` si `awayMs` ≥ 24 h, del cubo `breve` si `awayMs` < 1 h, y del cubo `defecto` en los demás casos.
Evidencia: Vitest nuevo con los bordes `awayMs` = 3 599 999, 3 600 000, 86 399 999 y 86 400 000.

## R11
El sistema DEBE derivar el índice de la frase de un hash entero de `awayMs` módulo el tamaño del cubo, de modo que ausencias distintas elijan frases distintas.
Evidencia: Vitest nuevo (500 valores de `awayMs` distintos en el cubo `defecto` → aparecen todas sus frases).

## R12
El sistema NO DEBE incluir en ninguna frase emojis, términos del lore v1 (`docs/lore-glosario.md`), cifras ni nombres de recursos concretos.
Evidencia: Vitest nuevo (`EMOJI_RE` de `tests/helpers/emoji.js`, lista de términos v1 del glosario, `/\d/`) sobre todas las frases.

## R13
El sistema DEBE limitar cada frase a 140 caracteres y exigir que las del cubo `lleno` nombren al granero.
Evidencia: Vitest nuevo (`length <= 140` en todas; `/granero/i` en las del cubo `lleno`).

## R14
El sistema DEBE sujetar el texto del catálogo al canon de `docs/lore.md` (Escribano `:72-77` y `:151-152`): trato de «señor», diezmo, ratas y granero; sin términos sci-fi.
Evidencia: inspección documentada en `review.md` contra `docs/lore.md` y aprobación del owner del tono en la puerta de aprobación del spec (design §5 lista el borrador).

## Modal — libro de cuentas con el kit B

## R15
CUANDO `offlineReport` es `null`, el modal NO DEBE renderizar nada.
Evidencia: Vitest nuevo `OfflineReportModal.test.jsx` (store con `offlineReport: null` → contenedor vacío).

## R16
CUANDO hay reporte, el modal DEBE renderizarse dentro de `Panel variant="parchment"` sobre el fondo oscurecido a pantalla completa de hoy (`fixed inset-0 z-[60]`).
Evidencia: Vitest nuevo (`data-variant="parchment"` presente; fondo `rgb(216, 200, 160)`).

## R17
El modal DEBE mostrar el título «Libro de cuentas del Escribano» y el subtítulo «Mientras no estabas».
Evidencia: Vitest nuevo (`getByText` de ambos).

## R18
El modal DEBE mostrar «Ausente {tiempo}» con el formato de `formatAway` actual: `N min` por debajo de 60 min, `H h M min` por debajo de 48 h y `N días` desde 48 h.
Evidencia: Vitest nuevo (tabla: 5 min, 59 min, 60 min, 125 min, 47 h 59 min, 48 h, 72 h).

## R19
El modal DEBE mostrar, por cada entrada de `report.resources`, una fila con su `SpriteIcon`, su nombre en español (el id si no tiene nombre) y `+{amount}`.
Evidencia: Vitest nuevo (reporte con `wheat` y `wood` → dos filas con «Trigo»/«Madera» y sus montos; id desconocido → se muestra el id).

## R20
CUANDO `report.catchUp` tiene alguna clave, el modal DEBE mostrar la etiqueta «(incluye recuperación)» junto al título de producción, y en caso contrario NO DEBE mostrarla.
Evidencia: Vitest nuevo (con y sin `catchUp`).

## R21
CUANDO `report.khEarned` es mayor que 0, el modal DEBE mostrar `+{khEarned} KH` con el mismo ícono que hoy, y en caso contrario NO DEBE mostrar el bloque.
Evidencia: Vitest nuevo (`khEarned: 1.5` → «+1.5 KH»; `0` → ausente).

## R22
CUANDO `report.events` tiene elementos, el modal DEBE mostrar el `text` de cada uno en la sección «Sucesos» con el ícono `scroll`, y NO DEBE mostrar el campo `icon` del servidor.
Evidencia: Vitest nuevo (dos eventos → dos textos; el emoji del `icon` no aparece en el DOM).

## R23
CUANDO `report.storage` tiene la entrada de un recurso de `resources`, el modal DEBE mostrar en su fila el tope como «{amount} / {capacity}».
Evidencia: Vitest nuevo (`storage.wheat = {amount: 480, capacity: 500}` → «480 / 500» en la fila de trigo).

## R24
CUANDO una entrada de `storage` está llena, el modal DEBE mostrar el texto «Granero lleno» para ese recurso, también si el recurso no está en `resources`.
Evidencia: Vitest nuevo (entrada llena dentro y fuera de `resources` → texto presente en ambos casos; el aviso no depende solo del color).

## R25
SI `report.storage` no existe o no tiene la entrada de un recurso ENTONCES el modal DEBE omitir el tope de esa fila y seguir mostrando el resto sin error.
Evidencia: Vitest nuevo (reporte sin `storage` → mismas filas, sin «/» ni «Granero lleno», sin excepción).

## R26
El modal DEBE mostrar una sola frase del Escribano, obtenida con `pickEscribanoLine(report)`, y DEBE mantenerla idéntica entre re-renders del mismo reporte.
Evidencia: Vitest nuevo (la frase mostrada ∈ catálogo; `rerender` → mismo texto; reporte `lleno` → frase del cubo `lleno`).

## R27
CUANDO el jugador toca «Retomar el mando», el modal DEBE llamar a `dismissOfflineReport` y desaparecer; el botón DEBE ser un `Button` del kit con alto mínimo de 44 px.
Evidencia: Vitest nuevo (clic → `offlineReport` pasa a `null`; `style.minHeight` ≥ 44).

## R28
El modal NO DEBE usar emojis, clases `green`, color `kh-macula` ni colores `rgba(...)` en línea; el éxito se muestra con tinta de pergamino o latón.
Evidencia: `cd client && npx vitest run src/tests/noEmoji.test.js` en verde (sin tocar el test) + Vitest nuevo (el HTML del modal no contiene `green` ni `macula`) + `grep -n "rgba(" client/src/components/overlay/OfflineReportModal.jsx` vacío.

## R29
El modal DEBE usar íconos `SpriteIcon` de al menos 28 px y controles táctiles de al menos 44×44 px.
Evidencia: `noEmoji.test.js` (guardia `SIZE_MIN`) + Vitest nuevo sobre el `minHeight` del botón.

## R30
MIENTRAS el viewport es de 412×860 con el reporte más largo posible (17 recursos, 4 eventos, frase de 140 caracteres), el modal DEBE mostrar el título y el botón «Retomar el mando» sin desplazar la página, con scroll interno en el cuerpo y sin desborde horizontal.
Evidencia: captura Playwright 412×860 @2x en `specs/reporte_escribano/evidencia/` (reporte corto, largo y con granero lleno) + `scrollWidth <= clientWidth` impreso por el script + consola sin errores.

## R31
El sistema NO DEBE modificar `App.jsx`, `gameStore.js`, `playerService.js` ni el contrato de `/player/init` más allá del campo `storage` de R2.
Evidencia: `git diff --stat feat/art-direction-b -- client/src/App.jsx client/src/store server/src/services/playerService.js` vacío.

## R32
El sistema NO DEBE añadir arte nuevo ni archivos bajo `client/public/assets` ni `art-b/`; el libro de cuentas se compone con `Panel`, `Button`, `SpriteIcon` y tokens `kh-*` existentes.
Evidencia: `git diff --stat feat/art-direction-b -- client/public art-b` vacío. (Un retrato u orla propios del Escribano serían una etapa de arte aparte, con puerta de p-kh: design §7.)

## R33
El sistema NO DEBE implementar `protectedPerLevel`, la protección de almacenes ni cambios en `combatService`; el punto de enganche para la feature 20 queda solo documentado.
Evidencia: `grep -rn "protectedPerLevel" server/src client/src shared` vacío; design §6 documenta el enganche.
