const { initTestDb, seedTestData } = require('./setup');
const { DAY_CYCLE } = require('../../shared/gameConfig');

// Unique player IDs for this suite — chosen to avoid collisions with other test files
const VILLAGER_FRESH  = 191919191;  // last_tick 1 min ago → skipped by throttle
const VILLAGER_DUE    = 292929292;  // last_tick null → simulated
const VILLAGER_OLD    = 313131313;  // last_tick 6 min ago → simulated (past threshold)
const WT_NORMAL       = 393939393;  // world_time 0.3 → no rollover
const WT_ROLL         = 494949494;  // world_time 0.95 → day rollover
const SIMULATE_DIRECT = 595959595;  // for direct villagerService.simulateTick() calls

const TIME_INCREMENT  = 60000 / DAY_CYCLE.dayDurationMs; // 0.1 (10 min day / 1 min tick)

let db;
let processTick;
let villagerService;

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  ({ processTick } = require('../src/game/gameTick'));
  villagerService = require('../src/services/villagerService');

  const now = new Date().toISOString();
  const ids = [VILLAGER_FRESH, VILLAGER_DUE, VILLAGER_OLD, WT_NORMAL, WT_ROLL, SIMULATE_DIRECT];
  for (const id of ids) {
    if (!(await db('players').where('telegram_id', id).first())) {
      await db('players').insert({
        telegram_id: id,
        username:     `gtplayer_${id}`,
        first_name:   'GT',
        display_name: `GTPlayer${id}`,
        level:        1,
        xp:           0,
        created_at:   now,
      });
    }
  }
});

afterAll(async () => {
  const ids = [VILLAGER_FRESH, VILLAGER_DUE, VILLAGER_OLD, WT_NORMAL, WT_ROLL, SIMULATE_DIRECT];
  for (const id of ids) {
    await db('villagers').where('player_id', id).delete();
    await db('players').where('telegram_id', id).delete();
  }
});

// ─── Villager throttle ────────────────────────────────────────────────────────

describe('gameTick — villager throttle (5-minute gate)', () => {
  beforeEach(async () => {
    const now           = new Date().toISOString();
    const oneMinuteAgo  = new Date(Date.now() -  1 * 60 * 1000).toISOString();
    const sixMinutesAgo = new Date(Date.now() -  6 * 60 * 1000).toISOString();

    // Helpers: wipe and re-insert a single idle villager with hunger=100
    const insertVillager = async (playerId) => {
      await db('villagers').where('player_id', playerId).delete();
      await db('villagers').insert({
        player_id:  playerId,
        name:       'TestVillager',
        role:       'farmer',
        state:      'idle',
        hunger:     100,
        happiness:  100,
        age:        25,
        born_at:    now,
        created_at: now,
      });
    };

    await insertVillager(VILLAGER_FRESH);
    await insertVillager(VILLAGER_DUE);
    await insertVillager(VILLAGER_OLD);

    await db('players').where('telegram_id', VILLAGER_FRESH).update({ villager_last_tick: oneMinuteAgo });
    await db('players').where('telegram_id', VILLAGER_DUE).update({ villager_last_tick: null });
    await db('players').where('telegram_id', VILLAGER_OLD).update({ villager_last_tick: sixMinutesAgo });
  });

  test('player with villager_last_tick 1 min ago is NOT simulated', async () => {
    await processTick();
    const v = await db('villagers').where('player_id', VILLAGER_FRESH).first();
    expect(v.hunger).toBe(100); // unchanged — tick was skipped
  });

  test('player with villager_last_tick = null IS simulated', async () => {
    await processTick();
    const v = await db('villagers').where('player_id', VILLAGER_DUE).first();
    expect(v.hunger).toBe(99); // hunger decremented by batch SQL
  });

  test('player with villager_last_tick 6 min ago IS simulated (past threshold)', async () => {
    await processTick();
    const v = await db('villagers').where('player_id', VILLAGER_OLD).first();
    expect(v.hunger).toBe(99);
  });

  test('villager_last_tick is updated to ~now after simulation', async () => {
    const before = new Date(Date.now() - 1000).toISOString();
    await processTick();
    const p = await db('players').where('telegram_id', VILLAGER_DUE).first();
    expect(p.villager_last_tick).toBeDefined();
    expect(p.villager_last_tick > before).toBe(true);
  });
});

