// Perfil de anchura (px opacos por fila, cada 20 px desde la cima) de una pose: node rowprof.js <webp>...
const sharp = require('sharp');
(async () => { for (const f of process.argv.slice(2)) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true }); const { width: W, height: H } = info;
  let top = -1; const out = [];
  for (let y = 0; y < H; y++) { let c = 0; for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 128) c++; if (top < 0 && c > 6) top = y; if (top >= 0 && (y - top) % 20 === 0) out.push(c); }
  console.log(f.split('/').pop(), W + 'x' + H, 'top', top, out.slice(0, 24).join(' '));
} })();
