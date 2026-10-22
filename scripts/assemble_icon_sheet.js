'use strict';
/**
 * assemble_icon_sheet.js — arma la hoja de íconos B (celda 192, 8 columnas) a partir de
 * art-b/uikit/proc/<nombre>.png (192×192 con alfa; los producen process_icon_sheets.js,
 * crop_building_icons.js y, para los 6 enemy_*, el recorte provisional del set viejo — design §7.4).
 *
 *   node scripts/assemble_icon_sheet.js [--out client/public/assets/b/ui/icons.webp]
 *                                       [--config art-b/uikit/candidate/grimIconSheet.generated.js]
 *
 * El CONFIG sale por defecto FUERA de client/src/config: hasta que p-kh apruebe la hoja de contacto
 * (R43, T22) `GRIM_SHEET` no cambia en el repo; T23 copia el candidato a client/src/config.
 * La posición en ICONS es el col/row: los 65 nombres contrato NO se mueven; los nuevos van SIEMPRE AL FINAL (R39).
 * Requiere `sharp` (NODE_PATH al node_modules del repo principal si el worktree no lo tiene).
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');
const CELL = 192;
const COLS = 8;
const PROC = path.join(ROOT, 'art-b', 'uikit', 'proc');

// 65 nombres contrato congelados (orden idéntico al de `git show ab85126:client/src/config/grimIconSheet.generated.js`).
const CONTRACT = [
  'gold', 'wood', 'stone', 'iron', 'wheat', 'water', 'bread', 'kh_token',
  'crystal', 'relic', 'blueprint', 'carrot', 'potato', 'tomato', 'corn', 'pumpkin',
  'grape', 'egg', 'milk', 'wool', 'chicken', 'sheep', 'cow', 'castle',
  'farmhouse', 'market', 'tower', 'barracks', 'tavern', 'mill', 'wall', 'trap',
  'stable', 'sawmill', 'barn', 'sword', 'bow', 'spear', 'ram', 'horse',
  'crown', 'scroll', 'medal', 'backpack', 'reward_bag', 'exclamation', 'gear', 'caravan',
  'flame', 'wallet', 'map', 'heart', 'star', 'check', 'gem', 'star_currency',
  'speedup', 'enemy_carroneros', 'enemy_brutos', 'enemy_aullador', 'enemy_coloso', 'enemy_boss_devorador',
  'enemy_boss_heraldo', 'tide', 'skull',
];
// Nombres nuevos (design §7.2), solo al final.
const NEW_NAMES = ['shield', 'hammer', 'sun', 'moon', 'alliance', 'rankings', 'quests', 'tech', 'world',
  'mine', 'smithy', 'library', 'embassy', 'farm_plot'];
const ICONS = [...CONTRACT, ...NEW_NAMES];

function arg(name, def) { const i = process.argv.indexOf(`--${name}`); return i > 0 ? process.argv[i + 1] : def; }
const SHEET_OUT = path.resolve(ROOT, arg('out', 'client/public/assets/b/ui/icons.webp'));
const CONFIG_OUT = path.resolve(ROOT, arg('config', 'art-b/uikit/candidate/grimIconSheet.generated.js'));
const SHEET_URL = '/assets/b/ui/icons.webp';

(async () => {
  if (CONTRACT.length !== 65 || new Set(ICONS).size !== ICONS.length) throw new Error('contrato inválido (≠65 o duplicados)');
  const rows = Math.ceil(ICONS.length / COLS);
  const W = COLS * CELL, H = rows * CELL;
  const comps = [];
  const map = {};
  const missing = [];
  ICONS.forEach((name, i) => {
    const f = path.join(PROC, `${name}.png`);
    if (!fs.existsSync(f)) { missing.push(name); return; }
    const col = i % COLS, row = Math.floor(i / COLS);
    comps.push({ input: f, left: col * CELL, top: row * CELL });
    map[name] = { col, row };
  });
  if (missing.length) { console.error(`✗ faltan en ${path.relative(ROOT, PROC)}: ${missing.join(', ')}`); process.exit(1); }

  fs.mkdirSync(path.dirname(SHEET_OUT), { recursive: true });
  await sharp({ create: { width: W, height: H, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(comps).webp({ quality: 92, alphaQuality: 100, effort: 5 }).toFile(SHEET_OUT);

  const lines = ICONS.map((n) => `  ${n}: { col: ${map[n].col}, row: ${map[n].row} },`).join('\n');
  const config = `/**
 * GENERADO por scripts/assemble_icon_sheet.js — NO editar a mano.
 * Hoja de íconos B (celda ${CELL} px, ${COLS} columnas) para SpriteIcon/spriteMap.
 *
 * Contrato: GRIM_SHEET = ruta del webp (grid de GRIM_CELL px). GRIM_ICONS mapea nombre → { col, row }.
 * Los ${CONTRACT.length} nombres contrato conservan su celda; los nuevos van al final.
 */
export const GRIM_SHEET = '${SHEET_URL}';
export const GRIM_SHEET_W = ${W};
export const GRIM_SHEET_H = ${H};
export const GRIM_CELL = ${CELL};
export const GRIM_ICONS = {
${lines}
};
`;
  fs.mkdirSync(path.dirname(CONFIG_OUT), { recursive: true });
  fs.writeFileSync(CONFIG_OUT, config);
  const kb = (fs.statSync(SHEET_OUT).size / 1024) | 0;
  console.log(`✓ ${path.relative(ROOT, SHEET_OUT)} — ${W}×${H} (${ICONS.length} íconos, ${COLS} col × ${rows} filas, ${kb} KB)`);
  console.log(`✓ ${path.relative(ROOT, CONFIG_OUT)} (${CONTRACT.length} contrato + ${NEW_NAMES.length} nuevos)`);
})();
