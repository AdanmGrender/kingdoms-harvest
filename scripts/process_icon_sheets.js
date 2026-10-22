'use strict';
/**
 * process_icon_sheets.js — recorta por grilla las hojas 3×3 de íconos B (gen_art_b.js) y las
 * pasa a celdas transparentes de 192 px (llave de color por flood-fill desde el borde de cada celda).
 *
 *   node scripts/process_icon_sheets.js [--tol 44] [--glyph 172]
 *
 * Lee  art-b/uikit/icon_sheets.json  { sheets: {id: [9 nombres|null]}, reuse: {id: {nombre: celda1..9}} }
 *      art-b/uikit/raw/<id>.png        (crudos, ignorados por git)
 * Escribe art-b/uikit/proc/<nombre>.png (192×192, alfa) y art-b/uikit/proc/report.json (QA numérico por ícono).
 * Requiere `sharp` (NODE_PATH al node_modules del repo principal si el worktree no lo tiene).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const UIKIT = path.join(ROOT, 'art-b', 'uikit');
const OUT = path.join(UIKIT, 'proc');
const CELL = 192;

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? Number(process.argv[i + 1]) : def;
}
const TOL = arg('tol', 44);
const GLYPH = arg('glyph', 172);

function median(a) { const s = [...a].sort((x, y) => x - y); return s[s.length >> 1]; }

/** Quita el fondo de un recorte RGBA {data,w,h} por flood-fill desde el borde. Devuelve estadísticas. */
function cutout(data, w, h) {
  // color de fondo = mediana del marco de 6 px
  const rs = [], gs = [], bs = [];
  const m = 6;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (x < m || y < m || x >= w - m || y >= h - m) { const i = (y * w + x) * 4; rs.push(data[i]); gs.push(data[i + 1]); bs.push(data[i + 2]); }
  }
  const bg = [median(rs), median(gs), median(bs)];
  const dist = (i) => Math.max(Math.abs(data[i] - bg[0]), Math.abs(data[i + 1] - bg[1]), Math.abs(data[i + 2] - bg[2]));
  const isBg = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const push = (x, y) => { const p = y * w + x; if (!isBg[p] && dist(p * 4) <= TOL) { isBg[p] = 1; stack[sp++] = p; } };
  for (let x = 0; x < w; x++) { push(x, 0); push(x, h - 1); }
  for (let y = 0; y < h; y++) { push(0, y); push(w - 1, y); }
  while (sp) {
    const p = stack[--sp]; const x = p % w, y = (p / w) | 0;
    if (x > 0) push(x - 1, y); if (x < w - 1) push(x + 1, y);
    if (y > 0) push(x, y - 1); if (y < h - 1) push(x, y + 1);
  }
  // componentes de primer plano (4-vecinos) → descartar motas pequeñas
  const lab = new Int32Array(w * h).fill(-1);
  const comps = [];
  for (let s = 0; s < w * h; s++) {
    if (isBg[s] || lab[s] >= 0) continue;
    const id = comps.length; let area = 0, minx = w, miny = h, maxx = 0, maxy = 0;
    sp = 0; stack[sp++] = s; lab[s] = id;
    while (sp) {
      const p = stack[--sp]; const x = p % w, y = (p / w) | 0; area++;
      if (x < minx) minx = x; if (x > maxx) maxx = x; if (y < miny) miny = y; if (y > maxy) maxy = y;
      const nb = [x > 0 ? p - 1 : -1, x < w - 1 ? p + 1 : -1, y > 0 ? p - w : -1, y < h - 1 ? p + w : -1];
      for (const q of nb) if (q >= 0 && !isBg[q] && lab[q] < 0) { lab[q] = id; stack[sp++] = q; }
    }
    comps.push({ id, area, minx, miny, maxx, maxy });
  }
  const biggest = comps.reduce((a, c) => Math.max(a, c.area), 0);
  const keep = new Set(comps.filter((c) => c.area >= biggest * 0.02).map((c) => c.id));
  const total = w * h;
  const alpha = new Uint8Array(w * h);
  for (let p = 0; p < w * h; p++) alpha[p] = !isBg[p] && keep.has(lab[p]) ? 255 : 0;
  // suavizado de 1 px del borde: alfa parcial a los px de primer plano pegados al fondo
  const out = Buffer.from(data);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x; let a = alpha[p];
    if (a) {
      let bgN = 0;
      if (x > 0 && !alpha[p - 1]) bgN++; if (x < w - 1 && !alpha[p + 1]) bgN++;
      if (y > 0 && !alpha[p - w]) bgN++; if (y < h - 1 && !alpha[p + w]) bgN++;
      if (bgN >= 2) a = 170; else if (bgN === 1) a = 215;
    }
    out[p * 4 + 3] = a;
  }
  const kept = comps.filter((c) => keep.has(c.id));
  let minx = w, miny = h, maxx = 0, maxy = 0;
  for (const c of kept) { minx = Math.min(minx, c.minx); miny = Math.min(miny, c.miny); maxx = Math.max(maxx, c.maxx); maxy = Math.max(maxy, c.maxy); }
  return {
    buf: out, bbox: kept.length ? { x: minx, y: miny, w: maxx - minx + 1, h: maxy - miny + 1 } : null,
    stats: { bg, components: kept.length, fg: kept.reduce((a, c) => a + c.area, 0) / total, touchesEdge: kept.some((c) => c.minx <= 1 || c.miny <= 1 || c.maxx >= w - 2 || c.maxy >= h - 2) },
  };
}

