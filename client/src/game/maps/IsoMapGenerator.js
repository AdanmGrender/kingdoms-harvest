/**
 * IsoMapGenerator — procedural per-player isometric map.
 *
 * Uses Kenney medieval-rts tileset (58 terrain tiles, 21 environment sprites).
 * Input: seed (player_id) + dimensions. Output: pure data, no Phaser coupling.
 *
 * Tile pool numbers are educated guesses — adjust after visual test.
 */
import { rngFromSeed, pick, randInt } from '../lib/prng.js';

export const BIOMES = {
  GRASS: 'grass',
  DIRT: 'dirt',
  STONE: 'stone',
  WATER: 'water',
  SAND: 'sand',
};

// Kenney terrain tile IDs per biome (1..58). Tweak after visual inspection.
export const TILE_POOLS = {
  [BIOMES.GRASS]: [1, 2, 3],
  [BIOMES.DIRT]: [5, 6],
  [BIOMES.STONE]: [7, 8],
  [BIOMES.WATER]: [9, 10],
  [BIOMES.SAND]: [4],
};

// Environment sprite IDs (1..21) — trees, rocks, bushes, flowers.
export const DECOR_POOLS = {
  TREE: [9, 10, 11, 12, 17, 18, 19],
  ROCK: [7, 14, 20],
  BUSH: [2, 4, 13],
  FLOWER: [1, 5],
};

const DECOR_RULES = {
  [BIOMES.GRASS]: [
    { type: 'tree', pool: DECOR_POOLS.TREE, chance: 0.12 },
    { type: 'bush', pool: DECOR_POOLS.BUSH, chance: 0.05 },
    { type: 'flower', pool: DECOR_POOLS.FLOWER, chance: 0.05 },
  ],
  [BIOMES.STONE]: [
    { type: 'rock', pool: DECOR_POOLS.ROCK, chance: 0.25 },
  ],
  [BIOMES.DIRT]: [
    { type: 'bush', pool: DECOR_POOLS.BUSH, chance: 0.06 },
  ],
};

/**
 * Generate a deterministic map for a given seed.
 * @param {{seed: any, width?: number, height?: number}} opts
 */
export function generateMap({ seed, width = 24, height = 24 }) {
  const rng = rngFromSeed(seed);

  const terrain = Array.from({ length: height }, () =>
    Array(width).fill(BIOMES.GRASS)
  );

  // 1) Voronoi-lite biome regions — spread 5 seed points, each tile joins nearest.
  const regionBiomes = [BIOMES.GRASS, BIOMES.GRASS, BIOMES.DIRT, BIOMES.STONE, BIOMES.SAND];
  const regions = regionBiomes.map((biome) => ({
    cx: randInt(rng, 0, width - 1),
    cy: randInt(rng, 0, height - 1),
    biome,
  }));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let best = regions[0];
      let bestD = Infinity;
      for (const r of regions) {
        const d = (x - r.cx) ** 2 + (y - r.cy) ** 2;
        if (d < bestD) {
          bestD = d;
          best = r;
        }
      }
      terrain[y][x] = best.biome;
    }
  }

  // 2) Water body (lake) — circular blob away from center.
  const lake = {
    cx: randInt(rng, 3, width - 4),
    cy: randInt(rng, 3, height - 4),
    r: randInt(rng, 2, 3),
  };
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const d2 = (x - lake.cx) ** 2 + (y - lake.cy) ** 2;
      const wobble = rng() * 0.8 - 0.4;
      if (d2 <= (lake.r + wobble) ** 2) terrain[y][x] = BIOMES.WATER;
    }
  }

  // 3) Sand ring around water (beach effect).
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (terrain[y][x] !== BIOMES.WATER) continue;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          const ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          if (terrain[ny][nx] !== BIOMES.WATER && rng() < 0.6) {
            terrain[ny][nx] = BIOMES.SAND;
          }
        }
      }
    }
  }

  // 4) Pick spawn — nearest grass/dirt tile to map center.
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  let spawn = findSpawn(terrain, cx, cy, width, height);

  // Guarantee a 3x3 buildable pad at spawn (clear water/stone/sand underfoot).
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = spawn.x + dx;
      const ny = spawn.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      terrain[ny][nx] = BIOMES.GRASS;
    }
  }

  // 5) Roll tile variants from biome pools.
  const tileVariants = Array.from({ length: height }, () => Array(width).fill(0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tileVariants[y][x] = pick(rng, TILE_POOLS[terrain[y][x]]);
    }
  }

  // 6) Decorations — avoid spawn clearing radius.
  const CLEAR_R = 3;
  const decorations = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - spawn.x;
      const dy = y - spawn.y;
      if (dx * dx + dy * dy < CLEAR_R * CLEAR_R) continue;

      const biome = terrain[y][x];
      const rules = DECOR_RULES[biome];
      if (!rules) continue;

      const roll = rng();
      let acc = 0;
      for (const rule of rules) {
        acc += rule.chance;
        if (roll < acc) {
          decorations.push({
            x,
            y,
            type: rule.type,
            tileId: pick(rng, rule.pool),
          });
          break;
        }
      }
    }
  }

  // 7) Reserved buildable plots — grass/dirt ring around spawn, radius 2.
  const buildablePlots = [];
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = spawn.x + dx;
      const ny = spawn.y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
      const b = terrain[ny][nx];
      if (b === BIOMES.WATER || b === BIOMES.STONE) continue;
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
  };
}

function findSpawn(terrain, cx, cy, width, height) {
  const walkable = (b) => b === BIOMES.GRASS || b === BIOMES.DIRT;
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
