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
