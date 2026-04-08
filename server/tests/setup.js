/**
 * Test setup — initializes an in-memory SQLite DB via sql.js,
 * runs migrations, and seeds base data for all test suites.
 */
const path = require('path');
const fs = require('fs');

// Set env vars BEFORE any require of app modules
process.env.BOT_TOKEN = 'TEST_BOT_TOKEN_123456:ABC-DEF1234ghIkl-zyx57W2v1u123ew11';
process.env.NODE_ENV = 'test';

const TEST_PLAYER_ID = 999888777;

let db;
let initialized = false;

async function initTestDb() {
  // Only initialize once across all test suites (they share the module singleton)
  if (initialized) {
    return db;
  }

  // database.js hardcodes DB_PATH from __dirname at load time.
  // We need to ensure its initDatabase() creates a fresh in-memory DB.
  // The module creates in-memory if the DB file doesn't exist at the resolved path.
  // We'll use a temp path that doesn't exist.
  const tmpDbPath = path.join(__dirname, '../data/test_kingdoms_temp.db');

  // Remove if leftover from previous run
  if (fs.existsSync(tmpDbPath)) {
    fs.unlinkSync(tmpDbPath);
  }

  // Patch the DB_PATH constant inside database.js by clearing its cache
  // and monkey-patching path.resolve for the duration of the require
  delete require.cache[require.resolve('../src/config/database')];

  // We need to intercept the module. Simplest: just call initDatabase and
  // then overwrite the saveToDisk function to be a no-op for tests.
  db = require('../src/config/database');

  // Ensure data directory exists
  const dataDir = path.dirname(tmpDbPath);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  await db.initDatabase();

  // Run migration
  const migrationPath = path.join(__dirname, '../migrations');
  await db.migrate.latest({ directory: migrationPath });

  initialized = true;
  return db;
}

async function seedTestData() {
  if (!db) throw new Error('Call initTestDb() first');

  // Check if player already exists (idempotent)
  const existing = await db('players').where('telegram_id', TEST_PLAYER_ID).first();
  if (existing) return;

  // Create a test player
  await db('players').insert({
    telegram_id: TEST_PLAYER_ID,
    username: 'testplayer',
    first_name: 'Test',
    display_name: 'TestPlayer',
    level: 1,
    xp: 0,
  });

  // Give starter resources
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

  // Give starter buildings: throne room + 2 farm plots + 1 barn
  await db('player_buildings').insert({
    player_id: TEST_PLAYER_ID,
    building_id: 'throne_room',
    level: 1,
    is_building: false,
  });

  const [plotId1] = await db('player_buildings').insert({
    player_id: TEST_PLAYER_ID,
    building_id: 'farm_plot',
    level: 1,
    is_building: false,
  });

  const [plotId2] = await db('player_buildings').insert({
    player_id: TEST_PLAYER_ID,
    building_id: 'farm_plot',
    level: 1,
    is_building: false,
  });

  await db('player_buildings').insert({
    player_id: TEST_PLAYER_ID,
    building_id: 'barn',
    level: 1,
    is_building: false,
  });

  // Create farm plot slots
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

  // Seed factions
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
