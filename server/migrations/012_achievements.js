exports.up = async function (db) {
  await db.schema.createTable('player_achievements', (t) => {
    t.increments('id');
    t.bigInteger('player_id').notNullable();
    t.string('achievement_id', 50).notNullable();
    t.integer('progress').defaultTo(0);
    t.text('unlocked_at').nullable();
    t.text('claimed_at').nullable();
    t.unique(['player_id', 'achievement_id']);
  });
  await db.raw('CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON "player_achievements" ("player_id")');
};

exports.down = async function (db) {
  await db.schema.dropTableIfExists('player_achievements');
};
