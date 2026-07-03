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

function writeAbs(relToClientAssets, buf) {
  const full = path.join(ROOT, 'client/public/assets', relToClientAssets);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, buf);
}

// Sprite con fondo transparente y caja centrada (para objetos que se dibujan
// SOBRE el terreno — un cuadrado opaco taparía el tile de abajo).
function makeSprite(w, h, fillHex, borderHex = '#1a1a1a') {
  const png = new PNG({ width: w, height: h, colorType: 6 });
  const [fr, fg, fb] = hex(fillHex);
  const [br, bg, bb] = hex(borderHex);
  const x0 = Math.floor(w * 0.15), x1 = Math.ceil(w * 0.85);
  const y0 = Math.floor(h * 0.15), y1 = Math.ceil(h * 0.85);

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (x >= x0 && x < x1 && y >= y0 && y < y1) {
        const border = x < x0 + 2 || x >= x1 - 2 || y < y0 + 2 || y >= y1 - 2;
        const [r, g, b] = border ? [br, bg, bb] : [fr, fg, fb];
        png.data[i] = r; png.data[i+1] = g; png.data[i+2] = b; png.data[i+3] = 255;
      } else {
        png.data[i+3] = 0; // transparente
      }
    }
  }
  return PNG.sync.write(png);
}

// Personaje 8-dir: 5 filas (S, SE, E, NE, N) × N frames. El lado W se obtiene
// con flipX. Cada frame lleva un punto claro hacia donde "mira" la fila — así
// la FSM de direcciones se valida A OJO antes de que exista arte real.
function makeCharSheet(fw, fh, cols, fillHex, markerHex = '#ffe08a') {
  const rows = 5;
  const W = fw * cols, H = fh * rows;
  const png = new PNG({ width: W, height: H, colorType: 6 });
  const [fr, fg, fb] = hex(fillHex);
  const [mr, mg, mb] = hex(markerHex);

  // offset del marcador (px desde el centro del frame) por fila
  const MARK = [
    [0, 14],    // S  — abajo-centro
    [10, 10],   // SE — abajo-derecha
    [12, 0],    // E  — derecha
    [10, -10],  // NE — arriba-derecha
    [0, -14],   // N  — arriba-centro
  ];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const ox = col * fw, oy = row * fh;
      // cuerpo: caja centrada, brillo levemente distinto por frame (anim visible)
      const shade = 1 - col * 0.10;
      const x0 = Math.floor(fw * 0.2), x1 = Math.ceil(fw * 0.8);
      const y0 = Math.floor(fh * 0.15), y1 = Math.ceil(fh * 0.9);
      for (let y = 0; y < fh; y++) {
        for (let x = 0; x < fw; x++) {
          const i = ((oy + y) * W + (ox + x)) * 4;
          if (x >= x0 && x < x1 && y >= y0 && y < y1) {
            png.data[i] = fr * shade; png.data[i+1] = fg * shade;
            png.data[i+2] = fb * shade; png.data[i+3] = 255;
          } else png.data[i+3] = 0;
        }
      }
      // marcador de dirección: punto 6×6
      const [mx, my] = MARK[row];
      const cx = ox + fw / 2 + mx, cy = oy + fh / 2 + my;
      for (let y = -3; y < 3; y++) {
        for (let x = -3; x < 3; x++) {
          const px = Math.round(cx + x), py = Math.round(cy + y);
          if (px < ox || px >= ox + fw || py < oy || py >= oy + fh) continue;
          const i = (py * W + px) * 4;
          png.data[i] = mr; png.data[i+1] = mg; png.data[i+2] = mb; png.data[i+3] = 255;
        }
      }
    }
  }
  return PNG.sync.write(png);
}

// ─── Asset definitions ───────────────────────────────────────────────────────
// Colors per category (muted, distinct)
// Paleta grimdark (docs/art-style.md, dirección 2026-07-03)
const C = {
  terrain:    '#4a443e',  // piedra base    — ground tiles
  farm:       '#5a7a35',  // verde tóxico   — farm state tiles (vats)
  buildings:  '#332f2b',  // piedra oscura  — buildings
  npc:        '#7a5a8a',  // púrpura        — NPC characters
  troops:     '#7f1d18',  // rojo sombra    — military units
  villager:   '#4fd8c8',  // teal holograma — villagers
  animals:    '#7a4a30',  // óxido          — animals
  effects:    '#e8933a',  // naranja vela   — particle effects
  ui:         '#332f2b',  // piedra oscura  — UI chrome
  iso_terrain:'#4a443e',  // piedra base    — iso ground tiles
  iso_objects:'#332f2b',  // piedra oscura  — iso decorations
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

// ── ISO mode (only needed when ISO_MODE=true in config.js) ───────────────────
// iso_terrain.png: 7 tiles of 64×32
write('iso/iso_terrain.png',  makeSheet(64, 32, 7, 1, C.iso_terrain));

// iso_objects.png: 4 objects of 64×96
write('iso/iso_objects.png',  makeSheet(64, 96, 4, 1, C.iso_objects));

// Personaje 8-dir del experimento iso (layout: docs/iso-art-architecture.md §2)
// 5 filas × N frames de 32×48; idle=2 frames, walk=4 frames
write('iso/chars/villager_idle.png', makeCharSheet(32, 48, 2, C.villager));
write('iso/chars/villager_walk.png', makeCharSheet(32, 48, 4, C.villager));

// Trooper grimdark con disparo (dirección de arte 2026-07-03, docs/art-style.md)
// idle=2f, walk=4f, shoot=3f (one-shot). Rojo armadura de la paleta de referencia.
const TROOPER_RED = '#b32821';
write('iso/chars/trooper_idle.png',  makeCharSheet(32, 48, 2, TROOPER_RED));
write('iso/chars/trooper_walk.png',  makeCharSheet(32, 48, 4, TROOPER_RED));
write('iso/chars/trooper_shoot.png', makeCharSheet(32, 48, 3, TROOPER_RED, '#4fd8c8'));

// ── Kenney medieval-rts stand-ins (WorldScene + IsoScene los cargan) ─────────
// BootScene.js / IsoScene.js cargan estos 102 PNGs individuales de 64×64:
//   Tile/medievalTile_01..58            — suelo (opaco)
//   Environment/medievalEnvironment_01..21 — decoración (transparente)
//   Structure/medievalStructure_01..23  — edificios (transparente)
// El pack real CC0 se puede re-descargar de https://kenney.nl/assets/medieval-rts
const pad2 = (n) => String(n).padStart(2, '0');
const KENNEY = 'kenney-medieval/PNG/Default size';
for (let i = 1; i <= 58; i++) {
  writeAbs(`${KENNEY}/Tile/medievalTile_${pad2(i)}.png`, makePng(64, 64, C.terrain));
}
for (let i = 1; i <= 21; i++) {
  writeAbs(`${KENNEY}/Environment/medievalEnvironment_${pad2(i)}.png`, makeSprite(64, 64, C.iso_objects));
}
for (let i = 1; i <= 23; i++) {
  writeAbs(`${KENNEY}/Structure/medievalStructure_${pad2(i)}.png`, makeSprite(64, 64, C.buildings));
}
console.log(`  ✓  ${KENNEY}/ — 102 stand-ins (58 tiles, 21 env, 23 structs)`);

console.log('\nDone. Drop real art files in the same paths to replace placeholders.');
console.log('See docs/art-spec.md for the full artist brief.\n');
