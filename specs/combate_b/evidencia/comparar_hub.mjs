// Compara las capturas del hub (línea base vs. despues) píxel a píxel. Uso:
//   node specs/combate_b/evidencia/comparar_hub.mjs <dirBase> <dirDespues>
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const req = createRequire('D:/Proyectos/kingdoms-harvest/node_modules/x.js');
const sharp = req('sharp');
const [a, b] = process.argv.slice(2);
const out = {};
for (const f of fs.readdirSync(b).filter((x) => x.endsWith('__hub.png'))) {
  if (!fs.existsSync(path.join(a, f))) { out[f] = 'sin base'; continue; }
  const A = await sharp(path.join(a, f)).raw().toBuffer({ resolveWithObject: true });
  const B = await sharp(path.join(b, f)).raw().toBuffer({ resolveWithObject: true });
  if (A.info.width !== B.info.width || A.info.height !== B.info.height) { out[f] = 'tamaños distintos'; continue; }
  const ch = A.info.channels; let dif = 0; let fuerte = 0;
  for (let i = 0; i < A.data.length; i += ch) {
    const d = Math.abs(A.data[i] - B.data[i]) + Math.abs(A.data[i + 1] - B.data[i + 1]) + Math.abs(A.data[i + 2] - B.data[i + 2]);
    if (d > 0) dif++; if (d > 60) fuerte++;
  }
  const n = A.info.width * A.info.height;
  out[f] = { pxDistintos: +(dif / n * 100).toFixed(2) + ' %', pxDifFuerte: +(fuerte / n * 100).toFixed(2) + ' %' };
}
console.log(JSON.stringify(out, null, 1));
