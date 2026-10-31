// Hoja de contacto de la puerta de arte: key_art | marca | reinos (3 columnas, alto 900) y
// hoja de capturas del menu con arte (3 celulares lado a lado).
// Uso: NODE_PATH=D:/Proyectos/kingdoms-harvest/node_modules node art-b/menu/contacto.js
const sharp = require('sharp');
const path = require('path');
const ROOT = path.join(__dirname, '..', '..');
const A = path.join(ROOT, 'client/public/assets/b');
const E = path.join(ROOT, 'specs/pantallas_b/evidencia');
async function fila(files, h, out) {
  const bufs = [];
  for (const f of files) bufs.push(await sharp(f).resize({ height: h }).png().toBuffer());
  const metas = await Promise.all(bufs.map((b) => sharp(b).metadata()));
  const gap = 12;
  const W = metas.reduce((s, m) => s + m.width, 0) + gap * (bufs.length - 1);
  let x = 0;
  const comp = bufs.map((b, i) => { const c = { input: b, left: x, top: 0 }; x += metas[i].width + gap; return c; });
  await sharp({ create: { width: W, height: h, channels: 3, background: '#14110d' } }).composite(comp).webp({ quality: 80 }).toFile(out);
}
(async () => {
  await fila([path.join(A, 'menu/key_art.webp'), path.join(A, 'map/marca.webp'), path.join(A, 'map/reinos.webp')], 900, path.join(E, 'arte/contacto_arte.webp'));
  const d = ['galaxy-a-360x740', 'android-360x800', 'pixel7-412x915'].map((n) => path.join(E, 'despues_arte', `${n}__menu.webp`));
  await fila(d, 900, path.join(E, 'arte/contacto_menu_con_arte.webp'));
  console.log('ok');
})();
