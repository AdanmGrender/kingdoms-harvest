/**
 * Phaser 3 game configuration for Kingdoms Harvest.
 * Fixed: proper touch/mobile input settings for Telegram Mini App.
 */
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import WorldScene from './scenes/WorldScene';
import IsoScene from './scenes/IsoScene';
import IsoWorldScene from './scenes/IsoWorldScene';

// Feature flag for the new isometric pixel-art experiment (WiFOf branch).
// PhaserGame stamps registry.isoMode = ISO_MODE on boot so BootScene knows
// whether to land on IsoWorldScene. URL ?iso=1 falls back to the legacy IsoScene.
export const ISO_MODE = false;

const gameConfig = {
  type: Phaser.AUTO,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
  input: {
    activePointers: 3,
    touch: {
      capture: true,
    },
    smoothFactor: 0,
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { y: 0 },
      debug: false,
    },
  },
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    width: '100%',
    height: '100%',
  },
  scene: [BootScene, WorldScene, IsoScene, IsoWorldScene],
  parent: 'phaser-container',
  // Tormenta grimdark (paleta docs/art-style.md) — el área fuera del mundo se
  // funde con el cielo en vez de verse como render roto.
  backgroundColor: '#4a4550',
  audio: {
    disableWebAudio: false,
  },
  render: {
    pixelArt: true,
    antialias: false,
  },
  // Prevent right-click context menu on desktop
  disableContextMenu: true,
};

export default gameConfig;
