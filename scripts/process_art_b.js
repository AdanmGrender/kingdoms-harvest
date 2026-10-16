'use strict';
/**
 * process_art_b.js — prepara arte crudo de la dirección B (art-b/raw) para el juego.
 *
 * Actores / UI (fondo liso claro):
 *   1) estima el color de fondo (mediana de las esquinas)
 *   2) flood-fill desde todo el borde con tolerancia → transparente
 *   3) borde suave: píxeles frontera "casi fondo" quedan semitransparentes
 *   4) conserva el componente conexo más grande (+ los que superen --keep-ratio
 *      de su área) → elimina restos sueltos (pies fantasma, manchas)
 *   5) recorta al contenido (+ margen) y escala (promedio de área)
 * Escenas (--scene): sólo escala/recorta, sin recorte de fondo.
 *
 *   node scripts/process_art_b.js art-b/raw/mage_idle.png client/public/assets/b/heroes/mage_idle.png --height 640
 *   node scripts/process_art_b.js art-b/raw/mage_attack.png out.png --height 640 --flip
 *   node scripts/process_art_b.js art-b/raw/bg.png out.png --scene --width 1080
 *   node scripts/process_art_b.js art-b/raw/ui_kit.png out.png --crop x,y,w,h --height 256
 */
const sharp = require('sharp');
const mk = (width, height) => ({ width, height, data: Buffer.alloc(width * height * 4) });
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { tol: 38, height: 0, width: 0, flip: false, scene: false, keepRatio: 0.12, crop: null, erase: [], fadeRight: 0, pad: 0.02 };
  const pos = [];
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--tol') a.tol = Number(argv[++i]);
    else if (t === '--height') a.height = Number(argv[++i]);
    else if (t === '--width') a.width = Number(argv[++i]);
    else if (t === '--flip') a.flip = true;
    else if (t === '--scene') a.scene = true;
    else if (t === '--keep-ratio') a.keepRatio = Number(argv[++i]);
    else if (t === '--crop') a.crop = argv[++i].split(',').map(Number);
    else if (t === '--erase') a.erase.push(argv[++i].split(',').map(Number)); // x,y,w,h (coords del original) → pintado con color de fondo
    else if (t === '--fade-right') a.fadeRight = Number(argv[++i]); // fracción del ancho final que se desvanece (humo cortado por el borde)
    else if (t === '--pad') a.pad = Number(argv[++i]);
    else pos.push(t);
  }
  [a.in, a.out] = pos;
  return a;
}

function cropImg(img, x, y, w, h) {
  const out = mk(w, h);
  for (let j = 0; j < h; j++) img.data.copy(out.data, j * w * 4, ((y + j) * img.width + x) * 4, ((y + j) * img.width + x + w) * 4);
  return out;
}

function flipImg(img) {
  const { width: W, height: H, data } = img;
  const out = mk(W, H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) data.copy(out.data, (y * W + (W - 1 - x)) * 4, (y * W + x) * 4, (y * W + x) * 4 + 4);
  return out;
}

function cutout(img, tol, keepRatio) {
  const { width: W, height: H, data } = img;
  const px = (i) => [data[i * 4], data[i * 4 + 1], data[i * 4 + 2]];
  const corners = [0, W - 1, (H - 1) * W, H * W - 1].map(px);
  const med = [0, 1, 2].map((c) => corners.map((p) => p[c]).sort((a, b) => a - b)[1]);
  const dist = (i) => {
    const o = i * 4;
    return Math.hypot(data[o] - med[0], data[o + 1] - med[1], data[o + 2] - med[2]);
  };
  // 1) flood-fill del fondo desde el borde
  const bg = new Uint8Array(W * H);
  const stack = [];
  for (let x = 0; x < W; x++) stack.push(x, (H - 1) * W + x);
  for (let y = 0; y < H; y++) stack.push(y * W, y * W + W - 1);
  while (stack.length) {
    const i = stack.pop();
    if (bg[i] || dist(i) > tol) continue;
    bg[i] = 1;
    const x = i % W, y = (i / W) | 0;
    if (x > 0) stack.push(i - 1);
    if (x < W - 1) stack.push(i + 1);
    if (y > 0) stack.push(i - W);
    if (y < H - 1) stack.push(i + W);
  }
  for (let i = 0; i < W * H; i++) if (bg[i]) data[i * 4 + 3] = 0;
  // 1b) huecos cerrados de fondo (entre bastón y túnica, etc.): blobs grandes de
  //     color MUY cercano al fondo aunque no toquen el borde.
  const strict = Math.max(10, tol * 0.4), minHole = Math.round(W * H * 0.0004);
  const seen = new Uint8Array(W * H);
  let holes = 0;
  for (let s = 0; s < W * H; s++) {
    if (bg[s] || seen[s] || dist(s) > strict) continue;
    const blob = [], st = [s]; seen[s] = 1;
    while (st.length) {
      const i = st.pop(); blob.push(i);
      const x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) {
        if (j >= 0 && !seen[j] && !bg[j] && dist(j) <= strict) { seen[j] = 1; st.push(j); }
      }
    }
    if (blob.length >= minHole) { holes++; for (const i of blob) { bg[i] = 1; data[i * 4 + 3] = 0; } }
  }
  // 2) borde suave: vecinos del fondo con distancia < 2.2*tol → alfa parcial
  for (let i = 0; i < W * H; i++) {
    if (bg[i]) continue;
    const x = i % W, y = (i / W) | 0;
    const nearBg = (x > 0 && bg[i - 1]) || (x < W - 1 && bg[i + 1]) || (y > 0 && bg[i - W]) || (y < H - 1 && bg[i + W]);
    if (!nearBg) continue;
    const d = dist(i);
    if (d < tol * 2.2) data[i * 4 + 3] = Math.round(255 * Math.min(1, (d - tol) / (tol * 1.2) + 0.15));
  }
  // 3) componentes conexos (alfa > 0); conservar el mayor y los "grandes"
  const label = new Int32Array(W * H).fill(-1);
  const sizes = [];
  for (let s = 0; s < W * H; s++) {
    if (label[s] !== -1 || data[s * 4 + 3] === 0) continue;
    const id = sizes.length; let n = 0; const st = [s]; label[s] = id;
    while (st.length) {
      const i = st.pop(); n++;
      const x = i % W, y = (i / W) | 0;
      const nb = [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1];
      for (const j of nb) if (j >= 0 && label[j] === -1 && data[j * 4 + 3] > 0) { label[j] = id; st.push(j); }
    }
    sizes.push(n);
  }
  const max = Math.max(...sizes);
  const keep = new Set(sizes.map((n, id) => (n >= max * keepRatio ? id : -1)).filter((id) => id >= 0));
  let dropped = 0;
  for (let i = 0; i < W * H; i++) if (label[i] >= 0 && !keep.has(label[i])) { data[i * 4 + 3] = 0; dropped++; }
  return { bg: med, holes, components: sizes.length, kept: keep.size, droppedPx: dropped };
}

