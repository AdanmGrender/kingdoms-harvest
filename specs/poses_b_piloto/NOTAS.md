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
