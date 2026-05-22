'use strict';
/**
 * Generates isometric pixel art tile assets for the ISO mode experiment.
 * Run: node scripts/generate_iso_tiles.js
 *
 * Outputs:
 *   client/public/assets/game/iso/iso_terrain.png  448×32  (7 tiles @ 64×32 each)
 *   client/public/assets/game/iso/iso_objects.png  256×96  (4 objects @ 64×96 each)
 *
 * Palette: dark medieval, muted earthy tones.
 * Iso tile standard: 64×32 diamond, 2:1 ratio.
 */

const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const OUT  = path.join(__dirname, '../client/public/assets/game/iso');
const TW   = 64;   // tile width
const TH   = 32;   // tile height
const OW   = 64;   // object frame width
const OH   = 96;   // object frame height

// ─── Pixel helpers ────────────────────────────────────────────────────────────

function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function pset(png, x, y, r, g, b, a = 255) {
  if (x < 0 || x >= png.width || y < 0 || y >= png.height) return;
  const i = (y * png.width + x) * 4;
  png.data[i] = r; png.data[i+1] = g; png.data[i+2] = b; png.data[i+3] = a;
}

function psetH(png, x, y, hexColor, a = 255) {
  pset(png, x, y, ...hex(hexColor), a);
}

function hline(png, x1, x2, y, r, g, b, a = 255) {
  for (let x = Math.round(x1); x <= Math.round(x2); x++) pset(png, x, y, r, g, b, a);
}

function hlineH(png, x1, x2, y, hexColor) {
  hline(png, x1, x2, y, ...hex(hexColor));
}

// Diamond boundary check for a 64×32 tile at local (0,0)
function inDiamond(x, y) {
  return Math.abs(x - TW / 2) / (TW / 2) + Math.abs(y - TH / 2) / (TH / 2) <= 1.01;
}

// Is this pixel on the 1px diamond border?
function onEdge(x, y) {
  if (!inDiamond(x, y)) return false;
  const dirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  return dirs.some(([dx, dy]) => !inDiamond(x + dx, y + dy));
}

// Seeded LCG for deterministic scatter
function lcg(seed) {
  let s = seed | 0;
  return () => { s = (Math.imul(1664525, s) + 1013904223) | 0; return (s >>> 0) / 0x100000000; };
}

// ─── Terrain tile drawer ──────────────────────────────────────────────────────

function drawTile(png, ox, oy, fill, light, dark, opts = {}) {
  const { scatter = [], riverPixels = [] } = opts;
  const [fr, fg, fb] = hex(fill);
  const [lr, lg, lb] = hex(light);
  const [dr, dg, db] = hex(dark);

  // Fill and edge
  for (let y = 0; y < TH; y++) {
    for (let x = 0; x < TW; x++) {
      if (!inDiamond(x, y)) continue;
      const edge = onEdge(x, y);
      const topSide = y <= TH / 2;
      if (edge && topSide)  pset(png, ox + x, oy + y, lr, lg, lb);
      else if (edge)        pset(png, ox + x, oy + y, dr, dg, db);
      else                  pset(png, ox + x, oy + y, fr, fg, fb);
    }
  }

  // Texture scatter
  for (const [tx, ty, col] of scatter) {
    if (inDiamond(tx, ty)) psetH(png, ox + tx, oy + ty, col);
  }
}

