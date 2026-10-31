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
