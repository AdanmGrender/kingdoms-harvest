const crypto = require('crypto');
const db = require('../config/database');
const { CROPS, ANIMALS, FACTIONS } = require('../../../shared/gameConfig');
const playerService = require('./playerService');
const tokenService = require('./tokenService');
const dailyTaskService = require('./dailyTaskService');
const { TOKEN_CONFIG } = require('../../../shared/tokenConfig');

function secureRandom() {
  return crypto.randomInt(0, 2147483647) / 2147483647;
}

// Precios base de recursos para venta rápida
const BASE_PRICES = {
  wheat: 8, carrot: 12, potato: 15, tomato: 22, corn: 28, pumpkin: 45, grape: 50,
  wood: 5, stone: 7, iron: 12,
  bread: 18, planks: 12, ingots: 25, flour: 14, cheese: 30,
  egg: 6, milk: 15, wool: 20,
};

const commerceService = {
  /**
   * Obtener caravana activa o generar una nueva
   */
  async getActiveCaravan() {
    const now = new Date().toISOString();

    let caravan = await db('caravans')
      .where('is_active', true)
      .where('departs_at', '>', now)
      .first();

    if (!caravan) {
      caravan = await this.generateCaravan();
    }

    let buy_offers, sell_offers;
    try {
      buy_offers = JSON.parse(caravan.buy_offers);
      sell_offers = JSON.parse(caravan.sell_offers);
    } catch {
      throw new Error('Datos de caravana corruptos');
    }
    return { ...caravan, buy_offers, sell_offers };
  },

  /**
   * Genera una caravana con ofertas aleatorias
   */
  async generateCaravan() {
    // Desactivar caravanas viejas
    await db('caravans').where('is_active', true).update({ is_active: false });

    const resources = Object.keys(BASE_PRICES);
    const numOffers = 4 + Math.floor(secureRandom() * 3);

    // Ofertas de compra (lo que el jugador puede comprarle a la caravana)
    const buyOffers = [];
    const usedBuy = new Set();
    for (let i = 0; i < numOffers; i++) {
      let res;
      do {
        res = resources[Math.floor(secureRandom() * resources.length)];
      } while (usedBuy.has(res));
      usedBuy.add(res);

      const priceMultiplier = 1.2 + secureRandom() * 0.8; // 120% - 200% del precio base
      buyOffers.push({
        resource_id: res,
        price: Math.floor(BASE_PRICES[res] * priceMultiplier),
        quantity: 10 + Math.floor(secureRandom() * 40),
      });
    }

    // Ofertas de venta (lo que el jugador puede venderle a la caravana)
    const sellOffers = [];
    const usedSell = new Set();
    for (let i = 0; i < numOffers; i++) {
      let res;
      do {
        res = resources[Math.floor(secureRandom() * resources.length)];
      } while (usedSell.has(res));
      usedSell.add(res);

      const priceMultiplier = 0.8 + secureRandom() * 1.0; // 80% - 180% del precio base
      sellOffers.push({
        resource_id: res,
        price: Math.floor(BASE_PRICES[res] * priceMultiplier),
        quantity: 20 + Math.floor(secureRandom() * 50), // cuánto acepta la caravana
      });
    }

    const now = new Date();
    const arrives = now;
    const departs = new Date(now.getTime() + 4 * 60 * 60 * 1000); // 4 horas

    const caravanNames = [
      'Caravana del Este', 'Mercaderes de Norheim', 'Comerciantes del Desierto',
      'Caravana Imperial', 'Buhoneros Errantes', 'Feria Ambulante',
    ];

    const [id] = await db('caravans').insert({
      name: caravanNames[Math.floor(secureRandom() * caravanNames.length)],
      buy_offers: JSON.stringify(buyOffers),
      sell_offers: JSON.stringify(sellOffers),
      arrives_at: arrives.toISOString(),
      departs_at: departs.toISOString(),
      is_active: true,
    });

    return db('caravans').where('id', id).first();
  },

  /**
   * Comprar recurso de la caravana
   */
  async buyFromCaravan(playerId, resourceId, quantity) {
    const caravan = await this.getActiveCaravan();
    const offer = caravan.buy_offers.find((o) => o.resource_id === resourceId);

    if (!offer) throw new Error('La caravana no vende ese recurso');
    if (quantity > offer.quantity) throw new Error(`La caravana solo tiene ${offer.quantity}`);

    const totalCost = offer.price * quantity;

    // Cobrar oro (atómico)
    try {
      await playerService.modifyResource(playerId, 'gold', -totalCost);
    } catch {
      const gold = await db('player_resources')
        .where({ player_id: playerId, resource_id: 'gold' }).first();
      throw new Error(`Necesitás ${totalCost} oro. Tenés ${gold?.amount || 0}`);
    }
    await playerService.modifyResource(playerId, resourceId, quantity);

    // Re-read caravan to get current stock (prevents race condition between concurrent buyers)
    const freshCaravan = await this.getActiveCaravan();
    const freshOffer = freshCaravan.buy_offers.find((o) => o.resource_id === resourceId);
    if (!freshOffer || freshOffer.quantity < quantity) {
      // Rollback: refund gold and deduct the resource we already gave
      await playerService.modifyResource(playerId, 'gold', totalCost);
      await playerService.modifyResource(playerId, resourceId, -quantity);
      throw new Error('Stock agotado — otro jugador lo compró primero');
    }
    freshOffer.quantity -= quantity;
    await db('caravans')
      .where('id', freshCaravan.id)
      .update({ buy_offers: JSON.stringify(freshCaravan.buy_offers) });

    return {
      success: true,
      message: `Compraste ${quantity}x ${resourceId} por ${totalCost} oro`,
    };
  },

  /**
   * Vender recurso a la caravana
   */
  async sellToCaravan(playerId, resourceId, quantity) {
    const caravan = await this.getActiveCaravan();
    const offer = caravan.sell_offers.find((o) => o.resource_id === resourceId);

    if (!offer) throw new Error('La caravana no compra ese recurso');
    if (quantity > offer.quantity) throw new Error(`La caravana solo acepta ${offer.quantity} más`);

    // Faction bonus: shadow_merchants +15% sell price
    const player = await db('players').where('telegram_id', playerId).first();
    const commerceBonus = FACTIONS[player?.faction_id]?.bonus?.commerce || 0;
    const totalGold = Math.floor(offer.price * quantity * (1 + commerceBonus));

    // Cobrar recurso (atómico)
    try {
      await playerService.modifyResource(playerId, resourceId, -quantity);
    } catch {
      throw new Error(`No tenés suficiente ${resourceId}`);
    }
    await playerService.modifyResource(playerId, 'gold', totalGold);

    // Dar KH Tokens + trackear tarea diaria
    const tokenResult = await tokenService.awardTokens(playerId, TOKEN_CONFIG.TOKENS_PER_SALE, 'sell');
    await dailyTaskService.trackProgress(playerId, 'sell');

    // Re-read caravan to get current capacity (prevents race condition between concurrent sellers)
    const freshCaravan = await this.getActiveCaravan();
    const freshOffer = freshCaravan.sell_offers.find((o) => o.resource_id === resourceId);
    if (!freshOffer || freshOffer.quantity < quantity) {
      // Rollback: refund resource and deduct gold already given
      await playerService.modifyResource(playerId, resourceId, quantity);
      await playerService.modifyResource(playerId, 'gold', -totalGold);
      throw new Error('La caravana ya no acepta más — vuelve a intentarlo');
    }
    freshOffer.quantity -= quantity;
    await db('caravans')
      .where('id', freshCaravan.id)
      .update({ sell_offers: JSON.stringify(freshCaravan.sell_offers) });

    return {
      success: true,
      tokensAwarded: tokenResult.awarded,
      message: `Vendiste ${quantity}x ${resourceId} por ${totalGold} oro +${tokenResult.awarded} KH`,
    };
  },

  /**
   * Venta rápida a precio base (siempre disponible)
   */
  async quickSell(playerId, resourceId, quantity) {
    const basePrice = BASE_PRICES[resourceId];
    if (!basePrice) throw new Error('Recurso no vendible');

    const totalGold = Math.floor(basePrice * quantity * 0.7); // 70% del precio base

    // Cobrar recurso (atómico)
    try {
      await playerService.modifyResource(playerId, resourceId, -quantity);
    } catch {
      throw new Error(`No tenés suficiente ${resourceId}`);
    }
    await playerService.modifyResource(playerId, 'gold', totalGold);

    // Dar KH Tokens + trackear tarea diaria
    const tokenResult = await tokenService.awardTokens(playerId, TOKEN_CONFIG.TOKENS_PER_SALE, 'sell');
    await dailyTaskService.trackProgress(playerId, 'sell');

    return {
      success: true,
      gold: totalGold,
      tokensAwarded: tokenResult.awarded,
      message: `Venta rápida: ${quantity}x ${resourceId} → ${totalGold} oro +${tokenResult.awarded} KH`,
    };
  },
};

module.exports = commerceService;
