/**
 * Map generator — procedural per-player top-down map using Kenney medieval-rts.
 *
 * Kenney medieval-rts is TOP-DOWN 2D (not isometric), 64×64 tiles. Biome tile
 * IDs were verified by reading each PNG:
 *
 *   1, 2   = plain sand (pale beige)
 *   3-7    = grass + dirt path connectors  (road segments on grass)
 *   8-12   = sand + dirt path connectors   (road segments on sand)
 *   13, 14 = plain dirt (brown)
 *   15, 16 = plain ice  (pale blue)
 *   17-20, 31 = more grass + path variants
 *   25-26, 38 = more sand + path variants
 *   29, 30 = plain snow (white)
 *   44, 45, 50, 55 = pre-decorated (trees / crops / wood) — skip for base terrain
 *   57, 58 = plain grass
 *
 * Kenney medieval-rts has no dedicated "plain stone" tile — rocky terrain is
 * expressed by rock/boulder decorations placed on dirt tiles.
 */
import { rngFromSeed, pick, randInt } from '../lib/prng.js';

export const BIOMES = {
  GRASS: 'grass',
  FOREST: 'forest',
  DIRT: 'dirt',
  SAND: 'sand',
  ICE: 'ice',
  SNOW: 'snow',
  ROAD: 'road',
};

/** Plain biome tile IDs (no paths / decorations baked in). */
export const TILE_POOLS = {
  [BIOMES.GRASS]:  [57, 58],
  [BIOMES.FOREST]: [57, 58],  // forest = grass + tree decor
  [BIOMES.DIRT]:   [13, 14],
  [BIOMES.SAND]:   [1, 2],
  [BIOMES.ICE]:    [15, 16],
  [BIOMES.SNOW]:   [29, 30],
  [BIOMES.ROAD]:   [13, 14],  // placeholder — pickRoadTile() picks real connector
};

/** Path-connector tiles by neighbor bitmask N=1, E=2, S=4, W=8.
 *  Picked heuristically by visual inspection of Kenney preview. Fallback = plain dirt. */
export const ROAD_CONNECTORS = {
  ON_GRASS: {
    0b0011: 3,   // N + E
    0b0110: 4,   // E + S
    0b1100: 6,   // S + W
    0b1001: 7,   // W + N
    0b0101: 17,  // N + S straight
    0b1010: 18,  // E + W straight
    0b0111: 19,  // N + E + S
    0b1110: 20,  // E + S + W
    0b1101: 31,  // S + W + N
    0b1011: 5,   // W + N + E
    0b1111: 5,   // 4-way
    '*':    13,  // plain dirt as fallback
  },
};

/** Environment sprite pools (21 tiles total). */
export const DECOR_POOLS = {
  TREE:        [9, 10, 11, 12, 17, 18, 19],
  TREE_SPARSE: [9, 10, 11],
  ROCK:        [7, 14, 20],
  BUSH:        [2, 4, 13],
  FLOWER:      [1, 5],
};

/** Structure sprite pools (23 tiles). */
export const STRUCT_POOLS = {
  WINDMILL:    [11, 12],
  WATCHTOWER:  [5, 13],
  CHURCH:      [14, 15],
  RUINS:       [8, 18, 19],
  HOUSE:       [1, 3, 4, 6, 7],
  BARN:        [2, 10],
};

export const RESOURCE_TYPES = {
  WOOD:  'wood',
  STONE: 'stone',
  IRON:  'iron',
  WHEAT: 'wheat',
};

