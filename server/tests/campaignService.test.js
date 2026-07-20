const { CAMPAIGN } = require('../../shared/gameConfig');
const db = require('../src/config/database');
const { initTestDb, seedTestData } = require('./setup');
const campaignService = require('../src/services/campaignService');

beforeAll(async () => { await initTestDb(); await seedTestData(); });

async function freshPlayer(id) {
  await db('players').where('telegram_id', id).delete();
  await db('player_campaign_progress').where('player_id', id).delete();
  await db('campaign_sweeps').where('player_id', id).delete();
  await db('players').insert({ telegram_id: id, username: 'c', first_name: 'C', display_name: 'C',
    level: 5, xp: 0, created_at: new Date().toISOString() });
}

describe('CAMPAIGN config', () => {
  test('ids únicos y unlocks referencian nodos válidos', () => {
    const ids = CAMPAIGN.map((n) => n.id);
    expect(new Set(ids).size).toBe(ids.length);
    const idSet = new Set(ids);
    for (const n of CAMPAIGN) {
      for (const u of n.unlocks) expect(idSet.has(u)).toBe(true);
    }
  });
  test('el primer nodo no requiere nada y hay al menos un boss', () => {
    expect(CAMPAIGN[0].requires).toEqual([]);
    expect(CAMPAIGN.some((n) => n.type === 'boss')).toBe(true);
  });
  test('todo nodo de combate tiene enemy + maxRounds', () => {
    for (const n of CAMPAIGN.filter((x) => ['combat', 'wave', 'boss'].includes(x.type))) {
      expect(n.enemy.hp).toBeGreaterThan(0);
      expect(n.enemy.dps).toBeGreaterThan(0);
      expect(n.maxRounds).toBeGreaterThan(0);
    }
  });
});

describe('migración 030', () => {
  test('las tablas de campaña existen y aceptan inserts', async () => {
    await db('player_campaign_progress').insert({ player_id: 999, node_id: 'a1n1', status: 'available' });
    const row = await db('player_campaign_progress').where({ player_id: 999, node_id: 'a1n1' }).first();
    expect(row.status).toBe('available');

    const [{ id }] = await db('campaign_runs').insert({
      player_id: 999, node_id: 'a1n3', status: 'active', state: '{}', created_at: new Date().toISOString(),
    }).returning('id');
    expect(id).toBeGreaterThan(0);
  });
});

describe('campaignService mapa y gating', () => {
  test('jugador nuevo: nodo 1 available, resto locked', async () => {
    await freshPlayer(770001);
    const map = await campaignService.getMap(770001);
    expect(map[0].status).toBe('available');
    expect(map[1].status).toBe('locked');
  });

  test('_clearNode marca cleared y desbloquea el siguiente (idempotente)', async () => {
    await freshPlayer(770002);
    await campaignService.getMap(770002); // siembra
    const node = require('../../shared/gameConfig').CAMPAIGN[0];
    const r1 = await campaignService._clearNode(770002, node);
    expect(r1.alreadyCleared).toBe(false);
    expect(r1.unlocked).toContain('a1n2');
    const r2 = await campaignService._clearNode(770002, node); // segundo intento
    expect(r2.alreadyCleared).toBe(true); // no re-otorga
    const map = await campaignService.getMap(770002);
    expect(map[0].status).toBe('cleared');
    expect(map[1].status).toBe('available');
  });

  test('_clearNode revierte el claim si el award falla (rollback recuperable)', async () => {
    await freshPlayer(770003);
    await campaignService.getMap(770003); // siembra
    const node = require('../../shared/gameConfig').CAMPAIGN[0];

    const tokenService = require('../src/services/tokenService');
    const spy = jest.spyOn(tokenService, 'awardTokens').mockRejectedValueOnce(new Error('boom'));

    await expect(campaignService._clearNode(770003, node)).rejects.toThrow('boom');
    spy.mockRestore();

    const row = await db('player_campaign_progress')
      .where({ player_id: 770003, node_id: node.id }).first();
    expect(row.status).toBe('available');

    const nextRow = await db('player_campaign_progress')
      .where({ player_id: 770003, node_id: 'a1n2' }).first();
    expect(nextRow).toBeUndefined();

    // El nodo sigue disponible para un retry exitoso.
    const retry = await campaignService._clearNode(770003, node);
    expect(retry.alreadyCleared).toBe(false);
    expect(retry.unlocked).toContain('a1n2');
  });
});