async function processCell(file, col, row, name, report) {
  const meta = await sharp(file).metadata();
  const cw = Math.floor(meta.width / 3), ch = Math.floor(meta.height / 3);
  const { data, info } = await sharp(file).extract({ left: col * cw, top: row * ch, width: cw, height: ch })
    .ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const r = cutout(data, info.width, info.height);
  if (!r.bbox) { report[name] = { error: 'vacío' }; return; }
  const png = await sharp(r.buf, { raw: { width: info.width, height: info.height, channels: 4 } })
    .extract({ left: r.bbox.x, top: r.bbox.y, width: r.bbox.w, height: r.bbox.h })
    .resize({ width: GLYPH, height: GLYPH, fit: 'inside', kernel: 'lanczos3' }).png().toBuffer();
  const rm = await sharp(png).metadata();
  await sharp({ create: { width: CELL, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: png, left: Math.floor((CELL - rm.width) / 2), top: Math.floor((CELL - rm.height) / 2) }])
    .png().toFile(path.join(OUT, `${name}.png`));
  report[name] = { from: path.basename(file), cell: row * 3 + col + 1, bg: r.stats.bg, components: r.stats.components, fgFrac: +r.stats.fg.toFixed(3), touchesEdge: r.stats.touchesEdge, bbox: r.bbox, cellPx: [cw, ch] };
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const cfg = JSON.parse(fs.readFileSync(path.join(UIKIT, 'icon_sheets.json'), 'utf8'));
  const report = {};
  for (const [id, names] of Object.entries(cfg.sheets)) {
    const file = path.join(UIKIT, 'raw', `${id}.png`);
    if (!fs.existsSync(file)) { console.warn(`⚠ falta ${path.relative(ROOT, file)}`); continue; }
    for (let i = 0; i < 9; i++) if (names[i]) await processCell(file, i % 3, (i / 3) | 0, names[i], report);
  }
  for (const [id, map] of Object.entries(cfg.reuse || {})) {
    const file = path.join(UIKIT, 'raw', `${id}.png`);
    for (const [name, cell] of Object.entries(map)) await processCell(file, (cell - 1) % 3, ((cell - 1) / 3) | 0, name, report);
  }
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  for (const [n, r] of Object.entries(report)) {
    const flag = r.error || r.components > 3 || r.touchesEdge || r.fgFrac < 0.08 || r.fgFrac > 0.75 ? ' ⚠' : '';
    console.log(`${n.padEnd(14)} ${r.from || ''} #${r.cell || '-'} comp=${r.components} fg=${r.fgFrac}${flag}`);
  }
})();
