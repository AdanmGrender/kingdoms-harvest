// F3 idle — Marea Disforme: defensa por oleadas 100% automática.
// wave_progress: escalera de progresión por jugador (una fila).
// wave_runs: historial de desafíos con log de rondas (replay) y recompensas.
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "wave_progress" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL UNIQUE,
    "highest_wave" INTEGER NOT NULL DEFAULT 0,
    "total_runs" INTEGER NOT NULL DEFAULT 0,
    "free_run_available" INTEGER NOT NULL DEFAULT 0,
    "last_run_at" TEXT
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_wave_progress_player ON "wave_progress" ("player_id")'
  );

  await db.raw(`CREATE TABLE IF NOT EXISTS "wave_runs" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "start_wave" INTEGER NOT NULL,
    "end_wave" INTEGER NOT NULL,
    "victory" INTEGER NOT NULL DEFAULT 0,
    "log" TEXT NOT NULL DEFAULT '[]',
    "rewards" TEXT NOT NULL DEFAULT '{}',
    "created_at" TEXT NOT NULL
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_wave_runs_player ON "wave_runs" ("player_id", "id")'
  );
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_wave_progress_player');
  await db.raw('DROP TABLE IF EXISTS "wave_progress"');
  await db.raw('DROP INDEX IF EXISTS idx_wave_runs_player');
  await db.raw('DROP TABLE IF EXISTS "wave_runs"');
};
