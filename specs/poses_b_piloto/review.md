# Review — poses_b_piloto (piloto r4, ronda 1, lente artefacto)

Rama `feature/poses_b_piloto` @1387241 · revisor `reviewer` · tarea t_330b31b0 (run 144) · continuación de t_6ac7aac7. El review r3 (CHANGES_REQUESTED, lente contrato) queda en el historial de git.

## Veredicto
**APPROVED** (piloto r4)

La escala por pose es decisión de arte de p-kh (t_207c5474) y se aplicó tal cual: hit ×1,478, ko ×1,45, skill y victory ×1,267 sin tocar. No se vuelve a exigir igualar cabeza ni torso (ver «Decisión de arte»).

## Trazabilidad
Criterios = veredicto de p-kh (t_207c5474), citado en el body de la tarea y en NOTAS «r4 — veredicto p-kh».

| Criterio | Evidencia ejecutada | Estado |
|---|---|---|
| hit = A ×1,478 | `art-b/poses_piloto/process.sh` línea `warrior_hit` con `--scale 1.478`; `warrior_hit.webp` cambió (blob `5cf131d4` vs `7c928f0e` en 6ff1e2a) | OK |
| skill = C ×1,267, sin tocar | `--scale 1.267` sin cambio; `warrior_skill.webp` blob idéntico a 6ff1e2a (`14d78a21`) | OK |
| victory = C ×1,267, sin tocar | `--scale 1.267` sin cambio; `warrior_victory.webp` blob idéntico (`b14a2c47`) | OK |
| ko = ×1,45 en línea de suelo | `--scale 1.45`; `warrior_ko.webp` cambió (`b697b844` vs `68fb52af`); última fila con alfa>128 a 12 px del borde (idle 13, hit 15) | OK |
| idle sin cambios | `warrior_idle.webp` blob idéntico (`c5d9edac`) | OK |
| Alfa 0 en esquinas y borde; sin tira de piso | Ejecutado con sharp (script en scratch, no en el repo): hit y ko con las 4 esquinas alfa 0 y 0 píxeles opacos en el borde; semitransparentes 4,7 % (hit) y 4,6 % (ko), idle 4,2 % | OK |
| Cifras en NOTAS «r4 — veredicto» | `R=14 node art-b/poses_piloto/measure_body.js <5 webp>` (con `NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules`): hit h 1,20 / head 1,00 / torso 0,97; skill h 1,00 / head 1,14 / torso 0,81; victory h 0,99 / head 0,86 / torso 0,72; ko h 0,94 / head 0,74 / torso 0,88. Coincide con la tabla de NOTAS | OK |
| Hoja final idle\|hit\|skill\|victory\|ko | `evidencia/piloto/hoja_final.webp` existe (2584×931, webp), generada por `art-b/poses_piloto/final_sheet.js` | OK (estructura verificada; contenido visual no inspeccionado) |
| Tests cliente afectados | `npx vitest run src/tests/combatLayout.test.js src/tests/combatMotion.test.js` (los que referencian `warrior_*`/assets b): 59/59 OK | OK |
| Suite completa y build | Reportados por el implementer (625/625, build OK); no re-corridos en esta ronda | heredado |
| Vite :5174 | Lo ocupa el vite huérfano pid 20060, no levantado por el implementer y no tocado | justificado |
| antes/despues.webm | No regrabados ni commiteados (`.webm` no va al repo, AGENTS §5; el video vigente requiere :5174 libre) | justificado y anotado en NOTAS |

## Hallazgos de artefacto
1. **Diff acotado.** `git diff 6ff1e2a..1387241 --stat`: `process.sh` (2 líneas), `warrior_hit.webp`, `warrior_ko.webp`, `contact_poses.webp`, `hoja_final.webp` (nuevo), `final_sheet.js`, `NOTAS.md`. Ningún otro asset ni código de cliente. Coincide con el handoff.
2. **Comentario obsoleto.** `art-b/poses_piloto/process.sh:7` sigue describiendo el reescalado r3 ×1,355 y no documenta 1,478/1,45. No afecta al arte; no bloquea. Actualizarlo en el próximo commit de arte.
3. **Feature no registrada.** `poses_b_piloto` no figura en `feature_list.json` ni en `CHANGELOG.md`. No hay `status` que cambiar ni línea que añadir al cerrar esta ronda.

## Decisión de arte (no re-exigir)
Veredicto p-kh (t_207c5474): hit A ×1,478 (cabeza y torso ≈ idle; la altura 1,20 viene de la pose); skill C ×1,267 y victory C ×1,267 (altura y botas iguales al idle; cabeza ±14 % es ruido de hombros); ko ×1,45 (altura 0,94, torso 0,88; A quedaría tan alto como el idle de pie y C encogería al personaje de golpe). La métrica `head` de `measure_body.js` no es monótona con la escala en victory/ko/skill, así que la regla es que coincidan las partes del cuerpo a ojo, no la cifra de cabeza. Las cifras que no igualan quedan justificadas por esta decisión y no son defectos.

## Cambios requeridos
Ninguno.

## Notas del revisor
- No pude ver las imágenes; verifiqué geometría, alfa, medidas y ejecución. La coherencia visual de la hoja y de la línea de suelo queda para el ojo de p-kh.
- No edité código del implementador. Único cambio: este review.md.
- Higiene: el vite huérfano pid 20060 sigue en `[::1]:5174`. Lo cierra quien lo levantó, no este revisor.
