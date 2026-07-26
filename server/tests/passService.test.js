/**
 * passService — F4 Pase de temporada (battle pass). DB in-memory.
 *
 * Cubre: puntos acumulables desde las 3 fuentes, claim free/premium
 * idempotentes (UNIQUE pass_claims), gate de premium (premium=1 exigido) y
 * el desbloqueo de premium (decrementIfEnough 1440 gemas, idempotente — un
 * segundo intento NO re-descuenta).
 */
const { SEASON_PASS } = require('../../shared/gameConfig');
const db = require('../src/config/database');
const { initTestDb, seedTestData } = require('./setup');

let passService;

beforeAll(async () => {
  await initTestDb();
  await seedTestData();
  passService = require('../src/services/passService');
});

async function freshPlayer(id, { gems = 0 } = {}) {
  await db('players').where('telegram_id', id).delete();
  await db('player_pass').where('player_id', id).delete();
  await db('pass_claims').where('player_id', id).delete();
  await db('player_gems').where('player_id', id).delete();
  await db('gem_promo_grants').where('player_id', id).delete();
  await db('player_resources').where('player_id', id).delete();
  await db('player_tokens').where('player_id', id).delete();

  await db('players').insert({
    telegram_id: id, username: 'p', first_name: 'P', display_name: 'P',
    level: 5, xp: 0, created_at: new Date().toISOString(),
  });
  await db('player_gems').insert({
    player_id: id, balance: gems, total_purchased: gems, total_spent: 0,
    updated_at: new Date().toISOString(),
  });
}

// Sube al jugador exactamente `n` puntos de node_clear (+10 c/u).
async function addNodeClears(id, n) {
  for (let i = 0; i < n; i++) await passService.addPoints(id, 'node_clear');
}

describe('passService.getState', () => {
  test('jugador nuevo: 0 puntos, tier 0, sin premium, siembra season+fila', async () => {
    await freshPlayer(940000);
    const state = await passService.getState(940000);
    expect(state.points).toBe(0);
    expect(state.tier).toBe(0);
    expect(state.premium).toBe(false);
    expect(state.claims).toEqual([]);
    expect(state.rewards).toEqual(SEASON_PASS.rewards);
    expect(state.seasonKey).toMatch(/^s\d+$/);
    expect(new Date(state.endsAt).getTime()).toBeGreaterThan(Date.now());
  });
});

describe('passService.addPoints', () => {
  test('las 3 acciones suman al catálogo y el tier sube con los puntos', async () => {
    await freshPlayer(940001);

    await passService.addPoints(940001, 'node_clear'); // +10
    await passService.addPoints(940001, 'daily_task'); // +5
    await passService.addPoints(940001, 'wave_win');   // +5
    let state = await passService.getState(940001);
    expect(state.points).toBe(20);
    expect(state.tier).toBe(0);

    await addNodeClears(940001, 3); // +30 => 50 total => tier 1
    state = await passService.getState(940001);
    expect(state.points).toBe(50);
    expect(state.tier).toBe(1);
  });

  test('acción fuera del catálogo no suma nada (no-op silencioso, hook no crítico)', async () => {
    await freshPlayer(940002);
    await passService.addPoints(940002, 'not_a_real_action');
    const state = await passService.getState(940002);
    expect(state.points).toBe(0);
  });
});

describe('passService.claimTier — free', () => {
  test('claim de tier alcanzado otorga la recompensa; re-claim del mismo tier/track rechaza', async () => {
    await freshPlayer(940010);
    await addNodeClears(940010, 5); // 50 pts => tier 1
    const before = await db('player_resources').where({ player_id: 940010, resource_id: 'gold' }).first();

    const res = await passService.claimTier(940010, 1, 'free');
    expect(res).toEqual({ tier: 1, track: 'free', reward: SEASON_PASS.rewards[0].free });

    const after = await db('player_resources').where({ player_id: 940010, resource_id: 'gold' }).first();
    expect(after.amount).toBe((before?.amount || 0) + SEASON_PASS.rewards[0].free.gold);

    await expect(passService.claimTier(940010, 1, 'free')).rejects.toThrow(/ya reclamaste/i);
  });

  test('tier no alcanzado rechaza (0 puntos, tier 1)', async () => {
    await freshPlayer(940011);
    await expect(passService.claimTier(940011, 1, 'free')).rejects.toThrow(/no alcanzaste/i);
  });

  test('tier con recompensa KH usa awardTokens (cap diario aplica)', async () => {
    await freshPlayer(940012);
    await addNodeClears(940012, 15); // 150 pts => tier 3, rewards[2].free = { kh: 1 }

    const tokenService = require('../src/services/tokenService');
    const spy = jest.spyOn(tokenService, 'awardTokens');

    const res = await passService.claimTier(940012, 3, 'free');
    expect(res.reward).toEqual({ kh: 1 });
    expect(spy).toHaveBeenCalledWith(940012, 1, 'wave_defense');
    spy.mockRestore();
  });
});

