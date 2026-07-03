# Arquitectura Iso Pixel-Art — Guía de configuración (Fase de Arte)

> **Motor real de este proyecto: Phaser 3.90 + React (Telegram Mini App).**
> Esta guía responde las 4 preguntas de arquitectura (tilemap iso, sprites 8-dir,
> capas de UI, pixel-perfect) sobre el stack existente. Al final hay una tabla de
> equivalencias Unity/Godot por si el proyecto migrara algún día — pero la
> recomendación es NO migrar: el juego ya corre, con 228 tests verdes.

---

## 1. Sistema de Tilemap isométrico

### Decisión: rejilla 2:1 custom sobre RenderTexture (ya implementada en IsoWorldScene)

No usamos el Tilemap nativo de Phaser en modo isométrico: para un mapa estático
de gestión es más barato **hornear todo el suelo en un solo RenderTexture** al
crear la escena (1 draw call) y reservar sprites individuales solo para lo que
vive/cambia (edificios, personajes, decoración).

```text
Tile diamante:   64×32 px (ratio 2:1)
Rejilla:         32×32 tiles → mundo ~2048×1024 px
Origen:          ORIGIN_X = COLS·32, ORIGIN_Y = 80
```

**Matemática de coordenadas** (ya en `IsoWorldScene.js`):

```js
// Rejilla → pantalla (vértice superior del diamante)
isoToScreen(col, row) = {
  x: ORIGIN_X + (col - row) * 32,   // ISO_W/2
  y: ORIGIN_Y + (col + row) * 16,   // ISO_H/2
}

// Pantalla → rejilla (para detectar taps)
screenToIso(wx, wy) = {
  col: floor((rx/32 + ry/16) / 2),
  row: floor((ry/16 - rx/32) / 2),
}   // rx = wx - ORIGIN_X, ry = wy - ORIGIN_Y
```

### Profundidad visual (depth sorting)

Regla única y barata — **nunca** ordenar arrays a mano por frame:

```js
sprite.setDepth(col + row + offset);
// suelo (RenderTexture):  depth = -1  (una sola vez)
// decoración (árbol, roca): offset +0.2, setOrigin(0.5, 1.0)  → pie en el tile
// edificios:                offset +0.6, setOrigin(0.5, 0.88)
// personajes:               offset +0.4, recalcular depth SOLO al cambiar de tile
```

Edificios multi-tile: la profundidad se calcula con el **tile-pie** (el de mayor
`col+row` de su huella), no con el centro.

---

## 2. Gestión de sprites de personajes en 8 direcciones

### Layout de spritesheet (contrato con el artista)

Truco espejo: el artista dibuja **5 direcciones** y el motor voltea (`flipX`)
para las 3 del lado oeste → 37% menos arte.

```text
personaje_<estado>.png  — filas = dirección, columnas = frames
  fila 0: S    (frente)
  fila 1: SE   (→ SW por espejo)
  fila 2: E    (→ W  por espejo)
  fila 3: NE   (→ NW por espejo)
  fila 4: N    (espalda)
Frames por fila: idle = 2-4, walk = 4-6, shoot = 3-4 (one-shot), work = 4
Tamaño frame:    32×48 px (o 48×64 si el detalle lo pide — ver paleta grimdark
                 en docs/art-style.md, dirección elegida 2026-07-03)
```

Estados one-shot (`shoot`): registrar con `repeat: 0` y disparar con
`DirectionalAnimator.playOnce('shoot', onComplete)` — congela dirección y FSM
mientras dura, y el callback spawnea el proyectil/tracer al terminar.

### FSM recomendada: estado × dirección-como-parámetro

La dirección NO es un estado: es un **parámetro** del estado. Estados = `idle`,
`walk` (después: `work`, `carry`). Clave de animación = `${estado}_${dirIndex}`.

```text
        entrada táctil / pathfinding
                 │ velocidad (vx, vy)
                 ▼
     ┌────────── FSM ──────────┐
     │  idle  ⇄  walk          │   transición: |v| > 0 ⇄ |v| == 0
     └──────────┬──────────────┘
                │ dir = cuantizar(atan2(vy, vx) → 8 sectores de 45°)
                ▼
     sprite.play(`${estado}_${DIR[dir].row}`, true)
     sprite.setFlipX(DIR[dir].flip)
```

