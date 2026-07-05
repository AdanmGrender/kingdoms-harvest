// F1 idle — reporte offline "Mientras no estabas".
//
// login_snapshots: un snapshot por jugador (recursos + KH del último login).
//   El siguiente login calcula el delta (la producción acumula server-side
//   vía gameTick) y añade catch-up por caídas del server (idleService).
// server_heartbeat: fila única (id=1) con el último tick del gameTick.
// server_downtime: periodos sin ticks (detectados al arrancar el server
//   comparando el heartbeat con la hora de boot) — base del catch-up.
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "login_snapshots" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL UNIQUE,
    "resources" TEXT NOT NULL DEFAULT '{}',
    "kh_balance" REAL NOT NULL DEFAULT 0,
    "created_at" TEXT NOT NULL
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_login_snapshots_player ON "login_snapshots" ("player_id")'
  );

  await db.raw(`CREATE TABLE IF NOT EXISTS "server_heartbeat" (
    "id" INTEGER PRIMARY KEY,
    "last_tick_at" TEXT NOT NULL
  )`);

  await db.raw(`CREATE TABLE IF NOT EXISTS "server_downtime" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "started_at" TEXT NOT NULL,
    "ended_at" TEXT NOT NULL
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_server_downtime_ended ON "server_downtime" ("ended_at")'
  );
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_login_snapshots_player');
  await db.raw('DROP TABLE IF EXISTS "login_snapshots"');
  await db.raw('DROP TABLE IF EXISTS "server_heartbeat"');
  await db.raw('DROP INDEX IF EXISTS idx_server_downtime_ended');
  await db.raw('DROP TABLE IF EXISTS "server_downtime"');
};
