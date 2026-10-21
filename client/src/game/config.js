/**
 * Phaser 3 game configuration for Kingdoms Harvest.
 * buildGameConfig(settings) mapea los ajustes de display.js (entrada hub/preview) a la config de Phaser.
 */
import Phaser from 'phaser';
import BootScene from './scenes/BootScene';
import WorldScene from './scenes/WorldScene';
import IsoScene from './scenes/IsoScene';
import IsoWorldScene from './scenes/IsoWorldScene';
import HubSceneB from './scenes/HubSceneB';

// Feature flag for the new isometric pixel-art experiment (WiFOf branch).
// PhaserGame stamps registry.isoMode = ISO_MODE on boot so BootScene knows
// whether to land on IsoWorldScene. URL ?iso=1 falls back to the legacy IsoScene.
export const ISO_MODE = false;

const SCENES = { BootScene, WorldScene, IsoScene, IsoWorldScene, HubSceneB };

const baseConfig = {
  type: Phaser.AUTO,
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
  parent: 'phaser-container',
  // Tormenta grimdark (paleta docs/art-style.md) — el área fuera del mundo se
  // funde con el cielo en vez de verse como render roto.
  backgroundColor: '#4a4550',
  audio: {
    disableWebAudio: false,
  },
  // Prevent right-click context menu on desktop
  disableContextMenu: true,
};

export function buildGameConfig(settings) {
  const hub = settings.entry === 'hub';
  const { pixelArt, antialias, roundPixels } = settings;
  return {
    ...baseConfig,
    pixelArt,
    antialias,
    roundPixels,
    scale: {
      mode: Phaser.Scale[settings.mode],
      autoCenter: hub ? Phaser.Scale.NO_CENTER : Phaser.Scale.CENTER_BOTH,
      width: settings.width,
      height: settings.height,
      zoom: settings.zoom,
    },
    // Config.js de Phaser lee `render` antes que el nivel superior (y pixelArt por defecto vale zoom !== 1).
    render: { pixelArt, antialias, roundPixels },
    scene: settings.scenes.map((key) => SCENES[key]),
  };
}
