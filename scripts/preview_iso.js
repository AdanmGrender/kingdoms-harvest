'use strict';
/**
 * Renders a preview of the isometric world using the generated tiles.
 * Output: /tmp/iso_preview.png
 */

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const ASSETS = path.join(__dirname, '../client/public/assets/game/iso');

// Load a spritesheet PNG
function loadSheet(file) {
  const buf = fs.readFileSync(path.join(ASSETS, file));
  return PNG.sync.read(buf);
}

// Blit src frame onto dst at (dx, dy), skipping transparent pixels
function blit(dst, src, dx, dy, frameX, frameY, fw, fh) {
  for (let y = 0; y < fh; y++) {
    for (let x = 0; x < fw; x++) {
      const si = ((frameY + y) * src.width + (frameX + x)) * 4;
      const a  = src.data[si + 3];
      if (a === 0) continue;
      const tx = dx + x, ty = dy + y;
      if (tx < 0 || tx >= dst.width || ty < 0 || ty >= dst.height) continue;
      const di = (ty * dst.width + tx) * 4;
      // Alpha compositing (src over dst)
      const da  = dst.data[di + 3] / 255;
      const sa  = a / 255;
      const out = sa + da * (1 - sa);
      if (out === 0) continue;
      dst.data[di]     = Math.round((src.data[si]     * sa + dst.data[di]     * da * (1 - sa)) / out);
      dst.data[di + 1] = Math.round((src.data[si + 1] * sa + dst.data[di + 1] * da * (1 - sa)) / out);
      dst.data[di + 2] = Math.round((src.data[si + 2] * sa + dst.data[di + 2] * da * (1 - sa)) / out);
      dst.data[di + 3] = Math.round(out * 255);
    }
  }
}

// ─── Config ──────────────────────────────────────────────────────────────────
const TW = 64, TH = 32;   // tile diamond
const OW = 64, OH = 96;   // object frame
// We'll render a 14×12 portion of the map
const COLS = 14, ROWS = 12;

// World canvas (extra space for tall objects)
const W = (COLS + ROWS) * (TW / 2) + TW;
const H = (COLS + ROWS) * (TH / 2) + 160;
const OX = ROWS * (TW / 2);  // origin X
const OY = 80;                // origin Y

function isoPos(col, row) {
  return {
    x: OX + (col - row) * (TW / 2),
    y: OY + (col + row) * (TH / 2),
  };
}

// ─── Map (matches IsoWorldScene logic) ───────────────────────────────────────
const T = { GRASS_DARK: 0, GRASS: 1, GRASS_LIGHT: 2, DIRT: 3, STONE: 4, WATER: 5, SAND: 6 };
const seed = 1337;

function tileAt(col, row) {
  // Settlement zone center
  if (col >= 4 && col <= 10 && row >= 4 && row <= 10) return T.GRASS;
  // Dirt road
  if (row === 6 || col === 6) return T.DIRT;

  const n = Math.sin(col * 0.38 + seed * 1.1) * Math.cos(row * 0.38 + seed * 0.73)
          + Math.sin(col * 0.12 + row * 0.15 + seed * 0.4) * 0.5;

  if (n > 0.75)       return T.STONE;
  if (n > 0.35)       return T.DIRT;
  if (n < -0.70)      return T.WATER;
  if (n < -0.35)      return T.GRASS_LIGHT;
  if (Math.abs(n) < 0.08) return T.GRASS_DARK;
  return T.GRASS;
}

