// Escala del cuerpo por tres medidas reproducibles sobre la mascara alfa abierta (radio R=14: quita hoja, plumas y cuchillas).
//  head   = coronilla -> fila de hombros. Hombros = 1a fila (>= top+80) cuyo ancho >= 1.25 x el minimo de las 60 filas previas (salto tras el cuello).
//  legs   = entrepierna -> suela. Entrepierna = fila mas alta, subiendo desde el pie, donde el ancho de pierna total ya no esta partido en 2 tramos (hueco >= 8 px)
//           (solo poses de pie; el KO arrodillado no tiene sentido aqui).
//  boot   = ancho del tramo mas ancho entre 94 % y 100 % del alto (bota).
//  torso  = mediana del ancho entre 30-55 % del alto  (como measure.js).
// Uso: R=14 node measure_body.js <idle.webp> <pose.webp>...   (el primero es la referencia: imprime tambien razones pose/idle)
const sharp = require('sharp');
async function body(f, r) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const W = info.width, H = info.height; const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  const box = (src, mn) => { const t = new Uint8Array(W * H), o = new Uint8Array(W * H);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = mn ? 1 : 0; for (let k = Math.max(0, x - r); k <= Math.min(W - 1, x + r); k++) v = mn ? v & src[y * W + k] : v | src[y * W + k]; t[y * W + x] = v; }
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = mn ? 1 : 0; for (let k = Math.max(0, y - r); k <= Math.min(H - 1, y + r); k++) v = mn ? v & t[k * W + x] : v | t[k * W + x]; o[y * W + x] = v; } return o; };
  const op = box(box(m, true), false);
  const w = [], runs = [];
  for (let y = 0; y < H; y++) { let c = 0; const rs = []; let s = -1; for (let x = 0; x <= W; x++) { const v = x < W ? op[y * W + x] : 0; c += v; if (v && s < 0) s = x; if (!v && s >= 0) { rs.push([s, x - 1]); s = -1; } } w.push(c); runs.push(rs); }
  const top = w.findIndex((c) => c > 0); let bot = H - 1; while (w[bot] === 0) bot--; const h = bot - top + 1;
  const wr = (y) => w[top + y];
  // cuello = fila de ancho minimo entre y=100 y el 40 % del alto; hombros = 1a fila bajo el cuello con ancho >= 1.2 x el del cuello
  let neck = 100; for (let y = 100; y < h * 0.4; y++) if (wr(y) < wr(neck)) neck = y;
  let sh = -1; for (let y = neck; y < h; y++) if (wr(y) >= 1.2 * wr(neck)) { sh = y; break; }
  // entrepierna: subiendo desde el pie, primero se entra en las filas "partidas" (2 piernas) y se sale por la 1a fila no partida
  const isSplit = (y) => { const rs = runs[top + y]; for (let i = 1; i < rs.length; i++) if (rs[i][0] - rs[i - 1][1] > 8) return true; return false; };
  let crotch = -1, seen = false; for (let y = h - 1; y > h * 0.4; y--) { if (isSplit(y)) seen = true; else if (seen) { crotch = y; break; } }
  let boot = 0; for (let y = Math.floor(h * 0.94); y < h; y++) for (const q of runs[top + y]) boot = Math.max(boot, q[1] - q[0] + 1);
  let waist = 0; if (sh > 0 && crotch > 0) { waist = 1e9; for (let y = sh + 30; y < crotch - 30; y++) waist = Math.min(waist, wr(y)); }
  const band = w.slice(top + Math.floor(0.3 * h), top + Math.floor(0.55 * h)).sort((a, b) => a - b); const torso = band[band.length >> 1];
  return { f: f.split('/').pop(), top, h, head: sh, legs: crotch < 0 ? -1 : h - 1 - crotch, boot, torso, waist };
}
(async () => { const r = Number(process.env.R) || 14; const a = process.argv.slice(2); let ref = null;
  for (const f of a) { const b = await body(f, r); if (!ref) ref = b; const q = (k) => (ref[k] > 0 && b[k] > 0 ? +(b[k] / ref[k]).toFixed(2) : null);
    console.log(JSON.stringify({ ...b, x: { h: q('h'), head: q('head'), legs: q('legs'), boot: q('boot'), torso: q('torso'), waist: q('waist') } })); } })();
