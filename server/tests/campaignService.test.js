const { CAMPAIGN } = require('../../shared/gameConfig');
const db = require('../src/config/database');
const { initTestDb, seedTestData } = require('./setup');

beforeAll(async () => { await initTestDb(); await seedTestData(); });

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