// Chances are independent per-tile rolls. Total "non-empty" chance for a biome
// should stay well below 0.25 or the map turns into visual noise. FOREST is the
// exception — it's meant to look dense.
const DECOR_RULES = {
  [BIOMES.GRASS]: [
    { type: 'tree',   pool: DECOR_POOLS.TREE_SPARSE, chance: 0.05 },
    { type: 'bush',   pool: DECOR_POOLS.BUSH,        chance: 0.04 },
    { type: 'flower', pool: DECOR_POOLS.FLOWER,      chance: 0.03 },
  ],
  [BIOMES.FOREST]: [
    { type: 'tree',   pool: DECOR_POOLS.TREE,        chance: 0.45 },
    { type: 'bush',   pool: DECOR_POOLS.BUSH,        chance: 0.08 },
  ],
  [BIOMES.DIRT]: [
    { type: 'rock',   pool: DECOR_POOLS.ROCK,        chance: 0.08 },
    { type: 'bush',   pool: DECOR_POOLS.BUSH,        chance: 0.03 },
  ],
  [BIOMES.SAND]: [
    { type: 'rock',   pool: DECOR_POOLS.ROCK,        chance: 0.02 },
  ],
  [BIOMES.ICE]: [],
  [BIOMES.SNOW]: [
    { type: 'tree',   pool: DECOR_POOLS.TREE_SPARSE, chance: 0.03 },
    { type: 'rock',   pool: DECOR_POOLS.ROCK,        chance: 0.03 },
  ],
  [BIOMES.ROAD]: [],
};

// ────────────────────────────────────────────────────────────────
//  Climate zoning — latitude drives the primary biome.
//  Returns the *dominant* biome for a given north-south fraction.
// ────────────────────────────────────────────────────────────────
function climateBand(yFrac) {
  if (yFrac < 0.10) return BIOMES.SNOW;   // polar
  if (yFrac < 0.22) return BIOMES.DIRT;   // tundra (rocky)
  if (yFrac < 0.40) return BIOMES.GRASS;  // cool grass
  if (yFrac < 0.70) return BIOMES.GRASS;  // temperate (grass + forest clumps)
  if (yFrac < 0.85) return BIOMES.DIRT;   // dry scrubland
  return BIOMES.SAND;                      // desert
}

// Forbidden neighbor pairs — replaced with a buffer biome.
const FORBIDDEN = new Map([
  [`${BIOMES.SAND}|${BIOMES.SNOW}`, BIOMES.GRASS],
  [`${BIOMES.SNOW}|${BIOMES.SAND}`, BIOMES.GRASS],
  [`${BIOMES.SAND}|${BIOMES.ICE}`,  BIOMES.DIRT],
  [`${BIOMES.ICE}|${BIOMES.SAND}`,  BIOMES.DIRT],
  [`${BIOMES.SAND}|${BIOMES.GRASS}`, BIOMES.DIRT],   // sand-grass needs dirt buffer
  [`${BIOMES.GRASS}|${BIOMES.SAND}`, BIOMES.DIRT],
]);

/**
 * Generate a deterministic map for a given seed.
 */
