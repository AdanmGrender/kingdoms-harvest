# Review — `ui_kit_b` · Etapa C (T18–T34) y cierre — ronda 2

Revisado: rama `feature/ui_kit_b`, cabeza `1f516aa`. Tarea `t_3cf4f686`, revisor `reviewer`, ronda 2 de la etapa C (lente ejecución). Los cambios de la ronda 1 (ver sección siguiente, «ronda 1») se verificaron de nuevo.

## Veredicto

**APPROVED.** Los dos cambios de la ronda 1 quedaron cerrados en `1f516aa`:
1. Íconos de edificio: ningún sprite de edificio queda por debajo de 40 px. La pestaña Social usa `alliance`, el Bastión de `QuickActionsSidebar` usa `iconSize` 40 y el «Mundo» de `EventSidebar` usa `world`.
2. T34: la nota del grep es exacta. `docs/project-spec.md:556` sigue citando MedievalSharp y queda registrado como decisión pendiente del owner.

Cierre: `feature_list.json` id 8 → `done`; entrada en `CHANGELOG.md` bajo `[Unreleased]`.

## Verificación ejecutada (ronda 2, reproducida por el revisor)

- `cd client && NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules npx vitest run`: Test Files 19 passed (19), Tests 289 passed (289).
- `cd client && npm run build`: `✓ built in 7.33s` (solo aviso de chunk > 500 kB, preexistente).
- `cd server && npx jest --runInBand --forceExit`: Test Suites 25 passed, Tests 388 passed.
- Tamaños de íconos de edificio (`grep -rnE "['\"](farm_plot|barn|...|castle|...)['\"]" client/src/components`):
  - `hud/QuickActionsSidebar.jsx:58` `iconSize={a.id === 'castle' ? 40 : 32}` (el Bastión es `castle`, `:11`, y pasa a 40).
  - `hud/BottomNavBar.jsx:31` castle a 40; `hud/BuildingInfoPopup.jsx:110` a 40; `overlay/BuildingToolbar.jsx:226` a 40; `overlay/OverlayManager.jsx:389` `meta.sprite` a 40.
  - `overlay/TutorialOverlay.jsx:89` castle a 48; `overlay/GuildPanel.jsx:138` castle a 56.
  - Los 28 px restantes en `hud/` y `overlay/BuildingToolbar.jsx:182,202` son sprites de no-edificio (hammer, crown, gold, kh_token, gem, sun, moon, recursos, alliance, wheat, shield, crown).
- Sin servidores de dev del implementador: 5180 libre. Corrí `netstat`: solo 3099 (ver observaciones).
- `grep -rnI "grim_icons\|gen_icons\|grimChrome\|MedievalSharp" client/src server/src shared scripts docs`: solo tests que afirman la ausencia (`fontsConfig.test.js:107-108`, `hudRails.test.jsx:2,34-38`) y `docs/project-spec.md:556`. Coincide con `tasks.md` T34.
- `git status --short`: vacío antes de este review.

## Trazabilidad (etapa C, ronda 2)

| R | Evidencia verificada | Estado |
|---|---|---|
| R38–R40, R45–R47, R54 | `iconSheet.test.js` y `SpriteIcon.test.jsx` verdes (suite completa 289/289). | OK |
| R41–R44 | Recortes, manifest y `icons.webp`/`generated.js` candidatos según `tasks.md` T19–T22. | OK |
| R43 | `aprobacion_arte.md` `APROBADO 79/79` anterior a la integración. | OK |
| R48 | `grep` de arriba: sin código vivo. | OK |
| R49–R53, R55 | `noEmoji.test.js` verde; control en rojo en `evidencia/noEmoji_control.txt`. | OK |
| R50 | Lista blanca solo `CHAT_STICKERS`. | OK |
| R56–R58 | Capturas `*_antes/_despues.webp`, consolas, vitest/build/jest. | OK |
| R32 | `barra_412.webp`; `scrollWidth 372 <= clientWidth 372` citado. | OK (reserva visual) |

Tasks: T18–T34 `[x]` con `Evidencia:` inline (`tasks.md:34-59`). `## Bloqueado` vacío.

## Observaciones (no bloqueantes)

