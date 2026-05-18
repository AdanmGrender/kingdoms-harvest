exports.up = async function (db) {
  await db.schema.createTable('notification_preferences', (t) => {
    t.bigInteger('player_id').primary()
      .references('telegram_id').inTable('players').onDelete('CASCADE');
    t.boolean('crops').defaultTo(true);
    t.boolean('buildings').defaultTo(true);
    t.boolean('troops').defaultTo(true);
    t.boolean('animals').defaultTo(true);
    t.boolean('withdrawals').defaultTo(true);
    t.boolean('sieges').defaultTo(true);
    t.boolean('events').defaultTo(false);
    t.boolean('daily_reminder').defaultTo(false);
    t.text('updated_at');
  });

  await db.raw('ALTER TABLE "players" ADD COLUMN IF NOT EXISTS "last_login_at" TEXT DEFAULT NULL');
};

exports.down = async function (db) {
  await db.schema.dropTableIfExists('notification_preferences');
  await db.raw('ALTER TABLE "players" DROP COLUMN IF EXISTS "last_login_at"');
};
