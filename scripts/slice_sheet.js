'use strict';
/**
 * slice_sheet.js — corta una imagen (típicamente generada por IA) en una
 * grilla de frames y re-arma un spritesheet con frames del tamaño exacto que
 * el juego espera (escala nearest-neighbor, sin emborronar pixel art).
 *
 *   node scripts/slice_sheet.js entrada.png --grid 4x5 --frame 32x48 \
 *     --out client/public/assets/game/iso/chars/trooper_walk.png
 *
 *   --grid CxR   columnas×filas en que se divide la imagen de ENTRADA
 *   --frame WxH  tamaño final de cada frame en el sheet de salida
 *   --out path   PNG de salida (C columnas × R filas de WxH)
 *
 * Ver docs/ai-art-pipeline.md para el flujo completo.
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { input: null, grid: null, frame: null, out: null };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--grid') a.grid = argv[++i];
    else if (t === '--frame') a.frame = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else if (!t.startsWith('--')) a.input = t;
  }
  return a;
}

function parsePair(str, sep) {
  const [x, y] = String(str).toLowerCase().split(sep).map(Number);
  if (!x || !y) return null;
  return [x, y];
}

const args = parseArgs(process.argv);
const grid = parsePair(args.grid, 'x');
const frame = parsePair(args.frame, 'x');

if (!args.input || !grid || !frame || !args.out) {
  console.error('Uso: node scripts/slice_sheet.js <in.png> --grid CxR --frame WxH --out <out.png>');
  process.exit(1);
}

const [cols, rows] = grid;
const [fw, fh] = frame;

const src = PNG.sync.read(fs.readFileSync(args.input));
const cellW = Math.floor(src.width / cols);
const cellH = Math.floor(src.height / rows);

const out = new PNG({ width: fw * cols, height: fh * rows, colorType: 6 });

// Nearest-neighbor por celda: cada frame de salida muestrea su celda de entrada
for (let row = 0; row < rows; row++) {
  for (let col = 0; col < cols; col++) {
    const sx0 = col * cellW, sy0 = row * cellH;
    const dx0 = col * fw, dy0 = row * fh;
    for (let y = 0; y < fh; y++) {
      for (let x = 0; x < fw; x++) {
        const sx = sx0 + Math.floor((x / fw) * cellW);
        const sy = sy0 + Math.floor((y / fh) * cellH);
        const si = (sy * src.width + sx) * 4;
        const di = ((dy0 + y) * out.width + (dx0 + x)) * 4;
        out.data[di] = src.data[si];
        out.data[di + 1] = src.data[si + 1];
        out.data[di + 2] = src.data[si + 2];
        out.data[di + 3] = src.data[si + 3];
      }
    }
  }
}

fs.mkdirSync(path.dirname(args.out), { recursive: true });
fs.writeFileSync(args.out, PNG.sync.write(out));
console.log(`✓ ${args.out} — ${cols}×${rows} frames de ${fw}×${fh} (desde celdas de ${cellW}×${cellH})`);
