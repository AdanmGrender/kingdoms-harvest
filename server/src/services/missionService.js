const crypto = require('crypto');
const db = require('../config/database');
const playerService = require('./playerService');
const tokenService = require('./tokenService');
const dailyTaskService = require('./dailyTaskService');
const { TOKEN_CONFIG } = require('../../../shared/tokenConfig');

function secureRandom() {
  return crypto.randomInt(0, 2147483647) / 2147483647;
}

// NPCs que dan misiones
const NPCS = [
  { name: 'Tabernero Gordo', icon: '🍺', type: 'food' },
  { name: 'Herrero del Rey', icon: '⚒️', type: 'materials' },
  { name: 'Comerciante Errante', icon: '🧳', type: 'mixed' },
  { name: 'Cocinera Real', icon: '👩‍🍳', type: 'food' },
  { name: 'Capitán de la Guardia', icon: '🛡️', type: 'military' },
  { name: 'Aldeano Desesperado', icon: '🧑‍🌾', type: 'basic' },
  { name: 'Princesa Caprichosa', icon: '👸', type: 'luxury' },
];

// Recursos que se pueden pedir en misiones
const MISSION_RESOURCES = [
  'wheat', 'carrot', 'potato', 'tomato', 'corn', 'pumpkin',
  'wood', 'stone', 'iron', 'bread', 'planks', 'ingots',
  'egg', 'milk', 'wool', 'cheese', 'flour',
];

