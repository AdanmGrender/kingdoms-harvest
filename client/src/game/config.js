/**
 * Phaser 3 game configuration for Kingdoms Harvest.
 *
 * Feature flag: set VITE_ISO_MODE=true in client/.env.local to activate
 * IsoWorldScene instead of the default top-down WorldScene.
 */
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import WorldScene from './scenes/WorldScene';
import IsoWorldScene from './scenes/IsoWorldScene';

export const ISO_MODE = import.meta.env.VITE_ISO_MODE === 'true';

const gameConfig = {
  type: Phaser.AUTO,
  pixelArt: true,
  antialias: false,
  roundPixels: true,
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
  scene: ISO_MODE ? [BootScene, IsoWorldScene] : [BootScene, WorldScene],
  parent: 'phaser-container',
  backgroundColor: '#1a1a2e',
  audio: {
    disableWebAudio: false,
  },
  render: {
    pixelArt: true,
    antialias: false,
  },
};

export default gameConfig;
