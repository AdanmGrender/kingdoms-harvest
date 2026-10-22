# Requirements — `ui_kit_b` (feature 8, B3)

> Kit de UI e íconos B en todo el chrome React: IM Fell empaquetada, tokens `kh-*`, componentes `Panel`/`Button`/
> `PortraitRing`/`Bar` e íconos ilustrados estilo B que reemplazan los emojis y el set `grim_icons.png`.
> Entrada obligatoria de arte: `docs/art-direction/ui-kit-b.md` (commit 49f26bf, p-kh). Notación EARS estricta
> (`docs/specs.md`). Cada `R<n>` indica su **Evidencia** según `docs/conventions.md` §Verificación.
>
> Glosario:
> - **chrome**: UI React de `client/src/components/**` (HUD, rieles, paneles, popups, modales). Las escenas Phaser no entran.
> - **kit**: los componentes nuevos de `client/src/components/ui/` (`Panel`, `Button`, `IconButton`, `Bar`, `PortraitRing`).
> - **set**: la hoja de íconos (`GRIM_ICONS` en `client/src/config/grimIconSheet.generated.js`, leída por `spriteMap` → `SpriteIcon`).
> - **emoji**: carácter que cumple `\p{Extended_Pictographic}` o es `U+FE0F`/`U+20E3` (criterio único, ver design §2.6).
> - **nombres contrato**: los 65 nombres originales de `GRIM_ICONS` (design §7.1).
> - **puerta de arte**: aprobación explícita de p-kh sobre la hoja de contacto de íconos (`ui-kit-b.md` §7).
>
> **Etapas separables** (cada una se implementa, verifica y revisa sola; ver `tasks.md`):
> **A** fuentes y tokens (R1–R16) · **B** componentes del kit + contadores nuevos (R17–R37) ·
> **C** set de íconos B, puerta de arte y reemplazo de emojis (R38–R58).

## Trazabilidad con el `acceptance` de `feature_list.json` (id 8)

| # | Criterio de aceptación | Requirements |
|---|---|---|
| A1 | Cero emojis como íconos en la UI | R49, R50, R51, R52, R53, R54, R55 |
| A2 | Sin Google Fonts; tipografía empaquetada | R1, R2, R3, R4, R5, R11, R12, R16 |
| A3 | Cumple `ui-kit-b.md`: tokens §3, componentes §5, íconos B §6.1, KH único §6.2, hoja nueva con los nombres §6.3 | R6, R7, R8, R15, R17–R29, R38–R48 |
| A4 | Revisión de arte de p-kh sobre hoja de contacto 24/32/48 px y capturas 412×860 (§7) | R42, R43, R56, R13, R32 |
| — | Calidad transversal (sin cambios de lógica, suites, consola limpia) | R30, R31, R37, R57, R58 |

## Etapa A — Fuentes y tokens

### R1
El sistema NO DEBE referenciar `fonts.googleapis.com` ni `fonts.gstatic.com` en `client/index.html`, `client/src/**` ni `client/tailwind.config.js`.
Evidencia: test Vitest `fontsConfig.test.js` (lectura de archivos) + `grep` vacío citado.

### R2
El sistema DEBE cargar `/fonts/fonts.css` desde `client/index.html` con un `<link rel="stylesheet">` de mismo origen.
Evidencia: test `fontsConfig.test.js` + Playwright: `document.fonts.check('16px "IM Fell English"')` verdadero tras la carga.

### R3
El sistema DEBE declarar en `client/public/fonts/fonts.css` únicamente `IM Fell English` (400 normal y 400 italic), `IM Fell English SC` (400) y `Alegreya Sans SC` (700), cada una con su `woff2` existente en `client/public/fonts/`.
Evidencia: test `fontsConfig.test.js` (cuenta de `@font-face` = 4 y que cada `url()` existe en disco).

### R4
El sistema NO DEBE contener las cadenas `MedievalSharp`, `Cinzel` ni `Alegreya Sans` distinta de `Alegreya Sans SC` en `client/index.html`, `client/src/**`, `client/tailwind.config.js` ni `client/public/fonts/fonts.css`.
Evidencia: test `fontsConfig.test.js` (barrido de archivos) + `grep -rn` vacío citado.

### R5
El sistema DEBE eliminar de `client/public/fonts/` los `woff2` de Cinzel (600, 800), Alegreya Sans (400, 700) y Alegreya Sans SC 500 y dejar `README.md` con la licencia solo de las familias restantes.
Evidencia: `ls client/public/fonts` citado (4 `woff2`: `IMFellEnglish-400`, `IMFellEnglish-400i`, `IMFellEnglishSC-400`, `AlegreyaSansSC-700`, más `fonts.css` y `README.md`) + `README.md`.

