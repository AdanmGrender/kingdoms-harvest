const db = require('../config/database');

let _achievementService = null;
function getAchievementService() {
  if (!_achievementService) _achievementService = require('./achievementService');
  return _achievementService;
}

const TRADEABLE_RESOURCES = ['wheat', 'wood', 'stone', 'iron', 'bread'];
const MAX_LISTINGS_PER_PLAYER = 5;
const LISTING_DURATION_MS = 24 * 60 * 60 * 1000;
const MARKET_FEE = 0.05;
const MAX_QUANTITY = 1000;
const MAX_PRICE = 10000;

const marketService = {
  TRADEABLE_RESOURCES,

  async getListings({ resourceId = null, limit = 60 } = {}) {
    await this._expireOldListings();
    let query = db('market_listings')
      .where('status', 'active')
      .orderBy('created_at', 'desc')
      .limit(limit);
    if (resourceId) query = query.where('resource_id', resourceId);
    const rows = await query;
    return rows.map(this._format);
  },

  async getMyListings(playerId) {
    const rows = await db('market_listings')
      .where('seller_id', playerId)
      .orderBy('created_at', 'desc')
      .limit(100);
    return rows.map(this._format);
  },

  async createListing(playerId, resourceId, quantity, pricePerUnit) {
    if (!TRADEABLE_RESOURCES.includes(resourceId)) {
      throw new Error(`Recurso no comerciable. Permitidos: ${TRADEABLE_RESOURCES.join(', ')}`);
    }
    quantity = Math.floor(Number(quantity));
    pricePerUnit = Math.floor(Number(pricePerUnit));
    if (quantity < 1 || quantity > MAX_QUANTITY) throw new Error(`Cantidad inválida (1–${MAX_QUANTITY})`);
    if (pricePerUnit < 1 || pricePerUnit > MAX_PRICE) throw new Error(`Precio inválido (1–${MAX_PRICE} oro/u)`);

    // Expire old listings before checking the active limit
    await this._expireOldListingsForPlayer(playerId);

    const activeRow = await db('market_listings')
      .where({ seller_id: playerId, status: 'active' })
      .count('id as n')
      .first();
    if (Number(activeRow?.n || 0) >= MAX_LISTINGS_PER_PLAYER) {
      throw new Error(`Máximo ${MAX_LISTINGS_PER_PLAYER} ventas activas al mismo tiempo`);
    }

    // Atomically deduct resources
    const taken = await db('player_resources')
      .where({ player_id: playerId, resource_id: resourceId })
      .where('amount', '>=', quantity)
      .decrement('amount', quantity);
    if (!taken) throw new Error(`No tenés suficiente ${resourceId} (necesitás ${quantity})`);

    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + LISTING_DURATION_MS).toISOString();
    const [{ id }] = await db('market_listings').insert({
      seller_id:          playerId,
      resource_id:        resourceId,
      quantity,
      quantity_remaining: quantity,
      price_per_unit:     pricePerUnit,
      status:             'active',
      created_at:         now,
      expires_at:         expiresAt,
    }).returning('id');

    return {
      success: true,
      listingId: id,
      resourceId,
      quantity,
      pricePerUnit,
      expiresAt,
      message: `Publicaste ${quantity}x ${resourceId} a ${pricePerUnit} oro/u`,
    };
  },

  async buyListing(buyerId, listingId, quantity) {
    quantity = Math.floor(Number(quantity));
    const listing = await db('market_listings').where({ id: listingId, status: 'active' }).first();
    if (!listing) throw new Error('Oferta no disponible');
    if (Number(listing.seller_id) === Number(buyerId)) throw new Error('No podés comprarte a vos mismo');
    if (new Date(listing.expires_at) < new Date()) {
      await this._expireOneListing(listing);
      throw new Error('Esta oferta expiró');
    }
    if (quantity < 1 || quantity > listing.quantity_remaining) {
      throw new Error(`Cantidad inválida (disponible: ${listing.quantity_remaining})`);
    }

    const totalGold = quantity * listing.price_per_unit;
    const fee = Math.floor(totalGold * MARKET_FEE);
    const sellerReceives = totalGold - fee;

    // Atomically deduct gold from buyer
    const paid = await db('player_resources')
      .where({ player_id: buyerId, resource_id: 'gold' })
      .where('amount', '>=', totalGold)
      .decrement('amount', totalGold);
    if (!paid) throw new Error(`Necesitás ${totalGold} oro para esta compra`);

    // Give resources to buyer (upsert — row may not exist for less-common resources)
    await db.raw(
      `INSERT INTO "player_resources" ("player_id", "resource_id", "amount", "capacity")
       VALUES (?, ?, ?, 10000)
       ON CONFLICT ("player_id", "resource_id") DO UPDATE
       SET "amount" = "player_resources"."amount" + ?`,
      [buyerId, listing.resource_id, quantity, quantity]
    );

    // Pay seller (gold, upsert)
    if (sellerReceives > 0) {
      await db.raw(
        `INSERT INTO "player_resources" ("player_id", "resource_id", "amount", "capacity")
         VALUES (?, 'gold', ?, 10000)
         ON CONFLICT ("player_id", "resource_id") DO UPDATE
         SET "amount" = "player_resources"."amount" + ?`,
        [listing.seller_id, sellerReceives, sellerReceives]
      );
    }

    // Update listing
    const newRemaining = listing.quantity_remaining - quantity;
    const newStatus = newRemaining === 0 ? 'sold' : 'active';
    await db('market_listings').where('id', listingId).update({
      quantity_remaining: newRemaining,
      status: newStatus,
    });

    // Record transaction
    await db('market_transactions').insert({
      listing_id:     listingId,
      buyer_id:       buyerId,
      quantity_bought: quantity,
      total_price:    totalGold,
      fee,
      transacted_at:  new Date().toISOString(),
    });

    // Achievement hooks (non-blocking)
    try {
      await getAchievementService().checkAndUnlock(buyerId, 'market_buy', 1);
      await getAchievementService().checkAndUnlock(listing.seller_id, 'market_sell', 1);
    } catch { /* non-blocking */ }

    return {
      success: true,
      resourceId: listing.resource_id,
      quantity,
      totalGold,
      fee,
      sellerReceives,
      message: `Compraste ${quantity}x ${listing.resource_id} por ${totalGold} oro (comisión: ${fee} oro)`,
    };
  },

  async cancelListing(playerId, listingId) {
    const listing = await db('market_listings')
      .where({ id: listingId, seller_id: playerId, status: 'active' })
      .first();
    if (!listing) throw new Error('Oferta no encontrada o no cancelable');

    if (listing.quantity_remaining > 0) {
      await db('player_resources')
        .where({ player_id: playerId, resource_id: listing.resource_id })
        .increment('amount', listing.quantity_remaining);
    }

    await db('market_listings').where('id', listingId).update({ status: 'cancelled' });
    return {
      success:     true,
      returned:    listing.quantity_remaining,
      resourceId:  listing.resource_id,
      message:     `Oferta cancelada. Recuperaste ${listing.quantity_remaining}x ${listing.resource_id}`,
    };
  },

  async cleanupExpired() {
    await this._expireOldListings();
  },

  _format(row) {
    const sellerTag = `#${String(row.seller_id).slice(-4)}`;
    const msLeft = Math.max(0, new Date(row.expires_at).getTime() - Date.now());
    const hoursLeft = Math.floor(msLeft / 3600000);
    return {
      id:                row.id,
      sellerId:          row.seller_id,
      sellerTag,
      resourceId:        row.resource_id,
      quantity:          row.quantity,
      quantityRemaining: row.quantity_remaining,
      pricePerUnit:      row.price_per_unit,
      totalValue:        row.quantity_remaining * row.price_per_unit,
      status:            row.status,
      createdAt:         row.created_at,
      expiresAt:         row.expires_at,
      hoursLeft,
    };
  },

  async _expireOldListings() {
    const now = new Date().toISOString();
    const expired = await db('market_listings').where('status', 'active').where('expires_at', '<', now);
    for (const listing of expired) {
      await this._expireOneListing(listing);
    }
  },

  async _expireOldListingsForPlayer(playerId) {
    const now = new Date().toISOString();
    const expired = await db('market_listings')
      .where({ seller_id: playerId, status: 'active' })
      .where('expires_at', '<', now);
    for (const listing of expired) {
      await this._expireOneListing(listing);
    }
  },

  async _expireOneListing(listing) {
    if (listing.quantity_remaining > 0) {
      await db('player_resources')
        .where({ player_id: listing.seller_id, resource_id: listing.resource_id })
        .increment('amount', listing.quantity_remaining);
    }
    await db('market_listings').where('id', listing.id).update({ status: 'expired' });
  },
};

module.exports = marketService;
