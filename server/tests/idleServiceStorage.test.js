/**
 * idleService — campo aditivo `storage` del reporte offline (reporte_escribano).
 * DB in-memory (NODE_ENV=test via setup.js).
 */
const { initTestDb, seedTestData, TEST_PLAYER_ID } = require('./setup');

let db;
let idleService;

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  idleService = require('../src/services/idleService');
});

async function setSnapshot(playerId, { resources, kh = 0, createdAt }) {
  await db('login_snapshots').where('player_id', playerId).delete();
  await db('login_snapshots').insert({
    player_id: playerId,
    resources: JSON.stringify(resources),
    kh_balance: kh,
    created_at: createdAt,
  });
}

async function setResource(resourceId, fields) {
  await db('player_resources')
    .where({ player_id: TEST_PLAYER_ID, resource_id: resourceId })
    .update(fields);
}

async function currentResources() {
  const rows = await db('player_resources').where('player_id', TEST_PLAYER_ID);
  const map = {};
  for (const r of rows) map[r.resource_id] = r.amount;
  return map;
}

const hourAgo = () => new Date(Date.now() - 60 * 60 * 1000).toISOString();

describe('idleService.buildOfflineReport — storage', () => {
  beforeEach(async () => {
    await db('login_snapshots').delete();
    await db('server_downtime').delete();
    await setResource('gold', { amount: 200, capacity: 1000 });
    await setResource('wood', { amount: 100, capacity: 1000 });
  });

  test('recurso con delta: entrada con amount y capacity reales', async () => {
    const now = await currentResources();
    await setSnapshot(TEST_PLAYER_ID, {
      resources: { ...now, gold: now.gold - 50 },
      createdAt: hourAgo(),
    });
    await setResource('gold', { capacity: 800 });

    const report = await idleService.buildOfflineReport(TEST_PLAYER_ID);
    expect(report).not.toBeNull();
    expect(report.resources.gold).toBe(50);
    expect(report.storage.gold).toEqual({ amount: now.gold, capacity: 800 });
    // un recurso sin delta ni lleno no entra
    expect(report.storage.wood).toBeUndefined();
  });

  test('granero lleno sin delta: la entrada está presente aunque el reporte exista por otro recurso', async () => {
    await setResource('wood', { amount: 500, capacity: 500 });
    const now = await currentResources();
    await setSnapshot(TEST_PLAYER_ID, {
      resources: { ...now, gold: now.gold - 10 },
      createdAt: hourAgo(),
    });

    const report = await idleService.buildOfflineReport(TEST_PLAYER_ID);
    expect(report).not.toBeNull();
    expect(report.resources.wood).toBeUndefined();
    expect(report.storage.wood).toEqual({ amount: 500, capacity: 500 });
  });

  test('granero lleno sin delta ni eventos: el reporte sigue siendo null', async () => {
    await setResource('wood', { amount: 500, capacity: 500 });
    const now = await currentResources();
    await setSnapshot(TEST_PLAYER_ID, { resources: now, createdAt: hourAgo() });

    const report = await idleService.buildOfflineReport(TEST_PLAYER_ID);
    expect(report).toBeNull();
  });

  test('capacidad nula: sin entrada en storage y sin excepción', async () => {
    const now = await currentResources();
    await setSnapshot(TEST_PLAYER_ID, {
      resources: { ...now, gold: now.gold - 50 },
      createdAt: hourAgo(),
    });
    await setResource('gold', { capacity: null });

    const report = await idleService.buildOfflineReport(TEST_PLAYER_ID);
    expect(report).not.toBeNull();
    expect(report.resources.gold).toBe(50);
    expect('gold' in report.storage).toBe(false);
  });

  test('los campos existentes del reporte siguen presentes', async () => {
    const now = await currentResources();
    await setSnapshot(TEST_PLAYER_ID, {
      resources: { ...now, gold: now.gold - 50 },
      createdAt: hourAgo(),
    });

    const report = await idleService.buildOfflineReport(TEST_PLAYER_ID);
    for (const key of ['awayMs', 'resources', 'khEarned', 'catchUp', 'downtimeMs', 'events']) {
      expect(report).toHaveProperty(key);
    }
    expect(report.awayMs).toBeGreaterThan(50 * 60 * 1000);
    expect(report.storage).toEqual(expect.any(Object));
  });
});
