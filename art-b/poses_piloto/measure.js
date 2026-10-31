// Mide cabeza/torso de cada pose (mascara alfa abierta para ignorar hojas/plumas finas).
// Uso: node measure.js <webp>...   -> JSON por pose: alto, top, anchos de cabeza y torso
const sharp = require('sharp');
function box(m, W, H, r, op) { // min (erosion) o max (dilatacion) separable con ventana (2r+1)
  const t = new Uint8Array(W * H); const o = new Uint8Array(W * H);
  const pick = op === 'min' ? Math.min : Math.max;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = op === 'min' ? 1 : 0; for (let k = Math.max(0, x - r); k <= Math.min(W - 1, x + r); k++) v = pick(v, m[y * W + k]); t[y * W + x] = v; }
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { let v = op === 'min' ? 1 : 0; for (let k = Math.max(0, y - r); k <= Math.min(H - 1, y + r); k++) v = pick(v, t[k * W + x]); o[y * W + x] = v; }
  return o;
}
async function measure(f, r) {
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const m = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) m[i] = data[i * 4 + 3] > 128 ? 1 : 0;
  const op = box(box(m, W, H, r, 'min'), W, H, r, 'max');
  const rows = []; // [y, ancho, x0, x1] del mayor intervalo por fila
  for (let y = 0; y < H; y++) { let x0 = -1, x1 = -1; for (let x = 0; x < W; x++) if (op[y * W + x]) { if (x0 < 0) x0 = x; x1 = x; } rows.push(x0 < 0 ? null : { y, w: x1 - x0 + 1, x0, x1 }); }
  const ys = rows.filter(Boolean); const top = ys[0].y, bot = ys[ys.length - 1].y; const h = bot - top + 1;
  const band = (a, b) => ys.filter((q) => q.y >= top + a * h && q.y < top + b * h).map((q) => q.w);
  const med = (a) => a.slice().sort((p, q) => p - q)[Math.floor(a.length / 2)];
  const mx = (a) => Math.max(...a);
  const tw = med(band(0.3, 0.55)); const sh = ys.find((q) => q.w >= 0.75 * tw); const shoulder = sh ? sh.y - top : -1; // fila de hombros: cabeza = top..shoulder
  return { shoulder, f: f.split('/').pop(), W, H, top, bot, h, headW: mx(band(0, 0.22)), torsoW: med(band(0.3, 0.55)), maxW: mx(band(0, 1)) };
}
(async () => { const r = Number(process.env.R) || 8; for (const f of process.argv.slice(2)) console.log(JSON.stringify(await measure(f, r))); })();