function genTerrain() {
  const png = new PNG({ width: TW * 7, height: TH, colorType: 6 });
  png.data.fill(0);

  const rng1 = lcg(1), rng2 = lcg(2), rng3 = lcg(3),
        rng4 = lcg(4), rng5 = lcg(5), rng6 = lcg(6);

  function randPts(rng, n, color, xlo = 6, xhi = 58, ylo = 5, yhi = 27) {
    return Array.from({ length: n }, () => [
      Math.floor(xlo + rng() * (xhi - xlo)),
      Math.floor(ylo + rng() * (yhi - ylo)),
      color,
    ]);
  }

  const tiles = [
    // 0 GRASS_DARK
    { fill: '#364e22', light: '#475f30', dark: '#253819',
      scatter: [...randPts(rng1, 9, '#2a3d1a'), ...randPts(rng1, 7, '#405a28')] },
    // 1 GRASS
    { fill: '#4a6830', light: '#5a7c3e', dark: '#384e24',
      scatter: [...randPts(rng2, 8, '#3e5828'), ...randPts(rng2, 6, '#587838')] },
    // 2 GRASS_LIGHT (meadow with tiny red flowers)
    { fill: '#587838', light: '#688c48', dark: '#446030',
      scatter: [
        ...randPts(rng3, 7, '#476530'),
        ...randPts(rng3, 5, '#6a8a44'),
        ...randPts(rng3, 2, '#b83030', 20, 44, 8, 24), // flowers
      ] },
    // 3 DIRT
    { fill: '#785838', light: '#8a6a48', dark: '#5c4028',
      scatter: [...randPts(rng4, 10, '#604830'), ...randPts(rng4, 7, '#8a6a40')] },
    // 4 STONE
    { fill: '#646464', light: '#7a7a7a', dark: '#484848',
      scatter: [
        // grout lines for cobblestone feel
        [16, 10, '#484848'], [17, 10, '#484848'], [18, 10, '#484848'],
        [32,  6, '#484848'], [32, 14, '#484848'], [32, 22, '#484848'],
        [48, 10, '#484848'], [48, 18, '#484848'],
        ...randPts(rng5, 5, '#6c6c6c'), ...randPts(rng5, 5, '#585858'),
      ] },
    // 5 WATER
    { fill: '#1e4662', light: '#2a587a', dark: '#142e48',
      scatter: [
        [22, 9, '#2e5870'], [38, 7, '#326478'], [46, 14, '#2a5468'],
        [14, 14, '#2a5070'], [52, 11, '#285468'], [30, 20, '#305e74'],
        [10, 9, '#2c5270'],  [58, 18, '#2e6070'], [40, 22, '#285060'],
      ] },
    // 6 SAND
    { fill: '#b8922c', light: '#caa840', dark: '#886c1a',
      scatter: [...randPts(rng6, 8, '#a88022'), ...randPts(rng6, 6, '#c8a438')] },
  ];

  tiles.forEach(({ fill, light, dark, scatter }, i) => {
    drawTile(png, i * TW, 0, fill, light, dark, { scatter });
  });

  fs.writeFileSync(path.join(OUT, 'iso_terrain.png'), PNG.sync.write(png));
  console.log('✓  iso_terrain.png  (448×32, 7 terrain tiles)');
}

// ─── Object helpers ───────────────────────────────────────────────────────────

function fillTriangle(png, cx, apexY, baseY, hw, fillColor, hlColor) {
  const [fr, fg, fb] = hex(fillColor);
  const [hr, hg, hb] = hex(hlColor);
  const span = baseY - apexY;
  if (span <= 0) return;
  for (let y = apexY; y <= baseY; y++) {
    const t = (y - apexY) / span;
    const xl = cx - hw * t;
    const xr = cx + hw * t;
    hline(png, xl, xr, y, fr, fg, fb);
    // 1px highlight on left edge
    pset(png, Math.round(xl), y, hr, hg, hb);
  }
}

function vline(png, x, y1, y2, r, g, b) {
  for (let y = y1; y <= y2; y++) pset(png, x, y, r, g, b);
}

// ─── Object 0: Pine tree ─────────────────────────────────────────────────────

