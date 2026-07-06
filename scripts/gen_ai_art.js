'use strict';
/**
 * gen_ai_art.js — genera arte del juego con Gemini 2.5 Flash Image
 * ("Nano Banana") vía la API de Google. Cada pieza sale a art-inbox/ para
 * revisión; luego se recorta/escala e integra a client/public/assets/game/.
 *
 * Requiere GEMINI_API_KEY en server/.env (o en el entorno).
 *
 *   node scripts/gen_ai_art.js sky                 # preset del batch 1
 *   node scripts/gen_ai_art.js throne_room
 *   node scripts/gen_ai_art.js --prompt "..." --out art-inbox/libre.png --aspect 1:1
 *   node scripts/gen_ai_art.js --list             # ver presets
 *
 * Pipeline completo: docs/ai-art-pipeline.md
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const INBOX = path.join(ROOT, 'art-inbox');
const MODEL = 'gemini-2.5-flash-image';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// ─── Bloque de estilo maestro (docs/ai-art-pipeline.md) ──────────────────────
const STYLE = [
  'isometric pixel art, dark gothic industrial fortress style, deep dramatic',
  'shadows, rust and dried blood stains on stone, muted grimdark palette',
  '(#4a443e stone, #332f2b dark stone, #b32821 blood red, #d9a441 dirty gold,',
  '#4fd8c8 hologram teal, #e8933a candle orange, #4a4550 storm sky),',
  'no text, no watermark, no logos, no imperial eagles',
].join(' ');

// ─── Presets del batch 1 (prompt + aspecto + destino sugerido) ───────────────
const PRESETS = {
  sky: {
    aspect: '16:9',
    out: 'art-inbox/sky_storm.png',
    prompt: 'stormy purple-grey sky over a ruined wasteland horizon, distant gothic ruins silhouettes, smoke columns, floating embers, wide panoramic landscape',
    finalPath: 'client/public/assets/game/ambient/sky_storm.png',
  },
  decals: {
    aspect: '1:1',
    out: 'art-inbox/decals.png',
    prompt: 'a set of small ground stains on a plain transparent background, top-down flat view: rust patches, dried blood pools, stone cracks, scattered bullet casings, arranged in a neat grid',
    finalPath: 'client/public/assets/game/iso/decals.png (recorte 8 frames)',
  },
  throne_room: {
    aspect: '1:1',
    out: 'art-inbox/throne_room.png',
    prompt: 'a command bastion building with a glowing teal holographic map table on a stone dais, hanging banners, skulls on the walls, single structure centered on plain dark background',
    finalPath: 'client/public/assets/game/buildings/throne_room.png',
  },
  tower: {
    aspect: '1:1',
    out: 'art-inbox/tower.png',
    prompt: 'an automated twin-barrel sentry turret mounted on a fortified stone tower, red warning light, single structure centered on plain dark background',
    finalPath: 'client/public/assets/game/buildings/tower.png',
  },
  smithy: {
    aspect: '1:1',
    out: 'art-inbox/smithy.png',
    prompt: 'a tech-shrine foundry building with glowing red coolant tubes, chimneys and an anvil, single structure centered on plain dark background',
    finalPath: 'client/public/assets/game/buildings/smithy.png',
  },
  terrain: {
    aspect: '16:9',
    out: 'art-inbox/terrain.png',
    prompt: 'a row of 7 isometric diamond floor tiles (2:1 ratio) side by side on plain dark background: dark grass, grass, light grass, dirt road, cracked stone, toxic green water, irradiated sand',
    finalPath: 'client/public/assets/game/iso/iso_terrain.png (recorte 7 frames 64x32)',
  },
  trooper: {
    aspect: '1:1',
    out: 'art-inbox/trooper_walk.png',
    prompt: 'a red heavy-armored trooper with a rifle, shown in a 5-row by 4-column sprite sheet grid: rows are facing directions (front, front-right, right, back-right, back), columns are walk animation frames, plain dark background',
    finalPath: 'client/public/assets/game/iso/chars/trooper_walk.png (recorte con slice_sheet.js)',
  },
};

// ─── Cargar la API key desde server/.env o el entorno ────────────────────────
function loadApiKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;
  const envPath = path.join(ROOT, 'server', '.env');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*(GEMINI_API_KEY|API_KEY_GEMINI)\s*=\s*(.+)\s*$/);
      if (m && !line.trimStart().startsWith('#')) return m[2].trim();
    }
  }
  return null;
}

// ─── Args ────────────────────────────────────────────────────────────────────
function parseArgs(argv) {
  const a = { preset: null, prompt: null, out: null, aspect: '1:1', list: false };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--list') a.list = true;
    else if (t === '--prompt') a.prompt = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--aspect') a.aspect = argv[++i];
    else if (!t.startsWith('--')) a.preset = t;
  }
  return a;
}

async function generate(prompt, aspect, outPath) {
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY en server/.env (o en el entorno).');
  }

  const body = {
    contents: [{ parts: [{ text: `${STYLE}. ${prompt}` }] }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: aspect },
    },
  };

  console.log(`→ generando (${aspect}): ${prompt.slice(0, 70)}…`);
  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text();
    if (res.status === 429 && /free_tier/.test(txt)) {
      throw new Error('cuota agotada: la generación de imágenes de Nano Banana NO está en la capa gratuita. Activá facturación en el proyecto (https://aistudio.google.com/apikey → billing) y reintentá. Costo ~$0.04/imagen.');
    }
    throw new Error(`API ${res.status}: ${txt.slice(0, 400)}`);
  }

  const data = await res.json();
  const parts = data?.candidates?.[0]?.content?.parts || [];
  const img = parts.find((p) => p.inlineData?.data);
  if (!img) {
    // A veces el modelo responde texto (p. ej. rechazo de contenido)
    const text = parts.map((p) => p.text).filter(Boolean).join(' ');
    throw new Error(`la API no devolvió imagen.${text ? ` Dijo: ${text.slice(0, 300)}` : ''}`);
  }

  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, Buffer.from(img.inlineData.data, 'base64'));
  const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
  console.log(`✓ ${outPath} (${kb} KB)`);
}

(async () => {
  const args = parseArgs(process.argv);

  if (args.list) {
    console.log('Presets del batch 1 (docs/ai-art-pipeline.md):\n');
    for (const [id, p] of Object.entries(PRESETS)) {
      console.log(`  ${id.padEnd(13)} ${p.aspect.padEnd(5)} → ${p.finalPath}`);
    }
    console.log('\nUso: node scripts/gen_ai_art.js <preset>  |  --prompt "..." --out ... --aspect 16:9');
    return;
  }

  if (args.preset) {
    const p = PRESETS[args.preset];
    if (!p) {
      console.error(`✗ Preset desconocido: ${args.preset}. Ver: node scripts/gen_ai_art.js --list`);
      process.exit(1);
    }
    await generate(p.prompt, args.aspect !== '1:1' ? args.aspect : p.aspect,
      path.join(ROOT, args.out || p.out));
    console.log(`  destino final sugerido: ${p.finalPath}`);
    return;
  }

  if (args.prompt) {
    const out = args.out ? path.join(ROOT, args.out) : path.join(INBOX, `art-${Date.now()}.png`);
    await generate(args.prompt, args.aspect, out);
    return;
  }

  console.error('Uso: node scripts/gen_ai_art.js <preset> | --prompt "..." [--out p] [--aspect 16:9]');
  console.error('     node scripts/gen_ai_art.js --list');
  process.exit(1);
})().catch((err) => {
  console.error('✗', err.message);
  // exitCode (no process.exit) para dejar que Node drene sockets y no dispare
  // la assertion de libuv en Windows al cortar con un fetch a medio cerrar
  process.exitCode = 1;
});
