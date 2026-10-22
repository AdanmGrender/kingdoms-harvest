# Review — `ui_kit_b` · Etapa B (T9–T17)

Revisado: rama `feature/ui_kit_b`, commits `94a362f`, `cfe81f6`, `9fa5ff4` (diff contra `13be087`). Tarea `t_23489989`, revisor `reviewer`, ronda 1.

## Veredicto

**CHANGES_REQUESTED.** La etapa B está implementada y verde, pero dos de los pendientes que el review de A pedía quedan sin cerrar (CSP en T17, y la constancia de consola de R57). Ver Cambios requeridos.

`feature_list.json` y `CHANGELOG.md` no se tocan (la feature sigue `in_progress`).

## Verificación ejecutada (reproducida por el revisor)

- `cd client && npx vitest run`: 16 files, 266 passed (0 failed).
- `cd client && npm run build`: OK (solo aviso de chunk > 500 kB, preexistente).
- `cd server && npx jest --runInBand --forceExit`: 25 suites, 388 passed. `known_failures` sigue vacío (`feature_list.json:18`).
- `git diff 13be087 feature/ui_kit_b -- server shared client/src/store client/src/services`: vacío (R31 OK).
- `grimChrome.js` eliminado y sin imports (R36).
- `TopResourceBar.jsx`: el `}} >` sobrante del review de A ya no aparece en el archivo reescrito.

## Trazabilidad (etapa B)

| R | Evidencia verificada | Estado |
|---|---|---|
| R17–R20 | `client/src/components/ui/Panel.jsx:14-28` variantes `oak`/`parchment` con `data-variant`; `Panel.jsx:46-49` botón `aria-label="Cerrar"` con `minWidth/minHeight: 44`. `kitComponents.test.jsx` verde. | OK |
| R21–R25 | `ui/Button.jsx:33-34` min 44×44; `Button.jsx:21` disabled `saturate(0.4)` + `kh-iron` + `pointerEvents: none`; `ui/IconButton.jsx:32-33` 44×44. | OK |
| R26–R28 | `ui/Bar.jsx:9,14-15,33` tono por `BAR_TONES`, `role="progressbar"`, `aria-valuenow={pct}`; `ui/PortraitRing.jsx:10,24-26,42` con y sin `src`. | OK |
| R29 | Ningún `gradient` en `ui/{Panel,Button,IconButton,Bar,PortraitRing}.jsx` ni `kitPieces.js`; `kitStyles.test.js` verde. El `radial-gradient` de `styles/index.css:204` es `.fx-torch-vignette`, fuera del alcance de R29. | OK |
| R30 | `.btn-primary`, `.btn-gold`, `.game-card`, `.progress-*` conservan nombre; `kitStyles.test.js` verde. | OK |
| R14 | `components/hud/TopResourceBar.jsx:35-36` `NUM` con `font-numeric` (veredicto de `evidencia/digitos.md`, Q2). Cubierto en `TopResourceBar.test.jsx`. | OK |
| R32 | `evidencia/barra_412.webp` citado en `tasks.md:28` (fila 372 ≤ 372). El revisor no pudo inspeccionar la imagen visualmente; se confía en la cita numérica. | OK (con reserva) |
| R33 | `TopResourceBar.test.jsx` (8 `[data-resource]` incl. valor 0) + `pickupSources.test.jsx` (8 claves). | OK |
| R34 | Test de `size ≥ 28` y clase `text-[12px]`+ en el número. | OK |
| R35 | `Bar` en `TopResourceBar`, `campaign/CombatInstancePanel.jsx:175,225` (vida y energía); `barsMigration.test.js` verde. Los `width:` inline de `CombatInstancePanel.jsx:192,200,214` son retratos/iconos, no barras; `TopResourceBar.jsx:113` `width: 56` es el contenedor, el relleno pasa por `Bar`. | OK |
| R36 | `OverlayManager`, `BottomNavBar`, `QuickActionsSidebar`, `EventSidebar`, `SocialSidebar` sobre `Panel`/`IconButton`; `hudRails.test.jsx` 9 tests verdes. | OK |
| R37 | `npx vitest run` 266/266; `known_failures` vacío. | OK |
| R31, R58 (suites) | Ver verificación. | OK |
| R57 | Falta `evidencia/consola.txt` de la corrida de barra. | PARCIAL |

Tasks: T9–T17 `[x]` con `Evidencia:` inline (`specs/ui_kit_b/tasks.md:20-28`). T18–T34 `[ ]`, esperado (etapa C fuera de alcance). `## Bloqueado` vacío.

## Pendientes del review de A

1. `TopResourceBar.jsx:99` espacio sobrante: **resuelto**.
2. Verificar CSP contra el server real con `NODE_ENV=production` en T17, o dejar constancia explícita: **no resuelto**. `tasks.md:28` (T17) no menciona CSP; la captura se tomó contra Vite dev en :5180. La única constancia de CSP es la de T8 (`consola_prod.txt` / `prod_fuentes.json`), que sirve `client/dist` con la CSP copiada, no el server real.
3. Jest flaky → `known_failures`: no aplica en esta ronda (388/388 verde).

## Observaciones (no bloqueantes)

1. El Vite propio de :5180 (PID 5604, `node.exe`) sigue vivo y responde `200`. El implementador no pudo matarlo por política. Hay que pararlo antes de cerrar.
2. Quedan `grim_icons`, `gen_icons` y emojis en `components/` (`overlay/ShopPanel.jsx:15`, `campaign/CombatInstancePanel.jsx:166`, `campaign/OperationsMap.jsx:52,94`) y `GRIM_SHEET` apuntando a `grim_icons.png` (`config/grimIconSheet.generated.js:10`). Son alcance de la etapa C (R48–R55), no de B.

## Cambios requeridos

1. **T17 / CSP (pendiente A.2):** verificar la CSP contra el server real con `NODE_ENV=production` (consola y lista de requests, salida citada), o añadir a `tasks.md` T17 una constancia explícita de por qué no se pudo (p. ej. el server de producción rechaza `SKIP_AUTH` y no hay credencial Telegram disponible) y qué se verificó en su lugar, con archivo y línea.
2. **R57:** guardar la consola de la corrida `--mode barra` en `specs/ui_kit_b/evidencia/consola_barra.txt` (0 pageerror, 0 console.error, 0 HTTP ≥ 400) y citarla en `tasks.md` T17.
3. **Proceso:** parar el Vite de :5180 (PID 5604) o dejar constancia en la tarea de que sigue vivo y por qué.

Tras los cambios: nueva ronda de revisión con la misma verificación (vitest, build, jest) y comprobación de los puntos 1 y 2.

## Nota de proceso

Este archivo sustituye la revisión de etapa A; el texto de A queda en el historial de git (commit `13be087`). No se marcó `done`, no se tocó `feature_list.json` ni `CHANGELOG.md`.
