/**
 * systemService — Escala Sistema (G1 idle). DB in-memory.
 */
const { initTestDb, seedTestData, TEST_PLAYER_ID } = require('./setup');
const { SYSTEM_UNLOCK_LEVEL } = require('../../shared/gameConfig');

let db;
let systemService;

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  systemService = require('../src/services/systemService');
});

beforeEach(async () => {
  await db('player_planets').where('player_id', TEST_PLAYER_ID).delete();
  await db('player_ship').where('player_id', TEST_PLAYER_ID).delete();
  // Reset throne room bajo el gate y recursos generosos
  await db('player_buildings')
    .where({ player_id: TEST_PLAYER_ID, building_id: 'throne_room' })
    .update({ level: 1 });
  for (const r of ['gold', 'iron', 'stone', 'water']) {
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: r })
      .update({ amount: 99999, capacity: 999999 });
  }
});

async function unlockScale() {
  await db('player_buildings')
    .where({ player_id: TEST_PLAYER_ID, building_id: 'throne_room' })
    .update({ level: SYSTEM_UNLOCK_LEVEL });
}

async function resource(res) {
  const row = await db('player_resources')
    .where({ player_id: TEST_PLAYER_ID, resource_id: res }).first();
  return row?.amount ?? 0;
}

describe('getSystem — gate y estados', () => {
  test('bloqueado bajo el nivel requerido; mundo natal siempre reclamado', async () => {
    const sys = await systemService.getSystem(TEST_PLAYER_ID);
    expect(sys.unlocked).toBe(false);
    const home = sys.planets.find((p) => p.id === 'cadmion');
    expect(home.state).toBe('claimed');
    const ferryn = sys.planets.find((p) => p.id === 'ferryn');
    expect(ferryn.state).toBe('locked');
  });

  test('al alcanzar el nivel, el primer planeta queda disponible', async () => {
    await unlockScale();
    const sys = await systemService.getSystem(TEST_PLAYER_ID);
    expect(sys.unlocked).toBe(true);
    expect(sys.planets.find((p) => p.id === 'ferryn').state).toBe('available');
    // El segundo sigue bloqueado (pide el primero)
    expect(sys.planets.find((p) => p.id === 'cineria').state).toBe('locked');
  });
});

describe('launchShip', () => {
  test('rechaza si la escala no está desbloqueada', async () => {
    await expect(systemService.launchShip(TEST_PLAYER_ID, 'ferryn'))
      .rejects.toThrow(/nivel/);
  });

  test('lanza la nave, cobra el costo y queda en tránsito', async () => {
    await unlockScale();
    const goldBefore = await resource('gold');
    const res = await systemService.launchShip(TEST_PLAYER_ID, 'ferryn');
    expect(res.success).toBe(true);
    expect(await resource('gold')).toBe(goldBefore - 200); // cost.gold de ferryn

    const sys = await systemService.getSystem(TEST_PLAYER_ID);
    expect(sys.ship.status).toBe('traveling');
    expect(sys.ship.target).toBe('ferryn');
    expect(sys.planets.find((p) => p.id === 'ferryn').state).toBe('traveling');
  });

  test('no permite dos viajes a la vez', async () => {
    await unlockScale();
    await systemService.launchShip(TEST_PLAYER_ID, 'ferryn');
    await expect(systemService.launchShip(TEST_PLAYER_ID, 'ferryn'))
      .rejects.toThrow(/tránsito/);
  });

  test('respeta el orden secuencial', async () => {
    await unlockScale();
    await expect(systemService.launchShip(TEST_PLAYER_ID, 'cineria'))
      .rejects.toThrow(/Primero controlá/);
  });

  test('rechaza sin recursos', async () => {
    await unlockScale();
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).update({ amount: 10 });
    await expect(systemService.launchShip(TEST_PLAYER_ID, 'ferryn'))
      .rejects.toThrow(/Necesitás/);
  });
});

describe('resolveArrival + tributo', () => {
  test('al llegar la nave se reclama el planeta y la nave vuelve a idle', async () => {
    await unlockScale();
    await systemService.launchShip(TEST_PLAYER_ID, 'ferryn');
    // Forzar llegada al pasado
    await db('player_ship').where('player_id', TEST_PLAYER_ID)
      .update({ arrives_at: new Date(Date.now() - 1000).toISOString() });

    const planetId = await systemService.resolveArrival(TEST_PLAYER_ID);
    expect(planetId).toBe('ferryn');

    const sys = await systemService.getSystem(TEST_PLAYER_ID);
    expect(sys.ship.status).toBe('idle');
    expect(sys.planets.find((p) => p.id === 'ferryn').state).toBe('claimed');
    // Ahora el segundo se desbloquea
    expect(sys.planets.find((p) => p.id === 'cineria').state).toBe('available');
  });

  test('distributeTribute añade el tributo del planeta reclamado', async () => {
    await unlockScale();
    await db('player_planets').insert({
      player_id: TEST_PLAYER_ID, planet_id: 'ferryn',
      claimed_at: new Date().toISOString(),
    });
    const ironBefore = await resource('iron');
    await systemService.distributeTribute();
    expect(await resource('iron')).toBe(ironBefore + 8); // tribute.iron de ferryn
  });

  test('resolveArrival es idempotente (no reclama dos veces)', async () => {
    await unlockScale();
    await systemService.launchShip(TEST_PLAYER_ID, 'ferryn');
    await db('player_ship').where('player_id', TEST_PLAYER_ID)
      .update({ arrives_at: new Date(Date.now() - 1000).toISOString() });
    await systemService.resolveArrival(TEST_PLAYER_ID);
    const second = await systemService.resolveArrival(TEST_PLAYER_ID);
    expect(second).toBeNull();
    const rows = await db('player_planets')
      .where({ player_id: TEST_PLAYER_ID, planet_id: 'ferryn' });
    expect(rows).toHaveLength(1);
  });
});
