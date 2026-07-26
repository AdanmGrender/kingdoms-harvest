// F3 Boost ×2 producción (sink de gemas): compra 4h de multiplicador ×2 sobre
// la GANANCIA DE RECURSOS (farm yield + oro de venta). JAMÁS multiplica KH —
// ver boostService.getMultiplier y los call sites en farmService/commerceService.
// Fila UNIQUE por player_id; recomprar con boost activo extiende expires_at
// (ver boostService.buy). No apilable (un solo boost_id a la vez).
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "player_boosts" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "boost_id" TEXT NOT NULL,
    "expires_at" TEXT NOT NULL,
    UNIQUE ("player_id")
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_player_boosts_player ON "player_boosts" ("player_id")');
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_player_boosts_player');
  await db.raw('DROP TABLE IF EXISTS "player_boosts"');
};
