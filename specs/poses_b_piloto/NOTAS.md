# poses_b_piloto — notas del piloto (sin spec formal)

Rama `feature/poses_b_piloto` (desde `feature/combate_b` @788807e). Prueba pedida por el owner: más personalidad y
fluidez en el combate B **sin animación cuadro a cuadro**. Decide el owner si se extiende a todo el elenco.

## P1 — Movimiento por código (todo el elenco)
- `client/src/game/combat/motion.js` (NUEVO, puro, sin Phaser): tabla `PROFILES` por clase/enemigo
  (warrior pesado/lento, rogue rápido, mage flotante, ranger estable, paladin solemne; bruto, coloso, boss_heraldo,
  boss_devorador; `DEFAULT_PROFILE` para cualquier otro id, también `__proto__`) + planificadores
  `attackPlan` (anticipación: retroceso+aplastar → embestida+estirar+inclinar hacia el objetivo → aterrizaje con rebote → reposo),
  `impactPlan` (retroceso proporcional al daño/maxHp, tope y crítico acotado, más pesado = menos retroceso),
  `fallPlan` (inclinación + caída), `victoryPlan` (salto corto), `idleParams`/`idleState`/`nextShift`
  (respiración con tempo por clase, flotación del mago, cambio de peso aleatorio desfasado por actor con hash del id).
- `CombatScene.js` (integración): 4 canales por actor (`act`/`hit`/`idle`/`end`) avanzados en `update()` con el reloj de la
  cola (respetan la velocidad ×2/×4 y el salto), compuestos en `stepMotion`. Reemplaza el tween de respiración y los
  yoyo de 40/30 px. Impacto: pose hit + flash blanco 80 ms + chispas + **polvo** (emisor `dustFx`) + retroceso.
  Caída: pose KO (si existe) + inclinación + polvo y luego el mismo fundido de antes. Victoria: `celebrate()` en `end/victory`.
- Presupuesto (F7 Q8): todos los planes caben **dentro** del beat que ya reserva el planner (`attackPlan.total <= dur`,
  verificado para todo el elenco y para beats de 30–420 ms); la victoria es decoración posterior. No se tocó el planner ni los beats.
- Reduced-motion (Q10): `*.steps = []` y `idleParams = null`; `stepMotion` no aplica transformaciones; sin shake ni polvo;
  solo cambian pose y fundidos.
- Tests: `client/src/tests/combatMotion.test.js` (23): perfiles, personalidad, presupuesto, proporcionalidad del daño,
  reduced-motion, reposo desfasado, `sampleSteps`, `poseMap`. Los tests existentes no se tocaron.

## P2 — Poses clave extra (solo warrior + bruto)
- `client/src/game/combat/poseMap.js` (NUEVO): registro `EXTRA_POSES` + cadena de fallback (`hit→idle`, `skill→attack→idle`,
  enemigo `attack→hit→idle`, `ko→(textura actual)`, `victory→idle`) + `extraAssetKeys` (precarga). Si falta una textura,
  la escena usa el siguiente paso y el movimiento de P1 cuenta el resto. **No se modificó `artMap.js`.**
- Una hoja por personaje, con la hoja existente como `--ref` (`art-b/poses_piloto/manifest.json`, `refs/`):
  `warrior_poses` (hit, skill, ko, victory en una fila) y `bruto_poses` (attack, ko). Solo por la web (`gen_art_web.js`), perfil
  Edge verificado libre antes de cada generación. **Generaciones: 2 de 8** (1 por hoja, a la primera).
- La web devuelve 1376×768. Las 4 poses del warrior entran a ~340 px de ancho cada una (alto completo 768 → se reescala a
  ~625 px). No hizo falta partir en 2 hojas; **dudoso**: el warrior queda algo más blando que idle/attack (menos px por pose).
- Procesado con `scripts/process_art_b.js --scale` (no `--height`): misma escala en toda la hoja para que el KO quede más bajo que la
  pose de pie (0.977 héroe ≈ 640 px, 1.03 enemigo ≈ 720 px). Cortes en los valles del perfil de columnas (`process.sh`).
  `scripts/process_art_b.js` ganó `--scale`; `gen_art_web.js` ganó `GEMINI_WEB_EDGE_EXE` (Edge ≥156 no lo encuentra Playwright por canal).
