'use strict';
/**
 * assemble_dirs.js — arma un spritesheet DIRECCIONAL a partir de 3 tiras IA de
 * caminado (mismo personaje visto de frente/espalda/costado). Cada tira es UNA
 * generación → diseño consistente; el detallado idéntico en los prompts
 * mantiene el mismo diseño entre las 3 direcciones.
 *
 * Layout de salida (row-major, frame 32×48):
 *   fila 0 = DOWN  (de frente, mirando al jugador)   frames 0..N-1
 *   fila 1 = UP    (de espalda, alejándose)           frames N..2N-1
 *   fila 2 = SIDE  (perfil derecho; izquierda = flipX) frames 2N..3N-1
 *
 * Clave anti-jitter: ESCALA COMPARTIDA entre TODAS las celdas de las 3 tiras
 * (personaje del mismo tamaño mire donde mire) + pies al piso + centrado en X.
 *
 *   node scripts/assemble_dirs.js out.png --down d.png --up u.png --side s.png \
 *     --slices 4 --fw 32 --fh 48 --tol 45 --bottom 1
 *
 * Slot: characters/npc_<rol>.png  (lo consume BootScene con 4×3 = 12 frames)
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { out: null, down: null, up: null, side: null, slices: 4, fw: 32, fh: 48, tol: 45, bottom: 1 };
  const pos = [];
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--down') a.down = argv[++i];
    else if (t === '--up') a.up = argv[++i];
    else if (t === '--side') a.side = argv[++i];
    else if (t === '--slices') a.slices = Number(argv[++i]);
    else if (t === '--fw') a.fw = Number(argv[++i]);
    else if (t === '--fh') a.fh = Number(argv[++i]);
    else if (t === '--tol') a.tol = Number(argv[++i]);
    else if (t === '--bottom') a.bottom = Number(argv[++i]);
    else pos.push(t);
  }
  a.out = pos[0];
  return a;
}

const args = parseArgs(process.argv);
if (!args.out || !args.down || !args.up || !args.side) {
  console.error('Uso: node scripts/assemble_dirs.js <out.png> --down d.png --up u.png --side s.png [--slices 4] [--fw 32] [--fh 48] [--tol 45] [--bottom 1]');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const abs = (p) => (path.isAbsolute(p) ? p : path.join(ROOT, p));
const tol2 = args.tol * args.tol;

// Analiza una tira: devuelve { img, W, cellW, cells:[{bg,minX,minY,maxX,maxY,cx0}] }
function loadStrip(file) {
  const img = PNG.sync.read(fs.readFileSync(abs(file)));
  const { width: W, height: H, data } = img;
  const cellW = Math.floor(W / args.slices);
  const at = (x, y) => { const i = (y * W + x) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const d2 = (a, b) => (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
  const cells = [];
  for (let c = 0; c < args.slices; c++) {
    const cx0 = c * cellW, cx1 = cx0 + cellW;
    const bg = new Uint8Array(cellW * H);
    const stack = [];
    for (const [sx, sy] of [[cx0, 0], [cx1 - 1, 0], [cx0, H - 1], [cx1 - 1, H - 1]]) {
      const seed = at(sx, sy);
      stack.push([sx, sy]);
      while (stack.length) {
        const [x, y] = stack.pop();
        if (x < cx0 || y < 0 || x >= cx1 || y >= H) continue;
        const li = (x - cx0) + y * cellW;
        if (bg[li]) continue;
        if (d2(at(x, y), seed) > tol2) continue;
        bg[li] = 1;
        stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
      }
    }
    let minX = cellW, minY = H, maxX = -1, maxY = -1;
    for (let y = 0; y < H; y++) for (let lx = 0; lx < cellW; lx++) {
      if (!bg[lx + y * cellW]) {
        if (lx < minX) minX = lx; if (lx > maxX) maxX = lx;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    cells.push({ bg, minX, minY, maxX, maxY, cx0 });
  }
  return { img, W, H, data, cellW, cells };
}

const strips = { down: loadStrip(args.down), up: loadStrip(args.up), side: loadStrip(args.side) };
const order = ['down', 'up', 'side'];

// Escala compartida global (todas las celdas de las 3 tiras).
let maxCW = 1, maxCH = 1;
for (const k of order) for (const c of strips[k].cells) {
  maxCW = Math.max(maxCW, c.maxX - c.minX + 1);
  maxCH = Math.max(maxCH, c.maxY - c.minY + 1);
}
const availW = args.fw - 2, availH = args.fh - 1 - args.bottom;
const scale = Math.min(availW / maxCW, availH / maxCH);

const sheet = new PNG({ width: args.fw * args.slices, height: args.fh * 3, colorType: 6 });

for (let row = 0; row < 3; row++) {
  const s = strips[order[row]];
  for (let f = 0; f < args.slices; f++) {
    const c = s.cells[f];
    const cw = c.maxX - c.minX + 1, ch = c.maxY - c.minY + 1;
    if (cw <= 0 || ch <= 0) continue;
    const sw = Math.max(1, Math.round(cw * scale));
    const sh = Math.max(1, Math.round(ch * scale));
    const offX = f * args.fw + Math.floor((args.fw - sw) / 2);
    const offY = row * args.fh + (args.fh - args.bottom - sh);
    for (let oy = 0; oy < sh; oy++) {
      for (let ox = 0; ox < sw; ox++) {
        const fx0 = c.minX + Math.floor(ox / scale), fx1 = c.minX + Math.floor((ox + 1) / scale);
        const fy0 = c.minY + Math.floor(oy / scale), fy1 = c.minY + Math.floor((oy + 1) / scale);
        let r = 0, g = 0, b = 0, a = 0, n = 0;
        for (let sy = fy0; sy <= Math.min(fy1, c.maxY); sy++) {
          for (let sx = fx0; sx <= Math.min(fx1, c.maxX); sx++) {
            const li = sx + sy * s.cellW;
            const av = c.bg[li] ? 0 : 255;
            const gi = (sy * s.W + (c.cx0 + sx)) * 4;
            r += s.data[gi] * av; g += s.data[gi + 1] * av; b += s.data[gi + 2] * av;
            a += av; n++;
          }
        }
        const fx = offX + ox, fy = offY + oy;
        if (fx < 0 || fy < 0 || fx >= sheet.width || fy >= sheet.height) continue;
        const si = (fy * sheet.width + fx) * 4;
        if (a > 0) {
          sheet.data[si] = Math.round(r / a);
          sheet.data[si + 1] = Math.round(g / a);
          sheet.data[si + 2] = Math.round(b / a);
          sheet.data[si + 3] = Math.round(a / Math.max(1, n));
        } else { sheet.data[si + 3] = 0; }
      }
    }
  }
}

const outPath = abs(args.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, PNG.sync.write(sheet));
console.log(`✓ ${args.out} — ${sheet.width}×${sheet.height} (${args.slices}×3 frames ${args.fw}×${args.fh}: down/up/side, escala ${scale.toFixed(3)})`);
