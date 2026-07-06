'use strict';
/**
 * downscale.js — reduce una imagen a lo ancho pedido con promedio de área
 * (sin quitar fondo; para arte full-bleed como fondos de menú/pantallas).
 *
 *   node scripts/downscale.js art-inbox/menu_bg_fortress.png \
 *     client/public/assets/game/ambient/menu_bg.png --width 960
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const argv = process.argv;
const inArg = argv[2];
const outArg = argv[3];
let targetW = 960;
for (let i = 4; i < argv.length; i++) if (argv[i] === '--width') targetW = Number(argv[++i]);
if (!inArg || !outArg) {
  console.error('Uso: node scripts/downscale.js <in.png> <out.png> [--width 960]');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const abs = (p) => (path.isAbsolute(p) ? p : path.join(ROOT, p));
const src = PNG.sync.read(fs.readFileSync(abs(inArg)));
const { width: W, height: H, data } = src;

const scale = Math.min(1, targetW / W);
const outW = Math.max(1, Math.round(W * scale));
const outH = Math.max(1, Math.round(H * scale));
const out = new PNG({ width: outW, height: outH, colorType: 6 });

for (let oy = 0; oy < outH; oy++) {
  for (let ox = 0; ox < outW; ox++) {
    const x0 = Math.floor(ox / scale), x1 = Math.min(W, Math.floor((ox + 1) / scale));
    const y0 = Math.floor(oy / scale), y1 = Math.min(H, Math.floor((oy + 1) / scale));
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = y0; sy < Math.max(y0 + 1, y1); sy++) {
      for (let sx = x0; sx < Math.max(x0 + 1, x1); sx++) {
        const i = (sy * W + sx) * 4;
        r += data[i]; g += data[i + 1]; b += data[i + 2]; a += data[i + 3]; n++;
      }
    }
    const oi = (oy * outW + ox) * 4;
    out.data[oi] = Math.round(r / n); out.data[oi + 1] = Math.round(g / n);
    out.data[oi + 2] = Math.round(b / n); out.data[oi + 3] = Math.round(a / n);
  }
}

fs.mkdirSync(path.dirname(abs(outArg)), { recursive: true });
fs.writeFileSync(abs(outArg), PNG.sync.write(out));
const kb = (fs.statSync(abs(outArg)).size / 1024).toFixed(0);
console.log(`✓ ${outArg} — ${outW}×${outH} (${kb} KB)`);
