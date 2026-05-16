exports.up = async function (db) {
  await db.schema.createTable('world_events', (t) => {
    t.increments('id').primary();
    t.string('event_type', 50).notNullable();
    t.string('title', 100).notNullable();
    t.text('description').notNullable();
    t.string('icon', 10).notNullable();
    t.integer('tile_x').notNullable();
    t.integer('tile_y').notNullable();
    t.text('rewards').notNullable();     // JSON: [{resource_id, amount}]
    t.string('rarity', 20).defaultTo('common');
    t.integer('expires_at').notNullable(); // Unix timestamp
    t.integer('is_active').defaultTo(1);
    t.text('created_at');
  });

  await db.schema.createTable('world_event_claims', (t) => {
    t.increments('id').primary();
    t.integer('event_id').notNullable();
    t.bigInteger('player_id').notNullable();
    t.text('claimed_at').notNullable();
  });

  db.raw('CREATE INDEX IF NOT EXISTS idx_world_events_active ON world_events (is_active)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_event_claims_player ON world_event_claims (player_id)');
  db.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_event_claims_unique ON world_event_claims (event_id, player_id)');
};

exports.down = async function (db) {
  await db.schema.dropTableIfExists('world_event_claims');
  await db.schema.dropTableIfExists('world_events');
};
