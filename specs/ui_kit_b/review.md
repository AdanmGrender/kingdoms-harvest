# Review — `ui_kit_b` · Etapa B (T9–T17)

Revisado: rama `feature/ui_kit_b`, commit `4de5fd6` (cabeza), sobre `9fa5ff4`, `cfe81f6`, `94a362f`. Tarea `t_23489989`, revisor `reviewer`, ronda 2 (lente de ejecución). La ronda 1 cerró en CHANGES_REQUESTED (commit `9820d00`).

## Veredicto

**APPROVED para la etapa B (T9–T17).** Los dos cambios requeridos de la ronda 1 quedaron cerrados con evidencia reproducida por el revisor. El pendiente de proceso (Vite :5180) tiene constancia explícita en T17.

`feature_list.json` y `CHANGELOG.md` no se tocan: `ui_kit_b` sigue `in_progress` hasta cerrar la etapa C (T18–T34), igual que con la etapa A (`13be087`).

## Verificación ejecutada (reproducida por el revisor)

- `cd client && npx vitest run`: 16 files, 266 passed, 0 failed.
- `cd client && npm run build`: OK (solo aviso de chunk > 500 kB, preexistente).
- `cd server && npx jest --runInBand --forceExit`: 25 suites, 388 passed. `known_failures` sigue vacío (`feature_list.json:18`); no hubo fallo de jest que anotar.
- `git diff --stat beb5424 HEAD -- server shared client/src/store client/src/services`: vacío (R31).
- CSP contra el server real (ejecución propia, no solo lectura de la evidencia):
  - `cd server && NODE_ENV=production PORT=3099 BOT_TOKEN=<falso> WEBAPP_URL=http://localhost:3099 DEVICE_AUTH_ENABLED=true node src/index.js`, sirviendo `client/dist` recién construido.
  - `curl -I http://localhost:3099/` devuelve `Content-Security-Policy: default-src 'self';script-src 'self' https://telegram.org;...`, la misma política que `server/src/index.js:90-100` produce con `isProduction`.
  - `NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules node scripts/ui_kit_b_evidence.js --mode prodserver --url http://localhost:3099` regeneró `prod_server.json` idéntico byte a byte al commiteado: `cspViolacionesEvento []`, `cspViolacionesConsola []`, `fuentesExternas []`, `pageerrors 0`, `consoleErrors 0`, `http400 []`, barra 8×45 px con `sw 372 = cw 372`, `fontsCheck` numeric/body true.
  - `consola_prod_server.txt` regenerado: solo difiere la marca de tiempo de la cabecera; 0 pageerror, 0 console.error.
  - Los archivos de evidencia se restauraron con `git checkout` tras la corrida; el revisor no deja cambios fuera de este review.md.
- Consola de barra (R57): `specs/ui_kit_b/evidencia/consola_barra.txt` presente; `pageerrors: 0`, `console.error: 0`, `http >= 400: 0`; solo avisos `[Telegram.WebApp] … not supported in version 6.0`.

## Cambios requeridos de la ronda 1: estado

1. **T17 / CSP con server real**: cerrado. Ver verificación anterior. `tasks.md` T17 cita `evidencia/prod_server.json` y la configuración exacta (`DEVICE_AUTH_ENABLED=true`, sin `SKIP_AUTH`).
2. **R57, consola de la corrida de barra**: cerrado. `evidencia/consola_barra.txt` existe y está citado en T17.
3. **Proceso, Vite de :5180 (PID 5604)**: constancia explícita en T17 (`tasks.md:28`): sigue vivo, `taskkill /F` bloqueado por política del entorno, hay que pararlo a mano. Verificado: `curl http://localhost:5180/` → 200 y PID 5604 `node.exe` activo. Aceptado como constancia; **pendiente manual del owner** (ver observaciones).
4. **Espacio sobrante `TopResourceBar.jsx:99`** (pendiente del review de A): resuelto. `client/src/components/hud/TopResourceBar.jsx:99` está vacía y sin espacios finales (`grep -n " $"` sobre el archivo, vacío).

## Trazabilidad (etapa B)

