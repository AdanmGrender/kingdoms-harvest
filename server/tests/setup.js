/**
 * Test setup — connects to the PostgreSQL test database (kingdoms_test),
 * runs all migrations, and seeds base data for all test suites.
 *
 * NODE_ENV=test is set before any app module is loaded so database.js
 * picks up DB_NAME_TEST instead of DB_NAME.
 */

// Set env vars BEFORE any require of app modules
process.env.BOT_TOKEN = 'TEST_BOT_TOKEN_123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
process.env.NODE_ENV = 'test';

const TEST_PLAYER_ID = 999888777;

let db;
let initialized = false;

async function initTestDb() {
  if (initialized) return db;

  db = require('../src/config/database');
  await db.initDatabase();

  // Drop and recreate all tables via down→up migrations for a clean slate
  await db.migrate.rollback({ all: true }).catch(() => {});
  await db.migrate.latest();

  initialized = true;
  return db;
}

async function seedTestData() {
  if (!db) throw new Error('Call initTestDb() first');

  // Idempotent: skip if player already exists
  const existing = await db('players').where('telegram_id', TEST_PLAYER_ID).first();
  if (existing) return;

  await db('players').insert({
    telegram_id: TEST_PLAYER_ID,
    username: 'testplayer',
    first_name: 'Test',
    display_name: 'TestPlayer',
    level: 1,
    xp: 0,
  });

  const starterResources = {
    gold: 200, wood: 100, stone: 50, iron: 20, wheat: 30, water: 50,
  };
  for (const [resourceId, amount] of Object.entries(starterResources)) {
    await db('player_resources').insert({
      player_id: TEST_PLAYER_ID,
      resource_id: resourceId,
      amount,
      capacity: 1000,
    });
  }

  await db('player_buildings').insert({
    player_id: TEST_PLAYER_ID,
    building_id: 'throne_room',
    level: 1,
    is_building: false,
  });

  const [{ id: plotId1 }] = await db('player_buildings').insert({
    player_id: TEST_PLAYER_ID,
    building_id: 'farm_plot',
    level: 1,
    is_building: false,
  }).returning('id');

  const [{ id: plotId2 }] = await db('player_buildings').insert({
    player_id: TEST_PLAYER_ID,
    building_id: 'farm_plot',
    level: 1,
    is_building: false,
  }).returning('id');

  await db('player_buildings').insert({
    player_id: TEST_PLAYER_ID,
    building_id: 'barn',
    level: 1,
    is_building: false,
  });

  await db('farm_plots').insert({
    player_id: TEST_PLAYER_ID,
    building_id: plotId1,
    state: 'empty',
  });

  await db('farm_plots').insert({
    player_id: TEST_PLAYER_ID,
    building_id: plotId2,
    state: 'empty',
  });

  const { seedFactions } = require('../src/game/seedData');
  await seedFactions(db);
}

function getDb() {
  return db;
}

module.exports = {
  initTestDb,
  seedTestData,
  getDb,
  TEST_PLAYER_ID,
};
