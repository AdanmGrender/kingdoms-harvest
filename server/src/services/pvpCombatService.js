// server/src/services/pvpCombatService.js
const { generateRandomNumber } = require('../utils/randomUtils');
const { calculateCombatDamage } = require('../utils/combatUtils');
const { getDatabase } = require('../config/database');

class PvPCombatService {
  constructor() {
    this.db = getDatabase();
  }

  /**
   * Start a new PvP battle between two players
   * @param {number} attackerId - The ID of the attacking player
   * @param {number} defenderId - The ID of the defending player
   * @returns {Promise<Object>} Battle information
   */
  async startBattle(attackerId, defenderId) {
    // Validate players exist
    const attacker = await this.db('players').where({ id: attackerId }).first();
    const defender = await this.db('players').where({ id: defenderId }).first();
    
    if (!attacker || !defender) {
      throw new Error('One or both players not found');
    }

    // Check if players are the same
    if (attackerId === defenderId) {
      throw new Error('Cannot battle against yourself');
    }

    // Get player stats for combat
    const attackerStats = await this.getPlayerCombatStats(attackerId);
    const defenderStats = await this.getPlayerCombatStats(defenderId);

    // Create battle record
    const battleData = {
      attacker_id: attackerId,
      defender_id: defenderId,
      attacker_health: attackerStats.maxHealth,
      defender_health: defenderStats.maxHealth,
      attacker_max_health: attackerStats.maxHealth,
      defender_max_health: defenderStats.maxHealth,
      attacker_damage: attackerStats.damage,
      defender_damage: defenderStats.damage,
      attacker_treasure: attacker.treasure,
      defender_treasure: defender.treasure,
      attacker_tokens: attacker.tokens,
      defender_tokens: defender.tokens,
      attacker_xp_gained: 0,
      defender_xp_gained: 0,
      attacker_gold_gained: 0,
      defender_gold_gained: 0,
      status: 'active'
    };

    const [battleId] = await this.db('pvp_battles').insert(battleData).returning('id');
    
    return {
      battleId,
      attacker: {
        id: attackerId,
        name: attacker.name,
        health: attackerStats.maxHealth,
        maxHealth: attackerStats.maxHealth,
        damage: attackerStats.damage
      },
      defender: {
        id: defenderId,
        name: defender.name,
        health: defenderStats.maxHealth,
        maxHealth: defenderStats.maxHealth,
        damage: defenderStats.damage
      },
      startTime: new Date()
    };
  }

  /**
   * Process a battle turn
   * @param {number} battleId - The ID of the battle
   * @param {number} attackerId - The ID of the attacking player
   * @param {number} defenderId - The ID of the defending player
   * @param {number} action - The action being performed (1 = attack, 2 = defend, etc.)
   * @returns {Promise<Object>} Battle update information
   */
  async processTurn(battleId, attackerId, defenderId, action = 1) {
    // Get current battle state
    const battle = await this.db('pvp_battles').where({ id: battleId }).first();
    
    if (!battle) {
      throw new Error('Battle not found');
    }

    if (battle.status !== 'active') {
      throw new Error('Battle is not active');
    }

    // Validate players
    const attacker = await this.db('players').where({ id: attackerId }).first();
    const defender = await this.db('players').where({ id: defenderId }).first();
    
    if (!attacker || !defender) {
      throw new Error('One or both players not found');
    }

    // Calculate damage
    let damageDealt = 0;
    let defenderHealth = battle.defender_health;
    let attackerHealth = battle.attacker_health;
    let battleDuration = 0;

    if (action === 1) { // Attack
      damageDealt = calculateCombatDamage(battle.attacker_damage, battle.defender_damage);
      defenderHealth = Math.max(0, battle.defender_health - damageDealt);
    }

    // Update battle state
    const updateData = {
      defender_health: defenderHealth,
      attacker_health: attackerHealth,
      updated_at: new Date()
    };

    // Check if battle is over
    let winnerId = null;
    if (defenderHealth <= 0) {
      winnerId = attackerId;
      updateData.status = 'completed';
      battleDuration = Date.now() - new Date(battle.created_at).getTime();
      updateData.battle_duration = battleDuration;
      
      // Award rewards
      const rewards = await this.calculateBattleRewards(attackerId, defenderId);
      updateData.attacker_xp_gained = rewards.attackerXp;
      updateData.defender_xp_gained = rewards.defenderXp;
      updateData.attacker_gold_gained = rewards.attackerGold;
      updateData.defender_gold_gained = rewards.defenderGold;
      
      // Update player stats
      await this.updatePlayerStats(attackerId, rewards.attackerXp, rewards.attackerGold, true);
      await this.updatePlayerStats(defenderId, rewards.defenderXp, rewards.defenderGold, false);
    }

    await this.db('pvp_battles').where({ id: battleId }).update(updateData);

    return {
      battleId,
      attackerHealth: attackerHealth,
      defenderHealth: defenderHealth,
      damageDealt: damageDealt,
      winnerId: winnerId,
      isBattleOver: !!winnerId
    };
  }

