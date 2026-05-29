const crypto = require('crypto');
const db = require('../config/database');
const { HEROES, HERO_RARITIES, HERO_ITEMS } = require('../../../shared/gameConfig');

let _playerService = null;
let _tokenService = null;
let _achievementService = null;
function getPlayerService() { if (!_playerService) _playerService = require('./playerService'); return _playerService; }
function getTokenService() { if (!_tokenService) _tokenService = require('./tokenService'); return _tokenService; }
function getAchievementService() { if (!_achievementService) _achievementService = require('./achievementService'); return _achievementService; }

const STAT_CAPS = { atk: 50, def: 50, hp: 200, spd: 20, mgk: 50 };

function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.4, level - 1));
}

function computeStats(hero, dbRow) {
  const rarity = HERO_RARITIES[hero.rarity];
  const levelBonus = 1 + (dbRow.level - 1) * 0.05;
  let equipment;
  try { equipment = JSON.parse(dbRow.equipment); } catch { equipment = {}; }

  const stats = {};
  for (const [stat, base] of Object.entries(hero.baseStats)) {
    stats[stat] = Math.round(base * rarity.statMultiplier * levelBonus);
  }
  for (const itemId of Object.values(equipment)) {
    if (!itemId) continue;
    const item = HERO_ITEMS[itemId];
    if (!item) continue;
    for (const [stat, bonus] of Object.entries(item.bonuses)) {
      stats[stat] = (stats[stat] || 0) + bonus;
    }
  }
  return stats;
}

function rollRarity() {
  const total = Object.values(HERO_RARITIES).reduce((s, r) => s + r.weight, 0);
  let roll = crypto.randomInt(0, total);
  for (const [rarityId, r] of Object.entries(HERO_RARITIES)) {
    roll -= r.weight;
    if (roll < 0) return rarityId;
  }
  return 'common';
}

// Class bonuses applied in battle by combatService
const CLASS_BONUSES = {
  warrior: { attackBonus: 0.15, defDebuff: 0,    lossReduction: 0,    doubleLootChance: 0,    pvpLootBonus: 0,    label: '⚔️ Guerrero: +15% ATK de tropas' },
  mage:    { attackBonus: 0,    defDebuff: 0.15,  lossReduction: 0,    doubleLootChance: 0,    pvpLootBonus: 0,    label: '🔮 Mago: −15% DEF enemiga' },
  ranger:  { attackBonus: 0.10, defDebuff: 0,     lossReduction: 0,    doubleLootChance: 0.05, pvpLootBonus: 0,    label: '🏹 Ranger: +10% ATK + 5% botín doble' },
  paladin: { attackBonus: 0,    defDebuff: 0,     lossReduction: 0.25, doubleLootChance: 0,    pvpLootBonus: 0,    label: '🛡️ Paladín: −25% bajas propias al ganar' },
  rogue:   { attackBonus: 0,    defDebuff: 0,     lossReduction: 0,    doubleLootChance: 0,    pvpLootBonus: 0.10, label: '🗡️ Pícaro: +10% recursos robados en PvP' },
};

