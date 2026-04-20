/**
 * IsoMapGenerator — procedural per-player isometric map.
 *
 * Uses Kenney medieval-rts tileset (58 terrain tiles, 21 environment sprites,
 * 23 structure sprites). Output is pure data — no Phaser coupling.
 *
 * Tile IDs verified against Preview.png:
 *   1-2  = grass   3-4 = sand   5-6 = dirt   7-8 = stone   9-10 = snow
 *   11-58 = path connectors through biomes (reserved for future road system)
 * Kenney medieval-rts has no water tiles — lakes omitted.
 */
import { rngFromSeed, pick, randInt } from '../lib/prng.js';

export const BIOMES = {
  GRASS: 'grass',
  FOREST: 'forest',
  DIRT: 'dirt',
  SAND: 'sand',
  STONE: 'stone',
  SNOW: 'snow',
  ROAD: 'road',
};

/** Kenney terrain tile IDs per biome (verified against pack Preview). */
export const TILE_POOLS = {
  [BIOMES.GRASS]:  [1, 2],
  [BIOMES.FOREST]: [1, 2],
  [BIOMES.DIRT]:   [5, 6],
  [BIOMES.SAND]:   [3, 4],
  [BIOMES.STONE]:  [7, 8],
  [BIOMES.SNOW]:   [9, 10],
  [BIOMES.ROAD]:   [5, 6],
};

/** Environment sprite IDs (1..21) — trees, rocks, bushes, flowers. */
export const DECOR_POOLS = {
  TREE:        [9, 10, 11, 12, 17, 18, 19],
  TREE_SPARSE: [9, 10, 11],
  ROCK:        [7, 14, 20],
  BUSH:        [2, 4, 13],
  FLOWER:      [1, 5],
};

/** Kenney Structure sprite IDs (1..23) — buildings, ruins, landmarks. */
export const STRUCT_POOLS = {
  WINDMILL:    [11, 12],
  WATCHTOWER:  [5, 13],
  CHURCH:      [14, 15],
  RUINS:       [8, 18, 19],
  HOUSE:       [1, 3, 4, 6, 7],
  BARN:        [2, 10],
};

/**
 * Gatherable resource nodes — tagged with type + amount for future gameplay.
 * tileId refers to an Environment sprite (reusing DECOR_POOLS visuals).
 */
export const RESOURCE_TYPES = {
  WOOD:  'wood',
  STONE: 'stone',
  IRON:  'iron',
  WHEAT: 'wheat',
};

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
  [BIOMES.ROAD]: [],
};

function biomesForLatitude(yFraction) {
  if (yFraction < 0.18) return [BIOMES.SNOW, BIOMES.SNOW, BIOMES.STONE];
  if (yFraction < 0.35) return [BIOMES.STONE, BIOMES.GRASS, BIOMES.FOREST];
  if (yFraction < 0.65) return [BIOMES.GRASS, BIOMES.GRASS, BIOMES.FOREST, BIOMES.DIRT];
  if (yFraction < 0.82) return [BIOMES.GRASS, BIOMES.DIRT, BIOMES.SAND];
  return [BIOMES.SAND, BIOMES.SAND, BIOMES.DIRT];
}

/**
 * Generate a deterministic map for a given seed.
 */
export function generateMap({ seed, width = 28, height = 28, regionCount = 9 }) {
  const rng = rngFromSeed(seed);

  // 1) Voronoi seeds with climate-aware biome picks.
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
      let best = regions[0], bestD = Infinity;
      for (const r of regions) {
        const d = (x - r.cx) ** 2 + (y - r.cy) ** 2;
        if (d < bestD) { bestD = d; best = r; }
      }
      terrain[y][x] = best.biome;
    }
  }

  // 3) Smoothing — two passes of 3x3 majority vote.
  terrain = smoothBiomes(terrain, width, height);
  terrain = smoothBiomes(terrain, width, height);

  // 4) Biome compatibility — buffer sand↔snow adjacencies.
  bufferIncompatibleEdges(terrain, width, height);

  // 5) Pick spawn (nearest grass/dirt/forest to center) + clear 3x3 pad.
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const spawn = findSpawn(terrain, cx, cy, width, height);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = spawn.x + dx, ny = spawn.y + dy;
      if (inBounds(nx, ny, width, height)) terrain[ny][nx] = BIOMES.GRASS;
    }
  }

  // 6) Carve roads — 1-2 meandering dirt paths from random edge to spawn.
  const roads = carveRoads(terrain, width, height, spawn, rng);

  // 7) Roll tile variants from biome pools.
  const tileVariants = Array.from({ length: height }, () => Array(width).fill(0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tileVariants[y][x] = pick(rng, TILE_POOLS[terrain[y][x]]);
    }
  }

  // 8) Structure POIs (windmill, church, watchtower, ruins).
  const structures = placeStructures(terrain, width, height, spawn, rng);

  // 9) Resource clusters (wood in forest, stone/iron in stone, wheat near spawn).
  //    Tracks occupied tiles to avoid overlap with structures.
  const occupied = new Set(structures.map((s) => `${s.x},${s.y}`));
  const resources = placeResources(terrain, width, height, spawn, rng, occupied);
  for (const r of resources) occupied.add(`${r.x},${r.y}`);

  // 10) Decorations (respect spawn radius + occupied tiles).
  const CLEAR_R = 3;
  const decorations = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (occupied.has(`${x},${y}`)) continue;
      const dx = x - spawn.x, dy = y - spawn.y;
      if (dx * dx + dy * dy < CLEAR_R * CLEAR_R) continue;
      const rules = DECOR_RULES[terrain[y][x]];
      if (!rules || rules.length === 0) continue;

      const roll = rng();
      let acc = 0;
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

  // 11) Fog of war — visible within radius around spawn and along roads.
  const visibility = computeVisibility(width, height, spawn, roads, 9);

  // 12) Buildable plots ring around spawn (radius 3, skip stone/snow).
  const buildablePlots = [];
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = spawn.x + dx, ny = spawn.y + dy;
      if (!inBounds(nx, ny, width, height)) continue;
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
    structures,
    resources,
    roads,
    visibility,
    spawn,
    buildablePlots,
    seed,
    biomes: summarizeBiomes(terrain),
  };
}

