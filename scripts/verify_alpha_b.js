'use strict';
/**
 * verify_alpha_b.js — verifica que los webp recortados tengan fondo transparente real.
 *
 *   node scripts/verify_alpha_b.js <carpeta o archivos .webp>…   (por defecto client/public/assets/b/pickups)
 *
 * Por archivo: esquinas con alpha 0, borde 100 % transparente y un único objeto (componentes con alpha > 8;
 * los sueltos < 1 % del mayor no cuentan). Sale con código 1 si alguno falla.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const inputs = process.argv.slice(2);
if (!inputs.length) inputs.push(path.resolve(__dirname, '../client/public/assets/b/pickups'));
const files = inputs.flatMap((p) => (fs.statSync(p).isDirectory()
  ? fs.readdirSync(p).filter((f) => f.endsWith('.webp')).sort().map((f) => path.join(p, f))
  : [p]));

(async () => {
  let ok = true;
  for (const f of files) {
    const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const W = info.width;
    const H = info.height;
    const A = (x, y) => data[(y * W + x) * 4 + 3];
    const corners = [A(0, 0), A(W - 1, 0), A(0, H - 1), A(W - 1, H - 1)];
    let border = 0;
    let borderTransp = 0;
    let opaque = 0;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        if (A(x, y) > 8) opaque++;
        if (x === 0 || y === 0 || x === W - 1 || y === H - 1) { border++; if (A(x, y) === 0) borderTransp++; }
      }
    }
    const lab = new Int32Array(W * H).fill(-1);
    const sizes = [];
    for (let s = 0; s < W * H; s++) {
      if (lab[s] !== -1 || data[s * 4 + 3] <= 8) continue;
      let c = 0;
      const st = [s];
      lab[s] = sizes.length;
      while (st.length) {
        const i = st.pop();
        c++;
        const x = i % W;
        const y = (i / W) | 0;
        for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
          if (j >= 0 && lab[j] === -1 && data[j * 4 + 3] > 8) { lab[j] = sizes.length; st.push(j); }
        }
      }
      sizes.push(c);
    }
    sizes.sort((a, b) => b - a);
    const big = sizes.filter((s) => s >= sizes[0] * 0.01).length;
    const pass = corners.every((a) => a === 0) && borderTransp === border && big === 1;
    if (!pass) ok = false;
    console.log(`${path.basename(f)} ${W}x${H} esquinas_alpha=[${corners}] borde_transparente=${borderTransp}/${border} `
      + `opaco=${(100 * opaque / (W * H)).toFixed(0)}% componentes(a>8)=${sizes.length} [${sizes.slice(0, 3)}] ${pass ? 'OK' : 'REVISAR'}`);
  }
  console.log(ok ? 'TODOS OK' : 'HAY FALLOS');
  process.exit(ok ? 0 : 1);
})();
