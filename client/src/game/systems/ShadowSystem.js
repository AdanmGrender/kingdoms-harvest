/**
 * Simple drop-shadow helper — dark ellipse under sprites to fake ground contact.
 *
 * Kenney medieval tileset is flat top-down, so the scene feels like paper cutouts
 * without shadows. These ellipses sit just above the terrain depth (0) and below
 * any prop/character depth to add perceived height without needing a real light.
 */

const SHADOW_COLOR = 0x000000;

/**
 * Add a static shadow at a fixed position. Returns the ellipse so the caller
 * can destroy it later if needed.
 *
 * @param {Phaser.Scene} scene
 * @param {number} x center x (pixels)
 * @param {number} y baseline y — shadow is drawn offsetY pixels below this
 * @param {object} opts { width, height, alpha, depth, offsetY }
 */
export function addStaticShadow(scene, x, y, opts = {}) {
  const {
    width = 48,
    height = 14,
    alpha = 0.4,
    depth = 1,
    offsetY = 16,
  } = opts;
  const shadow = scene.add.ellipse(x, y + offsetY, width, height, SHADOW_COLOR, alpha);
  shadow.setDepth(depth);
  return shadow;
}

/**
 * Add a shadow that follows a Container child-style (added at container's local
 * origin). The shadow is inserted at index 0 so it renders below any other
 * container children.
 */
export function addContainerShadow(container, opts = {}) {
  const {
    width = 18,
    height = 6,
    alpha = 0.35,
    offsetY = 14,
  } = opts;
  const shadow = container.scene.add.ellipse(0, offsetY, width, height, SHADOW_COLOR, alpha);
  container.addAt(shadow, 0);
  return shadow;
}

/**
 * Add a tracked shadow that a mover updates every frame. Returns the ellipse;
 * the caller is responsible for updating `shadow.x`, `shadow.y` each tick
 * (cheap assignment, no setPosition overhead).
 */
export function addTrackedShadow(scene, target, opts = {}) {
  const {
    width = 16,
    height = 6,
    alpha = 0.35,
    offsetY = 12,
    depth,
  } = opts;
  const shadow = scene.add.ellipse(target.x, target.y + offsetY, width, height, SHADOW_COLOR, alpha);
  shadow.setDepth(depth ?? (target.depth || 0) - 1);
  shadow._shadowOffsetY = offsetY;
  return shadow;
}
