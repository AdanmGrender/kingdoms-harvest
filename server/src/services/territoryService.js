const db = require('../config/database');
const { TERRITORY_TYPES, FACTIONS } = require('../../../shared/gameConfig');

const territoryService = {
  async getTerritories() {
    const rows = await db('territories');
    return rows.map((t) => this._format(t));
  },

  async getTerritory(id) {
    const t = await db('territories').where('id', id).first();
    if (!t) throw new Error('Territorio no encontrado');
    return this._format(t);
  },

  /**
   * Claim a territory for the player's faction after winning a PvE battle.
   * No-ops silently if the player has no faction or the territory doesn't exist.
   */
  async claimTerritory(playerId, territoryId) {
    const player = await db('players').where('telegram_id', playerId).select('faction_id').first();
    if (!player?.faction_id) return null;

    const territory = await db('territories').where('id', territoryId).first();
    if (!territory) return null;

    if (territory.owner_faction_id === player.faction_id) return null; // Already ours

    const previousFactionId = territory.owner_faction_id;

    await db('territories').where('id', territoryId).update({
      owner_faction_id:    player.faction_id,
      conquered_at:        new Date().toISOString(),
      conqueror_player_id: playerId,
    });

    // Adjust faction territory counts
    if (previousFactionId && previousFactionId !== player.faction_id) {
      const prev = await db('factions').where('id', previousFactionId).select('territory_count').first();
      if (prev && Number(prev.territory_count) > 0) {
        await db('factions').where('id', previousFactionId).decrement('territory_count', 1);
      }
    }
    await db('factions').where('id', player.faction_id).increment('territory_count', 1);

    const factionName = FACTIONS[player.faction_id]?.name || player.faction_id;
    return {
      territoryId,
      territoryName:  territory.name,
      factionId:      player.faction_id,
      factionName,
    };
  },

  /**
   * Distribute passive resource bonuses to all players in factions that own territories.
   * Called by gameTick every 30 minutes.
   * Returns the number of individual resource increments applied.
   */
  async applyTerritoryBonuses() {
    const territories = await db('territories').whereNotNull('owner_faction_id');
    if (territories.length === 0) return 0;

    let applied = 0;
    for (const territory of territories) {
      let bonus;
      try { bonus = JSON.parse(territory.resources_bonus); } catch { continue; }
      if (!bonus || Object.keys(bonus).length === 0) continue;

      const players = await db('players')
        .where('faction_id', territory.owner_faction_id)
        .select('telegram_id');

      for (const { telegram_id } of players) {
        for (const [resource, amount] of Object.entries(bonus)) {
          try {
            const updated = await db('player_resources')
              .where({ player_id: telegram_id, resource_id: resource })
              .increment('amount', amount);
            if (updated) applied++;
          } catch { /* resource row may not exist for newer resources */ }
        }
      }
    }
    return applied;
  },

  _format(t) {
    const typeConfig = TERRITORY_TYPES[t.type] || {};
    let bonus;
    try { bonus = JSON.parse(t.resources_bonus); } catch { bonus = {}; }

    const ownerFactionName = t.owner_faction_id
      ? (FACTIONS[t.owner_faction_id]?.name || t.owner_faction_id)
      : 'Neutral';

    return {
      id:              t.id,
      name:            t.name,
      type:            t.type,
      typeIcon:        typeConfig.icon  || '🏳️',
      typeLabel:       typeConfig.label || t.type,
      bonusDesc:       typeConfig.bonusDesc || '',
      gridX:           t.grid_x,
      gridY:           t.grid_y,
      defenseStrength: t.defense_strength,
      ownerFactionId:  t.owner_faction_id   || null,
      ownerFactionName,
      conqueredAt:     t.conquered_at       || null,
      conquerorPlayerId: t.conqueror_player_id || null,
      bonus,
    };
  },
};

module.exports = territoryService;
