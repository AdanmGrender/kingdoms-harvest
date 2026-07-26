/**
 * boostService — Boost ×2 producción (F3 idle, sink de gemas).
 *
 * ⚠️ INVARIANTE: el multiplicador que devuelve `getMultiplier` SOLO se aplica
 *    a la GANANCIA DE RECURSOS (farm yield en farmService, oro de venta en
 *    commerceService) — junto a los multiplicadores de event/storm existentes
 *    en esos mismos call sites. JAMÁS se aplica al monto pasado a
 *    `tokenService.awardTokens` (KH es retirable a TON — inflarlo con un sink
 *    de gemas rompería la invariante de dinero de CLAUDE.md §7.2b).
 *
 * Modelo (espejo de stormService.getModifier, pero por-jugador en vez de
 * global): caché simple Map player→{mult, ts} TTL 30s para no pegarle a la
 * DB en cada cosecha/venta. `buy()` invalida la entrada del jugador.
 *
 * Fila UNIQUE en player_boosts por player_id — no apilable: comprar con un
 * boost activo extiende `expires_at` en `hours` más (nunca resetea a menos).
 * Costo/duración/multiplicador SIEMPRE del catálogo (`GEM_SINKS.production_boost`),
 * nunca del request.
 */
const db = require('../config/database');
const gemService = require('./gemService');
const { GEM_SINKS } = require('../../../shared/shopConfig');

const CACHE_TTL_MS = 30 * 1000;
const cache = new Map(); // playerId -> { mult, ts }

const boostService = {
  _invalidate(playerId) {
    cache.delete(playerId);
  },

  /**
   * Compra/extiende el boost de producción. Gasto de gemas + upsert de la
   * fila en UNA transacción (patrón `_clearNode`): si el upsert falla tras
   * gastar, el rollback devuelve las gemas también.
   */
  async buy(playerId) {
    const sink = GEM_SINKS.production_boost;
    const durationMs = sink.hours * 60 * 60 * 1000;

    return db.transaction(async () => {
      // Gasto atómico (decrementIfEnough) — throw si no alcanza, sin tocar la fila.
      await gemService.spend(playerId, sink.costGems, 'production_boost');

      const existing = await db('player_boosts').where('player_id', playerId).first();
      const now = Date.now();
      const base = existing && new Date(existing.expires_at).getTime() > now
        ? new Date(existing.expires_at).getTime()
        : now;
      const expiresAt = new Date(base + durationMs).toISOString();

      if (existing) {
        await db('player_boosts').where('player_id', playerId).update({
          boost_id: sink.id,
          expires_at: expiresAt,
        });
      } else {
        try {
          await db('player_boosts').insert({ player_id: playerId, boost_id: sink.id, expires_at: expiresAt });
        } catch {
          // Carrera: otra llamada ya insertó la fila (UNIQUE player_id) — seguimos como update.
          await db('player_boosts').where('player_id', playerId).update({
            boost_id: sink.id,
            expires_at: expiresAt,
          });
        }
      }

      this._invalidate(playerId);
      return { expiresAt };
    });
  },

  /** Estado del boost del jugador (para la UI de la tienda). */
  async getState(playerId) {
    const row = await db('player_boosts').where('player_id', playerId).first();
    const active = !!(row && new Date(row.expires_at).getTime() > Date.now());
    return { active, expiresAt: active ? row.expires_at : null };
  },

  /**
   * Multiplicador de producción vigente para el jugador (2 activo, 1 si no).
   * `key` reservado para futuros boosts con distinto catálogo — hoy solo
   * existe 'production'.
   */
  async getMultiplier(playerId, key = 'production') {
    const cached = cache.get(playerId);
    if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.mult;

    const row = await db('player_boosts').where('player_id', playerId).first();
    const active = !!(row && new Date(row.expires_at).getTime() > Date.now());
    const mult = active && key === 'production' ? GEM_SINKS.production_boost.mult : 1;

    cache.set(playerId, { mult, ts: Date.now() });
    return mult;
  },
};

module.exports = boostService;
