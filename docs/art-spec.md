# Kingdoms Harvest — Art Specification

> Brief para el artista. Todo lo que se entregue en las rutas indicadas
> reemplaza automáticamente el placeholder y funciona en el juego.

---

## 1. Contexto del juego

Medieval farming + RTS. Vista cenital (top-down) o isométrica (ver §8).
Mobile-first (Telegram Mini App), pantalla ~390×844px.
Arte cargado en Phaser 3 con `pixelArt: true` — **no anti-aliasing**, píxeles nítidos.

---

## 2. Estilo visual

| Atributo | Spec |
|----------|------|
| Estilo | Pixel art, paleta limitada (~32 colores por asset) |
| Paleta general | Tierras oscuras medievales — marrones, verdes oscuros, grises piedra, dorado apagado |
| Iluminación | Fuente fija arriba-izquierda; sombras proyectadas hacia abajo-derecha |
| Contorno | 1px dark outline (color oscuro del tono base, no negro puro) |
| Escala en juego | 2–3× zoom mínimo — no se necesitan detalles sub-4px |

Referencias de mood: Age of Empires II, Stardew Valley (paleta más oscura), Clash of Clans.

---

## 3. Convención de entrega

```
client/public/assets/game/
├── tilesets/
│   ├── terrain.png        ← tileset de suelo
│   ├── farm_tiles.png     ← estados de parcela agrícola
│   └── buildings.png      ← spritesheet de edificios
├── characters/
│   ├── npc_farmer.png
│   ├── npc_baker.png
│   ├── npc_princess.png
│   ├── npc_wizard.png
│   ├── npc_knight.png
│   ├── npc_merchant.png
│   ├── npc_ranger.png
│   ├── troops.png
│   └── villager.png
├── animals/
│   ├── chicken.png
│   ├── cow.png
│   └── sheep.png
├── effects/
│   └── effects.png
├── ui/
│   └── dialog_frame.png
└── iso/                   ← solo si se elige modo isométrico (ver §8)
    ├── iso_terrain.png
    └── iso_objects.png
```

- Formato: **PNG-24** con transparencia (canal alpha)
- Color mode: RGB + Alpha
- Sin capas Photoshop — PNG plano final
- Fondo: transparente (excepto tilesets de suelo que no lo necesitan)

---

## 4. Tilesets de suelo

### `tilesets/terrain.png` — 512×512 px

Tileset top-down, **16 tiles por fila × 16 filas = 256 tiles**.
Cada tile: **32×32 px**.

Tiles requeridos (mínimo viable — el resto puede ser variante o vacío):

| Índice | Descripción | Notas |
|--------|-------------|-------|
| 0  | Hierba 1 (base) | tile más común, suelo verde oscuro |
| 1  | Hierba 2 (variante) | leve diferencia textural |
| 2  | Tierra suelta | caminos y zonas sin vegetación |
| 3  | Tierra clara | para aclarar zonas o caminos secos |
| 4  | Agua | lago/río, puede ser animado (4 frames seguidos en fila) |
| 5  | Arena/grava | orillas |
| 6  | Piedra/adoquín | patio de castillo |
| 7  | Pasto con flor roja | decorativo |
| 8  | Pasto con flor azul | decorativo |
| 9  | Valla horizontal | borde de granja |
| 10 | Valla vertical | |
| 11 | Árbol (tile único) | árbol de mapa, no entidad |
| 12 | Roca decorativa | |
| 13 | Puente | sobre agua |
| 14 | Borde hierba-tierra | transición suave |
| 15 | Esquina de valla | |

