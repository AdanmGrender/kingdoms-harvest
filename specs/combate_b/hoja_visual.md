# Hoja Visual de Combate — `combate_b` (Etapa C)

Mundo 824×1720 (móvil 412×860 = ×2). Vistas obligatorias: 412×860, 360×800, 1280×800 × {1 enemigo común, 3 comunes, 4 (veil_gate), 1 jefe} + resultado victoria y derrota.

## Requerimientos Visuales (V1–V9)

### V1 Escala
- Héroe de la fila delantera = 0,60–0,70 de la altura de un enemigo común solo (hoy ~0,5).
- Jefe = 1,8–2,2 × héroe.
- Con 3–4 enemigos, ningún común baja de 0,9 × héroe.
- Fila trasera de héroes = 0,80–0,85 de la delantera (no 0,65).

### V2 Suelo
- Los pies (fila inferior con alfa>0 del sprite) de TODOS los personajes a ±12 px de la línea de suelo de su fondo (groundY por fondo) — nunca sobre techos/cielo.

### V3 Solapes
- Dentro de una fila, cajas de héroes con solape ≤10 % del ancho.
- HUD, botones y barras no tapan ningún sprite (cabeza incluida).

### V4 Números de daño (Enmienda Last Asylum)
- Los números de daño arrancan SOBRE LA CABEZA del objetivo (nunca sobre la cara/35 % superior del sprite).
- Tamaño: 36–44 px normal, 56–64 px crítico.
- Animación: pop 1,4→1 en 120 ms, se apilan con offset 28 px y suben 60 px en ≤800 ms.

### V5 Textos
- Ningún nombre truncado con «…» en las 3 resoluciones (abreviar desde un mapa fijo o bajar fuente hasta 11 px CSS).

### V6 Muerte
- Caída (rotación + bajada, ≤600 ms) y queda tendido en el suelo a alfa ≥0,8 desaturado; nunca fantasma translúcido de pie.
- La barra del HUD del muerto se atenúa (enemigos también).

### V7 Orientación
- Al atacar, el atacante se gira hacia su objetivo (flipX según lado) y vuelve a su orientación al terminar.
- El tirador apunta al enemigo.

### V8 Resultado
- El cartel de victoria/derrota ocupa ≤40 % del alto, centrado en el tercio medio, sin tapar los botones de continuar ni la barra de navegación.

### V9 Nombres de barras
- Nombres de barras = lo que se ve (veil_gate con 4 Voz del Velo → 4 barras «Voz del Velo»).

## Decisión del owner (2026-11-07) — carriles de suelo por profundidad

Resuelve el bloqueo de `tasks.md` (choque V1/V2 vs R24: con una sola línea de suelo, 5 héroes + 3–4 enemigos no caben sin intersección). El owner eligió **carriles por profundidad**. V2 queda así:

### V2 Suelo (enmendada)
- Cada fila de profundidad tiene **su propio carril** (línea de suelo): de atrás (arriba en pantalla) hacia adelante (abajo) → enemigos de atrás, enemigos de adelante, héroes traseros, héroes delanteros. Un enemigo solo o un jefe usa un único carril de enemigos.
- Los pies (fila inferior con alfa>0) de cada personaje van a **±12 px de la línea de SU carril**, no de una línea común.
- Todos los carriles caen sobre el **piso transitable de su fondo**: por debajo de la línea de suelo calibrada de ese fondo (`BG_GROUND_Y_FRAC` por fondo, medida sobre la imagen real; ver hallazgo 2 de la review Etapa C) y por encima de `HUD_TOP`. Nunca sobre techos, cielo ni paredes.
- El orden de dibujo (profundidad) sigue al carril: el carril más bajo en pantalla se dibuja delante.

### Lo que NO cambia
- ~~R24: cero intersección de cajas para n = 1…5 héroes × m = 1…4 enemigos, dentro de 824×1720. No se relaja.~~ **Superado el 2026-11-08:** R24 se exige solo dentro de cada fila (ver la decisión de abajo).
- V1 (escalas), R27 (topes 0,29 / 0,36), formación 3+2 de héroes, V3 (HUD, botones y barras no tapan sprites).
- Si con carriles por profundidad y escalas V1 sigue sin existir solución con cero intersección, el implementer NO relaja nada: lo deja en `## Bloqueado` de `tasks.md` con las cuentas, para nueva decisión del owner.

## Decisión del owner (2026-11-08) — solape permitido ENTRE filas (2,5D)

