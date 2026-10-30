# pantallas_b — Requirements

Feature 9 (B4): resto de pantallas en estilo B. Solo cliente (`client/src/components`, `styles`, `tests`, `public/assets/b`); sin server, sin `game/`, sin cambios de copy.
Lista explícita de pantallas **en alcance** (define «principales» del acceptance): `MainMenu`, `HeroPanel`, `SystemMapPanel`, `GalaxyMapPanel`, el bloque de resultado de `CombatInstancePanel`, `WarPanel` y `TerritoryMapPanel`, `MissionsPanel`, `TechTreePanel`, y los switches de `SettingsPanel` y `NotificationPrefsPanel`. Todo lo demás está fuera (ver `design.md` §9).
«Archivos en alcance» (AA) = los `.jsx` de esa lista + `components/ui/ResultBanner.jsx` y `components/ui/Toggle.jsx`.
Contraste: WCAG 2.x, calculado con el helper del test T3 sobre los tokens `kh` (`kitPieces.js` `KH`). Medido hoy (calculado, no a ojo): `text-gray-500` sobre `kh-oak` = 3.27:1; `text-gray-600` = 2.09:1; `kh-seal` como texto sobre `kh-oak` = 1.53:1; `kh-bone-dim` sobre `kh-oak` = 5.83:1; sobre `kh-oak-light` = 4.71:1; sobre `kh-iron` = 3.28:1.

## A. Preservar lo ganado en #24 (marco, bandas, un solo alto)

- **R1** — El sistema NO DEBE usar `h-screen`, `w-screen`, `100vh` ni unidades `vh`/`dvh`/`svh`/`vw` (en clases arbitrarias o en `style`) en los archivos en alcance. Criterio: el barrido del test T3 devuelve 0 coincidencias en AA.
- **R2** — El sistema DEBE expresar los topes de alto en alcance como `calc(var(--kh-frame-h) * k)` con `k` igual a la fracción actual: `GalaxyMapPanel.jsx:70` y `SystemMapPanel.jsx:77` (0.80), `HeroPanel.jsx:365`, `MissionsPanel.jsx:37` y `SettingsPanel.jsx:116` (0.75), `WarPanel.jsx:441` (0.65), `NotificationPrefsPanel.jsx:37` (0.80), `CombatInstancePanel.jsx:143` (36vh/29vh de las figuras del diorama, mismo criterio sobre `--kh-frame-h`). Criterio: test T3 por panel (`maxHeight`/clase contiene `var(--kh-frame-h)`); patrón ya usado en `ShopPanel.jsx:64`.
- **R3** — El sistema DEBE montar `MainMenu` con `w-full h-full` dentro de `.kh-frame` y con padding `var(--kh-safe-top)` / `var(--kh-safe-bottom)`. Criterio: test de render lee esas clases/estilos; captura 360×800 muestra los botones dentro de la banda.
- **R4** — MIENTRAS el aspecto del viewport sea mayor que 2.1 (360×800 = 2.22, 412×915 = 2.22), el sistema NO DEBE dibujar ningún elemento de AA fuera del `.kh-frame`. Criterio: en la captura, `getBoundingClientRect` de la raíz de cada pantalla cumple `top ≥ --kh-band` y `bottom ≤ --kh-band + --kh-frame-h`; queda en `reporte.json`.
- **R5** — El sistema NO DEBE modificar `utils/viewport.js`, `AppFrame.jsx` ni el bloque `:root` / `.kh-shell` / `.kh-frame` de `index.css:381-404`. Criterio: `git diff` de esas rutas/rango vacío; `viewport.test.js` en verde sin editarse.
- **R6** — El sistema NO DEBE alterar el flujo de montaje: `menuDismissed` (`App.jsx:220`), `?menu=1` y `?panel=system|galaxy` (`App.jsx:171-176`) siguen funcionando. Criterio: `OverlayManager.test.jsx` en verde y captura de `?menu=1`.

## B. Kit y paleta (contrato visual B)