Los tiles de índice 16+ pueden ser variantes adicionales o vacíos (#00000000).

### `tilesets/farm_tiles.png` — 256×256 px

Parcela agrícola en 8 estados visuales. Cada tile: **64×64 px**.
Organización: **4 columnas × 4 filas**.

| Col | Row | Estado |
|-----|-----|--------|
| 0 | 0 | Parcela vacía, seco |
| 1 | 0 | Parcela vacía, regada (tierra más oscura) |
| 2 | 0 | Semilla plantada, seco |
| 3 | 0 | Semilla plantada, regada |
| 0 | 1 | Crecimiento 50%, seco |
| 1 | 1 | Crecimiento 50%, regada |
| 2 | 1 | Listo para cosechar, seco |
| 3 | 1 | Listo para cosechar, regada (brillante) |

Los tiles de fila 2–3 pueden ser variantes adicionales o vacíos.

---

## 5. Edificios

### `tilesets/buildings.png` — 512×512 px

Spritesheet de **16 edificios**, 4 columnas × 4 filas.
Cada frame: **128×128 px**.

El edificio debe estar centrado horizontalmente y con la base en `y ≈ 108px`
(los últimos 20px son reserva transparente para sombra/base).

Perspectiva: ligeramente elevada (≈30°), no isométrica pura —
similar a Clash of Clans o Stardew Valley.

| Frame | ID | Nombre | Descripción |
|-------|-----|--------|-------------|
| 0  | barn | Granero | Edificio de madera grande, techo rojo |
| 1  | mill | Molino | Torre con aspas, piedra gris |
| 2  | wall | Muralla | Sección de muro de piedra con almenas |
| 3  | tower | Torre | Torre cilíndrica o cuadrada, 2 pisos |
| 4  | barracks | Cuartel | Edificio militar, bandera |
| 5  | tavern | Taberna | Posada con cartel colgante |
| 6  | market | Mercado | Puesto con toldos coloridos |
| 7  | throne_room | Salón del trono | Edificio noble, más ornamentado |
| 8  | library | Biblioteca | Torre con libros visibles, ventanas arco |
| 9  | stable | Establo | Cobertizo largo de madera |
| 10 | smithy | Herrería | Chimenea, yunque visible |
| 11 | sawmill | Aserradero | Sierra circular, vigas de madera |
| 12 | trap | Trampas | Pinchos o trampa metálica en suelo |
| 13 | embassy | Embajada | Más ornamentado, columnas |
| 14 | farm_plot | Parcela | Frame de la parcela activa (edificio básico) |
| 15 | mine | Mina | Entrada de mina con vigas de soporte |

---

## 6. Personajes

Todos los personajes: **2 frames de animación idle** (postura A y postura B, ciclo de 2fps).
Formato: spritesheet horizontal, los frames van de izquierda a derecha.

### NPCs (7 archivos separados)

Cada archivo: **64×48 px total** — 2 frames de **32×48 px** cada uno.

| Archivo | Personaje | Descripción visual |
|---------|-----------|-------------------|
| `npc_farmer.png` | Aldeano campesino | Ropa de labranza, paja en mano |
| `npc_baker.png` | Panadera | Delantal blanco, cesta de pan |
| `npc_princess.png` | Princesa | Vestido elegante, corona pequeña |
| `npc_wizard.png` | Mago | Túnica, sombrero puntiagudo, bastón |
| `npc_knight.png` | Caballero | Armadura completa, espada |
| `npc_merchant.png` | Comerciante | Ropa de viaje, bolsas de monedas |
| `npc_ranger.png` | Explorador | Capa verde, arco al hombro |

### Tropas

`characters/troops.png` — **320×96 px** total.
5 columnas × 2 filas. Cada frame: **32×48 px**.
Columna = tipo de tropa; Fila 0 = frame A, Fila 1 = frame B.

| Col | Tropa | Descripción |
|-----|-------|-------------|
| 0 | Milicia | Campesino con lanza improvisada |
| 1 | Arquero | Arco y carcaj, ropa de cuero |
| 2 | Caballería | A pie con armadura media y espada |
| 3 | Lancero | Lanza larga, escudo redondo |
| 4 | Ariete (ingenio) | Operador de catapulta/ariete |

### Aldeanos

`characters/villager.png` — **128×48 px** total.
4 frames de **32×48 px**.

| Frame | Estado |
|-------|--------|
| 0 | Idle postura A |
| 1 | Idle postura B |
| 2 | Caminando paso A |
| 3 | Caminando paso B |

Aspecto neutro/genérico, ropa de labranza simple.

---

## 7. Animales

Cada animal: **128×32 px** total — 4 frames de **32×32 px**.

| Frame | Estado |
|-------|--------|
| 0 | Idle A |
| 1 | Idle B |
| 2 | Caminando A |
| 3 | Caminando B |

| Archivo | Animal |
|---------|--------|
| `animals/chicken.png` | Gallina — blanca o colorida, cresta roja |
| `animals/cow.png` | Vaca — manchas blancas/negras, tamaño proporcional |
| `animals/sheep.png` | Oveja — lana blanca/gris, cara negra |

---

## 8. Efectos

`effects/effects.png` — **128×16 px** — 8 frames de **16×16 px**.

| Frame | Efecto |
|-------|--------|
| 0 | Humo (nube gris pequeña) |
| 1 | Polvo (nubarron marrón) |
| 2 | Chispa (destello amarillo) |
| 3 | Token ganado (estrella dorada) |
| 4 | Gota de agua (riego) |
| 5 | Corazón (aldeano feliz) |
| 6 | Espada mini (combate) |
| 7 | Exclamación (!) |

---

## 9. UI de Phaser

`ui/dialog_frame.png` — **256×128 px**

Marco de diálogo de 9-slices. Diseño medieval: bordes con tachones o madera.
La zona interior (aprox. 232×104px centered) es semitransparente oscura.

---

## 10. Modo Isométrico (opcional — decide después de probar)

Si se decide implementar el modo isométrico, se necesitan:

### `iso/iso_terrain.png` — 448×32 px

7 tiles isométricos en fila. Cada tile: **64×32 px** (diamante 2:1).
El tile debe llenar el diamante exacto — fuera del diamante: transparente.

| Frame | Tipo |
|-------|------|
| 0 | Hierba oscura (bosque) |
| 1 | Hierba |
| 2 | Pradera clara |
| 3 | Tierra / camino |
| 4 | Piedra / adoquín |
| 5 | Agua |
| 6 | Arena |

Borde superior (2 lados que suben al vértice superior): 1px más claro.
Borde inferior (2 lados que bajan al vértice inferior): 1px más oscuro.

### `iso/iso_objects.png` — 256×96 px

4 objetos decorativos en fila. Cada frame: **64×96 px**.
Anchor del objeto: centro-base del frame (0.5, 1.0).

| Frame | Objeto |
|-------|--------|
| 0 | Pino / árbol conífero |
| 1 | Árbol desnudo (invierno) |
| 2 | Roca/peñasco |
| 3 | Arbusto con bayas |

### Edificios isométricos

Si se elige modo iso, los edificios necesitan redibujarse en perspectiva
isométrica real (2:1, luz desde arriba-izquierda, cara izquierda media,
cara derecha oscura). El spritesheet podría ser el mismo **128×160 px**
por frame con anchor en (0.5, 1.0).

---

## 11. Prioridad de entrega

| Prioridad | Assets | Impacto |
|-----------|--------|---------|
| 🔴 Alta | `terrain.png`, `buildings.png`, `farm_tiles.png` | El mapa y la mecánica principal |
| 🟠 Media | `npc_*.png`, `villager.png`, `animals/*.png` | NPCs y misiones visibles |
| 🟡 Normal | `troops.png`, `effects.png` | Combate y partículas |
| 🟢 Baja | `ui/dialog_frame.png`, modo iso | Pulido final |

---

## 12. Cómo probar sin configurar el entorno

```bash
# Instalar dependencias (desde raíz del repo)
npm install

# Regenerar placeholders (si se borran accidentalmente)
node scripts/gen_placeholders.js

# Correr cliente en desarrollo
cd client && npm run dev
# Abrir http://localhost:5173 con ?skip_auth=1
```

Los placeholders son rectángulos de color sólido con borde oscuro.
Al reemplazar cualquier PNG con el arte real, el juego lo carga inmediatamente
en la próxima recarga (Vite hot-reload).
