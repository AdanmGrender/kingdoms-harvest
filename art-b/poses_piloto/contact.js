'use strict';
// Hoja de contacto del piloto (fondo oscuro, escala real): fila warrior, fila bruto (idle | attack | hit | ko r3) y el crudo r3.
// node art-b/poses_piloto/contact.js  -> specs/poses_b_piloto/evidencia/piloto/contact_poses.webp
const path = require('path');
const sharp = require('sharp');
const A = path.join(__dirname, '..', '..', 'client', 'public', 'assets', 'b');
const OUT = path.join(__dirname, '..', '..', 'specs', 'poses_b_piloto', 'evidencia', 'piloto', 'contact_poses.webp');
const BG = '#2a2622'; const PAD = 24;
async function row(files, rowH) {
  const items = [];
  for (const f of files) { const b = await sharp(path.join(A, f)).toBuffer(); const m = await sharp(b).metadata(); items.push({ b, w: m.width, h: m.height }); }
  const W = items.reduce((s, i) => s + i.w + PAD, PAD);
  let x = PAD; const comp = items.map((i) => { const c = { input: i.b, left: x, top: rowH - i.h }; x += i.w + PAD; return c; });
  return { W, H: rowH, comp };
}
(async () => {
  const r1 = await row(['heroes/warrior_idle.webp', 'heroes/warrior_attack.webp', 'heroes/warrior_hit.webp', 'heroes/warrior_skill.webp', 'heroes/warrior_ko.webp', 'heroes/warrior_victory.webp'], 720);
  const r2 = await row(['enemies/bruto_idle.webp', 'enemies/bruto_attack.webp', 'enemies/bruto_hit.webp', 'enemies/bruto_ko.webp'], 720);
  const raw = await sharp(path.join(__dirname, 'raw', 'bruto_ko_r3.png')).resize({ height: 540 }).toBuffer();
  const rm = await sharp(raw).metadata();
  const W = Math.max(r1.W, r2.W + rm.width + PAD, 1);
  const H = r1.H + r2.H + PAD * 3;
  const comp = [
    ...r1.comp.map((c) => ({ ...c, top: c.top + PAD })),
    ...r2.comp.map((c) => ({ ...c, top: c.top + r1.H + PAD * 2 })),
    { input: raw, left: r2.W, top: r1.H + PAD * 2 + 720 - rm.height },
  ];
  await sharp({ create: { width: W, height: H, channels: 3, background: BG } }).composite(comp).webp({ quality: 85 }).toFile(OUT);
  console.log(OUT, W, H);
})();