describe('passService.claimTier — premium', () => {
  test('sin premium desbloqueado, claim premium rechaza', async () => {
    await freshPlayer(940020);
    await addNodeClears(940020, 5); // tier 1
    await expect(passService.claimTier(940020, 1, 'premium')).rejects.toThrow(/premium/i);
  });

  test('track inválido rechaza', async () => {
    await freshPlayer(940021);
    await addNodeClears(940021, 5);
    await expect(passService.claimTier(940021, 1, 'other')).rejects.toThrow(/track/i);
  });
});

describe('passService.unlockPremium', () => {
  test('descuenta 1440 gemas y activa premium; segundo intento NO re-descuenta', async () => {
    await freshPlayer(940030, { gems: 2000 });

    const res = await passService.unlockPremium(940030);
    expect(res.premium).toBe(true);

    const gemsAfterFirst = await db('player_gems').where('player_id', 940030).first();
    expect(gemsAfterFirst.balance).toBe(2000 - SEASON_PASS.premiumCostGems);

    await expect(passService.unlockPremium(940030)).rejects.toThrow(/ya tenés/i);

    const gemsAfterSecond = await db('player_gems').where('player_id', 940030).first();
    expect(gemsAfterSecond.balance).toBe(gemsAfterFirst.balance); // sin re-descuento

    const row = await db('player_pass').where('player_id', 940030).first();
    expect(row.premium).toBe(1);
  });

  test('sin gemas suficientes rechaza y no activa premium ni descuenta', async () => {
    await freshPlayer(940031, { gems: 100 });
    await expect(passService.unlockPremium(940031)).rejects.toThrow();

    const row = await db('player_pass').where('player_id', 940031).first();
    expect(row?.premium || 0).toBe(0);
    const gems = await db('player_gems').where('player_id', 940031).first();
    expect(gems.balance).toBe(100);
  });

  // Regresión del bug de doble-cobro (review T4): dos unlockPremium concurrentes
  // (p.ej. doble-tap) NO deben descontar 1440 dos veces. Con el gate-primero,
  // sólo el que flipa premium 0→1 cobra; el otro rechaza sin tocar gemas.
  test('dos unlocks concurrentes descuentan 1440 UNA sola vez', async () => {
    await freshPlayer(940040, { gems: 5000 });
    const results = await Promise.allSettled([
      passService.unlockPremium(940040),
      passService.unlockPremium(940040),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1); // exactamente un desbloqueo

    const gems = await db('player_gems').where('player_id', 940040).first();
    expect(gems.balance).toBe(5000 - SEASON_PASS.premiumCostGems); // 3560, NO 2120
    const row = await db('player_pass').where('player_id', 940040).first();
    expect(row.premium).toBe(1);
  });
});

describe('passService.claimTier — premium tras unlock', () => {
  test('otorga las gemas del tier CON fila en el ledger gem_promo_grants', async () => {
    await freshPlayer(940050, { gems: 2000 });
    await passService.unlockPremium(940050);
    await addNodeClears(940050, 5); // tier 1

    const before = await db('player_gems').where('player_id', 940050).first();
    const res = await passService.claimTier(940050, 1, 'premium');
    expect(res.reward).toEqual(SEASON_PASS.rewards[0].premium);

    const after = await db('player_gems').where('player_id', 940050).first();
    expect(after.balance).toBe(before.balance + SEASON_PASS.rewards[0].premium.gems);

    const ledgerRow = await db('gem_promo_grants')
      .where({ player_id: 940050, reason: 'season_pass_tier' }).first();
    expect(ledgerRow).toBeDefined();
    expect(ledgerRow.amount).toBe(SEASON_PASS.rewards[0].premium.gems);

    // Re-claim del mismo tier/track rechaza (UNIQUE), sin re-otorgar gemas.
    await expect(passService.claimTier(940050, 1, 'premium')).rejects.toThrow(/ya reclamaste/i);
    const afterRetry = await db('player_gems').where('player_id', 940050).first();
    expect(afterRetry.balance).toBe(after.balance);
  });
});