### R6
El sistema DEBE exponer en `client/tailwind.config.js` los 13 tokens `kh-*` de `ui-kit-b.md` §3 con sus hex exactos (`kh-ink`, `kh-oak`, `kh-oak-light`, `kh-iron`, `kh-brass`, `kh-brass-light`, `kh-bone`, `kh-bone-dim`, `kh-parchment`, `kh-parchment-ink`, `kh-seal`, `kh-ember`, `kh-macula`).
Evidencia: test `fontsConfig.test.js` que importa la config y compara los 13 pares nombre → hex.

### R7
El sistema DEBE exponer en `client/tailwind.config.js` `fontFamily.display` (`IM Fell English SC`), `fontFamily.body` (`IM Fell English`) y `fontFamily.numeric` (`Alegreya Sans SC`), todas con `serif` como último respaldo, y `fontFamily.medieval` como alias de `display`.
Evidencia: test `fontsConfig.test.js`.

### R8
El sistema DEBE aplicar al `body` la familia `body`, color `kh-bone`, fondo `kh-ink` y `font-size` base de 15 px, sin `Segoe UI`.
Evidencia: test `fontsConfig.test.js` sobre `client/src/styles/index.css` + Playwright (`getComputedStyle(document.body).fontFamily` empieza por `"IM Fell English"`).

### R9
El sistema DEBE reemplazar cada `fontFamily: 'MedievalSharp…'` inline de `client/src/components/**` por la clase `font-display`, sin cambiar otros estilos del elemento.
Evidencia: `grep -rn "fontFamily" client/src/components | grep -i medieval` vacío + R4 verde.

### R10
El sistema DEBE definir una constante única `UI_FONT` (`'IM Fell English SC', serif`) en `client/src/game/fonts.js` y usarla en todo texto Phaser que hoy usa `MedievalSharp` (`BootScene`, `NPC`, `Building`, `ParticleSystem`, `IsoWorldScene`).
Evidencia: test `fontsConfig.test.js` (importa `UI_FONT`) + R4 verde.

### R11
CUANDO `BootScene` inicia, el sistema DEBE esperar `document.fonts.load` de `IM Fell English` y `IM Fell English SC` antes de crear su primer texto.
Evidencia: test Vitest de `loadUiFonts()` con `document.fonts` simulado (orden: carga → resuelve) + Playwright: el texto "Cargando..." se pinta con IM Fell.

### R12
SI la carga de fuentes rechaza o supera 3 000 ms ENTONCES el sistema DEBE continuar el arranque con el respaldo `serif` sin lanzar excepción.
Evidencia: test Vitest de `loadUiFonts()` con rechazo y con temporizador falso (resuelve sin throw).

### R13
El sistema DEBE documentar en `specs/ui_kit_b/evidencia/digitos.md` la prueba de legibilidad de dígitos de `TopResourceBar` a 412 px (captura con IM Fell y captura con `font-numeric`) y el veredicto de p-kh/owner (`im-fell` o `font-numeric`).
Evidencia: `evidencia/digitos.md` + capturas `digitos_im_fell.webp` y `digitos_numeric.webp`.

### R14
CUANDO `evidencia/digitos.md` registre el veredicto `font-numeric`, el sistema DEBE aplicar `font-numeric` solo a los números de los contadores del chrome.
Evidencia: test de render de `TopResourceBar` (clase `font-numeric` en el `<span>` numérico) o, si el veredicto es `im-fell`, ausencia de la clase; el veredicto citado.

### R15
El sistema DEBE reapuntar `kingdom.*` en `client/tailwind.config.js` a los valores de los tokens `kh-*` equivalentes (design §2.3), sin renombrar ninguna clase `kingdom-*` existente.
Evidencia: test `fontsConfig.test.js` (mapa `kingdom.*` → hex `kh-*`) + `npm run build` sin errores.

### R16
CUANDO se sirve el cliente con `NODE_ENV=production`, el sistema NO DEBE solicitar ningún recurso de fuentes a un origen distinto del propio ni producir errores de CSP.
Evidencia: Playwright contra el server prod local: lista de requests (0 a hosts externos de fuentes) + `consola.txt` sin errores de CSP.

## Etapa B — Componentes del kit y contadores

### R17
El sistema DEBE proveer `Panel` en `client/src/components/ui/Panel.jsx` con variantes `oak` (por defecto) y `parchment`.
Evidencia: test Vitest de render (`data-variant`).

