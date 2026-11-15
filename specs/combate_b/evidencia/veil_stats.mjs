// Estadística del fondo combat_veil_gate frente al resto de fondos de combate (luma media/desvío por tercio vertical).
// Uso: node specs/combate_b/evidencia/veil_stats.mjs
import { createRequire } from 'node:module';
const req = createRequire('D:/Proyectos/kingdoms-harvest/node_modules/x.js');
const sharp = req('sharp');
const dir = 'client/public/assets/b/bg/';
for (const n of ['combat_veil_gate', 'combat_veil_marsh', 'combat_crypt', 'combat_ashfield']) {
  try {
    const { data, info } = await sharp(dir + n + '.webp').greyscale().raw().toBuffer({ resolveWithObject: true });
    const out = [];
    for (let t = 0; t < 3; t++) {
      const a = Math.floor(info.height * t / 3) * info.width; const b = Math.floor(info.height * (t + 1) / 3) * info.width;
      let s = 0; let q = 0; const c = b - a;
      for (let i = a; i < b; i++) { s += data[i]; q += data[i] * data[i]; }
      const m = s / c; out.push({ tercio: ['alto', 'medio', 'bajo'][t], lumaMedia: +m.toFixed(1), desvio: +Math.sqrt(q / c - m * m).toFixed(1) });
    }
    console.log(n, `${info.width}x${info.height}`, JSON.stringify(out));
  } catch (e) { console.log(n, 'no existe'); }
}
