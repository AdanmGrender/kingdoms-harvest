# pantallas_b — Tasks

Orden de ejecución. Nada se marca `[x]` sin `Evidencia:` inline (comando + contador, o ruta en `specs/pantallas_b/evidencia/`). Preparación de entorno de capturas: igual que `specs/fix_pantalla_movil/tasks.md` (Vite :5173 con `_preview/client/vite.preview.config.js` sin commitear, `adb reverse tcp:5180 tcp:5173`, restaurar al final). Puertos :5180 y :3101 son del owner. Antes de empezar: respuestas del owner a Q1–Q8 en la tarea [GATE].

- [x] T1 — Línea base «antes»: `node D:/Proyectos/_ops/capturas/capturar.mjs --pantallas menu,heroes,operations,missions,tech,settings --tag pantallas_b_antes` en 360×740, 360×800 y 412×915, más las capturas de `?panel=system`, `?panel=galaxy`, y un resultado de combate, guerra y territorio (mocks o estado de prueba). Guardar webp ≤ 1080 px y `reporte.json` en `evidencia/antes/`. Cubre: R48.
  Evidencia: `capturar.mjs --tag pantallas_b_antes --disp galaxy-a-360x740,android-360x800,pixel7-412x915 --pantallas menu,heroes,operations,missions,tech,settings,system,galaxy` → 25 webp (≤1080 px, q70) + reporte.json en `specs/pantallas_b/evidencia/antes/` (680 KB), `"errores": []` en los 3 dispositivos. Parcial: capturar.mjs no tiene mocks de resultado de combate/guerra/territorio → se cubren con tests de render de ResultBanner (T8) y capturas manuales en T10.

- [x] T2 — Piezas del kit: `components/ui/Toggle.jsx`, `components/ui/ResultBanner.jsx`, `.kh-tab` / `.kh-tab--active` en `styles/index.css` (junto a `.kh-btn`), con tests en `kitComponents.test.jsx` y `kitStyles.test.js` (los dos `outcome`, `role="status"`, un solo botón, `role="switch"`/`aria-checked`, `min-height: 44px`, contraste del par pista encendida/apagada ≥ 3:1). Cubre: R15, R16, R37, R44, R13.
  Evidencia: `Toggle.jsx`, `ResultBanner.jsx`, `.kh-tab`/`.kh-tab--active` en index.css (tras `.kh-btn`), helper `tests/helpers/contrast.js`; `npx vitest run src/tests/kitComponents.test.jsx src/tests/kitStyles.test.js` → 2 files, 40 passed.

- [x] T3 — Test de regresión `client/src/tests/pantallasB.test.jsx` con los barridos sobre los archivos en alcance (`vh/dvh/svh/vw/h-screen`, `calc(var(--kh-frame-h)`, `✕`/`✓`, `btn-gold|btn-primary|bg-gradient-to-`, colores Tailwind prohibidos y hex, rutas `*_bg.png`, `#16a34a|#4ade80`) y el helper de contraste WCAG usado por los tests de render. Debe fallar contra el código actual (demostración en rojo) y se pone en verde con T4–T9. Cubre: R45, R1, R2, R8, R9, R10, R25, R38.
  Evidencia: `client/src/tests/pantallasB.test.jsx` (barridos R1, R2, R7, R8, R9, R10, R25, R38). Rojo contra @1395f33: `npx vitest run src/tests/pantallasB.test.jsx` → 16 failed, p. ej. `SystemMapPanel.jsx:178 text-green-400 ✓`, `menu_bg.png` en MainMenu/Galaxy/System/Territory. Pasa a verde con T4–T9 (se confirma en T12).

- [ ] T4 — `SettingsPanel.jsx` (Toggle local `:207`, switches `:130-144`, slider `:198`) y `NotificationPrefsPanel.jsx` (`:37`, `:78-89`): usar `Toggle`, `accentColor` por token, `Panel`/`Button`, tope por `--kh-frame-h`, sin `✕`. `superposicionesUi.test.jsx` sigue en verde. Cubre: R2, R7, R8, R10, R14, R38.
  Evidencia:

- [ ] T5 — `TechTreePanel.jsx` (`:55`, `:66-68`, `:84`, `:91`, `:98`) y `MissionsPanel.jsx` (`:37`, `:44`, `:49-50`, `:117`): pestañas con `.kh-tab`, «Arte de la Guerra» en 2 líneas, banner y ramas con tokens, vacío en `bone-dim`, botón reclamar con `Button primary`, `Panel` con `onClose`. Cubre: R2, R7, R8, R9, R10, R39, R40, R41, R42, R43, R44.
  Evidencia:

