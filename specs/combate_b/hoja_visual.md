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
- R24: cero intersección de cajas para n = 1…5 héroes × m = 1…4 enemigos, dentro de 824×1720. No se relaja.
- V1 (escalas), R27 (topes 0,29 / 0,36), formación 3+2 de héroes, V3 (HUD, botones y barras no tapan sprites).
- Si con carriles por profundidad y escalas V1 sigue sin existir solución con cero intersección, el implementer NO relaja nada: lo deja en `## Bloqueado` de `tasks.md` con las cuentas, para nueva decisión del owner.
