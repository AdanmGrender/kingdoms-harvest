/**
 * Migration 009: Alliance chat + marketplace price history.
 *
 * alliance_messages — one row per chat line. Capped per-alliance retention
 * happens at read time (last 50). No edit/delete model.
 *
 * marketplace_price_log — append-only ledger of completed sales. Used by
 * the price history endpoint to draw per-resource time series. Decoupled
 * from marketplace_listings so cancellations/expirations don't pollute it.
 */

exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS alliance_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    alliance_id INTEGER NOT NULL,
    player_id BIGINT NOT NULL,
    content TEXT NOT NULL,
    created_at TEXT NOT NULL
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_alliance_messages_alliance ON alliance_messages (alliance_id, id)');

  await db.raw(`CREATE TABLE IF NOT EXISTS marketplace_price_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    resource_id TEXT NOT NULL,
    price_per_unit INTEGER NOT NULL,
    quantity INTEGER NOT NULL,
    sold_at TEXT NOT NULL
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_pricelog_resource_sold ON marketplace_price_log (resource_id, sold_at)');
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_alliance_messages_alliance');
  await db.raw('DROP TABLE IF EXISTS alliance_messages');
  await db.raw('DROP INDEX IF EXISTS idx_pricelog_resource_sold');
  await db.raw('DROP TABLE IF EXISTS marketplace_price_log');
};
