# Review — poses_b_piloto (piloto r3, ronda 1, lente artefacto)

Rama `feature/poses_b_piloto` @b734f80 · revisor `reviewer` · tarea t_6ac7aac7

## Veredicto
**CHANGES_REQUESTED**

El `bruto_ko` r3 (050db26) queda aprobado por p-kh y es correcto en geometría. El reproceso gratis del warrior (b734f80) no cumple el criterio del veredicto: se igualó la altura total (bbox), que p-kh descartó explícitamente, y el ancho de torso no coincide con el idle.

## Trazabilidad
No hay `requirements.md` ni `tasks.md` para este piloto; el criterio es el veredicto p-kh recogido en `specs/poses_b_piloto/NOTAS.md` (r2, r3) y el comentario de central en t_6ac7aac7.

| Criterio | Evidencia | Estado |
|---|---|---|
| bruto_ko r3 cumple la regla (rodillas, sin sangre, más bajo y ancho) | Veredicto p-kh (t_e75d1b5b); geometría 744×553 vs idle 620×720; esquinas alfa 0 | OK (no vi la imagen; aceptado por p-kh) |
| warrior hit/skill/ko/victory igualan **altura de cabeza** del idle | No se midió altura de cabeza. NOTAS r3 mide "altura sombrero→pies" (idle 584 · hit 588 · skill 609 · victory 593) | **NO CUMPLIDO** |
| warrior igualan **ancho de torso** del idle | Mediana 30–55 % de altura: idle 378 · hit 313 · skill 303 · victory 265 | **NO CUMPLIDO** |
| KO arrodillado iguala la **cabeza**, no la altura total | Ancho de cabeza (22 % superior) KO 149 vs idle 247; altura de cabeza no medida | **NO VERIFICADO** |
| Escala por cabeza, no por bbox | NOTAS r3 dice "altura sombrero→pies ≈ idle", es bbox | **INCUMPLIDO** |
| Alfa: esquinas 0, sin tira de piso | Esquinas (0,0 / W-1,0 / 0,H-1 / W-1,H-1) = 0 en hit, skill, ko, victory y bruto_ko | OK |
| Sin generaciones nuevas | NOTAS: 6 de 8, reproceso desde `raw/warrior_poses.png` | OK |

## Verificación realizada (ronda 1)
- `node art-b/poses_piloto/measure.js` con `R=16` sobre los webp de la rama: reproduce las cifras de NOTAS (idle h=584 W=444 torso 378; hit h=588 torso 313; skill h=609 torso 303; victory h=593 torso 265; ko h=448 headW 149).
- Esquinas alfa de las 5 piezas reprocesadas: 0.
- No re-ejecuté vitest ni build: el cambio es solo de arte; deberán repetirse tras el reproceso.

## Tasks
Sin tasks formales. Lo que el implementador declara como hecho es: reproceso ×1,355, alfa OK, vitest 625 OK, build OK. Lo primero se cumple en espíritu (misma escala por hoja), no en el criterio pedido.

## Cambios requeridos
1. **Warrior hit, skill, victory (y ko) — `client/public/assets/b/heroes/*.webp`, origen `process.sh` línea del `--scale 1.267`:** reprocesar desde los crudos (`art-b/poses_piloto/raw/warrior_poses.png`, sin generar) con escala por **altura de cabeza**: medir la cabeza real del idle (coronilla/sombrero hasta mentón) y de cada pose, y fijar la escala común para igualarla. No por bbox.
2. **Ancho de torso:** tras el punto 1, medir de nuevo. Si victory (265 vs 378, −30 %) y skill/hit (~−18 %) siguen fuera de tolerancia, o se corrige o se justifica en NOTAS.md por qué esa diferencia es de la pose y no de la escala. Hoy no hay justificación.
3. **KO:** medir la altura de cabeza del KO (no la altura total) contra la del idle y documentar el resultado con números.
4. **NOTAS.md:** sustituir "altura sombrero→pies ≈ idle" por las mediciones de cabeza y torso reales, y quitar cualquier afirmación de "misma cabeza" que no esté medida.
5. Tras el reproceso: regenerar `evidencia/piloto/contact_poses.webp`, regrabar `despues.webm` si el arte cambia, y repetir `npx vitest run` (con `</dev/null`) y `npm run build`.
6. Higiene: el vite huérfano pid 20060 en :5174 sigue vivo según NOTAS. Frenarlo antes de relanzar (no es un fallo de código, pero bloquea la verificación).

No se requiere ninguna generación nueva: quedan 2 de 8 en reserva.