### R18
El sistema DEBE dibujar `Panel` `oak` con `border-image` 9-slice de `/assets/b/ui/panel_frame.webp`, masa `kh-oak`, sombra `kh-ink` y sin `backdrop-filter`.
Evidencia: test de render (estilo `borderImageSource` apunta a `panel_frame.webp`) + captura Playwright.

### R19
El sistema DEBE dibujar `Panel` `parchment` con fondo `kh-parchment` y texto `kh-parchment-ink`.
Evidencia: test de render.

### R20
CUANDO `Panel` recibe `onClose`, el sistema DEBE renderizar un botón con `aria-label="Cerrar"` de al menos 44×44 CSS px cuyo glifo se dibuja con CSS (sin carácter de texto).
Evidencia: test de render (aria-label, `min-width`/`min-height` 44, sin texto).

### R21
El sistema DEBE proveer `Button` con variante `primary` (9-slice `btn_red.webp`) y variante `secondary` (9-slice `btn_stone.webp`), tipografía `font-display` de 16 px.
Evidencia: test de render (`borderImageSource` por variante).

### R22
El sistema DEBE dar a `Button` e `IconButton` un tamaño mínimo de 44×44 CSS px.
Evidencia: test de render (`min-height`/`min-width` ≥ 44).

### R23
MIENTRAS un `Button` está deshabilitado, el sistema DEBE aplicar `filter: saturate(0.4)` (desaturado 60 %), borde `kh-iron` y `pointer-events: none`.
Evidencia: test de render (`disabled`, estilo).

### R24
CUANDO un `Button` recibe hover o `:active`, el sistema DEBE oscurecer la masa y pintar el borde con `kh-brass-light`.
Evidencia: reglas CSS de `index.css`/clases del kit citadas en el test (`.kh-btn:hover`, `.kh-btn:active`) + captura Playwright de un botón en `:hover`.

### R25
El sistema DEBE proveer `IconButton` (botón de riel: escudete de hierro con ícono del set y etiqueta `font-display` debajo) con ícono de al menos 28 CSS px.
Evidencia: test de render (`SpriteIcon size ≥ 28`, etiqueta presente).

### R26
El sistema DEBE proveer `Bar` en `client/src/components/ui/Bar.jsx` que pinte `bar_frame.webp` como 9-slice y un relleno del color del token elegido por `tone` (`ember` progreso, `seal` vida, `macula` corrupción).
Evidencia: test de render (color de relleno por `tone`).

### R27
El sistema DEBE limitar el valor de `Bar` al rango 0–100 y exponerlo con `role="progressbar"` y `aria-valuenow`.
Evidencia: test de render con valores −5, 40 y 130.

### R28
El sistema DEBE proveer `PortraitRing` en `client/src/components/ui/PortraitRing.jsx` que pinte `portrait_ring.webp` sobre la imagen enmascarada por CSS y, SI no recibe `src`, un centro `kh-oak` sin imagen rota.
Evidencia: test de render con y sin `src`.

### R29
El sistema NO DEBE usar `linear-gradient` ni `radial-gradient` en `client/src/components/ui/{Panel,Button,IconButton,Bar,PortraitRing}.jsx`, ni en `.btn-primary`, `.btn-gold`, `.game-card`, `.progress-bar` y `.progress-fill` de `client/src/styles/index.css`.
Evidencia: test `kitStyles.test.js` (búsqueda de `gradient` en esos archivos/reglas).

### R30
El sistema DEBE mantener `.btn-primary`, `.btn-gold`, `.game-card`, `.progress-bar` y `.progress-fill` con su nombre de clase, reimplementados con tokens `kh-*` y las piezas 9-slice, de modo que sus consumidores existentes no cambien de JSX.
Evidencia: `grep` de las 5 clases en `components/` (consumidores intactos) + test `kitStyles.test.js`.

### R31
El sistema NO DEBE modificar `server/`, `shared/`, `client/src/store/` ni `client/src/services/` en la Etapa B.
Evidencia: `git diff --stat feature/ui_kit_b~N -- server shared client/src/store client/src/services` vacío (N = commits de la etapa).

### R32
El sistema DEBE renderizar `TopResourceBar` sin desbordamiento horizontal a 412 px de ancho.
Evidencia: Playwright 412×860 @2x: `scrollWidth <= clientWidth` de la barra y de la fila de despensa + captura `evidencia/barra_412.webp`.

### R33
El sistema DEBE renderizar en `TopResourceBar` los contadores `wood`, `stone`, `wheat`, `iron`, `egg`, `milk`, `wool` y `carrot`, cada uno con `data-resource="<clave>"`, incluso con valor 0.
Evidencia: test de render (8 `[data-resource]`) + `pickupSources.test.jsx` de `hub_b_recoleccion` en verde.

