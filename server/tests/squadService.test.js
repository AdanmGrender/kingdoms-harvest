/**
 * Escuadras de héroes (F4 idle) — heroService.getSquad/setSquadSlot/
 * getSquadCombatBonus/applySquadRecovery + integración con oleadas.
 */
const { initTestDb, seedTestData, TEST_PLAYER_ID } = require('./setup');

let db;
let heroService;

async function addHero(heroId, level = 1) {
  const [id] = await db('player_heroes').insert({
    player_id: TEST_PLAYER_ID,
    hero_id: heroId,
    level,
    xp: 0,
    equipment: '{}',
  });
  return id;
}

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  heroService = require('../src/services/heroService');
});

beforeEach(async () => {
  await db('player_squads').delete();
  await db('player_heroes').where('player_id', TEST_PLAYER_ID).delete();
});

describe('setSquadSlot / getSquad', () => {
  test('asigna héroes a slots y los lee con stats', async () => {
    const aria = await addHero('aria', 3);
    const lyra = await addHero('lyra', 1);

    await heroService.setSquadSlot(TEST_PLAYER_ID, 1, aria);
    await heroService.setSquadSlot(TEST_PLAYER_ID, 2, lyra);

    const squad = await heroService.getSquad(TEST_PLAYER_ID);
    expect(squad).toHaveLength(2);
    expect(squad[0].heroId).toBe('aria');
    expect(squad[0].stats.atk).toBeGreaterThan(0);
    expect(squad[1].class).toBe('mage');
  });

  test('mover un héroe de slot libera el anterior', async () => {
    const aria = await addHero('aria');
    await heroService.setSquadSlot(TEST_PLAYER_ID, 1, aria);
    await heroService.setSquadSlot(TEST_PLAYER_ID, 3, aria);

    const squad = await heroService.getSquad(TEST_PLAYER_ID);
    expect(squad).toHaveLength(1);
    expect(squad[0].slot).toBe(3);
  });

  test('slot null vacía; slot fuera de rango rechaza', async () => {
    const aria = await addHero('aria');
    await heroService.setSquadSlot(TEST_PLAYER_ID, 1, aria);
    await heroService.setSquadSlot(TEST_PLAYER_ID, 1, null);
    expect(await heroService.getSquad(TEST_PLAYER_ID)).toHaveLength(0);

    await expect(heroService.setSquadSlot(TEST_PLAYER_ID, 9, aria)).rejects.toThrow(/Slot/);
  });

  test('héroe en recuperación no puede entrar a la escuadra', async () => {
    const aria = await addHero('aria');
    await db('player_heroes').where('id', aria).update({
      recovery_until: new Date(Date.now() + 3600000).toISOString(),
    });
    await expect(heroService.setSquadSlot(TEST_PLAYER_ID, 1, aria)).rejects.toThrow(/recuperación/);
  });
});

describe('getSquadCombatBonus', () => {
  test('apila CLASS_BONUSES de héroes listos con caps', async () => {
    await heroService.setSquadSlot(TEST_PLAYER_ID, 1, await addHero('aria'));   // warrior +0.15 atk
    await heroService.setSquadSlot(TEST_PLAYER_ID, 2, await addHero('lyra'));   // mage defDebuff 0.15
    await heroService.setSquadSlot(TEST_PLAYER_ID, 3, await addHero('viktor')); // paladin lossReduction 0.25

    const bonus = await heroService.getSquadCombatBonus(TEST_PLAYER_ID);
    expect(bonus.attackBonus).toBeCloseTo(0.15);
    expect(bonus.defDebuff).toBeCloseTo(0.15);
    expect(bonus.lossReduction).toBeCloseTo(0.25);
    expect(bonus.flatAtk).toBeGreaterThan(0);
    expect(bonus.heroes).toHaveLength(3);
  });

  test('héroes en recuperación no aportan', async () => {
    const aria = await addHero('aria');
    await heroService.setSquadSlot(TEST_PLAYER_ID, 1, aria);
    await db('player_heroes').where('id', aria).update({
      recovery_until: new Date(Date.now() + 3600000).toISOString(),
    });
    const bonus = await heroService.getSquadCombatBonus(TEST_PLAYER_ID);
    expect(bonus.heroes).toHaveLength(0);
    expect(bonus.attackBonus).toBe(0);
  });
});

describe('escuadra en la Marea Disforme', () => {
  test('los héroes de la escuadra pelean y disparan skills en el log', async () => {
    // DPS bajo + muralla enorme → peleas largas (≥4 rondas acumuladas) para
    // que la energía del héroe llegue a 100 y la skill aparezca en el log
    await db('player_troops').insert({
      player_id: TEST_PLAYER_ID, troop_id: 'militia', quantity: 10,
    });
    await db('player_buildings').insert({
      player_id: TEST_PLAYER_ID, building_id: 'wall', level: 30, is_building: false,
    });
    await heroService.setSquadSlot(TEST_PLAYER_ID, 1, await addHero('zara', 10)); // mage legendaria

    await db('wave_progress').delete();
    const waveDefenseService = require('../src/services/waveDefenseService');
    let seed = 777;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const result = await waveDefenseService.startRun(TEST_PLAYER_ID, { rand });

    expect(result.log.some((l) => l.type === 'hero_skill' && l.text.includes('Descarga Psíquica'))).toBe(true);

    // limpiar
    await db('player_troops').where('player_id', TEST_PLAYER_ID).delete();
    await db('player_buildings')
      .where({ player_id: TEST_PLAYER_ID, building_id: 'wall', level: 30 }).delete();
  });

  test('applySquadRecovery marca a toda la escuadra', async () => {
    await heroService.setSquadSlot(TEST_PLAYER_ID, 1, await addHero('aria'));
    await heroService.setSquadSlot(TEST_PLAYER_ID, 2, await addHero('finn'));

    const rec = await heroService.applySquadRecovery(TEST_PLAYER_ID, 1);
    expect(rec.count).toBe(2);

    const bonus = await heroService.getSquadCombatBonus(TEST_PLAYER_ID);
    expect(bonus.heroes).toHaveLength(0);
  });
});
