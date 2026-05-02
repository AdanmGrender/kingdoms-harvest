/**
 * Migration 012: Wars (alliance vs alliance + faction-wide).
 *
 * alliance_wars — leader-declared 24h windows where two alliances earn
 *   points for PvP wins against each other. Winner gets KH bonus.
 *
 * faction_wars — server-wide 24h windows where faction_points count double.
 *   Auto-rotates from gameTick. Faction with most points during window
 *   wins; all its members get a KH bonus + a notification.
 *
 * faction_war_log — append-only ledger of points earned during a faction
 *   war. Decoupled from players.faction_points (which is the all-time
 *   total) so we can compute "this war only" easily without snapshots.
 */

exports.up = function (db) {
  db.raw(`CREATE TABLE IF NOT EXISTS alliance_wars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alliance_a_id INTEGER NOT NULL,
    alliance_b_id INTEGER NOT NULL,
    started_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    winner_alliance_id INTEGER DEFAULT NULL,
    score_a INTEGER DEFAULT 0,
    score_b INTEGER DEFAULT 0
  )`);
  db.raw('CREATE INDEX IF NOT EXISTS idx_alliance_wars_active ON alliance_wars (status, ends_at)');

  db.raw(`CREATE TABLE IF NOT EXISTS faction_wars (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1,
    winner_faction_id TEXT DEFAULT NULL,
    finalized_at TEXT DEFAULT NULL
  )`);
  db.raw('CREATE INDEX IF NOT EXISTS idx_faction_wars_active ON faction_wars (is_active, ends_at)');

  db.raw(`CREATE TABLE IF NOT EXISTS faction_war_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    faction_war_id INTEGER NOT NULL,
    faction_id TEXT NOT NULL,
    player_id BIGINT NOT NULL,
    points INTEGER NOT NULL,
    source TEXT,
    created_at TEXT NOT NULL
  )`);
  db.raw('CREATE INDEX IF NOT EXISTS idx_faction_war_log_war ON faction_war_log (faction_war_id, faction_id)');
};

exports.down = function (db) {
  db.raw('DROP INDEX IF EXISTS idx_faction_war_log_war');
  db.raw('DROP TABLE IF EXISTS faction_war_log');
  db.raw('DROP INDEX IF EXISTS idx_faction_wars_active');
  db.raw('DROP TABLE IF EXISTS faction_wars');
  db.raw('DROP INDEX IF EXISTS idx_alliance_wars_active');
  db.raw('DROP TABLE IF EXISTS alliance_wars');
};
