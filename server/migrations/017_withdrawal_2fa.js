exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "withdrawal_otps" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" INTEGER NOT NULL,
    "otp_hash" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "expires_at" TEXT NOT NULL,
    "attempts" INTEGER DEFAULT 0,
    "used" INTEGER DEFAULT 0,
    "created_at" TEXT DEFAULT (datetime('now'))
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_withdrawal_otps_player ON "withdrawal_otps" ("player_id")');
};

exports.down = async function (db) {
  await db.raw('DROP TABLE IF EXISTS "withdrawal_otps"');
};