// ————————————————————————————————————————————————————————————————————
//  Pipeline steps
// ————————————————————————————————————————————————————————————————————

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
      let best = terrain[y][x], bestN = 0;
      for (const [b, n] of Object.entries(counts)) {
        if (n > bestN) { bestN = n; best = b; }
      }
      next[y][x] = best;
    }
  }
  return next;
}

function bufferIncompatibleEdges(terrain, width, height) {
  const bad = new Set([
    `${BIOMES.SAND}|${BIOMES.SNOW}`,
    `${BIOMES.SNOW}|${BIOMES.SAND}`,
  ]);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const a = terrain[y][x];
      for (const [dx, dy] of [[1, 0], [0, 1]]) {
        const nx = x + dx, ny = y + dy;
        if (!inBounds(nx, ny, width, height)) continue;
        const b = terrain[ny][nx];
        if (bad.has(`${a}|${b}`)) {
          if (a === BIOMES.SAND) terrain[y][x] = BIOMES.GRASS;
          else terrain[ny][nx] = BIOMES.GRASS;
        }
      }
    }
  }
}

/**
 * Carve meandering dirt roads (drunkard's walk toward spawn).
 * Changes terrain to ROAD along the path.
 */
function carveRoads(terrain, width, height, spawn, rng) {
  const roads = [];
  const roadCount = randInt(rng, 1, 2);

  for (let i = 0; i < roadCount; i++) {
    const edge = randInt(rng, 0, 3);
    let x, y;
    if (edge === 0)      { x = randInt(rng, 1, width - 2);  y = 0; }
    else if (edge === 1) { x = width - 1; y = randInt(rng, 1, height - 2); }
    else if (edge === 2) { x = randInt(rng, 1, width - 2);  y = height - 1; }
    else                 { x = 0; y = randInt(rng, 1, height - 2); }

    const path = [];
    let steps = 0;
    const maxSteps = width * height;
    while ((x !== spawn.x || y !== spawn.y) && steps < maxSteps) {
      if (inBounds(x, y, width, height)) {
        // Don't flatten water-like or stone (keeps stone biomes impassable pockets).
        if (terrain[y][x] !== BIOMES.STONE) {
          terrain[y][x] = BIOMES.ROAD;
          path.push({ x, y });
        }
      }
      // Greedy-with-jitter: 70% toward spawn, 30% random drift.
      const dx = Math.sign(spawn.x - x);
      const dy = Math.sign(spawn.y - y);
      if (rng() < 0.7) {
        if (rng() < 0.5 && dx !== 0) x += dx;
        else if (dy !== 0) y += dy;
        else x += dx;
      } else {
        const r = randInt(rng, 0, 3);
        if (r === 0) x += 1;
        else if (r === 1) x -= 1;
        else if (r === 2) y += 1;
        else y -= 1;
      }
      steps++;
    }
    roads.push(path);
  }
  return roads;
}

/**
 * Place distinct landmark structures on biome-appropriate tiles.
 * Each structure type tries up to 30 candidates; respects min-distance rules.
 */
