const { initTestDb, seedTestData, TEST_PLAYER_ID } = require('./setup');

let db;
let heroService;
let crypto;

const HERO_PLAYER_ID = 777666555; // isolated player for hero tests

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  heroService = require('../src/services/heroService');
  crypto = require('crypto');

  // Seed HERO_PLAYER_ID with required rows
  const existing = await db('players').where('telegram_id', HERO_PLAYER_ID).first();
  if (!existing) {
    await db('players').insert({
      telegram_id: HERO_PLAYER_ID,
      username: 'heroplayer',
      first_name: 'Hero',
      display_name: 'HeroPlayer',
      level: 5,
      xp: 0,
    });
    await db('player_resources').insert({ player_id: HERO_PLAYER_ID, resource_id: 'gold', amount: 5000, capacity: 99999 });
    await db('player_resources').insert({ player_id: HERO_PLAYER_ID, resource_id: 'wood', amount: 500, capacity: 99999 });
    await db('player_tokens').insert({
      player_id: HERO_PLAYER_ID,
      balance: 5000,
      total_earned: 5000,
      daily_earned_today: 0,
    });
  }
});

afterAll(async () => {
  // Cleanup hero player rows
  await db('player_heroes').where('player_id', HERO_PLAYER_ID).delete();
  await db('player_items').where('player_id', HERO_PLAYER_ID).delete();
  await db('player_tokens').where('player_id', HERO_PLAYER_ID).delete();
  await db('player_resources').where('player_id', HERO_PLAYER_ID).delete();
  await db('players').where('telegram_id', HERO_PLAYER_ID).delete();
});

// ============================================
// HeroService — STAT_CAPS
// ============================================
describe('HeroService — STAT_CAPS', () => {
  test('exports STAT_CAPS with expected keys', () => {
    expect(heroService.STAT_CAPS).toMatchObject({
      atk: 50,
      def: 50,
      hp: 200,
      spd: 20,
      mgk: 50,
    });
  });
});

// ============================================
// HeroService — getHeroes
// ============================================
describe('HeroService — getHeroes', () => {
  let insertedId;

  beforeAll(async () => {
    const [{ id }] = await db('player_heroes').insert({
      player_id: HERO_PLAYER_ID,
      hero_id: 'aria',
      level: 3,
      xp: 0,
      equipment: JSON.stringify({ weapon: 'iron_sword', armor: null, accessory: null }),
      obtained_at: new Date().toISOString(),
    }).returning('id');
    insertedId = id;
  });

  afterAll(async () => {
    await db('player_heroes').where('id', insertedId).delete();
  });

  test('returns array of heroes for player', async () => {
    const heroes = await heroService.getHeroes(HERO_PLAYER_ID);
    expect(Array.isArray(heroes)).toBe(true);
    expect(heroes.length).toBeGreaterThan(0);
  });

  test('hero object has required fields', async () => {
    const heroes = await heroService.getHeroes(HERO_PLAYER_ID);
    const hero = heroes.find((h) => h.dbId === insertedId);
    expect(hero).toBeDefined();
    expect(hero.heroId).toBe('aria');
    // Nombre desde la config — los display names se re-tematizan sin tocar IDs
    const { HEROES } = require('../../shared/gameConfig');
    expect(hero.name).toBe(HEROES.aria.name);
    expect(hero.class).toBe('warrior');
    expect(hero.rarity).toBe('common');
    expect(hero.level).toBe(3);
    expect(hero.xp).toBe(0);
    expect(hero.xpNeeded).toBeGreaterThan(0);
    expect(hero.equipment).toMatchObject({ weapon: 'iron_sword', armor: null, accessory: null });
    expect(hero.stats).toHaveProperty('atk');
    expect(hero.stats).toHaveProperty('def');
    expect(hero.stats).toHaveProperty('hp');
  });

  test('stats increase with level', async () => {
    const [{ id: idLv1 }] = await db('player_heroes').insert({
      player_id: HERO_PLAYER_ID,
      hero_id: 'aria',
      level: 1,
      xp: 0,
      equipment: JSON.stringify({ weapon: null, armor: null, accessory: null }),
      obtained_at: new Date().toISOString(),
    }).returning('id');
    const [{ id: idLv10 }] = await db('player_heroes').insert({
      player_id: HERO_PLAYER_ID,
      hero_id: 'aria',
      level: 10,
      xp: 0,
      equipment: JSON.stringify({ weapon: null, armor: null, accessory: null }),
      obtained_at: new Date().toISOString(),
    }).returning('id');

    const heroes = await heroService.getHeroes(HERO_PLAYER_ID);
    const lv1 = heroes.find((h) => h.dbId === idLv1);
    const lv10 = heroes.find((h) => h.dbId === idLv10);

    expect(lv10.stats.atk).toBeGreaterThan(lv1.stats.atk);
    expect(lv10.stats.hp).toBeGreaterThan(lv1.stats.hp);

    await db('player_heroes').where('id', idLv1).delete();
    await db('player_heroes').where('id', idLv10).delete();
  });

  test('returns empty array for player with no heroes', async () => {
    const heroes = await heroService.getHeroes(0);
    expect(heroes).toEqual([]);
  });

  test('item bonuses are reflected in stats', async () => {
    const [{ id: idNoItem }] = await db('player_heroes').insert({
      player_id: HERO_PLAYER_ID,
      hero_id: 'aria',
      level: 1,
      xp: 0,
      equipment: JSON.stringify({ weapon: null, armor: null, accessory: null }),
      obtained_at: new Date().toISOString(),
    }).returning('id');
    const [{ id: idWithItem }] = await db('player_heroes').insert({
      player_id: HERO_PLAYER_ID,
      hero_id: 'aria',
      level: 1,
      xp: 0,
      equipment: JSON.stringify({ weapon: 'iron_sword', armor: null, accessory: null }),
      obtained_at: new Date().toISOString(),
    }).returning('id');

    const heroes = await heroService.getHeroes(HERO_PLAYER_ID);
    const bare = heroes.find((h) => h.dbId === idNoItem);
    const equipped = heroes.find((h) => h.dbId === idWithItem);

    // iron_sword gives +6 atk
    expect(equipped.stats.atk).toBe(bare.stats.atk + 6);

    await db('player_heroes').where('id', idNoItem).delete();
    await db('player_heroes').where('id', idWithItem).delete();
  });
});

