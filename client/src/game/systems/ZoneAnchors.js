/**
 * ZoneAnchors — "generación por zonas" para el piso del mundo top-down.
 *
 * En vez de una única imagen gigante (imposible de gestionar) o tiles
 * teselables perfectos (que la IA no sabe hacer), dividimos el mapa en una
 * grilla de ZONAS y anclamos a cada zona UNA imagen IA de terreno grimdark
 * elegida por su bioma dominante. El gameplay (edificios, NPCs, cultivos) se
 * dibuja ENCIMA. Esto mantiene coherencia visual en áreas grandes sin que el
 * juego sea una sola lámina inmanejable.
 *
 *   Anclas de fondo (depth 0.5) ── sobre los tiles planos base (depth 0),
 *   bajo las manchas de óxido/sangre (depth 1) y todo el gameplay (50+).
 *
 * El arte vive en client/public/assets/game/zones/zone_<familia>_<n>.png
 * (gitignoreado; gen_zones.sh lo produce, gen_placeholders el stand-in). Si la
 * textura no está cargada, la función no dibuja nada → fallback limpio al piso
 * de tiles actual.
 *
 * Familias de ancla por bioma (re-tematizado grimdark, IDs internos intactos):
 *   grass/forest → 'grass' (blight tóxico)   dirt/road → 'dirt' (ceniza/escombro)
 *   sand → 'sand' (polvo oxidado)   snow → 'snow' (ceniza helada)   ice → 'ice'
 */
import { BIOMES } from '../maps/IsoMapGenerator';

const ZONE_TILES = 8; // 8×8 tiles por zona → 4×4 zonas en el mapa 32×32

// bioma → familia de ancla + cuántas variantes hay para esa familia
const BIOME_TO_FAMILY = {
  [BIOMES.GRASS]:  'grass',
  [BIOMES.FOREST]: 'grass',
  [BIOMES.DIRT]:   'dirt',
  [BIOMES.ROAD]:   'dirt',
  [BIOMES.SAND]:   'sand',
  [BIOMES.SNOW]:   'snow',
  [BIOMES.ICE]:    'ice',
};
const FAMILY_VARIANTS = { grass: 2, dirt: 2, sand: 1, snow: 1, ice: 1 };

// Hash determinista pequeño (mismo mundo → misma disposición de anclas).
function hash(a, b, seed) {
  let h = (a * 73856093) ^ (b * 19349663) ^ (seed * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  return h;
}

/**
 * Construye el ancla de UNA zona (zx, zy). Extraído de drawZoneAnchors para
 * que ZoneStreamer pueda crear/destruir anclas por zona según la cámara.
 * Determinista: misma zona + mismo seed → misma familia/variante/flip.
 *
 * @param {Phaser.Scene} scene
 * @param {object} mapData — { terrain[y][x], width, height, seed }
 * @param {number} zx — columna de zona
 * @param {number} zy — fila de zona
 * @param {object} opts — { tileSize, depth }
 * @returns {Phaser.GameObjects.Image|null} sprite creado, o null si no hay arte
 */
export function buildZoneAnchor(scene, mapData, zx, zy, opts = {}) {
  const { terrain, width, height, seed = 42 } = mapData;
  const tileSize = opts.tileSize ?? 64;
  const depth = opts.depth ?? 0.5;

  const x0 = zx * ZONE_TILES;
  const y0 = zy * ZONE_TILES;
  const x1 = Math.min(x0 + ZONE_TILES, width);
  const y1 = Math.min(y0 + ZONE_TILES, height);
  if (x0 >= width || y0 >= height) return null;

  // Bioma dominante de la zona (voto por mayoría, agrupado por familia).
  const votes = {};
  let best = null, bestN = -1;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const fam = BIOME_TO_FAMILY[terrain[y]?.[x]] || 'dirt';
      votes[fam] = (votes[fam] || 0) + 1;
      if (votes[fam] > bestN) { bestN = votes[fam]; best = fam; }
    }
  }

  const nVar = FAMILY_VARIANTS[best] || 1;
  const h = hash(zx, zy, seed);
  const variant = h % nVar;
  const key = `zone_${best}_${variant}`;
  if (!scene.textures.exists(key)) return null; // sin arte → no dibuja (fallback)

  // Cobertura real (recorta la zona del borde para no pisar fuera del mapa).
  const w = (x1 - x0) * tileSize;
  const hgt = (y1 - y0) * tileSize;
  const img = scene.add.image(x0 * tileSize, y0 * tileSize, key)
    .setOrigin(0, 0)
    .setDisplaySize(w, hgt)
    // Oscurecer/atenuar el piso para que RETROCEDA: el terreno IA es muy
    // detallado y en el mismo rango de valor que los sprites, así que
    // edificios y personajes se fundían. Un tinte gris oscuro lo empuja al
    // fondo y hace que el gameplay resalte.
    // Tinte de piedra oscura y cálida: empuja el PISO hacia abajo en valor para
    // que los actores (edificios/héroes) resalten (Fase 0 del rework visual). El
    // arte de piso oscuro de Fase 1 permitirá suavizarlo aún más. (era 0x6b6b73)
    .setTint(0x4a443e)
    .setDepth(depth);

  // Voltear por zona rompe la repetición cuando el mismo bioma abarca
  // varias zonas contiguas (4 orientaciones × variantes de imagen).
  if ((h >> 3) & 1) img.setFlipX(true);
  if ((h >> 4) & 1) img.setFlipY(true);

  return img;
}

/**
 * Dibuja las anclas de terreno de TODAS las zonas sobre la escena top-down.
 * (Camino no-streameado; WorldScene ahora usa buildZoneAnchor vía ZoneStreamer.)
 * @param {Phaser.Scene} scene
 * @param {object} mapData — { terrain[y][x], width, height, seed }
 * @param {object} opts — { tileSize, depth }
 * @returns {Phaser.GameObjects.Image[]} sprites creados (para limpieza)
 */
export function drawZoneAnchors(scene, mapData, opts = {}) {
  const sprites = [];
  const zonesX = Math.ceil(mapData.width / ZONE_TILES);
  const zonesY = Math.ceil(mapData.height / ZONE_TILES);
  for (let zy = 0; zy < zonesY; zy++) {
    for (let zx = 0; zx < zonesX; zx++) {
      const img = buildZoneAnchor(scene, mapData, zx, zy, opts);
      if (img) sprites.push(img);
    }
  }
  return sprites;
}

export { ZONE_TILES };
