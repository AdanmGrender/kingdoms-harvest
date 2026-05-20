exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "withdrawal_otps" (
    "id" SERIAL PRIMARY KEY,
    "player_id" BIGINT NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "expires_at" TEXT NOT NULL,
    "attempts" INTEGER DEFAULT 0,
    "used" BOOLEAN DEFAULT FALSE,
    "created_at" TEXT DEFAULT (NOW()::text)
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_withdrawal_otps_player ON "withdrawal_otps" ("player_id")');
};

exports.down = async function (db) {
  await db.raw('DROP TABLE IF EXISTS "withdrawal_otps"');
};
