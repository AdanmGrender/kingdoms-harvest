/**
 * AmbientSystem — capa de ambiente grimdark, agnóstica de escena.
 *
 * Dos piezas (ambas opcionales):
 *  - Cielo tormenta: backdrop fijo a cámara (scrollFactor 0, depth muy bajo)
 *    con la textura 'sky_storm' (assets/game/ambient/sky_storm.png). Se ve en
 *    todo lo que quede fuera del suelo del mundo.
 *  - Viñeta: bordes oscurecidos como el marco de las referencias de arte.
 *    Textura radial generada en runtime (cero assets), scrollFactor 0,
 *    depth 9500 — por encima del mundo y del tinte día/noche (depth 100),
 *    por debajo de flotantes críticos (10000+).
 *
 * Uso:  this.ambient = new AmbientSystem(this, { sky: true, vignette: true });
 *       // en shutdown/destroy de la escena: this.ambient.destroy();
 */
const VIGNETTE_KEY = 'ambient_vignette';
const SKY_KEY = 'sky_storm';

function ensureVignetteTexture(scene) {
  if (scene.textures.exists(VIGNETTE_KEY)) return;
  const size = 512;
  const canvas = scene.textures.createCanvas(VIGNETTE_KEY, size, size);
  const ctx = canvas.getContext();
  // Transparente al centro → oscuro en los bordes (radial)
  const g = ctx.createRadialGradient(
    size / 2, size / 2, size * 0.30,
    size / 2, size / 2, size * 0.72,
  );
  g.addColorStop(0, 'rgba(10, 8, 12, 0)');
  g.addColorStop(0.7, 'rgba(10, 8, 12, 0.45)');
  g.addColorStop(1, 'rgba(10, 8, 12, 0.85)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  canvas.refresh();
}

export default class AmbientSystem {
  /**
   * Preferencia del jugador (SettingsPanel → localStorage 'kh_ambient_fx').
   * Las escenas la consultan al crear ambiente/glows; el toggle en caliente
   * pide recarga (el aviso lo da SettingsPanel).
   */
  static enabledInSettings() {
    try {
      const v = localStorage.getItem('kh_ambient_fx');
      return v === null ? true : JSON.parse(v) === true;
    } catch { return true; }
  }

  constructor(scene, { sky = true, vignette = true } = {}) {
    this.scene = scene;
    this.sky = null;
    this.vignette = null;

    if (sky && scene.textures.exists(SKY_KEY)) {
      this.sky = scene.add.image(0, 0, SKY_KEY)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(-100);
    }

    if (vignette) {
      ensureVignetteTexture(scene);
      this.vignette = scene.add.image(0, 0, VIGNETTE_KEY)
        .setOrigin(0, 0)
        .setScrollFactor(0)
        .setDepth(9500)
        .setAlpha(0.9);
    }

    this._onResize = () => this.resize();
    scene.scale.on('resize', this._onResize);
    this.resize();
  }

  resize() {
    const { width, height } = this.scene.scale;
    if (this.sky) this.sky.setDisplaySize(width, height);
    if (this.vignette) this.vignette.setDisplaySize(width, height);
  }

  destroy() {
    this.scene.scale.off('resize', this._onResize);
    if (this.sky) { this.sky.destroy(); this.sky = null; }
    if (this.vignette) { this.vignette.destroy(); this.vignette = null; }
  }
}
