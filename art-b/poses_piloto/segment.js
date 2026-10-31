// Segmenta una hoja de poses: perfil de columnas "no fondo" -> huecos = separadores. Uso: node segment.js <png> [n]
const sharp = require('sharp');
(async () => {
  const f = process.argv[2];
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const px = (x, y, c) => data[(y * W + x) * 4 + c];
  const corners = [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]].map(([x, y]) => [px(x, y, 0), px(x, y, 1), px(x, y, 2)]);
  console.log('size', W, H, 'corners', JSON.stringify(corners));
  const bg = [0, 1, 2].map((c) => corners.map((k) => k[c]).sort((a, b) => a - b)[2]);
  const tol = 40;
  const isFg = (x, y) => Math.abs(px(x, y, 0) - bg[0]) + Math.abs(px(x, y, 1) - bg[1]) + Math.abs(px(x, y, 2) - bg[2]) > tol;
  const col = new Array(W).fill(0);
  let top = H; let bot = 0;
  for (let x = 0; x < W; x++) for (let y = 0; y < H; y++) if (isFg(x, y)) { col[x]++; top = Math.min(top, y); bot = Math.max(bot, y); }
  const min = 3; const runs = []; let s = -1;
  for (let x = 0; x <= W; x++) {
    const on = x < W && col[x] > min;
    if (on && s < 0) s = x;
    if (!on && s >= 0) { runs.push([s, x - 1]); s = -1; }
  }
  // fusiona huecos < 12 px
  const merged = [];
  for (const r of runs) { const l = merged[merged.length - 1]; if (l && r[0] - l[1] < 12) l[1] = r[1]; else merged.push([...r]); }
  console.log('bg', bg, 'vertical extent', top, bot);
  console.log('runs', JSON.stringify(merged.filter((r) => r[1] - r[0] > 40)));
})();
