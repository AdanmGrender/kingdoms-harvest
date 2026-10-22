'use strict';
/**
 * crop_building_icons.js — íconos de edificio del set B SIN IA (R41): recorta
 * client/public/assets/b/buildings/*.webp al bbox no transparente y lo centra en una celda de 192 px.
 *
 *   node scripts/crop_building_icons.js [--glyph 172]
 *
 * Escribe art-b/uikit/proc/<nombre>.png (192×192, alfa), mismo formato que process_icon_sheets.js.
 * Requiere `sharp` (NODE_PATH al node_modules del repo principal si el worktree no lo tiene).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'client', 'public', 'assets', 'b', 'buildings');
const OUT = path.join(ROOT, 'art-b', 'uikit', 'proc');
const CELL = 192;
const gi = process.argv.indexOf('--glyph');
const GLYPH = gi > 0 ? Number(process.argv[gi + 1]) : 172;
const ALPHA_MIN = 16;

// nombre del ícono → archivo fuente (sin extensión)
const BUILDINGS = {
  castle: 'throne_room', farmhouse: 'house', market: 'market', tower: 'tower', barracks: 'barracks',
  tavern: 'tavern', mill: 'mill', wall: 'wall', trap: 'trap', stable: 'stable', sawmill: 'sawmill', barn: 'barn',
  mine: 'mine', smithy: 'smithy', library: 'library', embassy: 'embassy', farm_plot: 'farm_plot',
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  let n = 0;
  for (const [name, file] of Object.entries(BUILDINGS)) {
    const src = path.join(SRC, `${file}.webp`);
    const { data, info } = await sharp(src).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let minx = info.width, miny = info.height, maxx = -1, maxy = -1;
    for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
      if (data[(y * info.width + x) * 4 + 3] > ALPHA_MIN) { if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y; }
    }
    if (maxx < 0) throw new Error(`${file}.webp sin píxeles opacos`);
    const w = maxx - minx + 1, h = maxy - miny + 1;
    const png = await sharp(src).extract({ left: minx, top: miny, width: w, height: h })
      .resize({ width: GLYPH, height: GLYPH, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
    const rm = await sharp(png).metadata();
    await sharp({ create: { width: CELL, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
      .composite([{ input: png, left: Math.floor((CELL - rm.width) / 2), top: Math.floor((CELL - rm.height) / 2) }])
      .png().toFile(path.join(OUT, `${name}.png`));
    console.log(`✓ ${name.padEnd(10)} ← ${file}.webp  bbox ${w}×${h} (de ${info.width}×${info.height}) → ${rm.width}×${rm.height}`);
    n++;
  }
  console.log(`${n} recortes de edificio → ${path.relative(ROOT, OUT)}`);
})();
