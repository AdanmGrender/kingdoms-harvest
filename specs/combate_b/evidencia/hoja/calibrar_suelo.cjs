// Calibración de la línea de piso por fondo (V2 enmendada, hallazgo 2 de la review Etapa C).
//
// MÉTODO (a ojo sobre la imagen real, como permite el hallazgo 2 cuando la heurística de luma no basta):
//  1. Se recorta cada `client/public/assets/b/bg/combat_*.webp` (1080×1935) entre el 38 % y el 68 % del alto con una
//     regla cada 1 % (`suelo_regla_<fondo>.webp`, la escribe este script).
//  2. Se lee la PRIMERA fila, de arriba hacia abajo, desde la que la franja central (x 20–80 %, donde se paran los
//     personajes) es piso por el que se camina: tierra, losas o barro. No cuentan agua, techos, cielo, paredes, el
//     altar/estrado de la catedral ni los escalones del portal de veil_gate (se toma el pie de la escalera).
//     Lecturas (fracción del alto de la IMAGEN) en `LECTURA` abajo.
//  3. Se lleva a coordenadas del mundo 824×1720 con la misma transformación con la que `CombatScene` dibuja el fondo:
//     cover centrado, escala s = max(824/1080, 1720/1935) × 1,04, más la deriva lenta (escala hasta ×1,025 alrededor
//     del centro). Se toma el peor caso (la línea más BAJA posible): ×1,025 si la fila está debajo del centro.
//  4. groundY (mundo) = ceil(860 + (f − 0,5) · 1935 · s · k). BG_GROUND_Y_FRAC = groundY / 1720 (artMap.js).
// Además dibuja la línea calibrada sobre el fondo completo (`suelo_<fondo>.webp`).
// Uso: KH_NODE_MODULES=<node_modules con sharp> node calibrar_suelo.cjs  → calibracion_suelo.json + imágenes
const path = require('node:path');
const fs = require('node:fs');
const NM = process.env.KH_NODE_MODULES || 'D:/Proyectos/kingdoms-harvest/node_modules';
const sharp = require(path.join(NM, 'sharp'));
const DIR = path.join(__dirname, '..', '..', '..', '..', 'client', 'public', 'assets', 'b', 'bg');
const OUT = path.join(__dirname, 'suelo');

const LECTURA = {
  crypt: { f: 0.48, nota: 'calle embarrada; arriba de 0,47 escombros y fachadas; carro (x<17 %) y altar (x>75 %) fuera de la franja' },
  moor: { f: 0.50, nota: 'tierra del páramo; carro y charco de brea apoyados en 0,50–0,56; por encima, túmulo y lápidas' },
  cathedral: { f: 0.61, nota: 'losas de la nave delante del estrado; 0,55–0,60 es el altar y su escalón (no es piso)' },
  ashfield: { f: 0.42, nota: 'llanura de ceniza; por encima de 0,41 las ruinas del pueblo en el horizonte' },
  veil_marsh: { f: 0.51, nota: 'barro de la orilla; por encima de 0,50 agua y muelle' },
  veil_gate: { f: 0.575, nota: 'pie de la escalera del portal; 0,50–0,57 son escalones (no se cuentan)' },
};

const W = 824, H = 1720, IW = 1080, IH = 1935;
const S = Math.max(W / IW, H / IH) * 1.04;
const DRIFT = 1.025;
const toWorld = (f) => Math.ceil(H / 2 + (f - 0.5) * IH * S * (f > 0.5 ? DRIFT : 1));

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const out = {};
  for (const [bg, { f, nota }] of Object.entries(LECTURA)) {
    const file = path.join(DIR, `combat_${bg}.webp`);
    const groundY = toWorld(f);
    out[bg] = { imagenFrac: f, groundY, frac: +(groundY / H).toFixed(4), nota };
    // regla 38–68 %
    const top = Math.round(0.38 * IH), bot = Math.round(0.68 * IH), h = bot - top;
    const marks = [];
    for (let p = 38; p <= 68; p++) {
      const y = Math.round((p / 100) * IH) - top;
      marks.push(`<line x1="0" y1="${y}" x2="${p % 5 ? 40 : IW}" y2="${y}" stroke="${p % 5 ? '#0ff' : '#f0f'}" stroke-width="2"/>`);
      if (p % 2 === 0) marks.push(`<text x="44" y="${y + 8}" fill="#ff0" font-size="24">${p}</text>`);
    }
    const yl = Math.round(f * IH) - top;
    marks.push(`<line x1="0" y1="${yl}" x2="${IW}" y2="${yl}" stroke="#f00" stroke-width="4"/>`);
    const rule = await sharp(file).extract({ left: 0, top, width: IW, height: h })
      .composite([{ input: Buffer.from(`<svg width="${IW}" height="${h}">${marks.join('')}</svg>`) }]).png().toBuffer();
    await sharp(rule).resize(900).webp({ quality: 80 }).toFile(path.join(OUT, `suelo_regla_${bg}.webp`));
    // fondo completo como lo ve la escena (mundo 824×1720) con la línea de piso
    const dw = Math.round(IW * S), dh = Math.round(IH * S);
    const scene = await sharp(file).resize(dw, dh).extract({ left: Math.round((dw - W) / 2), top: Math.round((dh - H) / 2), width: W, height: H }).png().toBuffer();
    const line = `<svg width="${W}" height="${H}"><line x1="0" y1="${groundY}" x2="${W}" y2="${groundY}" stroke="#f00" stroke-width="4"/><text x="8" y="${groundY - 8}" fill="#ff0" font-size="32" stroke="#000" stroke-width="1">groundY ${groundY} (${(groundY / H).toFixed(3)})</text></svg>`;
    const marked = await sharp(scene).composite([{ input: Buffer.from(line) }]).png().toBuffer();
    await sharp(marked).resize(412).webp({ quality: 80 }).toFile(path.join(OUT, `suelo_${bg}.webp`));
  }
  fs.writeFileSync(path.join(__dirname, 'calibracion_suelo.json'), JSON.stringify(out, null, 1));
  for (const [k, v] of Object.entries(out)) console.log(k.padEnd(11), 'imagen', String(v.imagenFrac).padEnd(6), '→ groundY', v.groundY, `(${v.frac})`);
})();