| R | Evidencia verificada | Estado |
|---|---|---|
| R17–R20 | `client/src/components/ui/Panel.jsx:14-28` variantes `oak`/`parchment`; `Panel.jsx:46-49` cierre `aria-label="Cerrar"` 44×44. `kitComponents.test.jsx` verde. | OK |
| R21–R25 | `ui/Button.jsx:33-34` 44×44; `Button.jsx:21` disabled `saturate(0.4)` + `kh-iron`; `ui/IconButton.jsx:32-33` 44×44. | OK |
| R26–R28 | `ui/Bar.jsx:9,14-15,33` tonos, `role="progressbar"`, `aria-valuenow`; `ui/PortraitRing.jsx:10,24-26,42` con y sin `src`. | OK |
| R29 | Sin `gradient` en `ui/{Panel,Button,IconButton,Bar,PortraitRing}.jsx` ni `kitPieces.js`; `kitStyles.test.js` verde. | OK |
| R30 | `.btn-primary`, `.btn-gold`, `.game-card`, `.progress-*` conservan nombre; `kitStyles.test.js` verde. | OK |
| R14 | `components/hud/TopResourceBar.jsx:35-36` `NUM` con `font-numeric` (veredicto Q2 de `evidencia/digitos.md`, commit `e4f93fd`). | OK |
| R32 | `evidencia/barra_412.webp` y `prod_server_barra.webp` citados; fila 372 ≤ 372 reproducida en la corrida de prodserver. El revisor no inspecciona la imagen visualmente; se confía en la medición numérica reproducida. | OK (con reserva visual) |
| R33 | `TopResourceBar.test.jsx` (8 `[data-resource]` incl. valor 0) + `pickupSources.test.jsx` (8 claves). | OK |
| R34 | Test de tamaño ≥ 28 px del ícono y `text-[12px]` mínimo en el número. | OK |
| R35 | `Bar` en `TopResourceBar`, `campaign/CombatInstancePanel.jsx:175,225`; `barsMigration.test.js` verde. | OK |
| R36 | `OverlayManager`, `BottomNavBar`, `QuickActionsSidebar`, `EventSidebar`, `SocialSidebar` sobre `Panel`/`IconButton`; `hudRails.test.jsx` 9 tests verdes; `grimChrome.js` ausente. | OK |
| R37 | `npx vitest run` 266/266; `known_failures` vacío. | OK |
| R57 | `evidencia/consola_barra.txt` y `consola_prod_server.txt`: 0 pageerror, 0 console.error, 0 HTTP ≥ 400. | OK |
| R31, R58 (suites) | vitest 266/266, build OK, jest 388/388, diff vacío en server/shared/client store+services. | OK |

Tasks: T9–T17 `[x]` con `Evidencia:` inline (`tasks.md:20-28`). T18–T34 `[ ]`, esperado (etapa C fuera de alcance). `## Bloqueado` vacío.

## Observaciones (no bloqueantes)

1. **Mensaje de commit**: `4de5fd6` lleva el sufijo `(CSP con server real y consola de barra)`; la tarea pedía `feat(ui_kit_b): etapa B - kit de componentes y contadores`. No bloquea; se acepta el historial tal cual.
2. **Pendiente manual del owner, fuera del repo**: parar el Vite de :5180 (PID 5604, `node.exe`), que sigue respondiendo 200. `taskkill /F` está bloqueado por política del entorno.
3. **Leftover del revisor**: durante esta ronda levanté un server de producción en `:3099` (node.exe, PID 9544, `netstat -ano` lo muestra en LISTENING). `taskkill` sin `/F` no lo paró y `/F` está bloqueado por política. **Pendiente manual**: `taskkill /PID 9544 /F` desde una consola con permisos. No afecta al repo.
4. Quedan `grim_icons`, `gen_icons` y emojis en `components/` (`overlay/ShopPanel.jsx:15`, `campaign/CombatInstancePanel.jsx:166`, `campaign/OperationsMap.jsx:52,94`) y `GRIM_SHEET` → `grim_icons.png` (`config/grimIconSheet.generated.js:10`). Son alcance de la etapa C (R48–R55).

## Cambios requeridos

Ninguno para la etapa B.

## Nota de proceso

Veredicto solo de la etapa B. `ui_kit_b` sigue `in_progress`; `feature_list.json` y `CHANGELOG.md` no se tocaron. El cierre de la feature corresponde a la etapa C y a una revisión final.
