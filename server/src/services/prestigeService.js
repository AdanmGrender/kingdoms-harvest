const db = require('../config/database');

const PRESTIGE_MIN_LEVEL = 20;
const PRESTIGE_POINTS_PER_PRESTIGE = 5;

const PRESTIGE_UPGRADES = [
  { id: 'veteran_farmer',   label: 'Granjero Veterano',     desc: '+5% rendimiento de cultivos por nivel', maxLevel: 10, costPerLevel: 1, bonusKey: 'crop_yield',       perLevel: 0.05 },
  { id: 'battle_hardened',  label: 'Endurecido en Batalla', desc: '+3% poder de ataque por nivel',          maxLevel: 10, costPerLevel: 1, bonusKey: 'combat_atk',       perLevel: 0.03 },
  { id: 'merchants_eye',    label: 'Ojo de Mercader',       desc: '+5% precio de venta por nivel',          maxLevel: 10, costPerLevel: 1, bonusKey: 'sell_price',       perLevel: 0.05 },
  { id: 'architects_guild', label: 'Gremio de Arquitectos', desc: '-5% costo de construcción por nivel',    maxLevel:  6, costPerLevel: 2, bonusKey: 'build_cost_redux', perLevel: 0.05, reduction: true },
  { id: 'token_magnate',    label: 'Magnate de Tokens',     desc: '+5% cap diario de tokens por nivel',     maxLevel: 10, costPerLevel: 1, bonusKey: 'daily_token_cap',  perLevel: 0.05 },
];

async function getPrestigeInfo(playerId) {
  const player = await db('players').where('telegram_id', playerId).first();
  if (!player) throw new Error('Jugador no encontrado');

  const rows = await db('prestige_upgrades').where('player_id', playerId);

  const upgrades = PRESTIGE_UPGRADES.map((def) => {
    const row = rows.find((r) => r.upgrade_id === def.id);
    const currentLevel = row?.level || 0;
    return {
      ...def,
      currentLevel,
      currentBonus: parseFloat((currentLevel * def.perLevel).toFixed(2)),
    };
  });

  return {
    prestigeCount: player.prestige_count || 0,
    prestigePoints: player.prestige_points || 0,
    level: player.level,
    canPrestige: player.level >= PRESTIGE_MIN_LEVEL,
    minLevel: PRESTIGE_MIN_LEVEL,
    upgrades,
  };
}

async function executePrestige(playerId) {
  const player = await db('players').where('telegram_id', playerId).first();
  if (!player) throw new Error('Jugador no encontrado');
  if (player.level < PRESTIGE_MIN_LEVEL) {
    throw new Error(`Necesitas nivel ${PRESTIGE_MIN_LEVEL} para hacer prestige`);
  }

  const pointsEarned = PRESTIGE_POINTS_PER_PRESTIGE + Math.floor(player.level - PRESTIGE_MIN_LEVEL);
  const newCount = (player.prestige_count || 0) + 1;
  const newPoints = (player.prestige_points || 0) + pointsEarned;

  // TODO el reset en UNA transacción. Antes eran statements sueltos y las dos
  // tablas de abajo estaban MAL NOMBRADAS ('buildings'/'troops' no existen; son
  // player_buildings/player_troops): el DELETE lanzaba "no such table" DESPUÉS
  // de haber bajado el nivel a 1, sumado los puntos y borrado los recursos →
  // el jugador quedaba nivel 1, sin recursos, con puntos, CONSERVANDO base y
  // tropas, y viendo un error. Con la transacción, o pasa todo o no pasa nada.
  await db.transaction(async (trx) => {
    await trx('players').where('telegram_id', playerId).update({
      level: 1,
      xp: 0,
      prestige_count: newCount,
      prestige_points: newPoints,
    });

    await trx('player_resources').where('player_id', playerId).delete();
    await trx('player_buildings').where('player_id', playerId).delete();
    await trx('player_troops').where('player_id', playerId).delete();
    await trx('farm_plots').where('player_id', playerId).delete();
    await trx('missions').where('player_id', playerId).delete();
  });

  return { success: true, prestigeCount: newCount, pointsEarned, totalPoints: newPoints };
}

async function purchaseUpgrade(playerId, upgradeId) {
  const def = PRESTIGE_UPGRADES.find((u) => u.id === upgradeId);
  if (!def) throw new Error('Mejora no encontrada');

  const player = await db('players').where('telegram_id', playerId).first();
  if (!player) throw new Error('Jugador no encontrado');

  const row = await db('prestige_upgrades').where({ player_id: playerId, upgrade_id: upgradeId }).first();
  const currentLevel = row?.level || 0;

  if (currentLevel >= def.maxLevel) throw new Error('Mejora al nivel máximo');

  const cost = def.costPerLevel;
  if ((player.prestige_points || 0) < cost) throw new Error('Puntos de prestige insuficientes');

  await db('players').where('telegram_id', playerId).update({
    prestige_points: (player.prestige_points || 0) - cost,
  });

  if (row) {
    await db('prestige_upgrades')
      .where({ player_id: playerId, upgrade_id: upgradeId })
      .update({ level: currentLevel + 1 });
  } else {
    await db('prestige_upgrades').insert({
      player_id: playerId,
      upgrade_id: upgradeId,
      level: 1,
    });
  }

  return { success: true, newLevel: currentLevel + 1 };
}

async function getMultipliers(playerId) {
  const rows = await db('prestige_upgrades').where('player_id', playerId);
  const multipliers = {};

  for (const row of rows) {
    if (!row.level || row.level <= 0) continue;
    const def = PRESTIGE_UPGRADES.find((u) => u.id === row.upgrade_id);
    if (!def) continue;
    // Las mejoras de REDUCCIÓN (p.ej. build_cost_redux) deben BAJAR el valor.
    // Antes todas devolvían `1 + nivel*perLevel`: para el costo de construcción
    // eso daba 1.25 → multiplicar el costo lo SUBÍA 25% en vez de bajarlo.
    // Piso 0.5 para que nunca llegue a 0 o negativo.
    multipliers[def.bonusKey] = def.reduction
      ? Math.max(0.5, 1 - row.level * def.perLevel)
      : 1 + row.level * def.perLevel;
  }

  return multipliers;
}

module.exports = {
  PRESTIGE_UPGRADES,
  PRESTIGE_MIN_LEVEL,
  getPrestigeInfo,
  executePrestige,
  purchaseUpgrade,
  getMultipliers,
};