**Anti-parpadeo (histéresis):** en los bordes entre sectores la dirección
oscila. Solo cambiar de dirección si la nueva persiste ~100 ms **o** el ángulo
supera el límite del sector + margen de 10°.

### Pseudocódigo del sistema de movimiento

```js
const DIRS = [               // 8 sectores de 45°, empezando en E, antihorario
  { key: 'E',  row: 2, flip: false }, { key: 'NE', row: 3, flip: false },
  { key: 'N',  row: 4, flip: false }, { key: 'NW', row: 3, flip: true  },
  { key: 'W',  row: 2, flip: true  }, { key: 'SW', row: 1, flip: true  },
  { key: 'S',  row: 0, flip: false }, { key: 'SE', row: 1, flip: false },
];

class CharacterMover {
  update(dt) {
    const v = this.velocidadDeseada();            // input táctil o path A*

    // 1. FSM de estado
    const estado = (v.length() > UMBRAL) ? 'walk' : 'idle';

    // 2. Dirección cuantizada con histéresis
    if (estado === 'walk') {
      const ang = Math.atan2(-v.y, v.x);          // Y invertida en pantalla
      const sector = Math.round(ang / (Math.PI / 4)) & 7;
      if (sector !== this.dir) {
        this.dirTimer += dt;
        if (this.dirTimer > 100) { this.dir = sector; this.dirTimer = 0; }
      } else this.dirTimer = 0;
    }

    // 3. Aplicar animación (idempotente — Phaser ignora si ya suena)
    const d = DIRS[this.dir];
    this.sprite.play(`${this.pj}_${estado}_${d.row}`, true);
    this.sprite.setFlipX(d.flip);

    // 4. Mover en ESPACIO ISO, no en pantalla: convertir v de rejilla a pantalla
    const dx = (v.col - v.row) * 32 * dt, dy = (v.col + v.row) * 16 * dt;
    this.sprite.x += dx; this.sprite.y += dy;

    // 5. Depth solo al cambiar de tile (barato)
    const t = screenToIso(this.sprite.x, this.sprite.y);
    if (t.col !== this.tile.col || t.row !== this.tile.row) {
      this.tile = t;
      this.sprite.setDepth(t.col + t.row + 0.4);
    }
  }
}
```

Registrar animaciones una sola vez en `BootScene.create()`:

```js
for (const estado of ['idle', 'walk'])
  for (let row = 0; row <= 4; row++)
    this.anims.create({
      key: `${pj}_${estado}_${row}`,
      frames: this.anims.generateFrameNumbers(pj, { start: row*FPF, end: row*FPF + n }),
      frameRate: estado === 'walk' ? 8 : 3,
      repeat: -1,
    });
```

---

## 3. Integración de UI (capas / sorting)

Este proyecto tiene **tres pisos** que nunca se mezclan — más simple y robusto
que sorting layers dentro de un solo mundo:

```text
Piso 3 — React DOM (GameHUD, paneles, botones)     ← SIEMPRE encima del canvas
Piso 2 — Objetos flotantes de mundo en Phaser       depth ≥ 10000
         (texto "+2 KH", burbujas de NPC, barras HP)
Piso 1 — Mundo isométrico                           depth = col + row (< ~1000)
         suelo RenderTexture                        depth = -1
```

Reglas:

1. **Todo lo que es interfaz pura va en React** (piso 3). El canvas de Phaser
   está debajo del DOM; los paneles jamás pueden "meterse" entre dos edificios.
   Comunicación vía `EventBridge` (§9 de CLAUDE.md), nunca imports cruzados.
2. **Flotantes anclados al mundo** (siguen a un edificio al pan/zoom) sí viven
   en Phaser: `depth = 10000 + y` para que floaters entre sí ordenen bien pero
   siempre tapen al mundo. Como el mundo nunca pasa de `col+row ≈ 65`, hay un
   océano de margen.
3. Si los flotantes crecen (muchos tipos), extraerlos a una **UIScene paralela**
   (`this.scene.launch('UIScene')`) con cámara propia `scrollFactor 0` — así el
   zoom del mundo no re-escala la UI in-game.

---

## 4. Renderizado pixel-perfect en móvil

Configuración (parcialmente ya activa en `client/src/game/config.js`):

