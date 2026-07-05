/**
 * idleService — reporte offline "Mientras no estabas" (F1 idle).
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

async function getResource(playerId, resourceId) {
  const row = await db('player_resources')
    .where({ player_id: playerId, resource_id: resourceId })
    .first();
  return row?.amount ?? 0;
}

async function setSnapshot(playerId, { resources, kh = 0, createdAt }) {
  await db('login_snapshots').where('player_id', playerId).delete();
  await db('login_snapshots').insert({
    player_id: playerId,
    resources: JSON.stringify(resources),
    kh_balance: kh,
    created_at: createdAt,
  });
}

describe('idleService — heartbeat y downtime', () => {
  test('recordHeartbeat crea y actualiza la fila única', async () => {
    await idleService.recordHeartbeat();
    const hb1 = await db('server_heartbeat').where('id', 1).first();
    expect(hb1).toBeDefined();

    await idleService.recordHeartbeat();
    const rows = await db('server_heartbeat');
    expect(rows).toHaveLength(1);
  });

  test('recordBootGap registra caída solo si el gap supera el umbral', async () => {
    // Heartbeat fresco → sin caída
    await idleService.recordHeartbeat();
    expect(await idleService.recordBootGap()).toBeNull();

    // Heartbeat viejo (10 min) → caída registrada
    const old = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    await db('server_heartbeat').where('id', 1).update({ last_tick_at: old });
    const gap = await idleService.recordBootGap();
    expect(gap).not.toBeNull();
    expect(gap.started_at).toBe(old);

    const downs = await db('server_downtime');
    expect(downs.length).toBeGreaterThan(0);
  });

  test('downtimeWithin recorta los periodos a la ventana', async () => {
    await db('server_downtime').delete();
    const now = Date.now();
    await db('server_downtime').insert({
      started_at: new Date(now - 60 * 60 * 1000).toISOString(), // hace 1h
      ended_at: new Date(now - 30 * 60 * 1000).toISOString(),   // hace 30min
    });
    // Ventana: últimos 45 min → solapa solo 15 min
    const ms = await idleService.downtimeWithin(
      new Date(now - 45 * 60 * 1000).toISOString(),
      new Date(now).toISOString(),
    );
    expect(Math.round(ms / 60000)).toBe(15);
  });
});

describe('idleService — computeHourlyRates', () => {
  test('usa la fórmula del gameTick (rate × (1 + (nivel−1)×0.25))', async () => {
    // Seed: throne_room (no produce), farm_plot×2 lvl1 (wheat 5/h), barn lvl1
    const rates = await idleService.computeHourlyRates(TEST_PLAYER_ID);
    expect(rates.wheat).toBe(10); // 2 parcelas × 5/h × 1.0
  });

  test('escala por nivel', async () => {
    await db('player_buildings')
      .where({ player_id: TEST_PLAYER_ID, building_id: 'barn' })
      .update({ building_id: 'sawmill', level: 3 }); // wood 10/h × 1.5 = 15
    const rates = await idleService.computeHourlyRates(TEST_PLAYER_ID);
    expect(rates.wood).toBe(15);
    // restaurar
    await db('player_buildings')
      .where({ player_id: TEST_PLAYER_ID, building_id: 'sawmill' })
      .update({ building_id: 'barn', level: 1 });
  });
});

describe('idleService — buildOfflineReport', () => {
  beforeEach(async () => {
    await db('login_snapshots').delete();
    await db('server_downtime').delete();
  });

  test('primer login: crea baseline y devuelve null', async () => {
    const report = await idleService.buildOfflineReport(TEST_PLAYER_ID);
    expect(report).toBeNull();
    const snap = await db('login_snapshots').where('player_id', TEST_PLAYER_ID).first();
    expect(snap).toBeDefined();
  });

  test('ausencia corta (<5 min): sin reporte, baseline refrescado', async () => {
    await idleService.buildOfflineReport(TEST_PLAYER_ID); // baseline
    const report = await idleService.buildOfflineReport(TEST_PLAYER_ID);
    expect(report).toBeNull();
  });

  test('reporta delta de recursos acumulados durante la ausencia', async () => {
    const before = await getResource(TEST_PLAYER_ID, 'gold');
    await setSnapshot(TEST_PLAYER_ID, {
      resources: { gold: before - 50 }, // "tenía 50 menos al irse"
      createdAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // hace 1h
    });

    const report = await idleService.buildOfflineReport(TEST_PLAYER_ID);
    expect(report).not.toBeNull();
    expect(report.resources.gold).toBe(50);
    expect(report.awayMs).toBeGreaterThan(50 * 60 * 1000);
  });

  test('catch-up por caída del server acredita producción con las tasas reales', async () => {
    const awayFrom = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(); // 2h
    const wheatBefore = await getResource(TEST_PLAYER_ID, 'wheat');

    await setSnapshot(TEST_PLAYER_ID, {
      resources: { wheat: wheatBefore },
      createdAt: awayFrom,
    });
    // El server estuvo caído 2h completas dentro de la ausencia
    await db('server_downtime').insert({
      started_at: awayFrom,
      ended_at: new Date().toISOString(),
    });

    const report = await idleService.buildOfflineReport(TEST_PLAYER_ID);
    expect(report).not.toBeNull();
    // 2 farm_plots lvl1 → 10 wheat/h × 2h = 20 acreditadas por catch-up
    expect(report.catchUp.wheat).toBe(20);
    expect(report.resources.wheat).toBe(20); // el delta incluye el catch-up
    expect(await getResource(TEST_PLAYER_ID, 'wheat')).toBe(wheatBefore + 20);
  });

  test('el catch-up respeta el cap de 12 horas', async () => {
    const awayFrom = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(); // 48h
    const wheatBefore = await getResource(TEST_PLAYER_ID, 'wheat');

    await setSnapshot(TEST_PLAYER_ID, {
      resources: { wheat: wheatBefore },
      createdAt: awayFrom,
    });
    await db('server_downtime').insert({
      started_at: awayFrom,
      ended_at: new Date().toISOString(),
    });
    // Capacidad amplia para que el cap que actúe sea el de horas, no el de almacén
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wheat' })
      .update({ capacity: 100000 });

    const report = await idleService.buildOfflineReport(TEST_PLAYER_ID);
    // 10/h × 12h (cap) = 120 — NO 480
    expect(report.catchUp.wheat).toBe(120);
  });

  test('sin caída del server no hay catch-up (no doble conteo)', async () => {
    const wheatBefore = await getResource(TEST_PLAYER_ID, 'wheat');
    await setSnapshot(TEST_PLAYER_ID, {
      resources: { wheat: wheatBefore },
      createdAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
    });

    const report = await idleService.buildOfflineReport(TEST_PLAYER_ID);
    // Sin downtime rows → catchUp vacío; recursos idénticos → sin delta ni premio
    if (report) {
      expect(Object.keys(report.catchUp)).toHaveLength(0);
      expect(report.resources.wheat).toBeUndefined();
    }
    expect(await getResource(TEST_PLAYER_ID, 'wheat')).toBe(wheatBefore);
  });
});
