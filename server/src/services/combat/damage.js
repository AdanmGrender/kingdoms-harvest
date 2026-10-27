// Mitigación por DEF del motor v2: daño = raw × K / (K + DEF).
// K viene de COMBAT.defK (el llamador lo pasa; acá no hay números de balance).
function mitigate(raw, def, K) {
  const d = Math.max(0, def || 0);
  // Con DEF 0 es exactamente el redondeo de v1 (sin pasar por el cociente).
  if (d === 0) return Math.round(raw);
  return Math.round((raw * K) / (K + d));
}

module.exports = { mitigate };
