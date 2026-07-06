'use strict';
/**
 * process_art.js — prepara una imagen cruda de art-inbox/ para el juego:
 *   1) hace transparente el fondo (flood-fill desde las 4 esquinas, tolerante)
 *   2) recorta al contenido (bounding box no-transparente)
 *   3) reescala al tamaño destino con promedio de área (downscale nítido)
 *
 *   node scripts/process_art.js art-inbox/tower.png \
 *     client/public/assets/game/buildings/tower.png --size 128
 *
 * Pensado para los edificios generados por Nano Banana (sujeto centrado sobre
 * fondo oscuro liso). Sombra propia del juego la pone el motor.
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { in: null, out: null, size: 128, tol: 62 };
  const pos = [];
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--size') a.size = Number(argv[++i]);
    else if (t === '--tol') a.tol = Number(argv[++i]);
    else pos.push(t);
  }
  a.in = pos[0]; a.out = pos[1];
  return a;
}

const args = parseArgs(process.argv);
if (!args.in || !args.out) {
  console.error('Uso: node scripts/process_art.js <in.png> <out.png> [--size 128] [--tol 62]');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const src = PNG.sync.read(fs.readFileSync(path.isAbsolute(args.in) ? args.in : path.join(ROOT, args.in)));
const { width: W, height: H, data } = src;

const idx = (x, y) => (y * W + x) * 4;
const alpha = new Uint8Array(W * H).fill(255);

// ── 1) Flood-fill de fondo desde las 4 esquinas ──
const seeds = [[0, 0], [W - 1, 0], [0, H - 1], [W - 1, H - 1]];
const visited = new Uint8Array(W * H);
const stack = [];
const colorAt = (x, y) => { const i = idx(x, y); return [data[i], data[i + 1], data[i + 2]]; };
const dist2 = (a, b) => (a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2;
const tol2 = args.tol * args.tol;

for (const [sx, sy] of seeds) {
  const seedColor = colorAt(sx, sy);
  stack.push([sx, sy]);
  while (stack.length) {
    const [x, y] = stack.pop();
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const p = y * W + x;
    if (visited[p]) continue;
    if (dist2(colorAt(x, y), seedColor) > tol2) continue;
    visited[p] = 1;
    alpha[p] = 0;
    stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
  }
}

// ── 2) Bounding box del contenido opaco ──
let minX = W, minY = H, maxX = 0, maxY = 0;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (alpha[y * W + x] > 0) {
      if (x < minX) minX = x; if (x > maxX) maxX = x;
      if (y < minY) minY = y; if (y > maxY) maxY = y;
    }
  }
}
if (maxX < minX) { console.error('✗ imagen quedó vacía tras el recorte (subí --tol?)'); process.exit(1); }
const cw = maxX - minX + 1;
const ch = maxY - minY + 1;

// ── 3) Downscale por promedio de área al tamaño destino (encajar en size×size) ──
const scale = Math.min(args.size / cw, args.size / ch);
const outW = Math.max(1, Math.round(cw * scale));
const outH = Math.max(1, Math.round(ch * scale));
const out = new PNG({ width: outW, height: outH, colorType: 6 });

for (let oy = 0; oy < outH; oy++) {
  for (let ox = 0; ox < outW; ox++) {
    // Rango de píxeles fuente que caen en esta celda destino
    const x0 = minX + Math.floor(ox / scale);
    const x1 = minX + Math.floor((ox + 1) / scale);
    const y0 = minY + Math.floor(oy / scale);
    const y1 = minY + Math.floor((oy + 1) / scale);
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = y0; sy <= Math.min(y1, maxY); sy++) {
      for (let sx = x0; sx <= Math.min(x1, maxX); sx++) {
        const p = sy * W + sx;
        const i = p * 4;
        const av = alpha[p];
        // Promedio ponderado por alpha para no manchar los bordes con fondo
        r += data[i] * av; g += data[i + 1] * av; b += data[i + 2] * av;
        a += av; n++;
      }
    }
    const oi = (oy * outW + ox) * 4;
    if (a > 0) {
      out.data[oi] = Math.round(r / a);
      out.data[oi + 1] = Math.round(g / a);
      out.data[oi + 2] = Math.round(b / a);
      out.data[oi + 3] = Math.round(a / Math.max(1, n));
    } else {
      out.data[oi + 3] = 0;
    }
  }
}

const outPath = path.isAbsolute(args.out) ? args.out : path.join(ROOT, args.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, PNG.sync.write(out));
console.log(`✓ ${args.out} — ${outW}×${outH} (recortado de ${cw}×${ch}, fondo transparente)`);