1. **Proceso, puerto 3099.** Sigue LISTENING el PID 9544 (node, server de producción del revisor en la ronda B). `taskkill /PID 9544` sin `/F` no lo cerró y `/F` está bloqueado por política de este entorno. **Pendiente manual del owner:** `taskkill /PID 9544 /F`. No es un proceso del implementador ni afecta al repo.
2. **Entorno.** `iconSheet.test.js` necesita `NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules` (sharp no está en `client/node_modules` del worktree). Queda como trampa en `PAQUETE.md`.
3. **Legibilidad visual sin verificar.** No puedo ver las `.webp` en este entorno. La legibilidad de `iconos_contacto.webp`, `hub_despues.webp` y `barra_412.webp` queda para la revisión humana de p-kh si el owner la quiere antes del cierre; la medición numérica sí se reproduce.
4. **Mensaje de commit.** Los commits de C son `ef3dc37`, `938ab71`, `9c04087`, `108248c`, `1f516aa`; la tarea pedía `feat(ui_kit_b): etapa C2 - emojis -> íconos B`. No bloquea.
5. **`project-spec.md:556`** (MedievalSharp) queda sin editar por decisión del owner, como indica T34.

## Conocimiento

Se añadió 1 decisión y 1 trampa a `D:\Proyectos\_conocimiento\kingdoms-harvest\PAQUETE.md` (ver commit `chore(ui_kit_b)`).

## Ronda 1 (histórico)

Revisado: rama `feature/ui_kit_b`, cabeza `108248c`. Tarea `t_3cf4f686`, revisor `reviewer`, ronda 1 de la etapa C (lente artefacto + ejecución). Las etapas A y B quedaron aprobadas antes (`13be087`, `4de5fd6`; historial en git).

## Veredicto

**CHANGES_REQUESTED.** Tests y build en verde y trazabilidad T18–T34 coherente. Pero hay íconos de edificio a menos de 40 px, que la condición de p-kh prohíbe de forma explícita (cambios 1), y la evidencia de T34 contiene una afirmación de grep inexacta (cambio 2).

`feature_list.json` y `CHANGELOG.md` NO se tocan: `ui_kit_b` sigue `in_progress`.

## Verificación ejecutada (reproducida por el revisor)

- `cd client && npx vitest run`: 19 files, 289 passed, 0 failed. Requiere `NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules`: `client/node_modules` del worktree no tiene `sharp` y `iconSheet.test.js` falla con `Cannot find module 'sharp'` sin ese NODE_PATH (entorno, no código).
- `cd client && npm run build`: `built in 7.36s` (solo aviso de chunk > 500 kB, preexistente).
- `cd server && npx jest --runInBand --forceExit`: 25 suites, 388 passed.
- `git status --short`: vacío.
- Estructura:
  - `client/src/config/grimIconSheet.generated.js:10-14`: `GRIM_SHEET`, `GRIM_CELL = 192`, 1536×1920. `gear` en `:59`, sin cambios.
  - `kh_token` en `:20`; ningún alias de `GRIM_ALIASES` (`client/src/utils/spriteMap.js`) apunta a `kh_token`; `nav_token` eliminado (R45).
  - `ENEMY_LEGACY` en `spriteMap.js` (6 celdas de 128 px sobre `enemy_icons_legacy.png`, presente) (R46).
  - `client/src/components/ui/SpriteIcon.jsx:14-27`: sin `fallback`, `data-missing-icon`; `imageRendering: 'auto'` en `:47` (R47, R54).
  - `grim_icons.png` y `scripts/gen_icons.sh` ausentes (R48). `grep -rnP '\bfallback=' client/src/components`: vacío.
  - `noEmoji.test.js` verde; lista blanca solo `CHAT_STICKERS` (R50). Control en rojo en `evidencia/noEmoji_control.txt`.
  - Evidencia de arte presente: `aprobacion_arte.md`, `iconos_contacto.webp`, `iconos_regen.webp`, `barra_412.webp`, `prod_server.json`, `consola_*.txt`.
- No hay servidor de dev del implementador escuchando (5180 libre).
- Legibilidad visual de las `.webp`: no verificada por el revisor (sin visión de imágenes en este entorno).

## Trazabilidad (etapa C)

