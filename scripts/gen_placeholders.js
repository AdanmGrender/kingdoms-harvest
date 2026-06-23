'use strict';
/**
 * Placeholder sprite generator for Kingdoms Harvest.
 *
 * Generates the minimum set of PNG files needed for Phaser to load
 * without crashing, while real art is being produced.
 *
 * Each placeholder is a solid-color rectangle with a 2px dark border.
 * Different hues per category make it obvious what's missing at a glance.
 *
 * Run: node scripts/gen_placeholders.js
 *
 * ─────────────────────────────────────────────────────────────────────────────
 * DO NOT COMMIT the output PNGs to git. They are in .gitignore.
 * When the artist delivers a file, drop it in the corresponding path and
 * the placeholder for that asset is automatically replaced.
 * ─────────────────────────────────────────────────────────────────────────────
 */

const { PNG } = require('pngjs');
const fs   = require('fs');
const path = require('path');

const ROOT  = path.join(__dirname, '..');
const GAME  = path.join(ROOT, 'client/public/assets/game');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function hex(h) {
  const n = parseInt(h.replace('#', ''), 16);
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff];
}

function makePng(w, h, fillHex, borderHex = '#000000') {
  const png = new PNG({ width: w, height: h, colorType: 6 });
  const [fr, fg, fb] = hex(fillHex);
  const [br, bg, bb] = hex(borderHex);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const border = x < 2 || x >= w - 2 || y < 2 || y >= h - 2;
      const [r, g, b] = border ? [br, bg, bb] : [fr, fg, fb];
      const i = (y * w + x) * 4;
      png.data[i] = r; png.data[i+1] = g; png.data[i+2] = b; png.data[i+3] = 255;
    }
  }
  return PNG.sync.write(png);
}

// Spritesheet: tiles of (fw × fh), cols × rows, each cell bordered separately
function makeSheet(fw, fh, cols, rows, fillHex, borderHex = '#1a1a1a') {
  const W = fw * cols;
  const H = fh * rows;
  const png = new PNG({ width: W, height: H, colorType: 6 });
  const [fr, fg, fb] = hex(fillHex);
  const [br, bg, bb] = hex(borderHex);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ox = col * fw;
      const oy = row * fh;
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const border = x === 0 || x === fw - 1 || y === 0 || y === fh - 1;
          const [r, g, b] = border ? [br, bg, bb] : [fr, fg, fb];
          const i = ((oy + y) * W + (ox + x)) * 4;
          png.data[i] = r; png.data[i+1] = g; png.data[i+2] = b; png.data[i+3] = 255;
        }
      }
    }
  }
  return PNG.sync.write(png);
}

function write(relPath, buf) {
  const full = path.join(GAME, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
  console.log(`  ✓  ${relPath}`);
}

// ─── Asset definitions ───────────────────────────────────────────────────────
// Colors per category (muted, distinct)
const C = {
  terrain:    '#4a6030',  // olive green  — ground tiles
  farm:       '#5a7a28',  // bright green — farm state tiles
  buildings:  '#7a4a28',  // brown        — buildings
  npc:        '#5a3a6a',  // purple       — NPC characters
  troops:     '#2a4a6a',  // steel blue   — military units
  villager:   '#2a6a5a',  // teal         — villagers
  animals:    '#7a6a28',  // amber        — animals
  effects:    '#6a6a28',  // yellow-gray  — particle effects
  ui:         '#3a3a4a',  // dark blue    — UI chrome
  iso_terrain:'#2a5a48',  // dark teal    — iso ground tiles
  iso_objects:'#2a4828',  // forest       — iso decorations
};

// ─── Generate ────────────────────────────────────────────────────────────────

console.log('\nGenerating placeholder sprites...\n');

// ── Tilesets ──────────────────────────────────────────────────────────────────
// terrain.png: 512×512, 16×16 grid of 32×32 tiles
write('tilesets/terrain.png',   makeSheet(32, 32, 16, 16, C.terrain));

// farm_tiles.png: 256×256, 4×4 grid of 64×64 tiles (4 growth stages × 2 moisture states × 2 rows)
write('tilesets/farm_tiles.png', makeSheet(64, 64, 4, 4, C.farm));

// buildings.png: 512×512, 4×4 grid of 128×128 (16 building types)
write('tilesets/buildings.png',  makeSheet(128, 128, 4, 4, C.buildings));

// ── Characters ────────────────────────────────────────────────────────────────
// Each NPC: 64×48, 2 frames of 32×48 (idle L, idle R)
const NPC_NAMES = ['farmer', 'baker', 'princess', 'wizard', 'knight', 'merchant', 'ranger'];
for (const name of NPC_NAMES) {
  write(`characters/npc_${name}.png`, makeSheet(32, 48, 2, 1, C.npc));
}

// troops.png: 5 troop types × 2 frames = 10 frames; arrange 5×2, 32×48 each
write('characters/troops.png',   makeSheet(32, 48, 5, 2, C.troops));

// villager.png: 4 frames (idle-1, idle-2, walk-1, walk-2), 32×48 each
write('characters/villager.png', makeSheet(32, 48, 4, 1, C.villager));

// ── Animals ───────────────────────────────────────────────────────────────────
// Each animal: 4 frames (idle-1, idle-2, walk-1, walk-2), 32×32 each
for (const animal of ['chicken', 'cow', 'sheep']) {
  write(`animals/${animal}.png`, makeSheet(32, 32, 4, 1, C.animals));
}

// ── Effects ───────────────────────────────────────────────────────────────────
// effects.png: 8 frames of 16×16 (smoke, dust, sparkle, token, etc.)
write('effects/effects.png', makeSheet(16, 16, 8, 1, C.effects));

// ── UI chrome ─────────────────────────────────────────────────────────────────
write('ui/dialog_frame.png', makePng(256, 128, C.ui));
write('ui/interact_btn.png', makePng(64,   64, C.ui));
write('ui/joystick.png',     makePng(128,  64, C.ui));

// ── ISO mode (only needed when VITE_ISO_MODE=true) ───────────────────────────
// iso_terrain.png: 7 tiles of 64×32
write('iso/iso_terrain.png',  makeSheet(64, 32, 7, 1, C.iso_terrain));

// iso_objects.png: 4 objects of 64×96
write('iso/iso_objects.png',  makeSheet(64, 96, 4, 1, C.iso_objects));

console.log('\nDone. Drop real art files in the same paths to replace placeholders.');
console.log('See docs/art-spec.md for the full artist brief.\n');
