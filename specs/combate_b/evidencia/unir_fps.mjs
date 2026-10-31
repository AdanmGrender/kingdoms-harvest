// Une los fps_<motor>_<calidad>.json en evidencia/fps.json. Uso: node specs/combate_b/evidencia/unir_fps.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const D = path.join(path.dirname(fileURLToPath(import.meta.url)), 'despues');
const lee = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'));
const out = {
  aviso: 'Medido en escritorio (Chromium headless con GPU NVIDIA RTX 5060), NO en el emulador kh_pixel7 ni en un móvil real: el 60 fps de escritorio no demuestra el objetivo móvil de Q9 (medio ≥ 50 avg; bajo ≥ 30 p5). Queda pendiente la medición en dispositivo.',
  combate: 'a1n3 completo (7 rondas, ~10 s, victoria)',
  medio: { v1: lee('fps_v1_medium.json'), v2: lee('fps_v2_medium.json') },
  bajo: { v1: lee('low/fps_v1_low.json'), v2: lee('low/fps_v2_low.json') },
};
for (const q of ['medio', 'bajo']) for (const m of ['v1', 'v2']) delete out[q][m].cumple;
fs.writeFileSync(path.join(path.dirname(D), 'fps.json'), JSON.stringify(out, null, 2));
console.log(Object.entries(out.medio).concat(Object.entries(out.bajo)).map(([m, v]) => `${m}/${v.calidad}: avg ${v.avg} p5 ${v.p5} min ${v.min} n=${v.n}`).join('\n'));
