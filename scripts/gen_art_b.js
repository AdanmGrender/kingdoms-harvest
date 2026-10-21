'use strict';
/**
 * gen_art_b.js — generador de arte de la DIRECCIÓN B (ilustración gótica de
 * novela gráfica, combate de perfil). Separado de gen_ai_art.js (pipeline iso
 * viejo) para no romperlo.
 *
 * Modelo por defecto: gemini-3-pro-image ("Nano Banana Pro"), 2K.
 * Requiere GEMINI_API_KEY en server/.env.
 *
 *   node scripts/gen_art_b.js --manifest art-b/manifest.json [--only id1,id2] [--force]
 *   node scripts/gen_art_b.js --prompt "..." --out art-b/raw/x.png --aspect 9:16 [--ref a.png]
 *
 * Manifest: [{ id, kind: "actor"|"scene"|"ui", aspect, prompt, refs?: [paths], out? }]
 *  - actor → fondo liso claro para recortar (process_art_b.js)
 *  - scene → fondo/escena completa, sin personajes
 *  - ui    → hoja de piezas de interfaz sobre fondo liso
 *  - prop  → UN solo objeto centrado sobre fondo liso claro, sin suelo (pickups de recolección)
 * Docs: docs/art-direction-b.md
 */
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..');

// ─── Bloques de estilo (contrato visual, ver docs/art-direction-b.md) ─────────
// 'grimdark' (default, 2026-10-16): fantasía oscura renacentista. Se describen
// RASGOS, nunca franquicias ni artistas reales (IP 100% original).
const STYLES = {
  grimdark: [
    'grimdark Renaissance dark-fantasy illustration, hand-inked like a 16th-century woodcut or',
    'copperplate engraving: rough scratchy ink linework, dense cross-hatching in the shadows,',
    'dark ink washes, muted earthy palette of umber, sepia, ochre, rust, bone white, tarnished brass',
    'and dried-blood crimson, with rare accents of sickly green glow and candle orange;',
    '"heroic scale" proportions: oversized head, hands, weapons and shoulder armour, chunky',
    'readable silhouette; everything worn, dirty, muddy, battle-scarred, patched and decaying',
    '(skulls, spikes, chains, parchment prayer scrolls, wax-sealed charms, bandages); maximalist',
    'detail with grotesque, darkly humorous touches. NOT clean high fantasy, NOT anime, NOT 3D',
    'render, NOT pixel art, no text, no watermark, no logos, no heraldic eagles, no eight-pointed',
    'stars, no comets, no existing franchise iconography, 100% original designs',
  ].join(' '),
  ink: [
    'hand-painted dark fantasy illustration in a gothic graphic-novel style:',
    'thick confident black ink outlines, heavy chiaroscuro with deep solid black shadows,',
    'cel-shaded forms with subtle painterly texture, strong readable silhouettes,',
    'limited muted grimdark palette (stone #4a443e, dark stone #332f2b, blood red #b32821,',
    'dirty gold #d9a441, eerie teal glow #4fd8c8, candle orange #e8933a, storm grey #4a4550),',
    'NOT pixel art, NOT 3D render, NOT photorealistic, no text, no watermark, no logos,',
    'no imperial or double-headed eagles, no chaos stars, no Games Workshop iconography,',
    '100% original designs',
  ].join(' '),
};

const KIND_SUFFIX = {
  actor: 'NOT on parchment or paper texture. Single character, full body fully visible head to feet with margin around it, '
    + 'isolated on a perfectly flat uniform light grey (#d0d0d0) background, '
    + 'no ground, no floor, no cast shadow, no other objects.',
  prop: 'NOT on parchment or paper texture. Exactly ONE single object (never a sheet, set or group of several), centered, '
    + 'fully visible with generous margin on every side, seen from slightly above in three-quarter view, '
    + 'isolated on a perfectly flat uniform light grey (#d0d0d0) background with nothing else in the image: '
    + 'no ground, no floor strip, no scene, no cast shadow, no other objects or tools, no text.',
  scene: 'Environment only: absolutely no characters, no people, no creatures.',
  ui: 'NOT on parchment paper. Game UI asset sheet: separate clean elements laid out in a grid with generous spacing '
    + 'on a perfectly flat uniform light grey (#d0d0d0) background, front orthographic view, no text, no letters.',
};

function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = path.join(ROOT, 'server', '.env');
  if (!fs.existsSync(envPath)) return null;
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*GEMINI_API_KEY\s*=\s*"?([^"\s]+)"?/);
    if (m) return m[1];
  }
  return null;
}

