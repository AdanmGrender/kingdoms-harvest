exports.up = async function (db) {
  await db.raw('ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "prestige_count" INTEGER DEFAULT 0');
  await db.raw('ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "prestige_points" INTEGER DEFAULT 0');
  await db.raw(`CREATE TABLE IF NOT EXISTS "prestige_upgrades" (
    "id" SERIAL PRIMARY KEY,
    "player_id" BIGINT NOT NULL,
    "upgrade_id" TEXT NOT NULL,
    "level" INTEGER DEFAULT 0,
    UNIQUE ("player_id", "upgrade_id")
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_prestige_upgrades_player ON "prestige_upgrades" ("player_id")');
};

exports.down = async function (db) {
  await db.raw('DROP TABLE IF EXISTS "prestige_upgrades"');
};
