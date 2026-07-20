// F4 Pase de temporada (battle pass): temporada de 30 días, 20 tiers × 50 pts.
//
// pass_seasons: catálogo de temporadas. Una activa a la vez (ends_at > now),
// seedeada lazy por passService._ensureSeason la primera vez que se toca el
// pase (no hay cron: si no hay ninguna vigente, se crea 's1', o 's{N+1}' si
// ya hubo temporadas previas).
//
// player_pass: UNA fila por jugador (UNIQUE player_id) — no es histórico por
// temporada; cuando arranca una nueva season, passService la re-sembrea
// (season_key/points/premium) sobre la misma fila. El histórico de qué se
// reclamó en cada temporada vive en pass_claims (que sí es por season_key).
//
// pass_claims: UNIQUE(player_id, season_key, tier, track) es el gate de
// idempotencia del claim — mismo patrón que gem_promo_grants/campaign_sweeps:
// el INSERT es la fuente de verdad, no una lectura previa.
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "pass_seasons" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "season_key" TEXT NOT NULL,
    "started_at" TEXT NOT NULL,
    "ends_at" TEXT NOT NULL,
    UNIQUE ("season_key")
  )`);

  await db.raw(`CREATE TABLE IF NOT EXISTS "player_pass" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "season_key" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "premium" INTEGER NOT NULL DEFAULT 0,
    UNIQUE ("player_id")
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_player_pass_player ON "player_pass" ("player_id")');

  await db.raw(`CREATE TABLE IF NOT EXISTS "pass_claims" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "season_key" TEXT NOT NULL,
    "tier" INTEGER NOT NULL,
    "track" TEXT NOT NULL,
    UNIQUE ("player_id", "season_key", "tier", "track")
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_pass_claims_player ON "pass_claims" ("player_id")');
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_pass_claims_player');
  await db.raw('DROP TABLE IF EXISTS "pass_claims"');
  await db.raw('DROP INDEX IF EXISTS idx_player_pass_player');
  await db.raw('DROP TABLE IF EXISTS "player_pass"');
  await db.raw('DROP TABLE IF EXISTS "pass_seasons"');
};
