# Dirección de arte B — ilustración gótica de perfil — Diseño

> **Fecha:** 2026-10-16 · **Estado:** spike validado (`spikes/001-combat-b`),
> pendiente de aprobación del owner sobre el *look* antes de producir en masa.
> **Reemplaza** la dirección "diorama iso pixel-painterly"
> (`2026-07-27-coordinacion-visual-diorama.md`).

## 0. Por qué

Revisión estética (2026-10-16): el juego se veía amateur por **mezcla de
familias de arte** (dioramas IA + sprites pixel de 16 px + tiles Kenney +
emojis), un fondo cuadrado recortado en vertical, todo oscuro sobre oscuro,
UI de "página web" y la fuente medieval bloqueada por la CSP. El motor no era
la causa. El spike demostró que con **un único estilo ilustrado coherente,
composición vertical y efectos de Phaser** el salto es grande sin cambiar de
motor.

## 1. Contrato visual (todo asset lo cumple)

> **Revisado 2026-10-16 (owner):** el estilo pasa de "tinta gótica limpia" a
> **grimdark renacentista** — fantasía oscura de escala heroica, estética del
> Renacimiento alemán (landsknechte, pólvora primitiva + magia caprichosa),
> mugre y decadencia, maximalismo grotesco con humor negro. Inspiración de
> RASGOS de la fantasía de mesa clásica; **cero IP de terceros** (ni nombres de
> facciones, ni símbolos, ni nombres de ilustradores en los prompts).

| Eje | Valor |
|-----|-------|
| Técnica | ilustración entintada tipo grabado/xilografía del s. XVI: línea tosca, trama cruzada en sombras, aguadas de tinta oscura. **No** pixel art, **no** 3D, **no** fantasía limpia/anime |
| Proporciones | **escala heroica**: cabeza, manos, armas y hombreras sobredimensionadas; siluetas macizas y legibles de lejos |
| Paleta | tierras: umbra, sepia, ocre, óxido, hueso, latón deslucido, carmesí de sangre seca; acentos raros de **verde enfermizo** (magia/corrupción) y naranja vela |
| Mundo | Renacimiento alemán: calzas bombachas acuchilladas, sombreros de ala con plumas absurdas, morriones, corazas abolladas, arcabuces, montantes; pueblos de entramado de madera derrumbándose, horcas, jaulas, santuarios quemados, barro |
| Tono | todo gastado y al borde del colapso: calaveras, pinchos, cadenas, pergaminos de oración, amuletos lacrados, vendas; toques grotescos y cómicos (botín ridículo, bigotes imposibles) |
| Vista | ¾: héroes miran a la **derecha**, enemigos a la **izquierda** |
| Poses | héroes: **hoja de pose** (idle izq. + ataque der. en UNA imagen 16:9) → coherencia alta; enemigos: idle + hit |
| Fondos | verticales 9:16, piso abierto en la mitad inferior |
| UI | roble oscuro, latón deslucido, hierro con remaches, pergamino, lacre; tipografía **IM Fell English / SC** (imprenta antigua, OFL); cero emojis |
| Anclas | `art-b/gr/refs/anchor.webp` (Ulrich, el doble sueldo) para estilo; `mage_idle.webp` como ref de estilo cuando el ancla "contagia" su montante |

Herramientas: `scripts/gen_art_b.js` (estilo `grimdark` por defecto; `ink`
conserva el estilo anterior), `scripts/process_art_b.js` (`--crop`, `--erase`,
`--flip`, `--fade-right`), `art-b/gr/manifest.json` + `art-b/gr/process.sh`.
Revisión humana obligatoria de cada asset antes de integrarlo.

## 2. Fases

### B1 — Combate en producción (primero; es donde más se nota)
- Nueva `CombatScene` Phaser (port del spike) montada por
  `CombatInstancePanel`; React queda como chrome (placa, tarjetas, botones).
- Server-authoritative intacto: la escena **reproduce** el resultado de
  `stepInstance` (deltas de vida por ronda), nunca decide nada.
- Distribución para escuadra de hasta 5: dos filas en profundidad (3 atrás,
  2 adelante), enemigo grande arriba a la derecha; multi-enemigo (oleadas)
  en grupo escalonado.
- Arte: 18 héroes × {idle, attack} = 36 · 8 enemigos × {idle, attack, hit} =
  24 · 6 fondos de combate (ruinas, marea, arena de jefe + acto 2).
- Presupuesto de calidad: bloom/partículas con 3 niveles (auto según fps)
  para móviles de gama baja.

### B2 — Kit de UI y tipografía en todo el chrome React
- Fuentes empaquetadas (`client/public/fonts`, OFL: IM Fell English para todo el juego) y quitar Google Fonts.
- Tokens de Tailwind (colores, sombras, bordes) + componentes `Panel`,
  `Button`, `PortraitRing`, `Bar` usando la hoja de UI generada.
- Hoja de íconos ilustrados (~40) que reemplaza todos los emojis.

### B3 — Hub
- Ilustración vertical del Bastión con zonas tocables (edificios) + luz,
  humo y brasas; HUD reducido a 5–6 accesos, el resto a un menú.

### B4 — Resto de pantallas
- Menú principal con key art, roster de héroes con cuerpo entero, mapa de
  Operaciones ilustrado, pantallas de recompensa/victoria.

## 3. Opción C (cambio de motor) — compuerta

**Descartada por ahora.** Se re-evalúa al cerrar B1+B2 sólo si aparece una
necesidad que Phaser 3 no cubre bien: animación esquelética a gran escala
(primero probar el plugin oficial de Spine para Phaser), 3D, o rendimiento
insuficiente en el dispositivo objetivo medido de verdad. Phaser 4 (estable
desde abril 2026) es una migración de renderer; se considera recién después
de B4.

## 4. Costos y riesgos

- Arte estimado B1–B4: ~75 imágenes + ~30% de regeneraciones ≈ 100 llamadas
  ≈ 13–15 USD (tarifa pública de Gemini 3 Pro Image 2K).
- Riesgo: deriva de estilo entre tandas → siempre `--ref` al ancla y
  revisar en hojas de contacto sobre fondo oscuro.
- Riesgo: restos de la referencia/poses casi iguales → regenerar
  (≈1 de cada 4 en el spike).
- Riesgo: peso del APK → todo en webp, fondos 1080 px de ancho, héroes 640 px
  de alto (~50 KB c/u).

## 5. Criterios de aceptación de B1

- Un combate real de campaña (`a1n1`…) se juega entero con la nueva escena,
  con el arte B de los héroes de la escuadra y del enemigo del nodo.
- Ningún asset del pipeline viejo visible en combate.
- Tests del cliente y del server pasan; sin errores de consola.
- ≥ 50 fps en el emulador `vault` con el nivel de calidad medio.
