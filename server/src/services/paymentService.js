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

    const chargeId = sp.telegram_payment_charge_id;
    // Sin charge_id no hay clave de idempotencia ni forma de reconciliar: es un
    // caso patológico (Telegram siempre lo manda). Se lanza para que el bot lo
    // loguee fuerte; no hay nada seguro que persistir.
    if (!chargeId) throw new Error('Falta telegram_payment_charge_id');

    let payload = {};
    try { payload = JSON.parse(sp.invoice_payload || '{}'); } catch { /* payload roto */ }
    const productId = payload.prod;
    const pack = GEM_PACKS[productId];
    const gems = pack ? packGems(productId) : 0;

    // Acreditable SOLO si el producto es del catálogo, la moneda es XTR y el
    // monto pagado coincide con el precio del catálogo (M2: un mismatch NO se
    // acredita — pre_checkout ya lo debería haber frenado, pero es la última
    // línea). Todo lo demás se REGISTRA para revisión humana (A1), nunca se
    // pierde el pago en silencio.
    const creditable = !!pack && sp.currency === 'XTR' && sp.total_amount === pack.stars;
    const status = creditable ? 'completed' : 'needs_review';

    try {
      await db.transaction(async () => {
        // El UNIQUE de charge_id ES el guard de idempotencia: un replay revienta
        // acá y hace ROLLBACK antes de acreditar nada. La fila se persiste SIEMPRE
        // (creditable o no) → todo pago queda reconciliable.
        await db('star_payments').insert({
          player_id: payerId,
          product_id: productId || 'unknown',
          stars: sp.total_amount,
          gems_credited: creditable ? gems : 0,
          telegram_payment_charge_id: chargeId,
          status,
          created_at: new Date().toISOString(),
        });
        if (creditable) {
          // Participa de la MISMA transacción (trx === db en este builder):
          // o queda la fila + las gemas, o no queda ninguna.
          await gemService.credit(payerId, gems);
        }
      });
    } catch (err) {
      // A2: NO confiar en el texto del error. Solo es un duplicado real si la
      // fila del charge_id YA existe; cualquier otra violación de UNIQUE (p.ej.
      // player_gems) se re-lanza para que el bot la registre, no se traga.
      const existing = await db('star_payments')
        .where('telegram_payment_charge_id', chargeId).first();
      if (existing) {
        console.log(`[Pay] charge ${chargeId} ya procesado — sin doble crédito`);
        return { duplicate: true };
      }
      throw err;
    }

    // M1: el pago YA se cobró. saveToDisk está debounceado 2s → un kill duro
    // (OOM/SIGKILL) en esa ventana borraría el crédito y hasta el registro.
    // En el camino del dinero forzamos el flush inmediato.
    try { db.flushNow(); } catch (e) { console.error('[Pay] flushNow falló:', e.message); }

    if (!creditable) {
      console.warn(`[Pay] pago en needs_review: player ${payerId}, prod=${productId}, ${sp.total_amount}⭐, currency=${sp.currency} (registrado, sin acreditar)`);
      return { needsReview: true, reason: !pack ? 'producto desconocido' : 'monto/moneda no coincide' };
    }

    const { balance } = await gemService.getBalance(payerId);
    console.log(`[Pay] player ${payerId} compró ${productId}: +${gems} gemas (${sp.total_amount}⭐)`);
    return { credited: gems, balance };
  },

  /**
   * A3 — Reembolso de Stars. Telegram manda un `message` con `refunded_payment`
   * (la librería no emite un evento dedicado). Marca el pago como reembolsado y
   * DEBITA las gemas otorgadas (permitiendo saldo negativo: si el jugador ya las
   * gastó, queda en deuda y no puede volver a comprar-gastar-reembolsar). Sin
   * esto: comprar → gastar al instante → reembolsar → quedarse con todo.
   * Idempotente por telegram_payment_charge_id.
   */
  async handleRefund(msg) {
    const rp = msg && msg.refunded_payment;
    const payerId = msg && msg.from && msg.from.id;
    if (!rp || !payerId) return { ignored: true };

    const chargeId = rp.telegram_payment_charge_id;
    if (!chargeId) return { ignored: true };

    const row = await db('star_payments')
      .where('telegram_payment_charge_id', chargeId).first();
    if (!row) {
      console.warn(`[Pay] refund de un charge desconocido: ${chargeId}`);
      return { ignored: true };
    }
    if (row.status === 'refunded') return { duplicate: true }; // idempotente

    const gemsToClaw = row.gems_credited || 0;
    await db.transaction(async () => {
      await db('star_payments')
        .where({ telegram_payment_charge_id: chargeId })
        .update({ status: 'refunded' });
      if (gemsToClaw > 0) {
        // Débito directo (permite negativo a propósito): el saldo negativo
        // bloquea gastar hasta saldar la deuda; getBalance lo refleja.
        await gemService.ensureRecord(row.player_id);
        await db('player_gems').where('player_id', row.player_id).update({
          balance:    db.raw('balance - ?', [gemsToClaw]),
          updated_at: new Date().toISOString(),
        });
      }
    });
    // Camino del dinero: persistir ya (ver M1 arriba).
    try { db.flushNow(); } catch (e) { console.error('[Pay] flushNow falló:', e.message); }

    console.warn(`[Pay] REEMBOLSO player ${row.player_id}: charge ${chargeId}, −${gemsToClaw} gemas`);
    return { refunded: true, clawedBack: gemsToClaw };
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
