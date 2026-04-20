/**
 * IsoMapGenerator — procedural per-player isometric map.
 *
 * Uses Kenney medieval-rts tileset (58 terrain tiles, 21 environment sprites).
 * Input: seed (player_id) + dimensions. Output: pure data, no Phaser coupling.
 *
 * Tile IDs verified against Preview.png:
 *   1-2  = grass   3-4 = sand   5-6 = dirt   7-8 = stone   9-10 = snow
 *   11-58 = path connectors through biomes (reserved for future road system)
 * Kenney medieval-rts has no water tiles — lakes are represented as stone pits.
 */
import { rngFromSeed, pick, randInt } from '../lib/prng.js';

export const BIOMES = {
  GRASS: 'grass',
  FOREST: 'forest',
  DIRT: 'dirt',
  SAND: 'sand',
  STONE: 'stone',
  SNOW: 'snow',
};

/** Kenney terrain tile IDs per biome (verified against pack Preview). */
export const TILE_POOLS = {
  [BIOMES.GRASS]: [1, 2],
  [BIOMES.FOREST]: [1, 2],    // grass base, forest = heavy tree density
  [BIOMES.DIRT]: [5, 6],
  [BIOMES.SAND]: [3, 4],
  [BIOMES.STONE]: [7, 8],
  [BIOMES.SNOW]: [9, 10],
};

/** Environment sprite IDs (1..21) — trees, rocks, bushes, flowers. */
export const DECOR_POOLS = {
  TREE: [9, 10, 11, 12, 17, 18, 19],
  TREE_SPARSE: [9, 10, 11],
  ROCK: [7, 14, 20],
  BUSH: [2, 4, 13],
  FLOWER: [1, 5],
};

/**
 * Per-biome decoration rules — order matters (first match wins).
 * `chance` is the per-tile probability at that step.
 */
const DECOR_RULES = {
  [BIOMES.GRASS]: [
    { type: 'tree',   pool: DECOR_POOLS.TREE_SPARSE, chance: 0.10 },
    { type: 'bush',   pool: DECOR_POOLS.BUSH,        chance: 0.05 },
    { type: 'flower', pool: DECOR_POOLS.FLOWER,      chance: 0.06 },
  ],
  [BIOMES.FOREST]: [
    { type: 'tree',   pool: DECOR_POOLS.TREE,        chance: 0.55 },
    { type: 'bush',   pool: DECOR_POOLS.BUSH,        chance: 0.10 },
  ],
  [BIOMES.DIRT]: [
    { type: 'bush',   pool: DECOR_POOLS.BUSH,        chance: 0.06 },
  ],
  [BIOMES.STONE]: [
    { type: 'rock',   pool: DECOR_POOLS.ROCK,        chance: 0.28 },
    { type: 'tree',   pool: DECOR_POOLS.TREE_SPARSE, chance: 0.05 },
  ],
  [BIOMES.SAND]: [
    { type: 'rock',   pool: DECOR_POOLS.ROCK,        chance: 0.04 },
  ],
  [BIOMES.SNOW]: [
    { type: 'tree',   pool: DECOR_POOLS.TREE_SPARSE, chance: 0.08 },
    { type: 'rock',   pool: DECOR_POOLS.ROCK,        chance: 0.06 },
  ],
};

/**
 * Climate gradient — higher latitude (y near 0) → colder biomes.
 * Returns a list of candidate biomes weighted for that latitude band.
 */
function biomesForLatitude(yFraction) {
  if (yFraction < 0.18) return [BIOMES.SNOW, BIOMES.SNOW, BIOMES.STONE];
  if (yFraction < 0.35) return [BIOMES.STONE, BIOMES.GRASS, BIOMES.FOREST];
  if (yFraction < 0.65) return [BIOMES.GRASS, BIOMES.GRASS, BIOMES.FOREST, BIOMES.DIRT];
  if (yFraction < 0.82) return [BIOMES.GRASS, BIOMES.DIRT, BIOMES.SAND];
  return [BIOMES.SAND, BIOMES.SAND, BIOMES.DIRT];
}

/**
 * Generate a deterministic map for a given seed.
 * @param {{seed: any, width?: number, height?: number, regionCount?: number}} opts
 */
