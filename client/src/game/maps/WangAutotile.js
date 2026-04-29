/**
 * Runtime Wang-tile baker.
 *
 * Kenney medieval-rts ships plain biome tiles but no transition tiles between
 * biomes, so grass-next-to-dirt renders as a hard seam. This module bakes
 * transition textures at scene boot by compositing two biome tiles with an
 * alpha gradient masked to one cardinal direction (N/E/S/W) or one diagonal
 * corner (NE/NW/SE/SW) for L-shaped borders where two cardinals share the
 * same different biome.
 *
 * Keys produced follow the pattern `wang_<base>_<edge>_<dir>` and are loaded
 * as Phaser canvas textures on the target scene. For each biome pair we now
 * bake 8 directional variants (4 cardinals + 4 corners) × 2 ordering = 16
 * textures per pair. Still cheap at load, zero cost per frame.
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

// Direction flags. Cardinals are bitmask-compatible with road connectors;
// corners are unique values above the cardinal range.
export const DIR = {
  N: 0b0001, E: 0b0010, S: 0b0100, W: 0b1000,
  NE: 0b10001, SE: 0b10010, SW: 0b10100, NW: 0b11000,
};

const CARDINAL_DIRS = [DIR.N, DIR.E, DIR.S, DIR.W];
const CORNER_DIRS = [DIR.NE, DIR.SE, DIR.SW, DIR.NW];

// For each direction, the per-pixel distance from the "opaque side". Cardinals
// fade from one edge inward; corners fade radially from one corner outward.
const DIR_GRADIENTS = {
  [DIR.N]: (x, y) => y,                              // top edge most opaque
  [DIR.E]: (x, y) => TILE_PX - 1 - x,                // right edge most opaque
  [DIR.S]: (x, y) => TILE_PX - 1 - y,                // bottom edge most opaque
  [DIR.W]: (x, y) => x,                              // left edge most opaque
  // Corners: Euclidean distance from the named corner pixel.
  [DIR.NE]: (x, y) => Math.hypot((TILE_PX - 1) - x, y),
  [DIR.SE]: (x, y) => Math.hypot((TILE_PX - 1) - x, (TILE_PX - 1) - y),
  [DIR.SW]: (x, y) => Math.hypot(x, (TILE_PX - 1) - y),
  [DIR.NW]: (x, y) => Math.hypot(x, y),
};

/** Mutate `imageData` in place: multiply each pixel's alpha by the cosine
 *  mask for the given direction. Shared by single-edge and multi-edge bake. */
function applyDirMask(imageData, dir) {
  const px = imageData.data;
  const gradient = DIR_GRADIENTS[dir];
  for (let y = 0; y < TILE_PX; y++) {
    for (let x = 0; x < TILE_PX; x++) {
      const d = gradient(x, y);
      let a;
      if (d <= 0) a = 1;
      else if (d >= BLEND_RADIUS) a = 0;
      else a = 0.5 * (1 + Math.cos((d / BLEND_RADIUS) * Math.PI));
      const i = (y * TILE_PX + x) * 4;
      px[i + 3] = Math.round(px[i + 3] * a);
    }
  }
}

/** Helper: load a texture's source image by key, or return null. */
function getSourceImage(scene, key) {
  const tex = scene.textures.get(key);
  if (!tex || tex.key === '__MISSING') return null;
  const img = tex.getSourceImage();
  return img?.width ? img : null;
}

/**
 * Bake a single transition texture. Composites `edgeKey` on top of `baseKey`
 * using a cosine-curve alpha mask anchored to the given direction.
 */
function bakeOne(scene, baseKey, edgeKey, dir, outKey) {
  if (scene.textures.exists(outKey)) return outKey;
  const baseImg = getSourceImage(scene, baseKey);
  const edgeImg = getSourceImage(scene, edgeKey);
  if (!baseImg || !edgeImg) return baseKey;

  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(baseImg, 0, 0, TILE_PX, TILE_PX);

  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = TILE_PX;
  maskCanvas.height = TILE_PX;
  const mctx = maskCanvas.getContext('2d');
  mctx.drawImage(edgeImg, 0, 0, TILE_PX, TILE_PX);
  const img = mctx.getImageData(0, 0, TILE_PX, TILE_PX);
  applyDirMask(img, dir);
  mctx.putImageData(img, 0, 0);
  ctx.drawImage(maskCanvas, 0, 0);

  scene.textures.addCanvas(outKey, canvas);
  return outKey;
}

/**
 * Bake a multi-edge T-junction texture — base biome with several different
 * neighbor biomes bleeding in from their respective directions. Lazy: called
 * by resolve() the first time a unique 4-cardinal signature is seen.
 *
 * `edges` is an array of `{ key, dir }`. Each is layered onto the base in
 * input order. Order is irrelevant for correctness (alpha is per-mask and
 * masks don't overlap aggressively in the corners) but kept stable so the
 * cache key uniquely identifies the bake.
 */
function bakeMulti(scene, baseKey, edges, outKey) {
  if (scene.textures.exists(outKey)) return outKey;
  const baseImg = getSourceImage(scene, baseKey);
  if (!baseImg) return baseKey;

  const canvas = document.createElement('canvas');
  canvas.width = TILE_PX;
  canvas.height = TILE_PX;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(baseImg, 0, 0, TILE_PX, TILE_PX);

  for (const { key: edgeKey, dir } of edges) {
    const edgeImg = getSourceImage(scene, edgeKey);
    if (!edgeImg) continue;
    const maskCanvas = document.createElement('canvas');
    maskCanvas.width = TILE_PX;
    maskCanvas.height = TILE_PX;
    const mctx = maskCanvas.getContext('2d');
    mctx.drawImage(edgeImg, 0, 0, TILE_PX, TILE_PX);
    const img = mctx.getImageData(0, 0, TILE_PX, TILE_PX);
    applyDirMask(img, dir);
    mctx.putImageData(img, 0, 0);
    ctx.drawImage(maskCanvas, 0, 0);
  }

  scene.textures.addCanvas(outKey, canvas);
  return outKey;
}

