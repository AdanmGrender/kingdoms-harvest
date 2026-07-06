// G2 idle — Escala Galaxia: surcar la Disformidad entre sistemas.
// player_systems: sistemas galácticos reclamados por cada jugador.
// player_warp: estado del Crucero Disforme (una travesía por jugador).
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "player_systems" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "system_id" TEXT NOT NULL,
    "claimed_at" TEXT NOT NULL,
    UNIQUE ("player_id", "system_id")
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_player_systems_player ON "player_systems" ("player_id")'
  );

  await db.raw(`CREATE TABLE IF NOT EXISTS "player_warp" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "target_system" TEXT,
    "arrives_at" TEXT,
    "turbulent" INTEGER NOT NULL DEFAULT 0
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_player_warp_traveling ON "player_warp" ("status", "arrives_at")'
  );
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_player_systems_player');
  await db.raw('DROP TABLE IF EXISTS "player_systems"');
  await db.raw('DROP INDEX IF EXISTS idx_player_warp_traveling');
  await db.raw('DROP TABLE IF EXISTS "player_warp"');
};
