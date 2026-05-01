/**
 * Territory service — list of territories with current owner faction, plus the
 * conquest path (attack a territory; on win, your faction takes ownership).
 *
 * The actual battle is delegated to combatService.attackPVE — this service
 * adds the world-map flip on top.
 */
const db = require('../config/database');
const playerService = require('./playerService');
const combatService = require('./combatService');
const achievementService = require('./achievementService');
// notifyService imported lazily inside distributePassiveBonuses to avoid
// pulling Telegram bot init into request paths.

// Faction points awarded to the conquering player. Tracked per-player so the
// faction-internal leaderboard can rank contributors. Faction-level totals
// are aggregated on read in factionService.
const POINTS_PER_CONQUEST = 50;

const territoryService = {
  /**
   * List territories with their owner faction (if any). Resource bonuses are
   * pre-parsed for the client.
   */
  async listTerritories() {
    const territories = await db('territories').orderBy('id', 'asc');
    const factions = await db('factions').select('id', 'name', 'icon', 'color');
    const factionMap = new Map(factions.map((f) => [f.id, f]));
    return territories.map((t) => ({
      id: t.id,
      name: t.name,
      grid_x: t.grid_x,
      grid_y: t.grid_y,
      type: t.type,
      defense_strength: t.defense_strength,
      resources_bonus: safeJsonParse(t.resources_bonus, {}),
      owner: t.owner_faction_id ? factionMap.get(t.owner_faction_id) || null : null,
    }));
  },

  /**
   * Wraps combatService.attackPVE for a specific territory and, on a winning
   * battle, transfers the territory to the player's faction (if any) and
   * awards faction_points to that player.
   *
   * Returns the battle result enriched with `territoryFlipped` boolean and
   * the new owner faction id when applicable.
   */
  async attackTerritory(playerId, territoryId, army, abilityId) {
    const territory = await db('territories').where('id', territoryId).first();
    if (!territory) throw new Error('Territorio no encontrado');

    const player = await db('players').where('telegram_id', playerId).first();
    if (!player) throw new Error('Jugador no encontrado');

    if (territory.owner_faction_id && territory.owner_faction_id === player.faction_id) {
      throw new Error('Tu facción ya controla este territorio');
    }

    // Run the existing PvE engine — it already handles army validation,
    // losses, loot, XP, KH tokens, and battle history.
    const battle = await combatService.attackPVE(playerId, army, territoryId, abilityId);

    let territoryFlipped = false;
    let newOwnerFactionId = null;
    if (battle?.winner === 'attacker' && player.faction_id) {
      const previousOwner = territory.owner_faction_id;
      newOwnerFactionId = player.faction_id;
      await db('territories').where('id', territoryId).update({
        owner_faction_id: newOwnerFactionId,
      });
      // Decrement prior owner's territory count, increment new owner's
      if (previousOwner && previousOwner !== newOwnerFactionId) {
        await db('factions').where('id', previousOwner).decrement('territory_count', 1);
      }
      if (previousOwner !== newOwnerFactionId) {
        await db('factions').where('id', newOwnerFactionId).increment('territory_count', 1);
        await db('players').where('telegram_id', playerId).increment('faction_points', POINTS_PER_CONQUEST);
        territoryFlipped = true;
        achievementService.checkAndUnlock(playerId, 'conquest', 1).catch(() => {});
      }
    }

    return {
      ...battle,
      territoryFlipped,
      newOwnerFactionId,
      pointsAwarded: territoryFlipped ? POINTS_PER_CONQUEST : 0,
    };
  },
};

function safeJsonParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

/**
 * Hourly cron hook — distribute the resources_bonus from each territory to
 * its owner faction's members. Per-faction totals are summed across that
 * faction's territories, divided evenly across active members, and capped
 * at each member's per-resource capacity (handled by modifyResource).
 *
 * Idempotent: gameTick triggers this every hour. Members get nothing if
 * their faction owns no territories.
 *
 * Hour-stamped state (last_passive_tick) keeps a sliding throttle so a
 * server restart doesn't double-pay if the cron lands twice within the
 * window.
 */
let _lastPassiveTickAt = 0;
const PASSIVE_INTERVAL_MS = 60 * 60 * 1000; // 1 hour

territoryService.distributePassiveBonuses = async function distributePassiveBonuses() {
  const now = Date.now();
  if (now - _lastPassiveTickAt < PASSIVE_INTERVAL_MS) return 0;
  _lastPassiveTickAt = now;

  const territories = await db('territories').whereNotNull('owner_faction_id');
  if (territories.length === 0) return 0;

  // Sum bonuses per faction across all owned territories
  const factionBonuses = new Map(); // faction_id → { resource: total }
  for (const t of territories) {
    const bonus = safeJsonParse(t.resources_bonus, {});
    if (!factionBonuses.has(t.owner_faction_id)) factionBonuses.set(t.owner_faction_id, {});
    const acc = factionBonuses.get(t.owner_faction_id);
    for (const [res, amount] of Object.entries(bonus)) {
      acc[res] = (acc[res] || 0) + amount;
    }
  }

  let memberCount = 0;
  let notify = null;
  try { notify = require('./notifyService'); } catch {}

  for (const [factionId, bonuses] of factionBonuses) {
    const members = await db('players').where('faction_id', factionId).select('telegram_id');
    if (members.length === 0) continue;

    // Divide each resource equally; floor so we never overshoot the pool
    const perMember = {};
    for (const [res, total] of Object.entries(bonuses)) {
      const per = Math.floor(total / members.length);
      if (per > 0) perMember[res] = per;
    }
    if (Object.keys(perMember).length === 0) continue;

    for (const m of members) {
      memberCount++;
      for (const [res, amount] of Object.entries(perMember)) {
        try { await playerService.modifyResource(m.telegram_id, res, amount); } catch {}
      }
      // Single DM summarizing the haul (rate-limited via notifyService opt-out)
      if (notify) {
        const summary = Object.entries(perMember)
          .map(([k, v]) => `+${v} ${k}`)
          .join(', ');
        notify.sendBotDM(m.telegram_id, `🏴 Tributo de territorio: ${summary}`);
      }
    }
  }
  return memberCount;
};

module.exports = territoryService;
