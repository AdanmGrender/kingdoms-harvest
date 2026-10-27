// RNG con semilla para el motor v2 (mulberry32). Sin estado oculto: el estado
// del generador es un uint32 que vive en `state.rng` del run (serializable).
// Nadie en `combat/` usa el generador del sistema: todo azar sale de acá.

// Avanza un paso. Devuelve el valor en [0,1) y el estado nuevo (uint32).
function nextFloat(rngState) {
  let a = (rngState >>> 0);
  a = (a + 0x6D2B79F5) | 0;
  let t = Math.imul(a ^ (a >>> 15), 1 | a);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, rng: a >>> 0 };
}

// Generador ligado a un `state` (ya clonado): cada float() consume un paso y
// deja el estado nuevo en `state.rng`.
function createRng(state) {
  return {
    float() {
      const r = nextFloat(state.rng);
      state.rng = r.rng;
      return r.value;
    },
  };
}

module.exports = { nextFloat, createRng };
