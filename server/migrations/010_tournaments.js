/**
 * Migration 010: Tournaments — timed competitions over the existing rankings.
 *
 * tournaments — server-wide rotating events with a category (kh/level/
 *   faction_points), a window, and a prize pool. Only one is `is_active=1`
 *   at a time per type, but multiple types can run concurrently.
 *
 * tournament_entries — per-player baseline at the moment they first show
 *   activity during the tournament. score_now is the live value for the
 *   tournament's metric; final rank is computed at end via score_now -
 *   score_at_start.
 *
 * Catalog of tournament types lives in shared/gameConfig.js.
 */

exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS tournaments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    finalized_at TEXT DEFAULT NULL
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_tournaments_active ON tournaments (is_active, ends_at)');

  await db.raw(`CREATE TABLE IF NOT EXISTS tournament_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tournament_id INTEGER NOT NULL,
    player_id BIGINT NOT NULL,
    score_at_start INTEGER DEFAULT 0,
    score_now INTEGER DEFAULT 0,
    UNIQUE(tournament_id, player_id)
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_tournament_entries_tournament ON tournament_entries (tournament_id, score_now DESC)');
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_tournament_entries_tournament');
  await db.raw('DROP TABLE IF EXISTS tournament_entries');
  await db.raw('DROP INDEX IF EXISTS idx_tournaments_active');
  await db.raw('DROP TABLE IF EXISTS tournaments');
};
