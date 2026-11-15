# Revisión visual — Etapa C (y lo heredado de A/B) · ronda 1 · t_7311fcde · commit e678ffd

## Veredicto: CHANGES_REQUESTED

Abrí yo mismo las capturas de `evidencia/despues/` (código vigente: último cambio de `client/src` = 87d1fb8, las capturas son posteriores) y generé cuadros propios (`evidencia/visual/run1/`, script `evidencia/visual/capturar_visual_r1.mjs`, server :3001 + vite :5173 del worktree, ya detenidos).
El combate «funciona», pero como imagen no pasa: **el bruto flota sobre un tejado**, **el botón de habilidad tapa al héroe** (al mago casi lo borra) y **las barras de R54 cortan las cabezas de los enemigos**. Los tres son lo primero que ve un jugador.

Aclaración de alcance: los casos de 3/4 enemigos, 3 héroes y héroe muerto son escenas **sintéticas** (fixtures del script de T11, runId −1) porque a1n3 real solo trae 1 héroe (Guarnición) y 1 enemigo. Lo que se ve de formación/escala/solapes sale del mismo código que el juego real.

## Afirmaciones vs. imagen

Fuentes: `requirements.md` (R#), `design.md` (§8 línea 96-99), `docs/art-direction-b.md` (tabla de estilo líneas 28-40, regla 6, criterios B2), `tasks.md` (Evidencia T10.5/T11/T12), commits 87d1fb8 / 28a74d3.

**Layout, escala y formación (design §8, R24-R27, art-direction «Fondos: piso abierto en la mitad inferior», «escala heroica»)**
- [FALLA] Enemigos «pisan» sobre el piso del fondo (art-direction fila Fondos; design §8 «héroes abajo / enemigos arriba» sobre un piso) → el bruto de a1n3 está parado sobre el tejado de la casa; sus pies caen en y≈590 de 1720 mientras el suelo/barro del fondo empieza en y≈900-1000. Flota ~350-400 px sobre el piso (`evidencia/visual/r05_bruto_barra.png` / `full_v2_r05.webp`, región 150,60,560,540). En veil_gate, los 3-4 Voz del Velo flotan delante del arco y de las paredes, ninguno pisa los escalones/piso (`full_v2_veil_gate_a2n10_4enemigos.webp`, región x 60-480, y 70-610 en escala 540). Causa: `formation.js:18-19` `ENEMY_TOP=100`, `ENEMY_ZONE_BOTTOM=960`, `anchor.y = top + h` ⇒ para 1 enemigo normal el pie queda en 100+499 = 599.
- [FALLA] Héroes y enemigos con escala coherente / «escala heroica» (art-direction línea 30; R24/R27) → bruto ≈ 470 px de alto en el mundo vs. héroe ≈ 180 px visibles (caja 190×250): 2,5-2,6× (3× si se cuenta el cuerno). Con jefe (0,36×1720 = 619) peor. No parecen del mismo plano (`full_v2_r05.webp`: bruto 60-295 vs. héroe 595-690 en escala 412). `formation.js:12-15` (`ENEMY_HEIGHT_FRAC` ×1720 vs. `HERO_BOX`). Nota: 0,29/0,36 son topes de R27 (heredados de F9), así que el arreglo exige decisión del owner (ver T10.6-d).
- [OK] Héroes abajo, enemigos arriba, 1 enemigo centrado, 2-4 escalonados en zigzag con escala decreciente (design §8, R25) → coincide en a1n3 (1) y en veil (3 y 4 escalonados, sin solape entre cajas) (`full_v2_veil_gate_a2n10_*.webp`).
- [OK] 1-3 héroes en fila frontal sin solaparse entre sí (R24) → en veil/muerto los 3 héroes quedan separados ~230 px (`veil3_heroes.png`). Los cuerpos no se pisan; sí los tapa el HUD (ver abajo).
- [OK] `heroId:null` usa arte de `warrior` (R24) → Guarnición se ve como el guerrero con montante (`veil3_heroes.png`).
- [NO VERIFICABLE] Fila trasera (slots 4-5, R24) → ninguna captura con 4-5 héroes. Pendiente del owner de la feature (agregar fixture de 5 héroes al script de T11).
- [OK] Héroes miran a la derecha / enemigos a la izquierda (design línea 96, art-direction «Vista») → el tirador apunta el arcabuz a la derecha, el bruto mira a la izquierda. Es lo escrito, así que la sospecha 5 «apunta a la derecha y no a los enemigos» NO es defecto respecto del spec (ver hallazgo menor M2: con enemigos arriba el apuntado se lee raro).

**HUD (R40, R43, R54, T10.5)**
- [FALLA] R40 «fila de héroes con … toque para habilidad» sin tapar al héroe (criterio visual general: HUD no tapa caras) → el botón ¡TAP! (≈110×110 px de mundo) + barra de energía se dibujan **encima del torso/cara del héroe**. Con 1 héroe (a1n3, 412×860) solo asoma la cabeza y los pies; con 3 héroes el mago del centro queda casi tapado por completo (`veil3_heroes.png`, región 360,80,130,190; `r05_heroe_boton.png`). En 360×740/360×800/412×915 igual (`full_v2_vp_360x800.webp`, `full_v2_vp_412x915.webp`: el héroe es un sombrero detrás de un cuadro). Causa probable: fila DOM del HUD alineada con la caja del héroe (`CombatInstancePanel.jsx` fila de héroes ↔ `FRONT_Y=1180`, `HERO_BOX`). 
- [FALLA] Etiqueta del héroe («Guarnición», «Hé2», «Hé3») legible → texto gris claro sin contorno sobre barro/tela, bajo la barra, casi ilegible en móvil (`veil3_heroes.png`, región 220,255,120,30; `r05_heroe_boton.png`, región 70,215,130,30). Es el mismo defecto de contraste, bloqueante junto con el anterior.
- [FALLA] R54 «Con 4 enemigos el bloque no tapa la fila de héroes ni el botón» → no los tapa (OK, `barrasTapanAvanzar/BotonesHud/HeroesSprites` = false en los 7 cuadros) PERO el bloque de barras se dibuja **sobre las cabezas de los enemigos**: en a1n3 la barra corta los cuernos y la frente del bruto (`r05_bruto_barra.png`, región 160,20,470,80); en veil la fila superior cae sobre la cara de dos Voz del Velo (`veil4_hud_toast.png`, región 100,100,250,130). El propio reporte lo registra: `barrasSolapanZonaEnemigos: true` en 7/7 cuadros de `reporte_v2.json` y nadie lo marcó como falla. Causa: `zonaEnemigos.top = 50` (px del lienzo a 412) vs. `ENEMY_TOP = 100` mundo y el bloque de barras que mide ~110-130 px de mundo; las barras llegan hasta y≈125-150.
- [OK] R54 una barra por enemigo, con nombre («Enemigo N» si no trae), valor, orden de llegada → 1 barra con «Enemigo 1» en a1n3; 4 filas en 2×2 en veil (`veil4_hud_toast.png`).
- [OK] R54 «un enemigo con hp ≤ 0 se ve atenuado y su barra en 0, sin desaparecer» (en la BARRA) → «Segador» queda gris tenue con barra vacía (`veil4_hud_toast.png`, región 30,210,360,50). Legible como «muerto», aunque tan tenue que el nombre casi no se lee sobre el fondo (menor, M4).
- [OK] R54 «Con 1 enemigo el HUD se ve como hoy» → una fila, etiqueta «Enemigo 1», barra roja sin sobresalir (`full_v2_r00_inicio.webp`).
- [OK] R40 título «Merodeadores del Páramo · ronda N/8», cierre `.kh-close` (✕ en marco latón), botón «Avanzar ronda» (marco latón, calavera lacrada) → todo presente y legible en 412×860, 360×740, 360×800 y 412×915 (`full_v2_vp_*.webp`).
- [OK] R40/R41 `ResultBanner` «¡Victoria!» + «Volver», sin emojis (R45) → pergamino con título y botón legibles (`despues/v2_resultado_victoria.webp`, región 0,1100,824,620). Tapa la mitad inferior de Guarnición, aceptable en pantalla de resultado (menor M5).
- [OK] R43 áreas táctiles → `botonesBajo44` vacío en los 3 viewports de `reporte_v2.json` y visualmente los botones son grandes. (No medí fps; fuera de mi tema.)
- [FALLA] Viewport 412×860 y aspecto >2,1 (360×800/360×740) «sin nada tapado ni recortado» (R54, tarea T10.5) → sin recorte por los bordes (el lienzo queda centrado con franjas negras arriba/abajo en 360×800, normal); lo tapado es lo ya descrito: botón sobre el héroe y barras sobre las cabezas. En 360×740 la barra de enemigo y el título quedan pegados (sin aire) pero legibles. Cuenta como una sola falla, no repito (`full_v2_vp_360x800.webp`).

**Animación / efectos (design §6-7, R49/R50)**
- [OK] Números de daño aparecen sobre el enemigo, escalan, suben y se desvanecen (design línea 63) → «60» sobre el bruto en r01/r03/r05/r07 y en cuadros propios; cambia de ronda a ronda, no queda fijo (`run1/real_ataque_f06.webp`, recorte comparativo). Sospecha 3 **parcialmente confirmada**: mide ≈60 px de alto en un lienzo de 824 y cae justo sobre el hocico/cara del bruto durante ~1 s. No tapa de forma permanente; menor (M1).
- [NO VERIFICABLE] Héroe muerto «semitransparente (alpha 0,35 + tinte 0x555555)» (`CombatScene.js:188/268`) → ningún cuadro captura la transición de muerte de un héroe: a1n3 nunca mata héroes y no hay handle global de la escena para forzarlo. En la escena sintética el mago con `alive:false` se dibuja **opaco y sin tinte** (`heroe_muerto_zoom.png`, `muerto_412x860.webp`), o sea que al cargar un estado con héroe ya muerto no se aplica `applyView` (ver hallazgo M3). Por código el fantasma 0,35 está en su propia casilla de la fila de héroes (no «en el medio del campo»), así que la sospecha 4 queda **descartada en lo del medio del campo y pendiente de captura** en lo del alpha. R54 pide el atenuado solo para la barra: el sprite del enemigo muerto va a alpha 0 (desaparece), el del héroe a 0,35: decisión de diseño, no la juzgo.
- [FALLA] Un enemigo muerto no debe quedar dibujado a plena opacidad (coherente con `CombatScene.js:188` enemigo muerto → alpha 0) → en veil 3/4 enemigos, «Segador» (hp 0, barra en 0) sigue visible como sprite completo (`full_v2_veil_gate_a2n10_3enemigos.webp`, sprite inferior izquierdo; `muerto_412x860.webp`, «Acólito» hp 0 a la derecha). Misma causa que M3: el estado inicial no pasa por `applyView`. Impacto real: reabrir/recargar un combate con enemigos ya caídos los muestra vivos.
- [OK] R49 sin errores de consola en combate completo (v1/v2) → `errores: []` en `reporte_v1/v2.json`; yo no vi pantalla de error en mis cuadros.
- [OK] R50 combate a1n3 completo v1 y v2 hasta el `ResultBanner` → secuencia r00…r07 + victoria para ambos motores; v1 y v2 se ven idénticos en el campo (`v1_r03` vs `v2_r03`).
- [NO VERIFICABLE] `prefers-reduced-motion` (R49/R50 según tarea) → ninguna captura/video con el emulador de movimiento reducido ni cuadros de ataque/impacto/muerte de héroe; el reporte no incluye esa corrida. Pendiente para el owner (el script puede usar `reducedMotion: 'reduce'` en `newContext`).
- [OK] Estilo grimdark coherente con el arte aprobado (art-direction tabla) → HUD en latón/pergamino/IM Fell, sprites entintados, sin emojis; el fondo `combat_moor` y `combat_veil_gate` se ven bien como ilustración.

## Hallazgos no escritos (agrupados como futura tarea T10.6 «fix visual»)

**Bloqueantes**

- **B1 · Enemigos flotando sobre tejados/aire** (sospecha 1, CONFIRMADA). Captura: `r05_bruto_barra.png` (pies en y≈590 sobre un tejado) y `full_v2_veil_gate_a2n10_4enemigos.webp`. Causa: `formation.js:18-19` `ENEMY_TOP=100`/`ENEMY_ZONE_BOTTOM=960` y anclaje de pie fijo. Arreglo en una línea: anclar los pies de los enemigos a la línea de suelo de cada fondo (`artMap.js` guarda `groundY` por fondo, p. ej. ≈0,52-0,56 del alto en `combat_moor`) y repartir los enemigos escalonados hacia abajo desde ahí, no desde `ENEMY_TOP`.
- **B2 · El botón de habilidad + barra de energía tapan al héroe** (sospecha 7 parcial; el mago del centro queda invisible). Capturas: `veil3_heroes.png`, `r05_heroe_boton.png`, `full_v2_vp_360x800.webp`. Causa: fila DOM del HUD superpuesta con `HERO_BOX` en `FRONT_Y=1180`. Arreglo: mover el botón y la barra a una tira debajo de los pies (entre `FRONT_Y+HERO_BOX.h` y `HUD_TOP`) o subir los héroes sobre el botón; no superponer la caja de habilidad con el sprite.
- **B3 · Etiqueta de héroe ilegible** (gris sobre barro, sin contorno). Capturas: `veil3_heroes.png` región 220,255,120,30. Arreglo: color hueso + `text-shadow`/contorno de tinta como en los números flotantes, o plaquita de pergamino.
- **B4 · Barras de R54 sobre las cabezas de los enemigos** (sospecha 6, parte «barras que solapan la caja del enemigo», CONFIRMADA y reconocida por el propio reporte). Capturas: `r05_bruto_barra.png`, `veil4_hud_toast.png`. Causa: bloque de barras ≈ y 50-150 vs. `ENEMY_TOP=100`. Arreglo: bajar `ENEMY_TOP` por debajo del bloque de barras (≈ bloque + 20 px; con 4 enemigos ≈ 160-180) o mover las barras sobre/bajo cada sprite en el canvas.
- **B5 · Escala héroes↔enemigos** (sospecha 2, CONFIRMADA: 2,5-3×). Captura: `full_v2_r05.webp`. Arreglo: owner decide — subir `HERO_BOX` a ≈ 320×420 (y `BACK_SCALE`) o bajar `ENEMY_HEIGHT_FRAC` a ≈ 0,22 / 0,28; el spec R27 (0,29/0,36) tendría que enmendarse. Además se recupera sitio para B1.
- **B6 · Enemigo muerto dibujado vivo al abrir el combate con un estado que ya lo trae caído** (véase M3). Captura: `muerto_412x860.webp`, `full_v2_veil_gate_a2n10_3enemigos.webp`. Arreglo: llamar `applyView(view inicial)` al final de `buildActors()` (`CombatScene.js:~146`). Lo dejo bloqueante porque afecta a las capturas de 3/4 enemigos que R54 exige y a cualquier reanudación de run.

**Menores**

- **M1** · Números de daño (84/104 px de fuente en lienzo 824) caen sobre la cara del enemigo: subir el `y` del número (`CombatScene.js:258`, `ty-60` → `ty-h*0.8`) o reducir a ~64 px. No tapa de forma permanente.
- **M2** · Los héroes miran a la derecha aunque los enemigos están arriba (el arcabucero apunta al vacío, `veil3_heroes.png` región 580,110,150,190). Es lo escrito en el spec; en ataque conviene que el sprite se voltee/rote hacia el objetivo (`flipX` o tween de inclinación en `CombatScene.js:~211`).
- **M3** · Estado inicial no pasa por `applyView` (raíz de B6 y del héroe muerto opaco sin tinte).
- **M4** · Nombre de enemigo muerto casi invisible sobre el fondo (`veil4_hud_toast.png`, «Segador»): subir opacidad a ≈0,55 manteniendo la barra en 0.
- **M5** · `ResultBanner` tapa la mitad inferior de los héroes (`v2_resultado_victoria.webp` región 0,1100,824,350): subirlo o hacerlo más bajo.
- **M6** · Toast «Run inexistente» tapa barras/nombres del HUD (oculta «Acólito», `veil3_hud_toast.png` región 280,125,260,80). Aparece solo en la escena sintética (runId −1), pero cualquier error de red de un combate real lo mostraría ahí: moverlo bajo las barras o al borde inferior.
- **M7** · veil_gate: los 3-4 enemigos usan el mismo arte (Voz del Velo, `ENEMY_BY_NODE`) pero las barras dicen «Bruto/Acólito/Segador» (nombres del fixture). Con datos reales los nombres serán los del enemigo; mientras el arte se elija por nodo y no por enemigo, un grupo se verá como clones. Para owner (Q4/Q5).
- **M8** · Los pies de los héroes quedan pegados al botón «Avanzar ronda» (`FRONT_Y + HERO_BOX.h = 1430` vs. `HUD_TOP = 1440`); dejar ≥ 30 px.

## Pendientes para el owner de la feature
- Capturas de: transición de muerte de un héroe, 4-5 héroes (fila trasera), `prefers-reduced-motion`, cuadros de ataque/impacto de enemigos con 3+ enemigos reales. Con lo actual no puedo aprobar R49/R50 «reduced-motion» ni el fantasma 0,35.
- fps de kh_pixel7: fuera de mi alcance, lo decide el owner.

## Capturas usadas
- `specs/combate_b/evidencia/despues/` (convertidas a png): `v2_r00_inicio`, `v2_r03`, `v2_r05`, `v2_r07`, `v1_r03`, `v2_resultado_victoria`, `v2_veil_gate_a2n10_3enemigos`, `v2_veil_gate_a2n10_4enemigos`, `v2_vp_360x740`, `v2_vp_360x800`, `v2_vp_412x915`; `reporte_v2.json`.
- Propias (412×860 @2x, `specs/combate_b/evidencia/visual/`): `run1/muerto_412x860.webp`, `run1/real_ataque_f06.webp`, `run1/real_fin.webp`; recortes citados: `veil3_heroes.png`, `veil3_hud_toast.png`, `veil4_hud_toast.png`, `r05_heroe_boton.png`, `r05_bruto_barra.png`, `heroe_muerto_zoom.png`; reducciones `full_v2_*.webp`; script `capturar_visual_r1.mjs`.

# Revisión visual — Etapa C · T10.6 (hoja visual V1–V9) · ronda 2 · commit 810a48a

## Veredicto: CHANGES_REQUESTED

Vara única: `hoja_visual.md` (V1–V9, V4 según la enmienda Last Asylum, decisiones del owner del 2026-11-07 y del 2026-11-08). El código de la app no cambió desde a2458b1 (`git diff a2458b1..HEAD -- client` vacío), así que las 18 vistas de `evidencia/hoja/` son vigentes: las abrí todas, más la hoja de contacto. Lo que faltaba lo generé con el mismo andamiaje (estado sintético runId −1, `stepInstance` sustituido, auto-avance en pausa) en `evidencia/visual/ronda2/`, con `capturar_ronda2.mjs`. Usé el preview aislado: server del worktree en :3003 (`BOT_TOKEN` ficticio, `BOT_POLLING=false`, su `kingdoms.db`, `WEBAPP_URL=http://localhost:5175`) y vite en :5175 `--strictPort` (`VITE_API_URL=http://localhost:3003`); los dos quedaron detenidos y los puertos libres. La animación salió del screencast de CDP (no hay ffmpeg que decodifique webm): 744 cuadros a ~60 fps con su hora, más un muestreo por `requestAnimationFrame` de cada actor y de cada texto flotante (`medidas_anim.json`).

**Bloqueantes** (FALLA de la hoja; detalle y regiones abajo):
- **B1 · V3, cartel de victoria** (sospecha 1, CONFIRMADA). El cartel tapa las caras de Viktor y Sombra (vivos) y al enemigo caído entero. Pasa en las 3 resoluciones y en las 4 formaciones. Arreglo mínimo sin romper V8, solo en victoria: cartel compacto (≤ 70 px CSS, «¡Victoria!» y «Volver» en una fila) con el centro al 34 % del alto, en el borde superior del tercio medio. Medido contra las siluetas reales, no toca ninguna en 4 formaciones × 3 viewports. Atenuar la escena sola no alcanza: el cartel seguiría cortando las cabezas.
- **B2 · V3, cartel de derrota** (mismo defecto). Tapa a los enemigos vivos: al bruto de la cadera para abajo, las 4 caras de las Voz del Velo, y la boca y el cuerpo del Devorador. Contra el jefe, V3 y V8 no se pueden cumplir a la vez: no hay ninguna franja libre en el tercio medio. **Decide el owner** (propuesta en V3).
- **B3 · V3, tendidos de derrota** (sospecha 2, CONFIRMADA). Los tres delanteros caídos se solapan 36 px, el 12 % del ancho (tope: 10 %), y la cabeza de Aria queda sobre la de Lyra. Arreglo: tendido más corto (largo ×0,9) y todos hacia el mismo lado.
- **B4 · V2, 3 enemigos** (sospecha 3, CONFIRMADA). El carroñero de atrás a la derecha apoya el pie derecho en la repisa del altar, entre las velas (una pared), no en la calle.
- **B5 · V7, el tirador no apunta al enemigo** (sospecha 6, parcial). Elena se gira bien hacia el bruto, pero dispara casi horizontal (tope de 15°) y el fogonazo cae sobre Sombra, de la fila trasera.

**Fuera de la hoja, pero grave**: no cuenta para el veredicto. Recomiendo arreglarlo en la misma vuelta, porque es una línea. Cada vez que un enemigo golpea a un héroe, el héroe desaparece unos 360 ms. En su lugar se ve el marcador de R31: primero una lápida blanca de cuerpo entero y después un bloque gris de unos 19×35 px CSS a sus pies. Se ve en cada ronda de cualquier combate real (ver «Hallazgos no escritos» n.º 1).

Sospechas del leader:
1. CONFIRMADA → B1.
2. CONFIRMADA → B3.
3. CONFIRMADA → B4.
4. DESCARTADA: el Devorador pisa la nave delante del estrado y no tapa caras.
5. OK: moor, ashfield y veil_marsh pisan su piso.
6. V4 OK, V6 OK, giro de V7 OK; el tirador FALLA (B5), más el hallazgo grave.
7. Informativa: confirma H2 en px, va al backlog.

## Afirmaciones vs. imagen

Regiones en px de la imagen citada. Las de 412×860 @2 (824×1720) coinciden con el mundo; las de 360×800 @3 son 1080×2400 (mundo ×1,311, +72 en y) y las de 1280×800 @1,5 son 1920×1200 (mundo ×0,698, +672 en x). Los cuadros del screencast están en px CSS a 412×860.

**V1 Escala**
- [OK] Héroe delantero = 0,60–0,70 × común solo (V1) → héroe de 300 de alto visible contra un bruto de 487: 0,62. Se ven en el mismo plano (`hoja/412x860_1enemigo.webp` región 0,440,824,890).
- [OK] Jefe = 1,8–2,2 × héroe → Devorador 600 / 300 = 2,0 (`hoja/412x860_jefe.webp` región 120,470,590,850).
- [OK] Con 3–4 enemigos, ningún común baja de 0,9 × héroe → carroñero 294 y Voz del Velo 292 contra 300: 0,97–0,98 (`hoja/412x860_3enemigos.webp` región 0,530,824,410; `hoja/412x860_4enemigos_veil.webp` región 0,700,824,420).
- [OK] Fila trasera = 0,80–0,85 de la delantera → 246 / 300 = 0,82 (`hoja/412x860_1enemigo.webp` región 180,930,470,260).

**V2 Suelo (enmendada: carriles por profundidad sobre el piso de cada fondo)**
- [OK] El bruto de 1 enemigo pisa la calle con el pie en su carril 933 (`hoja/412x860_1enemigo.webp` región 200,860,430,90). Los héroes pisan la calle en 1181 y 1320, en todos los fondos.
- [FALLA] (B4) «Nunca sobre techos, cielo ni paredes» con 3 comunes (crypt, a1n7):
  - Qué se ve: el carroñero de atrás a la derecha (e1, carril EB 833) apoya el pie derecho en la repisa del altar, entre las velas (x ≈ 740–773, y ≈ 827). En esa columna la calle recién empieza en y ≈ 985, así que el pie queda unos 150 px por encima. El pie izquierdo cae en el escalón de la puerta.
  - Pasa en las 3 resoluciones (mismo mundo). Con los héroes ocultos se lee «parado sobre el altar».
  - Capturas: recorte `ronda2/s3_carronero_derecho_altar.webp`, de `hoja/412x860_3enemigos.webp` región 480,520,344,480. Sin héroes: `ronda2/tres_a1n7_sinheroes.webp`, misma región. Solo el fondo: `ronda2/s3_fondo_crypt_altar.webp`.
  - Causa: `formation.js:156-157` pone la fila EB en los bordes (`xB: [atLeft(w), atRight(w)]`), fuera de la franja que se calibró. `calibracion_suelo.json` lo dice: «altar (x > 75 %) fuera de la franja».
  - Arreglo: que los pies de cada fila caigan dentro de la franja calibrada (x 20–80 %), o calibrar el piso por columnas donde hay obstáculos (en crypt, el altar con x > 75 % hasta y ≈ 985).
  - Con 4 carroñeros no pasa: la fila EF de los bordes baja a 1021, delante de la base del altar (`ronda2/cuatro_a1n7_sinheroes.webp` región 0,500,824,560). Con 2 sí roza: el pie derecho queda contra la cara del altar, unos 40 px por encima de su base (`ronda2/dos_a1n7_sinheroes.webp` región 450,850,374,200). No es vista obligatoria.
- [OK] El carroñero de atrás a la izquierda y el del centro pisan la calle (`ronda2/s3_carronero_izquierdo_calle.webp`, de `hoja/412x860_3enemigos.webp` región 0,520,344,480).
- [OK] Las 4 Voz del Velo pisan el piso al pie de la escalera del portal (EB 1006) y delante de ella (EF 1109) (`ronda2/cuatro_a2n10_sinheroes.webp` región 0,700,824,420).
- [OK] (sospecha 4) El Devorador pisa la nave, no el estrado:
  - Las puntas de los tentáculos tocan las losas en 1073, unos 11 px por delante del borde del estrado (≈ 1062).
  - La cola enroscada pasa por delante del estrado, como en cualquier 2,5D, sin apoyarse en él.
  - En la vista obligatoria los pies quedan detrás de la escuadra, así que se lee «detrás de los héroes, delante del altar».
  - Capturas: `ronda2/s4_jefe_pies_sinheroes.webp`, de `ronda2/jefe_a1n9_sinheroes.webp` región 100,860,660,300.
- [OK] (sospecha 5, H9) Moor (a1n4, aullador), ashfield (a2n7, Sin Rostro) y veil_marsh (a2n4, bruto) con 1, 3 y 4 enemigos: todos pisan su piso.
  - Los aulladores, delante del carro y del túmulo, con un pie al borde del charco de brea.
  - Los Sin Rostro, en la llanura de ceniza.
  - Los brutos, en el barro de la orilla; con 4, los de atrás quedan justo en el borde del agua, 8 px bajo la línea calibrada.
  - Capturas: `ronda2/fondo_{a1n4,a2n7,a2n4}_{1en,3en,4en}.webp` y `…_sinheroes.webp`, región 0,560,824,560.

**V3 Solapes**
- [OK] Personajes de pie: dentro de una fila el solape es 0 en las 18 vistas y en las 24 nuevas de pie (`hoja/412x860_1enemigo.webp` región 0,930,824,390).
- [OK] Durante el combate, barras, título y botones no tapan sprites:
  - Las cabezas de los enemigos (≥ 446) quedan bajo las barras (≤ 276). Captura: `hoja/412x860_4enemigos_veil.webp` región 0,130,824,600.
  - Los pies delanteros (1320) quedan sobre los botones con «¡TAP!»: 1372 a 412×860, 1328 a 360×800 (3,5 px CSS de aire) y 1346 a 1280×800. Captura: `hoja/360x800_3enemigos.webp` región 0,1700,1080,200.
- [OK] Caras tapadas por personajes de otra fila (decisión del 2026-11-08): no hay ninguna, y no veo ningún caso bloqueante.
  - Con el jefe, el yelmo de Viktor y la capucha de Sombra se leen sobre la cola oscura (`ronda2/s4_jefe_caras.webp`, de `hoja/412x860_jefe.webp` región 150,880,560,260).
  - Las caras traseras asoman entre las delanteras (`hoja/412x860_1enemigo.webp` región 180,930,470,120).
- [FALLA] (B1) «HUD, botones y barras no tapan ningún sprite (cabeza incluida)», aplicado al cartel de victoria:
  - El cartel es HUD. `requirements.md:5` define HUD como lo que dibuja `CombatInstancePanel.jsx`, y R40 cuenta el `ResultBanner` entre sus elementos.
  - Qué se ve: el cartel (mundo 724–996 a 412) tapa la cara de Viktor (934–1021), la de Sombra (935–1022) y al bruto caído entero (689–933). Los dos héroes se ven decapitados bajo el borde.
  - Pasa en las 3 resoluciones (`ronda2/s1_victoria_412x860.webp`, `…_360x800.webp`, `…_1280x800.webp`, recortes anotados de `hoja/*_victoria.webp`) y con 3 carroñeros, 4 Voz del Velo y el jefe (`ronda2/victoria_{a1n7_3en,a2n10_4en,a1n9_jefe}.webp` región 0,600,824,520).
  - Causa: `CombatInstancePanel.jsx:217-218` centra el cartel al 50 % del alto, justo sobre los carriles.
  - Arreglo, solo en victoria: cartel ≤ 70 px CSS con el centro al 34 % del alto (V8 pide el centro entre 33,3 y 66,7 %).
  - Cuentas: los caídos más altos son los carroñeros EB (desde 679). Con 70 px, los centros que no tocan ninguna silueta van de 33,3 % a 34,8–35,8 % según formación y viewport. Con el cartel actual (135,5 px) no hay ninguno con 1 bruto ni con 3 carroñeros.
  - No aplicarlo a derrota: ahí taparía la cara del bruto.
- [FALLA] (B2) La misma regla, aplicada al cartel de derrota:
  - El bruto queda tapado de 729 a 933, de la cadera para abajo (`hoja/412x860_derrota.webp` región 200,700,420,300).
  - Las 4 Voz del Velo quedan tapadas por completo, cara incluida; solo asoman los bajos de las túnicas (`ronda2/derrota_a2n10_4en.webp` región 0,700,824,420).
  - Del Devorador se tapan la mandíbula y el cuerpo (`ronda2/derrota_a1n9_jefe.webp` región 120,470,580,610).
  - Cuentas: contra el jefe no hay ningún centro en el tercio medio que no toque una silueta, sea cual sea el alto del cartel (siluetas en 476–1073, 1085–1181 y 1207–1320). Con 1 bruto solo entra un cartel de ≤ 60 px al 58 %; con 4 Voz del Velo, uno al 33–37 %.
  - **Decide el owner**. Propuesta: en derrota el cartel puede tapar a los enemigos vivos (escena bajo el velo de derrota, R41), sin cortar caras cuando haya sitio; o bien enmendar V3 para el cartel de resultado.
- [FALLA] (B3) «Dentro de una fila, cajas de héroes con solape ≤ 10 % del ancho», aplicado a los héroes tendidos de derrota:
  - Qué se ve: cada cuerpo mide 296 de largo. El ajuste para no salirse del lienzo corre a Aria a 152 y a Elena a 672, así que las cajas se pisan 36 px (12,2 %).
  - Píxel a píxel: Aria y Lyra comparten 797 px, todos de cabeza contra cabeza (12 % de cada cabeza). Elena pone el 16 % de su cabeza sobre las botas de Lyra.
  - La fila se lee como una sola mancha oscura bajo el velo rojo. La fila trasera no se pisa.
  - Captura: `ronda2/s2_derrota_tendidos.webp`, de `hoja/412x860_derrota.webp` región 0,1060,824,290; igual en 360×800 y 1280×800.
  - Causa: `CombatScene.js:251-258` (`dir` hace caer a h1 hacia la derecha y a h2/h3 hacia la izquierda; el ajuste en `:257`).
  - Arreglo: largo tendido ×0,9 (267; tres caben en 824 con 7 px de hueco) y todos hacia el mismo lado.

**V4 Números de daño (enmienda Last Asylum)**, verificado en cuadros (`ronda2/s6_v4_numeros_secuencia.webp`, de los cuadros de 412 CSS, región 100,150,260,150; datos en `ronda2/medidas_anim.json`, rondaA):
- [OK] Arrancan sobre la cabeza, nunca sobre la cara: la base queda 12 px sobre la silueta. Bruto en 439 con los cuernos en 451; héroe delantero en 1012 contra 1024; trasero en 925 contra 937.
- [OK] Tamaño 40 de mundo el normal y 60 el crítico, dentro de 36–44 y 56–64. A 412 de ancho son 20 y 30 px CSS.
  - ¿Se leen en el celular? Sí: el trazo oscuro da contraste. Pero el normal queda chico para la escena, con dígitos de unos 13 px CSS de alto sobre un bruto de 245. El crítico sí pega.
  - Si el owner pensaba en px de pantalla, el tamaño sería el doble (ver backlog).
- [OK] Pop 1,4 → 1: escala 1,4 al aparecer (+12 ms) y 1 a +140 ms (el tween de 120 ms más un cuadro).
- [OK] Suben 60 px y desaparecen a los 800 ms; el desvanecido empieza a ~510 ms.
- [OK] Se apilan con 28 px entre simultáneos: 37 y 52; «¡Crítico!» y 96!. Pero los textos se pisan (ver hallazgo n.º 2).

**V5 Textos**
- [OK] Ningún nombre lleva «…» en las 3 resoluciones. Botones a 11 px: Aria, Lyra, Elena, Viktor, Sombra. Barras: Bruto, Carroñero, Voz del Velo, Devorador, Aullador, Sin Rostro. Todo legible (`hoja/360x800_3enemigos.webp` región 0,230,1080,240 y 0,1960,1080,200; `hoja/360x800_4enemigos_veil.webp`, mismas regiones).

**V6 Muerte**, verificada en cuadros:
- [OK] La caída dura ≤ 600 ms: bruto de +422 a +888 ms (466 ms); héroes 466–485 ms.
  - Gira sobre el pie y baja hasta quedar tendido sobre su carril.
  - La última caída de la ronda se recorta un poco (383 ms) porque el cierre de la ronda la termina con `layDown`.
  - Capturas: `ronda2/s6_v6_caida_bruto_secuencia.webp` (cuadros de 412 CSS, región 60,60,352,460) y `ronda2/s6_heroes_golpe_placeholder_y_caida.webp` (filas 2 y 3).
- [OK] Queda tendido a α 0,85, desaturado (matriz de color más tinte), y no hay fantasmas de pie. El tendido es muy oscuro: ver hallazgo n.º 4.
- [OK] La barra del muerto se atenúa: la del enemigo a 0,45, vacía; las de los héroes, apagadas y con calavera (`ronda2/s6_v6_barra_bruto_secuencia.webp`; `hoja/412x860_derrota.webp` región 100,1380,620,190). Matiz de ritmo en el hallazgo n.º 3.

**V7 Orientación**, verificada en cuadros:
- [OK] Al atacar, cada atacante se gira hacia su objetivo y vuelve:
  - Elena voltea hacia el bruto y vuelve a idle sin voltear a +439 ms.
  - Aria no voltea, porque el objetivo está a su derecha.
  - El bruto voltea a la derecha para golpear a Elena y no voltea para golpear a Aria, a su izquierda; después vuelve.
  - Capturas: `ronda2/s6_v7_bruto_gira_secuencia.webp` y `ronda2/s6_v7_tirador_secuencia.webp` (cuadros de 412 CSS, región 0,100,412,600 y 120,140,292,560).
- [FALLA] (B5) «El tirador apunta al enemigo»:
  - Qué se ve: Elena se arrodilla y dispara con el arcabuz casi horizontal, inclinado 15°, el tope. Durante todo el disparo, de +32 a +440 ms, el fogonazo y el humo caen sobre Sombra, el pícaro de la fila trasera. El bruto está a unos 55° por encima, así que se lee como que Elena le dispara a su compañero.
  - Capturas: `ronda2/s6_v7_tirador_dispara_a_sombra_45ms.webp` (cuadro de 412 CSS, región 150,160,262,500); `ronda2/s6_v7_tirador_secuencia.webp`.
  - Causa: `CombatScene.js:33` y `:305-312`. Con el objetivo arriba, 15° no alcanzan y el tiro atraviesa la fila trasera; pasa igual con 3 o 4 enemigos y con el jefe.
  - Arreglo: dibujar el tiro, con una estela o un proyectil de la boca del arma al pecho del objetivo, y/o subir el tope a unos 30°. Así el disparo llega al enemigo y no a Sombra.

**V8 Resultado**
- [OK] El cartel ocupa ≤ 40 % del alto (15,8–17 %) y su centro cae al 50 %, en el tercio medio. No tapa «Volver», que va dentro, ni la barra de título con el cierre (`hoja/412x860_victoria.webp` región 52,724,720,272; `hoja/hoja_medidas.json`). En esa posición, sin embargo, tapa sprites: ver B1 y B2.

**V9 Nombres de barras**
- [OK] veil_gate con 4 Voz del Velo tiene 4 barras «Voz del Velo» (`hoja/412x860_4enemigos_veil.webp` región 30,140,770,140; `hoja/360x800_4enemigos_veil.webp` región 0,230,1080,240).

## Hallazgos no escritos

Fuera de la hoja: NO bloquean el veredicto. Van ordenados por gravedad.

1. **GRAVE · el héroe golpeado se vuelve el marcador de R31.**
   - Qué se ve: en cada golpe de un enemigo, el héroe se cambia por la «silueta generada». En el primer cuadro es una lápida blanca de cuerpo entero (destello `setTintFill`). Después, durante unos 360 ms, queda un bloque gris de unos 38×69 px de mundo (19×35 px CSS) a sus pies, y el número de daño flota sobre la nada.
   - Pasa en cada ronda de cualquier combate real, porque el bruto golpea héroes siempre.
   - Capturas: `ronda2/s6_placeholder_elena_593ms.webp` (cuadro de +593 ms, región 230,380,182,330); `ronda2/s6_heroes_golpe_placeholder_y_caida.webp`, fila 1 (Aria a +32/+98 ms, Lyra a +245/+298 ms); `ronda2/medidas_anim.json`, donde la textura es `ph:hero:<clase>:hit`.
   - Causa:
     - `CombatScene.js:389` pone la pose `hit` a cualquier objetivo, y los héroes no tienen esa pose (`artMap.js` `HERO_ART`: idle y attack). `:225` solo traduce attack → hit para los enemigos.
     - Entonces `:73-76` cae al marcador. Luego la respiración (`:168`, tween de escala fija sobre `sp`) lo achica a ×0,48.
     - Ya pasaba antes de T10.6: 91b2090 hacía lo mismo (`pose(target, 'hit')` con la misma respiración).
   - Arreglo, una línea en `setPose`: para un héroe, `hit` → `idle`; el destello y el retroceso ya marcan el golpe.
2. **Media · los números apilados se pisan.**
   - Qué se ve: 28 px de separación (lo que fija V4) es menos que el alto del texto (51 px el normal, 77 el crítico). «96!» cae encima de «¡Crítico!» y durante unos 150 ms se lee «¡C96!o!»; 52 pisa a 37.
   - Captura: `ronda2/s6_v4_numeros_secuencia.webp`, cuadros +1543 a +1693.
   - Arreglo, a decidir por el owner porque es un número de la hoja: separación ≥ alto del texto, o apilado en diagonal.
3. **Info · la barra del HUD se atenúa antes de la caída.**
   - Qué se ve: la barra del enemigo se vacía y se atenúa con el golpe mortal (+59 ms), unos 360 ms antes de que el cuerpo empiece a caer y ~830 ms antes de que quede tendido. Es un matiz de ritmo; V6 se cumple.
   - Causa: el panel pinta `activeRun.state` apenas responde el paso, y la escena todavía no reprodujo el golpe.
   - Captura: `ronda2/s6_v6_barra_bruto_secuencia.webp`.
4. **Baja · los caídos quedan casi negros.**
   - Qué se ve: el tinte 0x9a9a9a más la saturación −0,85 los vuelve casi negros. Bajo el velo rojo de derrota, la fila delantera se lee como una mancha y no como tres héroes (lo agrava B3).
   - Captura: `ronda2/s2_derrota_tendidos.webp`.
5. **Baja · las 4 Voz del Velo son clones.** Es el mismo arte por nodo; ya estaba en M7 de la ronda 1.
6. **Info · errores 429 de mis capturas.** En la consola de `medidas_fondos.json` hay 88 errores 429 del hub (gems, event, streak), por el límite de 100 peticiones por minuto del server local con la sesión de captura. No son del combate. El resto de las corridas terminó con 0 errores.

## Fuera de la hoja (backlog, no bloqueante)

- **Sospecha 7 / H2: pantallas más bajas que las vistas obligatorias** (5 héroes y 3 enemigos, a1n7; `ronda2/medidas_bajos.json`):
  - 360×740: lienzo de 354,5×740 (k 0,430). Los pies delanteros están en 567,9 px CSS y el borde de «¡TAP!» en 566,3, así que lo pisa 1,6 px CSS (unos 4 de mundo). Los íconos empiezan unos 6 px más abajo. Se ve «¡TAP!» rozando las botas de Aria y Elena (`ronda2/s7_bajo_360x740_pies_botones.webp`, de `ronda2/bajo_360x740_3en.webp` región 0,1500,1080,360).
  - 375×667: lienzo de 319,5×667 (k 0,388). Los pies están en 511,9. «¡TAP!» empieza en 493,3, o sea 18,6 px CSS por encima de los pies, y los íconos (desde ≈ 501,3) tapan unos 10,6 px CSS de las botas de los tres delanteros (`ronda2/s7_bajo_375x667_pies_botones.webp`, de `ronda2/bajo_375x667_3en.webp` región 0,900,750,300).
  - Coincide con lo que estimó H2. Decide el owner: sumar una vista baja a la hoja o derivar el carril HF del borde real de los botones en tiempo de ejecución.
- **Tamaño de los números (V4):** dentro de la hoja están bien (unidad = mundo). Si el owner quiere el peso de Last Asylum, que confirme si 36–44 / 56–64 eran px de pantalla; en ese caso serían el doble de mundo.
- **Lo demás:** los hallazgos n.º 1 (grave, recomiendo arreglarlo en la misma vuelta que B1–B5), 2, 3 y 4 de arriba, y el carroñero que roza el altar con 2 enemigos (ver V2).

## Capturas usadas

- `specs/combate_b/evidencia/hoja/`: las 18 vistas `{412x860,360x800,1280x800}_{1enemigo,3enemigos,4enemigos_veil,jefe,victoria,derrota}.webp`, `hoja_contacto.webp`, `hoja_medidas.json`, `calibracion_suelo.json` y `suelo/suelo_{crypt,cathedral,moor,ashfield,veil_marsh}.webp` (más sus `suelo_regla_*`).
- `specs/combate_b/evidencia/visual/ronda2/`, generadas en esta ronda con `capturar_ronda2.mjs` (modos `fondos`, `ocultos`, `extra`, `resultado`, `anim` y `bajos`) a 412×860 @2, salvo las bajas:
  - fondos: `fondo_{a1n4,a2n7,a2n4}_{1en,3en,4en}.webp` y `…_sinheroes.webp`;
  - sin héroes: `jefe_a1n9.webp`, `jefe_a1n9_sinheroes.webp`, `tres_a1n7_sinheroes.webp`, `cuatro_a2n10_sinheroes.webp`, `dos_a1n7_sinheroes.webp`, `cuatro_a1n7.webp`, `cuatro_a1n7_sinheroes.webp`;
  - resultados: `victoria_{a1n7_3en,a2n10_4en,a1n9_jefe}.webp`, `derrota_{a1n9_jefe,a2n10_4en}.webp`;
  - animación: `anim_rondaB_final.webp`, `anim_rondaC_final.webp`;
  - pantallas bajas: `bajo_{360x740,375x667}_3en.webp`;
  - medidas: `medidas_{fondos,ocultos,extra,resultado,anim,bajos}.json`.
- Recortes citados (`ronda2/`):
  - sospechas 1 a 4: `s1_victoria_{412x860,360x800,1280x800}.webp`, `s2_derrota_tendidos.webp`, `s3_carronero_derecho_altar.webp`, `s3_carronero_izquierdo_calle.webp`, `s3_fondo_crypt_altar.webp`, `s4_jefe_pies_sinheroes.webp`, `s4_jefe_caras.webp`;
  - animación: `s6_v4_numeros_secuencia.webp`, `s6_v6_caida_bruto_secuencia.webp`, `s6_v6_barra_bruto_secuencia.webp`, `s6_v7_bruto_gira_secuencia.webp`, `s6_v7_tirador_secuencia.webp`, `s6_v7_tirador_dispara_a_sombra_45ms.webp`, `s6_heroes_golpe_placeholder_y_caida.webp`, `s6_placeholder_elena_593ms.webp`;
  - pantallas bajas: `s7_bajo_360x740_pies_botones.webp`, `s7_bajo_375x667_pies_botones.webp`.
- Los cuadros crudos del screencast (rondas A, B y C, 744 jpg) quedaron fuera del repo. Los citados están dentro de las secuencias `s6_*`.

# Revisión visual — Etapa C · T10.7 y T10.8 (hoja visual con las decisiones del 2026-11-09) · ronda 3 · commit ecdcc99

## Veredicto: APPROVED

Vara única: `hoja_visual.md` con todas sus decisiones, incluidas las dos del 2026-11-09 (la de la ronda 2 y la H-c). Lo que no está en la hoja va a backlog y no bloquea.

Qué miré:
- Abrí yo mismo las 63 vistas de `evidencia/hoja/`, la hoja de contacto y las tres secuencias. Recorté y amplié donde hizo falta.
- Lo que la evidencia no traía lo generé en `evidencia/visual/ronda3/` con `capturar_ronda3.mjs`: crypt con 2 y 4 carroñeros, el disparo cuadro a cuadro a @2, las ráfagas de números en las 5 pantallas, el golpe a los 5 héroes, la caída y el giro.
- Usé el preview aislado: server del worktree en :3003 (`BOT_TOKEN` ficticio, `BOT_POLLING=false`, su `kingdoms.db`) y vite en :5175 `--strictPort` (`VITE_API_URL`). Al terminar los detuve y comprobé los puertos libres.
- Ninguna de mis corridas dio errores de consola ni de página.

Los cinco bloqueantes de la ronda 2 están cerrados (B2 por decisión del owner). El bug del marcador de R31 también. No encuentro ninguna FALLA contra la hoja.

En el backlog dejo tres cosas nuevas, ninguna en la letra de la hoja:
- en pantallas bajas, los números de daño terminan su subida detrás de la barra de vida;
- el cañón del tirador apunta unos 30° por debajo de su propio tiro;
- la silueta del tirador asoma fuera del lienzo durante el disparo.

Los 10 puntos del leader:
1. **B1: OK.** Las 20 victorias (4 formaciones × 5 pantallas): el cartel no toca ninguna silueta.
2. **B2: OK.** No tapa héroes tendidos ni botones y no corta caras; tapa enemigos vivos en 15 de 20, lo que la decisión permite.
3. **B3: OK.** 0 px de solape píxel a píxel y ninguna cabeza sobre otra.
4. **B4: OK.** Con 2, 3 y 4 carroñeros, en 412×860 y en 375×667.
5. **B5 y V7: OK.** Se lee como un tiro que pasa junto al hombro de Sombra y llega al bruto. El cuadro corto termina justo en la boca. Lo de los 32 px no es un problema de V7.
6. **R31: OK.** 0 cuadros con marcador.
7. **V4: OK por la letra.** La legibilidad bajo las barras va a backlog. «¡Crítico!» se entiende.
8. **V2/V3 en las pantallas bajas: OK.** El 2,9 % de cara tapada no es bloqueante.
9. **H-c: OK.**
10. **Nada roto:** escalas, piso, caras, caída, giro y nombres siguen como en la ronda 2.

## Afirmaciones vs. imagen

Coordenadas de las regiones:
- Capturas de 412×860 @2: 824×1720 px, coinciden con el mundo.
- 360×740, 375×667 y 375×611 @2: px de la imagen (el lienzo de 375×667 empieza en x = 54).
- Mis cuadros frenados: @2 a 412×860.
- Las tiras (`*.webp` de `ronda3/` que empiezan con `b1_`, `b2_`, `v4_`, …) llevan el nombre de cada cuadro.

**B1 · V3/V8, cartel de victoria** (decisión 2026-11-09: no tapa ninguna silueta; ≤ 70 px CSS; centro cerca del 34 %, dentro del tercio medio)
- [OK] **Cartel compacto.** «¡Victoria!» y «Volver» van en una fila, con 68 px CSS de alto y el centro entre 33,6 y 34,1 % del marco. Pasa en las 20 vistas: bruto, 3 carroñeros, 4 Voz del Velo y jefe, en 412×860, 360×800, 1280×800, 360×740 y 375×667.
- [OK] **Nada queda debajo del cartel.** Las caras de Viktor y Sombra se ven enteras. Los caídos (bruto, carroñeros, Voz del Velo y Devorador) quedan tendidos por debajo, con aire. `sobreSiluetas` está vacío en las 20 vistas.
- Capturas: `ronda3/b1_victoria_{412x860,360x800,360x740,375x667}.webp` y `ronda3/b1_b2_1280x800.webp` (fila de arriba); detalle en `hoja/412x860_victoria.webp` región 56,516,711,136 (cartel) y 190,690,460,245 (bruto caído, libre).

**B2 · V3/V8, cartel de derrota** (decisión 2026-11-09: puede tapar enemigos vivos; elige el tercio medio sin cortar caras cuando hay sitio; nunca tapa héroes tendidos ni botones)
- [OK] **No toca a los tendidos ni la fila de botones.** El centro va del 34,0 al 53,0 %, según formación. Con 4 Voz del Velo cae al 34 %, por encima de las cabezas, y no tapa a nadie.
- [OK] **No corta caras.** Con el bruto, el borde superior del cartel queda justo bajo los colmillos (la cara llega a y 618 de mundo y el cartel arranca en 620). Con el jefe se ven el ojo y los dientes de arriba. Con 3 carroñeros, el cartel tapa solo patas y cuerpo.
- Capturas: `ronda3/b2_derrota_bruto_cara_412.webp` (de `hoja/412x860_derrota.webp` región 100,420,640,420), `ronda3/b2_derrota_{412x860,375x667,360x740_360x800}.webp` y `ronda3/b1_b2_1280x800.webp` (fila de abajo).

**B3 · V3, tendidos de derrota** (≤ 10 % dentro de la fila, nunca cabeza sobre cabeza)
- [OK] **Tres cuerpos separados en la fila delantera.** Todos tienen la cabeza a la izquierda, con un largo de 267 (×0,9) y 8–9 px de hueco entre uno y otro.
- **Medición píxel a píxel**, con el alfa real y la transformación de cada caído: 0 px de solape en las dos filas, en las 5 pantallas, también con el jefe y con 4 Voz del Velo.
- Se leen como cinco caídos y no como una mancha.
- Captura: `ronda3/b3_tendidos_412x860.webp`, de `hoja/412x860_derrota.webp` región 0,1040,824,320.

**B4 · V2, carroñeros de crypt** (con 2, 3 y 4 enemigos, ningún pie sobre el altar)
- [OK] **Pies sobre la calle.** En 412×860 y en 375×667, los pies de todos los carroñeros caen entre x 89,6 y 614,2, entre el carro (77,5) y el altar (618,9).
- Sin héroes se ve que pisan la calle: el altar queda libre en los 6 casos.
- Con 4 forman dos columnas de 2. Las caras de atrás asoman por encima de las de adelante: apretado, pero legible.
- Capturas: `ronda3/b4_crypt_2_3_4_{412x860,375x667}.webp` (de `ronda3/crypt_*_sinheroes.webp`, región 0,440,824,700 a 412). Vistas con héroes: `ronda3/crypt_*_{2,3,4}en.webp`. Medidas: `ronda3/medidas_crypt.json`.

**B5 · V7, «el tirador apunta al enemigo»** (cuadros frenados ×0,1 a @2: `ronda3/b5_*`; datos en `ronda3/medidas_tirador.json`)
- [OK] **Gira, se inclina y dispara al objetivo.** Elena voltea hacia el objetivo, se inclina 30° (el tope) y usa el cuadro `sin_fogonazo`, de 533 px. La estela va de la boca, en el mundo (640, 1071), al pecho del objetivo, y el proyectil la recorre. Pasa igual con los cinco objetivos probados: bruto, carroñero de adelante, carroñero de atrás a la izquierda, Voz del Velo de atrás y jefe.
  - Captura: `ronda3/b5_tirador_1en_secuencia_css.webp` (seis cuadros a escala de pantalla, 412 CSS).
- [OK] **El fogonazo está en la boca, no sobre un compañero.** El fogonazo queda delante de Elena. Roza la punta del puñal de Sombra, pero no cae sobre su cuerpo (`ronda3/b5_boca_fogonazo_x3.webp`, mundo 540,980,200,160 ×3).
- [OK] **Se lee como un tiro al bruto.** La estela va por detrás de la fila de héroes. Asoma pegada al brazo derecho de Sombra, pasa junto a su hombro y llega al pecho del bruto (`ronda3/b5_tirador_1en_02_estela.webp`, mundo 330,380,494,900).
  - Con objetivos más a la izquierda la estela se ve entera, cruzando por delante de otro enemigo (`ronda3/b5_tirador_otros_objetivos.webp`).
  - Ya no parece que le dispare a Sombra.
  - Queda un matiz para el backlog: el cañón sigue apuntando hacia el hombro de Sombra.
- [OK] **El cuadro corto termina en la boca y no se come el cañón.** En la textura, el corte de la columna 533 cae justo después del anillo de la boca y el fogonazo pintado queda fuera (`ronda3/b5_textura_corte_col533.webp`). En pantalla, el cañón termina limpio (`ronda3/b5_boca_cuadro_corto_x3.webp`).
- [OK] **Los 32 px fuera del lienzo no chocan con V7.** V7 pide giro y puntería, no que la pose quede dentro del lienzo. Durante el disparo (~420 ms) la silueta inclinada sale 32 px de mundo (16 px CSS a 412) por la derecha. Lo que se corta es el ala trasera del morrión y la espalda; la cara y el arma quedan a la vista (`ronda3/b5_silueta_borde_derecho.webp`, mundo 560,980,264,380). Lo dejo en el backlog como menor.

**V7, giro** (muestreo por cuadro a velocidad real, `ronda3/medidas_giro.json`)
- [OK] **El atacante se gira hacia su objetivo y vuelve a los ~423 ms.**
  - El bruto voltea hacia Elena (a su derecha) y no hacia Aria (a su izquierda).
  - Aria ataca sin voltear.
  - Elena voltea y vuelve a idle con 0° y el cuadro entero.

**R31 · marcador**
- [OK] **Ningún golpe a un héroe muestra el marcador.** El bruto golpea a los 5 héroes: 55 cuadros por pantalla en 412×860 y en 375×667, 0 con textura `ph:`; solo aparecen las `idle` de las 5 clases.
- Se ve el destello de la silueta propia de cada héroe, sin lápidas ni bloques grises, y los números sobre la cabeza (`ronda3/r31_golpe_5_heroes_412x860.webp`, cuadros +30/+100/+300 ms).
- La secuencia de la hoja (`hoja/secuencia_golpe_heroe.webp`) muestra lo mismo con Elena.
- En la caída de los 5 héroes (`ronda3/medidas_caida.json`) tampoco hay ningún cuadro con marcador.

**V4 · números** (decisión 2026-11-09: px CSS, apilado por el alto real + 4, nunca se pisan; `ronda3/medidas_numeros.json`)
- [OK] **Tamaño en px CSS, en las 5 pantallas:**

  | Pantalla | Normal | Crítico |
  |---|---|---|
  | 412×860 | 40,0 | 60,0 |
  | 360×800 | 40,2 | 59,9 |
  | 360×740 | 40,0 | 59,8 |
  | 375×667 | 39,9 | 60,1 |
  | 1280×800 | 40,0 | 60,0 |

  Arrancan sobre la cabeza. El pop y la subida están como en la tabla de T10.8.
- [OK] **Apilado sin pisarse.**
  - Ráfaga de 37, 96! y 52 en el mismo cuadro: van en columnas, una al lado de la otra, con 4 px CSS de hueco, porque apiladas en vertical quedarían bajo las barras. No se pisan ni al nacer ni a 140 ms.
  - Secuencia con crítico: 96! entra al lado de 37 y 52 al otro lado.
  - Capturas: `ronda3/v4_rafaga_{360x800,360x740,375x667}.webp`, `ronda3/v4_critico_{412x860,375x667}.webp`, y `hoja/secuencia_numeros.webp`.
  - Es el espíritu de la decisión (alto real, nunca se pisan) aunque la pila sea horizontal.
- **¿Se lee el primer número que nace bajo la barra?** (pantallas más bajas que 412×860)
  - Al nacer se lee en 360×800, 1280×800 y 360×740: solo el 96! roza la barra (3–23 px CSS).
  - En 375×667 el 96! nace con 44 px CSS bajo la barra y el 37 y el 52 con 9 px; a 140 ms ya están 20–45 px por debajo.
  - En las cuatro pantallas bajas los números terminan la subida detrás de la barra de vida, que es DOM por encima del lienzo y los corta.
  - En 412×860 nunca llegan a la barra.
  - Ni V4 ni V3 lo cubren: V4 no habla del HUD y V3 habla de sprites. Va al backlog con prioridad (ver abajo).
- [OK] **«¡Crítico!» sobre quien lo hace se entiende.** Aparece sobre Aria en el color del crítico, Aria embiste y el 96! amarillo cae sobre el bruto: el color une las dos cosas. No tapa caras (`ronda3/v4_critico_412x860.webp`, cuadros 150 y 400 ms). R13 no fija dónde va.

**V2/V3 en las pantallas bajas** (360×740 y 375×667, ahora obligatorias)
- [OK] **Ningún pie tapado.** El carril delantero queda 8 px de mundo sobre el borde real de los botones con «¡TAP!»:
  - 360×740: HF 1308 contra botones en 1316;
  - 375×667: HF 1264 contra 1272.
  
  Las botas terminan justo encima de «¡TAP!» (`ronda3/v3_pies_botones_375x667.webp`, de `hoja/375x667_3enemigos.webp` región 54,860,640,200; `ronda3/v3_pies_botones_360x740.webp`). La H2 de la ronda 2 queda resuelta.
- [OK] **Cabezas bajo las barras y pies sobre el piso** en las 24 vistas bajas (`ronda3/reg_de_pie_bajas.webp`).
- [OK] **El 2,9 % de 375×667 con 4 Voz del Velo no es bloqueante.**
  - Lo que se tapa es la esquina inferior izquierda del 35 % superior de e3: su mano sujetando la capucha, detrás de la capucha de Sombra.
  - La cara (ojos, nariz, boca) se ve entera.
  - Captura: `ronda3/v3_375x667_veil_e3_cara.webp`, de `hoja/375x667_4enemigos_veil.webp` región 440,560,280,220 ×2,5.
  - Pasa lo mismo en 375×611 (e3 2,9 %, e0 0,8 %, e1 0,1 %).

**H-c · marco muy bajo (375×611)**
- [OK] **La escena achicada se lee bien.**
  - Con el jefe de la catedral (factor 0,931), héroes y Devorador quedan algo más chicos y en proporción. La cabeza del jefe queda bajo su barra y las caras de los héroes se ven. Los pies delanteros quedan sobre «¡TAP!», con unos 3 px CSS de aire (HF 1223 contra botones en 1231) (`ronda3/hc_375x611_jefe_pies.webp`, de `hoja/375x611_jefe.webp` región 40,700,670,300).
  - Con 3 carroñeros y con 4 Voz del Velo (factor 1), la escena queda apretada pero se ve entera, y las cuatro caras de las Voz del Velo asoman (`ronda3/hc_375x611_veil_caras.webp`).
  - Sheet: `ronda3/hc_375x611.webp`.

**Nada de lo que estaba OK en la ronda 2 se rompió**
- [OK] **V1, escalas:** héroe/común 0,62 · jefe/héroe 2,01 · común en grupo/héroe 0,97 · trasera/delantera 0,82, iguales en las 5 pantallas (`ronda3/reg_de_pie_412x860.webp`).
- [OK] **V2, piso:** el bruto pisa la calle, las Voz del Velo el pie de la escalera y el Devorador la nave; los carroñeros ahora fuera del altar. Volví a capturar moor (a1n4), ashfield (a2n7) y veil_marsh (a2n4) con 1, 3 y 4 enemigos y sin héroes: pisan su piso como en la ronda 2, con los mismos carriles (±2) (`ronda3/reg_fondos_sinheroes.webp`, `ronda3/fondo_*_sinheroes.webp`, `ronda3/medidas_fondos.json`).
- [OK] **Caras de héroes y enemigos libres** en las 412×860.
- [OK] **V6, caída:** 465–467 ms, α 0,85, desaturada, en una ronda real con planificador. La última de la ronda sigue cerrando a 383 ms, como en la ronda 2: dentro de los 600 ms (`ronda3/medidas_caida.json`).
- [OK] **V7, giro:** ver arriba.
- [OK] **V5, nombres:** sin «…» en las 5 pantallas. En 360×740 y 375×667 el título pasa a dos líneas, sin recortar.
- [OK] **V8:** cartel ≤ 40 % del alto y dentro del tercio medio en las 40 vistas de resultado.
- [OK] **V9:** 4 barras «Voz del Velo» en las vistas de veil_gate.

## Hallazgos no escritos

Todos van a backlog y ninguno bloquea. No repito los que ya estaban (caídos oscuros, clones de las Voz del Velo, ritmo de la barra).

1. **Media · en pantallas bajas los números de daño terminan su subida detrás de la barra de vida.**
   - Qué se ve:
     - En 375×667 el 96! de un crítico nace con 44 px CSS bajo la barra, y a los ~400 ms la barra lo corta por la mitad. En la secuencia real con crítico se lee mal casi toda su vida.
     - En 360×740, 360×800 y 1280×800 los números se leen al nacer, pero la segunda mitad de la subida va por detrás de la barra.
     - Pasa con enemigos altos (bruto y jefe, cabeza a 439–476 de mundo); con carroñeros y Voz del Velo, la cabeza está más abajo y no ocurre.
   - Capturas: `ronda3/v4_rafaga_375x667.webp` (0/140/440 ms), `ronda3/v4_critico_375x667.webp` (400/650 ms), `ronda3/v4_rafaga_{360x740,360x800}.webp`.
   - Causa: con el tamaño doble que decidió el owner, la subida de 60 px CSS lleva la base de 40–60 px CSS por encima del borde de las barras. `floatAt` (`CombatScene.js:550-575`) mira las barras al colocar el número, pero no al hacerlo subir (`float`, `:536`).
   - Arreglo: que la subida no pase el borde de las barras (`hud.top` + 4 px CSS). Si no queda sitio, que suba menos o que vaya en la columna de al lado más abajo.
   - 375×667 es un teléfono muy común y dentro de Telegram el marco es aún más bajo: lo dejo como el primero del backlog.
2. **Baja · el cañón del tirador apunta unos 30° por debajo de su propio tiro.**
   - Qué se ve: con el tope de 30°, el cañón señala hacia el hombro de Sombra, mientras la estela sale de la boca a unos 61° hacia el pecho del bruto. El fogonazo roza la punta del puñal de Sombra.
   - Se entiende gracias a la estela, pero la pose sigue sugiriendo que apunta a la fila de atrás.
   - Captura: `ronda3/b5_tirador_1en_00_fogonazo.webp`.
   - Arreglo, a decidir: más inclinación cuando el objetivo está muy arriba, otra pose de disparo hacia arriba (arte), o correr la boca para que el cañón no quede pegado a un compañero.
3. **Baja · la silueta del tirador sale 32 px de mundo por la derecha durante el disparo.** El ala trasera del morrión se corta contra el borde unos 420 ms; en 1280×800 el corte queda contra el margen negro (`ronda3/b5_silueta_borde_derecho.webp`).
4. **Info · tirador en la fila trasera, sin captura.** El reviewer de código avisa que, con el tirador en el slot 4 o 5, la estela nacería por detrás de su propio cuerpo. En las vistas de la hoja Elena siempre va en el slot 3: no hay captura de ese caso.

## Fuera de la hoja (backlog, no bloqueante)

- Los hallazgos n.º 1 (prioridad media/alta: números bajo la barra en pantallas bajas), 2, 3 y 4.
- Para el owner, ya reportado por el reviewer de código (H-1 de la ronda 4) y fuera de lo que mira la hoja: en marcos de menos de ~545 px CSS (320×568 dentro de Telegram), la formación no cabe ni achicada a 0,5. Ahí vuelven las constantes y los pies quedan bajo los botones.

## Capturas usadas

- `specs/combate_b/evidencia/hoja/`:
  - las 60 vistas `{412x860,360x800,1280x800,360x740,375x667}_{1enemigo,3enemigos,4enemigos_veil,jefe,victoria,derrota,victoria_3enemigos,derrota_3enemigos,victoria_4enemigos_veil,derrota_4enemigos_veil,victoria_jefe,derrota_jefe}.webp`;
  - `375x611_{3enemigos,4enemigos_veil,jefe}.webp`;
  - `hoja_contacto.webp`, `hoja_medidas.json`;
  - `secuencia_golpe_heroe.webp`, `secuencia_numeros.webp`, `secuencia_tirador.webp`.
- `specs/combate_b/evidencia/visual/ronda3/`, generadas en esta ronda con `capturar_ronda3.mjs` (modos `crypt`, `tirador`, `numeros`, `golpe`, `caida`, `giro`, `fondos`):
  - crypt: `crypt_{412x860,375x667}_{2,3,4}en{,_sinheroes}.webp`;
  - números: `numeros_{412x860,360x800,360x740,375x667,1280x800}_{rafaga_{0,140,440}ms,critico_{150,400,650,850}ms}.webp`;
  - golpe: `golpe_{412x860,375x667}_{30,100,300}ms.webp`;
  - caída: `caida_{victoria,derrota}_final.webp`;
  - fondos: `fondo_{a1n4,a2n7,a2n4}_{1,3,4}en_sinheroes.webp`;
  - medidas: `medidas_{crypt,tirador,numeros,golpe,caida,giro,fondos}.json`.
- Recortes y tiras citados (`ronda3/`):
  - B1–B4: `b1_victoria_{412x860,360x800,360x740,375x667}.webp`, `b1_b2_1280x800.webp`, `b2_derrota_{412x860,375x667,360x740_360x800}.webp`, `b2_derrota_bruto_cara_412.webp`, `b3_tendidos_412x860.webp`, `b4_crypt_2_3_4_{412x860,375x667}.webp`;
  - B5: `b5_tirador_1en_secuencia_css.webp`, `b5_tirador_1en_00_fogonazo.webp`, `b5_tirador_1en_02_estela.webp`, `b5_boca_fogonazo_x3.webp`, `b5_boca_cuadro_corto_x3.webp`, `b5_textura_corte_col533.webp`, `b5_silueta_borde_derecho.webp`, `b5_tirador_otros_objetivos.webp`;
  - V4: `v4_rafaga_{360x800,360x740,375x667}.webp`, `v4_critico_{412x860,375x667}.webp`;
  - R31: `r31_golpe_5_heroes_412x860.webp`;
  - V3: `v3_375x667_veil_e3_cara.webp`, `v3_pies_botones_{375x667,360x740}.webp`;
  - H-c: `hc_375x611.webp`, `hc_375x611_jefe_pies.webp`, `hc_375x611_veil_caras.webp`;
  - regresión: `reg_de_pie_412x860.webp`, `reg_de_pie_bajas.webp`, `reg_fondos_sinheroes.webp`.
- Los cuadros crudos del tirador (77 png a @2) quedaron fuera del repo. Los citados están en las tiras `b5_*`.
