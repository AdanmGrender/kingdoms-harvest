# Review — poses_b_piloto (piloto r3, ronda 2, lente ejecución)

Rama `feature/poses_b_piloto` @51a28aa · revisor `reviewer` · tarea t_6ac7aac7 (run 137)

## Veredicto
**CHANGES_REQUESTED**

Lo ejecutado reproduce las cifras de NOTAS (measure.js R=16, measure_head.js R=26); la suite pasa (34 archivos / 625 tests) y el build sale bien. Pero la ronda 2 no cumple el pedido de p-kh: no se igualó la altura de cabeza en skill/victory, el ancho de torso sigue fuera (hit 0,89×, skill 0,72×, victory 0,69×), y la cifra de cabeza del KO en NOTAS no es reproducible con el script commiteado. Todo se corrige sin generar.

## Trazabilidad
Sin requirements/tasks formales. Criterio = veredicto p-kh (NOTAS r2/r3) y comentario de central en t_6ac7aac7.

| Criterio | Evidencia ejecutada | Estado |
|---|---|---|
| bruto_ko r3 cumple la regla (rodillas, sin sangre, más bajo y ancho) | Veredicto p-kh (t_e75d1b5b); no vi la imagen | OK (aceptado por p-kh) |
| hit: altura de cabeza = idle | `measure_head.js` R=26: hit 153 vs idle 146 (1,05×) | OK |
| hit: ancho de torso = idle | `measure.js` R=16: torso hit 351 vs idle 378 (0,93×); `measure_head.js` torso 333 vs 376 (0,89×) | **NO CUMPLIDO** (−7…−11 %) |
| skill: altura de cabeza = idle | `measure_head.js` devuelve 67 px (no es una cabeza). NOTAS: "no separable por geometría" | **NO CUMPLIDO / NO MEDIDO** |
| victory: altura de cabeza = idle | `measure_head.js` 68 px. NOTAS: "no separable" | **NO CUMPLIDO / NO MEDIDO** |
| skill/victory: ancho de torso = idle | `measure.js` R=16: skill 303 (0,80×), victory 265 (0,70×); `measure_head.js` 272 / 259 | **NO CUMPLIDO**; justificación "es de la pose" sin medida propia |
| ko: cabeza = idle (no altura total) | NOTAS: "≈150 por perfil de filas". `measure_head.js` (commiteado): headToShoulder 114 vs idle 146 (0,78×). No reproducible | **CONTRADICTORIO** |
| Alfa: esquinas 0, 1 componente | Verificado en ronda 1 (esquinas 0). Esta ronda no re-corrió `verify_alpha_b.js` | OK (heredado) |
| Tests / build | `npx vitest run </dev/null`: 34 files / 625 passed. `npm run build`: OK | OK |

## Hallazgos de ejecución
1. **NOTAS.md inconsistente con sus propios scripts.** Para hit NOTAS dice "altura ≈ 648", pero `measure.js` R=16 da h=694 frente a 584 del idle (+19 %: la figura queda más alta que el idle, no igual). `measure_head.js` R=26 da h=589 vs 554. Las cifras de altura no cuadran entre herramientas; hay que explicar cuál se usa y por qué.
2. **Cabeza de skill/victory sin medir.** `measure_head.js` cae en 67–68 px (no es una cabeza). Declarar "no separable" sin intentar otro método no cumple "medir la altura de cabeza". Faltan al menos un método alternativo documentado (p. ej. recorte manual de la banda coronilla→mentón con las mismas coordenadas en idle y en la pose, o marcas de referencia en el crudo) con números.
3. **KO: cifra de cabeza no reproducible.** NOTAS dice ≈150 (perfil de filas, sin script en el repo). El script commiteado da 114 vs 146. El perfil de filas que reproduje a mano (cada 8 px) no permite confirmar ninguno de los dos números. Hay que dejar un método reproducible y su cifra.
4. **Torso de skill/victory.** Ya no basta con "es de la pose" citando attack (también 0,68×). Opciones: corregir la escala/recorte o medir el torso de la pose con la misma máscara y justificar la diferencia con cifras de hombros/caderas.

## Cambios requeridos
1. **skill y victory — altura de cabeza:** medir la cabeza (coronilla → mentón o → hombros) con un método reproducible que no use la máscara R=26 (que falla ahí), en idle y en cada pose, y dejar el script/parámetros en `art-b/poses_piloto/`. Ajustar la escala común de la hoja (`process.sh`, `--scale 1.267`) si la cabeza difiere más de ±5 %. Sin generar.
2. **Torso de hit, skill y victory:** o se corrige la escala/recorte hasta acercarse a 1,0× (hit ya está en 0,89–0,93×), o NOTAS justifica con números propios por qué esa pose tiene torso más estrecho. Hoy la justificación se apoya en attack, que no es lo que se pidió.
3. **KO:** sustituir "≈150 por perfil de filas" por una medida reproducible con el script commiteado o con uno nuevo; si el resultado es 114 (0,78×), reconocerlo y decidir si la cabeza caída lo justifica.
4. **NOTAS.md:** unificar la altura de hit (648 vs 694 vs 589) explicando la herramienta usada, y eliminar cifras que no salen del script. Corregir la fila "hit (ahora ×1,419)" si la altura real difiere.
5. Tras el reproceso: regenerar `evidencia/piloto/contact_poses.webp`, regrabar `despues.webm` si el arte cambia, y repetir `npx vitest run </dev/null` y `npm run build`.
6. **Higiene:** el vite huérfano pid 20060 en :5174 sigue según NOTAS. Frenarlo a mano antes de relanzar.

No se requiere generación: quedan 2 de 8 en reserva.

## Notas del revisor
- No pude ver las imágenes (solo geometría y ejecución). El ojo humano de p-kh sigue siendo el criterio final para skill/victory.
- Ronda siguiente: lente de contrato. Se re-leerá el veredicto p-kh completo y se verificará que cada punto de esta revisión está resuelto.
