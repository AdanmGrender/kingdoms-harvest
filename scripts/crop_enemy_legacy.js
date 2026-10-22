/**
 * ui_kit_b T23 (R46): recorta las 6 celdas enemy_* de la hoja de íconos vieja (celdas de 128 px, fila 7, cols 1-6)
 * a una tira horizontal client/public/assets/sprites/enemy_icons_legacy.png. Deuda explícita hasta combate_b.
 * Uso: node scripts/crop_enemy_legacy.js <hoja_vieja.png>  (la hoja ya no está en el árbol: sacarla del historial git, commit ab85126)
 * Requiere sharp (NODE_PATH al node_modules del repo principal).
 */
const path = require('path');
const sharp = require('sharp');

const SRC = path.resolve(process.argv[2] || '');
const OUT = path.resolve(__dirname, '../client/public/assets/sprites/enemy_icons_legacy.png');
const CELL = 128;
const ROW = 7;
const COLS = [1, 2, 3, 4, 5, 6]; // carroneros, brutos, aullador, coloso, boss_devorador, boss_heraldo

(async () => {
  const parts = await Promise.all(COLS.map(async (col, i) => ({
    input: await sharp(SRC).extract({ left: col * CELL, top: ROW * CELL, width: CELL, height: CELL }).toBuffer(),
    left: i * CELL,
    top: 0,
  })));
  await sharp({ create: { width: CELL * COLS.length, height: CELL, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite(parts).png().toFile(OUT);
  const m = await sharp(OUT).metadata();
  console.log(`enemy_icons_legacy.png ${m.width}x${m.height} (${COLS.length} celdas de ${CELL} px)`);
})();