- [ ] T6 — `HeroPanel.jsx`: `PortraitRing` con fallback (`:43-60`), `RARITY_COLORS` a tokens (`:10-14`) con texto de rareza visible (Q5), `Bar` para estadísticas, pestañas con `.kh-tab` (`:216`), estados vacíos en `bone-dim` (`:196-197`, `:253`, `:431`, `:465`), `Panel` con `onClose` y tope `--kh-frame-h` (`:365`, `:380`). Tests de render del roster (3 héroes, 4 rarezas, error de imagen). Cubre: R2, R7, R8, R10, R12, R14, R26, R27, R28, R29, R30, R44.
  Evidencia:

- [ ] T7 — `SystemMapPanel.jsx` (`:34-39`, `:77`, `:96`) y `GalaxyMapPanel.jsx` (`:30-35`, `:70`, `:87`): `STATE_STYLE` por tokens con las etiquetas actuales, `Panel` con `onClose`, tope por `--kh-frame-h`, fondo `oak` plano + capa oscura lista para el webp (constante con `onError` a `oak`), acento `macula` solo `aria-hidden`, botones entre mapas con `Button`. Tests de render de todos los estados y del cambio de mapa. Cubre: R2, R7, R8, R9, R10, R11, R12, R25, R31, R33, R34, R35, R36.
  Evidencia:

- [ ] T8 — Resultados con `ResultBanner`: `CombatInstancePanel.jsx:233-240` (+ `EmberField` solo en victoria, `:143` y `:116`), `WarPanel.jsx:255-279` (+ contenedor `:441-449`), `TerritoryMapPanel.jsx:178-200`. Textos y botones de vuelta sin cambios. Tests de render (victoria/derrota, con y sin botín). `fixTextosUi.test.jsx` sigue en verde. Cubre: R2, R9, R11, R15, R17, R18, R19, R20, R21.
  Evidencia:

- [ ] T9 — `MainMenu.jsx`: botones `Button`, tipografía y colores por token, padding `--kh-safe-*`, constante `MENU_KEY_ART` con fallback a `ink` y sin `menu_bg.png`. Test de render (con y sin imagen). `OverlayManager.test.jsx` y `?menu=1`/`?panel=` sin cambios. Cubre: R3, R6, R22, R24, R25.
  Evidencia:

- [ ] T10 — Captura «después» con el mismo comando que T1 (`--tag pantallas_b_despues`), mismas resoluciones y pantallas; volcar en `evidencia/despues/` y `reporte.json` con: bounding box dentro del frame (R4), área táctil ≥ 44 (R14), contraste de texto sobre capa de mapa (R34), alto de la pestaña «Arte de la Guerra» (R41). Comparar contra `evidencia/antes/` y anotar diferencias en `evidencia/comparacion.md`. Cubre: R4, R14, R34, R41, R48.
  Evidencia:

- [ ] T11 — Etapa E (arte, condicional a Q1/Q2): SOLO si el owner aprobó generar arte. Generar `menu/key_art.webp`, `map/marca.webp`, `map/reinos.webp` con `scripts/gen_art_b.js` / `scripts/process_art_b.js`; hoja de contacto y `evidencia/aprobacion_arte.md` con veredicto de p-kh (modelo: `specs/ui_kit_b/evidencia/aprobacion_arte.md`); ≤ 250 KB cada uno, trackeados en git; repetir T10 para menú y mapas. Si el owner dijo «no», anotar «N/A por Q1/Q2» aquí y los fallbacks planos quedan como estado final. Cubre: R23, R32, R34.
  Evidencia:

- [ ] T12 — Verificación final: `cd server && npx jest --runInBand --forceExit` (línea base 393 passed), `cd client && npx vitest run` (línea base 401 passed + tests nuevos), `cd client && npm run build` sin errores; `git diff --stat feat/art-direction-b` sin `server/`, `shared/`, `client/src/game/`, `AppFrame.jsx`, `viewport.js`, `index.css:381-404`; capturas finales de todas las pantallas en alcance comparadas contra la línea base `D:/Proyectos/_ops/capturas/2026-10-28-01-11_base/` y contra T1. Sin temporales ni TODOs. El reviewer agrega la línea de `CHANGELOG.md`. Cubre: R5, R46, R47, R48, R45.
  Evidencia:

## Bloqueado
