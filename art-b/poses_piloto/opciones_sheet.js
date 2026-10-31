'use strict';
// Hoja de decision de escala del warrior (p-kh): por fila (hit, skill, victory, ko) = idle | A cabeza | C actual (altura) | B torso, a escala comun x0.5.
// node art-b/poses_piloto/opciones_sheet.js <dir_variantes>  -> specs/poses_b_piloto/evidencia/piloto/opciones_escala.webp
const path = require('path');
const sharp = require('sharp');
const S = process.argv[2];
const H = path.join(__dirname, '..', '..', 'client', 'public', 'assets', 'b', 'heroes');
const OUT = path.join(__dirname, '..', '..', 'specs', 'poses_b_piloto', 'evidencia', 'piloto', 'opciones_escala.webp');
const K = 0.5, PAD = 24, ROW = Math.round(900 * K) + 40, BG = '#2a2622';
const label = (t) => Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="260" height="30"><text x="2" y="22" font-family="Arial" font-size="20" fill="#e8dcc0">${t}</text></svg>`);
(async () => {
  const rows = ['hit', 'skill', 'victory', 'ko'];
  const cols = (k) => [['idle', path.join(H, 'warrior_idle.webp')], ['A cabeza', path.join(S, `${k}_A.webp`)], ['C actual', path.join(H, `warrior_${k}.webp`)], ['B torso', path.join(S, `${k}_B.webp`)]];
  const comp = []; let W = 0;
  for (let r = 0; r < rows.length; r++) {
    let x = PAD; const y0 = r * (ROW + PAD) + PAD;
    for (const [name, f] of cols(rows[r])) {
      const m = await sharp(f).metadata();
      const w = Math.round(m.width * K), h = Math.round(m.height * K);
      comp.push({ input: await sharp(f).resize(w, h).toBuffer(), left: x, top: y0 + ROW - h });
      comp.push({ input: label(`${rows[r]} · ${name}`), left: x, top: y0 });
      x += w + PAD;
    }
    W = Math.max(W, x);
  }
  const Ht = rows.length * (ROW + PAD) + PAD;
  await sharp({ create: { width: W, height: Ht, channels: 3, background: BG } }).composite(comp).webp({ quality: 85 }).toFile(OUT);
  console.log(OUT, W, Ht);
})();
