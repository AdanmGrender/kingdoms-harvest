exports.up = async function (db) {
  await db.schema.createTable('player_heroes', (t) => {
    t.increments('id').primary();
    t.bigInteger('player_id').notNullable();
    t.string('hero_id', 50).notNullable();
    t.integer('level').notNullable().defaultTo(1);
    t.integer('xp').notNullable().defaultTo(0);
    t.text('equipment').defaultTo('{"weapon":null,"armor":null,"accessory":null}');
    t.text('obtained_at');
  });

  await db.schema.createTable('player_items', (t) => {
    t.increments('id').primary();
    t.bigInteger('player_id').notNullable();
    t.string('item_id', 50).notNullable();
    t.integer('quantity').notNullable().defaultTo(1);
  });

  db.raw('CREATE INDEX IF NOT EXISTS idx_player_heroes_player ON player_heroes (player_id)');
  db.raw('CREATE INDEX IF NOT EXISTS idx_player_items_player ON player_items (player_id)');
};

exports.down = async function (db) {
  await db.schema.dropTableIfExists('player_heroes');
  await db.schema.dropTableIfExists('player_items');
};