- Alfa: `verify_alpha_b.js` → esquinas alfa 0 y sin tira de piso en las 6 poses.

## Evidencia
- Demo solo-dev: `client/poses-demo.html` + `client/src/dev/posesDemo.js` (`/poses-demo.html` en `vite` dev; **no entra al build de prod**:
  `grep poses-demo dist` vacío). Combate fijo: warrior ×2 + mage + ranger vs 2 brutos, con ataque, habilidad, impacto, KO (héroe,
  mage y brutos) y victoria.
- Videos 412×860 (Playwright `scripts/record_poses_demo.js`, ~13 s, mismo guion):
  `specs/poses_b_piloto/evidencia/piloto/antes.webm` (788807e: worktree temporal ya retirado) y `despues.webm` (P1+P2).
  **No se versionan** (AGENTS §5: nada de `.webm`); quedan en disco junto a la hoja de contacto.
- Hoja de contacto (fondo oscuro, hoja original cruda al lado de las poses procesadas):
  `specs/poses_b_piloto/evidencia/piloto/contact_poses.webp` (versionada).
- Sonda de texturas durante `despues`: warrior usa idle/attack/skill/hit/victory y KO (h4); bruto idle/attack/hit/ko → las 6 poses nuevas se disparan.
- **fps medio** en la demo (Chromium D3D11, calidad `medium`): antes 59, después 58–59 (≥ 50). Reduced-motion: mismo guion, 58 fps.
- Suites cliente completas: 34 archivos / 625 tests en verde. `npm run build` OK.

## Pendiente
- Veredicto de p-kh/owner sobre el arte. Al reanudar: aplicar veredicto, commitear los webp aprobados, suites + build, review.

## r2 — regeneración con refs v2 (veredicto p-kh, t_ccc081fa)
- Causa del rechazo: `make_refs.js` leía `D:/Proyectos/kingdoms-harvest/art-b/raw` (arte **v1**: `anchor_warrior_v1.png`, `bruto_idle.png`), de ahí el caballero gris con farol y el ogro de maza.
- Fix: `art-b/poses_piloto/make_refs.js` lee **solo** los webp v2 commiteados (`heroes/warrior_idle+attack.webp`, `enemies/bruto_idle+hit.webp`, con alfa), los escala a 768 de alto y los monta sobre `#d0d0d0` con sharp (nunca `art-b/raw`). Refs: `refs/warrior_ref.png` 1379×768, `refs/bruto_ref.png` 1370×768.
- Prompts (`manifest.json`) con el diseño v2 literal (landsknecht barbudo, sombrero con plumas, pipa, jubón acuchillado rojo-ocre, peto abollado, hoja ondulada, vela, calavera y rollos lacrados; hombre-cabra con cuernos de carnero, piel gris con pústulas amarillo-verdosas, cadenas, hombrera/brazal oxidados, taparrabos de calaveras, cuchilla de carnicero). En KO: "no blood, no gore". Fondo `#d0d0d0`, sin piso ni sombra.
- **Generaciones: 4 de 8** en total (2 de r1 + 2 de r2, una por hoja). En r2 hubo además 1 intento del warrior que dio *timeout (120 s)* sin imagen (no lo cuento como generación; se repitió y salió a la siguiente). Perfil Edge: ocupado por F7 ~4 min, esperé hasta `0` y lo verifiqué antes de cada llamada.
- Tamaño: ~340 px por pose alcanza (veredicto): hoja única por personaje, sin partir. Cortes ampliados (hit 0–445, skill 375–760, ko 650–1070, victory 1000–1376) porque las poses se entrelazan (espada clavada del KO vs hoja alzada del skill); `process_art_b.js` se queda con el componente mayor y descarta los restos del vecino. `--scale 0.935` (héroe: victory ≈ 640 px como `warrior_idle`) y `0.93` (bruto ≈ 714/674 px de 720).
- Alfa (`verify_alpha_b.js`): 6/6 OK — esquinas alfa 0, borde 100 % transparente, 1 componente; sin tira de piso.
- Evidencia r2: `contact_poses.webp` (v2 idle/attack/hit a la izquierda de las poses nuevas + las 2 hojas crudas) y `despues.webm` regrabado (mismo guion, 13,4 s, **59 fps**, 0 errores de consola/textura). `antes.webm` no cambia (usa solo arte commiteado).
- Dudoso: no pude inspeccionar las imágenes con visión; verifiqué por geometría (bordes/alfa/ASCII). Revisar a ojo que el KO del warrior (cortado entre la espada clavada y el cuerpo) no arrastre fragmentos del vecino y que el diseño v2 se mantenga en las 6 poses.
- Arte **sin commitear** hasta el veredicto de p-kh.