function drawPine(png, ox, oy) {
  const cx = ox + 32;
  // Trunk
  const [tr, tg, tb] = hex('#5a3818');
  const [ts] = [hex('#3c2410')];
  for (let y = oy + 78; y < oy + OH; y++) {
    pset(png, cx - 2, y, tr, tg, tb);
    pset(png, cx - 1, y, tr, tg, tb);
    pset(png, cx,     y, tr, tg, tb);
    pset(png, cx + 1, y, tr, tg, tb);
    pset(png, cx - 2, y, ...ts); // shadow left edge
  }

  // 5 canopy layers, bottom → top
  const layers = [
    { apex: 64, base: 78, hw: 14, fill: '#1e3c10', hl: '#2a4e18' },
    { apex: 52, base: 66, hw: 11, fill: '#224014', hl: '#2e5218' },
    { apex: 42, base: 56, hw:  9, fill: '#264618', hl: '#325a20' },
    { apex: 32, base: 46, hw:  7, fill: '#2a4a18', hl: '#365e22' },
    { apex: 22, base: 36, hw:  5, fill: '#2e4e18', hl: '#3a6224' },
  ];
  for (const { apex, base, hw, fill, hl } of layers) {
    fillTriangle(png, cx, oy + apex, oy + base, hw, fill, hl);
  }
}

// ─── Object 1: Bare tree ──────────────────────────────────────────────────────

function drawBareTree(png, ox, oy) {
  const cx = ox + 32;
  const baseY = oy + OH - 6;
  const [br, bg, bb] = hex('#4a3018');
  const [sr, sg, sb] = hex('#3a2010');

  // Trunk (4px wide)
  vline(png, cx - 1, baseY - 50, baseY, br, bg, bb);
  vline(png, cx,     baseY - 50, baseY, br, bg, bb);
  vline(png, cx + 1, baseY - 50, baseY, br, bg, bb);
  vline(png, cx - 1, baseY - 50, baseY, sr, sg, sb); // shadow

  // Branch pairs
  const branches = [
    // [x1, y1, x2, y2, thick]
    [cx, baseY - 38, cx - 16, baseY - 52, 2],
    [cx, baseY - 34, cx + 14, baseY - 48, 2],
    [cx, baseY - 46, cx - 10, baseY - 60, 1],
    [cx, baseY - 42, cx +  8, baseY - 56, 1],
  ];
  for (const [x1, y1, x2, y2, thick] of branches) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      const bx = Math.round(x1 + (x2 - x1) * t);
      const by = Math.round(y1 + (y2 - y1) * t);
      for (let d = 0; d < thick; d++) pset(png, bx + d, by, br, bg, bb);
    }
  }

  // Tiny tip twigs
  const [tr, tg, tb] = hex('#3a2412');
  const twigs = [
    [cx - 16, baseY - 52, cx - 20, baseY - 60],
    [cx + 14, baseY - 48, cx + 18, baseY - 56],
    [cx - 10, baseY - 60, cx - 13, baseY - 66],
  ];
  for (const [x1, y1, x2, y2] of twigs) {
    const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
    for (let s = 0; s <= steps; s++) {
      const t = s / steps;
      pset(png, Math.round(x1 + (x2 - x1) * t), Math.round(y1 + (y2 - y1) * t), tr, tg, tb);
    }
  }
}

// ─── Object 2: Rock ───────────────────────────────────────────────────────────