// ─── World time batch update ──────────────────────────────────────────────────

describe('gameTick — world time batch SQL', () => {
  beforeEach(async () => {
    // Reset to known states before each test so processTick() results are predictable
    await db('players').where('telegram_id', WT_NORMAL).update({ world_time: 0.3,  world_day: 5  });
    await db('players').where('telegram_id', WT_ROLL).update({   world_time: 0.95, world_day: 10 });
  });

  test('world_time increments by TIME_INCREMENT when no rollover occurs', async () => {
    await processTick();
    const p = await db('players').where('telegram_id', WT_NORMAL).first();
    expect(p.world_time).toBeCloseTo(0.3 + TIME_INCREMENT, 5);
    expect(p.world_day).toBe(5); // unchanged
  });

  test('world_day increments and world_time wraps when rollover occurs', async () => {
    await processTick();
    const p = await db('players').where('telegram_id', WT_ROLL).first();
    // 0.95 + 0.1 = 1.05 → wraps to 0.05, world_day +1
    expect(p.world_time).toBeCloseTo(0.95 + TIME_INCREMENT - 1, 5);
    expect(p.world_day).toBe(11);
  });

  test('world_time stays in [0, 1) after rollover', async () => {
    await processTick();
    const p = await db('players').where('telegram_id', WT_ROLL).first();
    expect(p.world_time).toBeGreaterThanOrEqual(0);
    expect(p.world_time).toBeLessThan(1);
  });
});

// ─── villagerService.simulateTick — batch state machine ──────────────────────

describe('villagerService.simulateTick — batch state machine', () => {
  const now = new Date().toISOString();

  const mkVillager = (overrides) => ({
    player_id:  SIMULATE_DIRECT,
    name:       'Tester',
    role:       'farmer',
    state:      'idle',
    hunger:     60,
    happiness:  100,
    age:        25,
    born_at:    now,
    created_at: now,
    ...overrides,
  });

  beforeEach(async () => {
    await db('villagers').where('player_id', SIMULATE_DIRECT).delete();
  });

  test('hunger decrements by 1 each tick', async () => {
    await db('villagers').insert(mkVillager({ hunger: 50 }));
    await villagerService.simulateTick(SIMULATE_DIRECT);
    const v = await db('villagers').where('player_id', SIMULATE_DIRECT).first();
    expect(v.hunger).toBe(49);
  });

  test('hunger does not drop below 0', async () => {
    await db('villagers').insert(mkVillager({ hunger: 0 }));
    await villagerService.simulateTick(SIMULATE_DIRECT);
    const v = await db('villagers').where('player_id', SIMULATE_DIRECT).first();
    expect(v.hunger).toBe(0);
  });

  test('idle villager with building assignment transitions to walking_to_work', async () => {
    await db('villagers').insert(mkVillager({ state: 'idle', assigned_building_id: 9999 }));
    await villagerService.simulateTick(SIMULATE_DIRECT);
    const v = await db('villagers').where('player_id', SIMULATE_DIRECT).first();
    expect(v.state).toBe('walking_to_work');
  });

  test('walking_to_work transitions to working on next tick', async () => {
    await db('villagers').insert(mkVillager({ state: 'walking_to_work', assigned_building_id: 9999 }));
    await villagerService.simulateTick(SIMULATE_DIRECT);
    const v = await db('villagers').where('player_id', SIMULATE_DIRECT).first();
    expect(v.state).toBe('working');
  });

  test('villager with hunger reaching ≤20 transitions to resting and loses happiness', async () => {
    // hunger=21 → after tick: hunger-1=20 which triggers the resting condition
    await db('villagers').insert(mkVillager({ state: 'working', assigned_building_id: 9999, hunger: 21, happiness: 80 }));
    await villagerService.simulateTick(SIMULATE_DIRECT);
    const v = await db('villagers').where('player_id', SIMULATE_DIRECT).first();
    expect(v.state).toBe('resting');
    expect(v.hunger).toBe(20);
    expect(v.happiness).toBe(79);
  });
});