// ============================================
// HeroService — getItems
// ============================================
describe('HeroService — getItems', () => {
  beforeAll(async () => {
    await db('player_items').insert({ player_id: HERO_PLAYER_ID, item_id: 'iron_sword', quantity: 2 });
    await db('player_items').insert({ player_id: HERO_PLAYER_ID, item_id: 'leather_armor', quantity: 1 });
    await db('player_items').insert({ player_id: HERO_PLAYER_ID, item_id: 'speed_boots', quantity: 0 }); // excluded
  });

  afterAll(async () => {
    await db('player_items').where('player_id', HERO_PLAYER_ID).delete();
  });

  test('returns items with quantity > 0', async () => {
    const items = await heroService.getItems(HERO_PLAYER_ID);
    expect(items.length).toBe(2);
    const ids = items.map((i) => i.id);
    expect(ids).toContain('iron_sword');
    expect(ids).toContain('leather_armor');
    expect(ids).not.toContain('speed_boots');
  });

  test('item object has expected fields', async () => {
    const items = await heroService.getItems(HERO_PLAYER_ID);
    const sword = items.find((i) => i.id === 'iron_sword');
    expect(sword).toBeDefined();
    expect(sword.quantity).toBe(2);
    expect(sword.slot).toBe('weapon');
    expect(sword.bonuses).toHaveProperty('atk');
  });

  test('returns empty array for player with no items', async () => {
    const items = await heroService.getItems(0);
    expect(items).toEqual([]);
  });
});