| R | Evidencia verificada | Estado |
|---|---|---|
| R38–R40 | `iconSheet.test.js` verde; constantes y 65 nombres contrato en `grimIconSheet.generated.js`. | OK |
| R41 | `evidencia/crop_edificios.txt` (17 recortes). | OK |
| R42 | `evidencia/iconos_contacto.webp`, `contacto.txt`. | OK (visual sin verificar) |
| R43 | `aprobacion_arte.md` `APROBADO 79/79` (`5eb6722`) anterior a la integración `ad37567`. | OK |
| R44, R45 | Manifest y `kh_token` único, sin alias. | OK |
| R46, R47 | `ENEMY_LEGACY`; `SpriteIcon.jsx:14-27`. | OK |
| R48 | Archivos ausentes; grep en `docs/` sin `grim_icons\|gen_icons`. | OK |
| R49–R55 | `noEmoji.test.js` verde; `noEmoji_control.txt`; `factionIcons.js`. | OK (ver cambio 1 para tamaños de edificio) |
| R56, R57 | 10 capturas `*_antes/_despues.webp`; `consola_despues.txt`, `consola_barra.txt`, `consola_prod_server.txt`. | OK |
| R58 | vitest 289/289, build OK, jest 388/388. `known_failures` vacío. | OK |
| R32 | `barra_412.webp`; `scrollWidth 372 <= clientWidth 372` citado. | OK (reserva visual) |

Tasks: T18–T34 `[x]` con `Evidencia:` inline (`tasks.md:34-59`). `## Bloqueado` vacío.

## Cambios requeridos

1. **Íconos de edificio a menos de 40 px.** La condición de p-kh (card y `aprobacion_arte.md`) es: sprites de edificio solo a 40 px o más y con nombre visible. Tres casos la incumplen:
   - `client/src/components/overlay/BuildingToolbar.jsx:62-64` y `:202`: la pestaña «Social» usa `icon: 'market'` (sprite de edificio) a `SpriteIcon size={28}`. Cambiar el icono de categoría a un sprite que no sea de edificio (p. ej. `wallet`, `alliance`) o subirlo a 40 px con nombre.
   - `client/src/components/hud/QuickActionsSidebar.jsx:11` (`castle`, «Bastión») y `:50-56`: `IconButton` sin `iconSize`, que por defecto es 32 (`client/src/components/ui/IconButton.jsx:17`). Pasar `iconSize={40}` o usar un sprite que no sea de edificio. `BottomNavBar.jsx:31` ya usa 40 px para el mismo Bastión.
   - `client/src/components/hud/EventSidebar.jsx:16` (`castle`, «Mundo») y `:82`: mismo caso (32 px por defecto); además el sprite de edificio representa «Mundo», no un edificio. Cambiar a un sprite que no sea de edificio (p. ej. `map`, `world`).
   Verificar con `grep -rn "iconSize\|size=" client/src/components/hud client/src/components/overlay/BuildingToolbar.jsx` y citar el resultado en la evidencia.

2. **Afirmación de T34 inexacta.** `tasks.md:59` dice que el grep de `grim_icons|gen_icons|grimChrome|MedievalSharp` en `docs` «solo da los nombres GRIM_ICONS … y tests». No es así: `docs/project-spec.md:556` sigue citando `MedievalSharp`, y `docs/superpowers/` también. Corregir la evidencia con el resultado real, o actualizar `docs/project-spec.md:556` si el contrato ya no aplica (decisión del owner; como mínimo la nota debe ser exacta).

## Observaciones (no bloqueantes)

1. **Proceso, puerto 3099.** Sigue LISTENING el `node.exe` PID 9544 del server de producción que levantó el revisor en la ronda B. `taskkill /F` está bloqueado por política en esta sesión. **Pendiente manual del owner:** `taskkill /PID 9544 /F`.
2. **Vite :5180 (PID 5604, ronda B).** Ya no aparece en `netstat`; confirmar al cerrar.
3. **Entorno.** Instalar `sharp` en `client/node_modules` del worktree o documentar el `NODE_PATH` en el cierre.
4. **Mensaje de commit.** La tarea pedía `feat(ui_kit_b): etapa C2 - emojis -> íconos B`; los commits de C son `ef3dc37`, `938ab71`, `9c04087`, `108248c`. No bloquea.
5. **Legibilidad visual sin verificar** (`iconos_contacto.webp`, `hub_despues.webp`, `barra_412.webp`): revisión humana de p-kh antes del cierre.

## Nota de proceso

Tras los cambios 1 y 2, nueva revisión (ronda 2, lente de ejecución): repetir vitest, build y jest, y el grep de tamaños. Si se aprueba, el reviewer pone `feature_list.json` id 8 → `done` y añade la entrada en `CHANGELOG.md`.

---

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
