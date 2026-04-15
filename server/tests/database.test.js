const { initTestDb, seedTestData, TEST_PLAYER_ID } = require('./setup');

let db;

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
});

// ============================================
// sanitizeIdentifier & sanitizeOperator
// ============================================
describe('SQL Injection Protection', () => {
  test('sanitizeIdentifier rejects SQL injection attempts', () => {
    expect(() => db("'; DROP TABLE players--")).toThrow();
    expect(() => db('players; DELETE')).toThrow();
    expect(() => db('table name')).toThrow();
    expect(() => db('123start')).toThrow();
    expect(() => db('col"injection')).toThrow();
  });

  test('sanitizeIdentifier accepts valid identifiers', () => {
    expect(() => db('players')).not.toThrow();
    expect(() => db('player_resources')).not.toThrow();
    expect(() => db('_private')).not.toThrow();
  });

  test('where() rejects invalid operators', () => {
    expect(() =>
      db('players').where('level', 'DROP', 1)
    ).toThrow(/no permitido/i);

    expect(() =>
      db('players').where('level', '; --', 1)
    ).toThrow();

    expect(() =>
      db('players').where('level', 'OR 1=1', 1)
    ).toThrow();
  });

  test('where() accepts valid operators', async () => {
    const result = await db('players').where('level', '>=', 1);
    expect(Array.isArray(result)).toBe(true);

    const result2 = await db('players').where('level', '<=', 100);
    expect(Array.isArray(result2)).toBe(true);

    const result3 = await db('players').where('level', '!=', 999);
    expect(Array.isArray(result3)).toBe(true);
  });
});

// ============================================
// CRUD Operations
// ============================================
describe('QueryBuilder CRUD', () => {
  test('insert and select', async () => {
    const players = await db('players').where('telegram_id', TEST_PLAYER_ID);
    expect(players).toHaveLength(1);
    expect(players[0].display_name).toBe('TestPlayer');
  });

  test('select with first()', async () => {
    const player = await db('players').where('telegram_id', TEST_PLAYER_ID).first();
    expect(player).toBeDefined();
    expect(player.telegram_id).toBe(TEST_PLAYER_ID);
  });

  test('first() returns undefined for no match', async () => {
    const player = await db('players').where('telegram_id', 0).first();
    expect(player).toBeUndefined();
  });

  test('update modifies data', async () => {
    await db('players').where('telegram_id', TEST_PLAYER_ID).update({ display_name: 'Updated' });
    const player = await db('players').where('telegram_id', TEST_PLAYER_ID).first();
    expect(player.display_name).toBe('Updated');

    // Restore
    await db('players').where('telegram_id', TEST_PLAYER_ID).update({ display_name: 'TestPlayer' });
  });

  test('delete removes rows', async () => {
    await db('player_inventory').insert({
      player_id: TEST_PLAYER_ID,
      item_id: 'test_item',
      item_type: 'test',
      quantity: 1,
    });

    let items = await db('player_inventory').where('player_id', TEST_PLAYER_ID);
    expect(items.length).toBeGreaterThanOrEqual(1);

    await db('player_inventory').where('item_id', 'test_item').delete();
    items = await db('player_inventory').where('item_id', 'test_item');
    expect(items).toHaveLength(0);
  });
});

// ============================================
// Advanced queries
// ============================================
describe('QueryBuilder Advanced', () => {
  test('whereIn filters correctly', async () => {
    const resources = await db('player_resources')
      .where('player_id', TEST_PLAYER_ID)
      .whereIn('resource_id', ['gold', 'wood']);
    expect(resources).toHaveLength(2);
    const ids = resources.map(r => r.resource_id);
    expect(ids).toContain('gold');
    expect(ids).toContain('wood');
  });

  test('whereIn with empty array returns nothing', async () => {
    const result = await db('player_resources').whereIn('resource_id', []);
    expect(result).toHaveLength(0);
  });

  test('orderBy sorts correctly', async () => {
    const resources = await db('player_resources')
      .where('player_id', TEST_PLAYER_ID)
      .orderBy('amount', 'desc');
    for (let i = 1; i < resources.length; i++) {
      expect(resources[i - 1].amount).toBeGreaterThanOrEqual(resources[i].amount);
    }
  });

  test('limit constrains results', async () => {
    const resources = await db('player_resources')
      .where('player_id', TEST_PLAYER_ID)
      .limit(2);
    expect(resources).toHaveLength(2);
  });

  test('count returns correct value', async () => {
    const result = await db('player_resources')
      .where('player_id', TEST_PLAYER_ID)
      .count('* as count');
    expect(result[0].count).toBe(6); // gold, wood, stone, iron, wheat, water
  });

  test('orWhere works', async () => {
    const results = await db('player_buildings')
      .where('player_id', TEST_PLAYER_ID)
      .where('building_id', 'throne_room')
      .orWhere('building_id', 'barn');
    const ids = results.map(r => r.building_id);
    expect(ids).toContain('throne_room');
    expect(ids).toContain('barn');
  });
});

// ============================================
// Increment / Decrement / DecrementIfEnough
// ============================================
describe('Atomic Operations', () => {
  test('increment increases value', async () => {
    const before = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();

    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
      .increment('amount', 50);

    const after = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();

    expect(after.amount).toBe(before.amount + 50);
  });

  test('decrement decreases value', async () => {
    const before = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();

    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
      .decrement('amount', 50);

    const after = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();

    expect(after.amount).toBe(before.amount - 50);
  });

  test('decrementIfEnough succeeds when sufficient', async () => {
    const before = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();

    const affected = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
      .decrementIfEnough('amount', 10);

    expect(affected).toBe(1);

    const after = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();
    expect(after.amount).toBe(before.amount - 10);
  });

  test('decrementIfEnough fails when insufficient (race condition guard)', async () => {
    const current = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();

    const affected = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
      .decrementIfEnough('amount', current.amount + 999);

    expect(affected).toBe(0);

    // Value unchanged
    const after = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();
    expect(after.amount).toBe(current.amount);
  });

  test('decrementIfEnough with exact amount succeeds', async () => {
    // Set to known value
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'iron' })
      .update({ amount: 10 });

    const affected = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'iron' })
      .decrementIfEnough('amount', 10);

    expect(affected).toBe(1);

    const after = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'iron' }).first();
    expect(after.amount).toBe(0);

    // Restore
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'iron' })
      .update({ amount: 20 });
  });
});
