exports.up = function (db) {
  return db.schema
    // ---- JUGADORES ----
    .createTable('players', (t) => {
      t.bigInteger('telegram_id').primary();
      t.string('username');
      t.string('first_name');
      t.string('display_name').notNullable();
      t.integer('level').defaultTo(1);
      t.integer('xp').defaultTo(0);
      t.string('faction_id');
      t.integer('faction_points').defaultTo(0);
      t.string('current_season').defaultTo('spring');
      t.text('season_started_at');
      t.text('last_login');
      t.text('created_at');
    })

    // ---- RECURSOS DEL JUGADOR ----
    .createTable('player_resources', (t) => {
      t.increments('id');
      t.bigInteger('player_id');
      t.string('resource_id').notNullable();
      t.integer('amount').defaultTo(0);
      t.integer('capacity').defaultTo(1000);
    })

    // ---- EDIFICIOS DEL JUGADOR ----
    .createTable('player_buildings', (t) => {
      t.increments('id');
      t.bigInteger('player_id');
      t.string('building_id').notNullable();
      t.integer('level').defaultTo(1);
      t.boolean('is_building').defaultTo(false);
      t.text('build_complete_at');
      t.integer('position_x').defaultTo(0);
      t.integer('position_y').defaultTo(0);
      t.text('created_at');
    })

    // ---- PARCELAS DE CULTIVO ----
    .createTable('farm_plots', (t) => {
      t.increments('id');
      t.bigInteger('player_id');
      t.integer('building_id');
      t.string('crop_id');
      t.string('state').defaultTo('empty');
      t.string('quality').defaultTo('normal');
      t.text('planted_at');
      t.text('ready_at');
      t.boolean('fertilized').defaultTo(false);
    })

    // ---- ANIMALES DEL JUGADOR ----
    .createTable('player_animals', (t) => {
      t.increments('id');
      t.bigInteger('player_id');
      t.string('animal_id').notNullable();
      t.string('name');
      t.boolean('is_fed').defaultTo(false);
      t.text('last_collected_at');
      t.text('next_production_at');
      t.text('created_at');
    })

    // ---- TROPAS DEL JUGADOR ----
    .createTable('player_troops', (t) => {
      t.increments('id');
      t.bigInteger('player_id');
      t.string('troop_id').notNullable();
      t.integer('quantity').defaultTo(0);
      t.integer('training_quantity').defaultTo(0);
      t.text('training_complete_at');
    })

    // ---- MISIONES DE VENTA (TABLÓN DE PEDIDOS) ----
    .createTable('missions', (t) => {
      t.increments('id');
      t.bigInteger('player_id');
      t.string('title').notNullable();
      t.string('description');
      t.string('npc_name').notNullable();
      t.string('npc_icon').defaultTo('🧑‍🌾');
      t.text('requirements').notNullable();
      t.text('rewards').notNullable();
      t.string('status').defaultTo('available');
      t.boolean('is_urgent').defaultTo(false);
      t.text('expires_at');
      t.text('accepted_at');
      t.text('completed_at');
      t.text('created_at');
    })

    // ---- CARAVANAS COMERCIALES ----
    .createTable('caravans', (t) => {
      t.increments('id');
      t.string('name').notNullable();
      t.text('buy_offers').notNullable();
      t.text('sell_offers').notNullable();
      t.text('arrives_at').notNullable();
      t.text('departs_at').notNullable();
      t.boolean('is_active').defaultTo(true);
    })

    // ---- FACCIONES ----
    .createTable('factions', (t) => {
      t.string('id').primary();
      t.string('name').notNullable();
      t.string('icon');
      t.string('color');
      t.text('description');
      t.integer('total_members').defaultTo(0);
      t.integer('territory_count').defaultTo(0);
      t.text('bonus');
      t.text('created_at');
    })

    // ---- TERRITORIOS DEL MAPA ----
    .createTable('territories', (t) => {
      t.increments('id');
      t.string('name').notNullable();
      t.integer('grid_x').notNullable();
      t.integer('grid_y').notNullable();
      t.string('type').defaultTo('plains');
      t.string('owner_faction_id');
      t.integer('defense_strength').defaultTo(100);
      t.text('resources_bonus');
    })

    // ---- BATALLAS ----
    .createTable('battles', (t) => {
      t.increments('id');
      t.bigInteger('attacker_id');
      t.bigInteger('defender_id');
      t.integer('territory_id');
      t.string('type').notNullable();
      t.text('attacker_army').notNullable();
      t.text('defender_army');
      t.text('result');
      t.string('winner');
      t.text('loot');
      t.text('started_at');
      t.text('resolved_at');
    })

    // ---- INVESTIGACIONES ----
    .createTable('player_research', (t) => {
      t.increments('id');
      t.bigInteger('player_id');
      t.string('branch_id').notNullable();
      t.string('tech_id').notNullable();
      t.boolean('is_researching').defaultTo(false);
      t.text('research_complete_at');
      t.text('completed_at');
    })

    // ---- INVENTARIO (items especiales) ----
    .createTable('player_inventory', (t) => {
      t.increments('id');
      t.bigInteger('player_id');
      t.string('item_id').notNullable();
      t.string('item_type').notNullable();
      t.integer('quantity').defaultTo(1);
      t.string('quality').defaultTo('normal');
      t.text('metadata');
    });
};

exports.down = function (db) {
  return db.schema
    .dropTableIfExists('player_inventory')
    .dropTableIfExists('player_research')
    .dropTableIfExists('battles')
    .dropTableIfExists('territories')
    .dropTableIfExists('factions')
    .dropTableIfExists('caravans')
    .dropTableIfExists('missions')
    .dropTableIfExists('player_troops')
    .dropTableIfExists('player_animals')
    .dropTableIfExists('farm_plots')
    .dropTableIfExists('player_buildings')
    .dropTableIfExists('player_resources')
    .dropTableIfExists('players');
};
