exports.up = async function (db) {
  await db.raw('ALTER TABLE "player_tokens" ADD COLUMN IF NOT EXISTS "commission_today" INTEGER DEFAULT 0');
  await db.raw('ALTER TABLE "player_tokens" ADD COLUMN IF NOT EXISTS "commission_reset_at" TEXT DEFAULT NULL');
};

exports.down = async function (db) {
  await db.raw('ALTER TABLE "player_tokens" DROP COLUMN IF EXISTS "commission_today"');
  await db.raw('ALTER TABLE "player_tokens" DROP COLUMN IF EXISTS "commission_reset_at"');
};
