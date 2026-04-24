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
    this.load.spritesheet('buildings', '/assets/game/tilesets/buildings.png', {
      frameWidth: 64,
      frameHeight: 64,
    });

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
  }

  create() {
    // ─── Chroma-key: old spritesheets have solid white backgrounds that must
    // be punched out to transparent before use. Terrain/Kenney tiles already
    // have alpha and are skipped.
    const chromaKeyTargets = [
      'farm_tiles', 'troops', 'effects',
      'npc_farmer', 'npc_baker', 'npc_princess', 'npc_wizard',
      'npc_knight', 'npc_merchant', 'npc_ranger',
      'chicken', 'cow', 'sheep',
    ];
    for (const key of chromaKeyTargets) this.makeWhiteTransparent(key);
    // buildings.png has generous white padding around each sprite but the buildings
    // themselves contain near-white highlights — need a stricter threshold (250) so
    // only the true background is removed and the sprite body survives.
    this.makeWhiteTransparent('buildings', 252);

    // ─── Create animations ───
    this.createNPCAnimations();
    this.createAnimalAnimations();

    // URL-param switch: ?iso=1 → IsoScene, otherwise WorldScene
    const params = new URLSearchParams(window.location.search);
    const target = params.get('iso') === '1' ? 'IsoScene' : 'WorldScene';
    this.scene.start(target);
  }

  /**
   * Replace any near-white pixel in a texture with transparent. Needed because
   * the old asset batch was exported over solid white instead of alpha.
   * Threshold 240 covers faint JPEG-y edge fringing without eating legit cream
   * tones in sprites.
   */
  makeWhiteTransparent(key, threshold = 240) {
    const texture = this.textures.get(key);
    if (!texture || texture.key === '__MISSING') return;
    const src = texture.getSourceImage();
    if (!src || !src.width) return;

    // Capture spritesheet frame dims before we destroy the texture. Frame 0
    // holds the natural frame size; a plain image has a single frame that
    // covers the whole source.
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
    for (let i = 0; i < px.length; i += 4) {
      if (px[i] >= threshold && px[i + 1] >= threshold && px[i + 2] >= threshold) {
        px[i + 3] = 0;
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

  createNPCAnimations() {
    const npcNames = ['farmer', 'baker', 'princess', 'wizard', 'knight', 'merchant', 'ranger'];
    for (const name of npcNames) {
      this.anims.create({
        key: `npc_${name}_idle`,
        frames: this.anims.generateFrameNumbers(`npc_${name}`, { start: 0, end: 1 }),
        frameRate: 2,
        repeat: -1,
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
