/**
 * shopConfig — economía de INGRESO (Telegram Stars → Gemas) y sumideros.
 *
 * ⚠️ INVARIANTE INNEGOCIABLE (regulatorio + ToS de Telegram Stars):
 *    Con dinero real SOLO se compran GEMAS (moneda premium de un sentido).
 *    JAMÁS se venden KH Tokens: KH es retirable a TON (dinero real), así que
 *    venderlo convertiría el juego en una casa de cambio (lavado + problema
 *    regulatorio + baneo del bot). Las gemas NO tienen ninguna ruta a KH/TON.
 *    Esta invariante está testeada (server/tests/paymentService.test.js).
 *
 * Telegram Stars: currency 'XTR', montos ENTEROS de Stars, provider_token ''.
 */

// Packs comprables con Stars. `stars` = precio en Telegram Stars (entero).
// El bonus premia los packs grandes (curva de valor clásica de F2P).
const GEM_PACKS = {
  pouch:  { id: 'pouch',  name: 'Bolsa de Gemas',    gems: 100,  stars: 50,   bonus: 0    },
  chest:  { id: 'chest',  name: 'Cofre de Gemas',    gems: 550,  stars: 250,  bonus: 0.10 },
  vault:  { id: 'vault',  name: 'Bóveda de Gemas',   gems: 1200, stars: 500,  bonus: 0.20 },
  relic:  { id: 'relic',  name: 'Reliquia de Gemas', gems: 2600, stars: 1000, bonus: 0.30 },
};

/**
 * Sumideros de gemas (para qué sirven — si no sirven, nadie compra).
 * Todos consumen gemas y devuelven valor DENTRO del juego. Ninguno da KH.
 */
const GEM_SINKS = {
  // Terminar al instante una construcción/investigación/entrenamiento en curso.
  // Precio por minuto restante, con piso y techo (patrón estándar F2P).
  speedup: {
    id: 'speedup',
    name: 'Acelerar',
    gemsPerMinute: 1,
    minGems: 5,
    maxGems: 300,
  },
  // Invocación de héroe pagada con gemas (alternativa a KH/oro).
  hero_summon: {
    id: 'hero_summon',
    name: 'Invocación de Héroe',
    gems: 150,
  },
  // Recarga instantánea del cap de energía de oleadas / run extra.
  wave_retry: {
    id: 'wave_retry',
    name: 'Desafío extra de la Marea',
    gems: 60,
  },
};

/** Costo en gemas para acelerar `msRemaining` de un timer. */
function speedupCost(msRemaining) {
  const s = GEM_SINKS.speedup;
  const minutes = Math.ceil(Math.max(0, msRemaining) / 60000);
  return Math.min(s.maxGems, Math.max(s.minGems, minutes * s.gemsPerMinute));
}

/** Gemas totales que entrega un pack (base + bonus). */
function packGems(productId) {
  const p = GEM_PACKS[productId];
  if (!p) return 0;
  return Math.floor(p.gems * (1 + p.bonus));
}

module.exports = { GEM_PACKS, GEM_SINKS, speedupCost, packGems };
