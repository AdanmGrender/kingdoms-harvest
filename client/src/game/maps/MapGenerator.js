/**
 * Programmatic tilemap generator for Kingdoms Harvest.
 * Generates Phaser-compatible tilemap data with zones:
 * Farm (center), Castle (north), Market (east), Barracks (west), Wilderness (south).
 */

const MAP_WIDTH = 80;
const MAP_HEIGHT = 60;
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

export function generateWorldMap(seed = 42) {
  const rand = seededRandom(seed);
  const ground = [];
  const decoration = [];
  const collision = [];

  // Initialize layers with grass
  for (let y = 0; y < MAP_HEIGHT; y++) {
    ground[y] = [];
    decoration[y] = [];
    collision[y] = [];
    for (let x = 0; x < MAP_WIDTH; x++) {
      ground[y][x] = rand() > 0.3 ? T.GRASS1 : T.GRASS2;
      decoration[y][x] = -1; // -1 = empty
      collision[y][x] = 0;   // 0 = passable, 1 = blocked
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

  function placePath(x1, y1, x2, y2) {
    // Horizontal then vertical
    const dx = x2 > x1 ? 1 : -1;
    const dy = y2 > y1 ? 1 : -1;
    for (let x = x1; x !== x2; x += dx) {
      ground[y1][x] = T.DIRT;
      if (y1 > 0) ground[y1 - 1][x] = T.DIRT_LIGHT;
      if (y1 < MAP_HEIGHT - 1) ground[y1 + 1][x] = T.DIRT_LIGHT;
    }
    for (let y = y1; y !== y2; y += dy) {
      ground[y][x2] = T.DIRT;
      if (x2 > 0) ground[y][x2 - 1] = T.DIRT_LIGHT;
      if (x2 < MAP_WIDTH - 1) ground[y][x2 + 1] = T.DIRT_LIGHT;
    }
  }

  // ─── WATER BORDER (south edge = river) ───
  for (let x = 0; x < MAP_WIDTH; x++) {
    ground[MAP_HEIGHT - 1][x] = T.WATER;
    ground[MAP_HEIGHT - 2][x] = T.WATER;
    ground[MAP_HEIGHT - 3][x] = T.SAND;
    collision[MAP_HEIGHT - 1][x] = 1;
    collision[MAP_HEIGHT - 2][x] = 1;
  }

  // Bridge over river
  for (let x = 38; x <= 42; x++) {
    ground[MAP_HEIGHT - 2][x] = T.BRIDGE;
    ground[MAP_HEIGHT - 1][x] = T.BRIDGE;
    collision[MAP_HEIGHT - 2][x] = 0;
    collision[MAP_HEIGHT - 1][x] = 0;
  }

  // ─── TREE BORDER (edges of map) ───
  for (let x = 0; x < MAP_WIDTH; x++) {
    for (let y = 0; y < 3; y++) {
      decoration[y][x] = T.TREE;
      collision[y][x] = 1;
    }
  }
  for (let y = 0; y < MAP_HEIGHT; y++) {
    for (let x = 0; x < 3; x++) {
      decoration[y][x] = T.TREE;
      collision[y][x] = 1;
    }
    for (let x = MAP_WIDTH - 3; x < MAP_WIDTH; x++) {
      decoration[y][x] = T.TREE;
      collision[y][x] = 1;
    }
  }

  // ─── PATHS (connecting zones) ───
  // Center crossroads
  const centerX = 40, centerY = 30;
  // Horizontal main road
  for (let x = 5; x < MAP_WIDTH - 5; x++) {
    ground[centerY][x] = T.DIRT;
    ground[centerY - 1][x] = T.DIRT_LIGHT;
    ground[centerY + 1][x] = T.DIRT_LIGHT;
  }
  // Vertical main road
  for (let y = 5; y < MAP_HEIGHT - 5; y++) {
    ground[y][centerX] = T.DIRT;
    ground[y][centerX - 1] = T.DIRT_LIGHT;
    ground[y][centerX + 1] = T.DIRT_LIGHT;
  }

  // ─── CASTLE ZONE (north-center, y: 5-18) ───
  // Cobblestone courtyard
  fillArea(ground, 30, 5, 20, 14, T.COBBLESTONE);

  // ─── FARM ZONE (center, y: 22-42, x: 20-55) ───
  // Fence around farm
  for (let x = 20; x < 56; x++) {
    decoration[22][x] = T.FENCE_H;
    decoration[42][x] = T.FENCE_H;
  }
  for (let y = 22; y < 43; y++) {
    decoration[y][20] = T.FENCE_V;
    decoration[y][55] = T.FENCE_V;
  }
  // Don't collide with fences — just decorative. Gates at paths.

  // Farm dirt interior
  fillArea(ground, 21, 23, 34, 19, T.GRASS_DARK);

  // ─── MARKET ZONE (east, x: 60-75) ───
  fillArea(ground, 60, 24, 15, 16, T.COBBLESTONE);

  // ─── BARRACKS ZONE (west, x: 5-18) ───
  fillArea(ground, 5, 24, 13, 16, T.STONE);

  // ─── WILDERNESS (south, y: 45-55) ───
  // Scattered trees and tall grass
  for (let y = 46; y < MAP_HEIGHT - 3; y++) {
    for (let x = 5; x < MAP_WIDTH - 5; x++) {
      if (rand() < 0.06) {
        decoration[y][x] = T.TREE;
        collision[y][x] = 1;
      } else if (rand() < 0.1) {
        decoration[y][x] = T.TALL_GRASS;
      } else if (rand() < 0.03) {
        decoration[y][x] = T.ROCK;
        collision[y][x] = 1;
      }
    }
  }

  // ─── Scatter flowers and bushes in grass areas ───
  for (let y = 4; y < MAP_HEIGHT - 4; y++) {
    for (let x = 4; x < MAP_WIDTH - 4; x++) {
      if (decoration[y][x] !== -1) continue;
      if (ground[y][x] !== T.GRASS1 && ground[y][x] !== T.GRASS2) continue;
      const r = rand();
      if (r < 0.01) decoration[y][x] = T.FLOWER_RED;
      else if (r < 0.02) decoration[y][x] = T.FLOWER_BLUE;
      else if (r < 0.025) {
        decoration[y][x] = T.ROCK;
        collision[y][x] = 1;
      }
    }
  }

  // ─── OBJECTS (NPCs, buildings, farm plots, spawn) ───
  const objects = [];

  // Player spawn point (center of map)
  objects.push({ type: 'spawn', x: centerX, y: centerY + 2, name: 'player_spawn' });

  // ─── Buildings ───
  // Castle zone buildings
  objects.push({ type: 'building', buildingId: 'throne_room', x: 37, y: 6, tileIndex: B.THRONE_ROOM });
  objects.push({ type: 'building', buildingId: 'library', x: 32, y: 10, tileIndex: B.LIBRARY });
  objects.push({ type: 'building', buildingId: 'embassy', x: 44, y: 10, tileIndex: B.EMBASSY });

  // Farm zone buildings
  objects.push({ type: 'building', buildingId: 'barn', x: 22, y: 24, tileIndex: B.BARN });
  objects.push({ type: 'building', buildingId: 'mill', x: 50, y: 24, tileIndex: B.MILL });
  objects.push({ type: 'building', buildingId: 'stable', x: 22, y: 36, tileIndex: B.STABLE });
  objects.push({ type: 'building', buildingId: 'sawmill', x: 50, y: 36, tileIndex: B.SAWMILL });

  // Market zone buildings
  objects.push({ type: 'building', buildingId: 'market', x: 63, y: 26, tileIndex: B.MARKET });
  objects.push({ type: 'building', buildingId: 'tavern', x: 63, y: 32, tileIndex: B.TAVERN });
  objects.push({ type: 'building', buildingId: 'smithy', x: 70, y: 29, tileIndex: B.SMITHY });

  // Barracks zone buildings
  objects.push({ type: 'building', buildingId: 'barracks', x: 8, y: 26, tileIndex: B.BARRACKS });
  objects.push({ type: 'building', buildingId: 'wall', x: 8, y: 34, tileIndex: B.WALL });
  objects.push({ type: 'building', buildingId: 'tower', x: 14, y: 26, tileIndex: B.TOWER });

  // ─── Farm Plots (3x3 grid in center of farm zone) ───
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      objects.push({
        type: 'farm_plot',
        x: 30 + c * 6,
        y: 27 + r * 5,
        plotIndex: r * 3 + c,
      });
    }
  }

  // ─── Animal Pasture (right side of farm zone) ───
  objects.push({ type: 'animal_zone', x: 46, y: 28, width: 8, height: 10, name: 'pasture' });

  // ─── NPCs ───
  objects.push({ type: 'npc', npcId: 'farmer', x: 28, y: 32, name: 'Granjero' });
  objects.push({ type: 'npc', npcId: 'baker', x: 52, y: 28, name: 'Panadero' });
  objects.push({ type: 'npc', npcId: 'merchant', x: 66, y: 28, name: 'Comerciante' });
  objects.push({ type: 'npc', npcId: 'knight', x: 10, y: 30, name: 'Capitan' });
  objects.push({ type: 'npc', npcId: 'princess', x: 40, y: 8, name: 'Princesa' });
  objects.push({ type: 'npc', npcId: 'wizard', x: 34, y: 12, name: 'Mago' });
  objects.push({ type: 'npc', npcId: 'ranger', x: 40, y: 48, name: 'Guardabosques' });

  // ─── War Gate (for combat zone entrance) ───
  objects.push({ type: 'war_gate', x: 6, y: 38, name: 'War Gate' });

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