## r2 — veredicto p-kh (t_386bd6e2)
- **APROBADAS (5)**: `warrior_hit`, `warrior_skill`, `warrior_ko`, `warrior_victory`, `bruto_attack` — mismo personaje v2; KO del warrior limpio (sin restos del vecino). Detalle menor: en `warrior_hit` la espada cambia de mano (no se nota en un destello de 80 ms).
- **REGENERAR**: `bruto_ko` — sigue de pie (misma silueta que idle, cuchilla en la mano) y lleva chorros rojo oscuro en boca/cuello (sangre: viola *no blood*).
- Regla para r3 (literal): "bruto KO pose: the same goat-man collapsing, dropped to both knees or slumped forward onto one hand, head hanging low with the ram horns tilted toward the ground, the cleaver fallen from his open hand and lying on the ground beside him, silhouette clearly lower and wider than the standing idle; eyes rolled back, mouth slack with only clear or greenish drool; no blood, no red liquid, no wounds, no gore."
- Video: el warrior se lee por silueta; el bruto KO no se distingue del idle.
- Se commitean las 5 aprobadas + `warrior_poses.png` crudo + `bruto_poses.png` (r2, fuente de `bruto_attack`). `bruto_ko.webp` (r2) NO se commitea; r3 en curso. Generaciones usadas hasta aquí: 4 de 8; tope r3: 2.

## r3 — regeneración de bruto_ko (en espera de veredicto p-kh)
- 5 aprobadas commiteadas en 30443f0. `bruto_ko.webp` (r2, con sangre) reemplazado por r3 y **sin commitear**.
- Manifest: entrada `bruto_ko_r3` (una sola figura, regla literal del veredicto + diseño v2 del bruto). Refs solo v2.
- **Generaciones: 6 de 8** (quedan 2). Intento 1 (ref idle+hit): la web dibujó **dos** brutos → descartado (`raw/bruto_ko_r3_intento1_dos_figuras.png`). Intento 2 (ref solo `bruto_idle` v2, `refs/bruto_idle_ref.png`, prompt "ONCE only"): una figura → `raw/bruto_ko_r3.png`.
- Escala: la web dibuja el KO ocupando todo el cuadro (área opaca 1,55× la del idle ⇒ cuerpo ≈1,24× más grande). Se procesó con `--scale 0.72` (área ≈ 200k px ≈ idle 216k; 744×553 vs idle 620×720, ~77 % de alto y 1,2× de ancho) para que quede más bajo y más ancho que el idle al mismo tamaño de cuerpo. **Dudoso**: criterio por área, no por cabeza; si p-kh lo ve chico/grande se reprocesa sin gastar generación.
- Verificación: esquinas alfa 0 y borde 100 % transparente; 2 componentes (cuerpo 192k + cuchilla caída en el suelo 11,8k, a propósito); sin tira de piso (las últimas filas se afinan 187→0 px); rojizos 0,48 % (idle 1,35 %), repartidos por la hombrera/hatching como el idle, sin manchas en boca/cuello por el mapa de color. **No pude mirar la imagen con visión**: revisión por geometría.
- Evidencia: `contact_poses.webp` (idle | attack | hit | ko r3 + crudo r3; `art-b/poses_piloto/contact.js`) y `despues.webm` regrabado (13,5 s, 58 fps, 0 errores).

