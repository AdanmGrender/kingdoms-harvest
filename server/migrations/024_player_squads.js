// F4 idle — Escuadras: hasta 5 héroes en formación defensiva/ofensiva.
// Un héroe solo puede ocupar un slot (UNIQUE hero) y cada slot es único por
// jugador. Sustituye funcionalmente al deployed_hero_id single (que queda
// como fallback de compatibilidad).
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "player_squads" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "slot" INTEGER NOT NULL,
    "hero_db_id" INTEGER NOT NULL,
    UNIQUE ("player_id", "slot"),
    UNIQUE ("player_id", "hero_db_id")
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_player_squads_player ON "player_squads" ("player_id")'
  );
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_player_squads_player');
  await db.raw('DROP TABLE IF EXISTS "player_squads"');
};
