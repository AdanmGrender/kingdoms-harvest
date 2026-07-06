/**
 * galaxyService — Escala Galaxia (G2 idle). DB in-memory.
 */
const { initTestDb, seedTestData, TEST_PLAYER_ID } = require('./setup');
const { SYSTEM_PLANETS, WARP_TURBULENCE_MULT } = require('../../shared/gameConfig');

let db;
let galaxyService;
let stormService;

const NON_HOME = SYSTEM_PLANETS.filter((p) => !p.homeworld);

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  galaxyService = require('../src/services/galaxyService');
  stormService = require('../src/services/stormService');
});

beforeEach(async () => {
  await db('player_systems').where('player_id', TEST_PLAYER_ID).delete();
  await db('player_warp').where('player_id', TEST_PLAYER_ID).delete();
  await db('player_planets').where('player_id', TEST_PLAYER_ID).delete();
  await db('warp_storms').delete();
  stormService._invalidate();
  for (const r of ['gold', 'crystal']) {
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: r })
      .update({ amount: 999999, capacity: 9999999 })
      .catch(() => {});
  }
  // asegurar fila de crystal (recurso raro puede no existir en el seed)
  const c = await db('player_resources')
    .where({ player_id: TEST_PLAYER_ID, resource_id: 'crystal' }).first();
  if (!c) {
    await db('player_resources').insert({
      player_id: TEST_PLAYER_ID, resource_id: 'crystal', amount: 999999, capacity: 9999999,
    });
  }
});

async function masterSystem() {
  for (const p of NON_HOME) {
    await db('player_planets').insert({
      player_id: TEST_PLAYER_ID, planet_id: p.id, claimed_at: new Date().toISOString(),
    });
  }
}

describe('gate por dominio del Sistema', () => {
  test('bloqueada hasta reclamar todos los planetas no-natales', async () => {
    const g1 = await galaxyService.getGalaxy(TEST_PLAYER_ID);
    expect(g1.unlocked).toBe(false);
    expect(g1.systems.find((s) => s.id === 'natal').state).toBe('claimed');
    expect(g1.systems.find((s) => s.id === 'verglobo').state).toBe('locked');

    await masterSystem();
    const g2 = await galaxyService.getGalaxy(TEST_PLAYER_ID);
    expect(g2.unlocked).toBe(true);
    expect(g2.systems.find((s) => s.id === 'verglobo').state).toBe('available');
  });
});

describe('launchWarp', () => {
  test('rechaza sin dominar el sistema', async () => {
    await expect(galaxyService.launchWarp(TEST_PLAYER_ID, 'verglobo'))
      .rejects.toThrow(/planetas de tu sistema natal/);
  });

  test('surca la Disformidad, cobra el costo y queda en tránsito', async () => {
    await masterSystem();
    const res = await galaxyService.launchWarp(TEST_PLAYER_ID, 'verglobo');
    expect(res.success).toBe(true);
    expect(res.turbulent).toBe(false);
    const g = await galaxyService.getGalaxy(TEST_PLAYER_ID);
    expect(g.warp.status).toBe('traveling');
    expect(g.warp.target).toBe('verglobo');
  });

  test('respeta el orden secuencial de sistemas', async () => {
    await masterSystem();
    await expect(galaxyService.launchWarp(TEST_PLAYER_ID, 'kthar'))
      .rejects.toThrow(/Primero controlá/);
  });

  test('tormenta activa → travesía turbulenta (más tiempo)', async () => {
    await masterSystem();
    await stormService.forceStorm('velo_estatico', { durationMin: 120 });

    const res = await galaxyService.launchWarp(TEST_PLAYER_ID, 'verglobo');
    expect(res.turbulent).toBe(true);
    // 180 min base × 1.5 = 270
    expect(res.warpMin).toBe(Math.round(180 * WARP_TURBULENCE_MULT));

    await db('warp_storms').delete();
    stormService._invalidate();
  });
});

describe('resolveWarpArrival + tributo', () => {
  test('al llegar el Crucero se reclama el sistema y encadena el siguiente', async () => {
    await masterSystem();
    await galaxyService.launchWarp(TEST_PLAYER_ID, 'verglobo');
    await db('player_warp').where('player_id', TEST_PLAYER_ID)
      .update({ arrives_at: new Date(Date.now() - 1000).toISOString() });

    const claimed = await galaxyService.resolveWarpArrival(TEST_PLAYER_ID);
    expect(claimed).toBe('verglobo');

    const g = await galaxyService.getGalaxy(TEST_PLAYER_ID);
    expect(g.warp.status).toBe('idle');
    expect(g.systems.find((s) => s.id === 'verglobo').state).toBe('claimed');
    expect(g.systems.find((s) => s.id === 'kthar').state).toBe('available');
  });

  test('distributeTribute añade el tributo del sistema reclamado', async () => {
    await db('player_systems').insert({
      player_id: TEST_PLAYER_ID, system_id: 'verglobo',
      claimed_at: new Date().toISOString(),
    });
    const wheatBefore = (await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wheat' }).first())?.amount ?? 0;
    await galaxyService.distributeTribute();
    const wheatAfter = (await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wheat' }).first()).amount;
    expect(wheatAfter).toBe(wheatBefore + 40); // tribute.wheat de verglobo
  });
});