- **R7** — El sistema DEBE montar el contenedor de cada panel en alcance con `Panel` del kit (`components/ui/Panel.jsx`). `TechTreePanel` ya lo hereda de `GenericPanel` (`OverlayManager.jsx:223-228`) y `TerritoryMapPanel` del contenedor de `MetaPanel` (fuera de alcance, §9 de design). Criterio: test de render: Galaxy, System, Hero, Missions, Settings, War y NotificationPrefs contienen `.kh-panel`; ningún AA define `border: '1px solid rgba('`.
- **R8** — El sistema DEBE cerrar los paneles en alcance con `Panel onClose` (`.kh-close`, 44×44). Criterio: ningún AA contiene el glifo `✕` ni `✓`; el botón de cierre mide ≥ 44×44 en la captura.
- **R9** — El sistema DEBE usar `Button` del kit (`variant` `primary`/`secondary`) para toda acción de AA. Criterio: ningún AA contiene `btn-gold`, `btn-primary` ni `bg-gradient-to-`.
- **R10** — El sistema NO DEBE usar colores fuera de los tokens `kh` en AA. Criterio: el barrido del test T3 devuelve 0 coincidencias de `(text|bg|border|from|to|ring|accent)-(purple|cyan|teal|green|blue|gray|red|yellow)-` y de los hex `#16a34a`, `#4ade80`, `#4fd8c8`, `#a855f7`, `#3b82f6`.
- **R11** — El sistema DEBE comunicar el éxito con `kh-brass-light` más texto, y la derrota con fondo `kh-seal` y texto `kh-bone`, sin verde ni rojo de Tailwind. Criterio: test de render de `ResultBanner` (§C) y de los estados de mapa; contraste del texto de derrota `kh-bone` sobre `kh-seal` = 7.55:1 (≥ 4.5).
- **R12** — El sistema NO DEBE comunicar un estado solo con el color. Criterio: cada estado de plaza (`STATE_STYLE` de los dos mapas) y cada rareza de héroe tiene etiqueta de texto visible (test de render sobre todos los estados).
- **R13** — El sistema NO DEBE introducir emojis ni íconos fuera de la hoja `SpriteIcon` en AA. Criterio: `noEmoji.test.js` en verde y cada `SpriteIcon` nuevo con `size ≥ 28`.
- **R14** — El sistema DEBE dar a todo control interactivo de AA un área táctil mínima de 44×44 CSS px. Criterio: en la captura 360×740, `getBoundingClientRect` de cada `button` de AA cumple `width ≥ 44` y `height ≥ 44` (excepciones listadas en el reporte).

## C. Resultados: victoria, derrota, botín

- **R15** — El sistema DEBE ofrecer un componente `ResultBanner` en `components/ui/ResultBanner.jsx` con props `outcome` (`'victory'|'defeat'`), `title`, `children` (botín) y `onClose`, montado sobre `Panel variant="parchment"` como `components/overlay/OfflineReportModal.jsx`. Criterio: `kitComponents.test.jsx` (o test nuevo) lo renderiza en los dos `outcome`.
- **R16** — El sistema DEBE renderizar `ResultBanner` con `role="status"` y un único `Button` de cierre. Criterio: test consulta `getByRole('status')` y `getAllByRole('button')` con longitud 1.
- **R17** — CUANDO `CombatInstancePanel` termine una instancia, el sistema DEBE mostrar el resultado con `ResultBanner` (hoy `CombatInstancePanel.jsx:233-240`). Criterio: test de render con `result='victory'` y `'defeat'` encuentra el título «¡Victoria!» / «Derrota» dentro de `ResultBanner`.
- **R18** — CUANDO `CombatInstancePanel` muestre victoria, el sistema DEBE conservar la fanfarria `EmberField` (`:250`). Criterio: test de render con `victory` encuentra `EmberField`; con `defeat` encuentra el velo de lacre y no `EmberField`.
- **R19** — CUANDO `WarPanel` muestre el resultado de una guerra (hoy `WarPanel.jsx:255-279`), el sistema DEBE usar `ResultBanner` con el botín como `children`. Criterio: test de render con `won=true` y `won=false`.
- **R20** — CUANDO `TerritoryMapPanel` muestre el resultado de un ataque (hoy `:178-200`), el sistema DEBE usar `ResultBanner`. Criterio: test de render con `winner` `attacker` y `defender`.
- **R21** — El sistema NO DEBE cambiar los textos de resultado, botín y botones de vuelta. Criterio: `fixTextosUi.test.jsx` en verde y el diff de copy (`git diff` filtrado por literales entre comillas) sin cambios de texto visible, salvo los listados en `design.md` §7.

## D. Menú principal

