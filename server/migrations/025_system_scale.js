// G1 idle — Escala Sistema: meta-mapa de planetas con nave y tributo pasivo.
// player_planets: qué planetas ha reclamado cada jugador.
// player_ship: estado de la nave (una por jugador). status: 'idle' | 'traveling'.
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "player_planets" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "planet_id" TEXT NOT NULL,
    "claimed_at" TEXT NOT NULL,
    UNIQUE ("player_id", "planet_id")
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_player_planets_player ON "player_planets" ("player_id")'
  );

  await db.raw(`CREATE TABLE IF NOT EXISTS "player_ship" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'idle',
    "target_planet" TEXT,
    "arrives_at" TEXT
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_player_ship_traveling ON "player_ship" ("status", "arrives_at")'
  );
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_player_planets_player');
  await db.raw('DROP TABLE IF EXISTS "player_planets"');
  await db.raw('DROP INDEX IF EXISTS idx_player_ship_traveling');
  await db.raw('DROP TABLE IF EXISTS "player_ship"');
};