// ─── Objects / buildings to place ────────────────────────────────────────────
// [col, row, type, frame]  type: 'obj' | 'bldg'
const objects = [
  // Decorations (iso_objects frames)
  { col: 0,  row: 1,  type: 'obj', frame: 0 }, // pine
  { col: 1,  row: 3,  type: 'obj', frame: 0 },
  { col: 13, row: 1,  type: 'obj', frame: 1 }, // bare tree
  { col: 12, row: 5,  type: 'obj', frame: 2 }, // rock
  { col: 0,  row: 9,  type: 'obj', frame: 3 }, // bush
  { col: 11, row: 10, type: 'obj', frame: 0 },
  { col: 2,  row: 11, type: 'obj', frame: 2 },
  { col: 13, row: 8,  type: 'obj', frame: 3 },
  // Settlement buildings (use a colored placeholder instead of buildings.png to
  // avoid depending on BootScene's spritesheet — draw simple iso boxes directly)
];

// Draw a simple isometric building box directly onto the canvas
// (simulates what Phaser would render from buildings.png)
function drawIsoBox(png, cx, footY, hw, hh, wallH, cTop, cLeft, cRight, outline) {
  function setP(x, y, r, g, b) {
    if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
    const i = (y * png.width + x) * 4;
    png.data[i] = r; png.data[i+1] = g; png.data[i+2] = b; png.data[i+3] = 255;
  }
  function hex(h) {
    const n = parseInt(h.replace('#',''), 16);
    return [(n>>16)&0xff,(n>>8)&0xff,n&0xff];
  }
  function fillPoly(pts, color) {
    const [r,g,b] = hex(color);
    const ys = pts.map(p => p[1]);
    const yMin = Math.min(...ys), yMax = Math.max(...ys);
    for (let y = yMin; y <= yMax; y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax,ay] = pts[i], [bx,by] = pts[(i+1)%pts.length];
        if ((ay <= y && by > y) || (by <= y && ay > y)) {
          xs.push(ax + (y - ay) / (by - ay) * (bx - ax));
        }
      }
      xs.sort((a,b) => a-b);
      for (let k = 0; k < xs.length-1; k+=2) {
        for (let x = Math.round(xs[k]); x <= Math.round(xs[k+1]); x++) setP(x, y, r, g, b);
      }
    }
  }
  function strokeLine(x1,y1,x2,y2,color) {
    const [r,g,b] = hex(color);
    const steps = Math.max(Math.abs(x2-x1), Math.abs(y2-y1));
    for (let s = 0; s <= steps; s++) {
      const t = steps > 0 ? s/steps : 0;
      setP(Math.round(x1+(x2-x1)*t), Math.round(y1+(y2-y1)*t), r, g, b);
    }
  }

  const by = footY;
  const ty = by - wallH;

  // Left face
  fillPoly([[cx-hw,by],[cx,by+hh],[cx,ty+hh],[cx-hw,ty]], cLeft);
  // Right face
  fillPoly([[cx,by+hh],[cx+hw,by],[cx+hw,ty],[cx,ty+hh]], cRight);
  // Top face
  fillPoly([[cx-hw,ty],[cx,ty-hh],[cx+hw,ty],[cx,ty+hh]], cTop);

  // Outline
  const ol = outline || 'rgba(0,0,0,0.6)';
  strokeLine(cx-hw,by, cx,by+hh, '#000000');
  strokeLine(cx,by+hh, cx+hw,by, '#000000');
  strokeLine(cx-hw,ty, cx-hw,by, '#000');
  strokeLine(cx+hw,ty, cx+hw,by, '#000');
  strokeLine(cx,ty+hh, cx,by+hh, '#000');
}

// Building templates [hw, hh, wallH, cTop, cLeft, cRight, label]
const BUILDINGS = [
  { hw:20, hh:8,  wallH:28, cTop:'#7a5a38', cLeft:'#5a4028', cRight:'#3a2810', label:'barn' },
  { hw:18, hh:7,  wallH:22, cTop:'#a05020', cLeft:'#7a3a18', cRight:'#502010', label:'farm' },
  { hw:22, hh:9,  wallH:34, cTop:'#6a5a4a', cLeft:'#4a3a2a', cRight:'#3a2a1a', label:'tavern' },
  { hw:14, hh:6,  wallH:50, cTop:'#6a6a6a', cLeft:'#484848', cRight:'#303030', label:'tower' },
  { hw:24, hh:10, wallH:36, cTop:'#8a6a4a', cLeft:'#5a4030', cRight:'#3a2820', label:'market' },
  { hw:26, hh:10, wallH:40, cTop:'#9a8060', cLeft:'#6a5040', cRight:'#4a3020', label:'throne' },
];

