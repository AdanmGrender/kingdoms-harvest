exports.up = async function (db) {
  // Track which hero is deployed for combat on each player
  await db.raw('ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "deployed_hero_id" INTEGER DEFAULT NULL');
  // Per-hero recovery window after a lost battle
  await db.raw('ALTER TABLE "player_heroes" ADD COLUMN IF NOT EXISTS "recovery_until" TEXT DEFAULT NULL');
};

exports.down = async function (db) {
  await db.raw('ALTER TABLE "players" DROP COLUMN IF EXISTS "deployed_hero_id"');
  await db.raw('ALTER TABLE "player_heroes" DROP COLUMN IF EXISTS "recovery_until"');
};
