/**
 * DayNightSystem: Visual day/night cycle with tinted camera overlay.
 * 10 real minutes = 1 game day. Smooth transitions between periods.
 */
import Phaser from 'phaser';
import EventBridge from '../EventBridge';

// Matches shared/gameConfig.js DAY_CYCLE
const DAY_CYCLE = {
  dayDurationMs: 10 * 60 * 1000,
  periods: {
    dawn:    { start: 0.00, end: 0.15 },
    morning: { start: 0.15, end: 0.35 },
    midday:  { start: 0.35, end: 0.55 },
    evening: { start: 0.55, end: 0.70 },
    night:   { start: 0.70, end: 1.00 },
  },
};

// Tints grimdark (paleta docs/art-style.md): noche púrpura-tormenta MUY
// profunda para que las luces puntuales corten la oscuridad, atardecer óxido,
// amanecer pálido enfermizo. Ni el mediodía es del todo limpio.
const PERIOD_TINTS = {
  dawn:    { r: 150, g: 120, b: 150, alpha: 0.22 },
  morning: { r: 220, g: 210, b: 220, alpha: 0.08 },
  midday:  { r: 255, g: 248, b: 230, alpha: 0.06 },
  evening: { r: 190, g: 95,  b: 45,  alpha: 0.34 },
  night:   { r: 20,  g: 18,  b: 34,  alpha: 0.68 },
};

const PERIOD_ICONS = {
  dawn:    '🌅',
  morning: '☀️',
  midday:  '🌞',
  evening: '🌇',
  night:   '🌙',
};

export default class DayNightSystem {
  constructor(scene) {
    this.scene = scene;
    this.dayDuration = DAY_CYCLE.dayDurationMs;
    this.elapsed = DAY_CYCLE.dayDurationMs * 0.20; // Start at early morning
    this.dayCount = 1;
    this.currentPeriod = 'morning';

    // Create full-screen overlay rectangle for tinting
    // Use a graphics object on top of everything
    this.overlay = scene.add.rectangle(0, 0, 1, 1, 0x000000, 0)
      .setOrigin(0)
      .setDepth(100)
      .setScrollFactor(0);

    this.resizeOverlay();
    scene.scale.on('resize', () => this.resizeOverlay());

    // Emit initial state
    this.emitTimeUpdate();
  }

  resizeOverlay() {
    const { width, height } = this.scene.scale;
    this.overlay.setSize(width, height);
  }

  getTimeOfDay() {
    return (this.elapsed % this.dayDuration) / this.dayDuration;
  }

  getCurrentPeriod(t) {
    const periods = DAY_CYCLE.periods;
    for (const [name, range] of Object.entries(periods)) {
      if (t >= range.start && t < range.end) return name;
    }
    return 'night';
  }

  /**
   * Lerp between two period tints based on position within transition zone.
   */
  getTint(t) {
    const periods = DAY_CYCLE.periods;
    const periodNames = Object.keys(periods);
    const currentIdx = periodNames.indexOf(this.getCurrentPeriod(t));
    const current = periodNames[currentIdx];
    const currentRange = periods[current];

    const tintA = PERIOD_TINTS[current];

    // Calculate blend toward next period in the last 20% of current period
    const periodLength = currentRange.end - currentRange.start;
    const progressInPeriod = (t - currentRange.start) / periodLength;
    const transitionStart = 0.8;

    if (progressInPeriod < transitionStart) {
      return tintA;
    }

    const nextIdx = (currentIdx + 1) % periodNames.length;
    const tintB = PERIOD_TINTS[periodNames[nextIdx]];
    const blendFactor = (progressInPeriod - transitionStart) / (1 - transitionStart);

    return {
      r: Math.round(tintA.r + (tintB.r - tintA.r) * blendFactor),
      g: Math.round(tintA.g + (tintB.g - tintA.g) * blendFactor),
      b: Math.round(tintA.b + (tintB.b - tintA.b) * blendFactor),
      alpha: tintA.alpha + (tintB.alpha - tintA.alpha) * blendFactor,
    };
  }

  emitTimeUpdate() {
    EventBridge.emit('time:updated', {
      period: this.currentPeriod,
      icon: PERIOD_ICONS[this.currentPeriod],
      dayCount: this.dayCount,
      timeOfDay: this.getTimeOfDay(),
    });
  }

  update(delta) {
    this.elapsed += delta;

    // Check for new day
    if (this.elapsed >= this.dayDuration) {
      this.elapsed -= this.dayDuration;
      this.dayCount++;
    }

    const t = this.getTimeOfDay();
    const newPeriod = this.getCurrentPeriod(t);

    if (newPeriod !== this.currentPeriod) {
      this.currentPeriod = newPeriod;
      this.emitTimeUpdate();
    }

    // Update overlay tint
    const tint = this.getTint(t);
    const color = Phaser.Display.Color.GetColor(tint.r, tint.g, tint.b);
    this.overlay.setFillStyle(color, tint.alpha);
  }

  destroy() {
    if (this.overlay) {
      this.overlay.destroy();
      this.overlay = null;
    }
  }
}
