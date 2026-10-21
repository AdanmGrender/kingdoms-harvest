/**
 * ParticleSystem: Handles ambient particle effects (smoke, dust, sparkles).
 * Uses Phaser's built-in particle emitter with the effects spritesheet.
 */
import Phaser from 'phaser';

export default class ParticleSystem {
  constructor(scene) {
    this.scene = scene;
    this.emitters = [];
  }

  /**
   * Add chimney smoke to a building position
   */
  addBuildingSmoke(x, y) {
    const particles = this.scene.add.particles(x, y - 24, 'effects', {
      frame: 0,
      speed: { min: 5, max: 15 },
      angle: { min: 260, max: 280 },
      scale: { start: 0.5, end: 0 },
      alpha: { start: 0.4, end: 0 },
      lifespan: 2000,
      frequency: 800,
      tint: 0x888888,
      depth: 12,
    });
    this.emitters.push(particles);
    return particles;
  }

  /**
   * Construction dust burst at a position (one-shot)
   */
  emitConstructionDust(x, y) {
    const particles = this.scene.add.particles(x, y, 'effects', {
      frame: 0,
      speed: { min: 20, max: 60 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.6, end: 0 },
      alpha: { start: 0.6, end: 0 },
      lifespan: 600,
      tint: 0xc8a870,
      quantity: 8,
      emitting: false,
      depth: 12,
    });
    particles.explode(8);
    this.scene.time.delayedCall(1000, () => particles.destroy());
  }

  /**
   * Floating "+X KH" token gain text at a world position.
   * Floats upward and fades out over 1.8 seconds.
   * opts (hub B): fontSize en px de mundo, resolution de rasterizado y depth; el trazo y el recorrido escalan con
   * fontSize / 14 para que se vea igual en pantalla. Defaults = comportamiento del mundo.
   */
  emitTokenGain(x, y, amount, { fontSize = 14, resolution = 1, depth = 25 } = {}) {
    const k = fontSize / 14;
    const text = this.scene.add.text(x, y - 20 * k, `+${amount} KH`, {
      fontFamily: 'MedievalSharp, serif',
      fontSize: `${fontSize}px`,
      color: '#c084fc',      // purple-400, matches token UI
      stroke: '#000000',
      strokeThickness: 3 * k,
    }).setDepth(depth).setOrigin(0.5);
    text.setResolution(resolution);

    this.scene.tweens.add({
      targets: text,
      y: y - 80 * k,
      alpha: { from: 1, to: 0 },
      duration: 1800,
      ease: 'Power2',
      onComplete: () => text.destroy(),
    });
  }

  /**
   * Sparkle effect (for resource collection, level up, etc.)
   */
  emitSparkle(x, y) {
    const particles = this.scene.add.particles(x, y, 'effects', {
      frame: 0,
      speed: { min: 10, max: 40 },
      angle: { min: 0, max: 360 },
      scale: { start: 0.4, end: 0 },
      alpha: { start: 1, end: 0 },
      lifespan: 500,
      tint: 0xffd700,
      quantity: 6,
      emitting: false,
      depth: 12,
    });
    particles.explode(6);
    this.scene.time.delayedCall(800, () => particles.destroy());
  }

  destroy() {
    for (const e of this.emitters) {
      if (e && e.active) e.destroy();
    }
    this.emitters = [];
  }
}