const buildingLayout = [
  { col: 4,  row: 4,  bldg: 0 },  // barn
  { col: 7,  row: 4,  bldg: 1 },  // farm plots (×2)
  { col: 9,  row: 4,  bldg: 1 },
  { col: 5,  row: 7,  bldg: 2 },  // tavern
  { col: 9,  row: 7,  bldg: 3 },  // tower
  { col: 4,  row: 9,  bldg: 4 },  // market
  { col: 8,  row: 9,  bldg: 5 },  // throne
];

// ─── Render ───────────────────────────────────────────────────────────────────

const terrain = loadSheet('iso_terrain.png');
const objSheet = loadSheet('iso_objects.png');

const canvas = new PNG({ width: W, height: H, colorType: 6 });

// Background — dark sky/fog gradient (approximate with solid dark)
for (let i = 0; i < canvas.data.length; i += 4) {
  canvas.data[i]   = 26;
  canvas.data[i+1] = 26;
  canvas.data[i+2] = 46;
  canvas.data[i+3] = 255;
}

// Collect all drawables sorted by depth (col + row)
const drawList = [];

// Tiles
for (let row = 0; row < ROWS; row++) {
  for (let col = 0; col < COLS; col++) {
    drawList.push({ depth: col + row - 0.01, type: 'tile', col, row });
  }
}

// Objects
for (const o of objects) {
  drawList.push({ depth: o.col + o.row + 0.2, type: 'obj', ...o });
}

// Buildings
for (const b of buildingLayout) {
  drawList.push({ depth: b.col + b.row + 0.6, type: 'bldg', ...b });
}

drawList.sort((a, b) => a.depth - b.depth);

for (const item of drawList) {
  if (item.type === 'tile') {
    const frame = tileAt(item.col, item.row);
    const { x, y } = isoPos(item.col, item.row);
    // Tile bounding box top-left = (x - TW/2, y)
    blit(canvas, terrain, x - TW / 2, y, frame * TW, 0, TW, TH);

  } else if (item.type === 'obj') {
    const { x, y } = isoPos(item.col, item.row);
    const footY = y + TH;  // bottom of tile = foot of object
    const bx = x - OW / 2;
    const by = footY - OH; // origin(0.5, 1.0) → top = foot - height
    blit(canvas, objSheet, bx, by, item.frame * OW, 0, OW, OH);

  } else if (item.type === 'bldg') {
    const b = BUILDINGS[item.bldg];
    const { x, y } = isoPos(item.col, item.row);
    const footY = y + TH;
    drawIsoBox(canvas, x, footY, b.hw, b.hh, b.wallH, b.cTop, b.cLeft, b.cRight);
  }
}

// Scale up 2× for visibility (nearest-neighbor)
const SCALE = 2;
const big = new PNG({ width: W * SCALE, height: H * SCALE, colorType: 6 });
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const si = (y * W + x) * 4;
    for (let sy = 0; sy < SCALE; sy++) {
      for (let sx = 0; sx < SCALE; sx++) {
        const di = ((y * SCALE + sy) * (W * SCALE) + (x * SCALE + sx)) * 4;
        big.data[di]   = canvas.data[si];
        big.data[di+1] = canvas.data[si+1];
        big.data[di+2] = canvas.data[si+2];
        big.data[di+3] = canvas.data[si+3];
      }
    }
  }
}

fs.writeFileSync('/tmp/iso_preview.png', PNG.sync.write(big));
console.log('Preview written to /tmp/iso_preview.png');
