/**
 * Generates placeholder pixel art sprite sheets for Kingdoms Harvest.
 * Run: node tools/generate-sprites.js
 * Output: client/public/assets/game/
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, '..', 'client', 'public', 'assets', 'game');

// ─── Color Palette (medieval / earthy) ───
const C = {
  transparent: [0, 0, 0, 0],
  black: [30, 30, 30, 255],
  white: [240, 240, 230, 255],
  // Terrain
  grass1: [76, 153, 0, 255],
  grass2: [86, 163, 20, 255],
  grass3: [66, 143, 10, 255],
  dirt: [139, 105, 60, 255],
  dirtLight: [160, 125, 80, 255],
  dirtDark: [110, 80, 40, 255],
  water: [50, 120, 200, 255],
  waterLight: [70, 140, 220, 255],
  sand: [210, 190, 130, 255],
  stone: [140, 140, 140, 255],
  stoneDark: [100, 100, 100, 255],
  wood: [139, 90, 43, 255],
  woodDark: [100, 65, 30, 255],
  woodLight: [170, 120, 60, 255],
  leaf: [34, 120, 15, 255],
  leafDark: [20, 90, 10, 255],
  flower1: [255, 100, 100, 255],
  flower2: [255, 200, 50, 255],
  flower3: [150, 100, 255, 255],
  fenceBrown: [120, 80, 40, 255],
  // Crops
  soil: [100, 70, 35, 255],
  soilWet: [70, 50, 25, 255],
  seedling: [100, 180, 60, 255],
  plantGreen: [50, 160, 30, 255],
  plantDark: [30, 120, 20, 255],
  wheatGold: [220, 190, 60, 255],
  carrotOrange: [240, 140, 30, 255],
  potatoBrown: [180, 150, 80, 255],
  tomatoRed: [220, 50, 30, 255],
  cornYellow: [240, 210, 60, 255],
  pumpkinOrange: [230, 120, 20, 255],
  grapeViolet: [130, 50, 160, 255],
  // Characters
  skin: [240, 200, 160, 255],
  skinShadow: [210, 170, 130, 255],
  hair: [80, 50, 30, 255],
  hairLight: [140, 90, 40, 255],
  tunic: [60, 100, 170, 255],
  tunicDark: [40, 70, 130, 255],
  pants: [70, 60, 50, 255],
  boots: [60, 40, 25, 255],
  // NPC colors
  farmerGreen: [60, 140, 40, 255],
  bakerWhite: [230, 220, 200, 255],
  princessPink: [220, 100, 150, 255],
  wizardPurple: [100, 50, 160, 255],
  knightSilver: [180, 180, 190, 255],
  merchantGold: [200, 170, 50, 255],
  rangerBrown: [100, 80, 40, 255],
  // Animals
  chickenWhite: [240, 235, 220, 255],
  chickenComb: [220, 40, 30, 255],
  chickenBeak: [240, 180, 40, 255],
  cowBrown: [140, 90, 50, 255],
  cowSpot: [240, 235, 220, 255],
  sheepWool: [230, 225, 215, 255],
  sheepFace: [60, 50, 40, 255],
  // Buildings
  roofRed: [180, 50, 30, 255],
  roofDark: [140, 35, 20, 255],
  wallBeige: [210, 190, 150, 255],
  wallDark: [180, 160, 120, 255],
  doorBrown: [100, 60, 30, 255],
  windowBlue: [100, 160, 220, 255],
  towerGray: [160, 160, 170, 255],
  // UI
  gold: [255, 215, 0, 255],
  red: [220, 50, 50, 255],
  blue: [50, 100, 200, 255],
  green: [50, 180, 50, 255],
  panelBg: [30, 30, 50, 220],
  panelBorder: [100, 80, 60, 255],
};

function createPNG(w, h) {
  const png = new PNG({ width: w, height: h });
  // Fill transparent
  for (let i = 0; i < png.data.length; i += 4) {
    png.data[i] = 0; png.data[i+1] = 0; png.data[i+2] = 0; png.data[i+3] = 0;
  }
  return png;
}

function setPixel(png, x, y, color) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const idx = (y * png.width + x) * 4;
  png.data[idx] = color[0];
  png.data[idx+1] = color[1];
  png.data[idx+2] = color[2];
  png.data[idx+3] = color[3];
}

function fillRect(png, x, y, w, h, color) {
  for (let dy = 0; dy < h; dy++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(png, x + dx, y + dy, color);
    }
  }
}

function drawCircle(png, cx, cy, r, color) {
  for (let dy = -r; dy <= r; dy++) {
    for (let dx = -r; dx <= r; dx++) {
      if (dx*dx + dy*dy <= r*r) {
        setPixel(png, cx + dx, cy + dy, color);
      }
    }
  }
}

function drawOutline(png, x, y, w, h, color, thickness = 1) {
  for (let t = 0; t < thickness; t++) {
    for (let dx = 0; dx < w; dx++) {
      setPixel(png, x + dx, y + t, color);
      setPixel(png, x + dx, y + h - 1 - t, color);
    }
    for (let dy = 0; dy < h; dy++) {
      setPixel(png, x + t, y + dy, color);
      setPixel(png, x + w - 1 - t, y + dy, color);
    }
  }
}

function savePNG(png, relPath) {
  const fullPath = path.join(OUT, relPath);
  fs.mkdirSync(path.dirname(fullPath), { recursive: true });
  const buffer = PNG.sync.write(png);
  fs.writeFileSync(fullPath, buffer);
  console.log(`  Created: ${relPath} (${png.width}x${png.height})`);
}

// ═══════════════════════════════════════════════════════════════
// TERRAIN TILESET (512x512, 16x16 tiles of 32x32 each)
// ═══════════════════════════════════════════════════════════════
function generateTerrain() {
  console.log('\nGenerating terrain tileset...');
  const TILE = 32;
  const COLS = 16;
  const png = createPNG(COLS * TILE, COLS * TILE);

  function drawTile(tileIdx, drawFn) {
    const tx = (tileIdx % COLS) * TILE;
    const ty = Math.floor(tileIdx / COLS) * TILE;
    drawFn(png, tx, ty, TILE);
  }

  // Tile 0: Grass (base)
  drawTile(0, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.grass1);
    // Random grass detail
    for (let i = 0; i < 8; i++) {
      const dx = (i * 7 + 3) % s;
      const dy = (i * 11 + 5) % s;
      setPixel(p, tx + dx, ty + dy, C.grass2);
      setPixel(p, tx + dx, ty + dy - 1, C.grass3);
    }
  });

  // Tile 1: Grass variant 2
  drawTile(1, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.grass2);
    for (let i = 0; i < 6; i++) {
      const dx = (i * 9 + 2) % s;
      const dy = (i * 13 + 7) % s;
      setPixel(p, tx + dx, ty + dy, C.grass1);
      setPixel(p, tx + dx + 1, ty + dy, C.grass3);
    }
  });

  // Tile 2: Dirt path
  drawTile(2, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.dirt);
    for (let i = 0; i < 5; i++) {
      const dx = (i * 8 + 4) % s;
      const dy = (i * 10 + 3) % s;
      setPixel(p, tx + dx, ty + dy, C.dirtLight);
    }
  });

  // Tile 3: Dirt path variant
  drawTile(3, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.dirtLight);
    for (let i = 0; i < 4; i++) {
      setPixel(p, tx + (i*7+5)%s, ty + (i*9+2)%s, C.dirtDark);
    }
  });

  // Tile 4: Water
  drawTile(4, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.water);
    // Wave lines
    for (let x = 0; x < s; x += 4) {
      setPixel(p, tx + x, ty + 10, C.waterLight);
      setPixel(p, tx + x + 1, ty + 10, C.waterLight);
      setPixel(p, tx + x + 2, ty + 20, C.waterLight);
      setPixel(p, tx + x + 3, ty + 20, C.waterLight);
    }
  });

  // Tile 5: Sand
  drawTile(5, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.sand);
    for (let i = 0; i < 3; i++) {
      setPixel(p, tx + (i*11+3)%s, ty + (i*7+5)%s, C.dirtLight);
    }
  });

  // Tile 6: Stone floor
  drawTile(6, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.stone);
    // Grid lines
    fillRect(p, tx, ty + 15, s, 2, C.stoneDark);
    fillRect(p, tx + 15, ty, 2, s, C.stoneDark);
  });

  // Tile 7: Grass with flower (red)
  drawTile(7, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.grass1);
    drawCircle(p, tx + 16, ty + 16, 3, C.flower1);
    setPixel(p, tx + 16, ty + 16, C.flower2);
  });

  // Tile 8: Grass with flower (blue)
  drawTile(8, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.grass2);
    drawCircle(p, tx + 10, ty + 20, 2, C.flower3);
    drawCircle(p, tx + 22, ty + 12, 2, C.flower3);
  });

  // Tile 9: Fence horizontal
  drawTile(9, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.grass1);
    fillRect(p, tx, ty + 12, s, 3, C.fenceBrown);
    fillRect(p, tx, ty + 20, s, 3, C.fenceBrown);
    // Posts
    fillRect(p, tx + 2, ty + 8, 3, 18, C.wood);
    fillRect(p, tx + 27, ty + 8, 3, 18, C.wood);
  });

  // Tile 10: Fence vertical
  drawTile(10, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.grass1);
    fillRect(p, tx + 12, ty, 3, s, C.fenceBrown);
    fillRect(p, tx + 20, ty, 3, s, C.fenceBrown);
    fillRect(p, tx + 8, ty + 2, 18, 3, C.wood);
    fillRect(p, tx + 8, ty + 27, 18, 3, C.wood);
  });

  // Tile 11: Tree (trunk at bottom, leaves at top)
  drawTile(11, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.grass1);
    // Trunk
    fillRect(p, tx + 13, ty + 18, 6, 14, C.wood);
    fillRect(p, tx + 12, ty + 20, 8, 2, C.woodDark);
    // Leaves (circle)
    drawCircle(p, tx + 16, ty + 12, 10, C.leaf);
    drawCircle(p, tx + 16, ty + 10, 7, C.leafDark);
  });

  // Tile 12: Rock
  drawTile(12, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.grass1);
    drawCircle(p, tx + 16, ty + 20, 8, C.stone);
    drawCircle(p, tx + 16, ty + 18, 6, C.stoneDark);
    // Highlight
    setPixel(p, tx + 12, ty + 15, C.white);
    setPixel(p, tx + 13, ty + 15, C.white);
  });

  // Tile 13: Bridge horizontal
  drawTile(13, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.water);
    fillRect(p, tx, ty + 8, s, 16, C.woodLight);
    fillRect(p, tx, ty + 8, s, 2, C.woodDark);
    fillRect(p, tx, ty + 22, s, 2, C.woodDark);
    // Planks
    for (let x = 4; x < s; x += 8) {
      fillRect(p, tx + x, ty + 10, 1, 12, C.woodDark);
    }
  });

  // Tile 14: Grass-to-dirt transition (top)
  drawTile(14, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s/2, C.grass1);
    fillRect(p, tx, ty + s/2, s, s/2, C.dirt);
    // Blend edge
    for (let x = 0; x < s; x += 2) {
      setPixel(p, tx + x, ty + s/2, C.grass1);
    }
  });

  // Tile 15: Fence corner
  drawTile(15, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.grass1);
    fillRect(p, tx + 12, ty + 12, 3, 20, C.fenceBrown);
    fillRect(p, tx + 12, ty + 12, 20, 3, C.fenceBrown);
    fillRect(p, tx + 10, ty + 10, 6, 6, C.wood);
  });

  // Tiles 16-31: More variations (dark grass, path edges, etc.)
  // Tile 16: Dark grass
  drawTile(16, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.grass3);
  });

  // Tile 17: Cobblestone
  drawTile(17, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.stoneDark);
    for (let y = 0; y < s; y += 8) {
      for (let x = 0; x < s; x += 8) {
        const offset = (y/8 % 2) * 4;
        fillRect(p, tx + x + offset, ty + y, 7, 7, C.stone);
      }
    }
  });

  // Tile 18: Grass with tall grass/bush
  drawTile(18, (p, tx, ty, s) => {
    fillRect(p, tx, ty, s, s, C.grass1);
    // Tall grass blades
    for (let i = 0; i < 5; i++) {
      const bx = tx + 4 + i * 6;
      fillRect(p, bx, ty + 14, 2, 12, C.plantGreen);
      fillRect(p, bx, ty + 12, 3, 3, C.seedling);
    }
  });

  savePNG(png, 'tilesets/terrain.png');
  return png;
}

// ═══════════════════════════════════════════════════════════════
// FARM TILES (256x256, 8x8 grid of 32x32 tiles)
// ═══════════════════════════════════════════════════════════════
function generateFarmTiles() {
  console.log('Generating farm tileset...');
  const TILE = 32;
  const COLS = 8;
  const png = createPNG(COLS * TILE, COLS * TILE);

  function drawTile(tileIdx, drawFn) {
    const tx = (tileIdx % COLS) * TILE;
    const ty = Math.floor(tileIdx / COLS) * TILE;
    drawFn(png, tx, ty, TILE);
  }

  // Base function: tilled soil
  function drawSoil(p, tx, ty, s, wet) {
    fillRect(p, tx, ty, s, s, wet ? C.soilWet : C.soil);
    // Furrow lines
    for (let y = 4; y < s; y += 6) {
      fillRect(p, tx + 2, ty + y, s - 4, 1, C.dirtDark);
    }
  }

  // Tile 0: Dry tilled soil
  drawTile(0, (p, tx, ty, s) => drawSoil(p, tx, ty, s, false));

  // Tile 1: Wet tilled soil
  drawTile(1, (p, tx, ty, s) => drawSoil(p, tx, ty, s, true));

  // Crop stages for each type (4 stages each)
  const crops = [
    { name: 'wheat', colors: [C.seedling, C.plantGreen, C.plantDark, C.wheatGold] },
    { name: 'carrot', colors: [C.seedling, C.plantGreen, C.plantDark, C.carrotOrange] },
    { name: 'potato', colors: [C.seedling, C.plantGreen, C.plantDark, C.potatoBrown] },
    { name: 'tomato', colors: [C.seedling, C.plantGreen, C.plantDark, C.tomatoRed] },
    { name: 'corn', colors: [C.seedling, C.plantGreen, C.plantDark, C.cornYellow] },
    { name: 'pumpkin', colors: [C.seedling, C.plantGreen, C.plantDark, C.pumpkinOrange] },
    { name: 'grape', colors: [C.seedling, C.plantGreen, C.plantDark, C.grapeViolet] },
  ];

  let tileIdx = 2;
  for (const crop of crops) {
    // Stage 0: Seed/seedling (tiny sprout)
    drawTile(tileIdx++, (p, tx, ty, s) => {
      drawSoil(p, tx, ty, s, true);
      fillRect(p, tx + 14, ty + 22, 4, 6, crop.colors[0]);
      setPixel(p, tx + 15, ty + 20, crop.colors[0]);
      setPixel(p, tx + 16, ty + 20, crop.colors[0]);
    });

    // Stage 1: Small plant
    drawTile(tileIdx++, (p, tx, ty, s) => {
      drawSoil(p, tx, ty, s, true);
      fillRect(p, tx + 14, ty + 16, 4, 12, crop.colors[1]);
      // Small leaves
      fillRect(p, tx + 11, ty + 16, 3, 3, crop.colors[1]);
      fillRect(p, tx + 18, ty + 18, 3, 3, crop.colors[1]);
    });

    // Stage 2: Medium plant
    drawTile(tileIdx++, (p, tx, ty, s) => {
      drawSoil(p, tx, ty, s, true);
      fillRect(p, tx + 13, ty + 10, 6, 18, crop.colors[2]);
      // Leaves
      fillRect(p, tx + 8, ty + 12, 6, 4, crop.colors[1]);
      fillRect(p, tx + 18, ty + 14, 6, 4, crop.colors[1]);
      fillRect(p, tx + 10, ty + 18, 5, 3, crop.colors[1]);
    });

    // Stage 3: Ready (full grown with fruit color)
    drawTile(tileIdx++, (p, tx, ty, s) => {
      drawSoil(p, tx, ty, s, true);
      fillRect(p, tx + 12, ty + 6, 8, 22, crop.colors[2]);
      // Fruit/product at top
      drawCircle(p, tx + 16, ty + 8, 5, crop.colors[3]);
      // Full leaves
      fillRect(p, tx + 6, ty + 10, 8, 5, crop.colors[1]);
      fillRect(p, tx + 18, ty + 12, 8, 5, crop.colors[1]);
      fillRect(p, tx + 8, ty + 18, 6, 4, crop.colors[1]);
      fillRect(p, tx + 18, ty + 20, 6, 4, crop.colors[1]);
    });
  }

  savePNG(png, 'tilesets/farm_tiles.png');
}

// ═══════════════════════════════════════════════════════════════
// PLAYER CHARACTER (128x192, 4 cols x 4 rows, 32x48 each frame)
// walk_down(4), walk_left(4), walk_right(4), walk_up(4)
// ═══════════════════════════════════════════════════════════════
function generatePlayer() {
  console.log('Generating player character...');
  const FW = 32, FH = 48;
  const COLS = 4, ROWS = 4;
  const png = createPNG(FW * COLS, FH * ROWS);

  function drawCharFrame(fx, fy, dir, frame) {
    const ox = fx * FW, oy = fy * FH;

    // Body proportions for 32x48
    const headY = 4, headH = 14, headW = 12;
    const bodyY = headY + headH, bodyH = 16;
    const legY = bodyY + bodyH, legH = 12;
    const headX = (FW - headW) / 2;

    // Legs (walking animation - offset based on frame)
    const legOffset = (frame % 2 === 0) ? 0 : 2;
    const legW = 5;
    // Left leg
    fillRect(png, ox + 9, oy + legY - legOffset, legW, legH + legOffset, C.pants);
    fillRect(png, ox + 9, oy + legY + legH - 3, legW, 3, C.boots);
    // Right leg
    fillRect(png, ox + 18, oy + legY + legOffset, legW, legH - legOffset, C.pants);
    fillRect(png, ox + 18, oy + legY + legH - 3, legW, 3, C.boots);

    // Body/tunic
    fillRect(png, ox + 8, oy + bodyY, 16, bodyH, C.tunic);
    fillRect(png, ox + 7, oy + bodyY, 1, bodyH - 2, C.tunicDark);
    fillRect(png, ox + 24, oy + bodyY, 1, bodyH - 2, C.tunicDark);

    // Arms (swing with walk)
    const armSwing = (frame % 2 === 0) ? 0 : 3;
    if (dir !== 1 && dir !== 2) { // front/back - both arms visible
      fillRect(png, ox + 4, oy + bodyY + 2 + armSwing, 4, 12, C.tunic);
      fillRect(png, ox + 4, oy + bodyY + 12 + armSwing, 4, 3, C.skin);
      fillRect(png, ox + 24, oy + bodyY + 2 - armSwing, 4, 12, C.tunic);
      fillRect(png, ox + 24, oy + bodyY + 12 - armSwing, 4, 3, C.skin);
    } else if (dir === 1) { // left
      fillRect(png, ox + 6, oy + bodyY + 2 + armSwing, 4, 12, C.tunic);
      fillRect(png, ox + 6, oy + bodyY + 12 + armSwing, 4, 3, C.skin);
    } else { // right
      fillRect(png, ox + 22, oy + bodyY + 2 + armSwing, 4, 12, C.tunic);
      fillRect(png, ox + 22, oy + bodyY + 12 + armSwing, 4, 3, C.skin);
    }

    // Head
    fillRect(png, ox + headX, oy + headY, headW, headH, C.skin);

    // Face based on direction
    if (dir === 0) { // Down (facing camera)
      // Eyes
      fillRect(png, ox + 12, oy + headY + 6, 2, 3, C.black);
      fillRect(png, ox + 18, oy + headY + 6, 2, 3, C.black);
      // Mouth
      fillRect(png, ox + 14, oy + headY + 11, 4, 1, C.skinShadow);
      // Hair
      fillRect(png, ox + headX - 1, oy + headY - 2, headW + 2, 5, C.hair);
      fillRect(png, ox + headX - 1, oy + headY + 2, 2, 4, C.hair);
      fillRect(png, ox + headX + headW - 1, oy + headY + 2, 2, 4, C.hair);
    } else if (dir === 3) { // Up (back)
      fillRect(png, ox + headX - 1, oy + headY - 2, headW + 2, headH + 1, C.hair);
    } else if (dir === 1) { // Left
      fillRect(png, ox + 12, oy + headY + 6, 2, 3, C.black);
      fillRect(png, ox + 11, oy + headY + 11, 3, 1, C.skinShadow);
      fillRect(png, ox + headX - 1, oy + headY - 2, headW + 1, 5, C.hair);
      fillRect(png, ox + headX + headW - 1, oy + headY + 2, 2, 6, C.hair);
    } else { // Right
      fillRect(png, ox + 18, oy + headY + 6, 2, 3, C.black);
      fillRect(png, ox + 18, oy + headY + 11, 3, 1, C.skinShadow);
      fillRect(png, ox + headX, oy + headY - 2, headW + 1, 5, C.hair);
      fillRect(png, ox + headX - 1, oy + headY + 2, 2, 6, C.hair);
    }
  }

  // Row 0: walk_down (frames 0-3)
  for (let f = 0; f < COLS; f++) drawCharFrame(f, 0, 0, f);
  // Row 1: walk_left (frames 0-3)
  for (let f = 0; f < COLS; f++) drawCharFrame(f, 1, 1, f);
  // Row 2: walk_right (frames 0-3)
  for (let f = 0; f < COLS; f++) drawCharFrame(f, 2, 2, f);
  // Row 3: walk_up (frames 0-3)
  for (let f = 0; f < COLS; f++) drawCharFrame(f, 3, 3, f);

  savePNG(png, 'characters/player.png');
}

// ═══════════════════════════════════════════════════════════════
// NPC CHARACTERS (64x48 each, 2-frame idle)
// ═══════════════════════════════════════════════════════════════
function generateNPCs() {
  console.log('Generating NPC sprites...');

  const npcs = [
    { name: 'farmer', tunic: C.farmerGreen, hair: C.hairLight, hat: C.wheatGold },
    { name: 'baker', tunic: C.bakerWhite, hair: C.hair, hat: C.bakerWhite },
    { name: 'princess', tunic: C.princessPink, hair: C.wheatGold, hat: null },
    { name: 'wizard', tunic: C.wizardPurple, hair: [200,200,210,255], hat: C.wizardPurple },
    { name: 'knight', tunic: C.knightSilver, hair: C.hair, hat: C.knightSilver },
    { name: 'merchant', tunic: C.merchantGold, hair: C.hair, hat: C.merchantGold },
    { name: 'ranger', tunic: C.rangerBrown, hair: C.hairLight, hat: C.rangerBrown },
  ];

  for (const npc of npcs) {
    const FW = 32, FH = 48;
    const png = createPNG(FW * 2, FH);

    for (let frame = 0; frame < 2; frame++) {
      const ox = frame * FW;
      const bob = frame; // 1px bob on frame 1

      // Legs
      fillRect(png, ox + 10, 34 - bob, 5, 12, C.pants);
      fillRect(png, ox + 17, 34 - bob, 5, 12, C.pants);
      fillRect(png, ox + 10, 43 - bob, 5, 3, C.boots);
      fillRect(png, ox + 17, 43 - bob, 5, 3, C.boots);

      // Body
      fillRect(png, ox + 8, 18 - bob, 16, 16, npc.tunic);

      // Arms
      fillRect(png, ox + 4, 20 - bob, 4, 12, npc.tunic);
      fillRect(png, ox + 4, 30 - bob, 4, 3, C.skin);
      fillRect(png, ox + 24, 20 - bob, 4, 12, npc.tunic);
      fillRect(png, ox + 24, 30 - bob, 4, 3, C.skin);

      // Head
      fillRect(png, ox + 10, 4 - bob, 12, 14, C.skin);

      // Face
      fillRect(png, ox + 12, 10 - bob, 2, 3, C.black);
      fillRect(png, ox + 18, 10 - bob, 2, 3, C.black);
      fillRect(png, ox + 14, 15 - bob, 4, 1, C.skinShadow);

      // Hair
      fillRect(png, ox + 9, 2 - bob, 14, 5, npc.hair);

      // Hat or crown
      if (npc.hat) {
        if (npc.name === 'wizard') {
          // Pointy hat
          fillRect(png, ox + 8, 0 - bob, 16, 4, npc.hat);
          fillRect(png, ox + 12, -3 - bob, 8, 4, npc.hat);
          fillRect(png, ox + 14, -5 - bob, 4, 3, npc.hat);
        } else if (npc.name === 'princess') {
          // No hat, just a tiara
        } else if (npc.name === 'knight') {
          // Helmet
          fillRect(png, ox + 8, 0 - bob, 16, 8, npc.hat);
          fillRect(png, ox + 12, 8 - bob, 8, 2, npc.hat);
        } else {
          // Simple hat
          fillRect(png, ox + 7, 0 - bob, 18, 4, npc.hat);
          fillRect(png, ox + 10, -2 - bob, 12, 3, npc.hat);
        }
      }
    }

    savePNG(png, `characters/npc_${npc.name}.png`);
  }
}

// ═══════════════════════════════════════════════════════════════
// ANIMALS (128x32, 4 frames of 32x32)
// ═══════════════════════════════════════════════════════════════
function generateAnimals() {
  console.log('Generating animal sprites...');

  // Chicken
  (() => {
    const png = createPNG(128, 32);
    for (let f = 0; f < 4; f++) {
      const ox = f * 32;
      const bob = (f % 2) * 2;
      // Body
      drawCircle(png, ox + 16, 18 - bob, 7, C.chickenWhite);
      // Head
      drawCircle(png, ox + 22, 10 - bob, 5, C.chickenWhite);
      // Eye
      setPixel(png, ox + 24, 9 - bob, C.black);
      // Beak
      fillRect(png, ox + 26, 11 - bob, 3, 2, C.chickenBeak);
      // Comb
      fillRect(png, ox + 21, 5 - bob, 4, 3, C.chickenComb);
      // Legs
      fillRect(png, ox + 13, 24 - bob, 2, 6, C.chickenBeak);
      fillRect(png, ox + 18, 24 - bob, 2, 6, C.chickenBeak);
      // Tail
      fillRect(png, ox + 7, 12 - bob, 3, 6, C.chickenWhite);
    }
    savePNG(png, 'animals/chicken.png');
  })();

  // Cow
  (() => {
    const png = createPNG(128, 32);
    for (let f = 0; f < 4; f++) {
      const ox = f * 32;
      const legOffset = (f % 2) * 2;
      // Body
      fillRect(png, ox + 6, 10, 20, 12, C.cowBrown);
      // Spots
      fillRect(png, ox + 10, 12, 5, 4, C.cowSpot);
      fillRect(png, ox + 18, 14, 4, 3, C.cowSpot);
      // Head
      fillRect(png, ox + 22, 6, 8, 10, C.cowBrown);
      // Eyes
      setPixel(png, ox + 26, 9, C.black);
      // Nose
      fillRect(png, ox + 28, 12, 3, 3, C.skin);
      // Horns
      fillRect(png, ox + 23, 4, 2, 3, C.sand);
      fillRect(png, ox + 28, 4, 2, 3, C.sand);
      // Legs
      fillRect(png, ox + 8, 22 - legOffset, 3, 8 + legOffset, C.cowBrown);
      fillRect(png, ox + 14, 22 + legOffset, 3, 8 - legOffset, C.cowBrown);
      fillRect(png, ox + 20, 22 - legOffset, 3, 8 + legOffset, C.cowBrown);
      // Tail
      fillRect(png, ox + 4, 10, 2, 8, C.cowBrown);
    }
    savePNG(png, 'animals/cow.png');
  })();

  // Sheep
  (() => {
    const png = createPNG(128, 32);
    for (let f = 0; f < 4; f++) {
      const ox = f * 32;
      const bob = (f % 2);
      // Wool body (fluffy circle)
      drawCircle(png, ox + 15, 14 - bob, 9, C.sheepWool);
      drawCircle(png, ox + 15, 12 - bob, 7, [245, 240, 230, 255]);
      // Head
      fillRect(png, ox + 22, 8 - bob, 7, 8, C.sheepFace);
      // Eyes
      setPixel(png, ox + 25, 10 - bob, C.white);
      setPixel(png, ox + 27, 10 - bob, C.white);
      // Ears
      fillRect(png, ox + 21, 7 - bob, 3, 3, C.sheepFace);
      // Legs
      fillRect(png, ox + 10, 22 - bob, 3, 8, C.sheepFace);
      fillRect(png, ox + 16, 22 - bob, 3, 8, C.sheepFace);
      fillRect(png, ox + 20, 22 - bob, 3, 8, C.sheepFace);
    }
    savePNG(png, 'animals/sheep.png');
  })();
}

// ═══════════════════════════════════════════════════════════════
// BUILDINGS (512x512, various sizes, organized in a grid)
// Each building is 64x64 in its cell
// ═══════════════════════════════════════════════════════════════
function generateBuildings() {
  console.log('Generating building sprites...');
  const CELL = 64;
  const COLS = 8;
  const png = createPNG(COLS * CELL, COLS * CELL);

  function drawBuilding(idx, drawFn) {
    const cx = (idx % COLS) * CELL;
    const cy = Math.floor(idx / COLS) * CELL;
    drawFn(png, cx, cy, CELL);
  }

  // 0: Barn
  drawBuilding(0, (p, cx, cy, s) => {
    // Walls
    fillRect(p, cx + 8, cy + 20, 48, 36, C.wallBeige);
    // Roof
    for (let i = 0; i < 16; i++) {
      fillRect(p, cx + 8 - i, cy + 20 - i, 48 + i*2, 2, C.roofRed);
    }
    fillRect(p, cx + 4, cy + 4, 56, 3, C.roofDark);
    // Door
    fillRect(p, cx + 24, cy + 36, 16, 20, C.doorBrown);
    fillRect(p, cx + 30, cy + 44, 3, 3, C.gold);
    // Windows
    fillRect(p, cx + 14, cy + 28, 8, 8, C.windowBlue);
    fillRect(p, cx + 42, cy + 28, 8, 8, C.windowBlue);
  });

  // 1: Mill
  drawBuilding(1, (p, cx, cy, s) => {
    // Tower
    fillRect(p, cx + 18, cy + 16, 28, 40, C.wallBeige);
    fillRect(p, cx + 18, cy + 16, 28, 3, C.wallDark);
    // Roof cone
    for (let i = 0; i < 12; i++) {
      fillRect(p, cx + 20 + i, cy + 6 + i, 24 - i*2, 2, C.roofRed);
    }
    // Windmill blades
    fillRect(p, cx + 30, cy + 2, 4, 28, C.wood);
    fillRect(p, cx + 18, cy + 14, 28, 4, C.wood);
    // Door
    fillRect(p, cx + 26, cy + 40, 12, 16, C.doorBrown);
  });

  // 2: Wall segment
  drawBuilding(2, (p, cx, cy, s) => {
    fillRect(p, cx + 4, cy + 20, 56, 36, C.stoneDark);
    fillRect(p, cx + 4, cy + 16, 56, 6, C.stone);
    // Crenelations
    for (let i = 0; i < 7; i++) {
      fillRect(p, cx + 4 + i*8, cy + 10, 6, 8, C.stone);
    }
  });

  // 3: Tower
  drawBuilding(3, (p, cx, cy, s) => {
    fillRect(p, cx + 14, cy + 16, 36, 44, C.towerGray);
    fillRect(p, cx + 14, cy + 16, 36, 3, C.stoneDark);
    // Top platform
    fillRect(p, cx + 10, cy + 10, 44, 8, C.towerGray);
    for (let i = 0; i < 5; i++) {
      fillRect(p, cx + 10 + i*9, cy + 4, 7, 8, C.towerGray);
    }
    // Window
    fillRect(p, cx + 28, cy + 30, 8, 12, C.windowBlue);
    // Door
    fillRect(p, cx + 26, cy + 46, 12, 14, C.doorBrown);
  });

  // 4: Barracks
  drawBuilding(4, (p, cx, cy, s) => {
    fillRect(p, cx + 6, cy + 24, 52, 32, C.wallBeige);
    // Roof
    for (let i = 0; i < 12; i++) {
      fillRect(p, cx + 4, cy + 24 - i, 56, 2, C.roofDark);
    }
    // Flag
    fillRect(p, cx + 50, cy + 2, 2, 20, C.wood);
    fillRect(p, cx + 44, cy + 2, 8, 6, C.red);
    // Door (large)
    fillRect(p, cx + 22, cy + 36, 20, 20, C.doorBrown);
    // Crossed swords emblem
    fillRect(p, cx + 29, cy + 40, 2, 12, C.knightSilver);
    fillRect(p, cx + 33, cy + 40, 2, 12, C.knightSilver);
  });

  // 5: Tavern
  drawBuilding(5, (p, cx, cy, s) => {
    fillRect(p, cx + 8, cy + 22, 48, 34, C.wood);
    fillRect(p, cx + 8, cy + 22, 48, 3, C.woodDark);
    // Roof
    for (let i = 0; i < 14; i++) {
      fillRect(p, cx + 6 - i/2, cy + 22 - i, 52 + i, 2, C.roofRed);
    }
    // Sign
    fillRect(p, cx + 48, cy + 18, 2, 16, C.wood);
    fillRect(p, cx + 42, cy + 18, 14, 10, C.gold);
    // Door
    fillRect(p, cx + 24, cy + 38, 16, 18, C.doorBrown);
    // Windows (warm light)
    fillRect(p, cx + 12, cy + 30, 10, 8, [255, 220, 100, 255]);
    fillRect(p, cx + 42, cy + 30, 10, 8, [255, 220, 100, 255]);
  });

  // 6: Market
  drawBuilding(6, (p, cx, cy, s) => {
    // Open stall
    fillRect(p, cx + 4, cy + 30, 56, 26, C.wood);
    fillRect(p, cx + 4, cy + 30, 56, 3, C.woodDark);
    // Canopy
    for (let x = 0; x < 56; x += 8) {
      fillRect(p, cx + 4 + x, cy + 14, 8, 18, (x / 8 % 2 === 0) ? C.red : C.bakerWhite);
    }
    // Poles
    fillRect(p, cx + 6, cy + 14, 3, 42, C.wood);
    fillRect(p, cx + 55, cy + 14, 3, 42, C.wood);
    // Goods on counter
    drawCircle(p, cx + 20, cy + 34, 4, C.tomatoRed);
    drawCircle(p, cx + 32, cy + 34, 4, C.wheatGold);
    drawCircle(p, cx + 44, cy + 34, 4, C.carrotOrange);
  });

  // 7: Throne Room / Castle
  drawBuilding(7, (p, cx, cy, s) => {
    // Main structure
    fillRect(p, cx + 10, cy + 20, 44, 36, C.stoneDark);
    // Towers on sides
    fillRect(p, cx + 4, cy + 10, 16, 46, C.towerGray);
    fillRect(p, cx + 44, cy + 10, 16, 46, C.towerGray);
    // Crenelations
    for (let i = 0; i < 3; i++) {
      fillRect(p, cx + 4 + i*6, cy + 4, 5, 8, C.towerGray);
      fillRect(p, cx + 44 + i*6, cy + 4, 5, 8, C.towerGray);
    }
    // Gate
    fillRect(p, cx + 22, cy + 34, 20, 22, C.doorBrown);
    fillRect(p, cx + 22, cy + 34, 20, 3, C.stoneDark);
    // Crown emblem
    fillRect(p, cx + 28, cy + 24, 8, 6, C.gold);
    fillRect(p, cx + 28, cy + 22, 2, 3, C.gold);
    fillRect(p, cx + 32, cy + 22, 2, 3, C.gold);
    fillRect(p, cx + 36, cy + 22, 2, 3, C.gold);
  });

  // 8: Library
  drawBuilding(8, (p, cx, cy, s) => {
    fillRect(p, cx + 10, cy + 22, 44, 34, C.wallBeige);
    for (let i = 0; i < 10; i++) {
      fillRect(p, cx + 8, cy + 22 - i, 48, 2, C.tunicDark);
    }
    // Dome top
    drawCircle(p, cx + 32, cy + 14, 8, C.tunicDark);
    // Door
    fillRect(p, cx + 26, cy + 40, 12, 16, C.doorBrown);
    // Book emblem
    fillRect(p, cx + 28, cy + 28, 8, 6, C.wizardPurple);
    fillRect(p, cx + 32, cy + 26, 1, 10, C.gold);
  });

  // 9: Stable
  drawBuilding(9, (p, cx, cy, s) => {
    fillRect(p, cx + 6, cy + 26, 52, 30, C.wood);
    for (let i = 0; i < 10; i++) {
      fillRect(p, cx + 4, cy + 26 - i, 56, 2, C.woodLight);
    }
    // Open front
    fillRect(p, cx + 14, cy + 34, 16, 22, C.dirtDark);
    fillRect(p, cx + 34, cy + 34, 16, 22, C.dirtDark);
    // Hay
    fillRect(p, cx + 16, cy + 44, 12, 8, C.wheatGold);
    fillRect(p, cx + 36, cy + 44, 12, 8, C.wheatGold);
  });

  // 10: Smithy
  drawBuilding(10, (p, cx, cy, s) => {
    fillRect(p, cx + 8, cy + 22, 48, 34, C.stoneDark);
    for (let i = 0; i < 12; i++) {
      fillRect(p, cx + 6, cy + 22 - i, 52, 2, C.stone);
    }
    // Chimney with smoke
    fillRect(p, cx + 44, cy + 4, 8, 20, C.stoneDark);
    drawCircle(p, cx + 48, cy + 2, 3, [180, 180, 180, 150]);
    // Door
    fillRect(p, cx + 24, cy + 38, 16, 18, C.doorBrown);
    // Anvil
    fillRect(p, cx + 12, cy + 44, 8, 4, C.stoneDark);
    fillRect(p, cx + 10, cy + 42, 12, 3, C.knightSilver);
    // Fire glow
    drawCircle(p, cx + 40, cy + 44, 4, [255, 100, 30, 200]);
  });

  // 11: Sawmill
  drawBuilding(11, (p, cx, cy, s) => {
    fillRect(p, cx + 8, cy + 26, 48, 30, C.wood);
    for (let i = 0; i < 10; i++) {
      fillRect(p, cx + 6, cy + 26 - i, 52, 2, C.woodDark);
    }
    // Saw blade circle
    drawCircle(p, cx + 32, cy + 24, 8, C.knightSilver);
    drawCircle(p, cx + 32, cy + 24, 5, C.stoneDark);
    // Logs
    drawCircle(p, cx + 14, cy + 48, 5, C.woodLight);
    drawCircle(p, cx + 24, cy + 50, 4, C.woodLight);
    // Door
    fillRect(p, cx + 28, cy + 40, 12, 16, C.doorBrown);
  });

  // 12: Trap
  drawBuilding(12, (p, cx, cy, s) => {
    fillRect(p, cx + 8, cy + 32, 48, 24, C.grass1);
    // Spikes
    for (let i = 0; i < 6; i++) {
      const sx = cx + 12 + i * 7;
      fillRect(p, sx, cy + 28, 4, 12, C.stoneDark);
      fillRect(p, sx + 1, cy + 24, 2, 6, C.knightSilver);
    }
    // Base plate
    fillRect(p, cx + 8, cy + 40, 48, 4, C.woodDark);
  });

  // 13: Embassy
  drawBuilding(13, (p, cx, cy, s) => {
    fillRect(p, cx + 10, cy + 22, 44, 34, C.wallBeige);
    for (let i = 0; i < 12; i++) {
      fillRect(p, cx + 8 - i/3, cy + 22 - i, 48 + i/1.5, 2, C.tunic);
    }
    // Columns
    fillRect(p, cx + 14, cy + 26, 4, 30, C.white);
    fillRect(p, cx + 46, cy + 26, 4, 30, C.white);
    // Flags
    fillRect(p, cx + 20, cy + 10, 2, 14, C.wood);
    fillRect(p, cx + 22, cy + 10, 6, 4, C.red);
    fillRect(p, cx + 40, cy + 10, 2, 14, C.wood);
    fillRect(p, cx + 34, cy + 10, 6, 4, C.blue);
    // Door
    fillRect(p, cx + 24, cy + 38, 16, 18, C.doorBrown);
  });

  // 14: Farm plot (visual)
  drawBuilding(14, (p, cx, cy, s) => {
    fillRect(p, cx + 2, cy + 2, 60, 60, C.soil);
    // Grid of plots
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        fillRect(p, cx + 4 + c*20, cy + 4 + r*20, 18, 18, C.soilWet);
        // Furrows
        for (let fy = 0; fy < 18; fy += 4) {
          fillRect(p, cx + 5 + c*20, cy + 4 + r*20 + fy, 16, 1, C.dirtDark);
        }
      }
    }
  });

  // 15: Construction site (scaffolding)
  drawBuilding(15, (p, cx, cy, s) => {
    // Scaffolding poles
    fillRect(p, cx + 8, cy + 8, 4, 48, C.wood);
    fillRect(p, cx + 52, cy + 8, 4, 48, C.wood);
    // Cross beams
    fillRect(p, cx + 8, cy + 20, 48, 3, C.woodLight);
    fillRect(p, cx + 8, cy + 38, 48, 3, C.woodLight);
    // Diagonal supports
    for (let i = 0; i < 14; i++) {
      setPixel(p, cx + 12 + i*3, cy + 20 + i, C.woodDark);
      setPixel(p, cx + 52 - i*3, cy + 20 + i, C.woodDark);
    }
    // Partial wall
    fillRect(p, cx + 16, cy + 32, 32, 24, [210, 190, 150, 150]);
  });

  savePNG(png, 'tilesets/buildings.png');
}

// ═══════════════════════════════════════════════════════════════
// EFFECTS (128x128, small particle sprites)
// ═══════════════════════════════════════════════════════════════
function generateEffects() {
  console.log('Generating effect sprites...');
  const png = createPNG(128, 128);

  // Sparkle (16x16 at 0,0)
  drawCircle(png, 8, 8, 2, C.gold);
  setPixel(png, 8, 3, C.gold);
  setPixel(png, 8, 13, C.gold);
  setPixel(png, 3, 8, C.gold);
  setPixel(png, 13, 8, C.gold);
  setPixel(png, 5, 5, [255, 255, 200, 200]);
  setPixel(png, 11, 5, [255, 255, 200, 200]);
  setPixel(png, 5, 11, [255, 255, 200, 200]);
  setPixel(png, 11, 11, [255, 255, 200, 200]);

  // Dust poof (16x16 at 16,0)
  drawCircle(png, 24, 8, 5, [180, 160, 120, 180]);
  drawCircle(png, 28, 6, 3, [200, 180, 140, 140]);
  drawCircle(png, 20, 10, 3, [160, 140, 100, 100]);

  // Slash (16x16 at 32,0)
  for (let i = 0; i < 12; i++) {
    setPixel(png, 34 + i, 2 + i, C.white);
    setPixel(png, 35 + i, 2 + i, C.white);
    setPixel(png, 34 + i, 3 + i, [200, 200, 255, 200]);
  }

  // Heart (16x16 at 48,0)
  drawCircle(png, 52, 6, 3, C.red);
  drawCircle(png, 58, 6, 3, C.red);
  for (let i = 0; i < 8; i++) {
    fillRect(png, 49 + i, 8, 12 - i*2, 1, C.red);
  }

  // Exclamation mark (16x16 at 64,0) - for NPC quests
  fillRect(png, 70, 2, 4, 8, C.gold);
  fillRect(png, 70, 12, 4, 3, C.gold);

  // Hunger icon (16x16 at 80,0) - for animals
  drawCircle(png, 88, 8, 6, C.red);
  fillRect(png, 86, 3, 4, 7, C.white);
  fillRect(png, 86, 12, 4, 2, C.white);

  // Coin (16x16 at 96,0)
  drawCircle(png, 104, 8, 6, C.gold);
  drawCircle(png, 104, 8, 4, [255, 230, 50, 255]);
  fillRect(png, 103, 5, 3, 7, C.gold);

  // XP star (16x16 at 112,0)
  drawCircle(png, 120, 8, 4, [100, 200, 255, 255]);
  setPixel(png, 120, 2, [100, 200, 255, 255]);
  setPixel(png, 120, 14, [100, 200, 255, 255]);
  setPixel(png, 114, 8, [100, 200, 255, 255]);
  setPixel(png, 126, 8, [100, 200, 255, 255]);

  savePNG(png, 'effects/effects.png');
}

// ═══════════════════════════════════════════════════════════════
// UI ELEMENTS
// ═══════════════════════════════════════════════════════════════
function generateUI() {
  console.log('Generating UI sprites...');

  // Dialog frame (320x120, 9-slice)
  (() => {
    const png = createPNG(320, 120);
    // Background
    fillRect(png, 0, 0, 320, 120, C.panelBg);
    // Border
    drawOutline(png, 0, 0, 320, 120, C.panelBorder, 3);
    // Inner border
    drawOutline(png, 4, 4, 312, 112, C.gold, 1);
    // Corner decorations
    for (const [cx, cy] of [[8, 8], [311, 8], [8, 111], [311, 111]]) {
      drawCircle(png, cx, cy, 3, C.gold);
    }
    savePNG(png, 'ui/dialog_frame.png');
  })();

  // Joystick (128x64: base 64x64 + thumb 64x64)
  (() => {
    const png = createPNG(128, 64);
    // Base circle
    drawCircle(png, 32, 32, 28, [40, 40, 60, 120]);
    drawCircle(png, 32, 32, 26, [60, 60, 80, 100]);
    // Directional arrows
    for (let i = 0; i < 4; i++) {
      setPixel(png, 32, 8, [200, 200, 200, 150]);
      setPixel(png, 32, 56, [200, 200, 200, 150]);
      setPixel(png, 8, 32, [200, 200, 200, 150]);
      setPixel(png, 56, 32, [200, 200, 200, 150]);
    }
    // Thumb circle
    drawCircle(png, 96, 32, 16, [100, 100, 140, 200]);
    drawCircle(png, 96, 32, 12, [130, 130, 170, 220]);
    drawCircle(png, 94, 30, 6, [160, 160, 200, 180]);
    savePNG(png, 'ui/joystick.png');
  })();

  // Interact button (64x64)
  (() => {
    const png = createPNG(64, 64);
    drawCircle(png, 32, 32, 28, C.panelBg);
    drawCircle(png, 32, 32, 26, [60, 100, 170, 230]);
    drawCircle(png, 32, 32, 24, [80, 120, 200, 240]);
    // "E" or hand icon
    fillRect(png, 24, 20, 16, 3, C.white);
    fillRect(png, 24, 29, 12, 3, C.white);
    fillRect(png, 24, 38, 16, 3, C.white);
    fillRect(png, 24, 20, 3, 21, C.white);
    savePNG(png, 'ui/interact_btn.png');
  })();
}

// ═══════════════════════════════════════════════════════════════
// TROOPS (320x48, 5 types x 2 frames, 32x48 each)
// ═══════════════════════════════════════════════════════════════
function generateTroops() {
  console.log('Generating troop sprites...');
  const FW = 32, FH = 48;
  const png = createPNG(FW * 10, FH); // 5 types x 2 frames

  const troops = [
    { name: 'militia', color: C.rangerBrown, weapon: 'sword' },
    { name: 'archer', color: C.farmerGreen, weapon: 'bow' },
    { name: 'cavalry', color: C.tunic, weapon: 'lance' },
    { name: 'spearman', color: C.knightSilver, weapon: 'spear' },
    { name: 'siege_ram', color: C.woodDark, weapon: 'ram' },
  ];

  troops.forEach((troop, ti) => {
    for (let frame = 0; frame < 2; frame++) {
      const ox = (ti * 2 + frame) * FW;
      const swing = frame * 3;

      if (troop.weapon === 'ram') {
        // Siege ram - draw as a wheeled device
        fillRect(png, ox + 4, FH - 24, 24, 12, C.wood);
        fillRect(png, ox + 2, FH - 28, 28, 4, C.woodDark);
        // Ram head
        fillRect(png, ox + 24, FH - 22 - swing, 6, 6, C.knightSilver);
        // Wheels
        drawCircle(png, ox + 10, FH - 10, 4, C.woodDark);
        drawCircle(png, ox + 22, FH - 10, 4, C.woodDark);
        continue;
      }

      // Body
      fillRect(png, ox + 8, 18, 16, 16, troop.color);
      // Head
      fillRect(png, ox + 10, 4, 12, 14, C.skin);
      fillRect(png, ox + 12, 10, 2, 3, C.black);
      fillRect(png, ox + 18, 10, 2, 3, C.black);
      // Helmet
      fillRect(png, ox + 9, 2, 14, 6, troop.color);
      // Legs
      fillRect(png, ox + 10, 34, 5, 12, C.pants);
      fillRect(png, ox + 17, 34, 5, 12, C.pants);

      // Weapon
      if (troop.weapon === 'sword') {
        fillRect(png, ox + 24, 14 - swing, 3, 18, C.knightSilver);
        fillRect(png, ox + 22, 30 - swing, 7, 3, C.gold);
      } else if (troop.weapon === 'bow') {
        // Bow arc
        for (let i = 0; i < 14; i++) {
          setPixel(png, ox + 26 + Math.round(Math.sin(i/4.5)*3), 10 + i, C.wood);
        }
        // Arrow
        fillRect(png, ox + 24, 16 - swing, 8, 1, C.woodLight);
      } else if (troop.weapon === 'lance') {
        fillRect(png, ox + 26, 2 - swing, 2, 30, C.wood);
        fillRect(png, ox + 25, 2 - swing, 4, 4, C.knightSilver);
      } else if (troop.weapon === 'spear') {
        fillRect(png, ox + 4, 4 - swing, 2, 28, C.wood);
        fillRect(png, ox + 3, 4 - swing, 4, 5, C.knightSilver);
        // Shield
        fillRect(png, ox + 22, 18, 8, 12, troop.color);
        drawOutline(png, ox + 22, 18, 8, 12, C.gold, 1);
      }
    }
  });

  savePNG(png, 'characters/troops.png');
}

// ═══════════════════════════════════════════════════════════════
// RUN ALL
// ═══════════════════════════════════════════════════════════════
console.log('=== Kingdoms Harvest Sprite Generator ===\n');
generateTerrain();
generateFarmTiles();
generatePlayer();
generateNPCs();
generateAnimals();
generateBuildings();
generateEffects();
generateUI();
generateTroops();
console.log('\n=== All sprites generated! ===');
