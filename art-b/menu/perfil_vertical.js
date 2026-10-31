// Perfil vertical del key art: por banda del 5 % de alto, luminancia media, energia de borde (gradiente medio)
// y porcentaje de pixeles "calidos brillantes" (llama: R>180, R>G+40). Sirve para ver dónde está el sujeto
// frente a la franja que tapa el bloque del menú (22–76 %). Uso:
// NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules node art-b/menu/perfil_vertical.js [archivo.webp]
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');
const file = process.argv[2] || path.join(__dirname, '..', '..', 'client/public/assets/b/menu/key_art.webp');
(async () => {
  const { data, info } = await sharp(file).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  const lum = (x, y) => { const i = (y * w + x) * 3; return 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]; };
  const rows = [];
  for (let b = 0; b < 20; b++) {
    const y0 = Math.floor((b * h) / 20), y1 = Math.floor(((b + 1) * h) / 20);
    let sl = 0, sg = 0, hot = 0, n = 0;
    for (let y = y0; y < y1 - 1; y++) for (let x = 0; x < w - 1; x++) {
      const l = lum(x, y); sl += l; n++;
      sg += Math.abs(l - lum(x + 1, y)) + Math.abs(l - lum(x, y + 1));
      const i = (y * w + x) * 3; if (data[i] > 180 && data[i] > data[i + 1] + 40) hot++;
    }
    rows.push({ desdePct: b * 5, hastaPct: (b + 1) * 5, lumMedia: +(sl / n).toFixed(1), bordes: +(sg / n).toFixed(1), calidoBrillantePct: +((100 * hot) / n).toFixed(2) });
  }
  const franja = rows.filter((r) => r.desdePct >= 25 && r.hastaPct <= 75);
  const resto = rows.filter((r) => r.hastaPct <= 20 || r.desdePct >= 80);
  const avg = (a, k) => +(a.reduce((s, r) => s + r[k], 0) / a.length).toFixed(1);
  const out = { archivo: path.basename(file), w, h, bandas: rows,
    resumen: { franja25_75: { lum: avg(franja, 'lumMedia'), bordes: avg(franja, 'bordes') }, fuera: { lum: avg(resto, 'lumMedia'), bordes: avg(resto, 'bordes') } } };
  console.log(JSON.stringify(out.resumen));
  console.log(rows.map((r) => `${String(r.desdePct).padStart(2)}-${String(r.hastaPct).padStart(3)}%  lum ${String(r.lumMedia).padStart(5)}  bordes ${String(r.bordes).padStart(5)}  calido ${r.calidoBrillantePct}`).join('\n'));
  if (process.argv[3]) fs.writeFileSync(process.argv[3], JSON.stringify(out, null, 1));
})();
