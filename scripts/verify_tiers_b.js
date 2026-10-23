'use strict';
/**
 * verify_tiers_b.js — verifica los webp de tramo/obra del hub (feature hub_b_tramos_nivel, R13–R17).
 *
 *   node scripts/verify_tiers_b.js [id1 id2 ...]      (sin args = los 17 edificios)
 *
 * Por cada <id>_{medio,alto,obra}.webp existente comprueba contra <id>.webp:
 *   R13 4 esquinas alpha 0 y borde exterior de 1 px 100 % transparente; y DENTRO del margen: las 2 esquinas superiores del bbox
 *       del contenido (alpha > 8) en alpha ≤ 8 (las inferiores pueden ser base recta) y la primera fila de contenido opaca en ≤ 60 % de su ancho
 *       (detecta el fondo sin recortar, que el margen transparente de process_art_b.js --margin disimula)
 *   R14 pie en el último 2 % de alto (alguna fila con alpha > 8)
 *   R15 relación de aspecto a ±15 % del bajo
 *   R16 centro horizontal del contenido (alpha > 8) a ≤ 6 % del ancho respecto del bajo
 *   R17 ≤ 150 KB cada uno y ≤ 2,2 MB el total
 * Los que no existen todavía se informan como "faltan" y no son fallo (usa --strict para exigir los 51).
 * Exit 1 si algún webp existente incumple.
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const DIR = path.join(__dirname, '..', 'client', 'public', 'assets', 'b', 'buildings');
const VARIANTS = ['medio', 'alto', 'obra'];
const MAX_KB = 150;
const MAX_TOTAL = 2.2 * 1024 * 1024;
const ALPHA = 8;

async function raw(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, w: info.width, h: info.height };
}

// Centro horizontal del contenido opaco (media de las columnas con algún píxel alpha > ALPHA, ponderado por la extensión).
function contentCenter({ data, w, h }) {
  let min = w, max = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > ALPHA) { if (x < min) min = x; if (x > max) max = x; }
    }
  }
  return max < 0 ? null : (min + max) / 2;
}

function checkImage(img) {
  const { data, w, h } = img;
  const a = (x, y) => data[(y * w + x) * 4 + 3];
  const errs = [];
  for (const [x, y] of [[0, 0], [w - 1, 0], [0, h - 1], [w - 1, h - 1]]) if (a(x, y) !== 0) errs.push('R13 esquina con alpha > 0');
  let border = 0;
  for (let x = 0; x < w; x++) { border = Math.max(border, a(x, 0), a(x, h - 1)); }
  for (let y = 0; y < h; y++) { border = Math.max(border, a(0, y), a(w - 1, y)); }
  if (border !== 0) errs.push(`R13 borde exterior no transparente (alpha máx ${border})`);
  // R13 dentro del margen: bbox del contenido (alpha > ALPHA)
  let x0 = w, x1 = -1, y0 = h, y1 = -1;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (a(x, y) > ALPHA) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  if (x1 >= 0) {
    for (const [x, y] of [[x0, y0], [x1, y0]]) if (a(x, y) > ALPHA) { errs.push(`R13 esquina superior del contenido opaca (${x},${y}) alpha ${a(x, y)}: fondo sin recortar`); break; }
    let opaque = 0;
    for (let x = x0; x <= x1; x++) if (a(x, y0) > 200) opaque++;
    const frac = opaque / (x1 - x0 + 1);
    if (frac > 0.6) errs.push(`R13 primera fila de contenido opaca en ${(frac * 100).toFixed(0)} % de su ancho (> 60 %): fondo sin recortar`);
  }
  const from = Math.floor(h * 0.98);
  let foot = false;
  for (let y = from; y < h && !foot; y++) for (let x = 0; x < w; x++) if (a(x, y) > ALPHA) { foot = true; break; }
  if (!foot) errs.push('R14 el pie no toca el último 2 % del alto');
  return errs;
}

(async () => {
  const strict = process.argv.includes('--strict');
  let ids = process.argv.slice(2).filter((s) => !s.startsWith('--'));
  if (!ids.length) ids = fs.readdirSync(DIR).filter((f) => /^[a-z_]+\.webp$/.test(f) && !/_(medio|alto|obra)\.webp$/.test(f)).map((f) => f.replace('.webp', ''));
  let fails = 0, found = 0, total = 0;
  const missing = [];
  for (const id of ids.sort()) {
    const base = await raw(path.join(DIR, `${id}.webp`));
    const baseCx = contentCenter(base);
    for (const v of VARIANTS) {
      const f = path.join(DIR, `${id}_${v}.webp`);
      if (!fs.existsSync(f)) { missing.push(`${id}_${v}`); continue; }
      found++;
      const img = await raw(f);
      const size = fs.statSync(f).size;
      total += size;
      const errs = checkImage(img);
      const ratio = (img.w / img.h) / (base.w / base.h);
      if (Math.abs(ratio - 1) > 0.15) errs.push(`R15 aspecto ${(ratio * 100).toFixed(1)} % del bajo (±15 %)`);
      const dcx = Math.abs(contentCenter(img) / img.w - baseCx / base.w);
      if (dcx > 0.06) errs.push(`R16 centro desplazado ${(dcx * 100).toFixed(1)} % del ancho (≤ 6 %)`);
      if (size > MAX_KB * 1024) errs.push(`R17 pesa ${(size / 1024) | 0} KB (> ${MAX_KB} KB)`);
      console.log(`${errs.length ? '✗' : '✓'} ${id}_${v}.webp ${img.w}×${img.h} ${(size / 1024) | 0} KB aspecto ${(ratio * 100).toFixed(0)} % dcx ${(dcx * 100).toFixed(1)} %`);
      for (const e of errs) console.log(`    ${e}`);
      if (errs.length) fails++;
    }
  }
  if (total > MAX_TOTAL) { console.log(`✗ R17 total ${(total / 1048576).toFixed(2)} MB > 2,2 MB`); fails++; }
  console.log(`\n${found} webp de tramo verificados, ${fails} con fallos, ${(total / 1024) | 0} KB en total.`);
  if (missing.length) console.log(`faltan ${missing.length}: ${missing.slice(0, 6).join(', ')}${missing.length > 6 ? '…' : ''}`);
  if (fails || (strict && missing.length)) process.exitCode = 1;
})();
