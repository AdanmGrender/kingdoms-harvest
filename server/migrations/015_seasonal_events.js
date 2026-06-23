exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "seasonal_progress" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" INTEGER NOT NULL,
    "season_key" TEXT NOT NULL,
    "challenge_id" TEXT NOT NULL,
    "progress" INTEGER DEFAULT 0,
    "completed_at" TEXT DEFAULT NULL,
    "claimed_at" TEXT DEFAULT NULL,
    UNIQUE ("player_id", "season_key", "challenge_id")
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_seasonal_progress_player ON "seasonal_progress" ("player_id")');
};

exports.down = async function (db) {
  await db.raw('DROP TABLE IF EXISTS "seasonal_progress"');
};
