// Cierra el doble-otorgamiento de TAREAS SOCIALES (hasta 250 KH por 'invite_10').
//
// completeSocialTask hacía check-then-insert-then-award sin constraint: dos
// requests concurrentes leían "no completada", ambos insertaban y ambos
// otorgaban tokens. Con UNIQUE(player_id, task_id) el INSERT pasa a ser el guard
// de idempotencia: el segundo revienta y no acredita.
//
// Se deduplica primero (por si ya hay filas repetidas), conservando la más vieja.
exports.up = async function (db) {
  await db.raw(`
    DELETE FROM "social_task_completions"
    WHERE "id" NOT IN (
      SELECT MIN("id") FROM "social_task_completions"
      GROUP BY "player_id", "task_id"
    )
  `);
  await db.raw(
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_social_task_unique '
    + 'ON "social_task_completions" ("player_id", "task_id")'
  );
};

exports.down = async function (db) {
  await db.raw('DROP INDEX IF EXISTS idx_social_task_unique');
};
