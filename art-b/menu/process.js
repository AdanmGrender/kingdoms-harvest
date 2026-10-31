// Reprocesa art-b/menu/raw/*.png -> client/public/assets/b/{menu,map}/*.webp (<= 250 KB cada uno).
// Uso: NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules node art-b/menu/process.js
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(ROOT, 'client/public/assets/b');
const ITEMS = [['key_art', 'menu/key_art.webp'], ['marca', 'map/marca.webp'], ['reinos', 'map/reinos.webp']];
const LIMIT = 250 * 1024;
(async () => {
  const rows = [];
  for (const [id, rel] of ITEMS) {
    const src = path.join(process.env.ART_RAW || 'D:/Proyectos/_ops/art-raw/pantallas_b_menu', `${id}.png`);
    const out = path.join(OUT, rel);
    let q = 82, bytes = 0;
    for (; q >= 40; q -= 6) {
      await sharp(src).webp({ quality: q, effort: 6 }).toFile(out);
      bytes = fs.statSync(out).size;
      if (bytes <= LIMIT) break;
    }
    const m = await sharp(out).metadata();
    const st = await sharp(out).greyscale().stats();
    // luminancia media por tercio vertical (zonas de texto/botones)
    const { width: w, height: h } = m; const th = Math.floor(h / 3);
    const thirds = [];
    for (let i = 0; i < 3; i++) {
      const buf = await sharp(out).extract({ left: 0, top: i * th, width: w, height: th }).greyscale().png().toBuffer();
      const s = await sharp(buf).stats();
      thirds.push(Math.round(s.channels[0].mean));
    }
    rows.push({ id, out: rel, w, h, kb: +(bytes / 1024).toFixed(1), quality: q, lumMedia: Math.round(st.channels[0].mean), lumTercios: thirds });
  }
  console.log(JSON.stringify(rows, null, 1));
  fs.writeFileSync(path.join(ROOT, 'specs/pantallas_b/evidencia/arte/medidas.json'), JSON.stringify(rows, null, 1));
})();
