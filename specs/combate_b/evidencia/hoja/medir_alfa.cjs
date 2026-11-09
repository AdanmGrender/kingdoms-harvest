// Bounds alfa reales (alfa>0) de cada sprite de combate: l/r/t/b del bbox y proporciones. Perspectiva C de T10.6.
// T10.7 (B4): además `pl`/`pr` = ancho de los pies, las columnas con alfa > 128 en el 6 % inferior de la silueta (lo
// que apoya en el piso; va a SPRITE_GEOM para que los pies de cada fila de enemigos caigan sobre piso real).
// Uso: KH_NODE_MODULES=<node_modules con sharp> node medir_alfa.cjs  → escribe hoja_alfa.json y lo imprime en tabla.
const path = require('node:path');
const fs = require('node:fs');
const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const sharp = require(path.join(NM, 'sharp'));
const ROOT = path.join(__dirname, '..', '..', '..', '..', 'client', 'public', 'assets', 'b');
(async () => {
  const out = {};
  for (const d of ['heroes', 'enemies']) {
    for (const f of fs.readdirSync(path.join(ROOT, d)).filter((n) => n.endsWith('.webp')).sort()) {
      const { data, info } = await sharp(path.join(ROOT, d, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = info.width, H = info.height;
      let l = W, r = -1, t = H, b = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3] > 0) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
      }
      const y0 = Math.round(b - (b - t) * 0.06);
      let pl = W, pr = -1;
      for (let y = y0; y <= b; y++) for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3] > 128) { if (x < pl) pl = x; if (x > pr) pr = x; }
      }
      out[`${d}/${f.replace('.webp', '')}`] = {
        W, H, l, r, t, b, pl, pr,
        wFrac: +((r - l + 1) / W).toFixed(4), hFrac: +((b - t + 1) / H).toFixed(4),
        cx: +(((l + r + 1) / 2) / W).toFixed(4), botGap: H - 1 - b, topGap: t,
      };
    }
  }
  fs.writeFileSync(path.join(__dirname, 'hoja_alfa.json'), JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(28), `${v.W}x${v.H}`.padEnd(9), `x ${v.l}..${v.r}`.padEnd(14), `y ${v.t}..${v.b}`.padEnd(14), `wFrac ${v.wFrac}`, `hFrac ${v.hFrac}`, `cx ${v.cx}`, `piesGap ${v.botGap}`, `pies ${v.pl}..${v.pr}`);
})();
