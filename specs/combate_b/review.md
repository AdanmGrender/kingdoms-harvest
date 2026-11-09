# Review — combate_b · Etapa B (T8–T10), S1 (rama `feature/combate_b`, commit revisado e43b3a1)

## Veredicto
**APPROVED — Etapa B (T8–T10), ronda 2** (lente de ejecución: se reprodujo lo reportado).

Cierra los cambios requeridos de la ronda 1 (commit 9c39ef5): `art-b/gr/process.sh` ya contiene los recortes que faltaban y `tasks.md` cita el commit en T8.

La feature **sigue `in_progress`**: T10.5, T11 y T12 (Etapa C) están pendientes. Por eso no se toca `feature_list.json` ni `CHANGELOG.md`, igual que en la aprobación de la Etapa A (e153a93). Central debe decidir si el cierre de la feature (`done` + CHANGELOG) se hace al terminar la Etapa C.

## Trazabilidad
- R30 — `Cubre:` de T10. `client/src/tests/combatLayout.test.js` (mapa Q4, fondos por acto+tipo, cada url existe en `public/`). Pasa en la ejecución de abajo.
- R33 / R34 / R35 — `Cubre:` de T8, T9 y T10.
  - R34 (puertas): `evidencia/aprobacion_arte.md` registra P1, P1r2+P2 y P3 con el veredicto de p-kh (vía Central). Hojas `evidencia/contacto_T8_heroes.webp`, `contacto_T8r2_T9_P2.webp` y `contacto_T10_P3.webp` presentes.
  - R33 (generación): `art-b/gr/manifest.json` con 30 entradas (JSON válido, verificado). Generación solo por web (`gen_art_web.js`). Ningún cambio en `server/.env` ni en `package-lock.json` dentro de la rama.
  - R35 (nombres originales): evidenciado por la lista de design §11. No bloquea.
- R1–R4, R28, R43, R48–R52: fuera de esta etapa (T11–T12).

## Tasks
- T8, T9, T10 `[x]`, cada una con `Evidencia:` inline. T8 cita `da5063d` (process.sh) y `e43b3a1`. La línea `Evidencia:` vacía bajo T8 ya no existe (`specs/combate_b/tasks.md:27-28`).
- `## Bloqueado`: vacío.
- T10.5, T11 y T12 `[ ]` sin evidencia: son de la Etapa C, fuera de alcance de esta revisión.

## Verificación reproducida (reviewer, ronda 2)
- **Reproducibilidad de arte:** corrí el bloque `combate_b` de `art-b/gr/process.sh` (líneas 16–41) con `NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules`, con salida a un directorio scratch, y comparé con `client/public/assets/b`: **23 webp comparados, 0 diferencias byte a byte** (paladin ×2, rogue ×2, 14 enemigos, 5 fondos). Ningún archivo del repo tocado.
- `cd client && npx vitest run`: `Test Files 1 failed | 32 passed (33)`, `Tests 589 passed (589)`. El único fallo es `iconSheet.test.js` (`Cannot find module 'sharp'`), preexistente en el junction.
- `NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules npx vitest run src/tests/iconSheet.test.js`: `Tests 15 passed (15)`.
- `node node_modules/vite/bin/vite.js build --outDir <scratch>`: `✓ built in 7.53s`, exit 0.
- Sin `.only` en los tests de combate. El único `s.skip()` (`combatScene.test.js:127`) es un método de la escena, no un test saltado.
- `shared/gameConfig.js:1155`: `engineVersion: 1` (sin cambio). `:5173` no escucha. `:5180`/`:3101` no tocados.
- `git status` limpio tras las reproducciones.

## Revisión de código (archivo:línea, diff contra e153a93)
- `client/src/game/combat/artMap.js` — `HERO_ART` incluye paladin y rogue; `ENEMY_BY_NODE` (Q4 + a2n7 sin_rostro + a2n10 voz_del_velo) coincide con design §11. Sin hallazgos.
- `artMap.js` — `ENEMY_BY_TYPE.wave` pasa a `bruto`; los `wave` de acto 2 (a2n4, a2n8) quedan en bruto, consistente con design Q4. Sin hallazgos.
- `client/src/tests/combatLayout.test.js:91-113` — expectativas `paladin/rogue → warrior` reemplazadas por el arte propio; justificado en design.md:105 y T8. Sin `.skip`/`.only`.
- `scripts/gen_art_web.js:110` — `GEMINI_WEB_EXE` solo cambia el ejecutable de Edge; no lee `server/.env`.
- `scripts/process_art_b.js` — `--quality` con default 88; sin regresión.
- `art-b/gr/process.sh:16-41` — bloque nuevo; CRLF mantenido; `--margin 8 --quality 77` en `boss_devorador_hit`, como consta en `evidencia/aprobacion_arte.md`.