function drawRock(png, ox, oy) {
  const cx = ox + 32;
  const by = oy + 84;

  // Polygon vertices (clockwise from bottom-left)
  const verts = [
    [cx - 14,  by],
    [cx - 18,  by - 10],
    [cx - 14,  by - 22],
    [cx - 4,   by - 30],
    [cx + 8,   by - 32],
    [cx + 18,  by - 22],
    [cx + 16,  by - 12],
    [cx + 10,  by - 2],
  ];

  // Scanline fill
  const yTop = Math.min(...verts.map(v => v[1]));
  const yBot = Math.max(...verts.map(v => v[1]));
  const n = verts.length;

  for (let y = yTop; y <= yBot; y++) {
    const xs = [];
    for (let i = 0; i < n; i++) {
      const [ax, ay] = verts[i];
      const [bx, by2] = verts[(i + 1) % n];
      if ((ay <= y && by2 > y) || (by2 <= y && ay > y)) {
        xs.push(ax + (y - ay) / (by2 - ay) * (bx - ax));
      }
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k < xs.length - 1; k += 2) {
      // Top section: medium gray; bottom: darker
      const isTop = y < by - 18;
      const col = isTop ? '#686868' : '#585858';
      hlineH(png, xs[k], xs[k + 1], y, col);
    }
  }

  // Top highlight
  const [hlr, hlg, hlb] = hex('#848484');
  for (let i = 2; i <= 4; i++) {
    const [ax, ay] = verts[i];
    const [bx, by2] = verts[i + 1 < n ? i + 1 : 0];
    const steps = Math.max(Math.abs(bx - ax), Math.abs(by2 - ay));
    for (let s = 0; s <= steps; s++) {
      const t = steps > 0 ? s / steps : 0;
      pset(png, Math.round(ax + (bx - ax) * t), Math.round(ay + (by2 - ay) * t), hlr, hlg, hlb);
    }
  }

  // Crack detail
  const [cr, cg, cb] = hex('#3c3c3c');
  for (let dy = 0; dy < 10; dy++) {
    pset(png, cx + 4 + (dy > 5 ? 1 : 0), by - 20 + dy, cr, cg, cb);
  }
}

// ─── Object 3: Bush ───────────────────────────────────────────────────────────

function drawBush(png, ox, oy) {
  const cx = ox + 32;
  const by = oy + 78;

  // Three overlapping ellipses (scanline)
  const blobs = [
    { bx: cx - 9, by2: by - 10, rx: 13, ry: 11, fill: '#2c5010', hl: '#446428' },
    { bx: cx + 9, by2: by - 10, rx: 13, ry: 11, fill: '#305412', hl: '#486830' },
    { bx: cx,     by2: by - 18, rx: 13, ry: 12, fill: '#365818', hl: '#4c6c30' },
    { bx: cx,     by2: by -  6, rx: 11, ry:  8, fill: '#285010', hl: '#3e6226' },
  ];

  for (const { bx, by2, rx, ry, fill, hl } of blobs) {
    const [fr, fg, fb] = hex(fill);
    const [hr, hg, hb] = hex(hl);
    for (let y = by2 - ry; y <= by2 + ry; y++) {
      const t = (y - by2) / ry;
      if (Math.abs(t) > 1) continue;
      const xspan = rx * Math.sqrt(1 - t * t);
      hline(png, bx - xspan, bx + xspan, y, fr, fg, fb);
      // top highlight
      if (y < by2 - ry * 0.3) {
        pset(png, Math.round(bx - xspan), y, hr, hg, hb);
        pset(png, Math.round(bx + xspan), y, hr, hg, hb);
      }
    }
  }

  // 2px berries
  [[cx + 8, by - 16], [cx - 5, by - 12], [cx + 2, by - 22]].forEach(([x, y]) => {
    psetH(png, x, y, '#c03828');
    psetH(png, x + 1, y, '#d04030');
  });
}

// ─── Object sheet ──────────────────────────────────────────────────────────────

function genObjects() {
  const png = new PNG({ width: OW * 4, height: OH, colorType: 6 });
  png.data.fill(0);

  drawPine(png,     0,       0);
  drawBareTree(png, OW,      0);
  drawRock(png,     OW * 2,  0);
  drawBush(png,     OW * 3,  0);

  fs.writeFileSync(path.join(OUT, 'iso_objects.png'), PNG.sync.write(png));
  console.log('✓  iso_objects.png  (256×96, 4 objects — pine, bare-tree, rock, bush)');
}

// ─── Run ─────────────────────────────────────────────────────────────────────
genTerrain();
genObjects();
console.log(`\nAssets written to: ${OUT}`);