// ============================================
// HeroService — summonHero
// ============================================
describe('HeroService — summonHero', () => {
  afterEach(async () => {
    await db('player_heroes').where('player_id', HERO_PLAYER_ID).delete();
    await db('player_items').where('player_id', HERO_PLAYER_ID).delete();
  });

  test('summons hero with tokens and returns correct shape', async () => {
    // Force common rarity: first randomInt call returns 0 (< 55 weight → common)
    // second call picks hero index 0
    jest.spyOn(crypto, 'randomInt').mockReturnValueOnce(0).mockReturnValueOnce(0);

    await db('player_tokens').where('player_id', HERO_PLAYER_ID).update({ balance: 5000 });
    const result = await heroService.summonHero(HERO_PLAYER_ID, true);

    expect(result.success).toBe(true);
    expect(typeof result.heroDbId).toBe('number');
    expect(result.rarity).toBe('common');
    expect(typeof result.heroName).toBe('string');
    expect(typeof result.droppedItem).toBe('string');
    expect(result.message).toContain('Invocaste');

    jest.restoreAllMocks();
  });

  test('deducts token balance on summon', async () => {
    jest.spyOn(crypto, 'randomInt').mockReturnValue(0);
    await db('player_tokens').where('player_id', HERO_PLAYER_ID).update({ balance: 5000 });

    await heroService.summonHero(HERO_PLAYER_ID, true);

    const tokenRow = await db('player_tokens').where('player_id', HERO_PLAYER_ID).first();
    // common summonCost = 200
    expect(tokenRow.balance).toBe(5000 - 200);

    jest.restoreAllMocks();
  });

  test('creates player_heroes row on summon', async () => {
    jest.spyOn(crypto, 'randomInt').mockReturnValue(0);
    await db('player_tokens').where('player_id', HERO_PLAYER_ID).update({ balance: 5000 });

    const result = await heroService.summonHero(HERO_PLAYER_ID, true);
    const heroRow = await db('player_heroes').where('id', result.heroDbId).first();

    expect(heroRow).toBeDefined();
    expect(heroRow.level).toBe(1);
    expect(heroRow.xp).toBe(0);
    expect(heroRow.player_id).toBe(HERO_PLAYER_ID);

    jest.restoreAllMocks();
  });

  test('throws when token balance is insufficient', async () => {
    jest.spyOn(crypto, 'randomInt').mockReturnValue(0); // common (200 cost)
    await db('player_tokens').where('player_id', HERO_PLAYER_ID).update({ balance: 100 });

    await expect(heroService.summonHero(HERO_PLAYER_ID, true)).rejects.toThrow(/KH Tokens/);

    jest.restoreAllMocks();
  });

  test('summons common hero with gold (payWithTokens=false)', async () => {
    // Force common rarity
    jest.spyOn(crypto, 'randomInt').mockReturnValue(0);
    await db('player_resources')
      .where({ player_id: HERO_PLAYER_ID, resource_id: 'gold' })
      .update({ amount: 5000 });

    const result = await heroService.summonHero(HERO_PLAYER_ID, false);
    expect(result.success).toBe(true);
    expect(result.rarity).toBe('common');

    const goldRow = await db('player_resources')
      .where({ player_id: HERO_PLAYER_ID, resource_id: 'gold' }).first();
    expect(goldRow.amount).toBe(5000 - 500);

    jest.restoreAllMocks();
  });

  test('throws when trying to summon non-common hero with gold', async () => {
    // Force rare rarity: roll = 55 (skips common weight 55, enters rare)
    jest.spyOn(crypto, 'randomInt').mockReturnValue(55);

    await expect(heroService.summonHero(HERO_PLAYER_ID, false)).rejects.toThrow(/Comunes/);

    jest.restoreAllMocks();
  });

  test('creates starter item drop on summon', async () => {
    jest.spyOn(crypto, 'randomInt').mockReturnValue(0);
    await db('player_tokens').where('player_id', HERO_PLAYER_ID).update({ balance: 5000 });

    await heroService.summonHero(HERO_PLAYER_ID, true);

    const items = await db('player_items').where('player_id', HERO_PLAYER_ID);
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].quantity).toBeGreaterThanOrEqual(1);

    jest.restoreAllMocks();
  });
});

