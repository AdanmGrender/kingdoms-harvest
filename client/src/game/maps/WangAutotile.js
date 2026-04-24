/**
 * Runtime Wang-tile baker.
 *
 * Kenney medieval-rts ships plain biome tiles but no transition tiles between
 * biomes, so grass-next-to-dirt renders as a hard seam. This module bakes
 * transition textures at scene boot by compositing two biome tiles with an
 * alpha gradient masked to one cardinal direction (N/E/S/W), plus a small
 * "diagonal corner" variant for L-shaped borders.
 *
 * Keys produced follow the pattern `wang_<base>_<edge>_<dir>` and are loaded
 * as Phaser canvas textures on the target scene. For 4 biome pairs × 4
 * directions, that's 16 new textures per pair — cheap at load, zero cost per
 * frame since each is a single pre-rendered image.
 *
 * Usage:
 *   1) In preload()/create(), after the base tileset PNGs are loaded:
 *        const wang = bakeWangTiles(scene);
 *   2) When drawing a tile, call `wang.resolve(x, y, terrain, width, height,
 *      tileVariants)` — returns a texture key that's either a plain tile
 *      (`iso_tile_N`) or a baked transition (`wang_…`).
 */

import { BIOMES, TILE_POOLS } from './IsoMapGenerator';

// Which biome pairs are worth transitioning. Pairs that never touch (SAND↔SNOW,
// SAND↔ICE) are filtered out by the generator's FORBIDDEN rule, so they're
// omitted here to keep the bake cheap.
const WANG_PAIRS = [
  [BIOMES.GRASS, BIOMES.DIRT],
  [BIOMES.GRASS, BIOMES.FOREST],
  [BIOMES.DIRT,  BIOMES.SAND],
  [BIOMES.DIRT,  BIOMES.SNOW],
  [BIOMES.DIRT,  BIOMES.ICE],
  [BIOMES.SNOW,  BIOMES.ICE],
];

// Kenney tiles are 64×64.
const TILE_PX = 64;

// How far the gradient travels into the tile (in pixels). Smaller = tighter
// seam, larger = softer blend. ~55% of tile width looks natural without
// eating too much of the base biome.
const BLEND_RADIUS = 36;

// Direction flags — bitmask order matches IsoMapGenerator.pickRoadTile().
export const DIR = { N: 0b0001, E: 0b0010, S: 0b0100, W: 0b1000 };

// For each direction, the gradient origin (where edge biome is opaque) and the
// per-pixel distance function that fades it out.
const DIR_GRADIENTS = {
  [DIR.N]: (x, y) => y,                              // top edge most opaque
  [DIR.E]: (x, y) => TILE_PX - 1 - x,                // right edge most opaque
  [DIR.S]: (x, y) => TILE_PX - 1 - y,                // bottom edge most opaque
  [DIR.W]: (x, y) => x,                              // left edge most opaque
};

/**
 * Bake a single transition texture. Composites `edgeKey` on top of `baseKey`
 * using a linear alpha mask that decays from the given direction's edge.
 */
function bakeOne(scene, baseKey, edgeKey, dir, outKey) {
  if (scene.textures.exists(outKey)) return outKey;
  const baseTex = scene.textures.get(baseKey);
  const edgeTex = scene.textures.get(edgeKey);
  if (!baseTex || baseTex.key === '__MISSING') return baseKey;
  if (!edgeTex || edgeTex.key === '__MISSING') return baseKey;

  const baseImg = baseTex.getSourceImage();
  const edgeImg = edgeTex.getSourceImage();
  if (!baseImg?.width || !edgeImg?.width) return baseKey;

  // Composite buffer
  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(baseImg, 0, 0, TILE_PX, TILE_PX);

  // Masked edge buffer — edge tile multiplied by a linear alpha ramp
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = TILE_PX;
  maskCanvas.height = TILE_PX;
  const mctx = maskCanvas.getContext('2d');
  mctx.drawImage(edgeImg, 0, 0, TILE_PX, TILE_PX);
  const img = mctx.getImageData(0, 0, TILE_PX, TILE_PX);
  const px = img.data;
  const gradient = DIR_GRADIENTS[dir];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const d = gradient(x, y);
      // Alpha = 1 at the edge, 0 at BLEND_RADIUS away, with a soft cos curve
      // so the midband is slightly less harsh than pure linear.
      let a;
      if (d <= 0) a = 1;
      else if (d >= BLEND_RADIUS) a = 0;
      else a = 0.5 * (1 + Math.cos((d / BLEND_RADIUS) * Math.PI));
      const i = (y * TILE_PX + x) * 4;
      px[i + 3] = Math.round(px[i + 3] * a);
    }
  }
  mctx.putImageData(img, 0, 0);
  ctx.drawImage(maskCanvas, 0, 0);

  scene.textures.addCanvas(outKey, canvas);
  return outKey;
}

/** Pick the primary tile ID for a biome (first entry in its TILE_POOLS list). */
function primaryTileId(biome) {
  const pool = TILE_POOLS[biome];
  return pool?.[0];
}

export function bakeWangTiles(scene) {
  // Index (baseBiome,edgeBiome,dir) → textureKey so resolve() is O(1).
  const index = new Map();

  for (const [a, b] of WANG_PAIRS) {
    const aId = primaryTileId(a);
    const bId = primaryTileId(b);
    if (aId == null || bId == null) continue;
    for (const dir of [DIR.N, DIR.E, DIR.S, DIR.W]) {
      const abKey = `wang_${a}_${b}_${dir}`;
      const baKey = `wang_${b}_${a}_${dir}`;
      bakeOne(scene, `iso_tile_${aId}`, `iso_tile_${bId}`, dir, abKey);
      bakeOne(scene, `iso_tile_${bId}`, `iso_tile_${aId}`, dir, baKey);
      index.set(`${a}|${b}|${dir}`, abKey);
      index.set(`${b}|${a}|${dir}`, baKey);
    }
  }

  /**
   * Resolve a texture key for a single tile based on its neighbors. Returns
   * the plain tile variant if all 4 cardinals match this tile's biome, else a
   * baked wang texture pointing toward the first differing neighbor (cardinal
   * priority: N > E > S > W — arbitrary but stable).
   */
  function resolve(x, y, terrain, width, height, tileVariants) {
    const selfBiome = terrain[y][x];
    // Roads have their own dedicated connector logic elsewhere, leave as-is
    if (selfBiome === BIOMES.ROAD) return `iso_tile_${tileVariants[y][x]}`;

    const neighbor = (dx, dy) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return selfBiome;
      const b = terrain[ny][nx];
      // Treat FOREST as GRASS for wang purposes — same base tile, no visible seam
      return b === BIOMES.FOREST ? BIOMES.GRASS : b;
    };

    const self = selfBiome === BIOMES.FOREST ? BIOMES.GRASS : selfBiome;

    // Check cardinals in fixed priority so adjacent tiles converge on the
    // same look (otherwise we'd get seams moving frame to frame if we ever
    // re-rolled tiles).
    const cardinals = [
      { dir: DIR.N, biome: neighbor(0, -1) },
      { dir: DIR.E, biome: neighbor(1,  0) },
      { dir: DIR.S, biome: neighbor(0,  1) },
      { dir: DIR.W, biome: neighbor(-1, 0) },
    ];
    for (const { dir, biome } of cardinals) {
      if (biome !== self) {
        const key = index.get(`${self}|${biome}|${dir}`);
        if (key) return key;
      }
    }
    return `iso_tile_${tileVariants[y][x]}`;
  }

  return { resolve };
}