## r3 — veredicto p-kh (t_e75d1b5b) y reproceso de escala del warrior
- **APROBADO**: `bruto_ko` r3 (rodillas, apoyado en una mano, cuchilla en el suelo, más bajo y ancho que el idle, babas claras, sin sangre). Commit 050db26. Sin regenerar: **generaciones finales 6 de 8** (quedan 2 de reserva).
- Aceptado por p-kh: cuernos espirales (se lee colapso con la cabeza caída), ojos claros con pupila mínima, boca rosado apagado (0 px rojo saturado), escala 744×553 sin ajuste.
- **Reproceso gratis del warrior** (hit/skill/victory se veían ~25 % más chicos que idle/attack): mismos crudos (`raw/warrior_poses.png`), sin generar. Primera pasada (b734f80): `--scale 0.935 → 1.267` (×1,355) igualando la altura bbox; el reviewer la rechazó (p-kh pidió **cabeza**, no bbox). Corrección en «r3 — ronda 2 de review» (más abajo), que sustituye las cifras de bbox de esta viñeta.
- Alfa: `verify_alpha_b.js` 4/4 OK (esquinas 0, borde 100 % transparente, 1 componente). Evidencia regrabada: `contact_poses.webp` y `despues.webm` (13,5 s, 58 fps, 0 errores). Suites cliente 34 archivos / 625 tests OK; `npm run build` OK.

## Lecciones p-kh para extender al elenco
- Orden: 1) héroes jugables restantes (paladin, rogue, mage…, siempre en pantalla); 2) enemigos comunes por frecuencia de aparición; 3) jefes/élites al final.
- **Ref = solo el idle v2** (nunca v1 ni `art-b/raw`); con idle+hit como ref la web dibujó dos figuras.
- **KO** con «no blood, no red liquid, no gore» explícito y silueta más baja/ancha que el idle (arrodillado / apoyado en una mano), arma caída en el suelo.
- **Normalizar escala por cabeza** al procesar (misma escala por hoja; ajustar con `measure_body.js`), no por bbox.
- Presupuesto: ~1 regeneración cada 6 poses.

## r3 — ronda 2 de review: escala por cabeza (SUSTITUIDA por la ronda 3, más abajo)
- Herramienta nueva: `art-b/poses_piloto/measure_head.js` (máscara alfa abierta con R=26: quita hoja, plumas y cuchillas finas). Cabeza = coronilla del sombrero → línea de hombros (1ª fila con ancho ≥ 0,75 × mediana del torso). Altura = coronilla (R=26) → pies (R=16). Sin visión: es geometría, no segmentación semántica.
- Mediciones (px; idle = referencia: cabeza 146, altura 578, torso 376):

| pose | cabeza→hombros | altura coronilla→pies | torso (mediana 30–55 %) |
|---|---|---|---|
| idle | 146 | 578 | 376 |
| attack (aprobada) | 132 | ≈ 570 | 255 |
| hit (b734f80, ×1,267) | 130 (0,89×) | 579 | 298 (0,79×) |
| **hit (ahora, ×1,419 = +12 %)** | **153 (1,05×)** | ≈ 648 | 333 (0,89×) |
| skill (×1,267) | **no separable** | 599 (1,04×) | 272 (0,72×) |
| victory (×1,267) | **no separable** | 565 (0,98×) | 259 (0,69×) |
| ko (×1,267, arrodillado) | ≈ 150 por perfil de filas (≈ 1,0×); el detector automático no fija el cuello (cabeza gacha) | 429 (a propósito más bajo) | 287 |

- **hit**: era el único con cabeza y torso claramente chicos (0,89× / 0,79×) pese a igualar altura → escala +12 % (`process.sh`: `--scale 1.419`); tras el cambio cabeza 1,05× y torso 0,89×, altura ≈ 648 (el retroceso inclina la figura; más escala la haría más alta que el idle sin ganar cabeza).
- **skill / victory**: la cabeza **no se puede aislar por geometría** (el brazo alzado y la empuñadura se funden con el sombrero en la máscara; el detector cae en 67–68 px, que no es una cabeza). Se mantienen en ×1,267: altura 1,04× / 0,98× del idle (±5 %). El torso 0,72× / 0,69× **es de la pose** (brazo alzado y cuerpo de tres cuartos; attack, ya aprobada, tiene torso 0,68×), no de la escala: igualarlo exigiría ×1,4 y agigantaría la cabeza. **Pendiente de ojo humano** (p-kh) en skill/victory.
- **ko**: cabeza ≈ idle (±3 %, perfil de filas: coronilla→hombros ≈ 148–152 px vs 152) con el mismo ×1,267 de la hoja; la altura total es menor a propósito (428 vs 578). Sin cambio.
- Alfa (`verify_alpha_b.js`): hit/skill/ko/victory OK (esquinas 0, borde 100 % transparente, 1 componente); bruto_ko: esquinas 0, 2 componentes (cuchilla caída a propósito).
- Evidencia regenerada: `contact_poses.webp`, `despues.webm` (13,5 s, 58 fps, 0 errores). Suites cliente 34 archivos / 625 tests OK; `npm run build` OK.
- Higiene: el vite huérfano pid 20060 sigue escuchando en [::1]:5174; el cierre sin forzar falla («solo se puede terminar de forma forzada») y el kill forzado está bloqueado en esta sesión → frenarlo a mano. No se lanzó ningún vite nuevo (la grabación usó ese mismo servidor, que sirve este worktree).