// ============================================
// HeroService — levelUpHero
// ============================================
describe('HeroService — levelUpHero', () => {
  let heroDbId;

  beforeEach(async () => {
    const [{ id }] = await db('player_heroes').insert({
      player_id: HERO_PLAYER_ID,
      hero_id: 'aria',
      level: 5,
      xp: 0,
      equipment: JSON.stringify({ weapon: null, armor: null, accessory: null }),
      obtained_at: new Date().toISOString(),
    }).returning('id');
    heroDbId = id;
    await db('player_resources')
      .where({ player_id: HERO_PLAYER_ID, resource_id: 'gold' })
      .update({ amount: 5000 });
  });

  afterEach(async () => {
    await db('player_heroes').where('player_id', HERO_PLAYER_ID).delete();
  });

  test('increases hero level by 1', async () => {
    const result = await heroService.levelUpHero(HERO_PLAYER_ID, heroDbId);
    expect(result.success).toBe(true);
    expect(result.newLevel).toBe(6);
    expect(result.message).toContain('nivel 6');
  });

  test('deducts gold cost (50 × current level)', async () => {
    await heroService.levelUpHero(HERO_PLAYER_ID, heroDbId); // level 5 → costs 250
    const goldRow = await db('player_resources')
      .where({ player_id: HERO_PLAYER_ID, resource_id: 'gold' }).first();
    expect(goldRow.amount).toBe(5000 - 250);
  });

  test('returns updated stats', async () => {
    const result = await heroService.levelUpHero(HERO_PLAYER_ID, heroDbId);
    expect(result.stats).toHaveProperty('atk');
    expect(result.stats.atk).toBeGreaterThan(0);
  });

  test('resets xp to 0 after level up', async () => {
    await db('player_heroes').where('id', heroDbId).update({ xp: 99 });
    await heroService.levelUpHero(HERO_PLAYER_ID, heroDbId);
    const row = await db('player_heroes').where('id', heroDbId).first();
    expect(row.xp).toBe(0);
    expect(row.level).toBe(6);
  });

  test('throws when hero not found', async () => {
    await expect(heroService.levelUpHero(HERO_PLAYER_ID, 99999)).rejects.toThrow(/Héroe no encontrado/);
  });

  test('throws when hero belongs to different player', async () => {
    await expect(heroService.levelUpHero(TEST_PLAYER_ID, heroDbId)).rejects.toThrow(/Héroe no encontrado/);
  });

  test('throws at max level 20', async () => {
    await db('player_heroes').where('id', heroDbId).update({ level: 20 });
    await expect(heroService.levelUpHero(HERO_PLAYER_ID, heroDbId)).rejects.toThrow(/nivel máximo/);
  });
});

// ============================================
// HeroService — equipItem
// ============================================
describe('HeroService — equipItem', () => {
  let heroDbId;

  beforeEach(async () => {
    const [{ id }] = await db('player_heroes').insert({
      player_id: HERO_PLAYER_ID,
      hero_id: 'aria',
      level: 1,
      xp: 0,
      equipment: JSON.stringify({ weapon: null, armor: null, accessory: null }),
      obtained_at: new Date().toISOString(),
    }).returning('id');
    heroDbId = id;
    await db('player_items').insert({ player_id: HERO_PLAYER_ID, item_id: 'iron_sword', quantity: 1 });
  });

  afterEach(async () => {
    await db('player_heroes').where('player_id', HERO_PLAYER_ID).delete();
    await db('player_items').where('player_id', HERO_PLAYER_ID).delete();
  });

  test('equips item into correct slot', async () => {
    const result = await heroService.equipItem(HERO_PLAYER_ID, heroDbId, 'iron_sword');
    expect(result.success).toBe(true);
    expect(result.equipment.weapon).toBe('iron_sword');
    const { HERO_ITEMS } = require('../../shared/gameConfig');
    expect(result.message).toContain(HERO_ITEMS.iron_sword.name);
  });

  test('removes item from inventory after equipping', async () => {
    await heroService.equipItem(HERO_PLAYER_ID, heroDbId, 'iron_sword');
    const item = await db('player_items')
      .where({ player_id: HERO_PLAYER_ID, item_id: 'iron_sword' }).first();
    expect(!item || item.quantity === 0).toBe(true);
  });

  test('returns previously equipped item to inventory', async () => {
    // Equip iron_sword first
    await db('player_heroes').where('id', heroDbId).update({
      equipment: JSON.stringify({ weapon: 'iron_sword', armor: null, accessory: null }),
    });
    // Remove from inventory (it's "equipped")
    await db('player_items').where({ player_id: HERO_PLAYER_ID, item_id: 'iron_sword' }).delete();

    // Now equip hunters_bow (same slot=weapon)
    await db('player_items').insert({ player_id: HERO_PLAYER_ID, item_id: 'hunters_bow', quantity: 1 });
    await heroService.equipItem(HERO_PLAYER_ID, heroDbId, 'hunters_bow');

    // iron_sword should be back in inventory
    const returned = await db('player_items')
      .where({ player_id: HERO_PLAYER_ID, item_id: 'iron_sword' }).first();
    expect(returned).toBeDefined();
    expect(returned.quantity).toBeGreaterThanOrEqual(1);
  });

  test('stats include item bonuses after equip', async () => {
    const result = await heroService.equipItem(HERO_PLAYER_ID, heroDbId, 'iron_sword');
    // iron_sword gives +6 atk
    const baseAtk = 14; // aria base atk at common × 1 × level 1 bonus = 14
    expect(result.stats.atk).toBe(baseAtk + 6);
  });

  test('throws when hero not found', async () => {
    await expect(heroService.equipItem(HERO_PLAYER_ID, 99999, 'iron_sword')).rejects.toThrow(/Héroe no encontrado/);
  });

  test('throws when item is invalid', async () => {
    await expect(heroService.equipItem(HERO_PLAYER_ID, heroDbId, 'fake_item')).rejects.toThrow(/Objeto no válido/);
  });

  test('throws when item not in inventory', async () => {
    await db('player_items').where({ player_id: HERO_PLAYER_ID, item_id: 'iron_sword' }).delete();
    await expect(heroService.equipItem(HERO_PLAYER_ID, heroDbId, 'iron_sword')).rejects.toThrow(/inventario/);
  });
});