## Observaciones no bloqueantes
- `enemies/voz_del_velo_hit` fue aprobado por p-kh en P3 sin cumplir la regla literal de P2 (`evidencia/aprobacion_arte.md`). Es decisión de p-kh; este review no la revierte.
- Etapa C (T12): verificar en captura que el portal de `bg/combat_veil_gate` no tape los efectos verdes; si los tapa, oscurecer por código, sin regenerar.
- Nota de proceso: `process.sh` depende de los crudos de `art-b/gr/raw/` (ignorados por git). Sin ellos, el script se corta en `sheet_warrior.png` por `set -e`; el bloque de combate_b se puede correr aislado.

---

# Review — Etapa C (T10.5 → T11 → T12, cierre de F7) · ronda 1 · t_4639fe2d

**ESCALADO — no aprobado.** Motivo: dos verificaciones exigidas no se pueden cerrar con evidencia desde este revisor. Se escala a humano / modelo con visión y dispositivo. No se tocan `feature_list.json` ni `CHANGELOG.md` (siguen `in_progress`). Sin cambios de código solicitados.

## Trazabilidad (R-por-R)
- R54 (barra por enemigo) — T10.5 `87d1fb8`. `CombatInstancePanel.jsx:21-29` (`enemyBars`: `state.enemies ?? [state.enemy]`, piso 0, muerto `dead`), `:145-152` (filas `data-enemy-bar`, opacidad 0.45 en muerto, 2 columnas con 3+). Tests `combatPanel.test.jsx` (+58 líneas, 1/3/4 enemigos, muerto, fallback v1, `enemies: []`). **Reproducido**: `vitest run combatPanel + pantallasB` → 2 files, 69 passed.
- R40 — el test de R40 cambió solo la etiqueta a «Vida de Enemigo 1» (`combatPanel.test.jsx:180`). Aserción de texto, no de comportamiento; aceptable, se anota.
- R43, R28, R49, R50 — evidencia en `evidencia/despues/reporte_v{1,2}.json` y `red_v{1,2}.json`: `botonesBajo44: []` en 4 viewports, 6 peticiones a `/assets/` con `bajoAssetsGame: 0`, sin `error`/`pageerror`. Verificado por lectura de los JSON; no re-ejecutado (Playwright/servidor no levantados en esta sesión).
- R51, R52, R1, R2 — `git diff 46d156d..HEAD -- server shared` vacío; `shared/gameConfig.js:1155` `engineVersion: 1`; sin cambios en `package*.json`; sin borrados en `assets/game|sprites`. **Verificado.**
- R53 — CHANGELOG sin tocar; `feature_list.json` solo cambió en `3e11566` (spec, `pending→in_progress`, asignación `spec-author`), no en Etapa C. Aceptable; el cierre lo hace el reviewer al aprobar.
- R48 — **NO CUMPLIDO todavía**: `fps.json` mide solo en escritorio (Chromium headless, RTX 5060). Q9 (`design.md:180`) exige `kh_pixel7` + escritorio; la excepción «sin GPU» no aplica porque el host tiene GPU. El AVD existe (`D:/Android/avd/kh_pixel7.avd`) pero no hay binario `emulator`/`adb` en PATH; el implementador no lo intentó ni documentó el bloqueo. Además el `aviso` del propio JSON reconoce el hueco.
- R48 (medio ≥ 50 avg, p5 ≥ 40) en escritorio sí cumple (60/60 medio, 60/58 bajo) pero no es el dispositivo pedido.

## Tasks
- T8–T10 `[x]` con evidencia (ya aprobadas en `fdcee68`).
- T10.5 `[x]`, T11 `[x]`, T12 `[x]` con `Evidencia:` inline (`tasks.md:35-40`). Evidencia de T11 incompleta frente a su propio texto: `kh_pixel7` pendiente y la inspección visual pedida por el must-do de la Etapa B **no hecha** (el propio implementador lo declara, `tasks.md:38`). Marcar `[x]` sobre un punto que la misma entrada declara pendiente es inconsistente.
- `## Bloqueado`: vacío.

