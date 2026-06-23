/**
 * Faction war — server-wide 24h windows where the four factions compete
 * for points. Most actions that already grant `players.faction_points`
 * also write to `faction_war_log` so we can compute "this war only"
 * standings without snapshots.
 *
 * Auto-rotates from gameTick: when the active war ends, settle (find the
 * top faction, award its members) and start a fresh window. There's
 * always exactly one active row.
 */
const db = require('../config/database');
const { FACTIONS } = require('../../../shared/gameConfig');

const FACTION_WAR_DURATION_MS = 24 * 60 * 60 * 1000; // 24h
const WAR_WINNER_BONUS_KH = 50;

let _tokenService = null;
function getTokenService() {
  if (!_tokenService) _tokenService = require('./tokenService');
  return _tokenService;
}
let _notifyService = null;
function getNotifyService() {
  if (!_notifyService) _notifyService = require('./notifyService');
  return _notifyService;
}

const factionWarService = {
  /** Currently-running faction war row (or null). */
  async getActive() {
    return db('faction_wars').where('is_active', 1).orderBy('id', 'desc').first();
  },

  /**
   * Append a row to the war log. Called whenever any of the gameplay paths
   * that grant `players.faction_points` runs (conquest, defense, etc.).
   * No-ops if no active war or no faction.
   */
  async logPoints(playerId, factionId, points, source) {
    if (!playerId || !factionId || !points) return;
    const active = await this.getActive();
    if (!active) return;
    try {
      await db('faction_war_log').insert({
        faction_war_id: active.id,
        faction_id: factionId,
        player_id: playerId,
        points,
        source: source || 'unknown',
        created_at: new Date().toISOString(),
      });
    } catch {}
  },

  /**
   * Standings: total points per faction during the active war.
   * Returns an array of { faction_id, total } sorted desc.
   */
  async getStandings() {
    const active = await this.getActive();
    if (!active) return [];
    const rows = await db('faction_war_log')
      .where('faction_war_id', active.id)
      .select('faction_id', 'points');
    const totals = new Map();
    for (const r of rows) {
      totals.set(r.faction_id, (totals.get(r.faction_id) || 0) + r.points);
    }
    // Include zero-point factions so the UI always shows all 4 even if no
    // one has scored yet.
    for (const id of Object.keys(FACTIONS)) {
      if (!totals.has(id)) totals.set(id, 0);
    }
    return [...totals.entries()]
      .map(([faction_id, total]) => ({ faction_id, total }))
      .sort((a, b) => b.total - a.total);
  },

  async _settle(warRow) {
    const standings = await this.getStandings();
    const winner = standings[0];
    if (!winner || winner.total <= 0) {
      // No one scored — close the war without a winner
      await db('faction_wars').where('id', warRow.id).update({
        is_active: 0,
        finalized_at: new Date().toISOString(),
      });
      return null;
    }
    await db('faction_wars').where('id', warRow.id).update({
      is_active: 0,
      winner_faction_id: winner.faction_id,
      finalized_at: new Date().toISOString(),
    });

    // Award all members of the winning faction
    const members = await db('players').where('faction_id', winner.faction_id);
    for (const m of members) {
      try {
        await getTokenService().awardTokens(m.telegram_id, WAR_WINNER_BONUS_KH, 'faction_war');
        const factionConfig = FACTIONS[winner.faction_id];
        getNotifyService().sendBotDM(
          m.telegram_id,
          `${factionConfig?.icon || '🏆'} ¡${factionConfig?.name || winner.faction_id} ganó la Guerra de Facciones! +${WAR_WINNER_BONUS_KH} KH para todos sus miembros.`,
        );
      } catch (err) {
        console.error('[FactionWar] Award failed:', err.message);
      }
    }
    return winner.faction_id;
  },

  /**
   * gameTick hook — settle expired + start fresh window so there's always
   * exactly one active. Idempotent.
   */
  async tick() {
    const now = new Date();
    const nowIso = now.toISOString();

    const expired = await db('faction_wars')
      .where('is_active', 1)
      .where('ends_at', '<=', nowIso);
    for (const w of expired) {
      try { await this._settle(w); } catch (err) {
        console.error('[FactionWar] Settle failed:', err.message);
      }
    }

    const stillActive = await this.getActive();
    if (stillActive) return;

    const ends = new Date(now.getTime() + FACTION_WAR_DURATION_MS);
    await db('faction_wars').insert({
      started_at: nowIso,
      ends_at: ends.toISOString(),
      is_active: 1,
    });
  },
};

module.exports = factionWarService;
