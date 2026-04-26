const crypto = require('crypto');
const db = require('../config/database');
const { CROPS, ANIMALS, QUALITY, SEASON_DURATION_MS, DAY_CYCLE, FACTIONS } = require('../../../shared/gameConfig');
const { sanitizeDisplayText } = require('../utils/sanitize');
const playerService = require('./playerService');
const tokenService = require('./tokenService');
const dailyTaskService = require('./dailyTaskService');
const techService = require('./techService');
const { TOKEN_CONFIG } = require('../../../shared/tokenConfig');

function secureRandom() {
  return crypto.randomInt(0, 2147483647) / 2147483647;
}

const farmService = {
  async getPlots(playerId) {
    return db('farm_plots').where('player_id', playerId);
  },

  /**
   * Plantar un cultivo en una parcela
   */
  async plantCrop(playerId, plotId, cropId) {
    const crop = CROPS[cropId];
    if (!crop) throw new Error('Cultivo no válido');

    const plot = await db('farm_plots')
      .where({ id: plotId, player_id: playerId })
      .first();

    if (!plot) throw new Error('Parcela no encontrada');
    if (plot.state !== 'empty') throw new Error('La parcela no está vacía');

    // Verificar estación actual
    const player = await db('players').where('telegram_id', playerId).first();
    const daysSinceStart = (player?.world_day || 1);
    const seasonLengthDays = Math.floor(SEASON_DURATION_MS / DAY_CYCLE.dayDurationMs);
    const seasonIndex = Math.floor((daysSinceStart - 1) / seasonLengthDays) % 4;
    const SEASON_ORDER = ['spring', 'summer', 'autumn', 'winter'];
    const currentSeason = SEASON_ORDER[seasonIndex];

    // Tech: greenhouse bypasses the seasonal restriction
    const completedTechs = await techService.getCompletedTechs(playerId);
    if (!crop.season.includes(currentSeason) && !completedTechs.has('greenhouse')) {
      const seasonNames = { spring: 'Primavera', summer: 'Verano', autumn: 'Otoño', winter: 'Invierno' };
      throw new Error(`${crop.name} no crece en ${seasonNames[currentSeason] || currentSeason}`);
    }

    const now = new Date();
    // Tech: irrigation cuts growth time by 15%
    const growthMultiplier = completedTechs.has('irrigation') ? 0.85 : 1;
    const readyAt = new Date(now.getTime() + crop.growthTime * growthMultiplier);

    // Cobrar semillas (atómico — lanza error si no hay suficiente)
    try {
      await playerService.modifyResource(playerId, 'gold', -crop.seedCost);
    } catch {
      throw new Error(`Necesitás ${crop.seedCost} oro para comprar semillas de ${crop.name}`);
    }

    // Plantar
    await db('farm_plots').where('id', plotId).update({
      crop_id: cropId,
      state: 'growing',
      planted_at: now.toISOString(),
      ready_at: readyAt.toISOString(),
    });

    return {
      success: true,
      plotId,
      cropId,
      readyAt: readyAt.toISOString(),
      message: `Plantaste ${crop.icon} ${crop.name}. Estará listo en ${Math.round(crop.growthTime / 60000)} minutos.`,
    };
  },

  /**
   * Cosechar un cultivo listo
   */
  async harvestCrop(playerId, plotId) {
    const plot = await db('farm_plots')
      .where({ id: plotId, player_id: playerId })
      .first();

    if (!plot) throw new Error('Parcela no encontrada');
    if (plot.state !== 'ready') throw new Error('El cultivo no está listo para cosechar');

    const crop = CROPS[plot.crop_id];
    if (!crop) throw new Error('Cultivo no válido');

    // Calcular cantidad y calidad
    const quality = this.rollQuality(plot.fertilized);
    const baseYield = Math.floor(
      secureRandom() * (crop.yield.max - crop.yield.min + 1) + crop.yield.min
    );
    // Faction bonus: green_wardens +15% farming yield
    const player = await db('players').where('telegram_id', playerId).first();
    const factionBonus = FACTIONS[player?.faction_id]?.bonus?.farming || 0;
    // Tech: fertile_soil +20% crop yield (multiplicative with quality + faction)
    const completedTechs = await techService.getCompletedTechs(playerId);
    const techYieldBonus = completedTechs.has('fertile_soil') ? 0.20 : 0;
    const finalYield = Math.floor(baseYield * quality.multiplier * (1 + factionBonus + techYieldBonus));

    // Dar recursos al jugador
    await playerService.modifyResource(playerId, plot.crop_id, finalYield);

    // Dar XP
    const xpResult = await playerService.addXP(playerId, crop.xp);

    // Dar KH Tokens + trackear tarea diaria
    const tokenResult = await tokenService.awardTokens(playerId, TOKEN_CONFIG.TOKENS_PER_HARVEST, 'harvest');
    await dailyTaskService.trackProgress(playerId, 'harvest');

    // Resetear parcela
    await db('farm_plots').where('id', plotId).update({
      crop_id: null,
      state: 'empty',
      planted_at: null,
      ready_at: null,
      fertilized: false,
      quality: 'normal',
    });

    return {
      success: true,
      crop: crop.name,
      icon: crop.icon,
      quantity: finalYield,
      quality: quality.name,
      qualityColor: quality.color,
      xp: crop.xp,
      leveledUp: xpResult.leveledUp,
      newLevel: xpResult.level,
      tokensAwarded: tokenResult.awarded,
      message: `Cosechaste ${finalYield}x ${crop.icon} ${crop.name} (${quality.name})! +${crop.xp} XP +${tokenResult.awarded} KH`,
    };
  },

  /**
   * Determinar calidad del cultivo
   */
  rollQuality(fertilized) {
    const roll = secureRandom();
    const bonus = fertilized ? 0.15 : 0;

    if (roll < QUALITY.EXCELLENT.chance + bonus) return QUALITY.EXCELLENT;
    if (roll < QUALITY.EXCELLENT.chance + QUALITY.GOOD.chance + bonus) return QUALITY.GOOD;
    return QUALITY.NORMAL;
  },

  async getAnimals(playerId) {
    return db('player_animals').where('player_id', playerId);
  },

  /**
   * Comprar un animal
   */
  async buyAnimal(playerId, animalTypeId, name) {
    const animalType = ANIMALS[animalTypeId];
    if (!animalType) throw new Error('Animal no válido');

    // Verificar espacio en establo
    const stables = await db('player_buildings')
      .where({ player_id: playerId, building_id: 'stable', is_building: false });

    const totalSlots = stables.reduce((acc, s) => acc + (s.level * 2), 0);
    const currentAnimals = await db('player_animals').where('player_id', playerId).count('* as count');

    if (currentAnimals[0].count >= totalSlots) {
      throw new Error('No tenés espacio en el establo. Mejoralo o construí otro.');
    }

    // Cobrar oro (atómico)
    try {
      await playerService.modifyResource(playerId, 'gold', -animalType.cost);
    } catch {
      throw new Error(`Necesitás ${animalType.cost} oro para comprar ${animalType.name}`);
    }

    const safeName = sanitizeDisplayText(name, 30) || animalType.name;

    await db('player_animals').insert({
      player_id: playerId,
      animal_id: animalTypeId,
      name: safeName,
      is_fed: false,
    });

    return {
      success: true,
      message: `Compraste ${animalType.icon} ${safeName}!`,
    };
  },

  /**
   * Alimentar un animal para que produzca
   */
  async feedAnimal(playerId, animalDbId) {
    const animal = await db('player_animals')
      .where({ id: animalDbId, player_id: playerId }).first();

    if (!animal) throw new Error('Animal no encontrado');
    if (animal.is_fed) throw new Error('El animal ya está alimentado');

    const animalType = ANIMALS[animal.animal_id];

    // Cobrar comida (atómico por cada recurso)
    const chargedResources = [];
    try {
      for (const [resource, amount] of Object.entries(animalType.feedCost)) {
        await playerService.modifyResource(playerId, resource, -amount);
        chargedResources.push({ resource, amount });
      }
    } catch (err) {
      // Revertir lo ya cobrado si falla a mitad
      for (const { resource, amount } of chargedResources) {
        await playerService.modifyResource(playerId, resource, amount);
      }
      throw new Error(`No tenés suficientes recursos para alimentar`);
    }

    const now = new Date();
    const nextProd = new Date(now.getTime() + animalType.productionTime);

    await db('player_animals').where('id', animalDbId).update({
      is_fed: true,
      next_production_at: nextProd.toISOString(),
      notified_at: null, // reset so next ready-cycle pushes once
    });

    return {
      success: true,
      message: `${animalType.icon} alimentado! Producirá ${animalType.productIcon} en ${Math.round(animalType.productionTime / 60000)} min.`,
    };
  },

  /**
   * Recolectar producto de animal
   */
  async collectAnimalProduct(playerId, animalDbId) {
    const animal = await db('player_animals')
      .where({ id: animalDbId, player_id: playerId }).first();

    if (!animal) throw new Error('Animal no encontrado');
    if (!animal.is_fed) throw new Error('Alimentá al animal primero');

    const now = new Date();
    if (animal.next_production_at && new Date(animal.next_production_at) > now) {
      throw new Error('El animal todavía no produjo');
    }

    const animalType = ANIMALS[animal.animal_id];
    const baseQuantity = Math.floor(
      secureRandom() * (animalType.yield.max - animalType.yield.min + 1) + animalType.yield.min
    );
    // Tech: selective_breeding adds +1 product per collection
    const completedTechs = await techService.getCompletedTechs(playerId);
    const quantity = baseQuantity + (completedTechs.has('selective_breeding') ? 1 : 0);

    await playerService.modifyResource(playerId, animalType.product, quantity);
    const xpResult = await playerService.addXP(playerId, animalType.xp);

    await db('player_animals').where('id', animalDbId).update({
      is_fed: false,
      last_collected_at: now.toISOString(),
      next_production_at: null,
      notified_at: null, // clear so next feed→ready cycle pushes once
    });

    return {
      success: true,
      product: animalType.productName,
      icon: animalType.productIcon,
      quantity,
      xp: animalType.xp,
      message: `Recolectaste ${quantity}x ${animalType.productIcon} ${animalType.productName}! +${animalType.xp} XP`,
    };
  },
};

module.exports = farmService;