describe('campaignService enterNode', () => {
  test('nodo bloqueado lanza', async () => {
    await freshPlayer(770010);
    await campaignService.getMap(770010);
    await expect(campaignService.enterNode(770010, 'a1n9')).rejects.toThrow(/bloqueado/i);
  });

  test('collect se limpia al entrar y desbloquea el siguiente', async () => {
    await freshPlayer(770011);
    await campaignService.getMap(770011);
    // limpiar n1 (manage) directo para llegar a n2 (collect)
    await campaignService._clearNode(770011, require('../../shared/gameConfig').CAMPAIGN[0]);
    const res = await campaignService.enterNode(770011, 'a1n2');
    expect(res.kind).toBe('cleared');
    const map = await campaignService.getMap(770011);
    expect(map.find((n) => n.id === 'a1n3').status).toBe('available');
  });

  test('manage sin condición cumplida devuelve blocked', async () => {
    await freshPlayer(770012);
    await campaignService.getMap(770012); // n1 available, sin edificios
    const res = await campaignService.enterNode(770012, 'a1n1');
    expect(res.kind).toBe('blocked');
    expect(res.panel).toBe('building');
  });

  test('_checkManage falla cerrado ante un tipo de condición desconocido', async () => {
    const fakeNode = { id: 'x', type: 'manage', manage: { type: 'unknown_cond' } };
    await expect(campaignService._checkManage(770012, fakeNode)).resolves.toBe(false);
  });

  test('combat crea un run con snapshot de escuadra (o guarnición default)', async () => {
    await freshPlayer(770013);
    await campaignService.getMap(770013);
    await campaignService._clearNode(770013, require('../../shared/gameConfig').CAMPAIGN[0]); // n1
    await campaignService.enterNode(770013, 'a1n2'); // collect -> desbloquea n3
    const res = await campaignService.enterNode(770013, 'a1n3');
    expect(res.kind).toBe('combat');
    expect(res.runId).toBeGreaterThan(0);
    expect(res.state.heroes.length).toBeGreaterThanOrEqual(1);
    expect(res.state.enemy.hp).toBe(400);
  });

  test('entrar dos veces al mismo nodo de combate abandona el run anterior (sin huérfanos activos)', async () => {
    await freshPlayer(770014);
    await campaignService.getMap(770014);
    await campaignService._clearNode(770014, require('../../shared/gameConfig').CAMPAIGN[0]); // n1
    await campaignService.enterNode(770014, 'a1n2'); // collect -> desbloquea n3
    const first = await campaignService.enterNode(770014, 'a1n3');
    const second = await campaignService.enterNode(770014, 'a1n3');

    const runs = await db('campaign_runs')
      .where({ player_id: 770014, node_id: 'a1n3' });
    const active = runs.filter((r) => r.status === 'active');
    expect(active.length).toBe(1);
    expect(active[0].id).toBe(second.runId);

    const firstRow = runs.find((r) => r.id === first.runId);
    expect(firstRow.status).toBe('abandoned');
  });
});

