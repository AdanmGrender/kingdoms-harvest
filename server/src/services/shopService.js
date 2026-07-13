const db = require('../config/database');
const gemService = require('./gemService');
const { speedupCost } = require('../../../shared/shopConfig');

/**
 * shopService — SUMIDEROS de gemas (para qué sirve comprarlas).
 *
 * ⚠️ Ningún sumidero devuelve KH ni TON: las gemas se consumen y entregan valor
 *    de juego (tiempo, invocaciones). Ver shared/shopConfig.js.
 *
 * Patrón de seguridad en todos: se calcula el costo SERVER-SIDE contra el estado
 * real (nunca se confía en un costo enviado por el cliente), se gasta con
 * `gemService.spend` (decrementIfEnough atómico) y RECIÉN después se aplica el
 * efecto. Si el gasto falla, no hay efecto.
 */
const shopService = {
  /**
   * Acelerar una construcción/mejora en curso: paga gemas según el tiempo
   * restante y la termina al instante.
   */
  async speedupBuilding(playerId, buildingDbId) {
    const b = await db('player_buildings')
      .where({ id: buildingDbId, player_id: playerId })
      .first();
    if (!b) throw new Error('Edificio no encontrado');
    if (!b.is_building) throw new Error('Ese edificio no está en construcción');

    const remainingMs = new Date(b.build_complete_at).getTime() - Date.now();
    if (remainingMs <= 0) throw new Error('La construcción ya terminó');

    // Costo calculado SERVER-SIDE contra el tiempo real restante.
    const cost = speedupCost(remainingMs);

    // Gasto atómico: si no alcanza, lanza y no se toca la construcción.
    const { balance } = await gemService.spend(playerId, cost, `speedup:building:${buildingDbId}`);

    // Terminar ya: el tick/lectura la dará por completa.
    await db('player_buildings').where({ id: buildingDbId, player_id: playerId }).update({
      is_building: false,
      build_complete_at: new Date().toISOString(),
    });

    return {
      success: true,
      buildingDbId,
      gemsSpent: cost,
      gemBalance: balance,
      message: `Construcción acelerada por ${cost} 💎`,
    };
  },

  /** Costo (sin gastar) para que la UI muestre el precio antes de confirmar. */
  async quoteSpeedupBuilding(playerId, buildingDbId) {
    const b = await db('player_buildings')
      .where({ id: buildingDbId, player_id: playerId })
      .first();
    if (!b || !b.is_building) return { available: false, cost: 0, remainingMs: 0 };

    const remainingMs = Math.max(0, new Date(b.build_complete_at).getTime() - Date.now());
    if (remainingMs <= 0) return { available: false, cost: 0, remainingMs: 0 };

    return { available: true, cost: speedupCost(remainingMs), remainingMs };
  },
};

module.exports = shopService;
