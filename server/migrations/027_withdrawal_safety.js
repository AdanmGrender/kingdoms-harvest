// Endurecimiento de retiros TON para dinero real.
// - seqno:      seqno del hot wallet usado para el envío (persistido ANTES de
//               broadcastear → permite reconciliar contra la cadena si el
//               proceso muere entre el envío y la confirmación).
// - attempts:   veces que el procesador tomó este request.
// - claimed_at: cuándo pasó a 'processing' (para detectar 'processing' colgados
//               por un crash y mandarlos a revisión en vez de reenviar).
// Nuevo estado posible de withdrawal_requests.status: 'needs_review' — envío
// incierto: NO se completa (no hay hash confirmado) y NO se reintegra el balance
// (podría haber salido) → lo resuelve un humano mirando el explorador.
async function addColumn(db, ddl) {
  try {
    await db.raw(ddl);
  } catch (e) {
    // "duplicate column name" si ya existe → idempotente.
    if (!/duplicate column/i.test(e.message)) throw e;
  }
}

exports.up = async function (db) {
  await addColumn(db, 'ALTER TABLE "withdrawal_requests" ADD COLUMN "seqno" INTEGER');
  await addColumn(db, 'ALTER TABLE "withdrawal_requests" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0');
  await addColumn(db, 'ALTER TABLE "withdrawal_requests" ADD COLUMN "claimed_at" TEXT');
};

exports.down = async function () {
  // SQLite no soporta DROP COLUMN en versiones viejas; no-op (columnas inertes).
};