/** Pick the primary tile ID for a biome (first entry in its TILE_POOLS list). */
function primaryTileId(biome) {
  const pool = TILE_POOLS[biome];
  return pool?.[0];
}

// Each L-shape corner is keyed off a pair of adjacent cardinal directions
// that share the same differing biome. Order matters in resolve() — we
// check corners *before* cardinals so a true L picks the radial blend.
const CORNER_PAIRS = [
  { dirs: [DIR.N, DIR.E], cornerDir: DIR.NE },
  { dirs: [DIR.N, DIR.W], cornerDir: DIR.NW },
  { dirs: [DIR.S, DIR.E], cornerDir: DIR.SE },
  { dirs: [DIR.S, DIR.W], cornerDir: DIR.SW },
];

export function bakeWangTiles(scene) {
  const index = new Map();
  const ALL_DIRS = [...CARDINAL_DIRS, ...CORNER_DIRS];

  for (const [a, b] of WANG_PAIRS) {
    const aId = primaryTileId(a);
    const bId = primaryTileId(b);
    if (aId == null || bId == null) continue;
    for (const dir of ALL_DIRS) {
      const abKey = `wang_${a}_${b}_${dir}`;
      const baKey = `wang_${b}_${a}_${dir}`;
      bakeOne(scene, `iso_tile_${aId}`, `iso_tile_${bId}`, dir, abKey);
      bakeOne(scene, `iso_tile_${bId}`, `iso_tile_${aId}`, dir, baKey);
      index.set(`${a}|${b}|${dir}`, abKey);
      index.set(`${b}|${a}|${dir}`, baKey);
    }
  }

  /**
   * Resolve a texture key for a single tile based on its neighbors.
   *
   * Resolution priority:
   *   1. ROAD biome → plain tile (roads use their own connector system)
   *   2. T-junction (≥2 distinct neighbor biomes) → lazy multi-edge bake
   *   3. Two adjacent cardinals share the same differing biome → corner blend
   *   4. Any single cardinal differs → cardinal blend (priority N > E > S > W)
   *   5. All cardinals match self → plain tile variant
   */
  function resolve(x, y, terrain, width, height, tileVariants) {
    const selfBiome = terrain[y][x];
    if (selfBiome === BIOMES.ROAD) return `iso_tile_${tileVariants[y][x]}`;

    const neighbor = (dx, dy) => {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) return selfBiome;
      const b = terrain[ny][nx];
      // Treat FOREST as GRASS for wang purposes — same base tile, no visible seam
      return b === BIOMES.FOREST ? BIOMES.GRASS : b;
    };

    const self = selfBiome === BIOMES.FOREST ? BIOMES.GRASS : selfBiome;

    const cardinalBiome = {
      [DIR.N]: neighbor(0, -1),
      [DIR.E]: neighbor(1,  0),
      [DIR.S]: neighbor(0,  1),
      [DIR.W]: neighbor(-1, 0),
    };

    // Count distinct neighbor biomes that differ from self
    const diffByDir = CARDINAL_DIRS
      .map((d) => ({ dir: d, biome: cardinalBiome[d] }))
      .filter((c) => c.biome !== self);
    const distinctNeighbors = new Set(diffByDir.map((c) => c.biome));

    // 1) T-junction pass — 2+ distinct neighbor biomes. Composite each edge
    //    on the self base lazily; cache by full 4-cardinal signature.
    if (distinctNeighbors.size >= 2) {
      const sig = `T|${self}|${cardinalBiome[DIR.N]}|${cardinalBiome[DIR.E]}|${cardinalBiome[DIR.S]}|${cardinalBiome[DIR.W]}`;
      let key = index.get(sig);
      if (!key) {
        const baseId = primaryTileId(self);
        if (baseId != null) {
          const edges = diffByDir
            .map((c) => {
              const id = primaryTileId(c.biome);
              return id != null ? { key: `iso_tile_${id}`, dir: c.dir } : null;
            })
            .filter(Boolean);
          if (edges.length > 0) {
            key = bakeMulti(scene, `iso_tile_${baseId}`, edges, sig);
            index.set(sig, key);
          }
        }
      }
      if (key) return key;
    }

    // 2) Corner pass — single neighbor biome shared across 2 adjacent cardinals
    for (const pair of CORNER_PAIRS) {
      const b1 = cardinalBiome[pair.dirs[0]];
      const b2 = cardinalBiome[pair.dirs[1]];
      if (b1 !== self && b1 === b2) {
        const key = index.get(`${self}|${b1}|${pair.cornerDir}`);
        if (key) return key;
      }
    }

    // 3) Cardinal pass — N > E > S > W, first differing neighbor wins
    for (const dir of CARDINAL_DIRS) {
      const b = cardinalBiome[dir];
      if (b !== self) {
        const key = index.get(`${self}|${b}|${dir}`);
        if (key) return key;
      }
    }

    return `iso_tile_${tileVariants[y][x]}`;
  }

  return { resolve };
}