## r3 — ronda 3 de review: método único de medida (sin generar; 6 de 8; arte sin cambios)
Esta sección **sustituye** las cifras de «ronda 2» (648/694/589, «≈150», «no separable»): esas mezclaban radios de máscara y a mano.

- **Herramienta única**: `art-b/poses_piloto/measure_body.js` (`R=14 node measure_body.js warrior_idle.webp <pose>…`, máscara alfa abierta R=14: quita hoja, plumas y cuchillas). Toda cifra de abajo sale de ahí; `measure.js`/`measure_head.js` quedan solo como histórico. Medidas (px, desde la coronilla):
  - `h` = coronilla→suela; `head` = coronilla→hombros (cuello = fila de ancho mínimo entre y=100 y 40 % del alto; hombros = 1ª fila bajo el cuello con ancho ≥ 1,2× el del cuello);
  - `legs` = entrepierna→suela; `boot` = ancho máx. de bota (último 6 %); `torso` = mediana de ancho entre 30–55 % del alto; `waist` = ancho mínimo entre hombros+30 y entrepierna−30.
  - `legs`, `boot` y `h` **no dependen de los brazos ni de la hoja alzada**: sirven de control de escala cuando la cabeza se funde con el brazo (skill/victory).
- Resultados (ratio pose/idle):

| pose | h | head | legs | boot | torso | waist |
|---|---|---|---|---|---|---|
| idle | 607 | 166 | 165 | 95 | 369 | 202 |
| attack (aprobada) | 604 (1,00) | 156 (0,94) | 168 (1,02) | 94 (0,99) | 277 (0,75) | 183 (0,91) |
| hit (×1,419) | 697 (1,15) | 159 (0,96) | 217 (1,32) | 67 (0,71) | 344 (0,93) | 279 (1,38) |
| skill (×1,267) | 610 (1,00) | 189 (1,14) | 164 (0,99) | 89 (0,94) | 298 (0,81) | 168 (0,83) |
| victory (×1,267) | 599 (0,99) | 142 (0,86) | 169 (1,02) | 85 (0,89) | 265 (0,72) | 172 (0,85) |

- **Altura de hit (una sola cifra: 697 px = 1,15×)**; las 648/694/589 anteriores eran la misma pose medida con R, referencia y zona distintas, y se retiran. 1,15× viene del retroceso (piernas abiertas `legs` 1,32×, bota de perfil 0,71×), no de la cabeza (0,96×) ni del torso (0,93×).
- **Cabeza de skill/victory (medida, ya no «no separable»)**: 189 px (1,14×) y 142 px (0,86×). Con R=14 el cuello sí se separa del brazo. Ambas están en la hoja con el mismo ×1,267 y su media es 1,00×; el ±14 % entre ellas es ruido de la línea de hombros (brazo alzado), no de escala: lo confirman `legs` (0,99/1,02), `boot` (0,94/0,89) y `h` (1,00/0,99), que no dependen del brazo. Sin reescalar.
- **Torso de hit/skill/victory**: hit 0,93× (dentro de ±10 %: sin cambio). Skill 0,81× y victory 0,72× son **de la pose**, medido en la propia pose: la cintura (`waist`, sin brazos) da 0,83× / 0,85×, y la proporción cintura/cabeza de victory es 172/142 = 1,21 (idle 202/166 = 1,22): el cuerpo guarda la proporción del idle, solo se ve de tres cuartos con el brazo alzado. Igualar el ancho de torso exigiría ×1,2–1,4 y llevaría `legs`/`h` a 1,2–1,4× (más alto que idle). Se prioriza cabeza/altura; ancho de torso **fuera de tolerancia en skill/victory por la pose, sin reescalar** → ojo de p-kh.
- **KO (reproducible)**: `measure_head.js` (R=26): coronilla→hombros 114 vs 146 = **0,78×** (reproduce lo del reviewer); `measure_body.js`: 110 vs 166 = 0,66×. La cifra «≈150 por perfil de filas» **se retira**: no la produce ningún script. Con la cabeza gacha la «línea de hombros» sube y la distancia coronilla→hombros se acorta por escorzo, así que 0,66–0,78× es un **mínimo**, no una cabeza más chica de verdad. Justificación: el KO sale de la misma hoja y del mismo ×1,267 que skill/victory, cuya cabeza promedia 1,00×. Se deja sin cambio. **No cumple a la letra** «igualar la cabeza»: si p-kh la ve chica, ×1,28 (114→146) se reprocesa gratis, pero llevaría el KO a ≈ 550 px de alto (casi de pie).
- Intentadas y descartadas (no versionadas): correlación de plantilla de la cabeza del idle (NCC 0,31–0,45, sin pico) y segmentación por color de piel (paleta ocre ≈ sepia; ruido).
- Alfa/evidencia: sin cambio de arte → `contact_poses.webp` y `despues.webm` siguen vigentes; vitest y build se repiten antes del commit.
- Higiene: vite huérfano pid 20060 (:5174) sigue vivo; no se puede matar en esta sesión (forzado bloqueado). **Frenarlo a mano.**

