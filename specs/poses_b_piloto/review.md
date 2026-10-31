# Review — poses_b_piloto (piloto r3, ronda 3, lente contrato)

Rama `feature/poses_b_piloto` @f3a746f · revisor `reviewer` · tarea t_6ac7aac7 (run 139)

## Veredicto
**CHANGES_REQUESTED**

bruto_ko r3 (050db26) queda aceptado por p-kh y las 5 piezas aprobadas están commiteadas. Falta el reproceso de escala del warrior que pidió p-kh (comentario de central en t_6ac7aac7): igualar altura de cabeza y ancho de torso del idle, y que el KO iguale la cabeza. La ronda 3 de NOTAS documenta las cifras pero no ejecuta el pedido: no cambia el arte y justifica la diferencia por pose, sin validación de p-kh. Se puede corregir sin generar (quedan 2 de 8).

## Trazabilidad
Criterios = veredicto p-kh (t_e75d1b5b, vía comentario de central) más los cambios requeridos de las rondas 1–2 de este review.

Medido ejecutando `R=14 node art-b/poses_piloto/measure_body.js` (cabeza = coronilla→hombros; torso = mediana 30–55 %). Las cifras coinciden con NOTAS r3.

| Criterio | Evidencia ejecutada | Estado |
|---|---|---|
| bruto_ko r3 (rodillas, sin sangre, más bajo y ancho) | Aceptado por p-kh; commit 050db26 | OK |
| hit: altura de cabeza = idle | head 0,96× (R=14); 1,05× (measure_head, R=26) | OK (dentro de ±5 % con cualquiera) |
| hit: ancho de torso = idle | torso 0,93× (R=14); 0,89× (measure_head) | **NO CUMPLIDO** (NOTAS usa tolerancia ±10 % no pedida) |
| skill: altura de cabeza = idle | head **1,14×** (R=14) | **NO CUMPLIDO** (fuera de ±5 %) |
| skill: ancho de torso = idle | torso **0,81×**, cintura 0,83× | **NO CUMPLIDO**; «es de la pose» sin reescalar |
| victory: altura de cabeza = idle | head **0,86×** (R=14) | **NO CUMPLIDO** (fuera de ±5 %) |
| victory: ancho de torso = idle | torso **0,72×**, cintura 0,85× | **NO CUMPLIDO**; «es de la pose» sin reescalar |
| ko: cabeza = idle (no altura total) | head 0,66× (R=14); 0,78× (R=26) | **NO CUMPLIDO**; NOTAS lo reconoce y no cambia nada |
| Alfa: esquinas 0, 1 componente | No re-corrido en esta ronda; heredado de r2 | OK (heredado; arte sin cambios) |
| Tests / build | No re-corridos en esta ronda (sin cambio de arte) | heredado de f3a746f |

## Hallazgos de ejecución
1. **Medida reproducible.** `measure_body.js` (R=14) da los ratios de NOTAS r3 (hit h 1,15 / head 0,96 / torso 0,93; skill head 1,14 / torso 0,81; victory head 0,86 / torso 0,72; ko head 0,66). El método es válido: el problema es de ejecución, no de medida.
2. **Escala por pose no aplicada.** Central pidió escalar por cabeza. Hit ya tiene escala propia (×1,419); skill y victory siguen con ×1,267 común, así que la cabeza de victory queda ~14 % chica y la de skill ~14 % grande. Promediarlas (media 1,00×) no es un ajuste válido para ninguna de las dos.
3. **Conflicto cabeza / torso / altura sin resolver.** En victory, subir la escala para igualar la cabeza (≈×1,16) lleva la altura a ≈1,15× del idle y el torso sigue en ≈0,84×. Con una escala uniforme de la hoja no se igualan cabeza y torso a la vez. NOTAS lo describe, pero la resolución es una decisión de p-kh/central, no una justificación interna «es de la pose».
4. **KO.** Central pidió que la cabeza iguale; NOTAS deja 0,66–0,78× y declara que no cumple «a la letra». Eso no cierra el pedido. Opción mínima: ×1,28 (cabeza 114→146 con R=26), reprocesado desde el crudo, o decisión explícita de p-kh.
5. **Torso de hit.** 0,93× (R=14) / 0,89× (R=26) frente a un pedido de igualar. Subir la escala ~3 % lo acerca a ~0,96× de torso y ~0,99× de cabeza, pero la altura pasa a ≈1,19×: mismo conflicto que en 3.
6. **Higiene.** El vite huérfano pid 20060 sigue escuchando en `[::1]:5174` (verificado con netstat / tasklist). Se reporta en cada ronda y no se ha cerrado.

## Cambios requeridos
1. **Skill y victory — escala por pose.** Reprocesar desde los crudos (`raw/warrior_poses.png`, sin generar) con escala propia por pose para igualar la cabeza, con cifras antes/después de R=14 y R=26 y tabla de h/head/torso/legs/boot. Si cabeza y torso no pueden igualarse a la vez (hallazgo 3), **no** lo justifiques con «es de la pose»: abre `kanban_block(kind="needs_input")` con las opciones (a) priorizar cabeza, (b) priorizar torso, (c) término medio con cifras, y deja el arte como está hasta la respuesta de p-kh/central.
2. **KO.** Reprocesar a cabeza = idle (×1,28, cabeza 114→146) o pedir decisión explícita a p-kh. No dejar 0,66–0,78× como «mínimo por escorzo» sin verificación visual.
3. **Hit.** Torso 0,93×/0,89× frente a pedido de igualar: o se escala, o p-kh acepta la cifra por escrito. No se acepta una tolerancia ±10 % propia.
4. Tras cualquier reproceso: `verify_alpha_b.js` (esquinas 0, 1 componente), regenerar `contact_poses.webp` y `despues.webm`, correr `npx vitest run </dev/null` y `npm run build`, y dejar en NOTAS una sola tabla de cifras (la de r3 con las medidas nuevas).
5. **Higiene.** Frenar a mano el vite pid 20060 en :5174 antes de relanzar cualquier servidor.

No se requiere generación (quedan 2 de 8).

## Notas del revisor
- No pude ver las imágenes; solo geometría y ejecución. El criterio final de skill y victory sigue siendo el ojo de p-kh.
- Ronda 3, lente contrato: comprobado que las rondas 1–2 de este review (cabeza skill/victory, torso, KO reproducible, cifras de hit, higiene) se abordan; el pedido de central (cabeza, torso, KO) no se cumple todavía.
