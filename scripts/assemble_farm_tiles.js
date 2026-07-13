'use strict';
/**
 * assemble_farm_tiles.js — arma client/public/assets/game/tilesets/farm_tiles.png
 * (spritesheet 32×32, 8 columnas) a partir del arte IA de art-inbox/:
 *
 *   art-inbox/farm_soil_dry.png   → 1 tile cuadrado  → frame 0  (tierra seca)
 *   art-inbox/farm_soil_wet.png   → 1 tile cuadrado  → frame 1  (tierra regada)
 *   art-inbox/farm_<crop>.png     → grilla 2×2 (4 etapas, orden de lectura)
 *                                    → frames 2+i*4 .. 2+i*4+3
 *
 * Orden de cultivos EXIGIDO por client/src/game/entities/CropPlot.js:
 *   wheat(2-5) carrot(6-9) potato(10-13) tomato(14-17) corn(18-21)
 *   pumpkin(22-25) grape(26-29)
 *
 * Cada frame es el TILE COMPLETO (tierra + planta encima), opaco: el sprite
 * reemplaza el tile entero, no se recorta fondo.
 *
 * ⚠️ BootScene chroma-keya 'farm_tiles' (near-white ≥240 → transparente). Por eso
 *    acá se clampean los píxeles casi blancos a 235: si no, los brillos del arte
 *    se convertirían en agujeros transparentes en el juego.
 *
 *   node scripts/assemble_farm_tiles.js
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INBOX = path.join(ROOT, 'art-inbox');
const OUT = path.join(ROOT, 'client', 'public', 'assets', 'game', 'tilesets', 'farm_tiles.png');

const TILE = 32;   // tamaño de frame (BootScene: frameWidth/Height 32)
const COLS = 8;    // columnas del sheet
const ROWS = 4;    // 30 frames usados → 4 filas
// La IA suele dibujar cada tile como una "placa": margen liso (negro o blanco)
// + a veces un bisel de piedra. Se resuelve en 2 pasos:
//   1) content-crop: flood-fill del margen LISO desde las esquinas de la celda
//      (tol bajo → la tierra, que es ruidosa, no se come)
//   2) INSET: recorte extra de % sobre el contenido → mata el bisel dibujado y
//      las líneas separadoras entre celdas
const INSET = 0.06;
const BG_TOL = 20; // tolerancia del flood-fill de margen (por canal, distancia²)

// Orden canónico (NO tocar: CropPlot.js depende de él)
const CROPS = ['wheat', 'carrot', 'potato', 'tomato', 'corn', 'pumpkin', 'grape'];

// ── Downscale por promedio de área de una región cuadrada → TILE×TILE ─────────
function sampleRegion(src, rx, ry, rw, rh) {
  const { width: W, data } = src;
  const out = new PNG({ width: TILE, height: TILE, colorType: 6 });
  const sx = rw / TILE;
  const sy = rh / TILE;
  for (let oy = 0; oy < TILE; oy++) {
    for (let ox = 0; ox < TILE; ox++) {
      const x0 = rx + Math.floor(ox * sx);
      const x1 = rx + Math.floor((ox + 1) * sx);
      const y0 = ry + Math.floor(oy * sy);
      const y1 = ry + Math.floor((oy + 1) * sy);
      let r = 0, g = 0, b = 0, n = 0;
      for (let py = y0; py < Math.max(y0 + 1, y1); py++) {
        for (let px = x0; px < Math.max(x0 + 1, x1); px++) {
          const i = (py * W + px) * 4;
          r += data[i]; g += data[i + 1]; b += data[i + 2]; n++;
        }
      }
      let cr = Math.round(r / n), cg = Math.round(g / n), cb = Math.round(b / n);
      // Clamp anti chroma-key (BootScene borra ≥240 en los 3 canales)
      if (cr >= 236 && cg >= 236 && cb >= 236) { cr = 235; cg = 235; cb = 235; }
      const oi = (oy * TILE + ox) * 4;
      out.data[oi] = cr; out.data[oi + 1] = cg; out.data[oi + 2] = cb;
      out.data[oi + 3] = 255; // el tile es opaco: ES el suelo
    }
  }
  return out;
}

/**
 * Bounding box del CONTENIDO dentro de una región: flood-fill del margen liso
 * desde las 4 esquinas (negro, blanco o lo que la IA haya puesto) y bbox de lo
 * que sobrevive. Tolerancia baja → la tierra (texturada, ruidosa) no se come.
 */
