const crypto = require('crypto');
const db = require('../config/database');
const { CROPS, ANIMALS, FACTIONS } = require('../../../shared/gameConfig');
const playerService = require('./playerService');
const tokenService = require('./tokenService');
const dailyTaskService = require('./dailyTaskService');
const techService = require('./techService');
const achievementService = require('./achievementService');
const eventService = require('./eventService');
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
      'Convoy del Este', 'Chatarreros de Norheim', 'Traficantes del Páramo',
      'Convoy del Alto Mando', 'Buhoneros del Óxido', 'Zoco Ambulante',
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
    // Tormenta disforme (F2): Velo Estático sella los convoyes
    if (await require('./stormService').convoysSealed()) {
      throw new Error('La tormenta disforme selló las rutas — el convoy no responde');
    }
    const caravan = await this.getActiveCaravan();
    const offer = caravan.buy_offers.find((o) => o.resource_id === resourceId);

    if (!offer) throw new Error('El convoy no vende ese recurso');
    if (quantity > offer.quantity) throw new Error(`El convoy solo tiene ${offer.quantity}`);

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

    // Actualizar stock de caravana
    offer.quantity -= quantity;
    await db('caravans')
      .where('id', caravan.id)
      .update({ buy_offers: JSON.stringify(caravan.buy_offers) });

    return {
      success: true,
      message: `Compraste ${quantity}x ${resourceId} por ${totalCost} oro`,
    };
  },

  /**
   * Vender recurso a la caravana
   */
  async sellToCaravan(playerId, resourceId, quantity) {
    // Tormenta disforme (F2): Velo Estático sella los convoyes
    if (await require('./stormService').convoysSealed()) {
      throw new Error('La tormenta disforme selló las rutas — el convoy no responde');
    }
    const caravan = await this.getActiveCaravan();
    const offer = caravan.sell_offers.find((o) => o.resource_id === resourceId);

    if (!offer) throw new Error('El convoy no compra ese recurso');
    if (quantity > offer.quantity) throw new Error(`El convoy solo acepta ${offer.quantity} más`);

    // Faction bonus: shadow_merchants +15% sell price
    const player = await db('players').where('telegram_id', playerId).first();
    const commerceBonus = FACTIONS[player?.faction_id]?.bonus?.commerce || 0;
    // Tech: haggling +10% sell price
    const completedTechs = await techService.getCompletedTechs(playerId);
    const techBonus = completedTechs.has('haggling') ? 0.10 : 0;
    // Seasonal event: harvest_festival adds commerce bonus
    const eventBonus = await eventService.getMultiplier('commerce');
    const totalGold = Math.floor(offer.price * quantity * (1 + commerceBonus + techBonus + eventBonus));

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
    achievementService.checkAndUnlock(playerId, 'sell', 1).catch(() => {});

    offer.quantity -= quantity;
    await db('caravans')
      .where('id', caravan.id)
      .update({ sell_offers: JSON.stringify(caravan.sell_offers) });

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
    achievementService.checkAndUnlock(playerId, 'sell', 1).catch(() => {});

    return {
      success: true,
      gold: totalGold,
      tokensAwarded: tokenResult.awarded,
      message: `Venta rápida: ${quantity}x ${resourceId} → ${totalGold} oro +${tokenResult.awarded} KH`,
    };
  },
};

module.exports = commerceService;
