/**
 * Achievement service — tracks per-event progress and unlocks once the
 * configured goal is reached. Rewards are claimed explicitly by the player
 * (one-shot) so unlocks don't auto-mint KH unprompted.
 *
 * Catalog lives in shared/gameConfig.js → ACHIEVEMENTS.
 *
 * Trigger pattern (called from gameplay services):
 *   await achievementService.checkAndUnlock(playerId, 'harvest', 1);
 *   await achievementService.checkAndUnlock(playerId, 'level_up', newLevel);
 *
 * For counter-style achievements (harvest 25), pass the increment (typically 1).
 * For threshold-style achievements (level_up to 5), pass the absolute value
 * the player is now at — the service uses Math.max(progress, value) so it
 * naturally handles either pattern.
 */
const db = require('../config/database');
const { ACHIEVEMENTS } = require('../../../shared/gameConfig');

// Lazy-loaded to avoid circular dep with tokenService
let _tokenService = null;
function getTokenService() {
  if (!_tokenService) _tokenService = require('./tokenService');
  return _tokenService;
}

const achievementService = {
  /**
   * Bump progress on every achievement that listens to `event`. If progress
   * reaches the goal, marks unlocked_at. Idempotent — already-unlocked rows
   * are not re-touched.
   *
   * Returns the array of newly-unlocked achievement IDs (usually empty).
   */
  async checkAndUnlock(playerId, event, value = 1) {
    if (!playerId || !event) return [];
    const newlyUnlocked = [];
    const now = new Date().toISOString();

    for (const ach of Object.values(ACHIEVEMENTS)) {
      if (ach.event !== event) continue;

      let row = await db('player_achievements')
        .where({ player_id: playerId, achievement_id: ach.id })
        .first();

      if (row?.unlocked_at) continue; // already unlocked, nothing to do

      // For threshold-style events (level_up: value = currentLevel) we want
      // max(progress, value). For counter-style (harvest: value = 1) we want
      // progress + value. Heuristic: if `value` could plausibly be a level/
      // total (>1 in a single call), treat as max; otherwise increment.
      const useMax = event === 'level_up';
      const newProgress = useMax
        ? Math.max(row?.progress || 0, value)
        : (row?.progress || 0) + value;

      const reachedGoal = newProgress >= ach.goal;

      if (!row) {
        await db('player_achievements').insert({
          player_id: playerId,
          achievement_id: ach.id,
          progress: newProgress,
          unlocked_at: reachedGoal ? now : null,
        });
      } else {
        await db('player_achievements').where('id', row.id).update({
          progress: newProgress,
          unlocked_at: reachedGoal ? now : null,
        });
      }

      if (reachedGoal) newlyUnlocked.push(ach.id);
    }

    return newlyUnlocked;
  },

  /**
   * Returns every achievement in the catalog enriched with this player's
   * progress + unlock + claim state. Locked achievements show progress=0.
   */
  async listForPlayer(playerId) {
    const rows = await db('player_achievements').where('player_id', playerId);
    const byId = new Map(rows.map((r) => [r.achievement_id, r]));
    return Object.values(ACHIEVEMENTS).map((ach) => {
      const row = byId.get(ach.id);
      const unlocked = !!row?.unlocked_at;
      return {
        id: ach.id,
        name: ach.name,
        icon: ach.icon,
        desc: ach.desc,
        goal: ach.goal,
        reward: ach.reward,
        progress: row?.progress || 0,
        unlocked,
        unlocked_at: row?.unlocked_at || null,
        reward_claimed: !!row?.reward_claimed_at,
        reward_claimed_at: row?.reward_claimed_at || null,
      };
    });
  },

  /**
   * Pay out the KH reward for a single unlocked-but-unclaimed achievement.
   */
  async claimReward(playerId, achievementId) {
    const ach = ACHIEVEMENTS[achievementId];
    if (!ach) throw new Error('Logro inválido');

    const row = await db('player_achievements')
      .where({ player_id: playerId, achievement_id: achievementId })
      .first();
    if (!row?.unlocked_at) throw new Error('Todavía no desbloqueaste este logro');
    if (row.reward_claimed_at) throw new Error('Recompensa ya reclamada');

    let awarded = 0;
    if (ach.reward?.kh) {
      const r = await getTokenService().awardTokens(playerId, ach.reward.kh, 'achievement');
      awarded = r.awarded;
    }

    const now = new Date().toISOString();
    await db('player_achievements').where('id', row.id).update({
      reward_claimed_at: now,
    });

    return {
      success: true,
      awarded,
      message: `¡Reclamaste ${awarded} KH por "${ach.name}"!`,
    };
  },
};

module.exports = achievementService;
