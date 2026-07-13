// Economía de INGRESO (Telegram Stars → Gemas). Ver shared/shopConfig.js.
//
// ⚠️ INVARIANTE DE DISEÑO (regulatorio + ToS de Telegram):
//    Las GEMAS son moneda premium de un solo sentido: se COMPRAN con dinero
//    real y se GASTAN dentro del juego. NUNCA se convierten a KH ni a TON.
//    Por eso viven en su PROPIA tabla y NO en player_resources: los recursos
//    tienen ruta de quema a KH (tokenService.burnResourcesForTokens) y KH es
//    retirable a TON. Si las gemas fueran un "recurso", existiría el camino
//    dinero-real → KH → TON = casa de cambio / lavado. No debe existir.
//
// star_payments: log de compras. telegram_payment_charge_id es UNIQUE → un
// update repetido de Telegram (reintento/replay) no puede acreditar dos veces.
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "player_gems" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL UNIQUE,
    "balance" INTEGER NOT NULL DEFAULT 0,
    "total_purchased" INTEGER NOT NULL DEFAULT 0,
    "total_spent" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TEXT
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_player_gems_player ON "player_gems" ("player_id")'
  );

  await db.raw(`CREATE TABLE IF NOT EXISTS "star_payments" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "product_id" TEXT NOT NULL,
    "stars" INTEGER NOT NULL,
    "gems_credited" INTEGER NOT NULL DEFAULT 0,
    "telegram_payment_charge_id" TEXT NOT NULL UNIQUE,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "created_at" TEXT NOT NULL
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_star_payments_player ON "star_payments" ("player_id")'
  );
  // Índice único explícito (defensa en profundidad ante el UNIQUE de columna).
  await db.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_star_payments_charge ON "star_payments" ("telegram_payment_charge_id")'
  );
};

exports.down = async function (db) {
  await db.raw('DROP TABLE IF EXISTS "star_payments"');
  await db.raw('DROP TABLE IF EXISTS "player_gems"');
};