## Verificación ejecutada por el revisor
- `cd client && NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules npx vitest run src/tests/combatPanel.test.jsx src/tests/pantallasB.test.jsx </dev/null` → `Tests 69 passed (69)`.
- `git status` limpio antes de escribir este archivo; ningún dev server en :5173/:5174 escuchando; :5180/:3101 del owner intactos.
- No se ejecutó suite completa ni build (el implementador reporta `server 545`, `client 610`, `build ok`; no lo re-verifiqué por coste de tiempo; son verificables en la próxima ronda).

## Inspección visual (NO completada por el revisor)
- Este entorno no puede ver imágenes (sin herramienta de visión). **No afirmo** que `combat_veil_gate` no tape ni se confunda con sprites/HUD, ni que las barras no solapen la caja del enemigo.
- Datos disponibles (`veil_stats.mjs`, implementador): el tercio medio de `veil_gate` es el más claro y con más contraste (76.5 / 58.0) justo donde van los enemigos; riesgo de confusión real, pero sin veredicto visual.
- Solape barras/caja enemigo: `barrasSolapanZonaEnemigos=true` (barras hasta y≈101–138 px; caja desde y≈50 px). Requiere mirar `v2_r00_inicio.webp` y `v2_veil_gate_a2n10_4enemigos.webp`.
- Must-do Etapa B (`specs/combate_b/review.md` ronda 2, observación «verificar en captura que el portal de `combat_veil_gate` no tape los efectos verdes») → **sin cerrar**.

## Cambios requeridos
No se piden cambios de código. Para aprobar hace falta, a elección del owner:
1. **Inspección visual** de `v2_r00_inicio.webp`, `v1/v2_veil_gate_a2n10_*` (veil_gate vs sprites/HUD) y del solape barras/caja; anotar el resultado en `tasks.md` T11.
2. **fps en `kh_pixel7`** (medio y bajo, n, avg, p5) según Q9, o declaración explícita de que el emulador no es viable con la razón concreta.
3. Si el owner acepta escritorio para R48, debe decirlo por escrito y se registra en `Bloqueado`.

Al completar 1 y 2 (o la decisión del owner), re-revisar con lente de contrato (ronda 2+).

---

# Review — Etapa C (T10.6 fix visual, commit 91b2090) · ronda 1 · t_d2a6de3d

## Veredicto
**CHANGES_REQUESTED.** No se aprueba: R48 no se cumple con la medición entregada y la calibración de la línea de suelo no está hecha por fondo como dice el código. Lo demás (tests de layout y panel) reproduce.

## Trazabilidad
- **R48 (fps medium ≥ 50 avg, p5 ≥ 40, en kh_pixel7):** NO CUMPLIDO. `evidencia/despues/fps_emulador_medium.json`: `avg` 55.1 ✓, pero `p5` 20 y `min` 20 con `n` 19 (con n<21 el p5 es el mínimo). El umbral de R48 es p5 ≥ 40 (`requirements.md:212`), no 30. La explicación «ventana de carga de texturas» no excluye la muestra: el criterio no admite exclusiones ad hoc.
- **R48 (low):** `fps_emulador_low.json` avg 58.2, p5 52. Cumple, pero R48 pide medium; design Q9 (`design.md:180`) exige declarar y medir low sólo si medium no alcanza ≥50 avg, que sí alcanza.
- **R54 (barra por enemigo):** `combatPanel` + `combatLayout` verdes (ver abajo). Sin objeción de código.
- **R43/R28/R49/R50:** evidencia de Playwright (`red_v*.json`, `reporte_v*.json`) citada en tasks.md T11. No reproducida en esta ronda (lente artefacto). No es el bloqueante.
- **Hallazgos visuales del visual-reviewer (B1 bruto flota, B2 botones, B4 cabezas bajo barras):** la geometría está cubierta por tests; la confirmación a ojo corresponde al visual-reviewer ronda 2, como declara el propio implementador.

## Tasks
- T10.5 `[x]` con Evidencia concreta. OK.
- T10.6 `[x]` con Evidencia. OK en lo que cubre (tests). **Pero el criterio de fps de T11 (R48) queda incumplido**, y T11 no puede darse por cerrado.

