exports.up = async function (db) {
  // sql.js (bundled SQLite) rejects ADD COLUMN IF NOT EXISTS — probe instead.
  const cols = await db.raw('PRAGMA table_info("players")');
  const colRows = Array.isArray(cols) ? cols : (cols?.rows || []);
  if (!colRows.some((c) => c.name === 'villager_last_tick')) {
    await db.raw('ALTER TABLE "players" ADD COLUMN "villager_last_tick" TEXT DEFAULT NULL');
  }
};

exports.down = async function (db) {
  await db.raw('ALTER TABLE "players" DROP COLUMN IF EXISTS "villager_last_tick"');
};
