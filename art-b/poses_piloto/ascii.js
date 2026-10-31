// Silueta ASCII de webp con alfa: node ascii.js <webp> [cols]
const sharp = require('sharp');
(async () => {
  const f = process.argv[2]; const cols = Number(process.argv[3]) || 48;
  const { data, info } = await sharp(f).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: W, height: H } = info;
  const cw = W / cols; const ch = cw * 2; const rows = Math.ceil(H / ch);
  console.log(f, W + 'x' + H);
  for (let r = 0; r < rows; r++) {
    let line = '';
    for (let c = 0; c < cols; c++) {
      let a = 0; let n = 0;
      for (let y = Math.floor(r * ch); y < Math.min(H, Math.floor((r + 1) * ch)); y++) for (let x = Math.floor(c * cw); x < Math.min(W, Math.floor((c + 1) * cw)); x++) { a += data[(y * W + x) * 4 + 3]; n++; }
      const v = n ? a / n / 255 : 0;
      line += v > 0.75 ? '#' : v > 0.4 ? '+' : v > 0.1 ? '.' : ' ';
    }
    console.log(line);
  }
})();
