/**
 * Niveles de calidad de la escena de combate (combate_b R46–R47, design §10).
 * Puro: sin Phaser. `low` no usa postFX ni PointLight; el defecto es `medium`.
 */
export const QUALITY_KEY = 'kh_combat_quality';
export const DEFAULT_QUALITY = 'medium';

export const QUALITY = {
  low: { name: 'low', lights: 0, postFX: false, vignette: false, bloom: false, maxParticles: 30 },
  medium: { name: 'medium', lights: 2, postFX: true, vignette: true, bloom: false, maxParticles: 80 },
  high: { name: 'high', lights: 4, postFX: true, vignette: true, bloom: true, maxParticles: 160 },
};

/** Lee `localStorage[kh_combat_quality]`; ausente, inválido o con storage que lanza → `medium`. */
export function resolveQuality(storage) {
  let raw = null;
  try {
    const st = storage !== undefined ? storage : (typeof localStorage !== 'undefined' ? localStorage : null);
    raw = st ? st.getItem(QUALITY_KEY) : null;
  } catch {
    raw = null;
  }
  return Object.prototype.hasOwnProperty.call(QUALITY, raw) ? QUALITY[raw] : QUALITY[DEFAULT_QUALITY];
}
