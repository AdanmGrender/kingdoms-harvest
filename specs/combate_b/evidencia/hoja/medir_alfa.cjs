// Bounds alfa reales (alfa>0) de cada sprite de combate: l/r/t/b del bbox y proporciones. Perspectiva C de T10.6.
// T10.7 (B4): además `pl`/`pr` = ancho de los pies, las columnas con alfa > 128 en el 6 % inferior de la silueta (lo
// que apoya en el piso; va a SPRITE_GEOM para que los pies de cada fila de enemigos caigan sobre piso real).
// T10.7 (B5): para la pose de ataque del tirador, `casco` = envolvente convexa de los píxeles con alfa > 128 dentro del
// cuadro que se dibuja (columnas 0…533, hasta la boca del arma; ATTACK_FX.ranger en artMap.js): la escena la usa para
// que la silueta inclinada no salga del lienzo.
// Uso: KH_NODE_MODULES=<node_modules con sharp> node medir_alfa.cjs  → escribe hoja_alfa.json y lo imprime en tabla.
const path = require('node:path');
const fs = require('node:fs');
const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const sharp = require(path.join(NM, 'sharp'));
const ROOT = path.join(__dirname, '..', '..', '..', '..', 'client', 'public', 'assets', 'b');
const CUADRO_ATAQUE = { 'heroes/ranger_attack': 533 };   // ancho del cuadro sin el fogonazo pintado (ATTACK_FX.ranger.crop)

// envolvente convexa (cadena monótona) de las esquinas de cada tramo opaco de cada fila
function casco(data, W, H, ancho) {
  const pts = [];
  for (let v = 0; v < H; v++) {
    let a = -1; let b = -1;
    for (let u = 0; u < ancho; u++) if (data[(v * W + u) * 4 + 3] > 128) { if (a < 0) a = u; b = u; }
    if (a >= 0) pts.push([a, v], [b + 1, v], [a, v + 1], [b + 1, v + 1]);
  }
  pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lado = (lista) => { const h = []; for (const p of lista) { while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop(); h.push(p); } return h; };
  const lower = lado(pts);
  const upper = lado([...pts].reverse());
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}
(async () => {
  const out = {};
  for (const d of ['heroes', 'enemies']) {
    for (const f of fs.readdirSync(path.join(ROOT, d)).filter((n) => n.endsWith('.webp')).sort()) {
      const { data, info } = await sharp(path.join(ROOT, d, f)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
      const W = info.width, H = info.height;
      let l = W, r = -1, t = H, b = -1;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3] > 0) { if (x < l) l = x; if (x > r) r = x; if (y < t) t = y; if (y > b) b = y; }
      }
      const y0 = Math.round(b - (b - t) * 0.06);
      let pl = W, pr = -1;
      for (let y = y0; y <= b; y++) for (let x = 0; x < W; x++) {
        if (data[(y * W + x) * 4 + 3] > 128) { if (x < pl) pl = x; if (x > pr) pr = x; }
      }
      out[`${d}/${f.replace('.webp', '')}`] = {
        W, H, l, r, t, b, pl, pr,
        wFrac: +((r - l + 1) / W).toFixed(4), hFrac: +((b - t + 1) / H).toFixed(4),
        cx: +(((l + r + 1) / 2) / W).toFixed(4), botGap: H - 1 - b, topGap: t,
      };
      const clave = `${d}/${f.replace('.webp', '')}`;
      if (CUADRO_ATAQUE[clave]) out[clave].casco = casco(data, W, H, CUADRO_ATAQUE[clave]);
    }
  }
  fs.writeFileSync(path.join(__dirname, 'hoja_alfa.json'), JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(28), `${v.W}x${v.H}`.padEnd(9), `x ${v.l}..${v.r}`.padEnd(14), `y ${v.t}..${v.b}`.padEnd(14), `wFrac ${v.wFrac}`, `hFrac ${v.hFrac}`, `cx ${v.cx}`, `piesGap ${v.botGap}`, `pies ${v.pl}..${v.pr}`);
})();