## Verificación ejecutada por el revisor
1. `cd client && NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules npx vitest run src/tests/combatLayout.test.js src/tests/combatPanel.test.jsx` → `Tests 64 passed (64)`.
2. Medición de luma por fila sobre `client/public/assets/b/bg/combat_*.webp` (1080×1935, heurística: fila con mayor caída de luma entre 40 % y 70 % de la altura; script en scratch del revisor): crypt 0.674, moor 0.443, cathedral 0.609, ashfield 0.545, veil_marsh 0.622, veil_gate 0.534. Todos los fondos usan 0.53 (ver hallazgo 2).

## Hallazgos (lente artefacto, ronda 1)
1. **R48 incumplido** — `specs/combate_b/evidencia/despues/fps_emulador_medium.json` (`p5: 20`, `muestras[0]: 20`). Acción: volver a medir medium en kh_pixel7 con el mismo protocolo, sin excluir muestras. Si el arranque baja de verdad (carga de texturas), atacar la causa (precarga/warm-up de texturas antes de `combat:open`, `CombatScene.js`) y volver a medir. Si el criterio de R48 no es alcanzable en emulador, **no** cambiarlo por cuenta propia: dejarlo en `## Bloqueado` de `tasks.md` para decisión del owner, con los datos.
2. **Línea de suelo no calibrada por fondo** — `client/src/game/combat/artMap.js:42-49`: los seis `BG_GROUND_Y_FRAC` valen 0.53, pese al comentario de la línea 41 («Estimada de la luma por fila de cada fondo; afinar por fondo aquí»). La heurística de luma sugiere otra fila en crypt (0.674, el fondo de a1n3, el único capturado), no 0.53. Acción: calcular la línea de suelo de cada fondo sobre la imagen real, ajustar los valores y añadir la captura de un enemigo sobre cada fondo con la línea superpuesta. Si la heurística no basta, medirlo a ojo con la captura y dejarlo escrito. La prueba `combatLayout.test.js` (pie = 0.53×1720) sólo verifica la constante, no el suelo real.
3. **Higiene** — el server del worktree (`:3001`, pid 8424) sigue vivo según la nota de `review_requested`. Detenerlo o declararlo en `## Bloqueado`.

## Nota de proceso
Antes de esta revisión había cambios sin commitear en `CHANGELOG.md`, `feature_list.json` y `specs/combate_b/review.md` (intento previo del revisor, interrumpido por rate limit). Contenían un APPROVED con «R48 CUMPLIDO» y umbral p5 ≥ 30, incorrecto. Se descartaron (copia en el scratch del revisor). Nada de esto queda en la rama.

## Cambios requeridos
Ver hallazgos 1–3. Tras los cambios: nueva review (ronda 2, lente de contrato) con la medición medium corregida y la línea de suelo por fondo verificada.

---

# Review — Etapa C (T10.6 carriles y hoja visual, HEAD 98757cf) · ronda 2

## Veredicto
**APPROVED** (lente de contrato: código, tests y trazabilidad; el juicio visual queda para el visual_reviewer contra `hoja_visual.md`). Los tres puntos de la ronda 1 quedan cerrados: (1) R48 salió de F7 por enmienda del owner y está documentado; (2) el piso está calibrado por fondo; (3) no queda ningún servidor escuchando. Como falta la revisión visual, no se tocan `feature_list.json` ni `CHANGELOG.md`.

Commits revisados: 04692a1, 7e96559, 8e994aa, be4e216, a2458b1 (implementación y evidencia), 4ab9030 (bloqueo), 4e67df2 y 98757cf (documentación). Fuera de esta review: los tres restos sin commitear (`evidencia/fps_emulador.mjs`, `evidencia/visual/medidas_r2.json`, `evidencia/visual/medir_visual_r2.mjs`). No se tocaron.

## Trazabilidad
- **R24 enmendado** (cero intersección dentro de cada fila, `requirements.md:112`), **R25** y **R27**: `client/src/tests/combatLayout.test.js:40-95`. La matriz son 280 `it`: 13 nodos reales más «sin nodo», n = 1…5 y m = 1…4. Se repite con las escuadras rogue y ranger. R27 está en `:153-165`.
- **V2 sobre R24**:
  - el carril es ≥ el piso de SU fondo, leído de `calibracion_suelo.json` (`:71-75`);
  - el pie cae en el carril (`:65`), `depth` = carril (`:66`) y los carriles van en orden con ≥ 24 de separación (`:69`);
  - `HUD_TOP` ya no es 1440: vale 1328 (`client/src/game/combat/formation.js:24`) y el test lo ata a `hud_medidas.json` (`:327-331`).
  - Reproducido y contrastado por separado: ver la verificación (puntos 2 a 4).