export function generateMap({ seed, width = 28, height = 28, regionCount = 9 }) {
  const rng = rngFromSeed(seed);

  // 1) Voronoi seeds placed with climate-aware biome choice.
  const regions = [];
  for (let i = 0; i < regionCount; i++) {
    const cx = randInt(rng, 0, width - 1);
    const cy = randInt(rng, 0, height - 1);
    const biome = pick(rng, biomesForLatitude(cy / height));
    regions.push({ cx, cy, biome });
  }

  // 2) Assign each tile to its nearest region.
  let terrain = Array.from({ length: height }, () => Array(width).fill(BIOMES.GRASS));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let best = regions[0];
      let bestD = Infinity;
      for (const r of regions) {
        const d = (x - r.cx) ** 2 + (y - r.cy) ** 2;
        if (d < bestD) { bestD = d; best = r; }
      }
      terrain[y][x] = best.biome;
    }
  }

  // 3) Smoothing — two passes of majority-vote cellular automata.
  //    Removes isolated tiles, produces organic clumps.
  terrain = smoothBiomes(terrain, width, height);
  terrain = smoothBiomes(terrain, width, height);

  // 4) Biome compatibility — sand directly touching snow looks wrong.
  //    Buffer with grass/dirt where needed.
  bufferIncompatibleEdges(terrain, width, height);

  // 5) Pick spawn: nearest grass/dirt/forest tile to map center.
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const spawn = findSpawn(terrain, cx, cy, width, height);

  // Guarantee a 3x3 grass pad at spawn.
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = spawn.x + dx;
      const ny = spawn.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      terrain[ny][nx] = BIOMES.GRASS;
    }
  }

  // 6) Roll tile variants from biome pools.
  const tileVariants = Array.from({ length: height }, () => Array(width).fill(0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tileVariants[y][x] = pick(rng, TILE_POOLS[terrain[y][x]]);
    }
  }

  // 7) Decorations — skip spawn clearing radius.
  const CLEAR_R = 3;
  const decorations = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - spawn.x;
      const dy = y - spawn.y;
      if (dx * dx + dy * dy < CLEAR_R * CLEAR_R) continue;

      const rules = DECOR_RULES[terrain[y][x]];
      if (!rules) continue;

      let acc = 0;
      const roll = rng();
      for (const rule of rules) {
        acc += rule.chance;
        if (roll < acc) {
          decorations.push({
            x, y,
            type: rule.type,
            tileId: pick(rng, rule.pool),
          });
          break;
        }
      }
    }
  }

  // 8) Buildable plots — grass/dirt/forest ring around spawn, radius 3.
  const buildablePlots = [];
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = spawn.x + dx;
      const ny = spawn.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const b = terrain[ny][nx];
      if (b === BIOMES.STONE || b === BIOMES.SNOW) continue;
      buildablePlots.push({ x: nx, y: ny });
    }
  }

  return {
    width,
    height,
    terrain,
    tileVariants,
    decorations,
    spawn,
    buildablePlots,
    seed,
    biomes: summarizeBiomes(terrain),
  };
}

/** Majority-vote smoothing — each tile takes mode of its 3x3 neighborhood. */
function smoothBiomes(terrain, width, height) {
  const next = Array.from({ length: height }, (_, y) => terrain[y].slice());
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const counts = {};
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const b = terrain[y + dy][x + dx];
          counts[b] = (counts[b] || 0) + 1;
        }
      }
      let best = terrain[y][x];
      let bestN = 0;
      for (const [b, n] of Object.entries(counts)) {
        if (n > bestN) { bestN = n; best = b; }
      }
      next[y][x] = best;
    }
  }
  return next;
}

/** Prevent jarring adjacencies (sand↔snow, snow↔sand) by inserting a buffer. */
function bufferIncompatibleEdges(terrain, width, height) {
  const incompatible = new Set([
    `${BIOMES.SAND}|${BIOMES.SNOW}`,
    `${BIOMES.SNOW}|${BIOMES.SAND}`,
  ]);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = terrain[y][x];
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= width || ny >= height) continue;
        const b = terrain[ny][nx];
        if (incompatible.has(`${a}|${b}`)) {
          // Replace the warmer tile with grass as a buffer.
          if (a === BIOMES.SAND) terrain[y][x] = BIOMES.GRASS;
          else terrain[ny][nx] = BIOMES.GRASS;
        }
      }
    }
  }
}

function findSpawn(terrain, cx, cy, width, height) {
  const walkable = (b) =>
    b === BIOMES.GRASS || b === BIOMES.DIRT || b === BIOMES.FOREST;
  if (walkable(terrain[cy][cx])) return { x: cx, y: cy };
  for (let r = 1; r < Math.max(width, height); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = cx + dx;
        const ny = cy + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        if (walkable(terrain[ny][nx])) return { x: nx, y: ny };
      }
    }
  }
  return { x: cx, y: cy };
}

function summarizeBiomes(terrain) {
  const counts = {};
  for (const row of terrain) for (const b of row) counts[b] = (counts[b] || 0) + 1;
  return counts;
}
