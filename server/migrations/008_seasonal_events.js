/**
 * Migration 008: Seasonal events — server-wide buffs that rotate every
 * SEASONAL_EVENTS[id].durationMs and apply to every player.
 *
 * Only one row is `is_active=1` at a time; gameTick rotates by flipping
 * the expired row off and inserting the next event in the catalog cycle.
 * Catalog itself lives in shared/gameConfig.js → SEASONAL_EVENTS.
 */

exports.up = function (db) {
  db.raw(`CREATE TABLE IF NOT EXISTS seasonal_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id TEXT NOT NULL,
    starts_at TEXT NOT NULL,
    ends_at TEXT NOT NULL,
    is_active INTEGER DEFAULT 1
  )`);
  db.raw('CREATE INDEX IF NOT EXISTS idx_events_active_ends ON seasonal_events (is_active, ends_at)');
};

exports.down = function (db) {
  db.raw('DROP INDEX IF EXISTS idx_events_active_ends');
  db.raw('DROP TABLE IF EXISTS seasonal_events');
};
