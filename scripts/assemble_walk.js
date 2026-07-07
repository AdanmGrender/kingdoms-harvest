'use strict';
/**
 * assemble_walk.js — arma un spritesheet de caminar a partir de UNA tira IA con
 * N poses del MISMO personaje (una sola generación → diseño consistente).
 *
 * Clave para que la animación NO tiemble:
 *   - fondo negro fuera por flood-fill desde las esquinas de CADA celda
 *     (preserva los píxeles oscuros interiores del personaje),
 *   - ESCALA COMPARTIDA entre todos los frames (misma altura de personaje),
 *   - pies apoyados en el piso del frame y centrado en X.
 *
 *   node scripts/assemble_walk.js tira.png out.png \
 *     --slices 4 --fw 32 --fh 48 --tol 45 --bottom 1
 *
 * Salida: PNG de (fw*slices)×fh, RGBA. Slot: characters/npc_<rol>.png
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { in: null, out: null, slices: 4, fw: 32, fh: 48, tol: 45, bottom: 1 };
  const pos = [];
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--slices') a.slices = Number(argv[++i]);
    else if (t === '--fw') a.fw = Number(argv[++i]);
    else if (t === '--fh') a.fh = Number(argv[++i]);
    else if (t === '--tol') a.tol = Number(argv[++i]);
    else if (t === '--bottom') a.bottom = Number(argv[++i]);
    else pos.push(t);
  }
  a.in = pos[0]; a.out = pos[1];
  return a;
}

const args = parseArgs(process.argv);
if (!args.in || !args.out) {
  console.error('Uso: node scripts/assemble_walk.js <tira.png> <out.png> [--slices 4] [--fw 32] [--fh 48] [--tol 45] [--bottom 1]');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const abs = (p) => (path.isAbsolute(p) ? p : path.join(ROOT, p));
const src = PNG.sync.read(fs.readFileSync(abs(args.in)));
const { width: W, height: H, data } = src;
const cellW = Math.floor(W / args.slices);
const tol2 = args.tol * args.tol;

// ── Por celda: flood-fill de fondo desde las 4 esquinas + bbox del contenido ──
function analyzeCell(cx0) {
  const cx1 = cx0 + cellW;
  const bg = new Uint8Array(cellW * H); // 1 = fondo
  const at = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const d2 = (a, b) => (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
  const seeds = [[cx0, 0], [cx1 - 1, 0], [cx0, H - 1], [cx1 - 1, H - 1]];
  const stack = [];
  for (const [sx, sy] of seeds) {
    const sc = at(sx, sy);
    stack.push([sx, sy, sc]);
    while (stack.length) {
      const [x, y, seed] = stack.pop();
      if (x < cx0 || y < 0 || x >= cx1 || y >= H) continue;
      const li = (x - cx0) + (y * cellW);
      if (bg[li]) continue;
      if (d2(at(x, y), seed) > tol2) continue;
      bg[li] = 1;
      stack.push([x + 1, y, seed], [x - 1, y, seed], [x, y + 1, seed], [x, y - 1, seed]);
    }
  }
  let minX = cellW, minY = H, maxX = -1, maxY = -1;
  for (let y = 0; y < H; y++) {
    for (let lx = 0; lx < cellW; lx++) {
      if (!bg[lx + y * cellW]) {
        if (lx < minX) minX = lx; if (lx > maxX) maxX = lx;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  return { bg, minX, minY, maxX, maxY, cx0 };
}

const cells = [];
for (let i = 0; i < args.slices; i++) cells.push(analyzeCell(i * cellW));

// ── Escala compartida: el personaje más alto/ancho define la escala de todos ──
let maxCW = 1, maxCH = 1;
for (const c of cells) {
  maxCW = Math.max(maxCW, c.maxX - c.minX + 1);
  maxCH = Math.max(maxCH, c.maxY - c.minY + 1);
}
const availW = args.fw - 2;
const availH = args.fh - 1 - args.bottom;
const scale = Math.min(availW / maxCW, availH / maxCH);

const sheet = new PNG({ width: args.fw * args.slices, height: args.fh, colorType: 6 });

// Downscale por promedio de área ponderado por alpha, celda→frame.
for (let f = 0; f < cells.length; f++) {
  const c = cells[f];
  const cw = c.maxX - c.minX + 1;
  const ch = c.maxY - c.minY + 1;
  if (cw <= 0 || ch <= 0) continue;
  const sw = Math.max(1, Math.round(cw * scale));
  const sh = Math.max(1, Math.round(ch * scale));
  // Centrado en X, pies al piso (misma escala → sin jitter de tamaño).
  const offX = f * args.fw + Math.floor((args.fw - sw) / 2);
  const offY = args.fh - args.bottom - sh;

  for (let oy = 0; oy < sh; oy++) {
    for (let ox = 0; ox < sw; ox++) {
      // Rango fuente (coords absolutas en el strip) para esta celda destino.
      const fx0 = c.minX + Math.floor(ox / scale);
      const fx1 = c.minX + Math.floor((ox + 1) / scale);
      const fy0 = c.minY + Math.floor(oy / scale);
      const fy1 = c.minY + Math.floor((oy + 1) / scale);
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let sy = fy0; sy <= Math.min(fy1, c.maxY); sy++) {
        for (let sx = fx0; sx <= Math.min(fx1, c.maxX); sx++) {
          const li = sx + sy * cellW;               // índice local de bg
          const av = c.bg[li] ? 0 : 255;            // opaco si no es fondo
          const gi = ((sy) * W + (c.cx0 + sx)) * 4; // píxel absoluto en el strip
          r += data[gi] * av; g += data[gi + 1] * av; b += data[gi + 2] * av;
          a += av; n++;
        }
      }
      const fx = offX + ox, fy = offY + oy;
      if (fx < 0 || fy < 0 || fx >= sheet.width || fy >= args.fh) continue;
      const si = (fy * sheet.width + fx) * 4;
      if (a > 0) {
        sheet.data[si] = Math.round(r / a);
        sheet.data[si + 1] = Math.round(g / a);
        sheet.data[si + 2] = Math.round(b / a);
        sheet.data[si + 3] = Math.round(a / Math.max(1, n));
      } else {
        sheet.data[si + 3] = 0;
      }
    }
  }
}

const outPath = abs(args.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, PNG.sync.write(sheet));
console.log(`✓ ${args.out} — ${sheet.width}×${args.fh} (${args.slices} frames ${args.fw}×${args.fh}, escala compartida ${scale.toFixed(3)})`);