### R34
El sistema DEBE pintar el ícono de cada contador de `TopResourceBar` con `SpriteIcon` de al menos 28 CSS px y su número con al menos 12 px.
Evidencia: test de render (`size` del ícono y clase de tamaño del número).

### R35
El sistema DEBE pintar con `Bar` las barras de progreso de `TopResourceBar` (XP), `GameHUD` (XP), `ConstructionTimer`, `AchievementPanel`, `meta/AchievementsPanel` y `CombatInstancePanel` (HP enemigo y energía).
Evidencia: test de render por componente (`role="progressbar"`) + `grep` de `progress-fill`/`style={{ width:` inline vacío en esos 6 archivos.

### R36
El sistema DEBE componer `GenericPanel` (`OverlayManager.jsx`), `BottomNavBar`, `QuickActionsSidebar`, `EventSidebar`, `SocialSidebar` y `TopResourceBar` con `Panel`, `IconButton` y `Bar`, sin importar `grimChrome`, y eliminar `client/src/components/hud/grimChrome.js`.
Evidencia: `grep -rn "grimChrome\|grimBar\|grimBtn" client/src` vacío + `OverlayManager.test.jsx` en verde.

### R37
El sistema DEBE conservar en la Etapa B los textos, handlers, datos y llamadas de cada componente tocado, de modo que `cd client && npx vitest run` complete sin fallos nuevos.
Evidencia: salida completa de `cd client && npx vitest run` citada (`known_failures` vacío).

## Etapa C — Set de íconos B, puerta de arte y reemplazo de emojis

### R38
El sistema DEBE publicar el set nuevo como `client/public/assets/b/ui/icons.webp` con celda de 192 px y grilla de 8 columnas, y `grimIconSheet.generated.js` DEBE apuntar a ella (`GRIM_CELL = 192`, `GRIM_SHEET`/`_W`/`_H` coherentes con la imagen).
Evidencia: test `iconSheet.test.js` (constantes ↔ dimensiones leídas del `webp`).

### R39
El sistema DEBE conservar los 65 nombres contrato de `GRIM_ICONS` con la misma `{ col, row }` y agregar los nombres nuevos (design §7.2) solo al final.
Evidencia: test `iconSheet.test.js` (lista fija de 65 nombres con su celda; nombres nuevos con índice posterior).

### R40
El sistema DEBE mantener cada celda de `GRIM_ICONS` dentro de los límites de la hoja y cada celda no vacía.
Evidencia: test `iconSheet.test.js` (límites y píxeles no transparentes por celda leyendo el `webp`).

### R41
El sistema DEBE obtener los íconos de edificio del set (`castle`←`throne_room.webp`, `farmhouse`←`house.webp`, y `market`, `tower`, `barracks`, `tavern`, `mill`, `wall`, `trap`, `stable`, `sawmill`, `barn`, más los nombres nuevos `mine`, `smithy`, `library`, `embassy`, `farm_plot`) recortando `client/public/assets/b/buildings/*.webp` con un script, sin generarlos con IA.
Evidencia: `scripts/crop_building_icons.js` + salida citada (17 recortes) + `git diff` de `art-b/uikit/manifest.json` sin entradas de edificios.

### R42
El sistema DEBE producir una hoja de contacto de todos los íconos del set a 24, 32 y 48 px sobre `kh-oak` en `specs/ui_kit_b/evidencia/iconos_contacto.webp`.
Evidencia: archivo generado por `scripts/contact_sheet_b.js` (o variante) citado.

### R43
El sistema NO DEBE integrar la hoja nueva (cambiar `GRIM_SHEET` en el repo) antes de que `specs/ui_kit_b/evidencia/aprobacion_arte.md` registre la aprobación explícita de p-kh sobre `iconos_contacto.webp`.
Evidencia: `aprobacion_arte.md` con fecha, autor `p-kh` y veredicto `APROBADO`, y orden de commits (`git log`) con la aprobación anterior a la integración.

### R44
El sistema DEBE generar los íconos estilo B según `ui-kit-b.md` §6.1 (un objeto por ícono, sin halos, sin texto, sin marcos ni círculos, canto iluminado en objetos oscuros, sin verde de la Mácula en objetos comunes, luz arriba-izquierda) con entradas en `art-b/uikit/manifest.json`.
Evidencia: entradas de manifest con el bloque de reglas + `aprobacion_arte.md` (R43) que cubre esos criterios visuales.

