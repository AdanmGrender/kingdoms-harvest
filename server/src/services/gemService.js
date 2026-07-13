const db = require('../config/database');

/**
 * gemService — moneda premium (Gemas 💎) de UN SOLO SENTIDO.
 *
 * ⚠️ INVARIANTE: las gemas entran comprándose con Telegram Stars (dinero real)
 *    y salen gastándose DENTRO del juego. NO existe —ni debe existir— ninguna
 *    función que convierta gemas a KH Tokens ni a TON. KH es retirable a dinero
 *    real; una ruta gemas→KH haría del juego una casa de cambio (lavado +
 *    regulatorio + baneo del bot). Ver shared/shopConfig.js.
 *
 * `credit()` es de uso EXCLUSIVO de paymentService tras un pago CONFIRMADO por
 * Telegram (successful_payment). Ninguna ruta HTTP puede acreditar gemas.
 */
const gemService = {
  async ensureRecord(playerId) {
    const existing = await db('player_gems').where('player_id', playerId).first();
    if (!existing) {
      await db('player_gems').insert({
        player_id: playerId,
        balance: 0,
        total_purchased: 0,
        total_spent: 0,
        updated_at: new Date().toISOString(),
      });
    }
  },

  async getBalance(playerId) {
    await this.ensureRecord(playerId);
    const row = await db('player_gems').where('player_id', playerId).first();
    return {
      balance: row?.balance ?? 0,
      totalPurchased: row?.total_purchased ?? 0,
      totalSpent: row?.total_spent ?? 0,
    };
  },

  /**
   * Acreditar gemas. SOLO llamado por paymentService con un pago ya confirmado
   * e idempotente (charge_id UNIQUE). No exponer por HTTP.
   */
  async credit(playerId, amount) {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Monto de gemas inválido');
    }
    await this.ensureRecord(playerId);
    await db('player_gems').where('player_id', playerId).update({
      balance:         db.raw('balance + ?', [amount]),
      total_purchased: db.raw('total_purchased + ?', [amount]),
      updated_at:      new Date().toISOString(),
    });
    const row = await db('player_gems').where('player_id', playerId).first();
    return { balance: row.balance };
  },

  /**
   * Gastar gemas de forma ATÓMICA: decrementIfEnough solo actualiza si
   * balance >= amount (un único statement) → sin doble gasto bajo concurrencia.
   * @throws si no alcanza el saldo.
   */
  async spend(playerId, amount, reason = 'unknown') {
    if (!Number.isInteger(amount) || amount <= 0) {
      throw new Error('Monto de gemas inválido');
    }
    await this.ensureRecord(playerId);

    const affected = await db('player_gems')
      .where('player_id', playerId)
      .decrementIfEnough('balance', amount);
    if (!affected) throw new Error('No tenés suficientes gemas');

    await db('player_gems').where('player_id', playerId).update({
      total_spent: db.raw('total_spent + ?', [amount]),
      updated_at:  new Date().toISOString(),
    });

    const row = await db('player_gems').where('player_id', playerId).first();
    console.log(`[Gems] player ${playerId} gastó ${amount} gemas (${reason})`);
    return { spent: amount, balance: row.balance };
  },
};

module.exports = gemService;
