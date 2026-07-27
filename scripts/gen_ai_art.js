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
    // Lámina de FONDO (background matte), no un edificio: cielo dominante,
    // ruinas diminutas en el horizonte. Se combate el sesgo a "fortaleza".
    prompt: 'a background sky matte painting, NOT a building: a turbulent stormy purple-grey overcast sky filling the top three quarters of the frame, only a thin low strip of tiny distant ruined city silhouettes along the very bottom horizon, faint smoke wisps and floating orange embers, mostly empty atmospheric sky, wide panoramic wallpaper, no large structures, no foreground detail, minimalist desolate',
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

  // ── Resto de edificios (mismo estilo que throne_room/tower/smithy) ──
  // Todos: sujeto único centrado en fondo oscuro liso, 1:1 → buildings/<id>.png
  farm_plot: { aspect: '1:1', out: 'art-inbox/farm_plot.png', finalPath: 'client/public/assets/game/buildings/farm_plot.png',
    prompt: 'a hydroponic growing dome building with glowing green plant vats visible through armored glass, pipes, single structure centered on plain dark background' },
  barn: { aspect: '1:1', out: 'art-inbox/barn.png', finalPath: 'client/public/assets/game/buildings/barn.png',
    prompt: 'an armored supply depot building with stacked crates and a reinforced blast door, single structure centered on plain dark background' },
  mill: { aspect: '1:1', out: 'art-inbox/mill.png', finalPath: 'client/public/assets/game/buildings/mill.png',
    prompt: 'a ration processing plant building with grinding machinery, pipes and a chimney venting steam, single structure centered on plain dark background' },
  sawmill: { aspect: '1:1', out: 'art-inbox/sawmill.png', finalPath: 'client/public/assets/game/buildings/sawmill.png',
    prompt: 'a scrap salvage yard building with piles of rusted metal, a crane arm and cutting torches, single structure centered on plain dark background' },
  stable: { aspect: '1:1', out: 'art-inbox/stable.png', finalPath: 'client/public/assets/game/buildings/stable.png',
    prompt: 'a fortified beast pen building housing hulking mutant pack-animals behind iron bars, single structure centered on plain dark background' },
  house: { aspect: '1:1', out: 'art-inbox/house.png', finalPath: 'client/public/assets/game/buildings/house.png',
    prompt: 'a gothic habitation block tenement with narrow lit windows and hanging laundry, single structure centered on plain dark background' },
  mine: { aspect: '1:1', out: 'art-inbox/mine.png', finalPath: 'client/public/assets/game/buildings/mine.png',
    prompt: 'a deep mine shaft entrance building carved into rock with a rusted elevator rig and ore carts, single structure centered on plain dark background' },
  wall: { aspect: '1:1', out: 'art-inbox/wall.png', finalPath: 'client/public/assets/game/buildings/wall.png',
    prompt: 'a fortified stone bastion wall segment with battlements, buttresses and blood stains, single structure centered on plain dark background' },
  barracks: { aspect: '1:1', out: 'art-inbox/barracks.png', finalPath: 'client/public/assets/game/buildings/barracks.png',
    prompt: 'a military barracks building with hanging war banners, an arched drill-yard gate and torches, single structure centered on plain dark background' },
  trap: { aspect: '1:1', out: 'art-inbox/trap.png', finalPath: 'client/public/assets/game/buildings/trap.png',
    prompt: 'a fortified minefield emplacement with hazard-striped mine casings and warning lights, single structure centered on plain dark background' },
  tavern: { aspect: '1:1', out: 'art-inbox/tavern.png', finalPath: 'client/public/assets/game/buildings/tavern.png',
    prompt: 'a grimy cantina building with flickering orange lantern light, barrels and a crooked sign, single structure centered on plain dark background' },
  market: { aspect: '1:1', out: 'art-inbox/market.png', finalPath: 'client/public/assets/game/buildings/market.png',
    prompt: 'a covered black-market bazaar building with awnings, crates of goods and a merchant scale, single structure centered on plain dark background' },
  embassy: { aspect: '1:1', out: 'art-inbox/embassy.png', finalPath: 'client/public/assets/game/buildings/embassy.png',
    prompt: 'a communications nexus tower building topped with satellite dishes and antennae, red status lights, single structure centered on plain dark background' },
  library: { aspect: '1:1', out: 'art-inbox/library.png', finalPath: 'client/public/assets/game/buildings/library.png',
    prompt: 'a tech-shrine archive building with towering data-stacks, glowing teal screens and candles, single structure centered on plain dark background' },
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
  const a = { preset: null, prompt: null, out: null, aspect: '1:1', list: false, refs: [] };
  for (let i = 2; i < argv.length; i++) {
    const t = argv[i];
    if (t === '--list') a.list = true;
    else if (t === '--prompt') a.prompt = argv[++i];
    else if (t === '--out') a.out = argv[++i];
    else if (t === '--aspect') a.aspect = argv[++i];
    else if (t === '--ref') a.refs.push(argv[++i]); // imagen-ancla de estilo (repetible)
    else if (!t.startsWith('--')) a.preset = t;
  }
  return a;
}

