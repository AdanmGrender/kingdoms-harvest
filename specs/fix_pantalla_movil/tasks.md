# fix_pantalla_movil — Tasks

Regla: nada pasa a `[x]` sin `Evidencia:` inline. Orden obligatorio: T1 (línea base) antes de tocar código.
Evidencia en `specs/fix_pantalla_movil/evidencia/` (webp ≤ 1080 px, o png del emulador), más `reporte.json` citados por ruta.

Preparación de entorno (T1 y T10): Vite del worker en :5173 con la config sin commitear copiada de
`D:\Proyectos\kingdoms-harvest-wt\_preview\client\vite.preview.config.js` (port 5173, proxy `/api` y `/socket.io` → :3101).
No commitear esa config. Emulador: `adb reverse tcp:5180 tcp:5173` temporalmente y restaurar `adb reverse tcp:5180 tcp:5180` al final.
Cerrar el popup «Racha de 3 días» antes de medir.

- [ ] T1 — Línea base (sin tocar código): `node D:/Proyectos/_ops/capturas/capturar.mjs --url http://localhost:5173 --tag fix24_antes --pantallas hub,shop`; capturar el hub en el emulador (`bash D:/Proyectos/_ops/capturas/emulador.sh captura fix24_antes_hub`) y medir en Chrome del emulador con barras: alto visible vs. borde inferior de la botonera; en la tienda 360×740, qué mide el encabezado de `ShopPanel` (¿56?) y cuántos `canvas` hay en dev y en `vite build`+preview (P5). Cubre: R29, R30, R26, R-ND11.
- [ ] T2 — `client/index.html`: agregar `viewport-fit=cover` al meta viewport conservando el resto. Cubre: R9.
- [ ] T3 — Nuevo `client/src/utils/viewport.js` (`MAX_ASPECT`, `computeAppHeight`, `installViewportVars`) y `client/src/tests/viewport.test.js` (casos del design §6). Cubre: R3, R4, R5, R16, R-ND7, R-ND8.
- [ ] T4 — Nuevo `client/src/components/ui/AppFrame.jsx`; bloque de tokens y clases `.kh-shell`/`.kh-frame` al final de `index.css` (`--kh-app-h` con `@supports 100dvh`, `--kh-max-aspect`, `--kh-frame-h`, `--kh-band`, `--kh-safe-*`); `body min-height: var(--kh-app-h)`; `main.jsx` llama `installViewportVars()` y envuelve con `<AppFrame>`. Cubre: R1, R2, R10, R16, R17, R18, R19, R20, R-ND1, R-ND3.
- [ ] T5 — Reemplazar `w-screen h-screen`/`h-screen` por `w-full h-full`/`h-full` en `App.jsx` (`:178 :186 :194 :207 :226`), `MainMenu.jsx:23` y `LoadingScreen.jsx:6`; el barrido del test confirma 0 usos. Cubre: R1, R8.
- [ ] T6 — Safe-area: `TopResourceBar` (`paddingTop`), `BottomNavBar` (`paddingBottom`), `BastionHub` (`fixed`→`absolute`, `pt-32`, `pb-[84px]` con `calc`), `.kh-rail` (`top`, `left`/`right` con `calc`); cada `calc` conserva el valor actual como base. Cubre: R11, R12, R13, R14, R15, R-ND8.
- [ ] T7 — `ShopPanel.jsx`: contenedor `maxHeight: '78%'` + `flex flex-col`, encabezado `shrink-0`, scroller `flex-1 min-h-0` con `paddingBottom` de safe-area; sin tocar textos ni lógica. Cubre: R22, R23, R24, R25.
- [ ] T8 — `PhaserGame.jsx`: `ResizeObserver` sobre `#phaser-container` que invoca `handleResize` (con cleanup) y guard que elimina `<canvas>` residuales antes de `new Phaser.Game` y tras `destroy`. Cubre: R6, R27, R28, R-ND4.
- [ ] T9 — Revisar los overlays `position: fixed` (`OperationsMap`, `CombatInstancePanel`, `CalendarPanel`, `CodexPanel`, `GuildPanel`, `OfflineReportModal`, `PassPanel`, `PrestigePanel`, `SeasonalPanel`, `WithdrawalPanel`, `NotificationPrefsPanel`) con `contain: layout`: abrir cada uno a 360×740 y 412×915 y confirmar que cubren el marco y no se cortan; corregir solo clases de posicionamiento si hace falta. Cubre: R19, R30, R-ND1.
- [ ] T10 — Verificación final: (a) `cd client && npx vitest run` completo y `npm run build` (citar `Tests N passed`); (b) `node D:/Proyectos/_ops/capturas/capturar.mjs --url http://localhost:5173 --tag fix24_despues` (hub, shop y demás) en los 5 celulares: 0 ⚠ en `reporte.json` de hub y shop, 0 errores de consola nuevos; (c) comparar 360×740 y 375×667 contra `fix24_antes` (sin cambios visibles); (d) 1 canvas en dev, en build de producción y 0 tras desmontar (consola); (e) emulador `kh_pixel7`: `emulador.sh captura fix24_despues_hub` y `..._shop` con la fila inferior del hub completa; (f) restaurar `adb reverse tcp:5180 tcp:5180`, matar el Vite :5173; (g) `git diff --stat` sin `server/`, `shared/` ni tests existentes. Cubre: R7, R22, R26, R28, R29, R30, R31, R-ND2, R-ND5, R-ND6, R-ND9, R-ND10, R-ND11.
- [ ] T11 — `CHANGELOG.md` bajo `## [Unreleased]`: una línea (edición quirúrgica). Cubre: R-ND9.

## Bloqueado