- **R22** — El sistema DEBE pintar `MainMenu` con `Button primary` para «Entrar al Bastión» y `Button secondary` para las demás acciones, título en `font-display` y `kh-bone`/`kh-brass-light`, y textos secundarios en `kh-bone-dim`. Criterio: test de render del menú.
- **R23** — DONDE el owner apruebe el arte (Q1), el sistema DEBE servir el key art desde `client/public/assets/b/menu/key_art.webp`, trackeado en git y con peso ≤ 250 KB. Criterio: `git ls-files` lo lista; `ls -l` ≤ 250 KB; hoja de contacto en `evidencia/` y `aprobacion_arte.md` con veredicto `APROBADO`.
- **R24** — SI el key art falta, ENTONCES `MainMenu` DEBE mostrar fondo plano `kh-ink` con los botones legibles. Criterio: test de render sin imagen: `backgroundColor` = `#14110d`, textos ≥ 4.5:1 (helper de contraste).
- **R25** — El sistema NO DEBE referenciar `/assets/game/ambient/menu_bg.png`, `system_bg.png`, `galaxy_bg.png` ni `world_map_bg.png`. Criterio: `grep` en `client/src` devuelve 0 coincidencias.

## E. Roster de héroes

- **R26** — El sistema DEBE mostrar el retrato de cada héroe dentro de `PortraitRing` usando `/assets/game/heroes/<id>.png`. Criterio: test de render del roster con 3 héroes encuentra 3 `.kh-ring` con `img`.
- **R27** — SI la imagen del retrato falla, ENTONCES el sistema DEBE mostrar `CharacterSprite` dentro del mismo anillo, sin imagen rota. Criterio: test dispara `error` sobre la `img` y verifica que desaparece y aparece el sprite.
- **R28** — El sistema DEBE mostrar la rareza (`hero.rarity`, hoy `HeroPanel.jsx:108,150`) siempre con texto visible y con un borde de token `kh` (`common`=`iron`, `rare`=`brass`, `epic`=`ember`, `legendary`=`brass-light`), sin teal, naranja de Tailwind ni amarillo de Tailwind. Criterio: test de render por las 4 rarezas de `HERO_RARITIES` (`shared/gameConfig.js:965`) verifica el borde y que el texto no está vacío; la traducción del texto es Q5.
- **R29** — El sistema DEBE pintar las barras de estadística con `Bar` del kit. Criterio: test de render encuentra 5 `role="progressbar"` por héroe seleccionado; ningún AA contiene `bg-gray-700`.
- **R30** — El sistema DEBE pintar los estados vacíos del roster («Sin héroes» `HeroPanel.jsx:431`, «Seleccioná un héroe» `:465`, «— vacío —» `:253`, «Sin desplegar» `:196-197`) con `kh-bone-dim` y tamaño ≥ 12 px. Criterio: contraste calculado ≥ 4.5:1 (5.83:1 sobre oak) y barrido sin `text-gray-500|600`.

## F. Mapas de la Marca y de los Reinos Caídos

- **R31** — El sistema DEBE pintar los estados de plaza de ambos mapas con tokens `kh`: dominada/controlada = `brass-light`, disponible/alcanzable = `brass`, en tránsito = `ember`, bloqueada/fuera de alcance = anillo `iron` con etiqueta `bone-dim`. Criterio: test lee `STATE_STYLE` de los dos mapas y verifica que todo valor ∈ `KH`.
- **R32** — DONDE el owner apruebe el arte (Q2), el sistema DEBE servir los fondos desde `client/public/assets/b/map/marca.webp` y `reinos.webp`, trackeados en git y de ≤ 250 KB cada uno. Criterio: `git ls-files`, `ls -l`, hoja de contacto y `aprobacion_arte.md`.
- **R33** — SI un fondo de mapa falta, ENTONCES el panel DEBE mostrar `kh-oak` plano con texto ≥ 4.5:1. Criterio: test de render sin imagen.
- **R34** — El sistema DEBE dibujar sobre el fondo de mapa una capa oscura tal que el texto `kh-bone` y `kh-bone-dim` mantenga ≥ 4.5:1. Criterio: contraste medido sobre la captura (píxel más claro del fondo bajo la capa) en `reporte.json`.
- **R35** — El sistema NO DEBE usar morado ni cian en `GalaxyMapPanel` y `SystemMapPanel` (el acento del Velo usa `kh-macula` solo en filetes decorativos, Q6). Criterio: cubierto por R10 y test de render del panel con `macula` solo en elementos con `aria-hidden`.
- **R36** — CUANDO el jugador pulse «Sistema»/«Reinos Caídos» en un mapa, el sistema DEBE seguir abriendo el otro mapa (`setOverlay`). Criterio: test de render pulsa el botón y verifica la llamada (`GalaxyMapPanel.jsx:83`, `SystemMapPanel.jsx:91`).

