'use strict';
/**
 * assemble_icon_sheet.js — arma el sheet de íconos UI grimdark a partir de
 * los íconos individuales generados por gen_icons.sh (art-inbox/icon_<n>.png):
 *
 *   1) procesa cada ícono con process_art.js (fondo negro → transparente,
 *      recorte y downscale a 112px) hacia art-inbox/.proc-icons/
 *   2) los coloca centrados en una grilla de celdas de 128px, 8 columnas
 *   3) escribe client/public/assets/sprites/grim_icons.png
 *   4) SOBRESCRIBE client/src/config/grimIconSheet.generated.js con el
 *      contrato que consume spriteMap (GRIM_SHEET / _W / _H / CELL / ICONS)
 *
 *   node scripts/assemble_icon_sheet.js
 *
 * Íconos faltantes en art-inbox/ se omiten con warning (spriteMap cae al
 * sheet medieval legacy para esos nombres). Pipeline: docs/ai-art-pipeline.md
 */
const { PNG } = require('pngjs');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const CELL = 128;      // celda de la grilla
const COLS = 8;        // columnas
const ICON_SIZE = 112; // tamaño del glifo dentro de la celda (aire de 8px)

const PROC_DIR = path.join(ROOT, 'art-inbox', '.proc-icons');
const SHEET_OUT = path.join(ROOT, 'client', 'public', 'assets', 'sprites', 'grim_icons.png');
const CONFIG_OUT = path.join(ROOT, 'client', 'src', 'config', 'grimIconSheet.generated.js');

// Orden canónico del sheet (mismo set que scripts/gen_icons.sh)
const ICONS = [
  // recursos
  'gold', 'wood', 'stone', 'iron', 'wheat', 'water', 'bread', 'kh_token',
  'crystal', 'relic', 'blueprint',
  // cultivos / comida
  'carrot', 'potato', 'tomato', 'corn', 'pumpkin', 'grape', 'egg', 'milk', 'wool',
  // animales
  'chicken', 'sheep', 'cow',
  // edificios
  'castle', 'farmhouse', 'market', 'tower', 'barracks', 'tavern', 'mill',
  'wall', 'trap', 'stable', 'sawmill', 'barn',
  // militar
  'sword', 'bow', 'spear', 'ram', 'horse',
  // UI / misc
  'crown', 'scroll', 'medal', 'backpack', 'reward_bag', 'exclamation', 'gear',
  'caravan', 'flame', 'wallet', 'map', 'heart', 'star', 'check',
  // ⚠️ Los nombres nuevos van SIEMPRE AL FINAL: la posición en este array es el
  // col/row del sheet. Insertar en el medio movería todos los íconos siguientes.
  // tienda / premium (antes emoji en la UI: 💎 ⭐ ⏩). 'star' ya existe (estrella
  // de mérito) → la moneda de Telegram Stars es 'star_currency'.
  'gem', 'star_currency', 'speedup',
  // enemigos de la Marea Disforme (ids de WAVE_ENEMIES, prefijados enemy_)
  'enemy_carroneros', 'enemy_brutos', 'enemy_aullador', 'enemy_coloso',
  'enemy_boss_devorador', 'enemy_boss_heraldo',
];

fs.mkdirSync(PROC_DIR, { recursive: true });

// ── 1) Procesar cada ícono crudo (misma lógica que el resto del arte) ──
const placed = [];
for (const name of ICONS) {
  const src = path.join(ROOT, 'art-inbox', `icon_${name}.png`);
  if (!fs.existsSync(src)) {
    console.warn(`⚠ falta art-inbox/icon_${name}.png — se omite del sheet`);
    continue;
  }
  const proc = path.join(PROC_DIR, `${name}.png`);
  try {
    execFileSync(process.execPath, [
      path.join(__dirname, 'process_art.js'),
      src, proc, '--size', String(ICON_SIZE), '--tol', '70',
    ], { stdio: 'pipe' });
    placed.push(name);
  } catch (err) {
    console.warn(`⚠ icon_${name}: process_art falló — se omite (${String(err.message).slice(0, 120)})`);
  }
}

if (!placed.length) {
  console.error('✗ ningún ícono procesado — corré primero: bash scripts/gen_icons.sh');
  process.exit(1);
}

// ── 2) Componer la grilla ──
const rows = Math.ceil(placed.length / COLS);
const sheet = new PNG({ width: COLS * CELL, height: rows * CELL, colorType: 6 });
const map = {};
placed.forEach((name, i) => {
  const col = i % COLS;
  const row = Math.floor(i / COLS);
  const img = PNG.sync.read(fs.readFileSync(path.join(PROC_DIR, `${name}.png`)));
  const dx = col * CELL + Math.floor((CELL - img.width) / 2);
  const dy = row * CELL + Math.floor((CELL - img.height) / 2);
  PNG.bitblt(img, sheet, 0, 0, img.width, img.height, dx, dy);
  map[name] = { col, row };
});

fs.mkdirSync(path.dirname(SHEET_OUT), { recursive: true });
fs.writeFileSync(SHEET_OUT, PNG.sync.write(sheet));

// ── 3) Config generada (contrato consumido por client/src/utils/spriteMap.js) ──
const iconLines = placed
  .map((name) => `  ${name}: { col: ${map[name].col}, row: ${map[name].row} },`)
  .join('\n');
const config = `/**
 * GENERADO por scripts/assemble_icon_sheet.js — NO editar a mano.
 * Sheet de íconos grimdark para SpriteIcon/spriteMap. Mientras el arte no se
 * haya generado, GRIM_SHEET es null y spriteMap cae a los sheets legacy.
 *
 * Contrato: GRIM_SHEET = ruta del PNG (grid de CELL px). GRIM_ICONS mapea
 * nombre → { col, row }. spriteMap resuelve primero acá y si no existe el
 * nombre usa el sheet medieval viejo.
 */
export const GRIM_SHEET = '/assets/sprites/grim_icons.png';
export const GRIM_SHEET_W = ${sheet.width};
export const GRIM_SHEET_H = ${sheet.height};
export const GRIM_CELL = ${CELL};
export const GRIM_ICONS = {
${iconLines}
};
`;
fs.writeFileSync(CONFIG_OUT, config);

console.log(`✓ ${path.relative(ROOT, SHEET_OUT)} — ${sheet.width}×${sheet.height} (${placed.length} íconos, ${COLS} col × ${rows} filas)`);
console.log(`✓ ${path.relative(ROOT, CONFIG_OUT)} actualizado (${placed.length}/${ICONS.length} nombres)`);
const missing = ICONS.filter((n) => !placed.includes(n));
if (missing.length) console.log(`⚠ faltantes: ${missing.join(', ')}`);