- **R54 y V5/V6/V8/V9**: `client/src/tests/combatPanel.test.jsx:199-310`. R40 y R41 siguen en verde y `pantallasB.test.jsx` no cambió desde 91b2090 (R44).
- **R48**: la enmienda del owner está en `requirements.md:215` y `design.md:192-193`, y la feature #27 `combate_rendimiento` figura `pending` en `feature_list.json`. No bloquea.
- **R1, R2, R4, R51, R52, R53**: verificados de nuevo (ver abajo).
- **R43**: los botones nuevos cumplen por estilo: 58 px de ancho y 44 de mínimo; el cierre 44×44 se comprueba en `combatPanel.test.jsx:176-186` y «Volver» ≥ 44 está medido en V8.
- **R49**: las 18 vistas de T10.6 registran `errores: []`.
- **R28 y R50**: su evidencia es de T11 (ver H6).
- El resto (R3, R5–R23, R26, R29–R42, R45–R47) no cambió en esta ronda: conserva su `Cubre:` y su evidencia en T1–T12, y sus tests pasan en la suite completa.
- Cobertura mecánica: los 54 R tienen al menos una task con `Cubre:` y evidencia.

## Tasks
- T1–T12, T10.5 y T10.6 están en `[x]`, con `Evidencia:`. El `## Bloqueado` quedó cerrado (`tasks.md:193-195`).
- No queda ninguna `[ ]`. Algunas evidencias van en una sub-viñeta en vez de inline; es el formato ya aceptado en rondas anteriores.

## Verificación ejecutada por el revisor
1. **Suites y build:**
   - `cd client && NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules npx vitest run </dev/null` → `Test Files  33 passed (33)`, `Tests  902 passed (902)`.
   - `cd server && npx jest --runInBand --forceExit` → `Test Suites: 33 passed, 33 total`, `Tests: 545 passed, 545 total`.
   - `cd client && npm run build` → `✓ built in 9.23s`, con el único aviso preexistente de chunks > 500 kB.
   - Los 4 archivos de combate en verbose → `Tests  410 passed (410)`: combatLayout 311 (280 de la matriz), combatScene 26, combatPanel 25 y pantallasB 48.
2. **Mutaciones.** Copié `combatLayout.test.js`, `formation.js` y `artMap.js` al scratch del revisor. La línea base da 3 fallos ajenos (no copié `public/`). Resultados:
   - Detectadas por los tests:
     - `HUD_TOP = 1440` → +1 (V3).
     - piso de crypt 0,48 → 0,53 → +2.
     - un solo piso para los 6 fondos → +93.
     - enemigos 100 px sobre el piso → +111.
     - delanteros todos en el centro → +226.
     - fila EB de 4 enemigos superpuesta → +71.
     - `depth` constante → +281.
   - Detección débil o nula:
     - `FLOOR_MARGIN = −60`: solo falla `:318-323`; la matriz no lo detecta.
     - `FOOT_MARGIN = −30`: 0 fallos (H1).
3. **Chequeo independiente.** Armé un bundle de `formation.js` con `artMap.js` (esbuild del cliente) y un script propio en el scratch. El script lee `calibracion_suelo.json`, `hud_medidas.json` y `CAMPAIGN`, y usa su propia tabla acto:tipo → fondo. Recorrió 6 escuadras (mixta, rogue, ranger, warrior, mage, paladin) × 14 × 5 × 4 = **1680 combinaciones, 0 fallos**. Comprobó:
   - cero intersección dentro de cada fila, todo dentro de 824×1720;
   - piso del fondo + 8 ≤ carril ≤ `Bmin` − 8;
   - la caja de cada enemigo empieza por debajo de `Tmax`;
   - `depth` = carril, una línea por fila, orden EB < EF < HB < HF con ≥ 24 y slots 1–3 en HF.