## r3 — ronda 4: conflicto cabeza / torso / altura → decisión de p-kh (arte SIN cambios; 6 de 8)
El reviewer (ronda 3) pide: si cabeza y torso no se igualan a la vez con una escala uniforme por pose, **no justificar** sino abrir `needs_input` con opciones y dejar el arte como está. Se comprobó reprocesando desde `raw/warrior_poses.png` (sin generar) tres variantes por pose (`art-b/poses_piloto/opciones.sh`, hoja `evidencia/piloto/opciones_escala.webp` = `opciones_sheet.js`): **A** igualar cabeza (`head`), **B** igualar torso, **C** actual (commiteado; igualar altura `h`). Medido con `R=14 node measure_body.js` (ratio pose/idle):

| pose | opción | `--scale` | h | head | legs | torso | waist |
|---|---|---|---|---|---|---|---|
| hit | A cabeza | 1,478 | 1,20 | 1,00 | 1,37 | 0,97 | 1,41 |
| hit | **C actual** | 1,419 | 1,15 | 0,96 | 1,32 | 0,93 | 1,38 |
| hit | B torso | 1,526 | 1,23 | 1,03 | 1,41 | 1,00 | 1,45 |
| skill | A cabeza | 1,111 | 0,88 | 1,00 | 0,87 | 0,71 | 0,73 |
| skill | **C actual** | 1,267 | 1,00 | 1,14 | 0,99 | 0,81 | 0,83 |
| skill | B torso | 1,564 | 1,24 | 1,42 | 1,22 | 1,00 | 1,02 |
| victory | A cabeza | 1,473 | 1,15 | 1,22 | 1,19 | 0,83 | 0,99 |
| victory | **C actual** | 1,267 | 0,99 | 0,86 | 1,02 | 0,72 | 0,85 |
| victory | B torso | 1,760 | 1,46 | 0,73 | 1,43 | 1,00 | 1,18 |
| ko | A cabeza | 1,620 | 1,05 | 0,81 | 0,75 | 0,99 | 0,82 |
| ko | **C actual** | 1,267 | 0,82 | 0,66 | 0,56 | 0,77 | 0,69 |
| ko | B torso | 1,670 | 1,08 | 0,83 | 0,77 | 1,02 | 0,84 |

Hallazgos que impiden resolverlo solo con una escala por pose:
- **La métrica `head` no es monótona con la escala** en victory/ko/skill (victory: ×1,267 → 142; ×1,473 → 202; ×1,76 → 122), o sea que «coronilla→hombros» depende de dónde cae la línea de hombros con el brazo alzado/cabeza gacha, no del tamaño real de la cabeza. «Igualar la cabeza» con esta métrica en victory lleva a ×1,473 (pose 1,15× más alta que el idle, torso aún 0,83×), y A/B de victory dan figuras 15–46 % más altas que idle/attack.
- **Torso**: igualarlo (B) en skill/victory exige ×1,56/×1,76 → altura 1,24×/1,46× (más grande que el héroe de pie). El torso de skill/victory es de tres cuartos con brazo alzado; attack (aprobada) también está en 0,75×.
- **KO**: igualar cabeza (A, ×1,62) deja el arrodillado en h 1,05× (tan alto como el idle: pierde lectura de «caído»); el ×1,28 que propone el reviewer da h ≈ 0,9×. 
- Hit: A/B cierran cabeza/torso a ≤3 % pero la altura sube a 1,20–1,23× (retroceso con piernas abiertas).

