const crypto = require('crypto');
const db = require('../config/database');
const gemService = require('./gemService');
const { GEM_PACKS, packGems } = require('../../../shared/shopConfig');

/**
 * paymentService — INGRESO de dinero real vía Telegram Stars (currency 'XTR').
 *
 * ⚠️ SOLO se venden GEMAS. Nunca KH (retirable a TON) — ver shared/shopConfig.js.
 *
 * INVARIANTES DE SEGURIDAD DEL COBRO:
 *  1. Las gemas se acreditan ÚNICAMENTE desde el update `successful_payment`
 *     que manda Telegram al bot (server-side, firmado por Telegram). NINGUNA
 *     ruta HTTP puede acreditar gemas: el cliente no es fuente de verdad.
 *  2. IDEMPOTENCIA: `telegram_payment_charge_id` es UNIQUE. El insert del pago y
 *     el crédito de gemas ocurren en la MISMA transacción → un update repetido
 *     (reintento/replay de Telegram) revienta contra el UNIQUE, hace ROLLBACK y
 *     no acredita dos veces. Y si el proceso muere entre ambos, se revierte todo
 *     (nunca "pago registrado sin gemas" ni "gemas sin pago").
 *  3. El jugador acreditado es `msg.from.id` (el pagador REAL según Telegram),
 *     nunca el id que venga en el payload (que el cliente podría manipular).
 *  4. La cantidad de gemas sale del CATÁLOGO del server (packGems), nunca de lo
 *     que informe el mensaje.
 */
const paymentService = {
  /** Catálogo público de packs (para la tienda del cliente). */
  getCatalog() {
    return Object.values(GEM_PACKS).map((p) => ({
      id: p.id,
      name: p.name,
      stars: p.stars,
      gems: packGems(p.id),
      bonus: p.bonus,
    }));
  },

  /**
   * Crea el link de factura de Telegram Stars para un pack.
   * El cliente lo abre con Telegram.WebApp.openInvoice(link).
   */
  async createInvoice(playerId, productId) {
    const pack = GEM_PACKS[productId];
    if (!pack) throw new Error('Producto inválido');

    const { getBot } = require('../bot/telegramBot');
    const bot = getBot();
    if (!bot) throw new Error('Bot no disponible');

    const gems = packGems(productId);
    // El payload viaja a Telegram y vuelve en pre_checkout/successful_payment.
    // El playerId acá es solo informativo: al acreditar se usa msg.from.id.
    const payload = JSON.stringify({
      p: playerId,
      prod: productId,
      n: crypto.randomBytes(6).toString('hex'),
    });

    const link = await bot.createInvoiceLink(
      pack.name,
      `${gems} Gemas para tu bastión`,
      payload,
      '',      // provider_token vacío = Telegram Stars
      'XTR',   // moneda Stars
      [{ label: pack.name, amount: pack.stars }],
    );

    return { link, productId, stars: pack.stars, gems };
  },

  /**
   * pre_checkout_query — Telegram exige respuesta en < 10s o el pago falla.
   * Revalidamos producto/moneda/precio contra el catálogo del server.
   */
  async handlePreCheckout(query) {
    const { getBot } = require('../bot/telegramBot');
    const bot = getBot();
    if (!bot) return;

    try {
      const payload = JSON.parse(query.invoice_payload || '{}');
      const pack = GEM_PACKS[payload.prod];

      if (!pack) {
        return bot.answerPreCheckoutQuery(query.id, false, { error_message: 'Producto no disponible' });
      }
      if (query.currency !== 'XTR' || query.total_amount !== pack.stars) {
        return bot.answerPreCheckoutQuery(query.id, false, { error_message: 'El precio cambió, reabrí la tienda' });
      }
      return bot.answerPreCheckoutQuery(query.id, true);
    } catch (err) {
      console.error('[Pay] pre_checkout error:', err.message);
      try { await bot.answerPreCheckoutQuery(query.id, false, { error_message: 'Error de validación' }); } catch {}
    }
  },

  /**
   * successful_payment — ÚNICA fuente de verdad para acreditar gemas.
   * Idempotente y atómico (ver invariantes arriba).
   * @returns {{credited:number, balance:number}|{duplicate:true}}
   */
  async handleSuccessfulPayment(msg) {
    const sp = msg && msg.successful_payment;
    const payerId = msg && msg.from && msg.from.id;
    if (!sp || !payerId) throw new Error('successful_payment inválido');

    if (sp.currency !== 'XTR') throw new Error(`Moneda inesperada: ${sp.currency}`);

    const chargeId = sp.telegram_payment_charge_id;
    if (!chargeId) throw new Error('Falta telegram_payment_charge_id');

    let payload = {};
    try { payload = JSON.parse(sp.invoice_payload || '{}'); } catch { /* payload roto */ }
    const productId = payload.prod;
    const pack = GEM_PACKS[productId];
    if (!pack) throw new Error(`Producto desconocido en el pago: ${productId}`);

    // Las gemas salen del CATÁLOGO, no del mensaje. Si el monto pagado no
    // coincide con el catálogo (p.ej. cambio de precio en vuelo), se registra;
    // se acredita según el producto realmente comprado.
    const gems = packGems(productId);
    if (sp.total_amount !== pack.stars) {
      console.warn(`[Pay] monto ${sp.total_amount}⭐ != catálogo ${pack.stars}⭐ para ${productId}`);
    }

    try {
      await db.transaction(async () => {
        // El UNIQUE de charge_id ES el guard de idempotencia: un replay revienta
        // acá y hace ROLLBACK antes de acreditar nada.
        await db('star_payments').insert({
          player_id: payerId,
          product_id: productId,
          stars: sp.total_amount,
          gems_credited: gems,
          telegram_payment_charge_id: chargeId,
          status: 'completed',
          created_at: new Date().toISOString(),
        });
        // Participa de la MISMA transacción (trx === db en este builder).
        await gemService.credit(payerId, gems);
      });
    } catch (err) {
      if (/UNIQUE constraint/i.test(err.message)) {
        console.log(`[Pay] charge ${chargeId} ya procesado — sin doble crédito`);
        return { duplicate: true };
      }
      throw err;
    }

    const { balance } = await gemService.getBalance(payerId);
    console.log(`[Pay] player ${payerId} compró ${productId}: +${gems} gemas (${sp.total_amount}⭐)`);
    return { credited: gems, balance };
  },

  /** Historial de compras del jugador (solo columnas públicas). */
  async getPurchaseHistory(playerId) {
    return db('star_payments')
      .select('id', 'product_id', 'stars', 'gems_credited', 'status', 'created_at')
      .where('player_id', playerId)
      .orderBy('id', 'desc')
      .limit(20);
  },
};

module.exports = paymentService;