4. **`SPRITE_GEOM` contra el alfa real.** Recalculé con sharp la caja con alfa > 0 de cada textura: 26/26 coinciden en W, H, l, r, t y b. Por eso el origen `oy = (b+1)/H` apoya de verdad la última fila con alfa sobre el carril, y el «pie± 0.00» de `hoja_medidas.json` no es una tautología.
5. **Hallazgo 2 de la ronda 1: resuelto.**
   - `client/src/game/combat/artMap.js:52-59` define 6 filas de imagen distintas, y `:62-70` las pasa al mundo con cover × 1,04 y deriva × 1,025.
   - A mano: s = 1720/1935 × 1,04 = 0,9244. Catedral: 860 + 0,11 × 1935 × s × 1,025 = 1061,7 → 1062. Los 6 valores son iguales a `calibracion_suelo.json` (825 / 860 / 1062 / 717 / 879 / 998).
   - La escena usa la misma transformación (`CombatScene.js:110-113`; test en `combatScene.test.js:257-264`).
   - Abrí `evidencia/hoja/suelo/suelo_{crypt,cathedral,ashfield}.webp`: la línea está trazada sobre cada fondo real.
6. **«Compañeros 0 px» y un contenedor por actor.**
   - Cada actor es un `Container` con sombra y sprite (`CombatScene.js:155-171`), y los marcadores van dentro (`:444-450`).
   - Cada tween toca solo al actor que anima o a sus hijos: respiración `:168`, embestida `:382`, retroceso `:397`, caída `:293-294`.
   - Tests: `combatScene.test.js:233-328`. Cubren contenedor en (cx, carril), `depth` = carril y pie en el origen; idle; attack, hit, skill, KO de enemigo y de héroe: los compañeros no varían en x, y ni ángulo, y el que actúa vuelve a su sitio.
   - Los tests previos siguen byte a byte: el bloque `:48-157` de 91b2090 es `:123-231` de HEAD. El diff solo enriquece el mock (`chain()` → `mkObj()`, `add.container`, tweens y time con estado). Son **11, no 13** (H5).
7. **Invariantes:**
   - `git diff 46d156d..HEAD --stat -- server shared` → vacío; `shared/gameConfig.js:1155` sigue en `engineVersion: 1`.
   - `gameStore.js` no tiene diff (R4); `package*.json` tampoco (R51); no hay archivos borrados (R52).
   - Barrido de R3 sobre `game/combat/*.js`, `CombatInstancePanel.jsx` y `CombatStage.jsx` buscando `Math.random`, `COMBAT`, `HERO_PASSIVE_FX`, `mitigate`, `critMult`, `shared/`, `api.` y `axios` → 0 coincidencias.
   - Ids: en `artMap.js` solo se quitó el viejo `BG_GROUND_Y_FRAC` (0,53 × 6). Las claves de nodo, enemigo, fondo y clase, y los ids `h<slot>`/`e<i>`, no cambiaron.
   - Phaser/React: `CombatScene.js` no importa React. El panel importa `enemyDisplayName` de `artMap.js` (`CombatInstancePanel.jsx:11`), un módulo puro sin imports, no una clase Phaser.
   - `window.__combatGame` (`CombatStage.jsx:56,68`) existe solo con `import.meta.env.DEV`; un grep sobre `client/dist` no lo encuentra.
8. **Higiene:**
   - Antes y después de la review no había nada escuchando en :3001, :3002, :3003, :3101, :5173–5176 ni :5180. No levanté servidores.
   - `git status` muestra solo los 3 restos fuera de alcance.

## Hallazgos (archivo:línea)
Ninguno bloquea. Son recomendaciones para el leader.
- **H1. El test no ata los márgenes.** En `combatLayout.test.js:73-74` los carriles se comparan con `g + FLOOR_MARGIN` y con `LANE_MAX`, y ambos márgenes se importan del módulo bajo prueba (`formation.js:25-27`).
  - `HUD_TOP` sí está atado a `hud_medidas.json`, pero los márgenes no: con `FOOT_MARGIN = −30` los pies quedarían 22 px bajo el borde real de los botones y ningún test fallaría.
  - Además, `SPRITE_GEOM` solo se contrasta con el webp en W×H (`:369`). Si se regenera el arte, un cambio en la caja alfa (l, r, t, b) pasaría sin que nada falle.
  - Propuesta: comparar directo con `HUD.Bmin` y `CALIB[...].groundY` (o exigir márgenes ≥ 0) y contrastar l, r, t, b con `hoja_alfa.json`.