export function generateMap({ seed, width = 28, height = 28 } = {}) {
  const rng = rngFromSeed(seed);

  // 1) Latitude-driven base climate for every tile (wiggle boundaries with noise).
  let terrain = Array.from({ length: height }, () => Array(width).fill(BIOMES.GRASS));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Wobble the latitude so bands aren't straight horizontal lines.
      const wobble = (Math.sin(x * 0.35 + seed) + Math.cos(y * 0.42 - seed)) * 0.05;
      terrain[y][x] = climateBand(y / height + wobble);
    }
  }

  // 2) Forest blobs (3–5) inside the temperate grass band.
  const forestCount = randInt(rng, 3, 5);
  for (let i = 0; i < forestCount; i++) {
    const cx = randInt(rng, 3, width - 4);
    const cy = randInt(rng, Math.floor(height * 0.35), Math.floor(height * 0.70));
    const r = randInt(rng, 2, 4);
    stampBlob(terrain, cx, cy, r, BIOMES.FOREST, rng, [BIOMES.GRASS]);
  }

  // 3) Ice lakes — 1–2 small patches inside the snow band.
  const iceCount = randInt(rng, 1, 2);
  for (let i = 0; i < iceCount; i++) {
    const cx = randInt(rng, 2, width - 3);
    const cy = randInt(rng, 1, Math.floor(height * 0.15));
    const r = randInt(rng, 1, 2);
    stampBlob(terrain, cx, cy, r, BIOMES.ICE, rng, [BIOMES.SNOW, BIOMES.GRASS]);
  }

  // 4) Dirt pockets — scattered rocky patches within grass zones (future stone areas).
  const dirtCount = randInt(rng, 2, 4);
  for (let i = 0; i < dirtCount; i++) {
    const cx = randInt(rng, 2, width - 3);
    const cy = randInt(rng, Math.floor(height * 0.25), Math.floor(height * 0.75));
    stampBlob(terrain, cx, cy, randInt(rng, 1, 2), BIOMES.DIRT, rng, [BIOMES.GRASS, BIOMES.FOREST]);
  }

  // 5) Strong smoothing — 4 passes of 3×3 majority vote.
  for (let p = 0; p < 4; p++) terrain = smoothBiomes(terrain, width, height);

  // 6) Enforce forbidden adjacencies by inserting buffer biome.
  terrain = bufferIncompatible(terrain, width, height);

  // 7) Spawn near map center on walkable biome, with 3×3 grass pad.
  const cx = Math.floor(width / 2);
  const cy = Math.floor(height / 2);
  const spawn = findSpawn(terrain, cx, cy, width, height);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const nx = spawn.x + dx, ny = spawn.y + dy;
      if (inBounds(nx, ny, width, height)) terrain[ny][nx] = BIOMES.GRASS;
    }
  }

  // 8) Carve 1–2 meandering roads from a random edge to spawn.
  const roads = carveRoads(terrain, width, height, spawn, rng);

  // 9) Roll tile variants from each biome's plain pool.
  const tileVariants = Array.from({ length: height }, () => Array(width).fill(0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      tileVariants[y][x] = pick(rng, TILE_POOLS[terrain[y][x]]);
    }
  }

  // 10) POI structures (church, windmill, watchtower, ruins).
  const structures = placeStructures(terrain, width, height, spawn, rng);

  // 11) Resource clusters.
  const occupied = new Set(structures.map(s => `${s.x},${s.y}`));
  const resources = placeResources(terrain, width, height, spawn, rng, occupied);
  for (const r of resources) occupied.add(`${r.x},${r.y}`);

  // 12) Decorations (trees on grass/forest, rocks on dirt, etc.).
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
          decorations.push({ x, y, type: rule.type, tileId: pick(rng, rule.pool) });
          break;
        }
      }
    }
  }

  // 13) Fog of war — radius around spawn + road tiles.
  const visibility = computeVisibility(width, height, spawn, roads, 9);

  // 14) Buildable plots ring around spawn (skip snow/ice).
  const buildablePlots = [];
  for (let dy = -3; dy <= 3; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = spawn.x + dx, ny = spawn.y + dy;
      if (!inBounds(nx, ny, width, height)) continue;
      const b = terrain[ny][nx];
      if (b === BIOMES.SNOW || b === BIOMES.ICE) continue;
      buildablePlots.push({ x: nx, y: ny });
    }
  }

  return {
    width, height, terrain, tileVariants, decorations, structures, resources,
    roads, visibility, spawn, buildablePlots, seed,
    biomes: summarizeBiomes(terrain),
  };
}

// ────────────────────────────────────────────────────────────────
//  Helpers
// ────────────────────────────────────────────────────────────────

/** Paint a rough circular blob of `biome` at (cx,cy), only over `onTop` biomes. */
function stampBlob(terrain, cx, cy, radius, biome, rng, onTop) {
  for (let dy = -radius - 1; dy <= radius + 1; dy++) {
    for (let dx = -radius - 1; dx <= radius + 1; dx++) {
      const x = cx + dx, y = cy + dy;
      if (y < 0 || y >= terrain.length || x < 0 || x >= terrain[0].length) continue;
      const d2 = dx * dx + dy * dy;
      const jitter = rng() * 1.3;
      if (d2 <= radius * radius + jitter) {
        if (!onTop || onTop.includes(terrain[y][x])) terrain[y][x] = biome;
      }
    }
  }
}

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

