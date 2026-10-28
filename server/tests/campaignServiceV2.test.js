// T8 — Integración de campaignService con el motor v2 (y selector por state.engine).
const { CAMPAIGN, COMBAT } = require('../../shared/gameConfig');
const db = require('../src/config/database');
const { initTestDb, seedTestData } = require('./setup');
const campaignService = require('../src/services/campaignService');

beforeAll(async () => { await initTestDb(); await seedTestData(); });

async function freshPlayer(id) {
  await db('players').where('telegram_id', id).delete();
  await db('player_campaign_progress').where('player_id', id).delete();
  await db('campaign_sweeps').where('player_id', id).delete();
  await db('player_heroes').where('player_id', id).delete();
  await db('player_squads').where('player_id', id).delete();
  await db('players').insert({ telegram_id: id, username: 'c', first_name: 'C', display_name: 'C',
    level: 5, xp: 0, created_at: new Date().toISOString() });
}

// Deja a1n3 disponible. Con heroes=true siembra 5× Aria en la escuadra.
async function reachA1n3(id, heroes = false) {
  await freshPlayer(id);
  if (heroes) {
    for (let slot = 1; slot <= 5; slot++) {
      const [{ id: heroDbId }] = await db('player_heroes').insert({
        player_id: id, hero_id: 'aria', level: 1, xp: 0,
        equipment: '{"weapon":null,"armor":null,"accessory":null}',
        obtained_at: new Date().toISOString(),
      }).returning('id');
      await db('player_squads').insert({ player_id: id, slot, hero_db_id: heroDbId });
    }
  }
  await campaignService.getMap(id);
  await campaignService._clearNode(id, CAMPAIGN[0]);
  await campaignService.enterNode(id, 'a1n2');
}

async function withEngine(v, fn) {
  const prev = COMBAT.engineVersion;
  COMBAT.engineVersion = v;
  try { return await fn(); } finally { COMBAT.engineVersion = prev; }
}

async function runToEnd(P, runId, max = 30) {
  let last = null; let guard = 0;
  while (guard++ < max) {
    last = await campaignService.resolveStep(P, runId, { type: 'advance' });
    if (last.result) break;
  }
  return last;
}

describe('estado inicial según COMBAT.engineVersion', () => {
  test('R22: con engineVersion 1 el estado es literalmente el de v1', async () => {
    const P = 960001;
    await reachA1n3(P);
    expect(COMBAT.engineVersion).toBe(1);
    const run = await campaignService.enterNode(P, 'a1n3');
    expect(Object.keys(run.state).sort()).toEqual(['enemy', 'heroes', 'isBoss', 'log', 'maxRounds', 'round', 'shield']);
    expect(run.state.enemy).toEqual({ hp: 400, maxHp: 400, dps: run.state.enemy.dps });
    expect(run.state.heroes[0].def).toBeUndefined();
    expect(run.state.engine).toBeUndefined();
  });

  test('R21: con engineVersion 2 trae engine, seed, rng, events, enemies y el alias enemy', async () => {
    const P = 960002;
    await reachA1n3(P);
    const run = await withEngine(2, () => campaignService.enterNode(P, 'a1n3'));
    const s = run.state;
    expect(s.engine).toBe(2);
    expect(Number.isInteger(s.seed) && s.seed >= 0 && s.seed <= 4294967295).toBe(true);
    expect(s.events).toEqual([]);
    expect(s.eventsVersion).toBe(1);
    expect(s.enemies).toHaveLength(1);
    expect(s.enemies[0]).toMatchObject({ id: 'e0', hp: 400, maxHp: 400, def: 0, spd: 0 });
    expect(Object.keys(s.enemy).sort()).toEqual(['dps', 'hp', 'maxHp']);
    expect(s.enemy.dps).toBe(s.enemies[0].dps);
    expect(s.heroes[0]).toMatchObject({ name: 'Guarnición', def: 0, spd: 0 });
    const row = await db('campaign_runs').where({ id: run.runId }).first();
    expect(JSON.parse(row.state).engine).toBe(2);
  });

  test('héroes reales llevan def/spd de computeStats', async () => {
    const P = 960003;
    await reachA1n3(P, true);
    const heroService = require('../src/services/heroService');
    const squad = await heroService.getSquad(P);
    const run = await withEngine(2, () => campaignService.enterNode(P, 'a1n3'));
    expect(run.state.heroes).toHaveLength(5);
    run.state.heroes.forEach((h, i) => {
      expect(h.def).toBe(squad[i].stats.def ?? 0);
      expect(h.spd).toBe(squad[i].stats.spd ?? 0);
    });
  });

  test('R23: semillas distintas entre runs y rng === seed al empezar', async () => {
    const P = 960004;
    await reachA1n3(P);
    const seeds = new Set();
    for (let i = 0; i < 4; i++) {
      const run = await withEngine(2, () => campaignService.enterNode(P, 'a1n3'));
      expect(run.state.rng).toBe(run.state.seed);
      seeds.add(run.state.seed);
    }
    expect(seeds.size).toBeGreaterThan(1);
  });

  test('nodo con enemies[] sintético: se construye enemies y enemy es el primero', async () => {
    const P = 960005;
    await reachA1n3(P);
    const node = CAMPAIGN.find((n) => n.id === 'a1n3');
    node.enemies = [{ hp: 100, dps: 5, def: 3 }, { hp: 200, dps: 7, spd: 4 }];
    try {
      const run = await withEngine(2, () => campaignService.enterNode(P, 'a1n3'));
      expect(run.state.enemies.map((e) => [e.id, e.hp, e.def, e.spd])).toEqual([['e0', 100, 3, 0], ['e1', 200, 0, 4]]);
      expect(run.state.enemy).toEqual({ hp: 100, maxHp: 100, dps: 5 });
    } finally { delete node.enemies; }
  });
});

