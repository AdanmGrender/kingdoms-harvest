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
    this.load.image('farm_tiles', '/assets/game/tilesets/farm_tiles.png');
    this.load.spritesheet('buildings', '/assets/game/tilesets/buildings.png', {
      frameWidth: 128,
      frameHeight: 128,
    });

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
    // ─── Create animations ───
    this.createNPCAnimations();
    this.createAnimalAnimations();

    // Transition to world
    this.scene.start('WorldScene');
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