  /**
   * Get player combat stats for battle
   * @param {number} playerId - The ID of the player
   * @returns {Promise<Object>} Player combat stats
   */
  async getPlayerCombatStats(playerId) {
    const player = await this.db('players').where({ id: playerId }).first();
    
    if (!player) {
      throw new Error('Player not found');
    }

    // Calculate damage based on player level and equipment
    const baseDamage = 10 + (player.level * 2);
    const maxHealth = 100 + (player.level * 10);
    
    return {
      damage: baseDamage,
      maxHealth: maxHealth
    };
  }

  /**
   * Calculate battle rewards
   * @param {number} attackerId - The ID of the attacking player
   * @param {number} defenderId - The ID of the defending player
   * @returns {Promise<Object>} Battle rewards
   */
  async calculateBattleRewards(attackerId, defenderId) {
    // Simple reward calculation based on player levels
    const attacker = await this.db('players').where({ id: attackerId }).first();
    const defender = await this.db('players').where({ id: defenderId }).first();
    
    const attackerLevel = attacker.level;
    const defenderLevel = defender.level;
    
    // Base XP and gold rewards
    const baseXp = 50;
    const baseGold = 25;
    
    // Calculate XP based on level difference
    const levelDifference = defenderLevel - attackerLevel;
    let xpMultiplier = 1.0;
    
    if (levelDifference > 0) {
      // Defender is higher level
      xpMultiplier = 1.0 + (levelDifference * 0.1);
    } else if (levelDifference < 0) {
      // Attacker is higher level
      xpMultiplier = 1.0 + (Math.abs(levelDifference) * 0.05);
    }
    
    // Calculate gold based on level difference
    let goldMultiplier = 1.0;
    if (levelDifference > 0) {
      goldMultiplier = 1.0 + (levelDifference * 0.05);
    } else if (levelDifference < 0) {
      goldMultiplier = 1.0 + (Math.abs(levelDifference) * 0.1);
    }
    
    const attackerXp = Math.floor(baseXp * xpMultiplier);
    const defenderXp = Math.floor(baseXp * (1.0 / xpMultiplier));
    const attackerGold = Math.floor(baseGold * goldMultiplier);
    const defenderGold = Math.floor(baseGold * (1.0 / goldMultiplier));
    
    return {
      attackerXp,
      defenderXp,
      attackerGold,
      defenderGold
    };
  }

  /**
   * Update player stats after battle
   * @param {number} playerId - The ID of the player
   * @param {number} xpGained - XP gained
   * @param {number} goldGained - Gold gained
   * @param {boolean} isWinner - Whether player won the battle
   * @returns {Promise<void>}
   */
  async updatePlayerStats(playerId, xpGained, goldGained, isWinner) {
    await this.db('players')
      .where({ id: playerId })
      .increment('xp', xpGained)
      .increment('gold', goldGained)
      .increment(isWinner ? 'pvp_wins' : 'pvp_losses', 1);
  }

  /**
   * Get player's PvP battle history
   * @param {number} playerId - The ID of the player
   * @param {number} limit - Number of battles to return
   * @returns {Promise<Array>} Battle history
   */
  async getPlayerBattleHistory(playerId, limit = 10) {
    return await this.db('pvp_battles')
      .where(function() {
        this.where('attacker_id', playerId).orWhere('defender_id', playerId);
      })
      .orderBy('created_at', 'desc')
      .limit(limit);
  }

  /**
   * Get current battle status
   * @param {number} battleId - The ID of the battle
   * @returns {Promise<Object>} Battle status
   */
  async getBattleStatus(battleId) {
    const battle = await this.db('pvp_battles').where({ id: battleId }).first();
    
    if (!battle) {
      throw new Error('Battle not found');
    }

    return {
      id: battle.id,
      attackerId: battle.attacker_id,
      defenderId: battle.defender_id,
      attackerHealth: battle.attacker_health,
      defenderHealth: battle.defender_health,
      status: battle.status,
      createdAt: battle.created_at,
      duration: battle.battle_duration
    };
  }
}

module.exports = new PvPCombatService();