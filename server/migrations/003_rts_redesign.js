/**
 * Migration 003: RTS Redesign
 * - Extend player_buildings with size and production fields
 * - Add villagers table
 * - Add villager_families table
 * - Add sieges table
 * - Add world time to players
 */
exports.up = function (db) {
  return db.schema
    // Villagers (autonomous NPCs)
    .createTable('villagers', (t) => {
      t.increments('id');
      t.bigInteger('player_id');
      t.string('name').notNullable();
      t.string('role').notNullable(); // farmer, woodcutter, miner, soldier, merchant, builder
      t.string('state').defaultTo('idle'); // idle, walking_to_work, working, resting, sleeping, fleeing, fighting
      t.integer('assigned_building_id');
      t.integer('home_building_id');
      t.integer('hunger').defaultTo(100);
      t.integer('happiness').defaultTo(100);
      t.integer('age').defaultTo(20);
      t.text('born_at');
      t.text('created_at');
    })

    // Villager families
    .createTable('villager_families', (t) => {
      t.increments('id');
      t.integer('villager_a_id');
      t.integer('villager_b_id');
      t.integer('children_count').defaultTo(0);
      t.text('formed_at');
    })

    // Add world time columns to players
    .table('players', (t) => {
      t.float('world_time').defaultTo(0.20); // 0.0–1.0, fraction of day
      t.integer('world_day').defaultTo(1);
    })

    // Sieges (war system)
    .createTable('sieges', (t) => {
      t.increments('id');
      t.bigInteger('attacker_id');
      t.bigInteger('defender_id');
      t.string('status').defaultTo('marching'); // marching, fighting, resolved
      t.text('attacker_army');
      t.text('defender_army');
      t.text('march_started_at');
      t.text('arrives_at');
      t.text('resolved_at');
      t.text('result');
      t.text('loot');
    });
};

exports.down = function (db) {
  return db.schema
    .dropTableIfExists('sieges')
    .dropTableIfExists('villager_families')
    .dropTableIfExists('villagers');
};
