# fix_pantalla_movil — Requirements (EARS)

Feature 24 · `sdd: true` · rama `feature/fix_pantalla_movil`.
Objetivo: la app entra completa en un celular real (Chrome Android con barras, Telegram WebApp, notch).
Orígenes: P1–P5 de `HALLAZGOS.md` (línea base 2026-10-28), brief `fix_pantalla_movil`, referencia Last Asylum (tope 2.1).
Fuera de alcance: S1–S5 (`fix_superposiciones_ui`), arte nuevo, textos nuevos, server.

Definiciones: **marco** = `.kh-frame`, la caja donde vive toda la app (ancho del viewport, alto `--kh-frame-h`).
**Alto visible** = lo que el usuario ve entre las barras del navegador (`dvh`) o `viewportStableHeight` en Telegram.
**Aspecto** = alto / ancho del viewport.

## P1 — Alto visible real

## R1
El sistema DEBE dimensionar el contenedor raíz de la app con el token `--kh-app-h` (alto visible real) y NO con `100vh`/`h-screen`.

## R2
El sistema DEBE declarar `--kh-app-h` con `100vh` como base y `100dvh` dentro de `@supports (height: 100dvh)`.

## R3
DONDE `Telegram.WebApp.initData` no esté vacío y `viewportStableHeight` sea mayor que 0, el sistema DEBE fijar `--kh-app-h` al menor entre `viewportStableHeight` y `window.innerHeight`, en px.

## R4
CUANDO el navegador emita `resize` u `orientationchange`, o Telegram emita `viewportChanged`, el sistema DEBE recalcular `--kh-app-h`.

## R5
DONDE el navegador no soporte `100dvh` y no haya Telegram válido, el sistema DEBE fijar `--kh-app-h` a `window.innerHeight` en px.

## R6
CUANDO el alto de `#phaser-container` cambie sin que haya un `resize` de `window`, el sistema DEBE reajustar el canvas del hub con el mismo cálculo de `handleResize`.

## R7
MIENTRAS el hub esté montado, el sistema DEBE mostrar completa la fila inferior (Héroes / Bastión / Mundo): el borde inferior de cada botón NO DEBE superar el alto visible.

## R8
El sistema DEBE usar el marco (y no `h-screen`/`w-screen`) en MainMenu, LoadingScreen, pantalla de error, raíz del hub y las raíces de preview de `App.jsx`.

## P2 — Notch y safe-area

## R9
El `<meta name="viewport">` DEBE incluir `viewport-fit=cover` y conservar `width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no`.

## R10
El sistema DEBE definir los tokens `--kh-safe-top`, `--kh-safe-right`, `--kh-safe-bottom` y `--kh-safe-left` a partir de `env(safe-area-inset-*, 0px)`.

## R11
El sistema DEBE desplazar `TopResourceBar` hacia abajo `--kh-safe-top`, y lo mismo el riel `.kh-rail` y el riel de misiones (`QuestRail`) que cuelgan debajo de ella.

## R12
El sistema DEBE elevar `BottomNavBar` y la fila de Operaciones de `BastionHub` `--kh-safe-bottom`.

## R13
El sistema DEBE desplazar `.kh-rail--left` y `.kh-rail--right` hacia adentro `--kh-safe-left` y `--kh-safe-right` respectivamente.

## R14
El canvas del hub NO DEBE recibir relleno de safe-area: DEBE ocupar el marco completo, incluido el área bajo el notch.

## R15
MIENTRAS `env(safe-area-inset-*)` valga 0 (desktop, celulares sin notch), el sistema DEBE producir exactamente los offsets actuales (8 px arriba, 84 px de colchón de la botonera, 128 px del riel, 8 px de los rieles laterales).

## P3 — Tope de proporción (tipo Last Asylum)

## R16
El sistema DEBE definir una única constante `MAX_ASPECT = 2.1` (`client/src/utils/viewport.js`) y su espejo CSS `--kh-max-aspect: 2.1`, con un test que verifique que ambas coinciden.

## R17
MIENTRAS el aspecto del viewport sea mayor que `MAX_ASPECT`, el sistema DEBE dibujar el marco con alto `ancho × MAX_ASPECT`, centrado verticalmente, con bandas arriba y abajo de color `#14110d` (`kh-ink`).

## R18
MIENTRAS el aspecto del viewport sea menor o igual que `MAX_ASPECT`, el sistema DEBE dibujar el marco con el ancho y el alto completos del viewport (sin bandas).

