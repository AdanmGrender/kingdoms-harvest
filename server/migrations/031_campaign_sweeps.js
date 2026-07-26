// F1 Sweep de nodos ("Asalto rápido"): cupo diario (UTC) por jugador para
// re-farmear nodos combat/wave/boss YA limpiados. Fila UNIQUE por player_id;
// el reset de día se resuelve comparando sweep_date contra la fecha UTC
// actual en el UPDATE condicional del claim (ver campaignService.sweepNode).
exports.up = async function (db) {
  await db.raw(`CREATE TABLE IF NOT EXISTS "campaign_sweeps" (
    "id" INTEGER PRIMARY KEY AUTOINCREMENT,
    "player_id" BIGINT NOT NULL,
    "sweep_date" TEXT NOT NULL,
    "sweeps_today" INTEGER NOT NULL DEFAULT 0,
    UNIQUE ("player_id")
  )`);
  await db.raw('CREATE INDEX IF NOT EXISTS idx_campaign_sweeps_player ON "campaign_sweeps" ("player_id")');
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_campaign_sweeps_player');
  await db.raw('DROP TABLE IF EXISTS "campaign_sweeps"');
};
