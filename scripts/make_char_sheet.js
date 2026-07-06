'use strict';
/**
 * make_char_sheet.js — arma un spritesheet de personaje para el juego a partir
 * de UN sprite ya procesado (fondo transparente, recortado por process_art.js).
 *
 * Encaja el personaje dentro de un frame FW×FH (centrado en X, apoyado en el
 * piso del frame) y lo repite `frames` veces en una tira horizontal. Con un
 * sprite estático las 4 copias son idénticas → el NPC queda quieto (idle usa
 * frames 0-1, walk 2-3; ver BootScene generateFrameNumbers). Cuando haya frames
 * de animación reales, se pasan varios sprites y se colocan en orden.
 *
 *   node scripts/make_char_sheet.js in_proc.png out_npc.png [--fw 32] [--fh 48]
 *        [--frames 4] [--bottom 1]
 *
 * Salida: PNG de (FW*frames)×FH, colorType 6 (RGBA). Slot típico:
 *   client/public/assets/game/characters/npc_<role>.png
 */
const { PNG } = require('pngjs');
const fs = require('fs');
const path = require('path');

function parseArgs(argv) {
  const a = { in: null, out: null, fw: 32, fh: 48, frames: 4, bottom: 1 };
  const pos = [];
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--fw') a.fw = Number(argv[++i]);
    else if (t === '--fh') a.fh = Number(argv[++i]);
    else if (t === '--frames') a.frames = Number(argv[++i]);
    else if (t === '--bottom') a.bottom = Number(argv[++i]);
    else pos.push(t);
  }
  a.in = pos[0]; a.out = pos[1];
  return a;
}

const args = parseArgs(process.argv);
if (!args.in || !args.out) {
  console.error('Uso: node scripts/make_char_sheet.js <in.png> <out.png> [--fw 32] [--fh 48] [--frames 4] [--bottom 1]');
  process.exit(1);
}

const ROOT = path.join(__dirname, '..');
const abs = (p) => (path.isAbsolute(p) ? p : path.join(ROOT, p));
const src = PNG.sync.read(fs.readFileSync(abs(args.in)));
const { width: W, height: H, data } = src;

// Encajar dentro del frame dejando 1px de aire arriba/laterales y `bottom` px
// bajo los pies. Escala uniforme (preserva proporción).
const availW = args.fw - 2;
const availH = args.fh - 1 - args.bottom;
const scale = Math.min(availW / W, availH / H);
const sw = Math.max(1, Math.round(W * scale));
const sh = Math.max(1, Math.round(H * scale));

// Downscale por promedio de área ponderado por alpha (bordes limpios).
const glyph = new PNG({ width: sw, height: sh, colorType: 6 });
for (let oy = 0; oy < sh; oy++) {
  for (let ox = 0; ox < sw; ox++) {
    const x0 = Math.floor(ox / scale), x1 = Math.floor((ox + 1) / scale);
    const y0 = Math.floor(oy / scale), y1 = Math.floor((oy + 1) / scale);
    let r = 0, g = 0, b = 0, a = 0, n = 0;
    for (let sy = y0; sy <= Math.min(y1, H - 1); sy++) {
      for (let sx = x0; sx <= Math.min(x1, W - 1); sx++) {
        const i = (sy * W + sx) * 4;
        const av = data[i + 3];
        r += data[i] * av; g += data[i + 1] * av; b += data[i + 2] * av;
        a += av; n++;
      }
    }
    const oi = (oy * sw + ox) * 4;
    if (a > 0) {
      glyph.data[oi] = Math.round(r / a);
      glyph.data[oi + 1] = Math.round(g / a);
      glyph.data[oi + 2] = Math.round(b / a);
      glyph.data[oi + 3] = Math.round(a / Math.max(1, n));
    } else {
      glyph.data[oi + 3] = 0;
    }
  }
}

// Posición dentro del frame: centrado en X, apoyado en el piso.
const offX = Math.floor((args.fw - sw) / 2);
const offY = args.fh - args.bottom - sh;

const sheet = new PNG({ width: args.fw * args.frames, height: args.fh, colorType: 6 });
// Fondo transparente por defecto (colorType 6 arranca en 0,0,0,0).
for (let f = 0; f < args.frames; f++) {
  const baseX = f * args.fw;
  for (let y = 0; y < sh; y++) {
    for (let x = 0; x < sw; x++) {
      const gi = (y * sw + x) * 4;
      const fx = baseX + offX + x;
      const fy = offY + y;
      if (fx < 0 || fy < 0 || fx >= sheet.width || fy >= args.fh) continue;
      const si = (fy * sheet.width + fx) * 4;
      sheet.data[si] = glyph.data[gi];
      sheet.data[si + 1] = glyph.data[gi + 1];
      sheet.data[si + 2] = glyph.data[gi + 2];
      sheet.data[si + 3] = glyph.data[gi + 3];
    }
  }
}

const outPath = abs(args.out);
fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, PNG.sync.write(sheet));
console.log(`✓ ${args.out} — ${sheet.width}×${args.fh} (${args.frames}× frame ${args.fw}×${args.fh}, glifo ${sw}×${sh})`);
