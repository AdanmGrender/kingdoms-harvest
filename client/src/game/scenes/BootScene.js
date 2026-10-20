/**
 * BootScene: Loads all game assets and shows a progress bar.
 * Transitions to WorldScene when complete.
 */
import Phaser from 'phaser';

export default class BootScene extends Phaser.Scene {
  constructor() {
    super({ key: 'BootScene' });
  }

  preload() {
    // ─── Progress bar ───
    const { width, height } = this.cameras.main;
    const barW = Math.min(300, width * 0.6);
    const barH = 20;
    const barX = (width - barW) / 2;
    const barY = height / 2;

    const bg = this.add.graphics();
    bg.fillStyle(0x222244, 1);
    bg.fillRect(barX - 2, barY - 2, barW + 4, barH + 4);

    const bar = this.add.graphics();

    const loadingText = this.add.text(width / 2, barY - 30, 'Cargando...', {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '20px',
      color: '#ffd700',
    }).setOrigin(0.5);

    const percentText = this.add.text(width / 2, barY + barH + 15, '0%', {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '16px',
      color: '#ffffff',
    }).setOrigin(0.5);

    this.load.on('progress', (value) => {
      bar.clear();
      bar.fillStyle(0xffd700, 1);
      bar.fillRect(barX, barY, barW * value, barH);
      percentText.setText(`${Math.round(value * 100)}%`);
    });

    this.load.on('complete', () => {
      bg.destroy();
      bar.destroy();
      loadingText.destroy();
      percentText.destroy();
    });

    // Log any file load errors
    this.load.on('loaderror', (file) => {
      console.error('[BootScene] Failed to load:', file.key, file.url);
    });

    // ─── Load tilesets ───
    this.load.image('terrain', '/assets/game/tilesets/terrain.png');
    this.load.spritesheet('farm_tiles', '/assets/game/tilesets/farm_tiles.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    // buildings.png is superseded by Kenney's iso_struct_N PNGs (loaded below).
    // Player buildings now pick a structure tile via config/buildingSprites.js.

    // ─── Kenney medieval-rts top-down tileset (used by WorldScene + IsoScene) ───
    const pad2 = (n) => String(n).padStart(2, '0');
    const medievalBase = '/assets/kenney-medieval/PNG/Default size';
    for (let i = 1; i <= 58; i++) {
      this.load.image(`iso_tile_${i}`, `${medievalBase}/Tile/medievalTile_${pad2(i)}.png`);
    }
    for (let i = 1; i <= 21; i++) {
      this.load.image(`iso_env_${i}`, `${medievalBase}/Environment/medievalEnvironment_${pad2(i)}.png`);
    }
    for (let i = 1; i <= 23; i++) {
      this.load.image(`iso_struct_${i}`, `${medievalBase}/Structure/medievalStructure_${pad2(i)}.png`);
    }

    // ─── Load characters ───
    // NPCs
    const npcNames = ['farmer', 'baker', 'princess', 'wizard', 'knight', 'merchant', 'ranger'];
    for (const name of npcNames) {
      this.load.spritesheet(`npc_${name}`, `/assets/game/characters/npc_${name}.png`, {
        frameWidth: 32,
        frameHeight: 48,
      });
    }

    // Troops
    this.load.spritesheet('troops', '/assets/game/characters/troops.png', {
      frameWidth: 32,
      frameHeight: 48,
    });

    // Villagers reuse the per-role npc_<role> sheets (see entities/Villager.js
    // ROLE_SPRITE_MAP). The legacy 'villager' sheet is not shipped.

    // ─── Load animals ───
    this.load.spritesheet('chicken', '/assets/game/animals/chicken.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('cow', '/assets/game/animals/cow.png', {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.spritesheet('sheep', '/assets/game/animals/sheep.png', {
      frameWidth: 32,
      frameHeight: 32,
    });

    // ─── Load effects ───
    this.load.spritesheet('effects', '/assets/game/effects/effects.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    // ─── Load UI ───
    this.load.image('dialog_frame', '/assets/game/ui/dialog_frame.png');

    // ─── Ambiente grimdark (AmbientSystem + decals de suelo) ───
    this.load.image('sky_storm', '/assets/game/ambient/sky_storm.png');
    this.load.spritesheet('ground_decals', '/assets/game/iso/decals.png', {
      frameWidth: 64,
      frameHeight: 32,
    });

    // ─── Slots de arte por edificio (bld_<id>) ───
    // Mirror de shared/gameConfig.js BUILDINGS — keep in sync. El arte IA
    // sobrescribe assets/game/buildings/<id>.png; getBuildingSprite() prefiere
    // bld_<id> cuando la textura existe.
    const BUILDING_IDS = [
      'farm_plot', 'barn', 'mill', 'sawmill', 'smithy', 'stable', 'house',
      'mine', 'wall', 'tower', 'barracks', 'trap', 'tavern', 'market',
      'embassy', 'throne_room', 'library',
    ];
    for (const id of BUILDING_IDS) {
      this.load.image(`bld_${id}`, `/assets/game/buildings/${id}.png`);
    }

    // ─── Anclas de terreno por zona (zone_<familia>_<n>) ───
    // Piso de fondo grimdark por bioma (systems/ZoneAnchors.js). Si faltan,
    // WorldScene cae a los tiles planos. Familia → nº de variantes.
    const ZONE_ANCHORS = { grass: 2, dirt: 2, sand: 1, snow: 1, ice: 1 };
    for (const [fam, n] of Object.entries(ZONE_ANCHORS)) {
      for (let i = 0; i < n; i++) {
        this.load.image(`zone_${fam}_${i}`, `/assets/game/zones/zone_${fam}_${i}.png`);
      }
    }
  }

  create() {
    // ─── Chroma-key: old spritesheets have solid white backgrounds that must
    // be punched out to transparent before use. Terrain/Kenney tiles already
    // have alpha and are skipped.
    // npc_<rol> ya NO se chroma-keyan: el arte IA (gen_chars.sh) trae alpha
    // propio; el white-punch les haría agujeros en zonas claras (harina del
    // panadero, piel pálida de la princesa). Solo los sheets legacy con fondo
    // blanco sólido necesitan el punch.
    const chromaKeyTargets = [
      'farm_tiles', 'troops', 'effects',
    ];
    for (const key of chromaKeyTargets) this.makeWhiteTransparent(key);

    // ─── Create animations ───
    this.createNPCAnimations();
    this.createAnimalAnimations();

    // Scene selection: registry isoMode flag (set by IsoWorldScene experiment)
    // or URL param ?iso=1 lands on the legacy IsoScene. Default is WorldScene.
    const params = new URLSearchParams(window.location.search);
    const isoModeFlag = this.game.registry.get('isoMode');
    let target = 'WorldScene';
    if (isoModeFlag) target = 'IsoWorldScene';
    else if (params.get('iso') === '1') target = 'IsoScene';
    this.scene.start(target);
  }

  /**
   * Replace near-white pixels in a texture with transparent. Needed because the
   * old asset batch was exported over solid white instead of alpha.
   *
   * Threshold 240 covers faint JPEG-y edge fringing without eating legit cream
   * tones in small sprites. For sprites with lots of light-colored body pixels
   * (roofs, walls, highlights) the flood-fill mode is safer: only the contiguous
   * white region touching the frame edges is removed, so interior highlights
   * survive.
   *
   * @param {string} key      texture key
   * @param {object} opts     { threshold, floodFill, frameWidth, frameHeight }
   */
  makeWhiteTransparent(key, opts = {}) {
    const { threshold = 240, floodFill = false } = typeof opts === 'number' ? { threshold: opts } : opts;
    const texture = this.textures.get(key);
    if (!texture || texture.key === '__MISSING') return;
    const src = texture.getSourceImage();
    if (!src || !src.width) return;

    // Capture spritesheet frame dims before we destroy the texture.
    const frame0 = texture.frames[0] || texture.frames['__BASE'];
    const isSheet = frame0 && frame0.width > 0 && frame0.width < src.width;
    const frameWidth = frame0?.width || src.width;
    const frameHeight = frame0?.height || src.height;

    const canvas = document.createElement('canvas');
    canvas.width = src.width;
    canvas.height = src.height;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(src, 0, 0);
    const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const px = imgData.data;

    if (floodFill && isSheet) {
      // Per-frame flood fill: treat each (frameWidth × frameHeight) cell independently
      // so we only remove the background touching that frame's edges, not interior
      // bright pixels. This preserves light-colored body art (like castle highlights).
      const cols = Math.floor(src.width / frameWidth);
      const rows = Math.floor(src.height / frameHeight);
      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          this._floodFillFrameWhite(
            px, src.width,
            c * frameWidth, r * frameHeight,
            frameWidth, frameHeight,
            threshold,
          );
        }
      }
    } else {
      // Simple pixel threshold: every near-white pixel becomes transparent.
      for (let i = 0; i < px.length; i += 4) {
        if (px[i] >= threshold && px[i + 1] >= threshold && px[i + 2] >= threshold) {
          px[i + 3] = 0;
        }
      }
    }
    ctx.putImageData(imgData, 0, 0);