/** Replace forbidden adjacencies with a buffer biome. Runs until stable. */
function bufferIncompatible(terrain, width, height) {
  const copy = terrain.map(r => r.slice());
  for (let pass = 0; pass < 3; pass++) {
    let changed = false;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a = copy[y][x];
        for (const [dx, dy] of [[1, 0], [0, 1]]) {
          const nx = x + dx, ny = y + dy;
          if (!inBounds(nx, ny, width, height)) continue;
          const b = copy[ny][nx];
          const bufferTo = FORBIDDEN.get(`${a}|${b}`);
          if (bufferTo) {
            // Insert buffer on whichever side is "weaker" (the less-connected neighbor).
            // Simple heuristic: convert the second cell to the buffer biome.
            copy[ny][nx] = bufferTo;
            changed = true;
          }
        }
      }
    }
    if (!changed) break;
  }
  return copy;
}

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
        terrain[y][x] = BIOMES.ROAD;
        path.push({ x, y });
      }
      const dx = Math.sign(spawn.x - x);
      const dy = Math.sign(spawn.y - y);
      if (rng() < 0.72) {
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

function placeStructures(terrain, width, height, spawn, rng) {
  const MIN_FROM_SPAWN = 6;
  const MIN_FROM_OTHER = 4;
  const placed = [];
  const plans = [
    { type: 'church',     pool: STRUCT_POOLS.CHURCH,     biomes: [BIOMES.GRASS],              count: 1, chance: 0.6 },
    { type: 'windmill',   pool: STRUCT_POOLS.WINDMILL,   biomes: [BIOMES.GRASS, BIOMES.DIRT], count: 1, chance: 0.8 },
    { type: 'watchtower', pool: STRUCT_POOLS.WATCHTOWER, biomes: [BIOMES.DIRT, BIOMES.GRASS], count: 1, chance: 0.8 },
    { type: 'ruins',      pool: STRUCT_POOLS.RUINS,      biomes: [BIOMES.SAND, BIOMES.DIRT],  count: 2, chance: 1.0 },
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
        placed.push({ x, y, type: plan.type, tileId: pick(rng, plan.pool) });
        break;
      }
    }
  }
  return placed;
}

function placeResources(terrain, width, height, spawn, rng, occupied) {
  const resources = [];
  const push = (type, tileId, x, y) => {
    const key = `${x},${y}`;
    if (occupied.has(key)) return;
    resources.push({ x, y, type, tileId, amount: randInt(rng, 50, 200) });
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
  placeClusters(RESOURCE_TYPES.WOOD,  DECOR_POOLS.TREE, [BIOMES.FOREST], 3, 5);
  placeClusters(RESOURCE_TYPES.STONE, DECOR_POOLS.ROCK, [BIOMES.DIRT],   2, 4);
  placeClusters(RESOURCE_TYPES.IRON,  DECOR_POOLS.ROCK, [BIOMES.DIRT],   1, 2);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      const nx = spawn.x + dx, ny = spawn.y + dy;
      if (!inBounds(nx, ny, width, height)) continue;
      if (terrain[ny][nx] !== BIOMES.DIRT && terrain[ny][nx] !== BIOMES.GRASS) continue;
      if (Math.abs(dx) + Math.abs(dy) < 2) continue;
      if (rng() < 0.35) push(RESOURCE_TYPES.WHEAT, pick(rng, DECOR_POOLS.FLOWER), nx, ny);
    }
  }
  return resources;
}

function computeVisibility(width, height, spawn, roads, radius) {
  const vis = Array.from({ length: height }, () => Array(width).fill(0));
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const dx = x - spawn.x, dy = y - spawn.y;
      if (dx * dx + dy * dy <= radius * radius) vis[y][x] = 1;
    }
  }
  for (const path of roads) {
    for (const p of path) if (inBounds(p.x, p.y, width, height)) vis[p.y][p.x] = 1;
  }
  return vis;
}

function findSpawn(terrain, cx, cy, width, height) {
  const walkable = b => b === BIOMES.GRASS || b === BIOMES.DIRT || b === BIOMES.FOREST;
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