describe('campaignService resolveStep', () => {
  // La guarnición default (1 unidad, atk 30/hp 200 — fallback de
  // _buildCombatState para squads vacías) NO alcanza para limpiar a1n3
  // (enemy hp 400, maxRounds 8) ni con timing óptimo de skill: verificado
  // por simulación directa, el mejor caso deja al enemigo en 28hp cuando se
  // agotan las rondas (defeat forzado). Un jugador real llega a su primer
  // combate con héroes ya reclutados, así que la escuadra de prueba se
  // siembra directo en player_heroes/player_squads (5× Aria, común, atk
  // 14/hp 90 reales de HEROES.aria) — con eso a1n3 cae en 6 rondas usando
  // sólo 'advance', sin tocar CAMPAIGN ni campaignSim.
  async function reachCombat(id) {
    await freshPlayer(id);
    await db('player_heroes').where('player_id', id).delete();
    await db('player_squads').where('player_id', id).delete();
    for (let slot = 1; slot <= 5; slot++) {
      const [{ id: heroDbId }] = await db('player_heroes').insert({
        player_id: id, hero_id: 'aria', level: 1, xp: 0,
        equipment: '{"weapon":null,"armor":null,"accessory":null}',
        obtained_at: new Date().toISOString(),
      }).returning('id');
      await db('player_squads').insert({ player_id: id, slot, hero_db_id: heroDbId });
    }
    await campaignService.getMap(id);
    await campaignService._clearNode(id, require('../../shared/gameConfig').CAMPAIGN[0]);
    await campaignService.enterNode(id, 'a1n2');
    return campaignService.enterNode(id, 'a1n3'); // combat run
  }

  test('avanzar rondas hasta victoria otorga y desbloquea UNA vez', async () => {
    const run = await reachCombat(770020);
    let result = null, guard = 0;
    while (!result && guard++ < 100) {
      const r = await campaignService.resolveStep(770020, run.runId, { type: 'advance' });
      result = r.result;
    }
    expect(result).toBe('victory');
    const map = await campaignService.getMap(770020);
    expect(map.find((n) => n.id === 'a1n3').status).toBe('cleared');
    expect(map.find((n) => n.id === 'a1n4').status).toBe('available');
    // otro step sobre el run terminado falla (no re-otorga)
    await expect(campaignService.resolveStep(770020, run.runId, { type: 'advance' }))
      .rejects.toThrow(/terminó/i);
  });

  test('skill sin energía se rechaza como error de negocio', async () => {
    const run = await reachCombat(770021);
    await expect(campaignService.resolveStep(770021, run.runId, { type: 'skill', slot: 1 }))
      .rejects.toThrow(/energía/i);
  });

  test('run ajeno no se puede tocar', async () => {
    const run = await reachCombat(770022);
    await freshPlayer(770023);
    await expect(campaignService.resolveStep(770023, run.runId, { type: 'advance' }))
      .rejects.toThrow(/inexistente/i);
  });

  test('si el award falla en el paso terminal, claim de run + _clearNode se revierten juntos (retry recuperable)', async () => {
    const run = await reachCombat(770024);

    const tokenService = require('../src/services/tokenService');
    const spy = jest.spyOn(tokenService, 'awardTokens').mockRejectedValueOnce(new Error('boom'));

    let threw = false, guard = 0;
    while (!threw && guard++ < 100) {
      try {
        await campaignService.resolveStep(770024, run.runId, { type: 'advance' });
      } catch (e) {
        threw = true;
        expect(e.message).toMatch(/boom/);
      }
    }
    spy.mockRestore();
    expect(threw).toBe(true); // el paso terminal (award falló) rechazó

    // Todo se revirtió: el run sigue 'active' y el nodo sigue 'available'.
    const runRow = await db('campaign_runs').where({ id: run.runId }).first();
    expect(runRow.status).toBe('active');
    const nodeRow = await db('player_campaign_progress')
      .where({ player_id: 770024, node_id: 'a1n3' }).first();
    expect(nodeRow.status).toBe('available');

    // Retry: el estado persistido ya tenía la ronda terminal calculada, así
    // que el siguiente 'advance' recomputa y esta vez el claim+award prospera.
    let result = null;
    guard = 0;
    while (!result && guard++ < 100) {
      const r = await campaignService.resolveStep(770024, run.runId, { type: 'advance' });
      result = r.result;
    }
    expect(result).toBe('victory');
    const map = await campaignService.getMap(770024);
    expect(map.find((n) => n.id === 'a1n3').status).toBe('cleared');
    expect(map.find((n) => n.id === 'a1n4').status).toBe('available');
  });
});

// ── Balance (pase 2026-07-18): el embudo del jugador nuevo ───────────────────
// Garantiza que un jugador SIN héroes (guarnición default) limpia el primer
// combate (a1n3) en idle puro, y que a1n4 sigue siendo muro → los héroes son
// la puerta de progresión desde el nodo 4. Si un cambio de números rompe esto,
// este test lo grita antes de que un jugador real quede bloqueado.
describe('balance: guarnición sin héroes', () => {
  const P = 880010;

  async function reachNode(nodeId) {
    // Sin seed de player_heroes/player_squads: _buildCombatState cae a la guarnición.
    return campaignService.enterNode(P, nodeId);
  }

  test('gana a1n3 (primer combate) con advance puro y a1n4 lo frena', async () => {
    await freshPlayer(P);
    await campaignService.getMap(P);
    await campaignService._clearNode(P, require('../../shared/gameConfig').CAMPAIGN[0]);
    await campaignService.enterNode(P, 'a1n2'); // collect → desbloquea a1n3

    // a1n3: victoria en idle puro (sin taps de skill)
    const run3 = await reachNode('a1n3');
    expect(run3.kind).toBe('combat');
    expect(run3.state.heroes[0].name).toBe('Guarnición');
    let result = null, guard = 0;
    while (!result && guard++ < 30) {
      const r = await campaignService.resolveStep(P, run3.runId, { type: 'advance' });
      result = r.result;
    }
    expect(result).toBe('victory');

    // a1n4: la misma guarnición pierde → muro de héroes intacto
    const run4 = await reachNode('a1n4');
    expect(run4.kind).toBe('combat');
    result = null; guard = 0;
    while (!result && guard++ < 30) {
      const r = await campaignService.resolveStep(P, run4.runId, { type: 'advance' });
      result = r.result;
    }
    expect(result).toBe('defeat');
  });
});

