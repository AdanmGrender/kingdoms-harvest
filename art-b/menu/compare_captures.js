// Compara capturas con fallback plano (evidencia/despues) vs con arte (evidencia/despues_arte):
// desviacion estandar de luminancia (un fondo plano ~ baja, con arte ~ alta) y luminancia media.
// Uso: NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules node art-b/menu/compare_captures.js
const sharp = require('sharp');
const path = require('path');
const E = path.join(__dirname, '..', '..', 'specs/pantallas_b/evidencia');
(async () => {
  const out = [];
  for (const d of ['galaxy-a-360x740', 'android-360x800', 'pixel7-412x915']) {
    for (const p of ['menu', 'system', 'galaxy']) {
      const row = { d, p };
      for (const dir of ['despues', 'despues_arte']) {
        const s = await sharp(path.join(E, dir, `${d}__${p}.webp`)).greyscale().stats();
        row[dir] = { media: Math.round(s.channels[0].mean), desv: Math.round(s.channels[0].stdev) };
      }
      out.push(row);
    }
  }
  console.log(JSON.stringify(out));
})();
