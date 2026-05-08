const db = require('../config/database');
const { TROOPS, SIEGE_CONFIG, SIEGE_ABILITIES } = require('../../../shared/gameConfig');
const combatService = require('./combatService');
const playerService = require('./playerService');

const siegeService = {
  /**
   * Declare war: march troops toward a defender. Creates a siege record.
   */
  async declareWar(attackerId, defenderId, army) {
    if (attackerId === defenderId) throw new Error('No podés atacarte a vos mismo');

    // Check no active siege from this attacker
    const activeSiege = await db('sieges')
      .where('attacker_id', attackerId)
      .whereIn('status', ['marching', 'fighting'])
      .first();
    if (activeSiege) throw new Error('Ya tenés un asedio en curso');

    // Validate and sanitize army
    army = combatService.sanitizeArmy(army);
    await combatService.validateArmy(attackerId, army);

    // Deduct troops from player (they're marching)
    for (const [troopId, qty] of Object.entries(army)) {
      await db('player_troops')
        .where({ player_id: attackerId, troop_id: troopId })
        .decrement('quantity', qty);
    }

    // Calculate march time based on army speed
    let slowestSpeed = Infinity;
    for (const [troopId] of Object.entries(army)) {
      const troop = TROOPS[troopId];
      if (troop && troop.speed < slowestSpeed) slowestSpeed = troop.speed;
    }

    // March time inversely proportional to speed, clamped
    const marchTime = Math.min(
      SIEGE_CONFIG.maxMarchTime,
      Math.max(SIEGE_CONFIG.baseMarchTime, Math.floor(SIEGE_CONFIG.baseMarchTime * (10 / slowestSpeed)))
    );

    const now = new Date();
    const arrivesAt = new Date(now.getTime() + marchTime);

    const [siegeId] = await db('sieges').insert({
      attacker_id: attackerId,
      defender_id: defenderId,
      status: 'marching',
      attacker_army: JSON.stringify(army),
      defender_army: null,
      march_started_at: now.toISOString(),
      arrives_at: arrivesAt.toISOString(),
      resolved_at: null,
      result: null,
      loot: null,
    });

    return {
      siegeId,
      marchTime,
      arrivesAt: arrivesAt.toISOString(),
      army,
      message: `Tropas en marcha! Llegada en ${Math.ceil(marchTime / 60000)} min.`,
    };
  },

  /**
   * Use a special ability during an active siege.
   */
  async useAbility(playerId, siegeId, abilityId) {
    const ability = SIEGE_ABILITIES[abilityId];
    if (!ability) throw new Error('Habilidad no válida');

    const siege = await db('sieges').where('id', siegeId).first();
    if (!siege) throw new Error('Asedio no encontrado');
    if (siege.attacker_id !== playerId) throw new Error('No es tu asedio');
    if (siege.status !== 'fighting') throw new Error('El asedio no está en combate');

    // Check requirements
    let army;
    try { army = JSON.parse(siege.attacker_army); } catch { army = {}; }
    for (const [troopId, minQty] of Object.entries(ability.requires)) {
      if (!army[troopId] || army[troopId] < minQty) {
        throw new Error(`Necesitás al menos ${minQty} ${TROOPS[troopId]?.name || troopId}`);
      }
    }

    // Store ability usage in siege result
    const currentResult = siege.result ? JSON.parse(siege.result) : {};
    const usedAbilities = currentResult.abilities || [];
    usedAbilities.push({ id: abilityId, usedAt: new Date().toISOString() });
    currentResult.abilities = usedAbilities;

    await db('sieges').where('id', siegeId).update({
      result: JSON.stringify(currentResult),
    });

    return {
      success: true,
      ability: ability.name,
      message: `${ability.icon} ${ability.name}: ${ability.description}`,
    };
  },

  /**
   * Process sieges that have arrived (called from gameTick).
   */
  async processArrivedSieges(io) {
    const now = new Date().toISOString();
    const arrivedSieges = await db('sieges')
      .where('status', 'marching')
      .where('arrives_at', '<=', now);

    for (const siege of arrivedSieges) {
      try {
        await this.resolveSiege(siege, io);
      } catch (err) {
        console.error(`[Siege] Error resolving siege ${siege.id}:`, err.message);
      }
    }
  },

  /**
   * Resolve a siege battle.
   */
  async resolveSiege(siege, io) {
    let attackerArmy;
    try { attackerArmy = JSON.parse(siege.attacker_army); } catch { attackerArmy = {}; }

    // Get defender's troops and buildings
    const defenderTroops = await db('player_troops').where('player_id', siege.defender_id);
    const defenderBuildings = await db('player_buildings')
      .where('player_id', siege.defender_id)
      .whereIn('building_id', ['wall', 'tower', 'trap']);

    const defenderArmy = {};
    defenderTroops.forEach((t) => {
      if (t.quantity > 0) defenderArmy[t.troop_id] = t.quantity;
    });

    // Apply used abilities as modifiers
    const siegeResult = siege.result ? JSON.parse(siege.result) : {};
    let attackModifier = 1;
    let defenseModifier = 1;

    if (siegeResult.abilities) {
      for (const used of siegeResult.abilities) {
        const ab = SIEGE_ABILITIES[used.id];
        if (!ab) continue;
        switch (ab.effect.type) {
          case 'buff_attack': attackModifier += ab.effect.value; break;
          case 'buff_defense': defenseModifier += ab.effect.value; break;
          case 'debuff_defense': defenseModifier -= ab.effect.value; break;
        }
      }
    }

    // Run combat engine
    const result = combatService.calculateBattle(attackerArmy, defenderArmy, defenderBuildings);

    // Apply modifiers
    result.attackPower = Math.floor(result.attackPower * attackModifier);
    result.defensePower = Math.floor(result.defensePower * defenseModifier);

    // Re-determine winner with modifiers
    const totalPower = result.attackPower + result.defensePower;
    const attackerWins = totalPower > 0 ? (result.attackPower / totalPower) > 0.5 : false;
    result.winner = attackerWins ? 'attacker' : 'defender';

    // Apply defender losses
    for (const [troopId, losses] of Object.entries(result.defenderLosses)) {
      if (losses > 0) {
        const record = await db('player_troops')
          .where({ player_id: siege.defender_id, troop_id: troopId }).first();
        const actualLoss = Math.min(losses, record?.quantity || 0);
        if (actualLoss > 0) {
          await db('player_troops')
            .where({ player_id: siege.defender_id, troop_id: troopId })
            .decrement('quantity', actualLoss);
        }
      }
    }

    // Return surviving attackers
    const survivingArmy = {};
    for (const [troopId, qty] of Object.entries(attackerArmy)) {
      const lost = result.attackerLosses[troopId] || 0;
      const surviving = Math.max(0, qty - lost);
      if (surviving > 0) {
        survivingArmy[troopId] = surviving;
        // Add back to player troops
        await db('player_troops')
          .where({ player_id: siege.attacker_id, troop_id: troopId })
          .increment('quantity', surviving);
      }
    }

    // Calculate loot if attacker wins
    let loot = {};
    if (attackerWins) {
      const defResources = await db('player_resources').where('player_id', siege.defender_id);
      for (const res of defResources) {
        const stealable = Math.max(0, res.amount - SIEGE_CONFIG.resourceShield);
        const stolen = Math.floor(stealable * SIEGE_CONFIG.lootRate);
        if (stolen > 0) {
          loot[res.resource_id] = stolen;
          await playerService.modifyResource(siege.defender_id, res.resource_id, -stolen);
          await playerService.modifyResource(siege.attacker_id, res.resource_id, stolen);
        }
      }
      await playerService.addXP(siege.attacker_id, 100);
    }

    // Update siege record
    await db('sieges').where('id', siege.id).update({
      status: 'resolved',
      defender_army: JSON.stringify(defenderArmy),
      resolved_at: new Date().toISOString(),
      result: JSON.stringify({ ...result, abilities: siegeResult.abilities || [] }),
      loot: JSON.stringify(loot),
    });

    // Notify both players
    if (io) {
      const notification = {
        siegeId: siege.id,
        winner: result.winner,
        loot,
        attackerLosses: result.attackerLosses,
        defenderLosses: result.defenderLosses,
      };
      io.to(`player_${siege.attacker_id}`).emit('siege_resolved', notification);
      io.to(`player_${siege.defender_id}`).emit('siege_resolved', notification);
    }
  },

  /**
   * Get active/recent sieges for a player.
   */
  async getSieges(playerId) {
    return db('sieges')
      .where('attacker_id', playerId)
      .orWhere('defender_id', playerId)
      .orderBy('id', 'desc')
      .limit(20);
  },
};

module.exports = siegeService;
