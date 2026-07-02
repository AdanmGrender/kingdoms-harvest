// player_resources necesita UNIQUE(player_id, resource_id) para que los upserts
// ON CONFLICT de marketService funcionen (SQLite exige un índice UNIQUE que
// coincida con la cláusula). Antes de crear el índice, fusionamos filas
// duplicadas que hayan podido crearse por inserts concurrentes.
exports.up = async function (db) {
  // 1) Fusionar duplicados: la fila superviviente (MIN(id)) absorbe la suma
  await db.raw(`
    UPDATE "player_resources" SET "amount" = (
      SELECT SUM("p2"."amount") FROM "player_resources" "p2"
      WHERE "p2"."player_id" = "player_resources"."player_id"
        AND "p2"."resource_id" = "player_resources"."resource_id"
    )
    WHERE "id" IN (
      SELECT MIN("id") FROM "player_resources"
      GROUP BY "player_id", "resource_id"
      HAVING COUNT(*) > 1
    )
  `);

  // 2) Eliminar las filas duplicadas restantes
  await db.raw(`
    DELETE FROM "player_resources" WHERE "id" NOT IN (
      SELECT MIN("id") FROM "player_resources"
      GROUP BY "player_id", "resource_id"
    )
  `);

  // 3) Índice único — habilita ON CONFLICT ("player_id","resource_id")
  await db.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS ux_player_resources_player_resource ON "player_resources" ("player_id", "resource_id")'
  );
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS ux_player_resources_player_resource');
};
