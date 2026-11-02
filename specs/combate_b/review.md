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
