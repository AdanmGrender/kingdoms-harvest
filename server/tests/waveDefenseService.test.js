/**
 * waveDefenseService — Marea Disforme (F3 idle). DB in-memory.
 */
const { initTestDb, seedTestData, TEST_PLAYER_ID } = require('./setup');
const { WAVE_CONFIG } = require('../../shared/gameConfig');

let db;
let waveDefenseService;

// rand determinista para tests reproducibles
const fixedRand = (() => {
  let seed = 12345;
  return () => {
    seed = (seed * 16807) % 2147483647;
    return seed / 2147483647;
  };
})();

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  waveDefenseService = require('../src/services/waveDefenseService');
});

beforeEach(async () => {
  await db('wave_progress').delete();
  await db('wave_runs').delete();
  await db('player_troops').where('player_id', TEST_PLAYER_ID).delete();
});

async function giveDefenses({ militia = 50, towerLevel = 5, wallLevel = 5 } = {}) {
  if (militia > 0) {
    await db('player_troops').insert({
      player_id: TEST_PLAYER_ID, troop_id: 'militia', quantity: militia,
    });
  }
  if (towerLevel > 0) {
    await db('player_buildings').insert({
      player_id: TEST_PLAYER_ID, building_id: 'tower', level: towerLevel, is_building: false,
    });
  }
  if (wallLevel > 0) {
    await db('player_buildings').insert({
      player_id: TEST_PLAYER_ID, building_id: 'wall', level: wallLevel, is_building: false,
    });
  }
}

afterEach(async () => {
  await db('player_buildings')
    .where('player_id', TEST_PLAYER_ID)
    .whereIn('building_id', ['tower', 'wall', 'trap'])
    .delete();
});

describe('getStatus', () => {
  test('crea la fila de progreso al primer acceso', async () => {
    const status = await waveDefenseService.getStatus(TEST_PLAYER_ID);
    expect(status.highestWave).toBe(0);
    expect(status.nextWave).toBe(1);
    expect(status.nextIsBoss).toBe(false);
  });

  test('marca la próxima oleada jefe', async () => {
    await waveDefenseService.getStatus(TEST_PLAYER_ID);
    await db('wave_progress').where('player_id', TEST_PLAYER_ID)
      .update({ highest_wave: WAVE_CONFIG.bossEvery - 1 });
    const status = await waveDefenseService.getStatus(TEST_PLAYER_ID);
    expect(status.nextIsBoss).toBe(true);
  });
});

describe('startRun', () => {
  test('rechaza sin defensas', async () => {
    await expect(
      waveDefenseService.startRun(TEST_PLAYER_ID, { rand: fixedRand })
    ).rejects.toThrow(/Sin defensas/);
  });

  test('run victorioso: avanza la escalera, paga oro y KH, log completo', async () => {
    await giveDefenses({ militia: 200, towerLevel: 10, wallLevel: 10 });
    const goldBefore = (await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first()).amount;

    const result = await waveDefenseService.startRun(TEST_PLAYER_ID, { rand: fixedRand });

    expect(result.victory).toBe(true);
    expect(result.wavesCleared).toBe(WAVE_CONFIG.wavesPerRun);
    expect(result.highestWave).toBe(WAVE_CONFIG.wavesPerRun);
    expect(result.rewards.gold).toBeGreaterThan(0);
    expect(result.log.length).toBeGreaterThan(3);
    expect(result.log.some((l) => l.type === 'wave_start')).toBe(true);
    expect(result.log.some((l) => l.type === 'wave_clear')).toBe(true);

    const goldAfter = (await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first()).amount;
    expect(goldAfter).toBeGreaterThan(goldBefore);

    const progress = await db('wave_progress').where('player_id', TEST_PLAYER_ID).first();
    expect(progress.highest_wave).toBe(WAVE_CONFIG.wavesPerRun);
    expect(progress.total_runs).toBe(1);

    const runs = await db('wave_runs').where('player_id', TEST_PLAYER_ID);
    expect(runs).toHaveLength(1);
    expect(JSON.parse(runs[0].log).length).toBe(result.log.length);
  });

  test('defensa débil en oleada alta: derrota con bajas de guarnición', async () => {
    await giveDefenses({ militia: 3, towerLevel: 1, wallLevel: 0 });
    // Escalera alta → oleadas brutales
    await waveDefenseService.getStatus(TEST_PLAYER_ID);
    await db('wave_progress').where('player_id', TEST_PLAYER_ID)
      .update({ highest_wave: 30 });

    const result = await waveDefenseService.startRun(TEST_PLAYER_ID, { rand: fixedRand });
    expect(result.victory).toBe(false);
    expect(result.log.some((l) => l.type === 'defeat')).toBe(true);
  });

  test('la oleada jefe aparece cada bossEvery', async () => {
    await giveDefenses({ militia: 500, towerLevel: 15, wallLevel: 15 });
    await waveDefenseService.getStatus(TEST_PLAYER_ID);
    await db('wave_progress').where('player_id', TEST_PLAYER_ID)
      .update({ highest_wave: WAVE_CONFIG.bossEvery - 1 }); // próxima = jefe

    const result = await waveDefenseService.startRun(TEST_PLAYER_ID, { rand: fixedRand });
    const bossLog = result.log.find((l) => l.type === 'wave_start' && l.boss);
    expect(bossLog).toBeDefined();
    expect(bossLog.wave).toBe(WAVE_CONFIG.bossEvery);
  });

  test('el progreso solo sube con victorias', async () => {
    await giveDefenses({ militia: 200, towerLevel: 10, wallLevel: 10 });
    await waveDefenseService.startRun(TEST_PLAYER_ID, { rand: fixedRand });
    const p1 = await db('wave_progress').where('player_id', TEST_PLAYER_ID).first();

    // Segundo run arranca donde quedó
    const status = await waveDefenseService.getStatus(TEST_PLAYER_ID);
    expect(status.nextWave).toBe(p1.highest_wave + 1);
  });

  test('grantFreeRuns habilita el flag para todos', async () => {
    await waveDefenseService.getStatus(TEST_PLAYER_ID);
    await waveDefenseService.grantFreeRuns();
    const status = await waveDefenseService.getStatus(TEST_PLAYER_ID);
    expect(status.freeRunAvailable).toBe(true);
  });
});

describe('getHistory', () => {
  test('devuelve runs con rewards parseadas', async () => {
    await giveDefenses({ militia: 200, towerLevel: 10, wallLevel: 10 });
    await waveDefenseService.startRun(TEST_PLAYER_ID, { rand: fixedRand });
    const history = await waveDefenseService.getHistory(TEST_PLAYER_ID);
    expect(history).toHaveLength(1);
    expect(history[0].victory).toBe(true);
    expect(typeof history[0].rewards).toBe('object');
  });
});