    this.textures.remove(key);
    if (isSheet) {
      this.textures.addSpriteSheet(key, canvas, { frameWidth, frameHeight });
    } else {
      this.textures.addCanvas(key, canvas);
    }
  }

  /**
   * Flood-fill from each frame edge inward, turning near-white pixels transparent.
   * Stops at non-white pixels, leaving interior light tones intact.
   */
  _floodFillFrameWhite(px, stride, x0, y0, fw, fh, threshold) {
    const visited = new Uint8Array(fw * fh);
    const stack = [];
    // Seed from all four frame edges
    for (let i = 0; i < fw; i++) {
      stack.push([i, 0]);
      stack.push([i, fh - 1]);
    }
    for (let j = 0; j < fh; j++) {
      stack.push([0, j]);
      stack.push([fw - 1, j]);
    }
    while (stack.length) {
      const [lx, ly] = stack.pop();
      if (lx < 0 || ly < 0 || lx >= fw || ly >= fh) continue;
      const localIdx = ly * fw + lx;
      if (visited[localIdx]) continue;
      const p = ((y0 + ly) * stride + (x0 + lx)) * 4;
      if (px[p] < threshold || px[p + 1] < threshold || px[p + 2] < threshold) continue;
      visited[localIdx] = 1;
      px[p + 3] = 0;
      stack.push([lx + 1, ly], [lx - 1, ly], [lx, ly + 1], [lx, ly - 1]);
    }
  }

  createNPCAnimations() {
    const npcNames = ['farmer', 'baker', 'princess', 'wizard', 'knight', 'merchant', 'ranger'];
    // Sheets DIRECCIONALES 4×3 (scripts/assemble_dirs.js): fila 0 = down (frente,
    // frames 0-3), fila 1 = up (espalda, 4-7), fila 2 = side (perfil derecho,
    // 8-11; izquierda = flipX). NPC.js elige la dirección por el vector de
    // movimiento y reproduce walk_<dir>/idle_<dir>.
    const DIRS = { down: 0, up: 4, side: 8 };
    for (const name of npcNames) {
      for (const [dir, base] of Object.entries(DIRS)) {
        this.anims.create({
          key: `npc_${name}_walk_${dir}`,
          frames: this.anims.generateFrameNumbers(`npc_${name}`, { start: base, end: base + 3 }),
          frameRate: 6,
          repeat: -1,
        });
        this.anims.create({
          key: `npc_${name}_idle_${dir}`,
          frames: this.anims.generateFrameNumbers(`npc_${name}`, { start: base, end: base }),
          frameRate: 1,
          repeat: -1,
        });
      }
      // Alias legacy: Villager.js y código viejo esperan `_idle`/`_walk` → down.
      this.anims.create({
        key: `npc_${name}_idle`,
        frames: this.anims.generateFrameNumbers(`npc_${name}`, { start: 0, end: 0 }),
        frameRate: 1, repeat: -1,
      });
      this.anims.create({
        key: `npc_${name}_walk`,
        frames: this.anims.generateFrameNumbers(`npc_${name}`, { start: 0, end: 3 }),
        frameRate: 6, repeat: -1,
      });
    }
  }

  createAnimalAnimations() {
    for (const animal of ['chicken', 'cow', 'sheep']) {
      this.anims.create({
        key: `${animal}_idle`,
        frames: this.anims.generateFrameNumbers(animal, { start: 0, end: 1 }),
        frameRate: 2,
        repeat: -1,
      });
      this.anims.create({
        key: `${animal}_walk`,
        frames: this.anims.generateFrameNumbers(animal, { start: 2, end: 3 }),
        frameRate: 4,
        repeat: -1,
      });
    }
  }
}
