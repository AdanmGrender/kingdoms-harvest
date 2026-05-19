const crypto = require('crypto');
const db = require('../config/database');
const { TROOPS, BUILDINGS, FACTIONS } = require('../../../shared/gameConfig');
const playerService = require('./playerService');
const buildingService = require('./buildingService');
const heroService = require('./heroService');
const territoryService = require('./territoryService');

let _techService = null;
function getTechService() { if (!_techService) _techService = require('./techService'); return _techService; }
const tokenService = require('./tokenService');
const dailyTaskService = require('./dailyTaskService');
const { TOKEN_CONFIG } = require('../../../shared/tokenConfig');

// Secure random float [0, 1) — replaces secureRandom() for fairness
function secureRandom() {
  return crypto.randomInt(0, 2147483647) / 2147483647;
}

// Secure random int in [min, max] inclusive
function secureRandomInt(min, max) {
  return crypto.randomInt(min, max + 1);
}

const combatService = {
  async getTroops(playerId) {
    return db('player_troops').where('player_id', playerId);
  },

  /**
   * Entrenar tropas en el cuartel
   */
  async trainTroops(playerId, troopId, quantity) {
    const troopType = TROOPS[troopId];
    if (!troopType) throw new Error('Tropa no válida');
    if (quantity < 1) throw new Error('Cantidad inválida');

    // Verificar cuartel
    const barracks = await db('player_buildings')
      .where({ player_id: playerId, building_id: 'barracks', is_building: false })
      .first();

    if (!barracks) throw new Error('Necesitás un Cuartel para entrenar tropas');

    // Verificar capacidad
    const maxTroops = barracks.level * BUILDINGS.barracks.troopCapPerLevel;
    const currentTroops = await db('player_troops')
      .where('player_id', playerId)
      .sum('quantity as total')
      .first();

    const totalCurrent = Number(currentTroops?.total || 0);
    if (totalCurrent + quantity > maxTroops) {
      throw new Error(`Capacidad máxima: ${maxTroops}. Tenés ${totalCurrent}. Mejorá el cuartel.`);
    }

    // Calcular coste total
    const totalCost = {};
    for (const [resource, amount] of Object.entries(troopType.cost)) {
      totalCost[resource] = amount * quantity;
    }

    // Cobrar recursos
    await buildingService.payResources(playerId, totalCost);

    const trainTime = troopType.trainTime * quantity;
    const now = new Date();
    const completeAt = new Date(now.getTime() + trainTime);

    // Crear o actualizar registro de tropas
    let troopRecord = await db('player_troops')
      .where({ player_id: playerId, troop_id: troopId })
      .first();

    if (troopRecord) {
      if (troopRecord.training_quantity > 0) {
        throw new Error('Ya estás entrenando este tipo de tropa. Esperá a que termine.');
      }
      await db('player_troops').where('id', troopRecord.id).update({
        training_quantity: quantity,
        training_complete_at: completeAt.toISOString(),
      });
    } else {
      await db('player_troops').insert({
        player_id: playerId,
        troop_id: troopId,
        quantity: 0,
        training_quantity: quantity,
        training_complete_at: completeAt.toISOString(),
      });
    }

    return {
      success: true,
      troopId,
      quantity,
      trainTime,
      completeAt: completeAt.toISOString(),
      message: `Entrenando ${quantity}x ${troopType.icon} ${troopType.name}... Listo en ${Math.round(trainTime / 60000)} min.`,
    };
  },

  /**
   * Motor de combate: calcula el resultado de una batalla
   */
  calculateBattle(attackerArmy, defenderArmy, defenderBuildings = [], opts = {}) {
    const {
      attackBonus = 0, defenseBonus = 0, abilityId = null,
      attackerArmy: rawArmy = attackerArmy,
      heroDefDebuff = 0,      // mage: reduces enemy defensePower
      heroPaladinActive = false, // paladin: reduces attacker losses on win
    } = opts;
    let attackPower = 0;
    let defensePower = 0;
    const battleLog = [];

    // Siege ability effects applied before main calculation
    let abilityAtkMult = 1;
    let abilityDefMult = 1;
    let abilityDefDebuff = 0;
    if (abilityId === 'rally') {
      abilityAtkMult = 1.15;
      battleLog.push('📯 Reagrupar: +15% ATK');
    } else if (abilityId === 'shield_wall') {
      abilityDefMult = 1.25;
      battleLog.push('🛡️ Muro de Escudos: +25% DEF');
    } else if (abilityId === 'arrow_rain') {
      abilityDefDebuff = 0.20;
      battleLog.push('🏹 Lluvia de Flechas: -20% DEF enemiga');
    }

    // Calcular poder de ataque
    for (const [troopId, qty] of Object.entries(attackerArmy)) {
      const troop = TROOPS[troopId];
      if (!troop) continue;

      let atk = troop.atk * qty;

      // Bonus contra tipos específicos — apply once regardless of how many enemy types match
      const defTroopIds = Object.keys(defenderArmy);
      const isStrongVs = defTroopIds.some((id) => troop.strongVs?.includes(id));
      const isWeakVs   = defTroopIds.some((id) => troop.weakVs?.includes(id));
      if (isStrongVs) atk *= 1.3;
      if (isWeakVs)   atk *= 0.7;

      attackPower += atk;
      battleLog.push(`${troop.icon} x${qty} aporta ${Math.floor(atk)} ATK`);
    }

    // Apply faction atk bonus + ability multiplier
    attackPower *= (1 + attackBonus) * abilityAtkMult;

    // Calcular poder de defensa
    for (const [troopId, qty] of Object.entries(defenderArmy)) {
      const troop = TROOPS[troopId];
      if (!troop) continue;

      let def = (troop.def + troop.atk * 0.3) * qty;
      defensePower += def;
      battleLog.push(`Defensor: ${troop.icon} x${qty} aporta ${Math.floor(def)} DEF`);
    }

    // Apply faction def bonus + ability multiplier + arrow_rain debuff + mage hero debuff
    defensePower *= (1 + defenseBonus) * abilityDefMult * (1 - abilityDefDebuff) * (1 - heroDefDebuff);

    // Bonus de edificios defensivos
    for (const building of defenderBuildings) {
      if (building.building_id === 'wall') {
        defensePower += building.level * BUILDINGS.wall.hpPerLevel;
      }
      if (building.building_id === 'tower') {
        defensePower += building.level * BUILDINGS.tower.atkPerLevel;
      }
      if (building.building_id === 'trap') {
        attackPower -= building.level * BUILDINGS.trap.trapDamage;
      }
    }

    attackPower = Math.max(attackPower, 0);

    // Attacker first-strike initiative: +10% to attack power
    attackPower *= 1.1;

    // Resultado: ratio de poder
    const totalPower = attackPower + defensePower;
    const attackRatio = totalPower > 0 ? attackPower / totalPower : 0.5;

    // Agregar algo de aleatoriedad (±10%)
    const randomFactor = 0.9 + secureRandom() * 0.2;
    const finalRatio = attackRatio * randomFactor;

    const attackerWins = finalRatio > 0.5;

    // Calcular pérdidas (el perdedor pierde más)
    const winnerLossRate = 0.1 + (1 - Math.abs(finalRatio - 0.5) * 2) * 0.3;
    const loserLossRate = 0.5 + Math.abs(finalRatio - 0.5) * 0.4;

    const attackerLosses = {};
    const defenderLosses = {};

    for (const [troopId, qty] of Object.entries(attackerArmy)) {
      let lossRate = attackerWins ? winnerLossRate : loserLossRate;
      // Paladin hero reduces own losses by 25% on victory
      if (heroPaladinActive && attackerWins) lossRate *= (1 - 0.25);
      attackerLosses[troopId] = Math.floor(qty * lossRate);
    }

    for (const [troopId, qty] of Object.entries(defenderArmy)) {
      const lossRate = attackerWins ? loserLossRate : winnerLossRate;
      defenderLosses[troopId] = Math.floor(qty * lossRate);
    }

    return {
      winner: attackerWins ? 'attacker' : 'defender',
      attackPower: Math.floor(attackPower),
      defensePower: Math.floor(defensePower),
      attackerLosses,
      defenderLosses,
      battleLog,
    };
  },

  /**
   * Ataque PvE contra territorio neutral
   */
  async attackPVE(playerId, army, territoryId, abilityId = null) {
    army = this.sanitizeArmy(army);
    await this.validateArmy(playerId, army);

    // Apply faction atk/def bonus + tech bonuses
    const player = await db('players').where('telegram_id', playerId).first();
    const factionAtkBonus = FACTIONS[player?.faction_id]?.bonus?.atk || 0;
    const factionDefBonus = FACTIONS[player?.faction_id]?.bonus?.def || 0;
    const completedTechs = await getTechService().getCompletedTechs(playerId);
    const techAtkBonus = (completedTechs.has('sharp_blades') ? 0.1 : 0) +
                         (completedTechs.has('tactics') ? 0.15 : 0);
    const techDefBonus = completedTechs.has('reinforced_armor') ? 0.1 : 0;

    // Fetch deployed hero bonuses
    const { hero: deployedHero, bonuses: heroBonuses } = await heroService.getDeployedHero(playerId);
    const heroAtkBonus  = heroBonuses?.attackBonus       || 0;
    const heroDefDebuff = heroBonuses?.defDebuff         || 0;
    const paladinActive = !!(heroBonuses?.lossReduction);
    const rangerActive  = !!(heroBonuses?.doubleLootChance);

    // Generar ejército NPC basado en territorio
    const territory = territoryId
      ? await db('territories').where('id', territoryId).first()
      : null;

    const npcStrength = territory ? territory.defense_strength : 50;
    const npcArmy = this.generateNPCArmy(npcStrength);

    // Calcular batalla con bonuses de facción, tech y héroe
    const result = this.calculateBattle(army, npcArmy, [], {
      attackBonus:       factionAtkBonus + techAtkBonus + heroAtkBonus,
      defenseBonus:      factionDefBonus + techDefBonus,
      abilityId,
      attackerArmy:      army,
      heroDefDebuff,
      heroPaladinActive: paladinActive,
    });

    // Aplicar pérdidas al atacante (clamped para evitar negativos)
    for (const [troopId, losses] of Object.entries(result.attackerLosses)) {
      if (losses > 0) {
        const record = await db('player_troops')
          .where({ player_id: playerId, troop_id: troopId }).first();
        const actualLoss = Math.min(losses, record?.quantity || 0);
        if (actualLoss > 0) {
          await db('player_troops')
            .where({ player_id: playerId, troop_id: troopId })
            .decrement('quantity', actualLoss);
        }
      }
    }

    // Generar botín si ganó
    let loot = {};
    if (result.winner === 'attacker') {
      loot = {
        gold: Math.floor(npcStrength * (2 + secureRandom() * 3)),
        xp: Math.floor(npcStrength * 1.5),
      };

      // Chance de recurso raro
      if (secureRandom() < 0.15) {
        const rareItems = ['crystal', 'relic', 'blueprint'];
        const rareItem = rareItems[Math.floor(secureRandom() * rareItems.length)];
        loot[rareItem] = 1;
      }

      // Ranger: 5% chance de duplicar botín
      if (rangerActive && secureRandom() < (heroBonuses.doubleLootChance || 0)) {
        for (const key of Object.keys(loot)) {
          if (typeof loot[key] === 'number') loot[key] *= 2;
        }
        loot._rangerDoubled = true;
      }

      // Dar recompensas
      for (const [resource, amount] of Object.entries(loot)) {
        if (resource === 'xp') {
          await playerService.addXP(playerId, amount);
        } else if (resource !== '_rangerDoubled') {
          await playerService.modifyResource(playerId, resource, amount);
        }
      }

      // Dar KH Tokens + trackear tarea diaria
      const tokenResult = await tokenService.awardTokens(playerId, TOKEN_CONFIG.TOKENS_PER_PVE_WIN, 'pve');
      await dailyTaskService.trackProgress(playerId, 'battle_win');
      loot.tokensAwarded = tokenResult.awarded;
    }

    // Héroe entra en recuperación si el jugador pierde
    let heroRecovery = null;
    if (result.winner !== 'attacker' && deployedHero) {
      heroRecovery = await heroService.applyHeroRecovery(playerId, deployedHero.dbId, 24);
    }

    // Claim territory for player's faction on PvE victory
    let territoryClaimed = null;
    if (result.winner === 'attacker' && territoryId) {
      try {
        territoryClaimed = await territoryService.claimTerritory(playerId, territoryId);
      } catch { /* non-blocking */ }
    }

    // Guardar batalla
    await db('battles').insert({
      attacker_id: playerId,
      territory_id: territoryId,
      type: 'pve',
      attacker_army: JSON.stringify(army),
      defender_army: JSON.stringify(npcArmy),
      result: JSON.stringify(result),
      winner: result.winner,
      loot: JSON.stringify(loot),
      resolved_at: new Date().toISOString(),
    });

    const tokensAwarded = loot.tokensAwarded || 0;
    const rangerDoubled = loot._rangerDoubled || false;
    delete loot.tokensAwarded;
    delete loot._rangerDoubled;

    return {
      ...result,
      loot,
      tokensAwarded,
      heroBonusLabel:  heroBonuses?.label || null,
      heroRecovery,
      territoryClaimed,
      message: result.winner === 'attacker'
        ? `¡Victoria!${rangerDoubled ? ' 🏹 Botín doble (Ranger)!' : ''}${territoryClaimed ? ` 🏳️ ${territoryClaimed.territoryName} conquistado!` : ''} Botín: ${Object.entries(loot).map(([k, v]) => `${v} ${k}`).join(', ')}`
        : `Derrota... tus tropas se retiran.${heroRecovery ? ` ${deployedHero?.name || 'Tu héroe'} se recuperará en 24h.` : ''}`,
    };
  },

  /**
   * Ataque PvP contra otro jugador
   */
  async attackPVP(playerId, army, defenderId, abilityId = null) {
    if (playerId === defenderId) throw new Error('No podés atacarte a vos mismo');

    // Cooldown: no atacar al mismo jugador dentro de 30 minutos
    const PVP_COOLDOWN_MS = 30 * 60 * 1000;
    const recentAttack = await db('battles')
      .where({ attacker_id: playerId, defender_id: defenderId, type: 'pvp' })
      .orderBy('id', 'desc')
      .first();

    if (recentAttack && recentAttack.resolved_at) {
      const elapsed = Date.now() - new Date(recentAttack.resolved_at).getTime();
      if (elapsed < PVP_COOLDOWN_MS) {
        const remaining = Math.ceil((PVP_COOLDOWN_MS - elapsed) / 60000);
        throw new Error(`Debés esperar ${remaining} minutos para atacar a este jugador de nuevo`);
      }
    }

    army = this.sanitizeArmy(army);
    await this.validateArmy(playerId, army);

    // Obtener tropas y edificios del defensor
    const defenderTroops = await db('player_troops').where('player_id', defenderId);
    const defenderBuildings = await db('player_buildings')
      .where('player_id', defenderId)
      .whereIn('building_id', ['wall', 'tower', 'trap']);

    const defenderArmy = {};
    defenderTroops.forEach((t) => {
      if (t.quantity > 0) defenderArmy[t.troop_id] = t.quantity;
    });

    const attacker = await db('players').where('telegram_id', playerId).first();
    const defender = await db('players').where('telegram_id', defenderId).first();
    const attackerFactionAtk = FACTIONS[attacker?.faction_id]?.bonus?.atk || 0;
    const defenderFactionDef = FACTIONS[defender?.faction_id]?.bonus?.def || 0;

    // Fetch deployed hero bonuses
    const { hero: deployedHero, bonuses: heroBonuses } = await heroService.getDeployedHero(playerId);
    const heroAtkBonus  = heroBonuses?.attackBonus   || 0;
    const heroDefDebuff = heroBonuses?.defDebuff     || 0;
    const paladinActive = !!(heroBonuses?.lossReduction);
    const rogueActive   = !!(heroBonuses?.pvpLootBonus);

    const result = this.calculateBattle(army, defenderArmy, defenderBuildings, {
      attackBonus:       attackerFactionAtk + heroAtkBonus,
      defenseBonus:      defenderFactionDef,
      abilityId,
      attackerArmy:      army,
      heroDefDebuff,
      heroPaladinActive: paladinActive,
    });

    // Aplicar pérdidas a ambos (clamped para evitar negativos)
    for (const [troopId, losses] of Object.entries(result.attackerLosses)) {
      if (losses > 0) {
        const record = await db('player_troops')
          .where({ player_id: playerId, troop_id: troopId }).first();
        const actualLoss = Math.min(losses, record?.quantity || 0);
        if (actualLoss > 0) {
          await db('player_troops')
            .where({ player_id: playerId, troop_id: troopId })
            .decrement('quantity', actualLoss);
        }
      }
    }

    for (const [troopId, losses] of Object.entries(result.defenderLosses)) {
      if (losses > 0) {
        const record = await db('player_troops')
          .where({ player_id: defenderId, troop_id: troopId }).first();
        const actualLoss = Math.min(losses, record?.quantity || 0);
        if (actualLoss > 0) {
          await db('player_troops')
            .where({ player_id: defenderId, troop_id: troopId })
            .decrement('quantity', actualLoss);
        }
      }
    }

    // Si el atacante gana, roba recursos (con escudo mínimo de 50 por recurso)
    let loot = {};
    if (result.winner === 'attacker') {
      const defResources = await db('player_resources').where('player_id', defenderId);
      // Rogue: +10% steal rate
      const stealRate = 0.1 * (1 + (heroBonuses?.pvpLootBonus || 0));
      const RESOURCE_SHIELD = 50;

      for (const res of defResources) {
        const stealable = Math.max(0, res.amount - RESOURCE_SHIELD);
        const stolen = Math.floor(stealable * stealRate);
        if (stolen > 0) {
          loot[res.resource_id] = stolen;
          await playerService.modifyResource(defenderId, res.resource_id, -stolen);
          await playerService.modifyResource(playerId, res.resource_id, stolen);
        }
      }

      await playerService.addXP(playerId, 50);

      // Dar KH Tokens + trackear tarea diaria
      await tokenService.awardTokens(playerId, TOKEN_CONFIG.TOKENS_PER_PVP_WIN, 'pvp');
      await dailyTaskService.trackProgress(playerId, 'battle_win');
    }

    // Héroe entra en recuperación 48h si el jugador pierde
    let heroRecovery = null;
    if (result.winner !== 'attacker' && deployedHero) {
      heroRecovery = await heroService.applyHeroRecovery(playerId, deployedHero.dbId, 48);
    }

    await db('battles').insert({
      attacker_id: playerId,
      defender_id: defenderId,
      type: 'pvp',
      attacker_army: JSON.stringify(army),
      defender_army: JSON.stringify(defenderArmy),
      result: JSON.stringify(result),
      winner: result.winner,
      loot: JSON.stringify(loot),
      resolved_at: new Date().toISOString(),
    });

    return {
      ...result,
      loot,
      heroBonusLabel: heroBonuses?.label || null,
      heroRecovery,
    };
  },

  /**
   * Sanitiza y valida un army object contra prototype pollution y valores inválidos
   */
  sanitizeArmy(army) {
    const clean = {};
    for (const [troopId, qty] of Object.entries(army)) {
      if (!/^[a-z_]+$/.test(troopId)) continue;
      if (!TROOPS[troopId]) continue;
      const n = Number(qty);
      if (!Number.isInteger(n) || n < 1) continue;
      clean[troopId] = n;
    }
    if (Object.keys(clean).length === 0) {
      throw new Error('Ejército vacío o inválido');
    }
    return clean;
  },

  /**
   * Valida que el jugador tiene las tropas del ejército
   */
  async validateArmy(playerId, army) {
    for (const [troopId, qty] of Object.entries(army)) {
      if (!TROOPS[troopId]) throw new Error(`Tropa inválida: ${troopId}`);
      if (qty < 1) throw new Error('Cantidad inválida');

      const record = await db('player_troops')
        .where({ player_id: playerId, troop_id: troopId })
        .first();

      if (!record || record.quantity < qty) {
        throw new Error(`No tenés suficientes ${TROOPS[troopId].name}. Tenés ${record?.quantity || 0}, necesitás ${qty}`);
      }
    }
  },

  /**
   * Genera un ejército NPC basado en fuerza
   */
  generateNPCArmy(strength) {
    const army = {};
    const troopTypes = Object.keys(TROOPS);
    let remaining = strength;

    while (remaining > 0) {
      const troopId = troopTypes[Math.floor(secureRandom() * troopTypes.length)];
      const troop = TROOPS[troopId];
      const maxQty = Math.ceil(remaining / troop.atk);
      const qty = Math.max(1, Math.floor(secureRandom() * maxQty));

      army[troopId] = (army[troopId] || 0) + qty;
      remaining -= troop.atk * qty;
    }

    return army;
  },

  async getBattleHistory(playerId) {
    return db('battles')
      .where('attacker_id', playerId)
      .orWhere('defender_id', playerId)
      .orderBy('resolved_at', 'desc')
      .limit(20);
  },
};

module.exports = combatService;
