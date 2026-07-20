/**
 * boostService — F3 Boost ×2 producción (sink de gemas). DB in-memory.
 *
 * INVARIANTE bajo test: el boost multiplica SOLO la ganancia de recursos
 * (farm yield / oro de venta) — el KH otorgado vía awardTokens es IDÉNTICO
 * con y sin boost activo.
 */
const crypto = require('crypto');
const { GEM_SINKS } = require('../../shared/shopConfig');
const { TOKEN_CONFIG } = require('../../shared/tokenConfig');
const db = require('../src/config/database');
const { initTestDb, seedTestData } = require('./setup');

let boostService;
let farmService;

beforeAll(async () => {
  await initTestDb();
  await seedTestData();
  boostService = require('../src/services/boostService');
  farmService = require('../src/services/farmService');
});

async function freshPlayer(id, { gems = 0 } = {}) {
  await db('players').where('telegram_id', id).delete();
  await db('player_boosts').where('player_id', id).delete();
  await db('player_gems').where('player_id', id).delete();
  await db('player_resources').where('player_id', id).delete();
  await db('player_buildings').where('player_id', id).delete();
  await db('farm_plots').where('player_id', id).delete();
  await db('player_tokens').where('player_id', id).delete();

  await db('players').insert({
    telegram_id: id, username: 'b', first_name: 'B', display_name: 'B',
    level: 1, xp: 0, created_at: new Date().toISOString(),
  });
  await db('player_gems').insert({
    player_id: id, balance: gems, total_purchased: gems, total_spent: 0,
    updated_at: new Date().toISOString(),
  });
  await db('player_resources').insert({
    player_id: id, resource_id: 'gold', amount: 1000, capacity: 10000,
  });
  boostService._invalidate(id);
}

describe('boostService.buy', () => {
  test('descuenta 80 gemas y activa 4h', async () => {
    await freshPlayer(920001, { gems: 100 });

    const res = await boostService.buy(920001);

    const gems = await db('player_gems').where('player_id', 920001).first();
    expect(gems.balance).toBe(100 - GEM_SINKS.production_boost.costGems);

    const row = await db('player_boosts').where('player_id', 920001).first();
    expect(row).toBeDefined();
    expect(row.boost_id).toBe('production_boost');

    const expectedMs = GEM_SINKS.production_boost.hours * 60 * 60 * 1000;
    const actualMs = new Date(row.expires_at).getTime() - Date.now();
    expect(actualMs).toBeGreaterThan(expectedMs - 5000);
    expect(actualMs).toBeLessThanOrEqual(expectedMs + 5000);
    expect(res.expiresAt).toBe(row.expires_at);
  });

  test('recomprar con boost activo EXTIENDE +4h (no resetea)', async () => {
    await freshPlayer(920002, { gems: 200 });

    await boostService.buy(920002);
    const first = await db('player_boosts').where('player_id', 920002).first();

    await boostService.buy(920002);
    const second = await db('player_boosts').where('player_id', 920002).first();

    const deltaMs = new Date(second.expires_at).getTime() - new Date(first.expires_at).getTime();
    const durationMs = GEM_SINKS.production_boost.hours * 60 * 60 * 1000;
    expect(deltaMs).toBeGreaterThan(durationMs - 5000);
    expect(deltaMs).toBeLessThanOrEqual(durationMs + 5000);

    const gems = await db('player_gems').where('player_id', 920002).first();
    expect(gems.balance).toBe(200 - 2 * GEM_SINKS.production_boost.costGems);
  });

  test('sin gemas suficientes rechaza y no crea/gasta nada', async () => {
    await freshPlayer(920003, { gems: 10 });

    await expect(boostService.buy(920003)).rejects.toThrow();

    const gems = await db('player_gems').where('player_id', 920003).first();
    expect(gems.balance).toBe(10);

    const row = await db('player_boosts').where('player_id', 920003).first();
    expect(row).toBeUndefined();
  });
});

describe('boostService.getMultiplier', () => {
  test('2 con boost activo, 1 sin fila', async () => {
    await freshPlayer(920004, { gems: 100 });
    expect(await boostService.getMultiplier(920004)).toBe(1);

    await boostService.buy(920004);
    expect(await boostService.getMultiplier(920004)).toBe(2);
  });

  test('1 cuando la fila existe pero venció', async () => {
    await freshPlayer(920005, { gems: 100 });
    await db('player_boosts').insert({
      player_id: 920005,
      boost_id: 'production_boost',
      expires_at: new Date(Date.now() - 1000).toISOString(),
    });
    boostService._invalidate(920005);

    expect(await boostService.getMultiplier(920005)).toBe(1);
  });
});

describe('boostService × farmService — invariante de dinero', () => {
  async function harvestOnce(playerId) {
    // Roll determinístico: crypto.randomInt(0, 2^31-1) → 0 fuerza
    // baseYield=min y quality=EXCELLENT (mismo roll en ambos lados de la
    // comparación, así el ×2 del boost es la ÚNICA variable).
    const spy = jest.spyOn(crypto, 'randomInt').mockReturnValue(0);
    try {
      const [{ id: buildingId }] = await db('player_buildings').insert({
        player_id: playerId, building_id: 'farm_plot', level: 1, is_building: false,
      }).returning('id');
      const [{ id: plotId }] = await db('farm_plots').insert({
        player_id: playerId,
        building_id: buildingId,
        state: 'ready',
        crop_id: 'wheat',
        planted_at: new Date(Date.now() - 3600000).toISOString(),
        ready_at: new Date(Date.now() - 60000).toISOString(),
      }).returning('id');

      return await farmService.harvestCrop(playerId, plotId);
    } finally {
      spy.mockRestore();
    }
  }

  test('cosecha con boost activo duplica el recurso pero el KH es idéntico', async () => {
    await freshPlayer(920010, { gems: 100 });

    const without = await harvestOnce(920010);
    expect(without.tokensAwarded).toBe(TOKEN_CONFIG.TOKENS_PER_HARVEST);

    await boostService.buy(920010);
    const withBoost = await harvestOnce(920010);

    expect(withBoost.quantity).toBe(without.quantity * 2);
    expect(withBoost.tokensAwarded).toBe(without.tokensAwarded);
    expect(withBoost.tokensAwarded).toBe(TOKEN_CONFIG.TOKENS_PER_HARVEST);
  });
});
