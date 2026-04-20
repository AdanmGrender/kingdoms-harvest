/**
 * Seeded PRNG utilities — deterministic per-player map generation.
 * Any value passed to the same seed will produce the same sequence.
 */

/** Mulberry32: small, fast 32-bit PRNG. Returns a [0, 1) generator. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a hash — convert any string/number to a uint32 seed. */
export function hashSeed(value) {
  const s = String(value);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** Convenience: build a PRNG from any seed value. */
export function rngFromSeed(value) {
  return mulberry32(hashSeed(value));
}

/** Integer in [min, max]. */
export function randInt(rng, min, max) {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
export function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length)];
}
