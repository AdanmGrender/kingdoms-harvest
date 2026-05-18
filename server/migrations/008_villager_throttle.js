exports.up = async function (db) {
  await db.raw('ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "villager_last_tick" TEXT DEFAULT NULL');
};

exports.down = async function (db) {
  await db.raw('ALTER TABLE "players" DROP COLUMN IF EXISTS "villager_last_tick"');
};