const heroService = {
  STAT_CAPS,
  CLASS_BONUSES,

  async getHeroes(playerId) {
    const rows = await db('player_heroes').where('player_id', playerId);
    const player = await db('players').where('telegram_id', playerId).select('deployed_hero_id').first();
    return rows.map((row) => {
      const hero = HEROES[row.hero_id];
      if (!hero) return null;
      let equipment;
      try { equipment = JSON.parse(row.equipment); } catch { equipment = { weapon: null, armor: null, accessory: null }; }
      const inRecovery = !!(row.recovery_until && new Date(row.recovery_until) > new Date());
      return {
        dbId:          row.id,
        heroId:        hero.id,
        name:          hero.name,
        class:         hero.class,
        rarity:        hero.rarity,
        sprite:        hero.sprite,
        passive:       hero.passive,
        level:         row.level,
        xp:            row.xp,
        xpNeeded:      xpForLevel(row.level),
        equipment,
        stats:         computeStats(hero, row),
        obtainedAt:    row.obtained_at,
        deployed:      player?.deployed_hero_id === row.id,
        inRecovery,
        recoveryUntil: row.recovery_until || null,
      };
    }).filter(Boolean);
  },

  async getItems(playerId) {
    const rows = await db('player_items').where('player_id', playerId).where('quantity', '>', 0);
    return rows.map((row) => {
      const item = HERO_ITEMS[row.item_id];
      if (!item) return null;
      return { ...item, quantity: row.quantity, dbId: row.id };
    }).filter(Boolean);
  },

  /**
   * Deploy a hero for combat (only one at a time; hero must not be in recovery).
   */
  async deployHero(playerId, heroDbId) {
    const heroRow = await db('player_heroes')
      .where({ id: heroDbId, player_id: playerId }).first();
    if (!heroRow) throw new Error('Héroe no encontrado');

    if (heroRow.recovery_until && new Date(heroRow.recovery_until) > new Date()) {
      const hoursLeft = Math.ceil((new Date(heroRow.recovery_until) - Date.now()) / 3600000);
      throw new Error(`${HEROES[heroRow.hero_id]?.name || 'Este héroe'} está recuperándose. Disponible en ${hoursLeft}h.`);
    }

    await db('players').where('telegram_id', playerId).update({ deployed_hero_id: heroDbId });

    const heroConfig = HEROES[heroRow.hero_id];
    const bonuses = CLASS_BONUSES[heroConfig.class] || {};
    return {
      success:  true,
      heroName: heroConfig.name,
      class:    heroConfig.class,
      bonus:    bonuses.label || '',
      message:  `${heroConfig.name} desplegado para combate. ${bonuses.label || ''}`,
    };
  },

  /**
   * Recall the active hero (no penalty).
   */
  async recallHero(playerId) {
    await db('players').where('telegram_id', playerId).update({ deployed_hero_id: null });
    return { success: true, message: 'Héroe retirado del campo de batalla.' };
  },

  /**
   * Get deployed hero + bonuses. Returns { hero: null, bonuses: null } when none active or in recovery.
   */
  async getDeployedHero(playerId) {
    const player = await db('players')
      .where('telegram_id', playerId)
      .select('deployed_hero_id')
      .first();
    if (!player?.deployed_hero_id) return { hero: null, bonuses: null };

    const heroRow = await db('player_heroes').where('id', player.deployed_hero_id).first();
    if (!heroRow) {
      await db('players').where('telegram_id', playerId).update({ deployed_hero_id: null });
      return { hero: null, bonuses: null };
    }

    const inRecovery = !!(heroRow.recovery_until && new Date(heroRow.recovery_until) > new Date());
    const heroConfig = HEROES[heroRow.hero_id];
    const stats = computeStats(heroConfig, heroRow);

    return {
      hero: {
        dbId:          heroRow.id,
        heroId:        heroConfig.id,
        name:          heroConfig.name,
        class:         heroConfig.class,
        level:         heroRow.level,
        stats,
        inRecovery,
        recoveryUntil: heroRow.recovery_until || null,
      },
      // Bonuses are null when hero is in recovery — no battle benefit
      bonuses: inRecovery ? null : (CLASS_BONUSES[heroConfig.class] || null),
    };
  },

  /**
   * Put a hero into recovery after losing a battle. Clears deployment.
   * recoveryHours: 24 for PvE loss, 48 for PvP loss.
   */
  async applyHeroRecovery(playerId, heroDbId, recoveryHours = 24) {
    const recoveryUntil = new Date(Date.now() + recoveryHours * 3600000).toISOString();
    await db('player_heroes').where('id', heroDbId).update({ recovery_until: recoveryUntil });
    await db('players').where('telegram_id', playerId).update({ deployed_hero_id: null });
    return { recoveryUntil, recoveryHours };
  },

  async summonHero(playerId, payWithTokens = true) {
    const rarityId = rollRarity();
    const rarity = HERO_RARITIES[rarityId];

    if (payWithTokens) {
      const tokenData = await db('player_tokens').where('player_id', playerId).first();
      if (!tokenData || tokenData.balance < rarity.summonCost) {
        throw new Error(`Necesitás ${rarity.summonCost} KH Tokens para invocar un héroe ${rarity.name}`);
      }
      const taken = await db('player_tokens')
        .where('player_id', playerId)
        .decrementIfEnough('balance', rarity.summonCost);
      if (!taken) throw new Error(`Necesitás ${rarity.summonCost} KH Tokens para invocar un héroe ${rarity.name}`);
    } else {
      if (rarityId !== 'common') throw new Error('Solo podés invocar héroes Comunes con oro');
      await getPlayerService().modifyResource(playerId, 'gold', -500);
    }

    const pool = Object.values(HEROES).filter((h) => h.rarity === rarityId);
    const hero = pool[crypto.randomInt(0, pool.length)];

    const [{ id: heroDbId }] = await db('player_heroes').insert({
      player_id:   playerId,
      hero_id:     hero.id,
      level:       1,
      xp:          0,
      equipment:   JSON.stringify({ weapon: null, armor: null, accessory: null }),
      obtained_at: new Date().toISOString(),
    }).returning('id');

    const commonItems = Object.values(HERO_ITEMS).filter((i) => i.rarity === 'common');
    const droppedItem = commonItems[crypto.randomInt(0, commonItems.length)];
    const existingItem = await db('player_items')
      .where({ player_id: playerId, item_id: droppedItem.id }).first();
    if (existingItem) {
      await db('player_items').where('id', existingItem.id).increment('quantity', 1);
    } else {
      await db('player_items').insert({ player_id: playerId, item_id: droppedItem.id, quantity: 1 });
    }

    try { await getAchievementService().checkAndUnlock(playerId, 'summon', 1); } catch { /* non-blocking */ }

    return {
      success:         true,
      heroDbId,
      hero:            hero.id,
      heroName:        hero.name,
      rarity:          rarityId,
      rarityName:      rarity.name,
      droppedItem:     droppedItem.name,
      droppedItemIcon: droppedItem.icon,
      message:         `¡${rarity.name}! Invocaste a ${hero.name} y encontraste ${droppedItem.icon} ${droppedItem.name}!`,
    };
  },

  async levelUpHero(playerId, heroDbId) {
    return db.transaction(async (trx) => {
      const row = await trx('player_heroes')
        .where({ id: heroDbId, player_id: playerId })
        .forUpdate()
        .first();
      if (!row) throw new Error('Héroe no encontrado');
      if (row.level >= 20) throw new Error('El héroe ya está al nivel máximo (20)');

      const goldCost = 50 * row.level;
      const affected = await trx('player_resources')
        .where({ player_id: playerId, resource_id: 'gold' })
        .where('amount', '>=', goldCost)
        .decrement('amount', goldCost);
      if (!affected) throw new Error(`Necesitás ${goldCost} oro para subir de nivel`);

      await trx('player_heroes').where('id', heroDbId).update({ level: row.level + 1, xp: 0 });

      const hero = HEROES[row.hero_id];
      const updated = { ...row, level: row.level + 1, xp: 0 };
      return {
        success:  true,
        newLevel: updated.level,
        stats:    computeStats(hero, updated),
        message:  `¡${hero.name} subió al nivel ${updated.level}!`,
      };
    });
  },

  async equipItem(playerId, heroDbId, itemId) {
    return db.transaction(async (trx) => {
      const row = await trx('player_heroes')
        .where({ id: heroDbId, player_id: playerId })
        .forUpdate().first();
      if (!row) throw new Error('Héroe no encontrado');

      const item = HERO_ITEMS[itemId];
      if (!item) throw new Error('Objeto no válido');

      const playerItem = await trx('player_items')
        .where({ player_id: playerId, item_id: itemId })
        .forUpdate().first();
      if (!playerItem || playerItem.quantity < 1) throw new Error('No tenés ese objeto en el inventario');

      let equipment;
      try { equipment = JSON.parse(row.equipment); } catch { equipment = { weapon: null, armor: null, accessory: null }; }

      const currentItem = equipment[item.slot];
      if (currentItem) {
        const existing = await trx('player_items')
          .where({ player_id: playerId, item_id: currentItem }).first();
        if (existing) {
          await trx('player_items').where('id', existing.id).increment('quantity', 1);
        } else {
          await trx('player_items').insert({ player_id: playerId, item_id: currentItem, quantity: 1 });
        }
      }

      equipment[item.slot] = itemId;
      await trx('player_heroes').where('id', heroDbId).update({ equipment: JSON.stringify(equipment) });
      if (playerItem.quantity <= 1) {
        await trx('player_items').where('id', playerItem.id).delete();
      } else {
        await trx('player_items').where('id', playerItem.id).decrement('quantity', 1);
      }

      const hero = HEROES[row.hero_id];
      return {
        success:  true,
        equipment,
        stats:    computeStats(hero, { ...row, equipment: JSON.stringify(equipment) }),
        message:  `${item.icon} ${item.name} equipado en ${hero.name}`,
      };
    });
  },

  async unequipItem(playerId, heroDbId, slot) {
    const row = await db('player_heroes')
      .where({ id: heroDbId, player_id: playerId }).first();
    if (!row) throw new Error('Héroe no encontrado');

    let equipment;
    try { equipment = JSON.parse(row.equipment); } catch { equipment = {}; }

    const itemId = equipment[slot];
    if (!itemId) throw new Error('No hay objeto equipado en ese slot');

    const existing = await db('player_items')
      .where({ player_id: playerId, item_id: itemId }).first();
    if (existing) {
      await db('player_items').where('id', existing.id).increment('quantity', 1);
    } else {
      await db('player_items').insert({ player_id: playerId, item_id: itemId, quantity: 1 });
    }

    equipment[slot] = null;
    await db('player_heroes').where('id', heroDbId).update({ equipment: JSON.stringify(equipment) });

    const hero = HEROES[row.hero_id];
    return {
      success:  true,
      equipment,
      stats:    computeStats(hero, { ...row, equipment: JSON.stringify(equipment) }),
      message:  `Objeto desequipado de ${hero.name}`,
    };
  },
};

module.exports = heroService;
