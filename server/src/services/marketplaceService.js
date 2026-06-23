/**
 * P2P marketplace — players list their resources for sale at a gold price.
 *
 * Resources are **escrowed** (decremented from seller's inventory at list
 * time) so a successful buy is a pure transfer. On cancel/expire the
 * remaining quantity is refunded back to the seller.
 *
 * Buyers pay gold; the seller receives gold minus a 5% market fee. The
 * seller also earns KH tokens via tokenService — same path as caravan
 * sales — so big traders compound up.
 */
const db = require('../config/database');
const { RESOURCES } = require('../../../shared/gameConfig');
const { TOKEN_CONFIG } = require('../../../shared/tokenConfig');
const playerService = require('./playerService');
const tokenService = require('./tokenService');
const dailyTaskService = require('./dailyTaskService');
const achievementService = require('./achievementService');
const eventService = require('./eventService');
const notifyService = require('./notifyService');

const MARKET_FEE = 0.05;        // 5% taken from seller's gold proceeds
const LISTING_TTL_MS = 24 * 60 * 60 * 1000;  // 24h
const MAX_ACTIVE_PER_SELLER = 5;
const MAX_PRICE_PER_UNIT = 1_000_000;

const marketplaceService = {
  /** Public list — active listings only, joined with seller display_name. */
  async listActive() {
    const rows = await db('marketplace_listings').where('status', 'active');
    if (rows.length === 0) return [];
    const sellerIds = [...new Set(rows.map((r) => r.seller_id))];
    const sellers = await db('players')
      .select('telegram_id', 'display_name', 'level')
      .whereIn('telegram_id', sellerIds);
    const sellerMap = new Map(sellers.map((s) => [s.telegram_id, s]));
    return rows.map((r) => ({
      id: r.id,
      seller_id: r.seller_id,
      seller_name: sellerMap.get(r.seller_id)?.display_name || 'Anónimo',
      seller_level: sellerMap.get(r.seller_id)?.level || 1,
      resource_id: r.resource_id,
      quantity_remaining: r.quantity_remaining,
      price_per_unit: r.price_per_unit,
      total_price: r.price_per_unit * r.quantity_remaining,
      created_at: r.created_at,
      expires_at: r.expires_at,
    }));
  },

  /** Listings owned by one player (any status). */
  async listMine(playerId) {
    return db('marketplace_listings')
      .where('seller_id', playerId)
      .orderBy('id', 'desc')
      .limit(20);
  },

  /** Create a new listing, escrowing the resources. */
  async createListing(playerId, resourceId, quantity, pricePerUnit) {
    if (!RESOURCES?.[resourceId]) throw new Error('Recurso inválido');
    const qty = parseInt(quantity, 10);
    const price = parseInt(pricePerUnit, 10);
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Cantidad inválida');
    if (!Number.isInteger(price) || price < 1 || price > MAX_PRICE_PER_UNIT) {
      throw new Error('Precio inválido');
    }
    if (resourceId === 'gold') throw new Error('No podés vender oro por oro');

    const active = await db('marketplace_listings')
      .where({ seller_id: playerId, status: 'active' })
      .count('* as count');
    const activeCount = Array.isArray(active) ? (active[0]?.count || 0) : 0;
    if (activeCount >= MAX_ACTIVE_PER_SELLER) {
      throw new Error(`Máximo ${MAX_ACTIVE_PER_SELLER} listados activos por jugador`);
    }

    // Escrow: decrement seller's resource (atomic via modifyResource)
    try {
      await playerService.modifyResource(playerId, resourceId, -qty);
    } catch {
      throw new Error(`No tenés ${qty}x ${resourceId} disponibles`);
    }

    const now = new Date();
    const expires = new Date(now.getTime() + LISTING_TTL_MS);
    const [id] = await db('marketplace_listings').insert({
      seller_id: playerId,
      resource_id: resourceId,
      quantity: qty,
      quantity_remaining: qty,
      price_per_unit: price,
      status: 'active',
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
    });

    return {
      success: true,
      listingId: id,
      message: `Listado: ${qty}x ${resourceId} a ${price} oro c/u`,
    };
  },

  /** Buy from a listing (full or partial). */
  async buyFromListing(buyerId, listingId, quantity) {
    const qty = parseInt(quantity, 10);
    if (!Number.isInteger(qty) || qty < 1) throw new Error('Cantidad inválida');

    const listing = await db('marketplace_listings').where('id', listingId).first();
    if (!listing) throw new Error('Listado no encontrado');
    if (listing.status !== 'active') throw new Error('Listado ya no disponible');
    if (listing.seller_id === buyerId) throw new Error('No podés comprar tu propio listado');
    if (qty > listing.quantity_remaining) {
      throw new Error(`Solo quedan ${listing.quantity_remaining}`);
    }

    const totalGold = listing.price_per_unit * qty;
    // Seller's net: base 95% minus market fee, plus seasonal commerce event
    // bonus on top (so a 20% event roughly cancels the fee + adds extra).
    const eventBonus = await eventService.getMultiplier('commerce');
    const sellerGold = Math.floor(totalGold * (1 - MARKET_FEE + eventBonus));

    // Charge buyer (atomic). Refund the listing if charge fails.
    try {
      await playerService.modifyResource(buyerId, 'gold', -totalGold);
    } catch {
      throw new Error(`Necesitás ${totalGold} oro`);
    }

    // Transfer
    await playerService.modifyResource(buyerId, listing.resource_id, qty);
    await playerService.modifyResource(listing.seller_id, 'gold', sellerGold);

    // Decrement remaining; auto-mark sold if drained
    const newRemaining = listing.quantity_remaining - qty;
    await db('marketplace_listings').where('id', listingId).update({
      quantity_remaining: newRemaining,
      status: newRemaining === 0 ? 'sold' : 'active',
    });

    // Append-only price log — feeds the history endpoint. Decoupled from
    // listings so cancellations/expirations don't pollute the time series.
    try {
      await db('marketplace_price_log').insert({
        resource_id: listing.resource_id,
        price_per_unit: listing.price_per_unit,
        quantity: qty,
        sold_at: new Date().toISOString(),
      });
    } catch {}

    // Reward seller — sales count toward daily task + achievement
    try {
      const tokenResult = await tokenService.awardTokens(
        listing.seller_id, TOKEN_CONFIG.TOKENS_PER_SALE, 'p2p_sale',
      );
      await dailyTaskService.trackProgress(listing.seller_id, 'sell');
      achievementService.checkAndUnlock(listing.seller_id, 'sell', 1).catch(() => {});

      // DM the seller — closes the asynchronous loop. They listed something
      // and a stranger bought it; otherwise they'd only learn at next login.
      const sellerLine = newRemaining === 0
        ? `🛒 ¡Vendiste todo! ${qty}× ${listing.resource_id} → +${sellerGold} oro (${tokenResult?.awarded || 0} KH).`
        : `🛒 Alguien compró ${qty}× ${listing.resource_id} → +${sellerGold} oro. Quedan ${newRemaining} en tu listado.`;
      notifyService.sendBotDM(listing.seller_id, sellerLine);

      return {
        success: true,
        bought: qty,
        spent: totalGold,
        message: `Compraste ${qty}x ${listing.resource_id} por ${totalGold} oro`,
        sellerTokens: tokenResult?.awarded || 0,
      };
    } catch {
      return { success: true, bought: qty, spent: totalGold, message: `Compraste ${qty}x ${listing.resource_id}` };
    }
  },

  /** Seller cancels — refunds remaining to inventory. */
  async cancelListing(playerId, listingId) {
    const listing = await db('marketplace_listings').where('id', listingId).first();
    if (!listing) throw new Error('Listado no encontrado');
    if (listing.seller_id !== playerId) throw new Error('No es tu listado');
    if (listing.status !== 'active') throw new Error('Listado ya no está activo');

    if (listing.quantity_remaining > 0) {
      await playerService.modifyResource(playerId, listing.resource_id, listing.quantity_remaining);
    }
    await db('marketplace_listings').where('id', listingId).update({
      status: 'cancelled',
      quantity_remaining: 0,
    });

    return { success: true, message: 'Listado cancelado, recursos devueltos' };
  },

  /**
   * Last N completed sales for a resource. Used by the price-history
   * sparkline. Sorted oldest → newest so the chart can plot left-to-right.
   */
  async getPriceHistory(resourceId, limit = 30) {
    if (!RESOURCES?.[resourceId]) return [];
    const cap = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
    const rows = await db('marketplace_price_log')
      .where('resource_id', resourceId)
      .orderBy('id', 'desc')
      .limit(cap);
    return rows.reverse().map((r) => ({
      price_per_unit: r.price_per_unit,
      quantity: r.quantity,
      sold_at: r.sold_at,
    }));
  },

  /**
   * Tick hook — expire active listings past their TTL, refund remaining
   * to the seller. Idempotent.
   */
  async expireListings() {
    const now = new Date().toISOString();
    const expired = await db('marketplace_listings')
      .where('status', 'active')
      .where('expires_at', '<=', now);

    for (const listing of expired) {
      try {
        if (listing.quantity_remaining > 0) {
          await playerService.modifyResource(listing.seller_id, listing.resource_id, listing.quantity_remaining);
        }
        await db('marketplace_listings').where('id', listing.id).update({
          status: 'expired',
          quantity_remaining: 0,
        });
      } catch (err) {
        console.error(`[Market] Error expiring listing ${listing.id}:`, err.message);
      }
    }
    return expired.length;
  },
};

module.exports = marketplaceService;
