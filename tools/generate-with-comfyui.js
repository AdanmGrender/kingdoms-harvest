/**
 * Generate pixel art sprites using ComfyUI's Z-Image-Turbo model.
 * Generates individual character/object images, then composites them
 * into proper spritesheets for Phaser.
 *
 * Usage: node tools/generate-with-comfyui.js
 * Requires: ComfyUI running on http://127.0.0.1:8188
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const { PNG } = require('pngjs');

const COMFYUI_URL = 'http://127.0.0.1:8188';
const OUT_DIR = path.join(__dirname, '..', 'client', 'public', 'assets', 'game');
const TEMP_DIR = path.join(__dirname, '..', 'temp_sprites');

// Ensure temp dir exists
if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });

// ── ComfyUI API helpers ──

function httpRequest(url, options = {}, body = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      const chunks = [];
      res.on('data', (c) => chunks.push(c));
      res.on('end', () => {
        const buf = Buffer.concat(chunks);
        if (res.headers['content-type']?.includes('json')) {
          try { resolve(JSON.parse(buf.toString())); } catch { resolve(buf); }
        } else {
          resolve(buf);
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function queuePrompt(workflow) {
  const body = JSON.stringify({ prompt: workflow, client_id: 'sprite-gen' });
  return httpRequest(`${COMFYUI_URL}/api/prompt`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, body);
}

async function getHistory(promptId) {
  return httpRequest(`${COMFYUI_URL}/api/history/${promptId}`);
}

async function getImage(filename, subfolder, type) {
  const params = new URLSearchParams({ filename, subfolder, type });
  return httpRequest(`${COMFYUI_URL}/api/view?${params}`);
}

async function waitForCompletion(promptId, timeoutMs = 120000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const history = await getHistory(promptId);
    if (history[promptId]?.outputs) {
      return history[promptId];
    }
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error(`Timeout waiting for prompt ${promptId}`);
}

// ── Z-Image-Turbo workflow builder ──

function buildWorkflow(prompt, width = 512, height = 512, seed = null) {
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 32);
  return {
    "1": {
      "class_type": "UNETLoader",
      "inputs": {
        "unet_name": "z_image_turbo_bf16.safetensors",
        "weight_dtype": "default"
      }
    },
    "2": {
      "class_type": "CLIPLoader",
      "inputs": {
        "clip_name": "qwen_3_4b.safetensors",
        "type": "lumina2",
        "device": "default"
      }
    },
    "3": {
      "class_type": "VAELoader",
      "inputs": {
        "vae_name": "ae.safetensors"
      }
    },
    "4": {
      "class_type": "CLIPTextEncode",
      "inputs": {
        "text": prompt,
        "clip": ["2", 0]
      }
    },
    "5": {
      "class_type": "ConditioningZeroOut",
      "inputs": {
        "conditioning": ["4", 0]
      }
    },
    "6": {
      "class_type": "ModelSamplingAuraFlow",
      "inputs": {
        "model": ["1", 0],
        "shift": 3.0
      }
    },
    "7": {
      "class_type": "EmptySD3LatentImage",
      "inputs": {
        "width": width,
        "height": height,
        "batch_size": 1
      }
    },
    "8": {
      "class_type": "KSampler",
      "inputs": {
        "model": ["6", 0],
        "positive": ["4", 0],
        "negative": ["5", 0],
        "latent_image": ["7", 0],
        "seed": actualSeed,
        "steps": 4,
        "cfg": 1.0,
        "sampler_name": "res_multistep",
        "scheduler": "simple",
        "denoise": 1.0
      }
    },
    "9": {
      "class_type": "VAEDecode",
      "inputs": {
        "samples": ["8", 0],
        "vae": ["3", 0]
      }
    },
    "10": {
      "class_type": "SaveImage",
      "inputs": {
        "images": ["9", 0],
        "filename_prefix": "sprite"
      }
    }
  };
}

// ── Sprite definitions ──

const SPRITE_PROMPTS = {
  // Terrain tileset (32x32 tiles, top-down view)
  terrain: {
    prompt: "pixel art tileset sprite sheet, top-down RPG game tiles, seamless grass tile, dirt path tile, water tile, sand tile, stone tile, flowers, fence, tree, rock, bridge, cobblestone, 32x32 pixel grid, retro 16-bit style, medieval fantasy, clean pixel art, white background, no anti-aliasing",
    width: 512, height: 512,
    outputFile: 'tilesets/terrain.png'
  },
  // Farm tileset
  farm_tiles: {
    prompt: "pixel art tileset sprite sheet, top-down RPG farming tiles, tilled soil stages, growing crops wheat corn tomato carrot potato pumpkin, 32x32 pixel grid, retro 16-bit style, medieval farm, clean pixel art, organized grid layout, white background",
    width: 256, height: 256,
    outputFile: 'tilesets/farm_tiles.png'
  },
  // Buildings tileset (64x64 per building)
  buildings: {
    prompt: "pixel art building sprite sheet, top-down medieval RPG buildings, barn, windmill, castle wall, guard tower, barracks, tavern, market stall, throne room, library, stable, blacksmith, sawmill, each building 64x64 pixels, retro 16-bit style, organized grid, transparent background",
    width: 512, height: 512,
    outputFile: 'tilesets/buildings.png'
  },
  // Player character spritesheet (4 directions x 4 frames)
  player: {
    prompt: "pixel art character sprite sheet, medieval RPG hero, 4 walking directions (down left right up), 4 animation frames each direction, 32x48 pixel character, blue tunic, brown boots, 16-bit retro style, clean pixel art, white background, organized grid layout",
    width: 512, height: 512,
    outputFile: 'characters/player.png'
  },
  // NPCs
  npc_farmer: {
    prompt: "pixel art character sprite, medieval farmer NPC, straw hat, green overalls, holding pitchfork, 2 idle animation frames side by side, 32x48 pixels each frame, retro 16-bit RPG style, clean pixel art, white background",
    width: 512, height: 512,
    outputFile: 'characters/npc_farmer.png'
  },
  npc_baker: {
    prompt: "pixel art character sprite, medieval baker NPC, white chef hat, white apron, 2 idle animation frames side by side, 32x48 pixels each frame, retro 16-bit RPG style, clean pixel art, white background",
    width: 512, height: 512,
    outputFile: 'characters/npc_baker.png'
  },
  npc_princess: {
    prompt: "pixel art character sprite, medieval princess NPC, golden crown, purple dress, 2 idle animation frames side by side, 32x48 pixels each frame, retro 16-bit RPG style, clean pixel art, white background",
    width: 512, height: 512,
    outputFile: 'characters/npc_princess.png'
  },
  npc_wizard: {
    prompt: "pixel art character sprite, medieval wizard NPC, purple robe, pointy hat, magic staff, 2 idle animation frames side by side, 32x48 pixels each frame, retro 16-bit RPG style, clean pixel art, white background",
    width: 512, height: 512,
    outputFile: 'characters/npc_wizard.png'
  },
  npc_knight: {
    prompt: "pixel art character sprite, medieval knight NPC, silver armor, sword and shield, 2 idle animation frames side by side, 32x48 pixels each frame, retro 16-bit RPG style, clean pixel art, white background",
    width: 512, height: 512,
    outputFile: 'characters/npc_knight.png'
  },
  npc_merchant: {
    prompt: "pixel art character sprite, medieval merchant NPC, gold and brown clothes, coin pouch, 2 idle animation frames side by side, 32x48 pixels each frame, retro 16-bit RPG style, clean pixel art, white background",
    width: 512, height: 512,
    outputFile: 'characters/npc_merchant.png'
  },
  npc_ranger: {
    prompt: "pixel art character sprite, medieval ranger NPC, green cloak, bow, brown leather, 2 idle animation frames side by side, 32x48 pixels each frame, retro 16-bit RPG style, clean pixel art, white background",
    width: 512, height: 512,
    outputFile: 'characters/npc_ranger.png'
  },
  // Troops
  troops: {
    prompt: "pixel art military unit sprite sheet, medieval RPG troops, militia spearman archer cavalry, 10 soldier frames in a row, each 32x48 pixels, retro 16-bit style, clean pixel art, white background, organized horizontal strip",
    width: 512, height: 512,
    outputFile: 'characters/troops.png'
  },
  // Animals
  chicken: {
    prompt: "pixel art chicken sprite sheet, small farm chicken, 4 animation frames in a row (2 idle, 2 walking), each frame 32x32 pixels, retro 16-bit RPG style, clean pixel art, white background",
    width: 512, height: 512,
    outputFile: 'animals/chicken.png'
  },
  cow: {
    prompt: "pixel art cow sprite sheet, brown and white farm cow, 4 animation frames in a row (2 idle, 2 walking), each frame 32x32 pixels, retro 16-bit RPG style, clean pixel art, white background",
    width: 512, height: 512,
    outputFile: 'animals/cow.png'
  },
  sheep: {
    prompt: "pixel art sheep sprite sheet, white woolly farm sheep, 4 animation frames in a row (2 idle, 2 walking), each frame 32x32 pixels, retro 16-bit RPG style, clean pixel art, white background",
    width: 512, height: 512,
    outputFile: 'animals/sheep.png'
  },
  // Effects
  effects: {
    prompt: "pixel art effect sprites sheet, RPG particle effects, sparkle, explosion, smoke, heal glow, slash, water splash, fire, magic circle, organized 8x8 grid, each 16x16 pixels, retro 16-bit style, transparent background",
    width: 512, height: 512,
    outputFile: 'effects/effects.png'
  },
  // UI
  dialog_frame: {
    prompt: "pixel art dialog box frame, medieval RPG text box, ornate gold border, dark blue background, 320x120 pixels, retro 16-bit style, clean pixel art",
    width: 512, height: 256,
    outputFile: 'ui/dialog_frame.png'
  },
  joystick: {
    prompt: "pixel art virtual joystick UI element, circular base with directional arrows, semi-transparent gray, 128x64 pixels showing base circle and thumb circle, clean minimal design, game UI element, transparent background",
    width: 512, height: 256,
    outputFile: 'ui/joystick.png'
  },
  interact_btn: {
    prompt: "pixel art action button, circular golden button with hand icon, medieval RPG UI, 64x64 pixels, glowing gold border, clean pixel art, transparent background",
    width: 512, height: 512,
    outputFile: 'ui/interact_btn.png'
  }
};

// ── Resize/crop generated images to required dimensions ──

function resizeImage(srcBuffer, targetWidth, targetHeight) {
  const src = PNG.sync.read(srcBuffer);
  const dst = new PNG({ width: targetWidth, height: targetHeight });

  // Scale using nearest-neighbor (preserves pixel art feel)
  const scaleX = src.width / targetWidth;
  const scaleY = src.height / targetHeight;

  for (let y = 0; y < targetHeight; y++) {
    for (let x = 0; x < targetWidth; x++) {
      const srcX = Math.floor(x * scaleX);
      const srcY = Math.floor(y * scaleY);
      const srcIdx = (srcY * src.width + srcX) * 4;
      const dstIdx = (y * targetWidth + x) * 4;
      dst.data[dstIdx] = src.data[srcIdx];
      dst.data[dstIdx + 1] = src.data[srcIdx + 1];
      dst.data[dstIdx + 2] = src.data[srcIdx + 2];
      dst.data[dstIdx + 3] = src.data[srcIdx + 3];
    }
  }

  return PNG.sync.write(dst);
}

// Target dimensions for each sprite type
const TARGET_SIZES = {
  'tilesets/terrain.png': { w: 512, h: 512 },
  'tilesets/farm_tiles.png': { w: 256, h: 256 },
  'tilesets/buildings.png': { w: 512, h: 512 },
  'characters/player.png': { w: 128, h: 192 },
  'characters/npc_farmer.png': { w: 64, h: 48 },
  'characters/npc_baker.png': { w: 64, h: 48 },
  'characters/npc_princess.png': { w: 64, h: 48 },
  'characters/npc_wizard.png': { w: 64, h: 48 },
  'characters/npc_knight.png': { w: 64, h: 48 },
  'characters/npc_merchant.png': { w: 64, h: 48 },
  'characters/npc_ranger.png': { w: 64, h: 48 },
  'characters/troops.png': { w: 320, h: 48 },
  'animals/chicken.png': { w: 128, h: 32 },
  'animals/cow.png': { w: 128, h: 32 },
  'animals/sheep.png': { w: 128, h: 32 },
  'effects/effects.png': { w: 128, h: 128 },
  'ui/dialog_frame.png': { w: 320, h: 120 },
  'ui/joystick.png': { w: 128, h: 64 },
  'ui/interact_btn.png': { w: 64, h: 64 },
};

// ── Main ──

async function generateSprite(name, config) {
  console.log(`\n[${name}] Generating: ${config.prompt.substring(0, 60)}...`);

  const workflow = buildWorkflow(config.prompt, config.width, config.height);
  const result = await queuePrompt(workflow);

  if (!result.prompt_id) {
    console.error(`[${name}] Failed to queue:`, result);
    return false;
  }

  console.log(`[${name}] Queued: ${result.prompt_id}`);
  const completed = await waitForCompletion(result.prompt_id, 180000);

  // Get the output image
  const outputs = completed.outputs?.['10'];
  if (!outputs?.images?.[0]) {
    console.error(`[${name}] No output image`);
    return false;
  }

  const img = outputs.images[0];
  const imageData = await getImage(img.filename, img.subfolder, img.type);

  // Save raw output
  const rawPath = path.join(TEMP_DIR, `${name}_raw.png`);
  fs.writeFileSync(rawPath, imageData);
  console.log(`[${name}] Raw saved: ${rawPath}`);

  // Resize to target dimensions
  const target = TARGET_SIZES[config.outputFile];
  if (target) {
    const resized = resizeImage(imageData, target.w, target.h);
    const outPath = path.join(OUT_DIR, config.outputFile);
    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, resized);
    console.log(`[${name}] Output: ${outPath} (${target.w}x${target.h})`);
  }

  return true;
}

async function main() {
  // Check ComfyUI is running
  try {
    await httpRequest(`${COMFYUI_URL}/api/system_stats`);
    console.log('ComfyUI connected!');
  } catch {
    console.error('ComfyUI not running at', COMFYUI_URL);
    console.error('Start ComfyUI first, then run this script.');
    process.exit(1);
  }

  const names = process.argv.slice(2);
  const toGenerate = names.length > 0
    ? Object.entries(SPRITE_PROMPTS).filter(([k]) => names.includes(k))
    : Object.entries(SPRITE_PROMPTS);

  console.log(`Generating ${toGenerate.length} sprites...`);

  for (const [name, config] of toGenerate) {
    try {
      await generateSprite(name, config);
    } catch (err) {
      console.error(`[${name}] Error:`, err.message);
    }
  }

  console.log('\nDone! Check temp_sprites/ for raw outputs and client/public/assets/game/ for resized sprites.');
}

main().catch(console.error);
