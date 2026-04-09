/**
 * Programmatic tilemap generator for Kingdoms Harvest.
 * Generates a 160x120 world with noise-based terrain and resource zones.
 * Zones: Castle (north), Farm (center), Market (east), Barracks (west),
 *        Wilderness (south), Resource zones (scattered).
 */

const MAP_WIDTH = 160;
const MAP_HEIGHT = 120;
const TILE_SIZE = 32;

// Tile indices matching terrain.png tileset
const T = {
  GRASS1: 0,
  GRASS2: 1,
  DIRT: 2,
  DIRT_LIGHT: 3,
  WATER: 4,
  SAND: 5,
  STONE: 6,
  FLOWER_RED: 7,
  FLOWER_BLUE: 8,
  FENCE_H: 9,
  FENCE_V: 10,
  TREE: 11,
  ROCK: 12,
  BRIDGE: 13,
  GRASS_DIRT: 14,
  FENCE_CORNER: 15,
  GRASS_DARK: 16,
  COBBLESTONE: 17,
  TALL_GRASS: 18,
};

// Building indices matching buildings.png (64x64 cells)
const B = {
  BARN: 0,
  MILL: 1,
  WALL: 2,
  TOWER: 3,
  BARRACKS: 4,
  TAVERN: 5,
  MARKET: 6,
  THRONE_ROOM: 7,
  LIBRARY: 8,
  STABLE: 9,
  SMITHY: 10,
  SAWMILL: 11,
  TRAP: 12,
  EMBASSY: 13,
  FARM_PLOT: 14,
  CONSTRUCTION: 15,
};

function seededRandom(seed) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

// Simple value noise for natural terrain variation
function generateNoise(width, height, rand, scale = 16) {
  // Generate coarse grid
  const gridW = Math.ceil(width / scale) + 1;
  const gridH = Math.ceil(height / scale) + 1;
  const grid = [];
  for (let y = 0; y < gridH; y++) {
    grid[y] = [];
    for (let x = 0; x < gridW; x++) {
      grid[y][x] = rand();
    }
  }
  // Interpolate
  const noise = [];
  for (let y = 0; y < height; y++) {
    noise[y] = [];
    for (let x = 0; x < width; x++) {
      const gx = x / scale;
      const gy = y / scale;
      const x0 = Math.floor(gx);
      const y0 = Math.floor(gy);
      const fx = gx - x0;
      const fy = gy - y0;
      const x1 = Math.min(x0 + 1, gridW - 1);
      const y1 = Math.min(y0 + 1, gridH - 1);
      const top = grid[y0][x0] * (1 - fx) + grid[y0][x1] * fx;
      const bot = grid[y1][x0] * (1 - fx) + grid[y1][x1] * fx;
      noise[y][x] = top * (1 - fy) + bot * fy;
    }
  }
  return noise;
}

