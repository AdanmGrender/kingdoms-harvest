// Rework hub+instancias: progreso de campaña por nodo + runs de combate stepped.
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "player_campaign_progress" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "node_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'locked',
    "cleared_at" TEXT,
    UNIQUE ("player_id", "node_id")
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_campaign_progress_player ON "player_campaign_progress" ("player_id")');

  await db.raw(`CREATE TABLE IF NOT EXISTS "campaign_runs" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "node_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "state" TEXT NOT NULL DEFAULT '{}',
    "created_at" TEXT NOT NULL
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_campaign_runs_player ON "campaign_runs" ("player_id", "id")');
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_campaign_progress_player');
  await db.raw('DROP TABLE IF EXISTS "player_campaign_progress"');
  await db.raw('DROP INDEX IF EXISTS idx_campaign_runs_player');
  await db.raw('DROP TABLE IF EXISTS "campaign_runs"');
};
