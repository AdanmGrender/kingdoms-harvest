/**
 * Phaser 3 game configuration for Kingdoms Harvest.
 */
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import WorldScene from './scenes/WorldScene';

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
  scene: [BootScene, WorldScene],
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
