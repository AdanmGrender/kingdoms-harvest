// Regresiones de la ronda de QA multi-agente (capa meta, que NO tenía tests).
// Cada test fija un bug real encontrado y arreglado.
const { initTestDb, seedTestData } = require('./setup');

let db;
let prestige, buildingService, dailyTaskService, marketplaceService;

async function freshPlayer(id, level = 25) {
  await db('players').where('telegram_id', id).delete();
  await db('players').insert({
    telegram_id: id, username: 'qa', first_name: 'QA', display_name: 'QA',
    level, xp: 100, created_at: new Date().toISOString(),
  });
}
async function setGold(id, amount) {
  await db('player_resources').where({ player_id: id, resource_id: 'gold' }).delete();
  await db('player_resources').insert({ player_id: id, resource_id: 'gold', amount });
}

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  prestige = require('../src/services/prestigeService');
  buildingService = require('../src/services/buildingService');
  dailyTaskService = require('../src/services/dailyTaskService');
  marketplaceService = require('../src/services/marketplaceService');
});

// ── H1: prestige borraba tablas inexistentes → estado corrupto ────────────────
describe('prestige (H1): executePrestige es atómico y borra las tablas correctas', () => {
  const P = 880001;
  test('no lanza, resetea nivel, suma puntos y BORRA edificios/tropas/recursos', async () => {
    await freshPlayer(P, 25);
    await setGold(P, 500);
    await db('player_buildings').insert({ player_id: P, building_id: 'mill', level: 1, position_x: 1, position_y: 1, created_at: new Date().toISOString() });
    await db('player_troops').where('player_id', P).delete();
    await db('player_troops').insert({ player_id: P, troop_id: 'militia', quantity: 10 });

    const res = await prestige.executePrestige(P); // antes tiraba "no such table: buildings"
    expect(res.success).toBe(true);

    const post = await db('players').where('telegram_id', P).first();
    expect(post.level).toBe(1);
    expect(post.prestige_points).toBeGreaterThan(0);
    expect((await db('player_buildings').where('player_id', P)).length).toBe(0);
    expect((await db('player_troops').where('player_id', P)).length).toBe(0);
    expect((await db('player_resources').where('player_id', P)).length).toBe(0);
  });
});

// ── H2: 4/5 upgrades de prestige no hacían nada + el de costo estaba invertido ─
describe('prestige (H2): los multiplicadores existen y el de reducción ABARATA', () => {
  const P = 880002;
  test('build_cost_redux < 1 (abarata) y crop/sell/atk > 1 (mejoran)', async () => {
    await freshPlayer(P, 25);
    await db('prestige_upgrades').where('player_id', P).delete();
    await db('prestige_upgrades').insert([
      { player_id: P, upgrade_id: 'architects_guild', level: 6 },
      { player_id: P, upgrade_id: 'veteran_farmer', level: 10 },
      { player_id: P, upgrade_id: 'merchants_eye', level: 10 },
      { player_id: P, upgrade_id: 'battle_hardened', level: 10 },
    ]);
    const m = await prestige.getMultipliers(P);
    expect(m.build_cost_redux).toBeLessThan(1);   // antes daba 1.25 → ENCARECÍA
    expect(m.build_cost_redux).toBeGreaterThanOrEqual(0.5);
    expect(m.crop_yield).toBeGreaterThan(1);
    expect(m.sell_price).toBeGreaterThan(1);
    expect(m.combat_atk).toBeGreaterThan(1);

    // El costo con la mejora es MENOR que el base.
    const base = buildingService.calculateCost('mill', 1).cost;
    const cheap = buildingService.calculateCost('mill', 1, m.build_cost_redux).cost;
    expect(cheap.wood).toBeLessThan(base.wood);
  });
});

// ── M2: doble reclamo de recompensa diaria (TOCTOU) ───────────────────────────
describe('dailyTask (M2): claimTaskReward no paga dos veces bajo concurrencia', () => {
  const P = 880003;
  test('3 reclamos concurrentes de la misma tarea → solo UNO otorga', async () => {
    await freshPlayer(P, 5);
    const taskId = 'harvest_5';
    const resetAt = new Date(Date.now() + 86400000).toISOString();
    await db('player_daily_tasks').where('player_id', P).delete();
    await db('player_daily_tasks').insert({
      player_id: P, task_id: taskId, progress: 5, target: 5, completed: 1, reward_claimed: 0, reset_at: resetAt,
    });

    const results = await Promise.allSettled([
      dailyTaskService.claimTaskReward(P, taskId),
      dailyTaskService.claimTaskReward(P, taskId),
      dailyTaskService.claimTaskReward(P, taskId),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled' && r.value.success).length;
    expect(ok).toBe(1);
    const row = await db('player_daily_tasks').where({ player_id: P, task_id: taskId }).first();
    expect(row.reward_claimed).toBe(1);
  });
});

// ── M3: doble otorgamiento de tarea social (UNIQUE de migración 029) ──────────
describe('socialTask (M3): completeSocialTask no paga dos veces', () => {
  const P = 880004;
  test('completar dos veces la misma tarea social → la segunda falla', async () => {
    await freshPlayer(P, 5);
    await db('social_task_completions').where('player_id', P).delete();
    // join_channel: sin bot configurado, el service lo permite (no lanza).
    const first = await dailyTaskService.completeSocialTask(P, 'join_channel');
    expect(first.success).toBe(true);
    await expect(dailyTaskService.completeSocialTask(P, 'join_channel')).rejects.toThrow(/ya completada/i);
    const rows = await db('social_task_completions').where({ player_id: P, task_id: 'join_channel' });
    expect(rows.length).toBe(1);
  });
});

// ── M1/M7: mercado — sin oversell y sin oro de la nada ───────────────────────
describe('marketplace (M1/M7): sin oversell concurrente ni pago inflado', () => {
  const SELLER = 880005;
  const B1 = 880006;
  const B2 = 880007;

  async function seedListing(remaining, price) {
    await db('marketplace_listings').where('seller_id', SELLER).delete();
    const [{ id }] = await db('marketplace_listings').insert({
      seller_id: SELLER, resource_id: 'wood', quantity: remaining, quantity_remaining: remaining,
      price_per_unit: price, status: 'active',
      created_at: new Date().toISOString(), expires_at: new Date(Date.now() + 86400000).toISOString(),
    }).returning('id');
    return id;
  }

  test('dos compras concurrentes de un lote de 10 no sobre-venden', async () => {
    await freshPlayer(SELLER, 5); await freshPlayer(B1, 5); await freshPlayer(B2, 5);
    await setGold(B1, 100000); await setGold(B2, 100000);
    const listingId = await seedListing(10, 5);

    const results = await Promise.allSettled([
      marketplaceService.buyFromListing(B1, listingId, 10),
      marketplaceService.buyFromListing(B2, listingId, 10),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1); // solo una compra de 10 entra en 10 de stock

    const row = await db('marketplace_listings').where('id', listingId).first();
    expect(row.quantity_remaining).toBe(0);
    // El comprador ganador recibió 10; el total transferido nunca supera lo listado.
    const wB1 = (await db('player_resources').where({ player_id: B1, resource_id: 'wood' }).first())?.amount || 0;
    const wB2 = (await db('player_resources').where({ player_id: B2, resource_id: 'wood' }).first())?.amount || 0;
    expect(wB1 + wB2).toBe(10);
  });
});