function contentBox(src, rx, ry, rw, rh) {
  const { width: W, data } = src;
  const bg = new Uint8Array(rw * rh);
  const at = (x, y) => { const i = ((ry + y) * W + (rx + x)) * 4; return [data[i], data[i + 1], data[i + 2]]; };
  const d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2;
  const tol2 = BG_TOL * BG_TOL * 3;
  const stack = [];
  for (const [sx, sy] of [[0, 0], [rw - 1, 0], [0, rh - 1], [rw - 1, rh - 1]]) {
    const seed = at(sx, sy);
    stack.push([sx, sy]);
    while (stack.length) {
      const [x, y] = stack.pop();
      if (x < 0 || y < 0 || x >= rw || y >= rh) continue;
      const p = y * rw + x;
      if (bg[p]) continue;
      if (d2(at(x, y), seed) > tol2) continue;
      bg[p] = 1;
      stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
    }
  }
  let minX = rw, minY = rh, maxX = -1, maxY = -1;
  for (let y = 0; y < rh; y++) {
    for (let x = 0; x < rw; x++) {
      if (!bg[y * rw + x]) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX) return { x: rx, y: ry, w: rw, h: rh }; // todo "fondo": no recortar
  return { x: rx + minX, y: ry + minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/** Cuadrado centrado en el contenido de la región, con INSET → tile 32×32. */
function cropTile(src, rx, ry, rw, rh) {
  const box = contentBox(src, rx, ry, rw, rh);
  const s = Math.min(box.w, box.h);
  const pad = Math.floor(s * INSET);               // mata el bisel/marco dibujado
  const side = Math.max(1, s - pad * 2);
  const cx = box.x + Math.floor((box.w - s) / 2) + pad;
  const cy = box.y + Math.floor((box.h - s) / 2) + pad;
  return sampleRegion(src, cx, cy, side, side);
}

/** Multiplica RGB (no alpha) de un tile por `f`, clampeando 0..255. In-place. */
function darkenTile(tile, f) {
  for (let i = 0; i < tile.data.length; i += 4) {
    tile.data[i]   = Math.min(255, Math.round(tile.data[i]   * f));
    tile.data[i+1] = Math.min(255, Math.round(tile.data[i+1] * f));
    tile.data[i+2] = Math.min(255, Math.round(tile.data[i+2] * f));
  }
  return tile;
}

/** Imagen de un solo tile → 32×32. */
function singleTile(file) {
  const src = PNG.sync.read(fs.readFileSync(file));
  return cropTile(src, 0, 0, src.width, src.height);
}

/** Parte una imagen en grilla 2×2 (orden de lectura) → 4 tiles de 32×32. */
function gridTiles(file) {
  const src = PNG.sync.read(fs.readFileSync(file));
  const cw = Math.floor(src.width / 2);
  const ch = Math.floor(src.height / 2);
  const tiles = [];
  for (let cell = 0; cell < 4; cell++) {
    const col = cell % 2;
    const row = Math.floor(cell / 2);
    tiles.push(cropTile(src, col * cw, row * ch, cw, ch));
  }
  return tiles;
}

// ── Composición ──────────────────────────────────────────────────────────────
const sheet = new PNG({ width: COLS * TILE, height: ROWS * TILE, colorType: 6 });
const blit = (tile, frame) => {
  const dx = (frame % COLS) * TILE;
  const dy = Math.floor(frame / COLS) * TILE;
  PNG.bitblt(tile, sheet, 0, 0, TILE, TILE, dx, dy);
};

const missing = [];
const done = [];

// Tierra seca (frame 0) — también relleno de fallback. La IA la devolvió ~30%
// más clara que el suelo bajo los cultivos → una parcela vacía resaltaba como
// una losa pálida. darkenTile(0.76) la iguala al tono del resto (medido:
// seco [67,56,44] vs cultivos ~[50,44,38]). Solo oscurece: no crea píxeles
// casi-blancos que el chroma-key de BootScene convertiría en agujeros.
let dryTile = null;
const dryPath = path.join(INBOX, 'farm_soil_dry.png');
if (fs.existsSync(dryPath)) {
  dryTile = darkenTile(singleTile(dryPath), 0.76);
  blit(dryTile, 0);
  done.push('soil_dry(0)');
} else {
  missing.push('farm_soil_dry.png');
}

const wetPath = path.join(INBOX, 'farm_soil_wet.png');
if (fs.existsSync(wetPath)) {
  blit(singleTile(wetPath), 1);
  done.push('soil_wet(1)');
} else {
  missing.push('farm_soil_wet.png');
  if (dryTile) blit(dryTile, 1);
}

// Cultivos (4 etapas cada uno)
CROPS.forEach((crop, ci) => {
  const base = 2 + ci * 4;
  const file = path.join(INBOX, `farm_${crop}.png`);
  if (!fs.existsSync(file)) {
    missing.push(`farm_${crop}.png`);
    if (dryTile) for (let s = 0; s < 4; s++) blit(dryTile, base + s); // sin agujeros negros
    return;
  }
  const tiles = gridTiles(file);
  tiles.forEach((t, s) => blit(t, base + s));
  done.push(`${crop}(${base}-${base + 3})`);
});

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, PNG.sync.write(sheet));

console.log(`✓ ${path.relative(ROOT, OUT)} — ${sheet.width}×${sheet.height} (${COLS} col × ${ROWS} filas, frames 32×32)`);
console.log(`  armados: ${done.join(' ')}`);
if (missing.length) console.log(`⚠ faltan en art-inbox/: ${missing.join(', ')}`);