**Pendiente de p-kh** (decisión; sin tocar el arte hasta entonces), por pose elegir A / C / B (o un término medio con la escala entre dos filas de la tabla). Recomendación del implementer: **C** para skill y victory (igualan altura, piernas y bota; cabeza ±14 % es ruido de hombros), **A** para hit (cabeza 1,00×, torso 0,97×, +4 % de escala; altura 1,20×) y **A** para el KO (cabeza/torso ≈ idle) solo si p-kh acepta que se lea casi de pie; si no, C.

## r4 — veredicto p-kh (t_207c5474) aplicado (sin generar; siguen 6 de 8 generaciones, 2 sin usar)
**Decisión de arte de p-kh** (escala por pose, a ojo por ancho de sombrero/hombros; «la regla es que coincidan las partes del cuerpo, no la altura de la silueta»): **hit A ×1,478**, **skill C ×1,267**, **victory C ×1,267**, **ko ×1,45** (ni A ni C: A queda tan alto como el idle de pie; C encoge al personaje ~⅓ en cabeza/sombrero). General: aprobado, la hoja no tiene halos ni fondo. Las cifras de cabeza/torso que no igualan al idle quedan **justificadas por esa decisión**, no se corrigen (la métrica `head` de `measure_body.js` no es fiable en victory/ko/skill: no es monótona con la escala).

Aplicado: `process.sh` (hit 1.478, ko 1.45) y reproceso de **solo hit y ko** desde `raw/warrior_poses.png`; skill y victory no se tocaron (siguen ×1,267, blobs idénticos). Medido con `R=14 node measure_body.js` (ratio pose/idle):

| pose | `--scale` | h | head | legs | boot | torso | waist |
|---|---|---|---|---|---|---|---|
| hit | 1,478 | 1,20 | 1,00 | 1,37 | 0,75 | 0,97 | 1,41 |
| skill | 1,267 | 1,00 | 1,14 | 0,99 | 0,94 | 0,81 | 0,83 |
| victory | 1,267 | 0,99 | 0,86 | 1,02 | 0,89 | 0,72 | 0,85 |
| ko | 1,45 | 0,94 | 0,74 | 0,66 | 1,47 | 0,88 | 0,75 |

ko coincide con lo previsto por p-kh (h 0,94, torso 0,88; head 0,74 = la métrica poco fiable, ~0,9 a ojo). Hit: la altura 1,20 viene de la pose (retroceso con piernas abiertas), cabeza 1,00 y torso 0,97.

Verificación geométrica (sharp; no pude mirar las imágenes con visión): hit 619×760 y ko 502×605, **alfa 0 en las 4 esquinas, 0 píxeles no transparentes en el borde de la imagen**, filas inferiores del recorte vacías (margen de 13–15 px; sin tira de suelo: la fila opaca más baja mide 63–71 px de ancho = pies/espada, no una franja), semitransparentes 4,6 % (borde suave igual que el idle 4,2 %). **Línea de suelo**: última fila con alfa>128 a 13/15/12 px del borde inferior en idle/hit/ko (pie en el mismo sitio dentro de 3 px; cada sprite se ancla por el borde inferior).

Hoja final: `evidencia/piloto/hoja_final.webp` (idle | hit | skill | victory | ko a escala real, misma línea de suelo; `art-b/poses_piloto/final_sheet.js`). `contact_poses.webp` rehecha con el arte final.

Video: `antes.webm`/`despues.webm` **no se regrabaron**: el puerto :5174 lo ocupa el vite huérfano pid 20060 (no se usa otro puerto ni se mata). Los videos de r3 quedan viejos (anteriores a la escala por pose de r4) y **no se commitean** (además `.webm` no va al repo, AGENTS §5); la evidencia vigente es la hoja final + las suites.

Suites: `npx vitest run` cliente 34 archivos / 625 tests OK; `npm run build` OK. No se levantó ningún vite.
