/**
 * Migration 003: RTS Redesign
 * - Add villagers table
 * - Add villager_families table
 * - Add sieges table
 * - Add world time columns to players (via raw SQL)
 */
exports.up = function (db) {
  // First create the new tables
  db.schema
    .createTable('villagers', (t) => {
      t.increments('id');
      t.bigInteger('player_id');
      t.string('name').notNullable();
      t.string('role').notNullable();
      t.string('state').defaultTo('idle');
      t.integer('assigned_building_id');
      t.integer('home_building_id');
      t.integer('hunger').defaultTo(100);
      t.integer('happiness').defaultTo(100);
      t.integer('age').defaultTo(20);
      t.text('born_at');
      t.text('created_at');
    })
    .createTable('villager_families', (t) => {
      t.increments('id');
      t.integer('villager_a_id');
      t.integer('villager_b_id');
      t.integer('children_count').defaultTo(0);
      t.text('formed_at');
    })
    .createTable('sieges', (t) => {
      t.increments('id');
      t.bigInteger('attacker_id');
      t.bigInteger('defender_id');
      t.string('status').defaultTo('marching');
      t.text('attacker_army');
      t.text('defender_army');
      t.text('march_started_at');
      t.text('arrives_at');
      t.text('resolved_at');
      t.text('result');
      t.text('loot');
    });

  // Add world time columns to players via raw SQL
  try {
    db.raw('ALTER TABLE players ADD COLUMN world_time REAL DEFAULT 0.20');
  } catch (e) {
    console.log('[Migration 003] world_time column may already exist');
  }
  try {
    db.raw('ALTER TABLE players ADD COLUMN world_day INTEGER DEFAULT 1');
  } catch (e) {
    console.log('[Migration 003] world_day column may already exist');
  }
};

exports.down = function (db) {
  return db.schema
    .dropTableIfExists('sieges')
    .dropTableIfExists('villager_families')
    .dropTableIfExists('villagers');
};