function placeStructures(terrain, width, height, spawn, rng) {
  const MIN_FROM_SPAWN = 6;
  const MIN_FROM_OTHER = 4;
  const placed = [];

  const plans = [
    { type: 'church',     pool: STRUCT_POOLS.CHURCH,     biomes: [BIOMES.GRASS],              count: 1, chance: 0.6 },
    { type: 'windmill',   pool: STRUCT_POOLS.WINDMILL,   biomes: [BIOMES.GRASS, BIOMES.DIRT], count: 1, chance: 0.8 },
    { type: 'watchtower', pool: STRUCT_POOLS.WATCHTOWER, biomes: [BIOMES.STONE, BIOMES.GRASS], count: 1, chance: 0.8 },
    { type: 'ruins',      pool: STRUCT_POOLS.RUINS,      biomes: [BIOMES.SAND, BIOMES.DIRT, BIOMES.STONE], count: 2, chance: 1.0 },
  ];

  for (const plan of plans) {
    if (rng() > plan.chance) continue;
    for (let n = 0; n < plan.count; n++) {
      for (let attempt = 0; attempt < 30; attempt++) {
        const x = randInt(rng, 1, width - 2);
        const y = randInt(rng, 1, height - 2);
        const b = terrain[y][x];
        if (!plan.biomes.includes(b)) continue;
        const dSpawn = (x - spawn.x) ** 2 + (y - spawn.y) ** 2;
        if (dSpawn < MIN_FROM_SPAWN * MIN_FROM_SPAWN) continue;
        let tooClose = false;
        for (const p of placed) {
          const d = (p.x - x) ** 2 + (p.y - y) ** 2;
          if (d < MIN_FROM_OTHER * MIN_FROM_OTHER) { tooClose = true; break; }
        }
        if (tooClose) continue;
        placed.push({
          x, y,
          type: plan.type,
          tileId: pick(rng, plan.pool),
        });
        break;
      }
    }
  }
  return placed;
}

/**
 * Place gatherable resource clusters.
 * Each resource type finds its biome, scatters N clusters of M nodes.
 */
function placeResources(terrain, width, height, spawn, rng, occupied) {
  const resources = [];

  const push = (type, tileId, x, y) => {
    const key = `${x},${y}`;
    if (occupied.has(key)) return;
    resources.push({
      x, y, type, tileId,
      amount: randInt(rng, 50, 200),
    });
    occupied.add(key);
  };

  const placeClusters = (type, pool, biomes, clusters, clusterSize) => {
    const candidates = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (!biomes.includes(terrain[y][x])) continue;
        const dx = x - spawn.x, dy = y - spawn.y;
        if (dx * dx + dy * dy < 16) continue;
        candidates.push({ x, y });
      }
    }
    for (let c = 0; c < clusters && candidates.length > 0; c++) {
      const idx = Math.floor(rng() * candidates.length);
      const center = candidates[idx];
      for (let n = 0; n < clusterSize; n++) {
        const ox = center.x + randInt(rng, -1, 1);
        const oy = center.y + randInt(rng, -1, 1);
        if (!inBounds(ox, oy, width, height)) continue;
        if (!biomes.includes(terrain[oy][ox])) continue;
        push(type, pick(rng, pool), ox, oy);
      }
    }
  };

  placeClusters(RESOURCE_TYPES.WOOD,  DECOR_POOLS.TREE, [BIOMES.FOREST],                 3, 5);
  placeClusters(RESOURCE_TYPES.STONE, DECOR_POOLS.ROCK, [BIOMES.STONE],                  2, 4);
  placeClusters(RESOURCE_TYPES.IRON,  DECOR_POOLS.ROCK, [BIOMES.STONE],                  1, 2);

  // Wheat: spawn-adjacent dirt tiles (the player's starter fields).
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = spawn.x + dx, ny = spawn.y + dy;
      if (!inBounds(nx, ny, width, height)) continue;
      if (terrain[ny][nx] !== BIOMES.DIRT) continue;
      if (Math.abs(dx) + Math.abs(dy) < 2) continue;
      push(RESOURCE_TYPES.WHEAT, pick(rng, DECOR_POOLS.FLOWER), nx, ny);
    }
  }

  return resources;
}

/** BFS-ish fog reveal from spawn, plus all road tiles. */
function computeVisibility(width, height, spawn, roads, radius) {
  const vis = Array.from({ length: height }, () => Array(width).fill(0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - spawn.x, dy = y - spawn.y;
      if (dx * dx + dy * dy <= radius * radius) vis[y][x] = 1;
    }
  }
  for (const path of roads) {
    for (const p of path) {
      if (inBounds(p.x, p.y, width, height)) vis[p.y][p.x] = 1;
    }
  }
  return vis;
}

// ————————————————————————————————————————————————————————————————————
//  Helpers
// ————————————————————————————————————————————————————————————————————

function findSpawn(terrain, cx, cy, width, height) {
  const walkable = (b) =>
    b === BIOMES.GRASS || b === BIOMES.DIRT || b === BIOMES.FOREST;
  if (walkable(terrain[cy][cx])) return { x: cx, y: cy };
  for (let r = 1; r < Math.max(width, height); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = cx + dx, ny = cy + dy;
        if (!inBounds(nx, ny, width, height)) continue;
        if (walkable(terrain[ny][nx])) return { x: nx, y: ny };
      }
    }
  }
  return { x: cx, y: cy };
}

function inBounds(x, y, width, height) {
  return x >= 0 && y >= 0 && x < width && y < height;
}

function summarizeBiomes(terrain) {
  const counts = {};
  for (const row of terrain) for (const b of row) counts[b] = (counts[b] || 0) + 1;
  return counts;
}
