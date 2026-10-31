// R22/R23: contraste de los textos del menu (bone, bone-dim, brass-light) sobre el key art CON la capa
// ink .7 de MainMenu.jsx, por tercio vertical (percentil 95 y 99 de luminancia del fondo resultante).
// Uso: NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules node art-b/menu/contraste_menu_capa.js
const sharp = require('sharp');
const path = require('path');
const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = ([r, g, b]) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const INK = hex('#14110d'), A = 0.7;
const TXT = { bone: L(hex('#e6dcc3')), boneDim: L(hex('#a89c84')), brassLight: L(hex('#d9b77a')) };
(async () => {
  const { data, info } = await sharp(path.join(__dirname, '..', '..', 'client/public/assets/b/menu/key_art.webp')).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const out = [];
  for (let t = 0; t < 3; t++) {
    const lums = [];
    for (let y = Math.floor(h * t / 3); y < Math.floor(h * (t + 1) / 3); y++) for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 3;
      lums.push(L([0, 1, 2].map((k) => A * INK[k] + (1 - A) * data[i + k])));
    }
    lums.sort((a, b) => a - b);
    const q = (p) => lums[Math.floor(lums.length * p)];
    const row = { tercio: t + 1 };
    for (const [n, v] of Object.entries(TXT)) { row[`${n}_p95`] = +((v + 0.05) / (q(0.95) + 0.05)).toFixed(2); row[`${n}_p99`] = +((v + 0.05) / (q(0.99) + 0.05)).toFixed(2); }
    out.push(row);
  }
  console.log(JSON.stringify(out));
})();
