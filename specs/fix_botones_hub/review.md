# Review — fix_botones_hub (#13)

Tarea: t_c5b7c877 · Rama: feature/fix_botones_hub · Commit revisado: 9aa3845 (ronda 2, sobre 9cb135f) · Base: feat/art-direction-b (2f048a1)
Revisor: reviewer · Ronda: 2 (ejecución) · Sin spec SDD (sdd:false); criterios = acceptance de feature_list.json y del body de la tarea, más el ajuste obligatorio de p-kh (QuestRail 360 px).

## Veredicto

APPROVED.

Las cuatro observaciones de la ronda 1 quedaron resueltas y reproducidas: Bastión a 40 px, sin desborde vertical, QuestRail sin recorte y vitest + build en verde. Hay tres notas no bloqueantes (abajo).

## Trazabilidad (acceptance de feature_list.json + body)

- Columnas laterales: mismo ancho, alto y x (±1 px), gap constante. Reproducido en 412x860 y 360x740: izq 64x64 y der 64x52, `dispersión=0`, `gaps=[6,6,6,6,6]` (izq) y `[6,...]` (der). Ver `App.jsx:235` (`.kh-rail--right`) y `index.css:327-343`.
- Ningún solape, todo dentro del viewport: `sin_solapes: ok`, `dentro_del_viewport: ok` en ambos viewports.
- Ícono centrado (±2 px) y etiquetas sin recorte: `icono_centrado: ok`, `etiquetas_sin_recorte: ok`.
- Fila de Operaciones: 4 botones visibles y clickeables (`elementFromPoint` devuelve el propio botón): `ops=4`, `clickeables_elementFromPoint: ok` (tras cerrar el popup de racha, ver nota 1).
- Táctiles >= 44x44: `tactiles_44: ok` (riel 64x64/64x52, Operaciones 56x52/144x52/196x52).
- Regla ui_kit_b (edificio >= 40 px): `castle_icono_40: ícono 40px` en el riel izquierdo. Restaurado en `QuickActionsSidebar.jsx:11` (`iconSize: 40`) y `:58` (`iconSize={a.iconSize}`).
- Desborde del botón Bastión: `riel_contenido_dentro_del_marco: ok` (scrollHeight <= clientHeight, ícono y etiqueta dentro del marco en 14 botones).
- QuestRail (ajuste de p-kh): `QuestRail.jsx:13-27` sin `overflow-x-auto`, botón `min-w-0 flex-1 text-left`, `line-clamp-2`, `title={label}`, «Objetivo:» con `hidden min-[400px]:inline`. Medido: `quest_sin_recorte: ok` y `quest_texto_completo: ok` en 360 y 412 ("Despertar del Bastión", 1 línea, sin recorte).
- Sin cambios de colores/estados ni de qué botones existen. Duplicados Logros×2, Mundo×2, Bastión×2 sin tocar.
- Build: `vite build` OK (salida a carpeta temporal).
- Feature 13: `in_progress` en feature_list.json (se marca `done` en el commit de aprobación).

## Ejecución (reviewer, ronda 2)

- `NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules npx vitest run` en client/: 19/19 archivos, 289/289 tests.
- `vite build` en client/ (outDir temporal): built OK, sin errores (solo avisos de tamaño de chunk preexistentes).
- Medición Playwright independiente (copia del script `specs/fix_botones_hub/evidencia/medir_hud.mjs`, salida fuera del repo, sin tocar la evidencia del implementador): 27 aserciones en 412x860 y 360x740, todas OK, consola 0 errores. Las medidas coinciden con `medidas_despues.json` del implementador (mismas coordenadas en ambos viewports).
- Servidor de medición propio: Vite en :5192 con proxy a server ya levantado en :3001, config en scratch (no en el repo).

## Notas no bloqueantes

1. Popup de racha diaria: en un server nuevo aparece «Racha de 3 días … Toca para cerrar» (cuadro en y≈673-764) y tapa la fila de Operaciones; con él, `clickeables_elementFromPoint` falla en 4 botones. El script de evidencia no lo cierra. Sugerido, no requerido: agregar a `medir_hud.mjs` un paso que toque «Toca para cerrar» antes de medir, para que la evidencia sea reproducible en cualquier estado del server. Registrado en PAQUETE.md (Trampas).
2. Bastión del riel izquierdo: el implementador subió la altura de todo el riel izquierdo a 64 px (no a 52 px como sugería la ronda 1). Es coherente (mismo alto en la columna, táctil OK, sin solapes) y queda documentado en `index.css:335-336`. Aceptado.
3. vitest: el test `iconSheet.test.js` necesita `sharp`, que solo está en la raíz del repo principal. El comando con `NODE_PATH` está documentado en el summary y en PAQUETE.md, pero depende de un `node_modules` externo a la worktree. Aceptado como caveat de entorno (ya conocido en ui_kit_b).
4. Fuera de alcance (p-kh): Calendario y Pase comparten el ícono `scroll`; falta un ícono de calendario/libro en la hoja. Feature de arte aparte.

## Cambios requeridos

Ninguno.
