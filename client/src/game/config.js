/**
 * Phaser 3 game configuration for Kingdoms Harvest.
 * Fixed: proper touch/mobile input settings for Telegram Mini App.
 */
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import WorldScene from './scenes/WorldScene';
import IsoScene from './scenes/IsoScene';

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
  scene: [BootScene, WorldScene, IsoScene],
  parent: 'phaser-container',
  backgroundColor: '#1a1a2e',
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
