# Review: fix_test_gamehud_lv5 (feature 11, sdd:false)

## Veredicto
APPROVED

## Trazabilidad
Feature sin spec (sdd:false), no hay R<n>. Criterio de aceptación de feature_list.json: `cd client && npx vitest run` sin fallos.
- Verificado: `cd client && npx vitest run` -> Test Files 7 passed (7), Tests 150 passed (150), exit 0.

## Tasks
No aplica (sin tasks.md). El implementador entregó evidencia en el handoff (run 16, commit a07b47c).

## Causa (verificada)
- El cambio de texto es deliberado: commit 99525ca "RTS HUD v3" quitó el prefijo "Lv" del badge de nivel. En el histórico, `git log -S"Lv"` sobre `client/src/components/overlay/GameHUD.jsx` lista 99525ca como único cambio (diff: `-Lv{player.level || 1}` / `+{player.level || 1}`).
- El componente actual renderiza solo el número: `client/src/components/overlay/GameHUD.jsx:126` (`<span ...>{player.level || 1}</span>`). El comportamiento es el correcto según el rediseño; no hay bug en GameHUD.
- Conclusión: el test estaba desactualizado, no el componente.

## Diff revisado (49f26bf...feature/fix_test_gamehud_lv5)
- `client/src/tests/GameHUD.test.jsx:28-33`: el `it` se renombra a "renders player level as 5 in the level badge", no se borra ni se marca skip; la aserción pasa de `getByText('Lv5')` a `getByText('5')`. Comentario con referencia a GameHUD.jsx:126 y 99525ca. Correcto.
- `feature_list.json`: `known_failures` vacío (era la entrada que tolerada el fallo). Correcto.
- Observación no bloqueante: `getByText('5')` es una aserción menos específica que 'Lv5' (cualquier nodo con texto exacto "5" la satisface). Aceptable para un badge; si se quiere más rigor, usar `getByTestId` o un `title`/aria-label en el badge. No se pide cambio.

## Cambios aplicados por el reviewer (en la rama)
- `feature_list.json`: feature 11 `status` -> `done`.
- `CHANGELOG.md` bajo `## [Unreleased]` / `### Fixed`: línea de la feature.
- `specs/fix_test_gamehud_lv5/review.md`: este archivo.
- Conocimiento (`_conocimiento/kingdoms-harvest/PAQUETE.md`, fuera del repo): 1 línea en Decisiones y 1 en Trampas.
- Nota: PAQUETE.md:170 todavía dice que el known_failure está "pendiente"; queda obsoleto tras este cierre. No se reescribió; el owner puede limpiarlo.

## Cambios requeridos
Ninguno.
