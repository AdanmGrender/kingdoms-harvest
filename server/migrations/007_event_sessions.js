exports.up = async function (db) {
  await db.raw('ALTER TABLE "world_events" ADD COLUMN IF NOT EXISTS "is_featured" INTEGER DEFAULT 0');

  await db.schema.createTable('event_sessions', (t) => {
    t.increments('id').primary();
    t.integer('event_id').notNullable();
    t.bigInteger('host_player_id').notNullable();
    t.integer('participant_count').defaultTo(1);
    t.integer('max_participants').defaultTo(4);
    t.integer('expires_at').notNullable(); // Unix timestamp — matches the event's expiry
    t.text('created_at').notNullable();
  });

  await db.schema.createTable('event_session_participants', (t) => {
    t.increments('id').primary();
    t.integer('session_id').notNullable();
    t.bigInteger('player_id').notNullable();
    t.text('joined_at').notNullable();
  });

  await db.raw('CREATE INDEX IF NOT EXISTS idx_event_sessions_event ON event_sessions (event_id)');
  await db.raw('CREATE UNIQUE INDEX IF NOT EXISTS idx_session_participants_unique ON event_session_participants (session_id, player_id)');
};

exports.down = async function (db) {
  await db.schema.dropTableIfExists('event_session_participants');
  await db.schema.dropTableIfExists('event_sessions');
};