## R19
El sistema DEBE contener los overlays `position: fixed` dentro del marco (`contain: layout`) para que no cubran las bandas.

## R20
MIENTRAS haya bandas, el sistema DEBE descontar el alto de la banda de cada `--kh-safe-top`/`--kh-safe-bottom` (mínimo 0) para no contar dos veces el notch.

## R21
El sistema NO DEBE modificar `computeHubViewport`, `buildDisplaySettings` ni `buildGameConfig`: el hub sigue siendo *cover* sobre el espacio lógico 824×1720 y el marco solo cambia el tamaño del contenedor.

## P4 — Tienda a 360×740

## R22
MIENTRAS `ShopPanel` esté abierto en un viewport 360×740, el borde inferior del panel y el de su zona con scroll NO DEBEN superar y=740.

## R23
CUANDO el contenido de `ShopPanel` supere el alto disponible, el sistema DEBE permitir llegar por scroll al último bloque (Boost ×2 y lo que siga) con su borde inferior visible.

## R24
El sistema DEBE limitar el alto de `ShopPanel` al 78 % del marco y calcular el alto de la zona con scroll por layout flex (`flex: 1 1 auto; min-height: 0`), sin asumir la altura del encabezado.

## R25
El sistema NO DEBE cambiar textos, packs, precios ni la lógica de compra de `ShopPanel`.

## P5 — Canvas único

## R26
MIENTRAS el hub esté montado en un build de producción (`vite build` servido), `document.querySelectorAll('canvas').length` DEBE ser 1.

## R27
CUANDO el efecto de `PhaserGame` se ejecute (montaje, doble efecto de StrictMode en dev o cambio de rama ISO/hub), el sistema DEBE eliminar cualquier `<canvas>` residual dentro de `#phaser-container` antes de crear el `Phaser.Game`.

## R28
CUANDO `PhaserGame` se desmonte, el sistema DEBE dejar 0 `<canvas>` dentro de `#phaser-container`.

## Verificación en dispositivo

## R29
El sistema DEBE mostrar la fila inferior del hub completa (Héroes, Bastión y Mundo, con sus etiquetas) en el Chrome del emulador Android `kh_pixel7` con barras del navegador visibles.

## R30
El sistema DEBE producir 0 elementos fuera de pantalla (`nFuera` = 0, ⚠) en `reporte.json` para las pantallas `hub` y `shop` en los cinco celulares del set (360×740, 360×800, 390×844, 412×915, 375×667).

## R31
El sistema NO DEBE producir errores de consola nuevos respecto de la línea base (se ignoran los 429 del rate-limit).

## Reglas de no destrucción (R-ND1..ND10)

## R-ND1
El sistema DEBE ser solo aditivo: NO DEBE borrar ni renombrar archivos, exports, claves de `gameConfig`, ids ni endpoints; el código existente solo recibe puntos de enganche (clases/estilos/llamadas), y lo nuevo vive en `utils/viewport.js`, `components/ui/AppFrame.jsx` y un bloque nuevo al final de `index.css`.

## R-ND2
El sistema NO DEBE modificar nada de `server/` (incluido `campaignSim.js` y el motor de combate): la feature es solo cliente.

## R-ND3
El sistema DEBE permitir volver atrás cambiando un solo valor: `MAX_ASPECT`/`--kh-max-aspect` a un número alto (p. ej. 99) elimina las bandas y deja el marco igual al viewport.

## R-ND4
El sistema NO DEBE cambiar contratos: `EventBridge`, claves de `registry` (`store`, `eventBridge`, `isoMode`, `entry`, `renderScale`), id `phaser-container`, `window.__phaserGame` (DEV), firmas de `buildDisplaySettings`/`buildGameConfig`/`computeHubViewport` ni props de los componentes tocados.

## R-ND5
El sistema NO DEBE agregar migraciones, tablas ni columnas.

## R-ND6
El sistema NO DEBE tocar ni saltear tests existentes (`display.test.js`, `hubLayout.test.js`, `hudRails.test.jsx`, etc.); `cd client && npx vitest run` DEBE pasar completo con los tests nuevos sumados.

## R-ND7
El sistema DEBE calcular el alto y el marco con funciones puras y sin azar (`computeAppHeight` sin `Math.random` ni reloj); mismas entradas, misma salida, con test.

