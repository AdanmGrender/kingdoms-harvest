'use strict';
// Compone la "hoja existente" (idle + pose actual lado a lado) como ref única de la web (solo se sube la 1ª ref).
const path = require('path');
const sharp = require('sharp');
// r2: refs SOLO del arte v2 (webp procesados y commiteados, con alfa) montados sobre #d0d0d0. Nunca art-b/raw (v1).
const RAW = path.join(__dirname, '..', '..', 'client', 'public', 'assets', 'b');
const OUT = path.join(__dirname, 'refs');
async function sheet(files, out) {
  const H = 768;
  const bufs = [];
  for (const f of files) {
    const b = await sharp(path.join(RAW, f)).resize({ height: H }).png().toBuffer();
    bufs.push({ b, w: (await sharp(b).metadata()).width });
  }
  const W = bufs.reduce((s, x) => s + x.w, 0);
  let x = 0;
  const comp = bufs.map((o) => { const c = { input: o.b, left: x, top: 0 }; x += o.w; return c; });
  await sharp({ create: { width: W, height: H, channels: 3, background: '#d0d0d0' } }).composite(comp).png().toFile(path.join(OUT, out));
  console.log(out, W, H);
}
(async () => {
  await sheet(['heroes/warrior_idle.webp', 'heroes/warrior_attack.webp'], 'warrior_ref.png');
  await sheet(['enemies/bruto_idle.webp', 'enemies/bruto_hit.webp'], 'bruto_ref.png');
  await sheet(['enemies/bruto_idle.webp'], 'bruto_idle_ref.png'); // r3: una sola figura (con dos la web dibujó dos KO)
})();
