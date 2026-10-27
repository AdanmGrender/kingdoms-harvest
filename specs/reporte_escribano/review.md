# Review — `reporte_escribano` (feature 6, B1.4)

- Revisor: reviewer (SDD), task t_41b7bc17, run 78
- Rama: `feature/reporte_escribano`, HEAD `b7ce340` (implementación), base `feat/art-direction-b`
- Ronda: 1 (lente artefacto). Sin `changes_requested` previos.
- Alcance: `requirements.md` R1–R33, `design.md`, `tasks.md` T1–T8, diff `feat/art-direction-b...feature/reporte_escribano`.

## Veredicto

**APPROVED**

Cada R1–R33 tiene al menos una task `[x]` con `Evidencia:` que se verificó (ver Trazabilidad). Las 8 tasks están `[x]`. No hay sección `## Bloqueado` con contenido. Las suites están en verde: server 393/393, cliente 401/401.

**Caveat operativo (no bloquea el código):** el Vite de Playwright (pid 9420, puerto 5174) sigue en `LISTENING`. El implementador no pudo matarlo porque `taskkill /F` fue bloqueado por el guard de aprobaciones del modo single-query. Yo tampoco pude (mismo bloqueo; no busco rodeos para un comando marcado como peligroso). Hay que matarlo a mano: `taskkill /PID 9420 /F`. **No tocar pid 18708 (5173)**, no es de esta tarea.

## Trazabilidad

| R | Task | Verificación del reviewer |
|---|---|---|
| R1 | T1, T2 | `idleService.js:186-237`: campos existentes sin cambios; `idleService.test.js` sin modificar (sin entrada en `git diff --name-status`); suite server verde. |
| R2 | T1, T2 | `idleService.js:186-194` arma `storage` con `afterRes` y `caps`; `idleServiceStorage.test.js:49-63` (delta con capacidad real: `gold` → `{amount, capacity: 800}`) y `:65-77` (lleno sin delta presente). |
| R3 | T1, T2 | `idleService.js:172-180`: `_capacitiesFor` omite `null`/no numérico; `idleServiceStorage.test.js:88-100`. |
| R4 | T2 | `hasContent` (`idleService.js` ~`:201`) no mira `storage`; `idleServiceStorage.test.js:79-86` (lleno sin delta → `null`). |
| R5 | T1, T8 | `git diff --numstat feat/art-direction-b...feature/reporte_escribano -- server/src` → `27 0 server/src/services/idleService.js`. Sin migraciones ni `shared/`. |
| R6 | T2, T4, T6, T8 | `git diff --name-status … -- server/tests client/src/tests` → solo `A` (3 archivos nuevos). Suites completas en verde. |
| R7 | T3, T4 | `escribanoLines.js:8-35` (6/4/4/4); `escribanoLines.test.js:33-39`. |
| R8 | T3, T4 | `escribanoLines.js` sin `Math.random` ni `Date` (grep vacío); `escribanoLines.test.js:47-52`. |
| R9 | T3, T4 | `escribanoLines.js:49-51`; `escribanoLines.test.js:61-67`. |
| R10 | T3, T4 | `escribanoLines.js:37-39, 52-55`; bordes en `escribanoLines.test.js:69-84` (3 599 999 / 3 600 000 / 86 399 999 / 86 400 000). |
| R11 | T3, T4 | `escribanoLines.js:58-72` (FNV-1a sobre `String(floor(awayMs))`); `escribanoLines.test.js:92-99` (500 valores cubren las 6 frases de `defecto`). |
| R12 | T4 | `escribanoLines.test.js:102-108` (EMOJI_RE, `\d`, términos v1, recursos). Revisé las 18 frases: sin cifras ni nombres de recursos. |
| R13 | T4 | `escribanoLines.test.js:110-116`. |
| R14 | T3 | Contrastado contra `docs/lore.md:72-77` (el Escribano lleva el libro, el granero no da abasto, las ratas se llevan lo que sobra) y `docs/lore.md:151-152` (diezmo que nadie le reclama). Las frases usan «señor», diezmo, ratas y granero; sin términos sci-fi. Tono aprobado por el owner (Q6, `d2d3989`). |
| R15 | T5, T6 | `OfflineReportModal.jsx:49` (`if (!report) return null`); test `OfflineReportModal.test.jsx:45-48`. |
| R16 | T5, T6, T7 | `OfflineReportModal.jsx:58-59`; test `:50-59` (`data-variant=parchment`, `rgb(216,200,160)`); evidencia `evidencia/*.webp` (script). |
| R17 | T5, T6 | `:59-60`; test `:61-65`. |
| R18 | T5, T6 | `formatAway` `:29-35`, exportado; tabla de test `:68-85` con los 7 casos (5 min … 72 h). |
| R19 | T5, T6 | `:70-86`; test `:88-100` («Trigo», «Madera», id como respaldo). |
| R20 | T5, T6 | `:52, 67`; test `:102-108`. |
| R21 | T5, T6 | `:113-118` (`gem`); test `:112-118` (`+1.5 KH`, ausente con 0). |
| R22 | T5, T6 | `:120-131` (usa `e.text`, `scroll`, no `e.icon`); test `:120-131` con emoji ausente en el DOM. |
| R23 | T5, T6 | `:77-84`; test `:135-143` (`480 / 500`). |
| R24 | T5, T6 | `:54-55, 94-111` (fila propia para llenos fuera de `resources`) y `:80-82` (texto «Granero lleno» dentro); test `:145-166`. |
| R25 | T5, T6 | `:53` (`report.storage \|\| {}`); test `:168-176`. |
| R26 | T5, T6 | `:47` (`useMemo` con `pickEscribanoLine`), render `:135`; test `:180-195`. |
| R27 | T5, T6 | `:138-140` (`Button primary`, `minHeight: 44` en `Button.jsx:32`); test `:198-208`. |
| R28 | T5, T6 | `grep -n "rgba("` vacío sobre `OfflineReportModal.jsx`; test `:211-220`; `noEmoji.test.js` verde sin tocar (`client/src/tests/noEmoji.test.js` no aparece en el diff). |
| R29 | T5, T6 | `SpriteIcon size={28}` (`:74, 100, 115, 126`); botón 44 px (test `:202`). |
| R30 | T7 | `specs/reporte_escribano/evidencia/consola.txt`: los tres webp 824×1720 con `scrollWidth<=clientWidth`, botón 48 px visible, scroll interno solo en el largo, 0 errores. Ver caveat de la verificación visual. |
| R31 | T5, T8 | `git diff --stat feat/art-direction-b...feature/reporte_escribano -- client/src/App.jsx client/src/store server/src/services/playerService.js` vacío. |
| R32 | T8 | `git diff --stat … -- client/public art-b` vacío. |
| R33 | T8 | `grep -rn protectedPerLevel server/src client/src shared` vacío. |

