const crypto = require('crypto');
const db = require('../config/database');
const { HEROES, HERO_RARITIES, HERO_ITEMS } = require('../../../shared/gameConfig');

let _playerService = null;
let _tokenService = null;
function getPlayerService() { if (!_playerService) _playerService = require('./playerService'); return _playerService; }
function getTokenService() { if (!_tokenService) _tokenService = require('./tokenService'); return _tokenService; }

// Stat caps used for bar normalisation on the client
const STAT_CAPS = { atk: 50, def: 50, hp: 200, spd: 20, mgk: 50 };

// XP required to reach the next level (level 1→2 costs 100, scaling by 1.4×)
function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.4, level - 1));
}

// Compute effective stats: base × rarity multiplier × level bonus + item bonuses
function computeStats(hero, dbRow) {
  const rarity = HERO_RARITIES[hero.rarity];
  const levelBonus = 1 + (dbRow.level - 1) * 0.05; // +5% per level
  let equipment;
  try { equipment = JSON.parse(dbRow.equipment); } catch { equipment = {}; }

  const stats = {};
  for (const [stat, base] of Object.entries(hero.baseStats)) {
    stats[stat] = Math.round(base * rarity.statMultiplier * levelBonus);
  }

  // Add item bonuses
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

// Weighted random rarity draw
function rollRarity() {
  const total = Object.values(HERO_RARITIES).reduce((s, r) => s + r.weight, 0);
  let roll = crypto.randomInt(0, total);
  for (const [rarityId, r] of Object.entries(HERO_RARITIES)) {
    roll -= r.weight;
    if (roll < 0) return rarityId;
  }
  return 'common';
}

const heroService = {
  STAT_CAPS,

  async getHeroes(playerId) {
    const rows = await db('player_heroes').where('player_id', playerId);
    return rows.map((row) => {
      const hero = HEROES[row.hero_id];
      if (!hero) return null;
      let equipment;
      try { equipment = JSON.parse(row.equipment); } catch { equipment = { weapon: null, armor: null, accessory: null }; }
      return {
        dbId:       row.id,
        heroId:     hero.id,
        name:       hero.name,
        class:      hero.class,
        rarity:     hero.rarity,
        sprite:     hero.sprite,
        passive:    hero.passive,
        level:      row.level,
        xp:         row.xp,
        xpNeeded:   xpForLevel(row.level),
        equipment,
        stats:      computeStats(hero, row),
        obtainedAt: row.obtained_at,
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

  async summonHero(playerId, payWithTokens = true) {
    const rarityId = rollRarity();
    const rarity = HERO_RARITIES[rarityId];

    if (payWithTokens) {
      const tokenData = await db('player_tokens').where('player_id', playerId).first();
      if (!tokenData || tokenData.balance < rarity.summonCost) {
        throw new Error(`Necesitás ${rarity.summonCost} KH Tokens para invocar un héroe ${rarity.name}`);
      }
      // Atomic deduction — safe against concurrent summon requests
      const taken = await db('player_tokens')
        .where('player_id', playerId)
        .decrementIfEnough('balance', rarity.summonCost);
      if (!taken) throw new Error(`Necesitás ${rarity.summonCost} KH Tokens para invocar un héroe ${rarity.name}`);
    } else {
      // Pay with gold (common only)
      if (rarityId !== 'common') throw new Error('Solo podés invocar héroes Comunes con oro');
      await getPlayerService().modifyResource(playerId, 'gold', -500);
    }

    // Pick a random hero of that rarity
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

    // Drop a starter item (random common item)
    const commonItems = Object.values(HERO_ITEMS).filter((i) => i.rarity === 'common');
    const droppedItem = commonItems[crypto.randomInt(0, commonItems.length)];
    const existingItem = await db('player_items')
      .where({ player_id: playerId, item_id: droppedItem.id }).first();
    if (existingItem) {
      await db('player_items').where('id', existingItem.id).increment('quantity', 1);
    } else {
      await db('player_items').insert({ player_id: playerId, item_id: droppedItem.id, quantity: 1 });
    }

    return {
      success:     true,
      heroDbId,
      hero:        hero.id,
      heroName:    hero.name,
      rarity:      rarityId,
      rarityName:  rarity.name,
      droppedItem: droppedItem.name,
      droppedItemIcon: droppedItem.icon,
      message:     `¡${rarity.name}! Invocaste a ${hero.name} y encontraste ${droppedItem.icon} ${droppedItem.name}!`,
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

      await trx('player_heroes').where('id', heroDbId).update({
        level: row.level + 1,
        xp:    0,
      });

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
        .forUpdate()
        .first();
      if (!row) throw new Error('Héroe no encontrado');

      const item = HERO_ITEMS[itemId];
      if (!item) throw new Error('Objeto no válido');

      const playerItem = await trx('player_items')
        .where({ player_id: playerId, item_id: itemId })
        .forUpdate()
        .first();
      if (!playerItem || playerItem.quantity < 1) throw new Error('No tenés ese objeto en el inventario');

      let equipment;
      try { equipment = JSON.parse(row.equipment); } catch { equipment = { weapon: null, armor: null, accessory: null }; }

      // Return currently equipped item to inventory
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

      // Equip new item (decrement inventory)
      equipment[item.slot] = itemId;
      await trx('player_heroes').where('id', heroDbId).update({
        equipment: JSON.stringify(equipment),
      });
      if (playerItem.quantity <= 1) {
        await trx('player_items').where('id', playerItem.id).delete();
      } else {
        await trx('player_items').where('id', playerItem.id).decrement('quantity', 1);
      }

      const hero = HEROES[row.hero_id];
      return {
        success:   true,
        equipment,
        stats:     computeStats(hero, { ...row, equipment: JSON.stringify(equipment) }),
        message:   `${item.icon} ${item.name} equipado en ${hero.name}`,
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

    // Return to inventory
    const existing = await db('player_items')
      .where({ player_id: playerId, item_id: itemId }).first();
    if (existing) {
      await db('player_items').where('id', existing.id).increment('quantity', 1);
    } else {
      await db('player_items').insert({ player_id: playerId, item_id: itemId, quantity: 1 });
    }

    equipment[slot] = null;
    await db('player_heroes').where('id', heroDbId).update({
      equipment: JSON.stringify(equipment),
    });

    const hero = HEROES[row.hero_id];
    return {
      success:   true,
      equipment,
      stats:     computeStats(hero, { ...row, equipment: JSON.stringify(equipment) }),
      message:   `Objeto desequipado de ${hero.name}`,
    };
  },
};

module.exports = heroService;
