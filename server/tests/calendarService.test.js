const { LOGIN_CALENDAR } = require('../../shared/gameConfig');
const db = require('../src/config/database');
const { initTestDb, seedTestData } = require('./setup');
const calendarService = require('../src/services/calendarService');

beforeAll(async () => { await initTestDb(); await seedTestData(); });

async function freshPlayer(id) {
  await db('players').where('telegram_id', id).delete();
  await db('login_calendar').where('player_id', id).delete();
  await db('gem_promo_grants').where('player_id', id).delete();
  await db('player_gems').where('player_id', id).delete();
  await db('player_resources').where('player_id', id).delete();
  await db('players').insert({ telegram_id: id, username: 'k', first_name: 'K', display_name: 'K',
    level: 5, xp: 0, created_at: new Date().toISOString() });
}

describe('calendarService.getState', () => {
  test('jugador nuevo: día 1, no reclamado, siembra fila', async () => {
    await freshPlayer(910001);
    const state = await calendarService.getState(910001);
    expect(state.cycleDay).toBe(1);
    expect(state.claimedToday).toBe(false);
    expect(state.rewards).toEqual(LOGIN_CALENDAR);
  });

  test('claimedToday refleja el último claim', async () => {
    await freshPlayer(910002);
    await calendarService.getState(910002);
    expect((await calendarService.getState(910002)).claimedToday).toBe(false);
    await calendarService.claim(910002);
    expect((await calendarService.getState(910002)).claimedToday).toBe(true);
  });
});

describe('calendarService.claim', () => {
  test('día 1 otorga oro +200 y avanza el ciclo a día 2', async () => {
    await freshPlayer(910010);
    const before = await db('player_resources').where({ player_id: 910010, resource_id: 'gold' }).first();

    const res = await calendarService.claim(910010);

    expect(res.day).toBe(1);
    expect(res.reward).toEqual(LOGIN_CALENDAR[0]);
    expect(res.nextDay).toBe(2);

    const after = await db('player_resources').where({ player_id: 910010, resource_id: 'gold' }).first();
    expect(after.amount).toBe((before?.amount || 0) + 200);

    const row = await db('login_calendar').where('player_id', 910010).first();
    expect(row.cycle_day).toBe(2);
  });

  test('un segundo claim el mismo día UTC rechaza', async () => {
    await freshPlayer(910011);
    await calendarService.claim(910011);
    await expect(calendarService.claim(910011)).rejects.toThrow(/ya reclamaste/i);
  });

  test('día 7 otorga 20 gemas promo con fila en el ledger, y el ciclo envuelve a día 1', async () => {
    await freshPlayer(910012);
    // Forzar el jugador directo a cycle_day=7 sin recorrer los 6 días previos.
    await db('login_calendar').insert({ player_id: 910012, cycle_day: 7, last_claim_date: '' });

    const before = await db('player_gems').where('player_id', 910012).first();
    const beforeBalance = before?.balance || 0;

    const res = await calendarService.claim(910012);

    expect(res.day).toBe(7);
    expect(res.reward).toEqual(LOGIN_CALENDAR[6]);
    expect(res.nextDay).toBe(1);

    const gems = await db('player_gems').where('player_id', 910012).first();
    expect(gems.balance).toBe(beforeBalance + 20);

    const ledgerRow = await db('gem_promo_grants')
      .where({ player_id: 910012, reason: 'login_calendar_d7' }).first();
    expect(ledgerRow).toBeDefined();
    expect(ledgerRow.amount).toBe(20);

    const row = await db('login_calendar').where('player_id', 910012).first();
    expect(row.cycle_day).toBe(1);
  });

  test('día 3 otorga KH vía awardTokens', async () => {
    await freshPlayer(910013);
    await db('login_calendar').insert({ player_id: 910013, cycle_day: 3, last_claim_date: '' });

    const tokenService = require('../src/services/tokenService');
    const spy = jest.spyOn(tokenService, 'awardTokens');

    const res = await calendarService.claim(910013);
    expect(res.day).toBe(3);
    expect(spy).toHaveBeenCalledWith(910013, 3, 'wave_defense');
    spy.mockRestore();
  });
});
