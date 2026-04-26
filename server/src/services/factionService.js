/**
 * Faction service — read-only view of factions, members, and faction-points
 * leaderboard. Joining a faction lives in playerService.joinFaction so the
 * "you need an Embassy" + "already in a faction" rules stay co-located with
 * the player record.
 */
const db = require('../config/database');
const { FACTIONS } = require('../../../shared/gameConfig');

const factionService = {
  /**
   * List every faction with its current member count, territory count, and a
   * synthesized total of faction_points contributed by all its members.
   * Useful for a faction-overview screen.
   */
  async listFactions() {
    const rows = await db('factions');
    // Aggregate faction_points across members in one pass per faction. Each
    // factions row already stores total_members + territory_count via
    // joinFaction / conquest paths, but those can drift — recompute member
    // count here too so the UI sees ground truth.
    const result = [];
    for (const f of rows) {
      const members = await db('players').where('faction_id', f.id);
      const totalPoints = members.reduce((acc, p) => acc + (p.faction_points || 0), 0);
      result.push({
        id: f.id,
        name: f.name,
        icon: f.icon,
        color: f.color,
        description: f.description,
        bonus: safeJsonParse(f.bonus, {}),
        member_count: members.length,
        territory_count: f.territory_count || 0,
        total_points: totalPoints,
      });
    }
    // Sort: most points first (faction war standings)
    result.sort((a, b) => b.total_points - a.total_points);
    return result;
  },

  /**
   * Top contributors inside one faction. Returns up to `limit` players sorted
   * by faction_points desc.
   */
  async getMembers(factionId, limit = 20) {
    if (!FACTIONS[factionId]) throw new Error('Facción no válida');
    return db('players')
      .where('faction_id', factionId)
      .select('telegram_id as id', 'display_name', 'level', 'faction_points')
      .orderBy('faction_points', 'desc')
      .orderBy('level', 'desc')
      .limit(limit);
  },
};

function safeJsonParse(s, fallback) {
  try { return JSON.parse(s); } catch { return fallback; }
}

module.exports = factionService;