const missionService = {
  async getMissions(playerId) {
    return db('missions')
      .where('player_id', playerId)
      .whereIn('status', ['available', 'accepted'])
      .orderBy('is_urgent', 'desc')
      .orderBy('created_at', 'desc');
  },

  /**
   * Genera misiones aleatorias para el jugador
   */
  async generateMissions(playerId) {
    // Verificar nivel de taberna para cantidad de misiones
    const tavern = await db('player_buildings')
      .where({ player_id: playerId, building_id: 'tavern', is_building: false })
      .first();

    const maxMissions = tavern ? tavern.level + 1 : 2; // Mínimo 2 misiones

    // Limpiar misiones viejas disponibles (no aceptadas)
    await db('missions')
      .where({ player_id: playerId, status: 'available' })
      .delete();

    const player = await db('players').where('telegram_id', playerId).first();
    if (!player) throw new Error('Jugador no encontrado');
    const missions = [];

    for (let i = 0; i < maxMissions; i++) {
      const mission = this.createRandomMission(player.level);
      mission.player_id = playerId;
      const [{ id }] = await db('missions').insert(mission).returning('id');
      missions.push({ id, ...mission });
    }

    return missions;
  },

  /**
   * Crea una misión aleatoria basada en el nivel del jugador
   */
  createRandomMission(playerLevel) {
    const npc = NPCS[Math.floor(secureRandom() * NPCS.length)];
    const isUrgent = secureRandom() < 0.2; // 20% chance de urgente
    const numRequirements = Math.min(1 + Math.floor(playerLevel / 3), 4);

    // Generar requisitos
    const requirements = [];
    const usedResources = new Set();

    for (let i = 0; i < numRequirements; i++) {
      let resourceId;
      do {
        resourceId = MISSION_RESOURCES[Math.floor(secureRandom() * MISSION_RESOURCES.length)];
      } while (usedResources.has(resourceId));
      usedResources.add(resourceId);

      const baseAmount = 3 + Math.floor(playerLevel * 1.5);
      const amount = baseAmount + Math.floor(secureRandom() * baseAmount);

      requirements.push({ resource_id: resourceId, amount });
    }

    // Calcular recompensas basadas en dificultad
    const difficulty = requirements.reduce((acc, r) => acc + r.amount, 0);
    const goldReward = Math.floor(difficulty * (2 + secureRandom() * 2));
    const xpReward = Math.floor(difficulty * (1.5 + secureRandom()));

    const rewards = {
      gold: isUrgent ? Math.floor(goldReward * 1.5) : goldReward,
      xp: isUrgent ? Math.floor(xpReward * 1.5) : xpReward,
      items: [],
    };

    // Chance de item raro como recompensa
    if (secureRandom() < 0.1 && playerLevel >= 5) {
      const rareItems = ['crystal', 'relic', 'blueprint'];
      rewards.items.push({
        item_id: rareItems[Math.floor(secureRandom() * rareItems.length)],
        quantity: 1,
      });
    }

    // Títulos de misiones
    const titles = [
      `${npc.name} necesita suministros`,
      `Pedido urgente de ${npc.name}`,
      `Encargo especial`,
      `Abastecimiento para la aldea`,
      `Demanda del ${npc.name}`,
      `Provisiones para el invierno`,
    ];

    const now = new Date();
    const expiresAt = isUrgent
      ? new Date(now.getTime() + 2 * 60 * 60 * 1000) // 2 horas si urgente
      : new Date(now.getTime() + 24 * 60 * 60 * 1000); // 24 horas normal

    return {
      title: titles[Math.floor(secureRandom() * titles.length)],
      description: `${npc.icon} ${npc.name} te pide que le lleves algunos recursos.`,
      npc_name: npc.name,
      npc_icon: npc.icon,
      requirements: JSON.stringify(requirements),
      rewards: JSON.stringify(rewards),
      status: 'available',
      is_urgent: isUrgent,
      expires_at: expiresAt.toISOString(),
    };
  },

  async acceptMission(playerId, missionId) {
    const mission = await db('missions')
      .where({ id: missionId, player_id: playerId, status: 'available' })
      .first();

    if (!mission) throw new Error('Misión no disponible');

    await db('missions').where('id', missionId).update({
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });

    return { success: true, message: 'Misión aceptada!' };
  },

  /**
   * Completar misión: verifica que el jugador tiene los recursos y los cobra
   */
  async completeMission(playerId, missionId) {
    const mission = await db('missions')
      .where({ id: missionId, player_id: playerId, status: 'accepted' })
      .first();

    if (!mission) throw new Error('Misión no encontrada o no aceptada');

    if (mission.expires_at && new Date(mission.expires_at) < new Date()) {
      await db('missions').where('id', missionId).update({ status: 'expired' });
      throw new Error('Esta misión ha expirado');
    }

    let requirements, rewards;
    try {
      requirements = JSON.parse(mission.requirements);
      rewards = JSON.parse(mission.rewards);
    } catch {
      throw new Error('Datos de misión corruptos');
    }

    // Cobrar recursos (atómico con rollback si falla)
    const chargedReqs = [];
    try {
      for (const req of requirements) {
        await playerService.modifyResource(playerId, req.resource_id, -req.amount);
        chargedReqs.push(req);
      }
    } catch {
      // Revertir lo ya cobrado
      for (const req of chargedReqs) {
        await playerService.modifyResource(playerId, req.resource_id, req.amount);
      }
      throw new Error('No tenés suficientes recursos para completar la misión');
    }

    // Dar recompensas
    if (rewards.gold) {
      await playerService.modifyResource(playerId, 'gold', rewards.gold);
    }

    if (rewards.xp) {
      await playerService.addXP(playerId, rewards.xp);
    }

    // Items raros
    for (const item of rewards.items || []) {
      await playerService.modifyResource(playerId, item.item_id, item.quantity);
    }

    // Dar KH Tokens + trackear tarea diaria
    const tokenResult = await tokenService.awardTokens(playerId, TOKEN_CONFIG.TOKENS_PER_MISSION_COMPLETE, 'mission');
    await dailyTaskService.trackProgress(playerId, 'mission_complete');

    // Marcar completada
    await db('missions').where('id', missionId).update({
      status: 'completed',
      completed_at: new Date().toISOString(),
    });

    return {
      success: true,
      rewards,
      tokensAwarded: tokenResult.awarded,
      message: `Misión completada! +${rewards.gold} oro, +${rewards.xp} XP, +${tokenResult.awarded} KH`,
    };
  },
};

module.exports = missionService;
