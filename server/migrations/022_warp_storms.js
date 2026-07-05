// F2 idle — Tormentas Disformes: sucesos aleatorios globales.
// Una fila por tormenta; is_active=1 como mucho en una. next_roll_hint
// permite que 'calma_falsa' acorte la espera hasta la siguiente.
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "warp_storms" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "storm_type" TEXT NOT NULL,
    "intensity" INTEGER NOT NULL DEFAULT 1,
    "modifiers" TEXT NOT NULL DEFAULT '{}',
    "started_at" TEXT NOT NULL,
    "ends_at" TEXT NOT NULL,
    "is_active" INTEGER NOT NULL DEFAULT 1,
    "hasten_next" INTEGER NOT NULL DEFAULT 0
  )`);
  await db.raw(
    'CREATE INDEX IF NOT EXISTS idx_warp_storms_active ON "warp_storms" ("is_active", "ends_at")'
  );
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_warp_storms_active');
  await db.raw('DROP TABLE IF EXISTS "warp_storms"');
};