## Tasks

| Task | Estado | Evidencia revisada |
|---|---|---|
| T1 | [x] | numstat `27 0`; `hasContent` intacto (`idleService.js:201`). |
| T2 | [x] | 5 tests nuevos; `Tests: 393 passed, 393 total` reproducido. |
| T3 | [x] | 18 frases = borrador de `design.md` §3 (comparado frase a frase). |
| T4 | [x] | `escribanoLines.test.js` 117 líneas, todos los casos de R7–R13. |
| T5 | [x] | Modal sobre `Panel`/`Button`/`SpriteIcon`; sin `rgba` ni verde. |
| T6 | [x] | `OfflineReportModal.test.jsx` (221 líneas, R15–R29). Reproducido: 401 tests en la suite cliente. |
| T7 | [x] | Artefactos `reporte_corto/largo/lleno.webp` y `consola.txt` presentes. Script `scripts/reporte_escribano_evidence.js` (158 líneas) en el diff. |
| T8 | [x] | Todas las comprobaciones de cierre reproducidas (ver Verificado). |

## Verificado (ronda 1: artefacto + reproducción puntual)

- Lectura en frío del diff `idleService.js` (+27/-0), `escribanoLines.js` y `OfflineReportModal.jsx` antes de releer la narrativa del implementador.
- `cd server && npx jest --runInBand --forceExit` → `Test Suites: 26 passed, 26 total`, `Tests: 393 passed, 393 total`.
- `cd client && NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules npx vitest run` → `Test Files 23 passed (23)`, `Tests 401 passed (401)`. Con `NODE_PATH` se reproduce el resultado del implementador; sin él, según la nota del implementador, solo falla `iconSheet.test.js` por `sharp` (ajeno a esta feature; no lo reproduje sin `NODE_PATH`).
- `git diff --name-status … -- server/tests client/src/tests` → solo `A`.
- `feature_list.json`: el diff de la feature cambia `status` a `in_progress` (lo que T8 pide) y `assignee` a `spec-author`; no toca otras features.

## Observaciones (no bloquean)

1. `OfflineReportModal.jsx:37-40` duplica la función `isFull` de `escribanoLines.js:41-46`. Conviene exportar una sola (p. ej. desde `config/escribanoLines.js`) en una limpieza posterior.
2. `OfflineReportModal.jsx:13-27` duplica `RESOURCE_ICONS` y `RESOURCE_NAMES` de `CommerceView`. `design.md` §4 lo acepta de forma explícita; unificar queda para otra feature.
3. Verificación visual de R16/R30: no pude inspeccionar los `.webp` en esta sesión. Lo que sostiene R30 es la salida del script (`consola.txt`: `scrollWidth<=clientWidth`, botón visible, 0 errores). Si el owner quiere ver el pergamino, las capturas están en `specs/reporte_escribano/evidencia/`.
4. Frases del Escribano: `escribanoLines.test.js` valida reglas formales (dígitos, emojis, longitud, término «granero»). El tono quedó a juicio del owner en Q6 y no lo reevalúo aquí.

## Cambios requeridos

Ninguno. Verdicto **APPROVED**.

Acción externa pendiente (owner o central): matar a mano el Vite de Playwright, `taskkill /PID 9420 /F`, antes de liberar el puerto 5174.
