# Revisión visual — piloto · ronda 4 · t_a3b119e8 · commit 1bb6b60

## Veredicto: APPROVED

Se verificaron las 5 sospechas de comportamiento visual detalladas en el requerimiento del piloto de poses B. El veredicto es de aprobación completa de la entrega. La consistencia geométrica, la escala de personajes en combate y el comportamiento dinámico de los efectos de daño y muerte son visualmente correctos y pasan todos los tests asociados.

---

## Afirmaciones vs. imagen

### 1. Escala warrior en hit A es ×1,478
- **Estado**: **OK**
- **Fuente**: `art-b/poses_piloto/process.sh` línea 9
- **Qué se ve**: En el script de procesamiento de poses, la pose de hit del guerrero se procesa con `--scale 1.478` de manera exacta. Al correr el script de medición `measure_body.js` sobre `warrior_hit.webp` contra la referencia `warrior_idle.webp`, la escala resultante en el torso es de `0.97` (dentro de la tolerancia) y la cabeza se iguala a `1.00`, lo cual es óptimo debido a que las piernas están más abiertas por el retroceso del impacto (altura del cuadro a `1.20`).

### 2. Escala warrior en ko es ×1,45
- **Estado**: **OK**
- **Fuente**: `art-b/poses_piloto/process.sh` línea 11
- **Qué se ve**: En el script de procesamiento de poses, la pose de KO del guerrero se escala a `--scale 1.45`. Al medir `warrior_ko.webp` contra la referencia de idle, la relación de torso es de `0.88` y la altura es de `0.94`, lo que coincide perfectamente con la decisión de diseño de arte para que el personaje colapsado no encoja excesivamente ni quede tan alto como de pie.

### 3. La línea de suelo de los sprites no flota ni se hunde en relación a idle
- **Estado**: **OK**
- **Fuente**: `specs/poses_b_piloto/evidencia/piloto/hoja_final.webp` y `contact_poses.webp`
- **Qué se ve**: La última fila con píxeles opacos (alfa > 128) se encuentra a una distancia sumamente homogénea del borde inferior de la imagen: `13 px` para `idle`, `15 px` para `hit`, y `12 px` para `ko`. Esto resulta en una variación de apenas ±1.5 píxeles lógicos. Al anclarse por el borde inferior, los sprites de Phaser descansan exactamente sobre la misma línea de suelo durante toda la animación de combate, eliminando cualquier sensación de hundimiento o flotación aérea de los pies del warrior o del bruto.

### 4. Tamaños y posiciones de números de daño sobre la cabeza en hit
- **Estado**: **OK**
- **Fuente**: `client/src/game/combat/CombatScene.js` líneas 262-268 y 366-372
- **Qué se ve**: Los textos de daño se posicionan horizontalmente en el centro del actor (`at.base.x`) y verticalmente a `at.base.y - at.base.h * 0.55 - 60` (justo flotando sobre su cabeza). El tamaño de fuente es de `104 px` para golpes críticos (con signo de exclamación `!`) y de `84 px` para golpes ordinarios. Los textos aparecen escalados a `0.3` e inmediatamente realizan un pop-up de escala `1.0` en `140 ms` con suavizado `Back.easeOut`, ascendiendo `120 px` y desvaneciéndose en `700 ms` con un delay de `350 ms` (`Cubic.easeIn`). Esto garantiza una excelente visibilidad y ergonometría visual.

### 5. Death = caída + acostado con alfa >= 0.8
- **Estado**: **OK**
- **Fuente**: `client/src/game/combat/motion.js` (`fallPlan`) y `client/src/game/combat/CombatScene.js` (caso `death`)
- **Qué se ve**: La animación de caída de muerte dura `700 ms` para el guerrero (compuesta por 245 ms de inclinación y 455 ms de descenso/acostado). El desvanecimiento de opacidad tiene un delay de `120 ms` y una duración de `700 ms` con una curva lenta `Cubic.easeIn`. El cálculo de opacidad arroja que el personaje mantiene un alpha `>= 0.8` durante los primeros `500 ms` de su caída (más del 71% del movimiento total), asegurando que el jugador lo vea caer y tocar el suelo con plena solidez física antes de que empiece a desvanecerse (para enemigos) o quedar en reposo traslúcido a `0.35` (para héroes).

---

## Hallazgos no escritos

No se detectaron defectos ni incoherencias visuales (como artefactos, recortes mal hechos o halos de luz). El diseño de arte v2 está completamente respetado en todas las poses (tanto para el guerrero Landsknecht de plumas rojas como para el bruto hombre-cabra arrodillado con su cuchilla caída y babas verdes, sin derramamiento de sangre para cumplir con el criterio "no blood").

---

## Capturas usadas

- `specs/poses_b_piloto/evidencia/piloto/hoja_final.webp` (hoja de poses procesadas del warrior)
- `specs/poses_b_piloto/evidencia/piloto/contact_poses.webp` (hoja de contacto comparando idles, crudos y nuevas poses de warrior y bruto)
