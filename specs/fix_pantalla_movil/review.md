# Review — fix_pantalla_movil (#24, feature 24)

Revisor: `reviewer` · Ronda 1 (lente artefacto, luego ejecución) · Rama `feature/fix_pantalla_movil` @ e0c60c5 (código en fcdfa66, cierre de tasks.md en e0c60c5).

## Veredicto
**APPROVED**

Condición operativa no bloqueante: el Vite del worker sigue escuchando en :5173 (PID 17640, ver Observaciones §4). Debe matarlo quien tenga el worktree (Central/implementer); no lo toqué.

## Trazabilidad

Revisé el diff `1e98312..HEAD` (base = último merge de `feat/art-direction-b`, incluye #25 y #26) y cada `R<n>` contra el código. Archivos y líneas según la rama actual.

| R | Verificación en el código | Evidencia |
|---|---|---|
| R1 | `index.css:400-402` `.kh-shell` height `var(--kh-app-h)`; `App.jsx:178,186,194,207,226` `w-full h-full`; `MainMenu.jsx:24`; `LoadingScreen.jsx:6` | `viewport.test.js:102-115` barrido 0 ocurrencias (ejecutado, pasa) |
| R2 | `index.css:381-386` `--kh-app-h:100vh` + `@supports (height: 100dvh)` → `100dvh` | `viewport.test.js:91-95` (pasa) |
| R3 | `viewport.js:11-19` `computeAppHeight`: min(stable, inner) si initData y stable>0 | `viewport.test.js:11-14` (pasa) |
| R4 | `viewport.js:36-41` listeners resize/orientationchange/viewportChanged | `viewport.test.js:44-80` (pasa) |
| R5 | `viewport.js:17` (`!supportsDvh` → innerHeight) | `viewport.test.js:23-27` (pasa) |
| R6 | `PhaserGame.jsx:116-129` ResizeObserver → `handleResize` con cleanup (`:134`) | Revisado en código; sin test unitario (ver Obs. §3) |
| R7 | Hub `BastionHub.jsx:21,25` (`pt`/`pb` con calc de safe); fila inferior dentro del marco | `specs/fix_pantalla_movil/evidencia/fix24_despues_hub.png` (emulador kh_pixel7) + `despues_reporte.json` nFuera 0 |
| R8 | Mismas líneas que R1 | `viewport.test.js` barrido |
| R9 | `client/index.html:7` `viewport-fit=cover`, resto conservado | `viewport.test.js:84-90` (pasa) |
| R10 | `index.css:387-392` tokens `--kh-safe-*` con `env(safe-area-inset-*, 0px)` | `viewport.test.js:96-98` (pasa) |
| R11 | `TopResourceBar.jsx:81` paddingTop `calc(0.5rem + safe-top)`; `index.css:329` `.kh-rail top: calc(128px + safe-top)`; `BastionHub.jsx:21` (QuestRail) | Código; capturas antes/después |
| R12 | `BottomNavBar.jsx:28` paddingBottom `calc(0.5rem + safe-bottom)`; `BastionHub.jsx:25` `pb-[calc(84px+safe-bottom)]` | Código |
| R13 | `index.css:336-337` `.kh-rail--left/right` con `calc(8px + safe-left/right)` | Código |
| R14 | `BastionHub.jsx:11` `absolute inset-0` (antes `fixed`); sin padding de safe en el canvas (`PhaserGame.jsx` sin cambio de tamaño por safe) | Código |
| R15 | Con insets 0 los calc dan 8/84/128/8 px (valores base conservados, `TopResourceBar.jsx:81`, `BastionHub.jsx:25`, `index.css:329,337`) | Código + Opus runtime (TopBar 8, nav 8, Operaciones 84, riel 128) |
| R16 | `viewport.js:3` `MAX_ASPECT = 2.1`; `index.css:386` `--kh-max-aspect: 2.1`; `viewport.test.js:93` espejo | `viewport.test.js:91-93` (pasa) |
| R17 | `index.css:388-389,398-413` `.kh-frame` `top: var(--kh-band)`, `height: var(--kh-frame-h)`; `.kh-shell` fondo `#14110d` | Opus runtime 412×915: marco [24.9, 890.1] = 412×2.1, fondo rgb(20,17,13) |
| R18 | `--kh-frame-h = min(app-h, 100vw×2.1)` → sin banda si aspecto ≤ 2.1 | Opus runtime 360×740 y 375×667: marco = viewport |
| R19 | `index.css:412` `contain: layout` en `.kh-frame` | Opus: overlays fixed con raíz = marco, 0 fuera |
| R20 | `index.css:390-391` `max(0px, env − band)` | Opus runtime (TopBar 23.1 = 8 + 15.1) |
| R21 | `git diff --name-status` no toca `display.js`, `config.js`, `hubLayout.js`, `HubSceneB.js` | Diff de la rama (sin esos archivos) |
| R22 | `ShopPanel.jsx:60,64,87`: contenedor `flex flex-col`, `maxHeight: calc(var(--kh-frame-h)*0.78)`, scroller `flex-1 min-h-0` | `despues_reporte.json` galaxy-a-360x740 shop `nFuera: 0` (antes: 1, `antes_reporte.json`) |
| R23 | `ShopPanel.jsx:87` scroller flex; paddingBottom con safe-bottom (`:87`) | Opus runtime: tras scroll, último bloque bottom 718.6 < 739 |
| R24 | `ShopPanel.jsx:64` `calc(var(--kh-frame-h)*0.78)` — **desviación documentada** (ver Trazabilidad T7) | Justificada: el padre inmediato mide 0 con `%`; ver Observaciones §2 |
| R25 | Diff de `ShopPanel.jsx` solo en `className`/`style` (3 hunks, `:60,:64,:67,:87`) | Diff; Opus pixel-diff tienda 0 px a 360×740 y 375×667 |
| R26 | `PhaserGame.jsx:69-70` guard; 1 canvas en dev y `vite build`+preview | `antes_medidas.md` (1 canvas dev y prod); Opus `canvasTotal 1` |
| R27 | `PhaserGame.jsx:18-20,69-70` `removeStrayCanvases` antes de `new Phaser.Game` | Código |
| R28 | `PhaserGame.jsx:142` tras `destroy(true)`; 0 canvas al desmontar | `antes_medidas.md` ("tras desmontar: 0"); Opus 1→0 |
| R29 | Emulador kh_pixel7, fila inferior completa | `evidencia/fix24_despues_hub.png` (commit). **No re-ejecutado aquí**: emulador apagado y `adb reverse` no es mío; se acepta la evidencia y la verificación de Opus |
| R30 | `despues_reporte.json`: 10 entradas `"nFuera": 0` (5 celulares × hub/shop) | Verificado en el JSON (grep) |
| R31 | `despues_reporte.json`: `"errores": []` en los 5 celulares | Verificado en el JSON (grep: 5 de 5) |
| R-ND1 | Diff `1e98312..HEAD`: solo `M`/`A`, ningún `D`/`R`; nuevos `utils/viewport.js`, `components/ui/AppFrame.jsx`, `tests/viewport.test.js`; bloque nuevo al final de `index.css` | `git diff --stat` |
| R-ND2 | Sin cambios en `server/`, `shared/` | `git diff --stat 1e98312..HEAD -- server shared` vacío |
| R-ND3 | `--kh-max-aspect: 99` → frame = viewport (con `frame-h = min(app-h, 100vw×99)`) | Opus runtime 412×915 |
| R-ND4 | `PhaserGame.jsx:78-82` registry intacto; `id="phaser-container"`; `window.__phaserGame` solo DEV (`:88`); sin cambios en firmas de `display`/`config` | Diff |
| R-ND5 | Sin migraciones ni tablas (`server/` no tocado) | Diff |
| R-ND6 | `cd client && NODE_PATH=D:\Proyectos\kingdoms-harvest\node_modules npx vitest run` → **Test Files 26 passed (26), Tests 421 passed (421)**, exit 0 (ejecutado por mí). Sin NODE_PATH: 406 + `iconSheet.test.js` falla por `sharp` (entorno, pre-existente; decisión de owner vía Central) | Ver Ejecución |
| R-ND7 | `viewport.js:11-19` función pura sin reloj ni `Math.random`; tests `viewport.test.js:10-28` | Código + tests |
| R-ND8 | `2.1` solo en `viewport.js:3` e `index.css:386`; bases 8/84/128 en los `calc()` | Grep de código |
| R-ND9 | `CHANGELOG.md:31` una línea bajo `## [Unreleased]` / `### Fixed`; `feature_list.json` sin tocar en la rama; sin cambios en archivos de `fix_superposiciones_ui` salvo `TopResourceBar.jsx:81` (la línea de paddingTop que pidió el spec) | Diff |
| R-ND10 | Sin arte ni textos nuevos; único color `#14110d` (`index.css:403`, token existente) | Diff |
| R-ND11 | Hub 360×740 y 375×667 vs. `fix24_antes`: 0,035 % y 0,081 % de píxeles con diferencia > 24/255 (umbral ≤ 0,1 %, control sin cambios 0,031–0,102 %); tienda 0 px | Opus `fix24-audit-opus.md` §4 (pixdiff `local-coder/fix24_pixdiff.mjs`). No re-ejecutado aquí |

Acceptance de `feature_list.json` id 24: alto visible real (R1–R8, R29), notch (R9–R15), tope 2.1 (R16–R21), tienda 360×740 (R22–R25), canvas único (R26–R28), evidencia y reporte (R29–R31), aditivo (R-ND1..11): cubiertos por el diff y la evidencia citada.

## Tasks
Todas `[x]` con `Evidencia:` inline (`specs/fix_pantalla_movil/tasks.md` T1–T11). `## Bloqueado`: *Ninguno*.

Las notas que pidió Central están aplicadas:
- T10(a): aclara que 421/421 es con NODE_PATH.
- T7: documenta el desvío `calc(var(--kh-frame-h)*0.78)` en lugar de `78%` (`ShopPanel.jsx:64`). Justificado: el padre inmediato mide 0 con `%` (ver R24).
- T10(f): deja anotado el Vite PID 17640 pendiente de matar.

Evidencias débiles pero aceptables (no bloquean): T4, T6, T8 y T9 describen la implementación sin números; la trazabilidad se sostiene por el diff y la evidencia de T1/T10 (`despues_reporte.json`, `antes_medidas.md`, capturas).

## Ejecución (revisor)
- `cd client && NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules npx vitest run` → `Test Files 26 passed (26)`, `Tests 421 passed (421)`, exit 0.
- `npx vite build --outDir <scratch>` (sin escribir en el repo) → exit 0, `✓ built in 11.86s`.
- Worktree limpio tras build (`git status` vacío).
- `despues_reporte.json`: `nFuera 0` ×10, `errores []` ×5 (grep).
- No se corrió emulador ni Playwright (fuera de alcance de review; evidencia previa citada).

## Observaciones (no bloqueantes)
1. **`MAX_ASPECT` no alimenta el runtime.** `viewport.js:3` solo lo consume el test espejo (`viewport.test.js:93`). Quien cambie el tope debe tocar CSS y JS a la vez (el test lo marca). Consistente con R16 y design §2.2; lo dejo anotado para el próximo que lo toque.
2. **Desvío de R24 documentado.** `ShopPanel.jsx:64` usa `calc(var(--kh-frame-h)*0.78)`. Es correcto (lo verifiqué: el `%` sobre un padre de alto 0 colapsa el panel). Queda en T7 y en este review.
3. **Sin test unitario para R6** (ResizeObserver, `PhaserGame.jsx:116-129`). Cubierto por evidencia visual/runtime. Si se quiere red de regresión, abrir un follow-up.
4. **Vite del worker vivo.** `netstat` muestra `:5173 LISTENING 17640`, mismo PID que anota T10(f). No es código, pero el checklist del implementer exige frenarlo antes de completar. Matarlo: `taskkill /PID 17640 /F` (lo hace el dueño del worktree).
5. **Peso de la evidencia.** Se commitearon 4 PNG (~9,4 MB) en `specs/fix_pantalla_movil/evidencia/`. `tasks.md` lo permite; no bloquea.
6. **Entorno `sharp`.** `iconSheet.test.js` necesita `NODE_PATH` (o `sharp` instalado). Ya registrado en PAQUETE.md (ui_kit_b); el gate de tests de esta feature usa la convención del reviewer.

## Cambios requeridos
Ninguno.