// Lee una imagen del disco y la empaqueta como parte inlineData para Nano Banana.
function refPart(refPath) {
  const abs = path.isAbsolute(refPath) ? refPath : path.join(ROOT, refPath);
  if (!fs.existsSync(abs)) throw new Error(`ref no encontrada: ${refPath}`);
  const ext = path.extname(abs).toLowerCase();
  const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg'
    : ext === '.webp' ? 'image/webp' : 'image/png';
  return { inlineData: { mimeType, data: fs.readFileSync(abs).toString('base64') } };
}

async function generate(prompt, aspect, outPath, refs = []) {
  const apiKey = loadApiKey();
  if (!apiKey) {
    throw new Error('Falta GEMINI_API_KEY en server/.env (o en el entorno).');
  }

  // STYLE-LOCK: si hay imágenes-ancla, van como inlineData ANTES del texto y el
  // prompt manda replicar EXACTAMENTE su estilo (técnica de render, paleta, peso
  // de línea, luz, nivel de detalle) sobre un sujeto nuevo. Es la vía que da
  // cohesión real (a diferencia de texto-a-imagen suelto). Sin refs → texto solo
  // (comportamiento previo).
  let parts;
  if (refs.length) {
    const instruction =
      `Use the attached reference image(s) as the EXACT and ONLY art-style guide: `
      + `replicate their rendering technique, colour palette, line weight, lighting, `
      + `shading and level of detail with maximum fidelity. Now render a NEW, DIFFERENT `
      + `subject in that identical style: ${prompt}. Keep the composition centered on a `
      + `plain dark background unless told otherwise. 100% ORIGINAL design — no text, no `
      + `watermark, no logos, no imperial/double-headed eagles, no chaos star, no purity `
      + `seals, no Games Workshop marks. Palette: ${STYLE}.`;
    parts = [...refs.map(refPart), { text: instruction }];
  } else {
    parts = [{ text: `${STYLE}. ${prompt}` }];
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['IMAGE'],
      imageConfig: { aspectRatio: aspect },
    },
  };

  console.log(`→ generando (${aspect}${refs.length ? `, ${refs.length} ref${refs.length > 1 ? 's' : ''} de estilo` : ''}): ${prompt.slice(0, 60)}…`);
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
  const respParts = data?.candidates?.[0]?.content?.parts || [];
  const img = respParts.find((p) => p.inlineData?.data);
  if (!img) {
    // A veces el modelo responde texto (p. ej. rechazo de contenido)
    const text = respParts.map((p) => p.text).filter(Boolean).join(' ');
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
      path.join(ROOT, args.out || p.out), args.refs);
    console.log(`  destino final sugerido: ${p.finalPath}`);
    return;
  }

  if (args.prompt) {
    const out = args.out ? path.join(ROOT, args.out) : path.join(INBOX, `art-${Date.now()}.png`);
    await generate(args.prompt, args.aspect, out, args.refs);
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
