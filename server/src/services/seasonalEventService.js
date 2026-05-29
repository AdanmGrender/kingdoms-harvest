const db = require('../config/database');

const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

const SEASONAL_BONUSES = {
  spring: {
    label: 'Primavera',
    icon: '🌸',
    color: '#4ade80',
    cropYieldMult: 1.5,
    animalProdMult: 1.25,
    bonuses: ['+50% rendimiento de cultivos', '+25% producción animal'],
  },
  summer: {
    label: 'Verano',
    icon: '☀️',
    color: '#fbbf24',
    combatTokenMult: 1.25,
    missionTokenMult: 1.5,
    bonuses: ['+25% tokens en combate', '+50% recompensas de misiones'],
  },
  autumn: {
    label: 'Otoño',
    icon: '🍂',
    color: '#f97316',
    caravanPriceMult: 2.0,
    sellTokenMult: 1.5,
    bonuses: ['+100% precios de caravana', '+50% tokens de venta'],
  },
  winter: {
    label: 'Invierno',
    icon: '❄️',
    color: '#93c5fd',
    xpMult: 1.5,
    cropYieldMult: 0.75,
    bonuses: ['+50% XP de todas las fuentes', '-25% rendimiento de cultivos'],
  },
};

const SEASONAL_CHALLENGES = {
  spring: [
    {
      id: 'spring_harvest_20',
      label: 'Cosecha Primaveral',
      desc: 'Cosecha 20 cultivos',
      action: 'harvest',
      target: 20,
      reward: { tokens: 25, resources: { wheat: 50 } },
    },
    {
      id: 'spring_animal_10',
      label: 'Granjero de Primavera',
      desc: 'Recolecta producción animal 10 veces',
      action: 'collect_animal',
      target: 10,
      reward: { tokens: 15, resources: { bread: 20 } },
    },
    {
      id: 'spring_build_3',
      label: 'Constructor Primaveral',
      desc: 'Construye 3 edificios',
      action: 'build',
      target: 3,
      reward: { tokens: 30, resources: { wood: 100 } },
    },
  ],
  summer: [
    {
      id: 'summer_battle_5',
      label: 'Guerrero de Verano',
      desc: 'Gana 5 batallas',
      action: 'battle_win',
      target: 5,
      reward: { tokens: 40, resources: { iron: 30 } },
    },
    {
      id: 'summer_mission_3',
      label: 'Aventurero de Verano',
      desc: 'Completa 3 misiones',
      action: 'mission_complete',
      target: 3,
      reward: { tokens: 30, resources: { gold: 50 } },
    },
    {
      id: 'summer_sell_5',
      label: 'Mercader de Verano',
      desc: 'Realiza 5 ventas',
      action: 'sell',
      target: 5,
      reward: { tokens: 20, resources: { bread: 15 } },
    },
  ],
  autumn: [
    {
      id: 'autumn_sell_10',
      label: 'Festival de Otoño',
      desc: 'Realiza 10 ventas a la caravana',
      action: 'sell',
      target: 10,
      reward: { tokens: 50, resources: { gold: 100 } },
    },
    {
      id: 'autumn_harvest_30',
      label: 'Cosecha del Otoño',
      desc: 'Cosecha 30 cultivos',
      action: 'harvest',
      target: 30,
      reward: { tokens: 35, resources: { wheat: 80 } },
    },
    {
      id: 'autumn_market_3',
      label: 'Mercado de Otoño',
      desc: 'Compra 3 ítems en el mercado',
      action: 'market_buy',
      target: 3,
      reward: { tokens: 25, resources: { stone: 50 } },
    },
  ],
  winter: [
    {
      id: 'winter_battle_3',
      label: 'Asedio Invernal',
      desc: 'Gana 3 batallas',
      action: 'battle_win',
      target: 3,
      reward: { tokens: 45, resources: { iron: 40 } },
    },
    {
      id: 'winter_craft_5',
      label: 'Artesano Invernal',
      desc: 'Realiza 5 artesanías',
      action: 'craft',
      target: 5,
      reward: { tokens: 30, resources: { crystal: 1 } },
    },
    {
      id: 'winter_login_7',
      label: 'Invierno Persistente',
      desc: 'Inicia sesión 7 días seguidos',
      action: 'login',
      target: 7,
      reward: { tokens: 60, resources: { gold: 150 } },
    },
  ],
};

