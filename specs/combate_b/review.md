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
