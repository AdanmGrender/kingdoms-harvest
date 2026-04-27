/**
 * Directional drop-shadow helper — dark elongated ellipse projected from
 * each sprite toward a fixed sun position. Kenney medieval is flat
 * top-down, so without shadows everything reads as paper cutouts; with
 * directional shadows the scene gains the suggestion of a low-angle sun
 * without paying the cost of real lighting.
 *
 * Convention: sun is NW, shadows project to SE.
 *   offsetX positive → shadow drifts east (right)
 *   offsetY positive → shadow drifts south (down)
 *   rotation positive (radians) → ellipse tilts CW from horizontal
 *
 * Tall objects (buildings, structures) get larger offsets + a small CW
 * rotation; flat objects (NPCs, bushes) keep tight offsets and stay
 * roughly horizontal so they still read as "feet shadows".
 */

const SHADOW_COLOR = 0x000000;

/**
 * Add a static shadow at a fixed position.
 *
 * @param {Phaser.Scene} scene
 * @param {number} x sprite center x (pixels)
 * @param {number} y sprite baseline y — shadow drawn at (x+offsetX, y+offsetY)
 * @param {object} opts { width, height, alpha, depth, offsetX, offsetY, rotation }
 */
export function addStaticShadow(scene, x, y, opts = {}) {
  const {
    width = 48,
    height = 14,
    alpha = 0.4,
    depth = 1,
    offsetX = 0,
    offsetY = 16,
    rotation = 0,
  } = opts;
  const shadow = scene.add.ellipse(x + offsetX, y + offsetY, width, height, SHADOW_COLOR, alpha);
  if (rotation) shadow.setRotation(rotation);
  shadow.setDepth(depth);
  return shadow;
}

/**
 * Add a shadow as a Container child (auto-moves with the container).
 * Inserted at index 0 so it draws below other children.
 */
export function addContainerShadow(container, opts = {}) {
  const {
    width = 18,
    height = 6,
    alpha = 0.35,
    offsetX = 0,
    offsetY = 14,
    rotation = 0,
  } = opts;
  const shadow = container.scene.add.ellipse(offsetX, offsetY, width, height, SHADOW_COLOR, alpha);
  if (rotation) shadow.setRotation(rotation);
  container.addAt(shadow, 0);
  return shadow;
}

/**
 * Add a tracked shadow that the caller updates each frame to keep up with
 * a moving target. Returns the ellipse with `_shadowOffsetX` and
 * `_shadowOffsetY` cached on it for cheap update reads.
 */
export function addTrackedShadow(scene, target, opts = {}) {
  const {
    width = 16,
    height = 6,
    alpha = 0.35,
    offsetX = 0,
    offsetY = 12,
    rotation = 0,
    depth,
  } = opts;
  const shadow = scene.add.ellipse(target.x + offsetX, target.y + offsetY, width, height, SHADOW_COLOR, alpha);
  if (rotation) shadow.setRotation(rotation);
  shadow.setDepth(depth ?? (target.depth || 0) - 1);
  shadow._shadowOffsetX = offsetX;
  shadow._shadowOffsetY = offsetY;
  return shadow;
}
