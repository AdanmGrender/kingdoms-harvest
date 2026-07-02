/**
 * Migration 007: Player-to-player marketplace + alliances (Fase 4).
 *
 * marketplace_listings — sellers list a quantity of one resource for a
 * fixed gold-per-unit price. Resources are escrowed (decremented at listing
 * creation) and refunded on cancel/expire. Status transitions:
 *   active → sold (when remaining quantity hits zero)
 *   active → cancelled (seller pulls listing)
 *   active → expired (gameTick after expires_at)
 *
 * alliances + alliance_members — player-created social groups. Distinct
 * from the 4 fixed factions. A player can be in at most one alliance at a
 * time. Leader is the creator; only leader can disband.
 */

exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS marketplace_listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    seller_id BIGINT NOT NULL,
    resource_id TEXT NOT NULL,
    quantity INTEGER NOT NULL,
    quantity_remaining INTEGER NOT NULL,
    price_per_unit INTEGER NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_market_status_expires ON marketplace_listings (status, expires_at)');
  await db.raw('CREATE INDEX IF NOT EXISTS idx_market_seller ON marketplace_listings (seller_id)');

  await db.raw(`CREATE TABLE IF NOT EXISTS alliances (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE,
    leader_id BIGINT NOT NULL,
    motto TEXT,
    member_limit INTEGER DEFAULT 10,
    created_at TEXT NOT NULL
  )`);

  await db.raw(`CREATE TABLE IF NOT EXISTS alliance_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alliance_id INTEGER NOT NULL,
    player_id BIGINT NOT NULL UNIQUE,
    role TEXT NOT NULL DEFAULT 'member',
    joined_at TEXT NOT NULL
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_alliance_members_alliance ON alliance_members (alliance_id)');
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_alliance_members_alliance');
  await db.raw('DROP TABLE IF EXISTS alliance_members');
  await db.raw('DROP TABLE IF EXISTS alliances');
  await db.raw('DROP INDEX IF EXISTS idx_market_seller');
  await db.raw('DROP INDEX IF EXISTS idx_market_status_expires');
  await db.raw('DROP TABLE IF EXISTS marketplace_listings');
};