function getCurrentSeason(worldDay) {
  return SEASONS[Math.floor((worldDay % 28) / 7)] || 'spring';
}

function getSeasonKey(worldDay) {
  const season = getCurrentSeason(worldDay);
  return `${season}_cycle${Math.floor(worldDay / 28)}`;
}

function getSeasonInfo(worldDay) {
  const season = getCurrentSeason(worldDay);
  const dayInSeason = (worldDay % 28) % 7 + 1;
  const daysLeft = 7 - dayInSeason + 1;
  const seasonKey = getSeasonKey(worldDay);
  return { season, ...SEASONAL_BONUSES[season], dayInSeason, daysLeft, seasonKey };
}

async function getSeasonalChallenges(playerId, worldDay) {
  const season = getCurrentSeason(worldDay);
  const seasonKey = getSeasonKey(worldDay);
  const challenges = SEASONAL_CHALLENGES[season] || [];

  return Promise.all(
    challenges.map(async (challenge) => {
      const row = await db('seasonal_progress')
        .where({ player_id: playerId, season_key: seasonKey, challenge_id: challenge.id })
        .first();
      return {
        ...challenge,
        progress: row?.progress || 0,
        completed: !!(row?.completed_at),
        claimed: !!(row?.claimed_at),
      };
    })
  );
}

async function trackSeasonalProgress(playerId, action, worldDay, count = 1) {
  const season = getCurrentSeason(worldDay);
  const seasonKey = getSeasonKey(worldDay);
  const challenges = (SEASONAL_CHALLENGES[season] || []).filter((c) => c.action === action);

  for (const challenge of challenges) {
    const row = await db('seasonal_progress')
      .where({ player_id: playerId, season_key: seasonKey, challenge_id: challenge.id })
      .first();

    if (row?.completed_at) continue;

    const currentProgress = row?.progress || 0;
    const newProgress = Math.min(currentProgress + count, challenge.target);
    const completedAt = newProgress >= challenge.target ? new Date().toISOString() : null;

    if (row) {
      const update = { progress: newProgress };
      if (completedAt) update.completed_at = completedAt;
      await db('seasonal_progress')
        .where({ player_id: playerId, season_key: seasonKey, challenge_id: challenge.id })
        .update(update);
    } else {
      await db('seasonal_progress').insert({
        player_id: playerId,
        season_key: seasonKey,
        challenge_id: challenge.id,
        progress: newProgress,
        completed_at: completedAt,
        claimed_at: null,
      });
    }
  }
}

async function claimSeasonalReward(playerId, challengeId, worldDay) {
  const season = getCurrentSeason(worldDay);
  const seasonKey = getSeasonKey(worldDay);
  const allChallenges = SEASONAL_CHALLENGES[season] || [];
  const challenge = allChallenges.find((c) => c.id === challengeId);

  if (!challenge) throw new Error('Desafío no encontrado');

  const row = await db('seasonal_progress')
    .where({ player_id: playerId, season_key: seasonKey, challenge_id: challengeId })
    .first();

  if (!row?.completed_at) throw new Error('El desafío no está completado');
  if (row.claimed_at) throw new Error('La recompensa ya fue reclamada');

  await db('seasonal_progress')
    .where({ player_id: playerId, season_key: seasonKey, challenge_id: challengeId })
    .update({ claimed_at: new Date().toISOString() });

  const { reward } = challenge;

  for (const [resourceId, amount] of Object.entries(reward.resources || {})) {
    const existing = await db('player_resources')
      .where({ player_id: playerId, resource_id: resourceId })
      .first();
    if (existing) {
      await db('player_resources')
        .where({ player_id: playerId, resource_id: resourceId })
        .increment('amount', amount);
    } else {
      await db('player_resources').insert({
        player_id: playerId,
        resource_id: resourceId,
        amount,
        capacity: 1000,
      });
    }
  }

  let tokensAwarded = 0;
  if (reward.tokens > 0) {
    const tokenService = require('./tokenService');
    const result = await tokenService.awardTokens(playerId, reward.tokens, 'daily_task');
    tokensAwarded = result.awarded;
  }

  return { success: true, reward, tokensAwarded };
}

module.exports = {
  getCurrentSeason,
  getSeasonKey,
  getSeasonInfo,
  getSeasonalChallenges,
  trackSeasonalProgress,
  claimSeasonalReward,
  SEASONAL_BONUSES,
  SEASONAL_CHALLENGES,
};
