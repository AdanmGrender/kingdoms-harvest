/**
 * Fábrica del `Phaser.Game` de combate (combate_b T5, R36, R38; design §6). Juego propio, no el del hub.
 * Lienzo lógico 824×1720 en modo FIT dentro del contenedor (el alto lo da `--kh-frame-h`, R36).
 */
import Phaser from 'phaser';
import CombatScene from './CombatScene';
import { resolveQuality } from './combatQuality';
import { WORLD } from './formation';

export function buildCombatConfig(parent, quality) {
  const q = quality || resolveQuality();
  return {
    type: q.name === 'low' ? Phaser.CANVAS : Phaser.AUTO,
    parent,
    backgroundColor: '#000000',
    banner: false,
    audio: { noAudio: true },
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH, width: WORLD.w, height: WORLD.h },
    scene: [],
  };
}

/**
 * @param parent   elemento DOM contenedor
 * @param opts     { quality?, state, node, onReady?, onRoundDone?, reducedMotion? }
 * @returns Phaser.Game (la escena se obtiene con `game.scene.getScene('combat')`)
 */
export function createCombatGame(parent, opts = {}) {
  const quality = opts.quality && opts.quality.name ? opts.quality : resolveQuality();
  const game = new Phaser.Game(buildCombatConfig(parent, quality));
  game.scene.add('combat', CombatScene, true, { ...opts, quality });
  return game;
}