### R45
El sistema DEBE dar a `kh_token` un ícono único (sello-medallón de bronce con gavilla, corona y gota de lacre) y NO DEBE resolver ningún otro nombre ni alias de `spriteMap` a su celda (se elimina `nav_token → kh_token` de `GRIM_ALIASES`).
Evidencia: test `iconSheet.test.js` (ningún alias de `GRIM_ALIASES` apunta a `kh_token`; ningún otro nombre comparte celda) + revisión de p-kh en `aprobacion_arte.md`.

### R46
El sistema DEBE resolver los 6 `enemy_*` desde `client/public/assets/sprites/enemy_icons_legacy.png` (recorte del set viejo) y registrarlos en `design.md` §7.4 como placeholder diferido a `combate_b`.
Evidencia: test `iconSheet.test.js` (`getSprite('enemy_coloso')` apunta a la tira legacy) + §7.4.

### R47
El sistema DEBE renderizar `SpriteIcon` con `image-rendering: auto` y, SI el nombre no existe en el set, un recuadro vacío con `data-missing-icon` sin texto ni emoji.
Evidencia: test de render de `SpriteIcon` (estilo y caso de nombre inexistente).

### R48
El sistema DEBE eliminar `client/public/assets/sprites/grim_icons.png` y `scripts/gen_icons.sh` y no dejar ninguna referencia a ellos.
Evidencia: `grep -rn "grim_icons\|gen_icons" client scripts docs package.json` vacío (salvo historial) + archivos ausentes.

### R49
El sistema DEBE incluir un test `client/src/tests/noEmoji.test.js` que falle si algún archivo de `client/src/components/`, `client/src/store/` o `client/src/services/` contiene un emoji fuera de la lista blanca.
Evidencia: el test en verde + una corrida de control que lo hace fallar con un emoji de prueba (salida citada).

### R50
El sistema DEBE restringir la lista blanca de `noEmoji.test.js` a los `CHAT_STICKERS` de `meta/AlliancesPanel.jsx` (stickers de chat de jugadores), con un comentario que justifique cada entrada.
Evidencia: lista blanca en el test (1 entrada) + comentario.

### R51
El sistema DEBE reemplazar por `SpriteIcon` con el nombre de la tabla de design §6 cada emoji de `client/src/components/**` que tenga equivalente, y quitar el resto dejando el texto.
Evidencia: R49 verde + `git diff` de componentes por grupo citado en `tasks.md`.

### R52
El sistema DEBE reemplazar el campo `icon` con emoji de los catálogos del cliente (`BUILDING` de `BuildingInfoPopup`, `BuildingToolbar`; `RESOURCE_ICONS`; `FACTION_META`; `TYPE_ICON`; `ACH_META`; mapas de terreno y de cultivos) por un nombre del set, sin cambiar ningún id de dato.
Evidencia: R49 verde + test de `BuildingInfoPopup` + `grep` de ids de catálogo sin diff (`git diff` de las claves).

### R53
El sistema DEBE retirar el emoji de los textos de notificación de `client/src/store/gameStore.js`, `client/src/services/socketService.js` y `client/src/services/api.js`, conservando el resto del texto y el `type` de cada notificación.
Evidencia: R49 verde + `pickupSources.test.jsx` y `gameStore.test.js` en verde.

### R54
El sistema NO DEBE pasar la prop `fallback` a `SpriteIcon` en `client/src/components/**`.
Evidencia: `grep -rn "fallback=" client/src/components` sin resultados sobre `SpriteIcon` (test `noEmoji.test.js` lo comprueba).

### R55
El sistema NO DEBE usar `SpriteIcon` con `size` literal menor de 28 en `client/src/components/**`.
Evidencia: test `noEmoji.test.js` (barrido de `size={N}` con N < 28).

### R56
El sistema DEBE guardar en `specs/ui_kit_b/evidencia/` capturas Playwright 412×860 @2x, antes y después, del hub y de 4 paneles (construir, héroes, mercado, ajustes).
Evidencia: 10 archivos `*_antes.webp`/`*_despues.webp` (hub + 4 paneles × 2) generados por `scripts/ui_kit_b_evidence.js`.

### R57
El sistema DEBE terminar cada captura de R56 y R32 con la consola del navegador sin errores.
Evidencia: `evidencia/consola.txt` (0 `pageerror`, 0 `console.error`, 0 respuestas HTTP ≥ 400 no esperadas).

### R58
El sistema DEBE completar `cd client && npx vitest run`, `cd client && npm run build` y `cd server && npx jest --runInBand --forceExit` sin fallos nuevos al cierre de cada etapa.
Evidencia: salidas completas citadas (`Tests N passed`) por etapa; `known_failures` vacío.
