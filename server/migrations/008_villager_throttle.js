exports.up = async function (db) {
  db.raw('ALTER TABLE "players" ADD COLUMN "villager_last_tick" TEXT DEFAULT NULL');
};

exports.down = async function (db) {
  // SQLite does not support DROP COLUMN — intentional no-op
};
