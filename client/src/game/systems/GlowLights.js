/**
 * GlowLights — luces puntuales falsas (Phaser no tiene luces reales en 2D
 * canvas y no usamos postFX). El truco de las referencias: un sprite radial
 * blanco con blend ADD + tint del color de la luz + tween de parpadeo.
 * Patrón modelado en el glow de WorldEventSystem._createActiveMarker.
 *
 * Uso:
 *   import { addGlow } from '../systems/GlowLights';
 *   const light = addGlow(scene, x, y, { color: 0xe8933a, radius: 34 });
 *   light.destroy(); // al limpiar
 *
 * La luz vive en coordenadas de MUNDO (acompaña el scroll), depth por defecto
 * justo sobre los edificios.
 */
import Phaser from 'phaser';

const GLOW_KEY = 'glow_radial';

function ensureGlowTexture(scene) {
  if (scene.textures.exists(GLOW_KEY)) return;
  const size = 128;
  const canvas = scene.textures.createCanvas(GLOW_KEY, size, size);
  const ctx = canvas.getContext();
  const g = ctx.createRadialGradient(
    size / 2, size / 2, 0,
    size / 2, size / 2, size / 2,
  );
  // Núcleo brillante compacto + halo suave largo → lee como "luz" real, no
  // como una mancha uniforme. El tint pone el color.
  g.addColorStop(0.0,  'rgba(255,255,255,1.0)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.85)');
  g.addColorStop(0.35, 'rgba(255,255,255,0.30)');
  g.addColorStop(0.7,  'rgba(255,255,255,0.08)');
  g.addColorStop(1.0,  'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  canvas.refresh();
}

/**
 * Charco de luz en el SUELO — elipse achatada (2:1 iso) con blend ADD que
 * derrama el color de la luz sobre el piso, como en las referencias grimdark.
 * Depth bajo (sobre el terreno, bajo edificios/personajes).
 * @returns {{ sprite, destroy() }}
 */
export function addGroundGlow(scene, x, y, opts = {}) {
  const { color = 0xe8933a, radius = 46, depth = 2, alpha = 0.4, flicker = true } = opts;
  ensureGlowTexture(scene);
  const sprite = scene.add.image(x, y, GLOW_KEY)
    .setDisplaySize(radius * 2, radius)   // achatado 2:1 → charco iso en el piso
    .setTint(color)
    .setAlpha(alpha)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(depth);

  let tween = null;
  if (flicker) {
    tween = scene.tweens.add({
      targets: sprite,
      alpha: { from: alpha * 0.7, to: alpha },
      duration: 900 + Math.random() * 600,
      yoyo: true, repeat: -1, ease: 'Sine.easeInOut',
    });
  }
  return { sprite, destroy() { if (tween) tween.remove(); sprite.destroy(); } };
}

/**
 * Contorno/rim-glow fino para que un personaje resalte del piso oscuro
 * grimdark. Usa el pipeline FX (WebGL) sobre el propio sprite → sigue la
 * silueta animada sola. No-op si no hay preFX (fallback canvas).
 * @param {Phaser.GameObjects.Sprite} sprite
 * @param {object} opts { color, strength, quality, distance }
 * @returns {Phaser.FX.Glow|null}
 */
export function addRimGlow(sprite, opts = {}) {
  // distance corto + strength moderado → rim ceñido a la silueta (no un halo
  // ancho). Color cálido pálido que casa con la paleta de velas grimdark.
  const { color = 0xffe6b8, strength = 4, quality = 0.4, distance = 6 } = opts;
  if (!sprite || !sprite.preFX) return null;
  return sprite.preFX.addGlow(color, strength, 0, false, quality, distance);
}

/**
 * @param {Phaser.Scene} scene
 * @param {number} x — mundo
 * @param {number} y — mundo
 * @param {object} opts { color, radius, flicker, depth, alpha }
 * @returns {{ sprite, destroy() }}
 */
export function addGlow(scene, x, y, opts = {}) {
  const {
    color = 0xe8933a,   // naranja vela por defecto
    radius = 34,
    flicker = true,
    depth = 950,        // sobre edificios, bajo tinte día/noche NO — el tinte
                        // está a depth 100 scrollFactor 0; las luces son de
                        // mundo, quedan bajo la viñeta (9500) como debe ser
    alpha = 0.55,
  } = opts;

  ensureGlowTexture(scene);
  const sprite = scene.add.image(x, y, GLOW_KEY)
    .setDisplaySize(radius * 2, radius * 2)
    .setTint(color)
    .setAlpha(alpha)
    .setBlendMode(Phaser.BlendModes.ADD)
    .setDepth(depth);

  let tween = null;
  if (flicker) {
    tween = scene.tweens.add({
      targets: sprite,
      alpha: { from: alpha * 0.55, to: alpha },
      scaleX: sprite.scaleX * 1.12,
      scaleY: sprite.scaleY * 1.12,
      duration: 700 + Math.random() * 500, // desincronizar velas entre sí
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  return {
    sprite,
    destroy() {
      if (tween) tween.remove();
      sprite.destroy();
    },
  };
}
