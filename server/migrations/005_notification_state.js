/**
 * Migration 005: Push-notification idempotency + opt-out
 *
 * - `player_animals.notified_at` — timestamp set the first time gameTick fires
 *   the "animal product ready" notification. Stays set until the player feeds
 *   or collects (both reset it to NULL). Without this column the tick re-fired
 *   the notification every minute the animal sat ready.
 *
 * - `players.notif_enabled` — opt-out flag for ALL push notifications (bot
 *   DM and websocket). Defaults to 1 (on) so existing players keep receiving.
 *
 * Other event paths (crops, buildings, troops) already mutate state when
 * firing, so they are inherently idempotent — no column needed there.
 */

exports.up = async function (db) {
  await db.raw('ALTER TABLE player_animals ADD COLUMN notified_at TEXT DEFAULT NULL');
  await db.raw('ALTER TABLE players ADD COLUMN notif_enabled INTEGER DEFAULT 1');
};

exports.down = async function (db) {
  await db.raw('ALTER TABLE player_animals DROP COLUMN notified_at');
  await db.raw('ALTER TABLE players DROP COLUMN notif_enabled');
};
