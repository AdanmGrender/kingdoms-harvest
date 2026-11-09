// T10.6 — Origen X de cada pose (ataque de héroe / golpe de enemigo) para que el cuerpo no salte al cambiar de la pose
// idle a la otra. Las dos texturas de un personaje tienen el mismo alto (640 o 720) y la misma escala, pero distinto
// ancho y encuadre (el arma o el humo amplían la caja). Se alinea el perfil de columnas de las piernas (35 % inferior de
// la silueta, alfa > 128) de la pose contra el de la idle (correlación cruzada) y se toma como origen de la pose el punto
// que cae sobre el centro de la idle. Sale `ox` = ese punto / ancho de la pose (idle = 0,5), que va a SPRITE_GEOM
// (`client/src/game/combat/artMap.js`). Además escribe `poses/alineacion.webp`: idle en rojo, pose en verde, la
// coincidencia en amarillo.
// Uso: KH_NODE_MODULES=<node_modules con sharp> node medir_poses.cjs
const path = require('node:path');
const fs = require('node:fs');
const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const sharp = require(path.join(NM, 'sharp'));
const ROOT = path.join(__dirname, '..', '..', '..', '..', 'client', 'public', 'assets', 'b');
const OUT = path.join(__dirname, 'poses');

const PAIRS = [
  ['heroes', 'warrior', 'attack'], ['heroes', 'mage', 'attack'], ['heroes', 'ranger', 'attack'], ['heroes', 'paladin', 'attack'],
  ['heroes', 'rogue', 'attack'], ['enemies', 'bruto', 'hit'], ['enemies', 'carroneros', 'hit'], ['enemies', 'aullador', 'hit'],
  ['enemies', 'coloso', 'hit'], ['enemies', 'boss_devorador', 'hit'], ['enemies', 'boss_heraldo', 'hit'],
  ['enemies', 'sin_rostro', 'hit'], ['enemies', 'voz_del_velo', 'hit'],
];

async function load(dir, name) {
  const { data, info } = await sharp(path.join(ROOT, dir, `${name}.webp`)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  return { data, W: info.width, H: info.height };
}
function legs(img) {
  const { data, W, H } = img;
  let t = H; let b = -1;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 0) { if (y < t) t = y; if (y > b) b = y; }
  const y0 = Math.round(b - (b - t) * 0.35);
  const col = new Float64Array(W);
  for (let y = y0; y <= b; y++) for (let x = 0; x < W; x++) if (data[(y * W + x) * 4 + 3] > 128) col[x] += 1;
  return col;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const rows = [];
  const tiles = [];
  for (const [dir, name, pose] of PAIRS) {
    const I = await load(dir, `${name}_idle`);
    const P = await load(dir, `${name}_${pose}`);
    const li = legs(I); const lp = legs(P);
    let best = -1; let shift = 0;
    for (let s = -P.W; s <= P.W; s++) {
      let acc = 0;
      for (let x = 0; x < I.W; x++) { const xx = x + s; if (xx >= 0 && xx < P.W) acc += li[x] * lp[xx]; }
      if (acc > best) { best = acc; shift = s; }
    }
    const ox = (I.W / 2 + shift) / P.W;
    rows.push({ clave: `${dir === 'heroes' ? 'hero' : 'enemy'}:${name}:${pose}`, anchoIdle: I.W, anchoPose: P.W, desplazamiento: shift, ox: Number(ox.toFixed(3)) });
    // superposición alineada
    const W = Math.max(I.W, P.W) + 200; const H = I.H; const left = Math.round(100 + (W - 200) / 2 - I.W / 2);
    const buf = Buffer.alloc(W * H * 3, 40);
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < I.W; x++) if (I.data[(y * I.W + x) * 4 + 3] > 128) buf[(y * W + left + x) * 3] = 230;
      for (let x = 0; x < P.W; x++) {
        const X = left + x - shift;
        if (X >= 0 && X < W && P.data[(y * P.W + x) * 4 + 3] > 128) buf[(y * W + X) * 3 + 1] = 200;
      }
    }
    tiles.push(await sharp(buf, { raw: { width: W, height: H, channels: 3 } }).resize({ height: 200 }).png().toBuffer());
  }
  let x = 0; let y = 0; let rowW = 0; const comp = []; const MAXW = 1600;
  for (const t of tiles) {
    const m = await sharp(t).metadata();
    if (x + m.width > MAXW) { x = 0; y += 206; }
    comp.push({ input: t, left: x, top: y });
    x += m.width + 6; rowW = Math.max(rowW, x);
  }
  await sharp({ create: { width: rowW, height: y + 200, channels: 3, background: '#000' } }).composite(comp).webp({ quality: 80 }).toFile(path.join(OUT, 'alineacion.webp'));
  fs.writeFileSync(path.join(__dirname, 'poses_origen.json'), JSON.stringify(rows, null, 1));
  for (const r of rows) console.log(r.clave.padEnd(28), 'idle', String(r.anchoIdle).padEnd(4), 'pose', String(r.anchoPose).padEnd(4), 'desplazamiento', String(r.desplazamiento).padEnd(4), 'ox', r.ox);
})();
