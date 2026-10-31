'use strict';
// Hoja final del warrior (r4, escala por pose decidida por p-kh t_207c5474): idle | hit | skill | victory | ko a escala real,
// apoyados en la misma línea de suelo (última fila con alfa>128). Fondo oscuro.
// node art-b/poses_piloto/final_sheet.js -> specs/poses_b_piloto/evidencia/piloto/hoja_final.webp
const path = require('path');
const sharp = require('sharp');
const H = path.join(__dirname, '..', '..', 'client', 'public', 'assets', 'b', 'heroes');
const OUT = path.join(__dirname, '..', '..', 'specs', 'poses_b_piloto', 'evidencia', 'piloto', 'hoja_final.webp');
const PAD = 24, BG = '#2a2622';
const label = (t) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="300" height="30"><text x="2" y="22" font-family="Arial" font-size="20" fill="#e8dcc0">${t}</text></svg>`);
const names = [['idle', ''], ['hit', '×1,478'], ['skill', '×1,267'], ['victory', '×1,267'], ['ko', '×1,45']];
(async () => {
  const items = [];
  for (const [k, s] of names) {
    const f = path.join(H, `warrior_${k}.webp`);
    const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    let low = info.height - 1;
    outer: for (; low >= 0; low--) for (let x = 0; x < info.width; x++) if (data[(low * info.width + x) * 4 + 3] > 128) break outer;
    items.push({ k, s, f, w: info.width, h: info.height, foot: low + 1 });
  }
  const up = Math.max(...items.map((i) => i.foot)), down = Math.max(...items.map((i) => i.h - i.foot));
  const base = 40 + up, Ht = base + down + PAD;
  let x = PAD; const comp = [];
  for (const i of items) {
    comp.push({ input: i.f, left: x, top: base - i.foot });
    comp.push({ input: label(`${i.k} ${i.s}`), left: x, top: 4 });
    x += i.w + PAD;
  }
  await sharp({ create: { width: x, height: Ht, channels: 3, background: BG } }).composite(comp).webp({ quality: 85 }).toFile(OUT);
  console.log(OUT, x, Ht, items.map((i) => `${i.k}:foot=${i.foot}/${i.h}`).join(' '));
})();