```js
{
  pixelArt: true,          // filtro NEAREST en todas las texturas ✅ ya activo
  roundPixels: true,       // posiciones enteras al dibujar        ✅ ya activo
  antialias: false,        //                                      ✅ ya activo
  scale: { mode: Phaser.Scale.RESIZE, autoCenter: CENTER_BOTH },
}
```

Lo que falta para que NO se vea borroso al escalar en teléfonos:

1. **Zoom solo en escalones enteros** (1×, 2×, 3× — y 1.5× como máximo
   compromiso). El pellizco libre produce shimmering: en `CameraSystem`,
   al terminar el gesto, hacer snap del zoom al escalón más cercano.
2. **DPR consciente**: los WebView de Telegram corren a devicePixelRatio 2–3.
   Con `Scale.RESIZE` Phaser ya usa el tamaño CSS; elegir el zoom base como
   `Math.max(1, Math.round(window.devicePixelRatio))` para que 1 píxel de arte
   caiga en N píxeles físicos exactos.
3. **Nada de posiciones fraccionarias** en objetos estáticos: `Math.round()` al
   colocar edificios/decoración (los que se mueven ya los redondea roundPixels).
4. El texto de UI va en React/DOM (piso 3), que escala con subpíxeles sin
   ensuciar el arte — otra ventaja de los tres pisos.

---

## 5. Estructura de carpetas para la fase de arte

```text
client/public/assets/game/            ← TODO gitignoreado; placeholders vía
  tilesets/                              node scripts/gen_placeholders.js
    terrain.png farm_tiles.png buildings.png     (formato actual top-down)
  iso/
    iso_terrain.png                    ← diamantes 64×32 (7 tipos → crecer aquí)
    iso_objects.png                    ← decoración 64×96, pie abajo-centro
    buildings/<id>.png                 ← NUEVO: 1 archivo/edificio 128×128,
                                          ancla pie (0.5, 0.88), sombra incluida
    chars/<pj>_<estado>.png            ← NUEVO: sheets 8-dir (layout §2)
  characters/ animals/ effects/ ui/    (formato actual, ver docs/art-spec.md)
client/src/game/
  scenes/IsoWorldScene.js              ← escena iso (flag ISO_MODE en config.js)
  systems/                             ← aquí vivirá CharacterMover (§2)
  config/buildingSprites.js            ← mapeo edificio→sprite (ya existe)
```

Pipeline artista → juego: el artista entrega un PNG con el path/tamaño exacto
del spec → se copia encima del placeholder → recarga y listo. Cero código.

---

## 6. Tabla de equivalencias (si algún día se migra)

| Concepto | Phaser (este repo) | Unity | Godot 4 |
|----------|--------------------|-------|---------|
| Tilemap iso | RenderTexture + math 2:1 custom | Grid → Tilemap *Isometric Z as Y* | TileMap `tile_shape = Isometric` |
| Depth sort | `depth = col + row + offset` | Transparency Sort Axis (0,1,0) + Sorting Groups | `y_sort_enabled = true` |
| 8-dir FSM | anims key `estado_dir` + flipX | Animator con Blend Tree 2D direccional | AnimationTree + BlendSpace2D |
| UI overlay | React DOM sobre canvas + EventBridge | Canvas Screen-Space Overlay | CanvasLayer |
| Pixel perfect | `pixelArt + roundPixels` + zoom entero | Pixel Perfect Camera (URP) + PPU | Stretch `canvas_items` + snap 2D |

---

## 7. Checklist de arranque de la fase de arte

- [ ] Recibir imagen de referencia de estilo (no llegó al chat) y fijar paleta
- [ ] Decidir vista definitiva: top-down (WorldScene) vs iso (IsoWorldScene) — criterios en docs/art-style.md
- [ ] Congelar specs de tamaños con el artista (docs/art-spec.md + §2 y §5 de esta guía)
- [ ] Primer paquete del artista: 7 tiles de terreno + 3 edificios clave (throne_room, farm_plot, barn)
- [ ] Implementar CharacterMover 8-dir cuando llegue el primer sheet de personaje
- [ ] `assets/sprites/` (6.5MB UI, aún en git): decidir si el artista rehace las hojas de UI — es el último arte viejo vivo
