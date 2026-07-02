/**
 * Migration 006: Player achievements progress + claim state.
 *
 * One row per (player_id, achievement_id) pair. progress is the running
 * counter against the achievement's target (e.g. "harvest 10 crops" stays
 * at 0..10 then unlocks). unlocked_at is set when the criteria is met;
 * reward_claimed_at is set the first time the player claims the KH bonus.
 *
 * Achievements catalog itself lives in shared/gameConfig.js → ACHIEVEMENTS,
 * not in the DB — game-balance changes belong in code, not data.
 */

exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS player_achievements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player_id BIGINT NOT NULL,
    achievement_id TEXT NOT NULL,
    progress INTEGER DEFAULT 0,
    unlocked_at TEXT DEFAULT NULL,
    reward_claimed_at TEXT DEFAULT NULL,
    UNIQUE(player_id, achievement_id)
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements (player_id)');
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_player_achievements_player');
  await db.raw('DROP TABLE IF EXISTS player_achievements');
};
