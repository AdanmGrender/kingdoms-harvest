# Review — fix_botones_hub (#13)

Tarea: t_c5b7c877 · Rama: feature/fix_botones_hub · Commit revisado: 9cb135f · Base: feat/art-direction-b (2f048a1)
Revisor: reviewer · Ronda: 1 (artefacto + ejecución) · Sin spec SDD (sdd:false); criterios = acceptance de feature_list.json y del body de la tarea.

## Veredicto

CHANGES_REQUESTED.

Motivo: regresión de una decisión aprobada en ui_kit_b. El commit quita `iconSize={a.id === 'castle' ? 40 : 32}` de QuickActionsSidebar y el Bastión vuelve a 32 px.

## Hallazgos bloqueantes

1. `client/src/components/hud/QuickActionsSidebar.jsx` (riel izquierdo, `ACTIONS.map`, antes línea 58, eliminada en 9cb135f): el Bastión (`castle`, línea 11) pasó a 32 px. Esto incumple la regla de ui_kit_b: sprites de edificio a 40 px o más con nombre visible (`specs/ui_kit_b/review.md:8`, `:19`, `:103`; `specs/ui_kit_b/tasks.md` T33). BottomNavBar.jsx:31 ya usa 40 px para el mismo Bastión.
   Reproducido: `git diff feat/art-direction-b...feature/fix_botones_hub -- client/src/components/hud/QuickActionsSidebar.jsx` muestra la línea `-  iconSize={a.id === 'castle' ? 40 : 32}` sin reemplazo.
   Qué hace falta: restaurar el tamaño 40 para `castle` (por ejemplo con `iconSize` de la constante de ACTIONS, o con la misma expresión), sin tocar los demás.

2. Consecuencia de layout a resolver junto con (1): el botón es `.kh-rail > .kh-iconbtn` de 64×52 con `border 2px` y `padding 2px` (index.css:337-343). Dentro quedan 44 px de alto útiles. Un ícono de 40 px más una etiqueta de 12 px con `gap: 2px` (index.css:315) suman ~55 px, así que el contenido desborda el marco. El implementador tiene que medirlo, no asumirlo: `scrollHeight <= clientHeight` y `getBoundingClientRect` del ícono dentro de su marco en 412x860 y 360x740. Si desborda, opciones: subir la altura del riel izquierdo (solo si el riel derecho y la fila de Operaciones siguen sin solapes), o bajar el padding/gap solo para el botón castle. No cambiar colores ni arte.

## Trazabilidad (criterios del body / acceptance)

- Columnas laterales mismo ancho/alto/x (±1 px), gap constante: OK en la evidencia (`specs/fix_botones_hub/evidencia/medidas_despues.json`, 412 y 360: `izq_mismo_*`, `der_mismo_*` ok; `gaps=[6,6,6,6,6]`). Pero el riel izquierdo sigue midiendo ícono 32 px; la medida no cubre el requisito de 40 px. Pendiente de (1).
- Sin solapes, todo dentro del viewport: OK en la evidencia (`fallan: []` en ambos viewports). Revalidar tras (1)/(2).
- Ícono centrado (±2 px) y etiquetas sin recorte: OK en la evidencia para 412 y 360, incluido `quest_sin_recorte` / `quest_texto_completo` (ajuste pedido por p-kh en QuestRail: `overflow-hidden`, `line-clamp-2`, `title`, "Objetivo:" oculto <400 px). Revisado en el diff: QuestRail.jsx cumple lo pedido.
- Fila de Operaciones: 4 botones visibles y clickeables: OK (`ops=4`). Diff de BastionHub.jsx: `h-[52px]`, `w-14 shrink-0` para los chicos.
- Táctiles >= 44x44: 64x52 en riel, 56x52 en Operaciones: OK por el tamaño declarado. Verificar en medidas con el ajuste (2).
- Sin cambios de colores/estados ni de qué botones existen: el diff no toca estilos de color. Eliminado `style={{ width: 52 }}` en EventSidebar y el `SpriteIcon` pasa a `icon="flame"` (tamaño 32 por default, antes 28). Aceptable, es un tamaño de ícono no de edificio.
- Duplicados Logros×2, Mundo×2, Bastión×2: no tocados. Correcto.
- Feature_list.json: entrada 13 en `in_progress` (no `done`, correcto hasta aprobar).

## Ejecución (reviewer)

- `npx vitest run` en client/ (worktree): 18 de 19 archivos OK, 274/274 tests. 1 archivo falla al cargar: `src/tests/iconSheet.test.js` → `Cannot find module 'sharp'`. `sharp` está en el package.json RAÍZ (`../package.json:20`), no en client/, y no existe en `client/node_modules`. Es un problema del entorno de la worktree (falta `npm ci` en la raíz o el test no debería importar sharp en client); no es un defecto del commit, pero el implementador debe dejar la evidencia de `vitest 289/289` reproducible o aclarar cómo corrió (NODE_PATH no alcanza para un import ESM). Probé `NODE_PATH` hacia el repo principal: mismo resultado, sin sharp allí.
- `npx vite build`: no lo pude correr en primer plano (el comando se detecta como servidor). Queda pendiente la verificación de build; el implementador reporta OK, hay que repetirlo en background o con `vite build` directo tras el cambio.
- No se corrió Playwright (medidas) en esta ronda; las medidas de la evidencia son del commit 9cb135f y deben regenerarse tras el cambio.

## Cambios requeridos

1. QuickActionsSidebar.jsx: restaurar `iconSize` 40 para `castle` (Bastión). Única excepción de tamaño de edificio en el riel izquierdo.
2. index.css / QuickActionsSidebar.jsx: resolver el desborde vertical del botón castle con ícono 40 (medir `scrollHeight` y la caja del ícono). Sin solapes con la fila de Operaciones (y ≥ 604 px) ni con el riel derecho.
3. Regenerar `specs/fix_botones_hub/evidencia/medidas_despues.json` y `hub_despues_412.webp` / `hub_despues_360.webp` con las aserciones en verde, agregando una aserción de tamaño de ícono castle >= 40.
4. Dejar reproducible `vitest` completo (iconSheet.test.js: aclarar en el summary cómo se instala sharp, o gatear el test) y correr `vite build` con salida.
5. No commitear `client/vite.evid.config.js` (untracked, solo evidencia local).

## Notas no bloqueantes

- Calendario y Pase comparten el ícono `scroll` y no se distinguen sin etiqueta. Fuera de alcance, ya anotado por p-kh; feature de arte aparte.
- Duplicados de botones (Logros×2, Mundo×2, Bastión×2): decisión de diseño, no tocar en esta feature.
