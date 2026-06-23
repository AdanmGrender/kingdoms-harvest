exports.up = async function (db) {
  // Probe pragma — sql.js rejects ADD COLUMN IF NOT EXISTS, so check manually.
  const cols = await db.raw('PRAGMA table_info("players")');
  const colRows = Array.isArray(cols) ? cols : (cols?.rows || []);
  const names = new Set(colRows.map((c) => c.name));
  if (!names.has('prestige_count')) {
    await db.raw('ALTER TABLE "players" ADD COLUMN "prestige_count" INTEGER DEFAULT 0');
  }
  if (!names.has('prestige_points')) {
    await db.raw('ALTER TABLE "players" ADD COLUMN "prestige_points" INTEGER DEFAULT 0');
  }
  await db.raw(`CREATE TABLE IF NOT EXISTS "prestige_upgrades" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" INTEGER NOT NULL,
    "upgrade_id" TEXT NOT NULL,
    "level" INTEGER DEFAULT 0,
    UNIQUE ("player_id", "upgrade_id")
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_prestige_upgrades_player ON "prestige_upgrades" ("player_id")');
};

exports.down = async function (db) {
  await db.raw('DROP TABLE IF EXISTS "prestige_upgrades"');
};
