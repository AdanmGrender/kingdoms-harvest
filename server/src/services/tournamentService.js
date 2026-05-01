/**
 * Tournament service — timed competitions layered over the existing
 * rankings. Each tournament tracks the *delta* of a player's metric over
 * the window, not the absolute value, so latecomers aren't penalized.
 *
 * gameTick.tick() rotates: when an active tournament's window ends, mark
 * it `is_active=0`, distribute prizes to top 3, and start the next entry
 * in the rotation.
 *
 * Player entries are *lazy-created* the first time their score is read
 * during the active window — saves writing 1000 rows up front for
 * players who may never participate.
 */
const db = require('../config/database');
const {
  TOURNAMENTS,
  TOURNAMENT_ROTATION,
} = require('../../../shared/gameConfig');

// Lazy require to dodge circular-import risk with notify/token services
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

const tournamentService = {
  /**
   * Pull the current absolute value of the metric for a player. Used to
   * snapshot at first activity AND to compute live score = now - start.
   */
  async _readMetric(playerId, metric) {
    if (metric === 'kh') {
      const row = await db('player_tokens').where('player_id', playerId).first();
      return row?.total_earned || 0;
    }
    if (metric === 'xp') {
      const row = await db('players').where('telegram_id', playerId).first();
      // Synthesize a monotonically growing score: level * 1e6 + xp so a
      // level-up always counts as positive progress regardless of the
      // xp reset that happens at level boundaries.
      return ((row?.level || 1) * 1_000_000) + (row?.xp || 0);
    }
    if (metric === 'faction_points') {
      const row = await db('players').where('telegram_id', playerId).first();
      return row?.faction_points || 0;
    }
    return 0;
  },

  async getActiveTournaments() {
    const rows = await db('tournaments').where('is_active', 1);
    return rows.map((r) => ({ ...r, ...TOURNAMENTS[r.type] }));
  },

  /**
   * Live leaderboard for a single tournament — top N players by
   * (score_now - score_at_start) descending. Reads score_now eagerly so
   * the leaderboard is always fresh; the per-player update happens
   * implicitly via the entry refresh below.
   */
  async getLeaderboard(tournamentId, limit = 10) {
    const t = await db('tournaments').where('id', tournamentId).first();
    if (!t) return [];
    const config = TOURNAMENTS[t.type];
    if (!config) return [];

    const entries = await db('tournament_entries').where('tournament_id', tournamentId);

    // Refresh each entry's score_now so the leaderboard reflects current values
    for (const e of entries) {
      const liveScore = await this._readMetric(e.player_id, config.metric);
      if (liveScore !== e.score_now) {
        await db('tournament_entries').where('id', e.id).update({ score_now: liveScore });
        e.score_now = liveScore;
      }
    }

    // Sort by delta descending
    const ranked = entries
      .map((e) => ({ ...e, delta: e.score_now - e.score_at_start }))
      .sort((a, b) => b.delta - a.delta)
      .slice(0, limit);

    if (ranked.length === 0) return [];

    const playerIds = ranked.map((r) => r.player_id);
    const players = await db('players')
      .whereIn('telegram_id', playerIds)
      .select('telegram_id', 'display_name', 'level');
    const pMap = new Map(players.map((p) => [p.telegram_id, p]));
    return ranked.map((r, i) => ({
      rank: i + 1,
      player_id: r.player_id,
      display_name: pMap.get(r.player_id)?.display_name || 'Anónimo',
      level: pMap.get(r.player_id)?.level || 1,
      delta: r.delta,
    }));
  },

  /**
   * Ensure a tournament_entries row exists for this player in every
   * active tournament. Snapshots their starting metric once.
   */
  async ensureEntries(playerId) {
    const active = await db('tournaments').where('is_active', 1);
    for (const t of active) {
      const exists = await db('tournament_entries')
        .where({ tournament_id: t.id, player_id: playerId })
        .first();
      if (exists) continue;
      const config = TOURNAMENTS[t.type];
      if (!config) continue;
      const score = await this._readMetric(playerId, config.metric);
      try {
        await db('tournament_entries').insert({
          tournament_id: t.id,
          player_id: playerId,
          score_at_start: score,
          score_now: score,
        });
      } catch {
        // race or unique conflict — safe to ignore
      }
    }
  },

  /**
   * Pick the next tournament type after the current one (round-robin).
   * Concurrent tournament types are independent — `currentType` is
   * specific to one rotation slot.
   */
  _nextType(currentType) {
    if (!currentType || !TOURNAMENT_ROTATION.includes(currentType)) {
      return TOURNAMENT_ROTATION[0];
    }
    const idx = TOURNAMENT_ROTATION.indexOf(currentType);
    return TOURNAMENT_ROTATION[(idx + 1) % TOURNAMENT_ROTATION.length];
  },

  /**
   * Settle one tournament: finalize prizes for top 3, mark inactive.
   */
  async _settleTournament(tournamentRow) {
    const config = TOURNAMENTS[tournamentRow.type];
    if (!config) return;
    const leaderboard = await this.getLeaderboard(tournamentRow.id, 3);
    for (const entry of leaderboard) {
      const prize = config.prizes?.[entry.rank];
      if (!prize || prize <= 0) continue;
      try {
        await getTokenService().awardTokens(entry.player_id, prize, 'tournament');
        getNotifyService().sendBotDM(
          entry.player_id,
          `🏆 ¡Terminaste #${entry.rank} en "${config.name}" ${config.icon}! +${prize} KH como premio.`,
        );
      } catch (err) {
        console.error('[Tournament] Prize award failed:', err.message);
      }
    }
    await db('tournaments').where('id', tournamentRow.id).update({
      is_active: 0,
      finalized_at: new Date().toISOString(),
    });
  },

  /**
   * gameTick hook — close expired tournaments + start next rotation entry.
   * Idempotent.
   */
  async tick() {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1) Settle expired
    const expired = await db('tournaments')
      .where('is_active', 1)
      .where('ends_at', '<=', nowIso);
    for (const t of expired) {
      try { await this._settleTournament(t); } catch (err) {
        console.error('[Tournament] Settle failed:', err.message);
      }
    }

    // 2) Make sure every rotation type has an active tournament running.
    //    Each type rotates independently — keeps multiple types running
    //    concurrently so a player who doesn't care about KH still has XP
    //    and faction tournaments to chase.
    for (const type of TOURNAMENT_ROTATION) {
      const stillActive = await db('tournaments')
        .where({ type, is_active: 1 })
        .first();
      if (stillActive) continue;
      const config = TOURNAMENTS[type];
      if (!config) continue;
      const ends = new Date(now.getTime() + config.durationMs);
      try {
        await db('tournaments').insert({
          type,
          starts_at: nowIso,
          ends_at: ends.toISOString(),
          is_active: 1,
        });
      } catch (err) {
        console.error('[Tournament] Failed to start tournament:', err.message);
      }
    }
  },
};

module.exports = tournamentService;