## R-ND8
El sistema NO DEBE esparcir números mágicos: el tope 2.1 vive en una sola constante nombrada (+ espejo CSS) y los offsets previos (8/84/128 px) se conservan como base de los `calc()`.

## R-ND9
El sistema DEBE trabajar en `kingdoms-harvest-wt/fix_pantalla_movil` sobre `feature/fix_pantalla_movil`, con `feature_list.json` y `CHANGELOG.md` editados de forma quirúrgica, y NO DEBE tocar lo que cubre `fix_superposiciones_ui` (píldora de clima, banner de objetivo, TechTree, Logros, Configuración).

## R-ND10
El sistema NO DEBE agregar arte ni textos visibles nuevos; los colores usados DEBEN ser tokens existentes (`kh-ink #14110d`).

## Visual sin cambios

## R-ND11
MIENTRAS el aspecto del viewport sea menor o igual que 2.1 y no haya notch (360×740, 375×667, desktop), la captura Playwright del hub DEBE ser idéntica a la línea base (diferencia de píxeles 0, o ≤ 0,1 % por animación de partículas, anotada).

## Cobertura de `acceptance`

`feature_list.json` id 24 (acceptance): alto visible real → R1–R8, R29; notch → R9–R15; tope de proporción → R16–R21; tienda 360×740 → R22–R25; canvas único → R26–R28; evidencia en dispositivo y reporte → R29–R31; aditivo → R-ND1..R-ND11.

## Preguntas abiertas (el owner aprueba; recomendación entre paréntesis)

1. **Bandas o centrado para aspecto > 2.1.** Este spec implementa **bandas** (R17): el marco se corta a `ancho × 2.1` y se centra; el resto queda `#14110d`. (Recomendación: bandas. El hub es *cover* 824×1720 = aspecto 2.087, o sea que el arte ya está diseñado para ≈2.1; más alto solo recorta los costados del arte y aleja los rieles de la botonera, y las bandas dan un layout idéntico en todos los teléfonos altos. Alternativa descartada: *centrar* solo el chrome con el canvas a sangre; obliga a calcular offsets de cada elemento absoluto.)
2. **Efecto visible del tope.** Con 2.1, tres celulares del set ganan bandas chicas: 390×844 (2.16) ≈ 12 px por lado, 360×800 y 412×915 (2.22) ≈ 22–25 px por lado. 360×740 y 375×667 no cambian. Esto contradice en parte "no cambia nada en los tamaños que hoy entran bien". (Recomendación: aceptarlo con 2.1, que es lo que pidió el owner y lo que usa LA. Si prefiere cero cambio en los celulares actuales, subir la constante a 2.25 —un solo valor, R-ND3— y las bandas aparecen solo en teléfonos más altos que el Pixel 7.)
3. **Telegram `safeAreaInset`/`contentSafeAreaInset` y fullscreen (Bot API 8+).** No se usan: la app sigue con `expand()` y Telegram ya dibuja su cabecera arriba. (Recomendación: no incluir ahora; abrir una feature aparte solo si el owner quiere fullscreen real en Telegram.)
4. **APK Capacitor** (`client/android/`, no revisado). `viewport-fit=cover` también afecta al WebView. (Recomendación: verificar en una pasada del emulador con la APK dentro de `apk_fase1_verificacion`; no se toca aquí.)
5. **Overlays con `vh` propio** (`AchievementPanel` 75vh, `HeroPanel` 75vh, `MarketplacePanel` 75vh, `FactionSelectPanel` 70vh, `CraftingPanel`/`DialogPanel`/`TroopManagementPanel`/`WarPanel` 65vh, `OfflineReportModal` 50vh, `CropSelectMenu` 40vh, `SquadPanel` 78vh). (Recomendación: no tocarlos ahora. Con el marco, `vh` ≥ alto visible, así que los paneles anclados abajo quedan completos; unificarlos a `%` del marco en un seguimiento, para no mezclar con `fix_superposiciones_ui`.)
6. **Guard de canvas (R27) si el build de producción ya da 1 canvas.** (Recomendación: dejarlo igual; es idempotente, cuesta una línea y cubre HMR/StrictMode.)
7. **Orden de merge con `fix_superposiciones_ui`** (ambas tocan `TopResourceBar.jsx`). (Recomendación: mergear primero `fix_superposiciones_ui`, o rebasar esta rama sobre ella; aquí el cambio en ese archivo es una sola línea de `paddingTop`.)