// ============================================
// HeroService — unequipItem
// ============================================
describe('HeroService — unequipItem', () => {
  let heroDbId;

  beforeEach(async () => {
    const [{ id }] = await db('player_heroes').insert({
      player_id: HERO_PLAYER_ID,
      hero_id: 'aria',
      level: 1,
      xp: 0,
      equipment: JSON.stringify({ weapon: 'iron_sword', armor: null, accessory: null }),
      obtained_at: new Date().toISOString(),
    }).returning('id');
    heroDbId = id;
  });

  afterEach(async () => {
    await db('player_heroes').where('player_id', HERO_PLAYER_ID).delete();
    await db('player_items').where('player_id', HERO_PLAYER_ID).delete();
  });

  test('unequips item and returns to inventory', async () => {
    const result = await heroService.unequipItem(HERO_PLAYER_ID, heroDbId, 'weapon');
    expect(result.success).toBe(true);
    expect(result.equipment.weapon).toBeNull();

    const item = await db('player_items')
      .where({ player_id: HERO_PLAYER_ID, item_id: 'iron_sword' }).first();
    expect(item).toBeDefined();
    expect(item.quantity).toBe(1);
  });

  test('increments quantity if item already exists in inventory', async () => {
    // Player already has 1 iron_sword in bag
    await db('player_items').insert({ player_id: HERO_PLAYER_ID, item_id: 'iron_sword', quantity: 1 });

    await heroService.unequipItem(HERO_PLAYER_ID, heroDbId, 'weapon');

    const item = await db('player_items')
      .where({ player_id: HERO_PLAYER_ID, item_id: 'iron_sword' }).first();
    expect(item.quantity).toBe(2);
  });

  test('updates equipment slot to null', async () => {
    await heroService.unequipItem(HERO_PLAYER_ID, heroDbId, 'weapon');
    const row = await db('player_heroes').where('id', heroDbId).first();
    const equipment = JSON.parse(row.equipment);
    expect(equipment.weapon).toBeNull();
  });

  test('throws when hero not found', async () => {
    await expect(heroService.unequipItem(HERO_PLAYER_ID, 99999, 'weapon')).rejects.toThrow(/Héroe no encontrado/);
  });

  test('throws when slot is empty', async () => {
    await expect(heroService.unequipItem(HERO_PLAYER_ID, heroDbId, 'armor')).rejects.toThrow(/No hay objeto/);
  });

  test('throws when hero belongs to different player', async () => {
    await expect(heroService.unequipItem(TEST_PLAYER_ID, heroDbId, 'weapon')).rejects.toThrow(/Héroe no encontrado/);
  });
});