Resuelve el segundo bloqueo de `tasks.md` (con carriles y cero intersección también entre filas, 52/280 casos sin solución con el HUD real: el alto entre el piso del fondo y los botones de héroe no alcanza; ver `evidencia/hoja/factibilidad_hud_real.txt`). El owner eligió la opción (i) del bloqueo:

- **R24 enmendado**: cero intersección de cajas **dentro de cada fila** (héroes delanteros entre sí, héroes traseros entre sí, cada fila de enemigos entre sí). Entre filas distintas se permite solape parcial; la fila de carril más bajo en pantalla se dibuja delante (2,5D, como Last Asylum). Factibilidad medida: 280/280 en las tres escuadras con el HUD real (`evidencia/hoja/factibilidad_opcion_entre_filas.txt`).
- **Tope inferior real (V3)**: los carriles y los pies quedan por encima del borde superior REAL de los botones de héroe, contando «¡TAP!», en cada viewport (peor caso 360×800: 1328 de mundo; `evidencia/hoja/hud_medidas.json`). `HUD_TOP = 1440` está por debajo de los botones: corregirlo. Las cabezas siguen por debajo de las barras de vida (T).
- **Legibilidad**: el objetivo es que ninguna cara (35 % superior del sprite) quede tapada por un personaje de otra fila. No bloquea al implementer: elige la colocación que minimice la cara tapada y reporta el % de cabeza tapada por vista en `hoja_medidas.json`. El visual_reviewer decide si algún caso es bloqueante.
- **Sin cambios**: V1, V2 enmendada (carriles por profundidad sobre el piso calibrado por fondo, `calibracion_suelo.json`), R27, 3+2, V4–V9.

## Decisión del owner (2026-11-09) — tras la revisión visual ronda 2

Responde lo que la ronda 2 de `visual_review.md` dejó al owner. Todo lo demás de la hoja sigue igual.

- **V3/V8, cartel de derrota (B2):** en derrota el cartel de resultado PUEDE tapar a los enemigos vivos, porque la escena está bajo el velo de derrota (R41). Se elige la posición del tercio medio que no corte caras cuando haya sitio. Nunca tapa a los héroes tendidos ni los botones.
- **V3/V8, cartel de victoria (B1, sin cambio de regla):** en victoria el cartel no tapa ninguna silueta, ni héroes ni enemigos caídos. Arreglo de la ronda 2: cartel compacto (≤ 70 px CSS, «¡Victoria!» y «Volver» en una fila) con el centro cerca del 34 % del alto, dentro del tercio medio (V8).
- **V4, tamaño:** los px de V4 son **px de pantalla (CSS)**: normal 36–44 px CSS y crítico 56–64 px CSS, el doble de lo medido en la ronda 2 (en el mundo 824 de ancho, 72–88 y 112–128). La subida (60), el pop y la duración se escalan igual: 60 px CSS.
- **V4, apilado:** cada número nuevo se apila a la altura real del anterior + 4 px (normal o crítico). Nunca se pisan. Reemplaza el «offset 28 px».
- **V2/V3, pantallas bajas (H2):** la formación toma el tope inferior de los carriles del borde superior REAL de la fila de botones de héroe (con «¡TAP!») en esa pantalla, medido en tiempo de ejecución y actualizado si cambia el alto (Telegram), en lugar de la constante. Se verifica, sin pies tapados, en las vistas de la hoja más 360×740 y 375×667, que pasan a ser vistas obligatorias de V2/V3. En 412×860, 360×800 y 1280×800 no debe cambiar nada visible. Si en algún alto mínimo no hay solución con R24 por fila + V1 + piso, se reporta con números y no se relaja nada.

## Decisión del owner (2026-11-09, H-c) — pantallas muy bajas

- **V1/V2/V3, marcos muy bajos:** cuando el marco no deja sitio para todos los carriles con su separación (≥ 24) — según la review ronda 3, menos de ~658 px CSS de alto, o 625 con el jefe de la catedral; un 375×667 dentro de Telegram deja ~611 —, toda la formación se achica en proporción (el mismo factor para héroes y enemigos, de modo que las proporciones de V1 se mantienen) hasta que los carriles vuelvan a tener su separación y se cumplan R24 por fila, el piso de cada fondo, las cabezas bajo las barras y los pies sobre el borde real de los botones. Donde ya entra, el factor es 1 y no cambia nada visible.