- **H2. Pantallas más bajas que las vistas obligatorias** (derivado, no medido).
  - La pila inferior del HUD mide 174 px CSS fijos en las 3 vistas medidas: 860−686, 756−(604−22) y 800−626. El carril HF está fijo en 1320 de mundo.
  - Cuando el lienzo queda limitado por el alto, el borde de los botones en mundo es B = 1720·(1 − 174/alto del marco):
    - 360×740 → ≈1316: «¡TAP!» roza los pies del slot 1, ~2 px CSS.
    - 375×667 → ≈1271: los íconos tapan ~11 px CSS de los pies de la fila delantera, ~19 px con «¡TAP!».
    - Dentro de Telegram el marco suele ser más bajo que la pantalla.
  - El contrato fija el peor caso en 360×800 sobre las 3 vistas obligatorias (`hoja_visual.md:3,62`), así que se cumple. Pero «en cada viewport» no vale fuera de ellas.
  - Lo decide el owner: sumar una vista baja a la hoja, o derivar el carril HF del HUD real en runtime.
- **H3. R11 frente a V6.**
  - `requirements.md:53-55` dice «enemigo: se desvanece». Con T10.6 todas las unidades caen y quedan tendidas a α 0,85 (`CombatScene.js:282-295`).
  - Es coherente con V6, pero R11 no tiene enmienda escrita, a diferencia de R24 y R48.
  - También quedaron desactualizados `design.md:65` (fila `death`) y `design.md` §8 `:96-101` (cajas de 190×250 y tope en y 1440).
- **H4. R54 frente a V9.**
  - Los tests de R54 corren ahora con `node = null` (`combatPanel.test.jsx:201`) para conservar «Enemigo N».
  - En el juego siempre hay nodo, y la barra muestra el nombre del arte dibujado (`CombatInstancePanel.jsx:24-33`). Ese camino está cubierto por `:225-233` y `:180`.
  - Conviene anotar en R54 que «Enemigo N» solo aplica sin nodo.
- **H5. Conteo de tests.** `tasks.md:62` dice «Los 13 tests anteriores»; son 11 y están intactos.
- **H6. R49 y R50 se probaron antes de T10.6.**
  - El combate a1n3 completo en v1 y v2, con red y consola, es de T11. T10.6 cambió la escena, aunque el pipeline de eventos (`eventPlanner`, `eventSource`, `v1Adapter`, `createCombatGame`) no cambió desde 91b2090.
  - T10.6 sí repitió la consola limpia en 18 vistas, con rondas de victoria y derrota sobre la escena real.
  - Conviene repetir `capturar_combate.mjs` antes del merge.
- **H7. Beats de v2 sin test en la escena.** Ningún test de la escena reproduce `status`, `dot`, `heal` ni `passive` (`CombatScene.js:414-433`; los marcadores ahora van dentro del contenedor). Con `engineVersion` 1 no ocurren en producción (R23).
- **H8. Texto superado en la hoja.** `hoja_visual.md:52-55` (2026-11-07, «R24 … No se relaja») quedó superado por `:57-64` (2026-11-08). Conviene marcarlo como superado.
- **H9. Capturas por fondo.**
  - La ronda 1 pedía una captura con enemigo sobre cada fondo. La línea está trazada en los 6 (`evidencia/hoja/suelo/`), pero solo hay enemigos dibujados sobre crypt, veil_gate y cathedral.
  - Moor, ashfield y veil_marsh quedan cubiertos solo por la geometría de la matriz.

### Para el visual_reviewer (no lo juzgo)
- **Victoria.**
  - Abrí `evidencia/hoja/412x860_victoria.webp`: el cartel, en el tercio medio, tapa al bruto caído y las cabezas de los héroes traseros (Viktor, Sombra).
  - El «no tapa la fila de héroes» de `tasks.md:81` se refiere a la fila DOM de botones: `generar_evidencia_hoja.mjs:189-193` compara el cartel con `btns`. Además, la métrica V3 «HUD sobre siluetas» no incluye el cartel (`:147-151`).
  - Falta decidir si el cartel cuenta como «HUD» para V3.
- **Derrota.** Los tres delanteros tendidos se pisan entre sí: cada cuerpo ocupa ~296 de ancho con paso 280 (`CombatScene.js:248-259`). V6 no lo regula.
- **V4.** Los tamaños están en px de mundo: 40 y 60 de 824, o sea 20 y 30 px CSS a 412 de ancho. La cabecera de la hoja usa el mundo como unidad (`hoja_visual.md:3`).

## Cambios requeridos
Ninguno. H1–H9 son recomendaciones; el leader decide si se hacen antes del merge. La feature sigue `in_progress` hasta el veredicto del visual_reviewer.