export function generateWorldMap(seed = 42) {
  const rand = seededRandom(seed);
  const ground = [];
  const decoration = [];
  const collision = [];

  // Generate noise layers for terrain variation
  const terrainNoise = generateNoise(MAP_WIDTH, MAP_HEIGHT, rand, 12);
  const moistureNoise = generateNoise(MAP_WIDTH, MAP_HEIGHT, rand, 20);

  // Initialize layers with noise-based grass
  for (let y = 0; y < MAP_HEIGHT; y++) {
    ground[y] = [];
    decoration[y] = [];
    collision[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      const n = terrainNoise[y][x];
      if (n < 0.3) ground[y][x] = T.GRASS_DARK;
      else if (n < 0.6) ground[y][x] = T.GRASS1;
      else ground[y][x] = T.GRASS2;
      decoration[y][x] = -1;
      collision[y][x] = 0;
    }
  }

  // ─── Helper functions ───
  function fillArea(layer, x1, y1, w, h, tile) {
    for (let y = y1; y < y1 + h && y < MAP_HEIGHT; y++) {
      for (let x = x1; x < x1 + w && x < MAP_WIDTH; x++) {
        if (x >= 0 && y >= 0) layer[y][x] = tile;
      }
    }
  }

  function setCollision(x1, y1, w, h) {
    fillArea(collision, x1, y1, w, h, 1);
  }

  // ─── WATER FEATURES ───
  // South river
  for (let x = 0; x < MAP_WIDTH; x++) {
    ground[MAP_HEIGHT - 1][x] = T.WATER;
    ground[MAP_HEIGHT - 2][x] = T.WATER;
    ground[MAP_HEIGHT - 3][x] = T.SAND;
    collision[MAP_HEIGHT - 1][x] = 1;
    collision[MAP_HEIGHT - 2][x] = 1;
  }
  // Bridge over south river
  for (let x = 78; x <= 82; x++) {
    ground[MAP_HEIGHT - 2][x] = T.BRIDGE;
    ground[MAP_HEIGHT - 1][x] = T.BRIDGE;
    collision[MAP_HEIGHT - 2][x] = 0;
    collision[MAP_HEIGHT - 1][x] = 0;
  }

  // Lake in northeast
  const lakeX = 120, lakeY = 20;
  for (let dy = -5; dy <= 5; dy++) {
    for (let dx = -7; dx <= 7; dx++) {
      const dist = Math.sqrt(dx * dx * 0.5 + dy * dy);
      const ty = lakeY + dy;
      const tx = lakeX + dx;
      if (ty >= 0 && ty < MAP_HEIGHT && tx >= 0 && tx < MAP_WIDTH) {
        if (dist < 4) {
          ground[ty][tx] = T.WATER;
          collision[ty][tx] = 1;
        } else if (dist < 5) {
          ground[ty][tx] = T.SAND;
        }
      }
    }
  }

  // ─── TREE BORDER (edges of map) ───
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < 4; y++) {
      decoration[y][x] = T.TREE;
      collision[y][x] = 1;
    }
  }
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < 4; x++) {
      decoration[y][x] = T.TREE;
      collision[y][x] = 1;
    }
    for (let x = MAP_WIDTH - 4; x < MAP_WIDTH; x++) {
      decoration[y][x] = T.TREE;
      collision[y][x] = 1;
    }
  }

  // ─── FOREST CLUSTERS (noise-driven) ───
  for (let y = 5; y < MAP_HEIGHT - 5; y++) {
    for (let x = 5; x < MAP_WIDTH - 5; x++) {
      if (decoration[y][x] !== -1) continue;
      // Dense forests where moisture is high and outside core zones
      const inCoreZone = (x >= 30 && x <= 130 && y >= 10 && y <= 90);
      const m = moistureNoise[y][x];
      if (!inCoreZone && m > 0.7 && rand() < 0.4) {
        decoration[y][x] = T.TREE;
        collision[y][x] = 1;
      } else if (!inCoreZone && m > 0.6 && rand() < 0.15) {
        decoration[y][x] = T.TREE;
        collision[y][x] = 1;
      }
    }
  }

  // ─── PATHS (main roads) ───
  const centerX = 80, centerY = 60;
  // Horizontal main road
  for (let x = 8; x < MAP_WIDTH - 8; x++) {
    ground[centerY][x] = T.DIRT;
    ground[centerY - 1][x] = T.DIRT_LIGHT;
    ground[centerY + 1][x] = T.DIRT_LIGHT;
  }
  // Vertical main road
  for (let y = 8; y < MAP_HEIGHT - 5; y++) {
    ground[y][centerX] = T.DIRT;
    ground[y][centerX - 1] = T.DIRT_LIGHT;
    ground[y][centerX + 1] = T.DIRT_LIGHT;
  }
  // Secondary road to market
  for (let x = centerX; x < 130; x++) {
    ground[40][x] = T.DIRT;
  }
  // Secondary road to barracks
  for (let x = 20; x < centerX; x++) {
    ground[40][x] = T.DIRT;
  }

  // ─── CASTLE ZONE (north-center, y: 10-30) ───
  fillArea(ground, 60, 10, 40, 22, T.COBBLESTONE);

  // ─── FARM ZONE (center, y: 45-80, x: 40-110) ───
  for (let x = 40; x < 111; x++) {
    decoration[45][x] = T.FENCE_H;
    decoration[80][x] = T.FENCE_H;
  }
  for (let y = 45; y < 81; y++) {
    decoration[y][40] = T.FENCE_V;
    decoration[y][110] = T.FENCE_V;
  }
  fillArea(ground, 41, 46, 69, 34, T.GRASS_DARK);

  // ─── MARKET ZONE (east, x: 115-145) ───
  fillArea(ground, 115, 45, 30, 30, T.COBBLESTONE);

  // ─── BARRACKS ZONE (west, x: 10-35) ───
  fillArea(ground, 10, 45, 25, 30, T.STONE);

  // ─── RESOURCE ZONES ───
  const resourceZones = [];

  // Stone quarry (northwest)
  const quarryX = 25, quarryY = 20;
  fillArea(ground, quarryX - 4, quarryY - 3, 8, 6, T.STONE);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (rand() < 0.4) {
        decoration[quarryY + dy][quarryX + dx] = T.ROCK;
        collision[quarryY + dy][quarryX + dx] = 1;
      }
    }
  }
  resourceZones.push({ type: 'resource_zone', resource: 'stone', x: quarryX, y: quarryY, radius: 4, name: 'Cantera' });

  // Iron mine (southwest)
  const mineX = 30, mineY = 95;
  fillArea(ground, mineX - 4, mineY - 3, 8, 6, T.STONE);
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -3; dx <= 3; dx++) {
      if (rand() < 0.5) {
        decoration[mineY + dy][mineX + dx] = T.ROCK;
        collision[mineY + dy][mineX + dx] = 1;
      }
    }
  }
  resourceZones.push({ type: 'resource_zone', resource: 'iron', x: mineX, y: mineY, radius: 4, name: 'Mina de Hierro' });

  // Dense forest for wood (east)
  const forestX = 140, forestY = 85;
  for (let dy = -6; dy <= 6; dy++) {
    for (let dx = -5; dx <= 5; dx++) {
      const ty = forestY + dy, tx = forestX + dx;
      if (ty > 4 && ty < MAP_HEIGHT - 4 && tx > 4 && tx < MAP_WIDTH - 4) {
        if (rand() < 0.6) {
          decoration[ty][tx] = T.TREE;
          collision[ty][tx] = 1;
        }
      }
    }
  }
  resourceZones.push({ type: 'resource_zone', resource: 'wood', x: forestX, y: forestY, radius: 6, name: 'Bosque Denso' });

  // Gold deposit (far northeast, near lake)
  const goldX = 135, goldY = 15;
  fillArea(ground, goldX - 3, goldY - 2, 6, 4, T.SAND);
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      if (rand() < 0.3) {
        decoration[goldY + dy][goldX + dx] = T.ROCK;
        collision[goldY + dy][goldX + dx] = 1;
      }
    }
  }
  resourceZones.push({ type: 'resource_zone', resource: 'gold', x: goldX, y: goldY, radius: 3, name: 'Deposito de Oro' });

  // ─── WILDERNESS (south, y: 95-115) ───
  for (let y = 95; y < MAP_HEIGHT - 4; y++) {
    for (let x = 8; x < MAP_WIDTH - 8; x++) {
      if (decoration[y][x] !== -1) continue;
      if (rand() < 0.07) {
        decoration[y][x] = T.TREE;
        collision[y][x] = 1;
      } else if (rand() < 0.08) {
        decoration[y][x] = T.TALL_GRASS;
      } else if (rand() < 0.03) {
        decoration[y][x] = T.ROCK;
        collision[y][x] = 1;
      }
    }
  }

  // ─── Scatter flowers and details ───
  for (let y = 5; y < MAP_HEIGHT - 5; y++) {
    for (let x = 5; x < MAP_WIDTH - 5; x++) {
      if (decoration[y][x] !== -1) continue;
      if (ground[y][x] !== T.GRASS1 && ground[y][x] !== T.GRASS2 && ground[y][x] !== T.GRASS_DARK) continue;
      const r = rand();
      if (r < 0.008) decoration[y][x] = T.FLOWER_RED;
      else if (r < 0.016) decoration[y][x] = T.FLOWER_BLUE;
      else if (r < 0.02) {
        decoration[y][x] = T.ROCK;
        collision[y][x] = 1;
      }
    }
  }

  // ─── OBJECTS ───
  const objects = [];

  // Player spawn point (center of map)
  objects.push({ type: 'spawn', x: centerX, y: centerY + 2, name: 'player_spawn' });

  // ─── Buildings (Castle zone) ───
  objects.push({ type: 'building', buildingId: 'throne_room', x: 77, y: 12, tileIndex: B.THRONE_ROOM });
  objects.push({ type: 'building', buildingId: 'library', x: 64, y: 18, tileIndex: B.LIBRARY });
  objects.push({ type: 'building', buildingId: 'embassy', x: 90, y: 18, tileIndex: B.EMBASSY });

  // Farm zone buildings
  objects.push({ type: 'building', buildingId: 'barn', x: 44, y: 48, tileIndex: B.BARN });
  objects.push({ type: 'building', buildingId: 'mill', x: 100, y: 48, tileIndex: B.MILL });
  objects.push({ type: 'building', buildingId: 'stable', x: 44, y: 68, tileIndex: B.STABLE });
  objects.push({ type: 'building', buildingId: 'sawmill', x: 100, y: 68, tileIndex: B.SAWMILL });

  // Market zone buildings
  objects.push({ type: 'building', buildingId: 'market', x: 120, y: 50, tileIndex: B.MARKET });
  objects.push({ type: 'building', buildingId: 'tavern', x: 120, y: 60, tileIndex: B.TAVERN });
  objects.push({ type: 'building', buildingId: 'smithy', x: 132, y: 55, tileIndex: B.SMITHY });

  // Barracks zone buildings
  objects.push({ type: 'building', buildingId: 'barracks', x: 14, y: 50, tileIndex: B.BARRACKS });
  objects.push({ type: 'building', buildingId: 'wall', x: 14, y: 62, tileIndex: B.WALL });
  objects.push({ type: 'building', buildingId: 'tower', x: 24, y: 50, tileIndex: B.TOWER });

  // ─── Farm Plots (4x4 grid) ───
  for (let r = 0; r < 4; r++) {
    for (let c = 0; c < 4; c++) {
      objects.push({
        type: 'farm_plot',
        x: 55 + c * 7,
        y: 52 + r * 6,
        plotIndex: r * 4 + c,
      });
    }
  }

  // ─── Animal Pasture ───
  objects.push({ type: 'animal_zone', x: 90, y: 54, width: 16, height: 18, name: 'pasture' });

  // ─── NPCs ───
  objects.push({ type: 'npc', npcId: 'farmer', x: 58, y: 60, name: 'Granjero' });
  objects.push({ type: 'npc', npcId: 'baker', x: 102, y: 54, name: 'Panadero' });
  objects.push({ type: 'npc', npcId: 'merchant', x: 125, y: 54, name: 'Comerciante' });
  objects.push({ type: 'npc', npcId: 'knight', x: 18, y: 56, name: 'Capitan' });
  objects.push({ type: 'npc', npcId: 'princess', x: 80, y: 14, name: 'Princesa' });
  objects.push({ type: 'npc', npcId: 'wizard', x: 68, y: 22, name: 'Mago' });
  objects.push({ type: 'npc', npcId: 'ranger', x: 80, y: 100, name: 'Guardabosques' });

  // ─── War Gate ───
  objects.push({ type: 'war_gate', x: 12, y: 70, name: 'War Gate' });

  // ─── Resource zone markers ───
  for (const zone of resourceZones) {
    objects.push(zone);
  }

  // ─── Other kingdom territories (visible but non-interactive for now) ───
  objects.push({ type: 'rival_kingdom', x: 140, y: 40, name: 'Reino del Norte', faction: 'north' });
  objects.push({ type: 'rival_kingdom', x: 15, y: 100, name: 'Reino del Sur', faction: 'south' });

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    tileSize: TILE_SIZE,
    layers: {
      ground,
      decoration,
      collision,
    },
    objects,
    tileIndices: T,
    buildingIndices: B,
  };
}

export { MAP_WIDTH, MAP_HEIGHT, TILE_SIZE, T, B };
