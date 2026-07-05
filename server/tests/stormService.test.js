/**
 * stormService — Tormentas Disformes (F2 idle). DB in-memory.
 */
const { initTestDb, seedTestData, TEST_PLAYER_ID } = require('./setup');
const { WARP_STORMS } = require('../../shared/gameConfig');

let db;
let stormService;

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  stormService = require('../src/services/stormService');
});

beforeEach(async () => {
  await db('warp_storms').delete();
  stormService._invalidate();
});

// Las suites comparten la DB in-memory del worker: no dejar tormentas activas
// que sellen convoyes o alteren multiplicadores en otras suites.
afterAll(async () => {
  await db('warp_storms').delete();
  stormService._invalidate();
});

describe('stormService — forceStorm y getActive', () => {
  test('forceStorm activa una tormenta con catálogo y modificadores', async () => {
    await stormService.forceStorm('velo_estatico', { durationMin: 60 });
    const active = await stormService.getActive();
    expect(active).not.toBeNull();
    expect(active.id).toBe('velo_estatico');
    expect(active.modifiers.farming).toBe(-0.25);
  });

  test('solo una tormenta activa a la vez', async () => {
    await stormService.forceStorm('velo_estatico', { durationMin: 60 });
    await stormService.forceStorm('lluvia_de_energia', { durationMin: 60 });
    const rows = await db('warp_storms').where('is_active', 1);
    expect(rows).toHaveLength(1);
    expect(rows[0].storm_type).toBe('lluvia_de_energia');
  });

  test('la intensidad escala los modificadores', async () => {
    await stormService.forceStorm('lluvia_de_energia', { intensity: 3, durationMin: 60 });
    const active = await stormService.getActive();
    // kh_bonus 0.5 × (1 + (3−1)×0.5) = 1.0
    expect(active.modifiers.kh_bonus).toBe(1);
    expect(active.intensity).toBe(3);
  });

  test('getActive devuelve null cuando la tormenta venció', async () => {
    await stormService.forceStorm('calma_falsa', { durationMin: 60 });
    await db('warp_storms').update({
      ends_at: new Date(Date.now() - 1000).toISOString(),
    });
    stormService._invalidate();
    expect(await stormService.getActive()).toBeNull();
  });
});

describe('stormService — modificadores y guards', () => {
  test('getModifier devuelve 0 sin tormenta', async () => {
    expect(await stormService.getModifier('farming')).toBe(0);
  });

  test('getModifier expone el delta de la tormenta activa', async () => {
    await stormService.forceStorm('marea_carmesi', { durationMin: 60 });
    expect(await stormService.getModifier('atk')).toBe(0.3);
    expect(await stormService.getModifier('farming')).toBe(0);
  });

  test('convoysSealed solo con tormentas que sellan', async () => {
    expect(await stormService.convoysSealed()).toBe(false);
    await stormService.forceStorm('velo_estatico', { durationMin: 60 });
    expect(await stormService.convoysSealed()).toBe(true);

    await stormService.forceStorm('lluvia_de_energia', { durationMin: 60 });
    expect(await stormService.convoysSealed()).toBe(false);
  });

  test('el comercio de convoyes rechaza operaciones bajo Velo Estático', async () => {
    await stormService.forceStorm('velo_estatico', { durationMin: 60 });
    const commerceService = require('../src/services/commerceService');
    await expect(
      commerceService.sellToCaravan(TEST_PLAYER_ID, 'wheat', 1)
    ).rejects.toThrow(/selló las rutas/);
  });
});

describe('stormService — tick', () => {
  test('cierra tormentas vencidas', async () => {
    await stormService.forceStorm('calma_falsa', { durationMin: 60 });
    await db('warp_storms').update({
      ends_at: new Date(Date.now() - 1000).toISOString(),
    });
    stormService._invalidate();

    await stormService.tick();
    const rows = await db('warp_storms').where('is_active', 1);
    expect(rows).toHaveLength(0);
  });

  test('con tormenta activa no programa otra', async () => {
    await stormService.forceStorm('velo_estatico', { durationMin: 60 });
    const started = await stormService.tick();
    expect(started).toBeNull();
    const rows = await db('warp_storms');
    expect(rows).toHaveLength(1);
  });

  test('calma_falsa deja hasten_next para acortar la espera', async () => {
    await stormService.forceStorm('calma_falsa', { durationMin: 60 });
    const row = await db('warp_storms').orderBy('id', 'desc').first();
    expect(row.hasten_next).toBe(1);
  });
});

describe('WARP_STORMS — catálogo', () => {
  test('todos los tipos tienen los campos obligatorios', () => {
    for (const storm of Object.values(WARP_STORMS)) {
      expect(storm.id).toBeTruthy();
      expect(storm.name).toBeTruthy();
      expect(Array.isArray(storm.durationMs)).toBe(true);
      expect(storm.durationMs).toHaveLength(2);
      expect(typeof storm.modifiers).toBe('object');
      expect(storm.weight).toBeGreaterThan(0);
    }
  });
});