function refPart(refPath) {
  const abs = path.isAbsolute(refPath) ? refPath : path.join(ROOT, refPath);
  if (!fs.existsSync(abs)) throw new Error(`ref no encontrada: ${refPath}`);
  const ext = path.extname(abs).toLowerCase();
  const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : ext === '.webp' ? 'image/webp' : 'image/png';
  return { inlineData: { mimeType, data: fs.readFileSync(abs).toString('base64') } };
}

function buildPrompt({ kind = 'actor', prompt, refs = [], style = 'grimdark' }) {
  const suffix = KIND_SUFFIX[kind] || '';
  const lead = refs.length
    ? 'The attached image(s) are the art-style reference: match their rendering technique, ink line '
      + 'weight, palette, lighting and level of detail exactly. Do NOT draw the character from the '
      + 'reference image(s) unless the SUBJECT explicitly says it is the same character — never add '
      + 'extra figures, heads or body parts from the reference. Draw exactly ONE subject. '
    : '';
  return `${lead}${STYLES[style] || STYLES.grimdark}. SUBJECT: ${prompt}. ${suffix}`;
}

async function generate(item, { model, size }) {
  const apiKey = loadApiKey();
  if (!apiKey) throw new Error('Falta GEMINI_API_KEY en server/.env');
  const refs = item.refs || [];
  const parts = [...refs.map(refPart), { text: buildPrompt(item) }];
  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: item.aspect || '1:1', imageSize: size },
    },
  };
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const t0 = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`API ${res.status}: ${(await res.text()).slice(0, 400)}`);
  const data = await res.json();
  const rp = data?.candidates?.[0]?.content?.parts || [];
  const img = rp.find((p) => p.inlineData?.data);
  if (!img) {
    const text = rp.map((p) => p.text).filter(Boolean).join(' ');
    throw new Error(`sin imagen (${data?.candidates?.[0]?.finishReason || '?'}) ${text.slice(0, 300)}`);
  }
  const out = path.isAbsolute(item.out) ? item.out : path.join(ROOT, item.out);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  // El modelo Pro devuelve JPEG aunque pidamos .png → normalizar a PNG real
  // (la extensión del archivo no miente y no se recomprime con pérdida otra vez).
  await sharp(Buffer.from(img.inlineData.data, 'base64')).png().toFile(out);
  console.log(`✓ ${item.id} → ${path.relative(ROOT, out)} (${(fs.statSync(out).size / 1024) | 0} KB, ${((Date.now() - t0) / 1000).toFixed(0)}s)`);
}

function parseArgs(argv) {
  const a = { manifest: null, only: null, force: false, prompt: null, out: null, aspect: '1:1', kind: 'actor', refs: [], model: 'gemini-3-pro-image', size: '2K' };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--manifest') a.manifest = argv[++i];
    else if (t === '--only') a.only = argv[++i].split(',');
    else if (t === '--force') a.force = true;
    else if (t === '--prompt') a.prompt = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--aspect') a.aspect = argv[++i];
    else if (t === '--kind') a.kind = argv[++i];
    else if (t === '--ref') a.refs.push(argv[++i]);
    else if (t === '--model') a.model = argv[++i];
    else if (t === '--size') a.size = argv[++i];
  }
  return a;
}

(async () => {
  const a = parseArgs(process.argv);
  const opts = { model: a.model, size: a.size };
  let items;
  if (a.manifest) {
    const mpath = path.join(ROOT, a.manifest);
    const base = path.dirname(mpath);
    items = JSON.parse(fs.readFileSync(mpath, 'utf8')).map((it) => ({
      ...it, out: it.out || path.join(base, 'raw', `${it.id}.png`),
    }));
    if (a.only) items = items.filter((it) => a.only.includes(it.id));
  } else if (a.prompt) {
    items = [{ id: 'libre', kind: a.kind, aspect: a.aspect, prompt: a.prompt, refs: a.refs, out: a.out || `art-b/raw/libre-${Date.now()}.png` }];
  } else {
    console.error('Uso: node scripts/gen_art_b.js --manifest art-b/manifest.json [--only a,b] [--force]');
    process.exitCode = 1; return;
  }
  // Orden: los que no dependen de otros primero (refs que aún no existen se generan antes).
  let fails = 0;
  for (const it of items) {
    const out = path.isAbsolute(it.out) ? it.out : path.join(ROOT, it.out);
    if (!a.force && fs.existsSync(out)) { console.log(`· ${it.id} ya existe (usa --force)`); continue; }
    try { await generate(it, opts); } catch (e) { fails++; console.error(`✗ ${it.id}: ${e.message}`); }
  }
  if (fails) process.exitCode = 1;
})();
