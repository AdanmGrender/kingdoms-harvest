// Diferencia pixel a pixel entre capturas con fallback plano y con arte (mapas): prueba que el fondo se pinta.
// Uso: NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules node art-b/menu/diff_captures.js
const sharp = require('sharp');
const path = require('path');
const E = path.join(__dirname, '..', '..', 'specs/pantallas_b/evidencia');
(async () => {
  const out = [];
  for (const d of ['galaxy-a-360x740', 'android-360x800', 'pixel7-412x915']) {
    for (const p of ['menu', 'system', 'galaxy']) {
      const a = await sharp(path.join(E, 'despues', `${d}__${p}.webp`)).greyscale().raw().toBuffer({ resolveWithObject: true });
      const b = await sharp(path.join(E, 'despues_arte', `${d}__${p}.webp`)).greyscale().raw().toBuffer();
      let n = 0, sum = 0;
      for (let i = 0; i < a.data.length; i++) { const df = Math.abs(a.data[i] - b[i]); if (df > 6) n++; sum += df; }
      out.push({ d, p, pxDistintos: +(100 * n / a.data.length).toFixed(1), difMedia: +(sum / a.data.length).toFixed(2) });
    }
  }
  console.log(JSON.stringify(out));
})();