## G. Hallazgos de HALLAZGOS.md asignados a F9

- **R37** — El sistema DEBE ofrecer `components/ui/Toggle.jsx` con `role="switch"` y `aria-checked`, pista encendida `kh-brass-light`, apagada `kh-iron` y perilla `kh-bone`. Criterio: test de render en los dos estados; contraste pista encendida/apagada calculado = 4.65:1 (≥ 3:1).
- **R38** — El sistema DEBE usar `Toggle` en `SettingsPanel` (hoy `:130-144` y `Toggle` local `:209`) y en `NotificationPrefsPanel` (`:80`). Criterio: ningún archivo contiene `#16a34a` ni `#4ade80`; `superposicionesUi.test.jsx` (renderiza `SettingsPanel`, `:76`) sigue en verde.
- **R39** — El sistema DEBE pintar la pestaña activa de Investigación con `kh-oak-light`, borde `kh-brass-light` y texto `kh-bone` (hoy `TechTreePanel.jsx:55`, `bg-purple-700`). Criterio: test de render: la pestaña activa no contiene clases `purple`.
- **R40** — El sistema DEBE pintar la pestaña inactiva de Investigación con `kh-oak`, borde `kh-iron` y texto `kh-bone-dim` (5.83:1 sobre oak), con texto ≥ 12 px. Criterio: contraste calculado ≥ 4.5:1; la clase de texto no es `text-[11px]`.
- **R41** — El sistema DEBE mostrar completo el nombre de la rama «Arte de la Guerra» (`shared/gameConfig.js:534-537`) en la pestaña, en 2 líneas como máximo, a 360 px de ancho. Criterio: en la captura 360×740 la pestaña mide ≥ 44 de alto y `scrollHeight ≤ clientHeight`.
- **R42** — El sistema DEBE pintar el bloque «en progreso» y las ramas completadas de Investigación con tokens `kh` (hoy `:66-68, :84, :91, :98`). Criterio: cubierto por R10 sobre `TechTreePanel.jsx`.
- **R43** — El sistema DEBE pintar el estado vacío de Misiones (`MissionsPanel.jsx:49-50`) con `kh-bone-dim` y tamaño ≥ 12 px, y su botón verde de reclamar (`:117`) con `Button primary`. Criterio: contraste ≥ 4.5:1; cubierto por R9/R10.
- **R44** — El sistema DEBE ofrecer pestañas con la clase compartida `.kh-tab` / `.kh-tab--active` en `styles/index.css`, usada por `HeroPanel` (Stats/Equipar, hoy `:216`) y `TechTreePanel`. Criterio: `kitStyles.test.js` encuentra las dos clases con `min-height: 44px`; ambos paneles las usan.

## H. Cierre y regresión

- **R45** — El sistema DEBE incluir un test `client/src/tests/pantallasB.test.jsx` con los barridos de R1, R2, R8, R9, R10, R25 y R38 sobre AA. Criterio: el test existe, falla si se reintroduce un patrón prohibido (demostrado en T3) y pasa al cerrar.
- **R46** — El sistema NO DEBE modificar `server/`, `shared/` ni `client/src/game/`. Criterio: `git diff --stat` contra `feat/art-direction-b` no lista esas rutas.
- **R47** — El sistema DEBE terminar con las suites completas en verde: `cd server && npx jest --runInBand --forceExit` y `cd client && npx vitest run`, y con `cd client && npm run build` sin errores. Criterio: contadores `Tests: N passed` citados; línea base 393 server / 401 client (el client suma los tests nuevos).
- **R48** — El sistema DEBE dejar evidencia visual antes/después de cada pantalla en alcance en `specs/pantallas_b/evidencia/` (webp ≤ 1080 px), generada con `D:/Proyectos/_ops/capturas/capturar.mjs` en 360×740, 360×800 y 412×915, más `reporte.json` con los números de R4, R14, R34 y R41. Criterio: los archivos existen y cada uno tiene una línea de qué verifica en `tasks.md`.