function bbox(img, pad) {
  const { width: W, height: H, data } = img;
  let x0 = W, y0 = H, x1 = -1, y1 = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 8) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  const p = Math.round(Math.max(x1 - x0, y1 - y0) * pad);
  x0 = Math.max(0, x0 - p); y0 = Math.max(0, y0 - p); x1 = Math.min(W - 1, x1 + p); y1 = Math.min(H - 1, y1 + p);
  return [x0, y0, x1 - x0 + 1, y1 - y0 + 1];
}

// Reescalado por promedio de área, premultiplicado (evita halos en bordes transparentes)
function resize(img, nw, nh) {
  const { width: W, height: H, data } = img;
  const out = mk(nw, nh);
  const sx = W / nw, sy = H / nh;
  for (let y = 0; y < nh; y++) {
    const ya = y * sy, yb = ya + sy;
    for (let x = 0; x < nw; x++) {
      const xa = x * sx, xb = xa + sx;
      let r = 0, g = 0, b = 0, a = 0, w = 0;
      for (let yy = Math.floor(ya); yy < Math.ceil(yb); yy++) {
        const wy = Math.min(yb, yy + 1) - Math.max(ya, yy);
        for (let xx = Math.floor(xa); xx < Math.ceil(xb); xx++) {
          const wx = Math.min(xb, xx + 1) - Math.max(xa, xx);
          const ww = wx * wy, o = (yy * W + xx) * 4, al = data[o + 3] / 255;
          r += data[o] * al * ww; g += data[o + 1] * al * ww; b += data[o + 2] * al * ww; a += al * ww; w += ww;
        }
      }
      const o = (y * nw + x) * 4;
      out.data[o] = a ? r / a : 0; out.data[o + 1] = a ? g / a : 0; out.data[o + 2] = a ? b / a : 0;
      out.data[o + 3] = Math.round((a / w) * 255);
    }
  }
  return out;
}

async function main() {
  const a = parseArgs(process.argv);
  if (!a.in || !a.out) {
    console.error('Uso: node scripts/process_art_b.js <in.png> <out.png> [--height N|--width N] [--flip] [--scene] [--crop x,y,w,h] [--tol 38]');
    process.exitCode = 1; return;
  }
  const { data: raw, info: ri } = await sharp(a.in).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let img = { width: ri.width, height: ri.height, data: raw };
  // --erase: tapa con el color de la esquina regiones a descartar (p.ej. recuadros de accesorios de una hoja)
  for (const [ex, ey, ew, eh] of a.erase) {
    for (let y = ey; y < Math.min(img.height, ey + eh); y++) for (let x = ex; x < Math.min(img.width, ex + ew); x++) img.data.copy(img.data, (y * img.width + x) * 4, 0, 4);
  }
  if (a.crop) img = cropImg(img, ...a.crop);
  let info = {};
  if (!a.scene) {
    info = cutout(img, a.tol, a.keepRatio);
    img = cropImg(img, ...bbox(img, a.pad));
  }
  if (a.flip) img = flipImg(img);
  if (a.fadeRight > 0) {
    const fw = Math.round(img.width * a.fadeRight), x0 = img.width - fw;
    for (let y = 0; y < img.height; y++) for (let x = x0; x < img.width; x++) {
      const o = (y * img.width + x) * 4 + 3; img.data[o] = Math.round(img.data[o] * (1 - (x - x0) / fw) ** 1.5);
    }
  }
  let nw = img.width, nh = img.height;
  if (a.height) { nh = a.height; nw = Math.round(img.width * (a.height / img.height)); }
  else if (a.width) { nw = a.width; nh = Math.round(img.height * (a.width / img.width)); }
  if (nw !== img.width || nh !== img.height) img = resize(img, nw, nh);
  fs.mkdirSync(path.dirname(a.out), { recursive: true });
  const s = sharp(img.data, { raw: { width: img.width, height: img.height, channels: 4 } });
  await (a.out.endsWith('.webp') ? s.webp({ quality: 88, alphaQuality: 95 }) : a.out.endsWith('.jpg') ? s.flatten().jpeg({ quality: 88, mozjpeg: true }) : s.png({ compressionLevel: 9 })).toFile(a.out);
  console.log(`✓ ${path.basename(a.out)} ${nw}x${nh}`
    + (a.scene ? '' : ` bg=rgb(${info.bg}) holes=${info.holes} comps=${info.components} kept=${info.kept} dropped=${info.droppedPx}px`));
}

main().catch((e) => { console.error('✗', e.message); process.exitCode = 1; });
