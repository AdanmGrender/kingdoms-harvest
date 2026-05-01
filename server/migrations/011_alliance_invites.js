/**
 * Migration 011: Alliance invitations + officer role.
 *
 * alliance_invitations — leader/officer can invite specific players. Pending
 * invites coexist with the existing open-join path; an invited player just
 * has an alternative "accept" flow that auto-skips the capacity check at
 * issue time (re-checked at accept).
 *
 * Status: 'pending' | 'accepted' | 'rejected' | 'cancelled'
 *
 * The `role` column on alliance_members already exists (added in mig 007).
 * Values now include 'officer' as middle tier — only the role *string* is
 * new, no schema change needed.
 */

exports.up = function (db) {
  db.raw(`CREATE TABLE IF NOT EXISTS alliance_invitations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alliance_id INTEGER NOT NULL,
    invited_by_player_id BIGINT NOT NULL,
    invited_player_id BIGINT NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TEXT NOT NULL,
    responded_at TEXT DEFAULT NULL
  )`);
  db.raw('CREATE INDEX IF NOT EXISTS idx_invites_invited ON alliance_invitations (invited_player_id, status)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_invites_alliance ON alliance_invitations (alliance_id, status)');
};

exports.down = function (db) {
  db.raw('DROP INDEX IF EXISTS idx_invites_invited');
  db.raw('DROP INDEX IF EXISTS idx_invites_alliance');
  db.raw('DROP TABLE IF EXISTS alliance_invitations');
};
