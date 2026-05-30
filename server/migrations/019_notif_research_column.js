exports.up = async function (db) {
  // notificationService DEFAULTS includes `research: true` but migration 009
  // never added the column. Swallow duplicate-column on idempotent re-runs.
  try {
    await db.raw('ALTER TABLE "notification_preferences" ADD COLUMN "research" INTEGER DEFAULT 1');
  } catch (e) {
    if (!/duplicate column/i.test(e.message)) throw e;
  }
};

exports.down = async function () {
  // SQLite < 3.35 can't DROP COLUMN cleanly; leaving column in place on down.
};
