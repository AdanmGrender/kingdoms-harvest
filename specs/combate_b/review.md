# Review — combate_b · Etapa B (T8–T10), S1 (rama `feature/combate_b`, commit revisado ccf3114)

## Veredicto
**CHANGES_REQUESTED — Etapa B (T8–T10), ronda 1** (lente artefacto + verificación de ejecución).

Cambio requerido: `art-b/gr/process.sh` no incluye los recortes de paladin, rogue, los 14 enemigos ni los 5 fondos (T8 lo exige explícitamente). Ver «Cambios requeridos».

La feature **sigue `in_progress`** (T11–T12 pendientes). No se toca `feature_list.json` ni `CHANGELOG.md`. El review de la Etapa A (APPROVED, ronda 1) queda en el historial, commit e153a93.

## Trazabilidad
- R30 — `Cubre:` de T10. Evidencia: `client/src/tests/combatLayout.test.js` (mapa Q4, fondos por acto+tipo, cada url existe en `public/`). Pasa en la ejecución de abajo.
- R33 / R34 / R35 — `Cubre:` de T8, T9 y T10.
  - R34 (puertas): `evidencia/aprobacion_arte.md` registra P1, P1r2+P2 y P3 con el veredicto de p-kh. Las hojas `evidencia/contacto_T8_heroes.webp`, `contacto_T8r2_T9_P2.webp` y `contacto_T10_P3.webp` existen.
  - R33 (generación): `art-b/gr/manifest.json` con `sheet_paladin`, `sheet_rogue`, 14 enemigos y los 5 fondos. Generación solo por web (`gen_art_web.js`). Ningún `gen_art_b.js` ni `server/.env` en el diff.
  - R35 (nombres originales): evidenciado solo por la lista de design §11. No bloquea.
- R1–R4, R28, R43, R48–R52: fuera de esta etapa (T11–T12).

## Tasks
- T8, T9, T10 `[x]`, cada una con `Evidencia:` inline. Los commits 3ef39a0, 4bc226f, 05ade22, 2c6eeb8 y ccf3114 existen en `git log`.
- T8 pide «ampliar `art-b/gr/manifest.json` **y** `art-b/gr/process.sh`». `process.sh` no aparece en `git diff e153a93...feature/combate_b` → **incumplido** (ver Cambios requeridos).
- T10 cubre el mapeo a fondos; `artMap.js` y su test se revisaron (ver «Revisión de código»).
- `## Bloqueado`: vacío.

## Verificación reproducida (reviewer)
- `cd client && npx vitest run`: `Test Files 1 failed | 32 passed (33)`, `Tests 589 passed (589)`. El único fallo es `iconSheet.test.js` (`Cannot find module 'sharp'`), preexistente.
- `NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules npx vitest run src/tests/iconSheet.test.js` (desde `client/`): `Tests 15 passed (15)`.
- `vite build` (outDir a scratch, sin tocar el repo): `✓ built in 6.89s`.
- `art-b/gr/manifest.json` tiene 30 entradas `"id"`. `git status` limpio.
- `server/.env` no existe en el worktree.
- Puertos: `:5180` y `:3101` son del owner (no tocados). `:5173` no escucha.
- No se pudieron ver las imágenes `.webp` (sin herramienta de visión). Los dudosos de arte son decisión de p-kh y quedan registrados en `aprobacion_arte.md`.

## Revisión de código (archivo:línea, diff contra e153a93)
Comprobado sin hallazgos bloqueantes:
- `client/src/game/combat/artMap.js:18-44` — `HERO_ART` incluye paladin y rogue. `ENEMY_BY_NODE` coincide con design §11 / Q4 contra `shared/gameConfig.js:1028-1081`: a1n3 `combat` → bruto; a1n7 «Carroñeros» → carroneros; a1n4/a1n8 `wave` → aullador; a1n5 «El Heraldo Putrefacto» → boss_heraldo; a1n9 «Devorador de Almas» → boss_devorador; a2n5 «Coloso de Ceniza» → coloso; a2n7 «Los Sin Rostro» → sin_rostro; a2n10 «La Voz del Velo» → voz_del_velo.
- `artMap.js:47-51` — `ENEMY_BY_TYPE.wave` pasó de `coloso` a `bruto`. Consistente con design Q4 («el resto cae a bruto»); los `wave` de acto 2 (a2n4, a2n8) quedan en bruto.
- `artMap.js:54-62, 82-96` — `BG_BY_ACT_TYPE` y `actOf()`: el acto sale de `n.act` o del id; sin acto cae al tipo. Coincide con design:107 («por type/acto en Etapa B»).
- `client/src/tests/combatLayout.test.js:91-113` — se cambiaron las expectativas `paladin/rogue → warrior` por el propio arte. Justificado: design.md:105 y T8. Sin `.skip` ni `.only`.
- `scripts/gen_art_web.js:110` — `GEMINI_WEB_EXE` solo cambia el ejecutable de Edge; no lee `server/.env`. Correcto.
- `scripts/process_art_b.js:25,41,215` — flag `--quality` (default 88, sin cambio de comportamiento) y `--margin` ya existente. Sin regresión.

## Cambios requeridos
1. `art-b/gr/process.sh` (T8, «ampliar… y `art-b/gr/process.sh`»): agregar las líneas de recorte de `paladin_idle/attack` y `rogue_idle/attack` (`--height 640`, con las coordenadas medidas que usó el implementador), de los 14 enemigos (`--height 720`; `boss_devorador_hit` con `--margin 8 --quality 77`, tal como consta en `evidencia/aprobacion_arte.md`), de `voz_del_velo_hit` (976x1095 → 642x720) y de los 5 fondos (`--scene --width 1080`). El archivo usa CRLF; mantenerlo. Si el script no reproduce los `.webp` del commit, corregirlo hasta que sí.
2. `tasks.md` T8: citar en la evidencia inline el commit de `process.sh`. Quitar la línea `  - Evidencia:` vacía residual bajo T8.

## Observaciones no bloqueantes
- `enemies/voz_del_velo_hit` fue aprobado por p-kh en P3 sin cumplir la regla literal de P2 (ver `evidencia/aprobacion_arte.md`). Es decisión de p-kh y queda registrada. Este review no la revierte.
- Para Etapa C: verificar en captura que el portal de `bg/combat_veil_gate` no tape los efectos verdes (ya anotado en `aprobacion_arte.md`).
- Si cambia `design.md:175`, sincronizar `artMap.js` y `combatLayout.test.js:99-107`.
