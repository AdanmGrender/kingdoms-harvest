// Altura (bbox "no fondo", componente mayor aprox. por umbral) de cada recorte de una hoja de poses.
// Uso: node bbox_crops.js <png> x,y,w,h [x,y,w,h ...]  -> imprime alturas y la relación con la mayor
const sharp = require('sharp');
(async () => {
  const f = process.argv[2];
  const crops = process.argv.slice(3).map((s) => s.split(',').map(Number));
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width;
  const bgv = 201;
  const res = crops.map(([cx, cy, cw, ch]) => {
    let t = 1e9; let b = -1; let l = 1e9; let r = -1;
    for (let y = cy; y < cy + ch; y++) {
      let n = 0;
      for (let x = cx; x < cx + cw; x++) {
        const i = (y * W + x) * 4;
        if (Math.abs(data[i] - bgv) + Math.abs(data[i + 1] - bgv) + Math.abs(data[i + 2] - bgv) > 60) { n++; if (x < l) l = x; if (x > r) r = x; }
      }
      if (n >= 3) { if (y < t) t = y; if (y > b) b = y; }
    }
    return { h: b - t + 1, w: r - l + 1, top: t, bottom: b };
  });
  const maxH = Math.max(...res.map((q) => q.h));
  console.log(JSON.stringify(res.map((q) => ({ ...q, rel: Math.round((q.h / maxH) * 1000) / 1000 }))));
})();
