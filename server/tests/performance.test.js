const { initTestDb, seedTestData, TEST_PLAYER_ID } = require('./setup');

let db;

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
});

describe('Performance Tests', () => {
  test('create 100 players under 2 seconds', async () => {
    const start = Date.now();
    const baseId = Date.now(); // Use timestamp to avoid collision across test suites

    for (let i = 1; i <= 100; i++) {
      const playerId = baseId + i;
      await db('players').insert({
        telegram_id: playerId,
        username: `perf_player_${i}`,
        first_name: `Perf${i}`,
        display_name: `PerfPlayer${i}`,
        level: 1,
        xp: 0,
      });

      // Give each player starter resources
      for (const [resourceId, amount] of Object.entries({ gold: 200, wood: 100 })) {
        await db('player_resources').insert({
          player_id: playerId,
          resource_id: resourceId,
          amount,
          capacity: 1000,
        });
      }
    }

    const elapsed = Date.now() - start;
    console.log(`  100 players created in ${elapsed}ms`);
    expect(elapsed).toBeLessThan(2000);

    // Verify at least 100 were created
    const count = await db('players').count('* as count');
    expect(count[0].count).toBeGreaterThanOrEqual(100);
  }, 10000);

  test('1000 resource modifications with correctness check', async () => {
    // Reset gold to known value
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
      .update({ amount: 5000 });

    const start = Date.now();
    let expected = 5000;

    // 500 additions of 10
    for (let i = 0; i < 500; i++) {
      await db('player_resources')
        .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
        .increment('amount', 10);
      expected += 10;
    }

    // 500 subtractions of 5
    for (let i = 0; i < 500; i++) {
      await db('player_resources')
        .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
        .decrement('amount', 5);
      expected -= 5;
    }

    const elapsed = Date.now() - start;
    console.log(`  1000 resource modifications in ${elapsed}ms`);

    const gold = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();

    expect(gold.amount).toBe(expected); // 5000 + 5000 - 2500 = 7500
    expect(elapsed).toBeLessThan(5000);
  }, 15000);

  test('100 concurrent-style decrementIfEnough calls (race condition stress)', async () => {
    // Set up a known amount
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wood' })
      .update({ amount: 100 });

    const start = Date.now();
    let successCount = 0;

    // Try to decrement 5 wood 100 times (only 20 should succeed: 100/5 = 20)
    for (let i = 0; i < 100; i++) {
      const affected = await db('player_resources')
        .where({ player_id: TEST_PLAYER_ID, resource_id: 'wood' })
        .decrementIfEnough('amount', 5);
      if (affected > 0) successCount++;
    }

    const elapsed = Date.now() - start;
    console.log(`  100 decrementIfEnough in ${elapsed}ms, ${successCount} succeeded`);

    const wood = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wood' }).first();

    // Amount should be exactly 100 - (successCount * 5)
    expect(wood.amount).toBe(100 - successCount * 5);
    expect(wood.amount).toBeGreaterThanOrEqual(0);
    expect(successCount).toBe(20); // Exactly 20 should succeed
  }, 10000);

  test('500 QueryBuilder select operations throughput', async () => {
    const start = Date.now();

    for (let i = 0; i < 500; i++) {
      await db('player_resources')
        .where('player_id', TEST_PLAYER_ID)
        .where('resource_id', 'gold')
        .first();
    }

    const elapsed = Date.now() - start;
    const opsPerSec = Math.floor(500 / (elapsed / 1000));
    console.log(`  500 selects in ${elapsed}ms (${opsPerSec} ops/sec)`);

    expect(elapsed).toBeLessThan(3000);
  }, 10000);

  test('complex query chain performance', async () => {
    const start = Date.now();

    for (let i = 0; i < 200; i++) {
      await db('player_resources')
        .where('player_id', TEST_PLAYER_ID)
        .whereIn('resource_id', ['gold', 'wood', 'stone', 'iron'])
        .orderBy('amount', 'desc')
        .limit(2);
    }

    const elapsed = Date.now() - start;
    console.log(`  200 complex queries in ${elapsed}ms`);
    expect(elapsed).toBeLessThan(3000);
  }, 10000);

  test('bulk insert and query with many records', async () => {
    // Insert 500 battle records
    const startInsert = Date.now();

    for (let i = 0; i < 500; i++) {
      await db('battles').insert({
        attacker_id: TEST_PLAYER_ID,
        defender_id: TEST_PLAYER_ID + 1,
        type: 'pvp',
        attacker_army: JSON.stringify({ militia: 10 }),
        defender_army: JSON.stringify({ militia: 8 }),
        result: JSON.stringify({ winner: i % 2 === 0 ? 'attacker' : 'defender' }),
        winner: i % 2 === 0 ? 'attacker' : 'defender',
        loot: JSON.stringify({}),
        resolved_at: new Date().toISOString(),
      });
    }

    const insertElapsed = Date.now() - startInsert;
    console.log(`  500 battle inserts in ${insertElapsed}ms`);

    // Query battle history
    const startQuery = Date.now();
    const battles = await db('battles')
      .where('attacker_id', TEST_PLAYER_ID)
      .orderBy('id', 'desc')
      .limit(50);

    const queryElapsed = Date.now() - startQuery;
    console.log(`  Query 50 battles from 500 in ${queryElapsed}ms`);

    expect(battles).toHaveLength(50);
    expect(insertElapsed).toBeLessThan(5000);
    expect(queryElapsed).toBeLessThan(500);
  }, 15000);

  test('saveToDisk frequency impact (measured via write ops)', async () => {
    // This test measures how much time is spent on disk writes
    // Each dbRun call triggers saveToDisk() — this is a known bottleneck
    const start = Date.now();

    for (let i = 0; i < 100; i++) {
      await db('player_resources')
        .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
        .update({ amount: 1000 + i });
    }

    const elapsed = Date.now() - start;
    console.log(`  100 updates (each triggers saveToDisk): ${elapsed}ms`);
    console.log(`  Average per update: ${(elapsed / 100).toFixed(1)}ms`);

    // Log this as a potential improvement area
    // In production, batching saves or using WAL mode would help
  }, 10000);
});
