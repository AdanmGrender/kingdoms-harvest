// F6 Códice de colección: bono de ATK por héroes ÚNICOS poseídos.
const { initTestDb, seedTestData } = require('./setup');

let db, codexService, campaignService;

async function freshPlayer(id) {
  await db('players').where('telegram_id', id).delete();
  await db('player_heroes').where('player_id', id).delete();
  await db('players').insert({
    telegram_id: id, username: 'cx', first_name: 'CX', display_name: 'CX',
    level: 5, xp: 0, created_at: new Date().toISOString(),
  });
}

// Siembra `n` héroes con hero_id DISTINTO (usa un pool de ids reales del config).
async function seedUniqueHeroes(id, n) {
  const { HEROES } = require('../../shared/gameConfig');
  const ids = Object.keys(HEROES);
  for (let i = 0; i < n; i++) {
    await db('player_heroes').insert({
      player_id: id, hero_id: ids[i % ids.length] + (i >= ids.length ? `_dup${i}` : ''),
      level: 1, xp: 0, equipment: '{"weapon":null,"armor":null,"accessory":null}',
      obtained_at: new Date().toISOString(),
    });
  }
}

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
  codexService = require('../src/services/codexService');
  campaignService = require('../src/services/campaignService');
});

describe('codexService.getAtkMult', () => {
  test('0 héroes → multiplicador 1 (sin bono)', async () => {
    await freshPlayer(950001);
    expect(await codexService.getAtkMult(950001)).toBe(1);
  });

  test('6 héroes únicos → +2% (2 pasos de 3)', async () => {
    await freshPlayer(950002);
    await seedUniqueHeroes(950002, 6);
    expect(await codexService.getAtkMult(950002)).toBeCloseTo(1.02, 5);
  });

  test('30 héroes únicos → cap +6% (maxSteps)', async () => {
    await freshPlayer(950003);
    await seedUniqueHeroes(950003, 30);
    expect(await codexService.getAtkMult(950003)).toBeCloseTo(1.06, 5);
  });

  test('héroes repetidos NO cuentan (únicos por hero_id)', async () => {
    await freshPlayer(950004);
    // 5 copias del MISMO hero_id → 1 único → 0 pasos → mult 1
    for (let i = 0; i < 5; i++) {
      await db('player_heroes').insert({
        player_id: 950004, hero_id: 'aria', level: 1, xp: 0,
        equipment: '{"weapon":null,"armor":null,"accessory":null}',
        obtained_at: new Date().toISOString(),
      });
    }
    expect(await codexService.getAtkMult(950004)).toBe(1);
  });
});

describe('codex aplicado en _buildCombatState', () => {
  test('la guarnición (atk 60) escala con el bono del códice (6 únicos → 61)', async () => {
    await freshPlayer(950005);
    await seedUniqueHeroes(950005, 6); // +2% → 60*1.02 = 61.2 → round 61
    // Sin escuadra → _buildCombatState usa la guarnición, con atk escalado.
    const node = require('../../shared/gameConfig').CAMPAIGN.find((n) => n.id === 'a1n3');
    const state = await campaignService._buildCombatState(950005, node);
    expect(state.heroes[0].name).toBe('Guarnición');
    expect(state.heroes[0].atk).toBe(61);
  });
});
