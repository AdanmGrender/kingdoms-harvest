// F2 Calendario de login 7 días: ciclo de 7 días reclamables (uno por día
// UTC; si se saltea un día NO se rompe — el ciclo avanza al reclamar).
// Fila UNIQUE por player_id; el reset de "ya reclamó hoy" se resuelve
// comparando last_claim_date contra la fecha UTC actual en el UPDATE
// condicional del claim (ver calendarService.claim).
//
// gem_promo_grants: ledger de gemas promocionales (día 7 del calendario, y
// futuros tiers premium del pase de temporada). Nunca toca el camino
// `credit` de pagos con Stars — ver gemService.grantPromo.
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "login_calendar" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "cycle_day" INTEGER NOT NULL DEFAULT 1,
    "last_claim_date" TEXT NOT NULL DEFAULT '',
    UNIQUE ("player_id")
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_login_calendar_player ON "login_calendar" ("player_id")');

  await db.raw(`CREATE TABLE IF NOT EXISTS "gem_promo_grants" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "amount" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "created_at" TEXT NOT NULL
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_gem_promo_grants_player ON "gem_promo_grants" ("player_id")');
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_login_calendar_player');
  await db.raw('DROP TABLE IF EXISTS "login_calendar"');
  await db.raw('DROP INDEX IF EXISTS idx_gem_promo_grants_player');
  await db.raw('DROP TABLE IF EXISTS "gem_promo_grants"');
};
