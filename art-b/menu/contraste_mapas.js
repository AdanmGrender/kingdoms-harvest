// R34: contraste del texto bone / bone-dim sobre el peor pixel del fondo de mapa (arte + capa rgba(20,17,13,.78)).
// Uso: NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules node art-b/menu/contraste_mapas.js
const sharp = require('sharp');
const path = require('path');
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const cr = (a, b) => { const [x, y] = [L(a), L(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05); };
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const BONE = hex('#e6dcc3'), DIM = hex('#a89c84'), LAYER = [20, 17, 13], A = 0.78;
(async () => {
  const out = [];
  for (const rel of ['map/marca.webp', 'map/reinos.webp']) {
    const { data, info } = await sharp(path.join(__dirname, '..', '..', 'client/public/assets/b', rel)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
    const lums = [];
    let worst = null;
    for (let i = 0; i < data.length; i += 3) {
      const px = [0, 1, 2].map((k) => Math.round(A * LAYER[k] + (1 - A) * data[i + k]));
      const l = L(px);
      lums.push(l);
      if (!worst || l > worst.l) worst = { l, px };
    }
    lums.sort((a, b) => a - b);
    const p99 = lums[Math.floor(lums.length * 0.99)];
    // pixel con luminancia p99
    const px99 = [0, 1, 2].map(() => 0);
    out.push({
      img: rel,
      peorPixel: worst.px,
      boneSobrePeor: +cr(BONE, worst.px).toFixed(2),
      boneDimSobrePeor: +cr(DIM, worst.px).toFixed(2),
      lumP99: +p99.toFixed(4),
      boneDimSobreP99: +((L(DIM) + 0.05) / (p99 + 0.05)).toFixed(2),
    });
  }
  console.log(JSON.stringify(out, null, 1));
})();