describe('selector de motor por state.engine', () => {
  test('R24: un run v1 sigue con v1 aunque el interruptor esté en 2 (y al revés)', async () => {
    const P = 960010;
    await reachA1n3(P, true);
    const runV1 = await withEngine(1, () => campaignService.enterNode(P, 'a1n3'));
    const r1 = await withEngine(2, () => campaignService.resolveStep(P, runV1.runId, { type: 'advance' }));
    expect(r1.state.events).toBeUndefined();
    expect(r1.state.engine).toBeUndefined();
    expect(Object.keys(r1.roundLog).sort()).toEqual(['enemyHp', 'heroes', 'result', 'round']);

    const runV2 = await withEngine(2, () => campaignService.enterNode(P, 'a1n3'));
    const r2 = await withEngine(1, () => campaignService.resolveStep(P, runV2.runId, { type: 'advance' }));
    expect(r2.state.engine).toBe(2);
    expect(r2.state.events.length).toBeGreaterThan(0);
    expect(r2.roundLog.eventRange).toEqual([0, r2.state.events.length]);
  });

  test('un run viejo sin state.engine corre en v1', async () => {
    const P = 960011;
    await reachA1n3(P, true);
    const run = await campaignService.enterNode(P, 'a1n3');
    const r = await campaignService.resolveStep(P, run.runId, { type: 'advance' });
    expect(r.state.events).toBeUndefined();
  });

  test('R25: state.engine desconocido lanza y no toca el run', async () => {
    const P = 960012;
    await reachA1n3(P);
    const run = await campaignService.enterNode(P, 'a1n3');
    const bad = { ...run.state, engine: 3 };
    await db('campaign_runs').where({ id: run.runId }).update({ state: JSON.stringify(bad) });
    await expect(campaignService.resolveStep(P, run.runId, { type: 'advance' })).rejects.toThrow(/Motor de combate desconocido/);
    const row = await db('campaign_runs').where({ id: run.runId }).first();
    expect(row.status).toBe('active');
    expect(JSON.parse(row.state)).toEqual(bad);
  });
});

describe('contrato de resolveStep con ambos motores (R-ND4)', () => {
  test.each([1, 2])('engine %i: { state, roundLog, result, unlocked } y roundLog === último log', async (v) => {
    const P = 960020 + v;
    await reachA1n3(P, true);
    const run = await withEngine(v, () => campaignService.enterNode(P, 'a1n3'));
    const r = await campaignService.resolveStep(P, run.runId, { type: 'advance' });
    expect(Object.keys(r).sort()).toEqual(['result', 'roundLog', 'state', 'unlocked']);
    expect(r.roundLog).toBe(r.state.log[r.state.log.length - 1]);
    expect(r.unlocked).toEqual([]);
    expect(r.state.enemy.hp).toBeLessThan(400); // R-ND4b: el cliente sigue leyendo state.enemy
    expect(r.state.enemy.maxHp).toBe(400);
    expect(Array.isArray(r.state.heroes)).toBe(true);
  });

  test('v2 termina el nodo con victoria: desbloquea a1n4 y persiste state con events', async () => {
    const P = 960030;
    await reachA1n3(P, true);
    const run = await withEngine(2, () => campaignService.enterNode(P, 'a1n3'));
    const last = await runToEnd(P, run.runId);
    expect(last.result).toBe('victory');
    expect(last.unlocked).toContain('a1n4');
    const row = await db('campaign_runs').where({ id: run.runId }).first();
    expect(row.status).toBe('victory');
    const saved = JSON.parse(row.state);
    expect(saved.events[saved.events.length - 1]).toMatchObject({ kind: 'end', value: 'victory' });
    expect(saved.seed).toBe(run.state.seed);
    expect(saved.rng).toBe(run.state.seed); // F13 no consume azar
  });
});

describe('R28: embudo de balance con v2', () => {
  test('guarnición sin héroes gana a1n3 y pierde a1n4 con COMBAT.engineVersion = 2', async () => {
    const P = 960040;
    await reachA1n3(P);
    await withEngine(2, async () => {
      const run3 = await campaignService.enterNode(P, 'a1n3');
      expect(run3.state.engine).toBe(2);
      expect(run3.state.heroes[0].name).toBe('Guarnición');
      const r3 = await runToEnd(P, run3.runId);
      expect(r3.result).toBe('victory');

      const run4 = await campaignService.enterNode(P, 'a1n4');
      expect(run4.state.engine).toBe(2);
      const r4 = await runToEnd(P, run4.runId);
      expect(r4.result).toBe('defeat');
    });
    expect(COMBAT.engineVersion).toBe(1);
  });
});
