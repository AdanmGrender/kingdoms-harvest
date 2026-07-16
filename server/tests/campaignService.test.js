const { CAMPAIGN } = require('../../shared/gameConfig');
const db = require('../src/config/database');
const { initTestDb, seedTestData } = require('./setup');
const campaignService = require('../src/services/campaignService');

beforeAll(async () => { await initTestDb(); await seedTestData(); });

async function freshPlayer(id) {
  await db('players').where('telegram_id', id).delete();
  await db('player_campaign_progress').where('player_id', id).delete();
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
});
