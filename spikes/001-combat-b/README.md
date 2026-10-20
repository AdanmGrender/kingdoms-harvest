# Spike 001 — Combate "dirección B"

> **v2 (2026-10-16): estilo grimdark renacentista** (pedido del owner). La v1
> "tinta gótica" quedó en `capturas/tinta-*.webp` y en el historial de git.
> Elenco v2: Ulrich (doble sueldo, montante), Ottokar (brujo de tormenta),
> Greta (arcabucera) contra el Bruto Cornudo en un pueblo apestado.
>
> **Hallazgo v2:** editar la pose de una referencia con la IA mezcla posturas
> (4 piernas, 2 cabezas, "fantasma" del arma del ancla). Lo que funciona:
> **hoja de pose** — las dos poses del mismo personaje en UNA imagen 16:9 —
> y recortar cada mitad (`art-b/gr/process.sh`). El estilo grabado tiende a
> poner fondo de pergamino en figuras sueltas; en hojas de pose sale liso. Plan
> B para fondos texturados: `rembg` (probado vía `uv run --with "rembg[cpu]"`).


**Pregunta:** ¿se puede dar al juego una estética de calidad comercial **sin cambiar
de motor**, con arte generado por IA de forma coherente y animado en Phaser 3.90?

**Correr:** `node spikes/001-combat-b/server.js` → http://localhost:8765 (ventana
tipo celular 412×860). La demo se juega sola (un turno cada ~2.6 s) o con
**Atacar**. Capturas en `capturas/` (el video `.webm` no se versiona).

## Qué se construyó

- **Arte (17 llamadas a `gemini-3-pro-image`, 2K):** 1 ancla de estilo
  (guerrero) → 3 héroes × {reposo, ataque}, 1 enemigo × {reposo, golpeado},
  1 fondo vertical 9:16, 1 hoja de UI. Generador: `scripts/gen_art_b.js`
  (manifest `art-b/manifest.json`); recorte: `scripts/process_art_b.js`
  (`art-b/process.sh`). Salida: `client/public/assets/b/` (≈700 KB en webp).
- **Escena Phaser** (`main.js`, ~400 líneas, sin plugins): respiración de
  reposo, cambio de pose al atacar/recibir, paneo + zoom de cámara al foco,
  oscurecido del resto, hit-stop, destello, sacudida, chispas/sangre, tajo,
  rayo procedural, virote, números de daño con pop, braseros que titilan
  (PointLight), niebla, brasas, viñeta + bloom (postFX de cámara).
- **UI DOM** (en el juego real = chrome React): placa del enemigo con barra
  de vida con "rastro", tarjetas de héroe con retrato recortado del sprite,
  botones con la hoja de UI generada, fuentes Cinzel/Alegreya empaquetadas.

## Verdict: VALIDATED

### Qué funcionó
- La coherencia de estilo con **un ancla como referencia** es alta: 3 héroes,
  enemigo, fondo y UI parecen del mismo juego.
- El **cambio de pose** (idle → ataque → golpe) estilo "freeze-frame" da
  peso sin animación cuadro a cuadro: 2 imágenes por personaje alcanzan.
- Phaser 3.90 cubre todo lo necesario (postFX, PointLight, partículas,
  cámara). En la RTX 5060 corre a ~175 fps; el costo real va a estar en
  móviles de gama baja → presupuesto de partículas/bloom configurable.
- Costo de arte del spike: ~17 imágenes ≈ 2–3 USD (tarifa pública de
  Gemini 3 Pro Image a 2K).

### Qué no funcionó / hay que cuidar
- La IA a veces **mete restos de la referencia** (cabeza extra, pies
  sueltos) o ignora la orientación → regenerar. Mitigado: el prompt prohíbe
  copiar la figura de la referencia y `process_art_b.js` descarta piezas
  sueltas y huecos de fondo cerrados. Igual hace falta **revisar a ojo** cada
  asset (≈1 de cada 4 se regenera).
- Las poses "editadas" a veces quedan casi iguales al reposo → pedir el
  cambio de pose de forma explícita ("de rodillas", "echado hacia atrás").
- El modelo Pro devuelve **JPEG** aunque se pida PNG → el generador ahora lo
  normaliza a PNG real.
- En vertical entran 3 héroes + 1 enemigo con superposición; con 4 héroes o
  varios enemigos hay que redistribuir (filas en profundidad).

### Sorpresas
- El viejo fallo de tipografía era la CSP del server bloqueando Google
  Fonts: empaquetar las fuentes lo resuelve y además sirve offline en la APK.

### Recomendación para la construcción real
- **No cambiar de motor (opción C descartada por ahora).** El salto de
  calidad vino del arte, la composición y los efectos, no del motor.
  Re-evaluar sólo si se necesita animación esquelética masiva (Spine tiene
  plugin oficial para Phaser) o 3D.
- Llevar esto a producción por fases: ver
  `docs/art-direction-b.md`.