// ── F1: Sweep de nodos ("Asalto rápido") ─────────────────────────────────────
// Re-farmear nodos combat/wave/boss YA limpiados: 5 sweeps/día (reset UTC),
// 60% de los recursos del nodo (floor, mínimo 1) + 1 KH, claim atómico
// (campaign_sweeps, fila UNIQUE por player).
describe('campaignService.sweepNode', () => {
  const NODE1 = CAMPAIGN[0]; // a1n1 manage
  const NODE2 = CAMPAIGN[1]; // a1n2 collect
  const NODE3 = CAMPAIGN[2]; // a1n3 combat — rewards { kh: 3, resources: { gold: 150 } }

  // Siembra a1n1/a1n2 disponibles y limpia hasta dejar a1n3 'cleared' sin
  // correr la simulación de combate (el sweep sólo necesita el estado final).
  async function seedCleared(id) {
    await freshPlayer(id);
    await campaignService.getMap(id); // siembra a1n1 available
    await campaignService._clearNode(id, NODE1); // desbloquea a1n2
    await campaignService._clearNode(id, NODE2); // desbloquea a1n3
    await campaignService._clearNode(id, NODE3); // a1n3 cleared
  }

  test('sweep sobre nodo cleared paga 60% de recursos (floor) y decrementa cupo', async () => {
    const P = 890001;
    await seedCleared(P);
    const before = await db('player_resources').where({ player_id: P, resource_id: 'gold' }).first();

    const res = await campaignService.sweepNode(P, 'a1n3');

    expect(res.rewards.gold).toBe(Math.max(1, Math.floor(150 * 0.6))); // 90
    expect(res.sweepsLeft).toBe(4);

    const after = await db('player_resources').where({ player_id: P, resource_id: 'gold' }).first();
    expect(after.amount).toBe((before?.amount || 0) + 90);
  });

  test('rechaza nodo no-cleared, y rechaza nodos manage/collect aunque estén cleared', async () => {
    const P = 890002;
    await freshPlayer(P);
    await campaignService.getMap(P); // a1n1 available (manage, sin limpiar)
    await expect(campaignService.sweepNode(P, 'a1n1')).rejects.toThrow();

    await campaignService._clearNode(P, NODE1); // a1n1 cleared, pero type=manage
    await expect(campaignService.sweepNode(P, 'a1n1')).rejects.toThrow();

    await campaignService._clearNode(P, NODE2); // a1n2 cleared, pero type=collect
    await expect(campaignService.sweepNode(P, 'a1n2')).rejects.toThrow();

    // a1n3 ya disponible pero todavía NO cleared
    await expect(campaignService.sweepNode(P, 'a1n3')).rejects.toThrow();
  });

  test('5 sweeps ok y el 6º rechaza (cupo diario)', async () => {
    const P = 890003;
    await seedCleared(P);
    for (let i = 0; i < 5; i++) {
      const r = await campaignService.sweepNode(P, 'a1n3');
      expect(r.sweepsLeft).toBe(4 - i);
    }
    await expect(campaignService.sweepNode(P, 'a1n3')).rejects.toThrow(/asaltos/i);
    expect(await campaignService.sweepsLeft(P)).toBe(0);
  });

  test('carrera: 3 sweeps concurrentes con 1 cupo restante → sólo 1 gana', async () => {
    const P = 890004;
    await seedCleared(P);
    for (let i = 0; i < 4; i++) await campaignService.sweepNode(P, 'a1n3'); // consume 4, deja 1
    expect(await campaignService.sweepsLeft(P)).toBe(1);

    const results = await Promise.allSettled([
      campaignService.sweepNode(P, 'a1n3'),
      campaignService.sweepNode(P, 'a1n3'),
      campaignService.sweepNode(P, 'a1n3'),
    ]);
    const ok = results.filter((r) => r.status === 'fulfilled').length;
    expect(ok).toBe(1);
    expect(await campaignService.sweepsLeft(P)).toBe(0);
  });
});
