const { COMBAT } = require('../../shared/gameConfig');
const { nextFloat, createRng } = require('../src/services/combat/rng');
const { mitigate } = require('../src/services/combat/damage');
const { principalEnemy, heroTargetOrder, actorOrder } = require('../src/services/combat/targeting');

// Referencia canónica mulberry32 (independiente de rng.js).
function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

describe('COMBAT config (T1)', () => {
  test('forma y defaults: engineVersion 1, defK 100, amenaza por clase', () => {
    expect(COMBAT.engineVersion).toBe(1); // R-ND3
    expect(COMBAT.defK).toBe(100);
    expect(Object.keys(COMBAT.threat).sort()).toEqual(['mage', 'paladin', 'ranger', 'rogue', 'warrior']);
    for (const v of Object.values(COMBAT.threat)) expect(typeof v).toBe('number');
    expect(COMBAT.threat.warrior).toBeGreaterThan(COMBAT.threat.mage);
  });
});

describe('rng (T2)', () => {
  test.each([0, 12345, 4294967295])('coincide con mulberry32 de referencia (semilla %i)', (seed) => {
    const ref = mulberry32(seed);
    let st = seed;
    for (let i = 0; i < 20; i++) {
      const r = nextFloat(st);
      expect(r.value).toBe(ref());
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      expect(Number.isInteger(r.rng) && r.rng >= 0 && r.rng <= 4294967295).toBe(true);
      st = r.rng;
    }
  });

  test('nextFloat es pura: misma entrada → misma salida', () => {
    expect(nextFloat(42)).toEqual(nextFloat(42));
  });

  test('createRng consume pasos y deja el estado nuevo en state.rng', () => {
    const state = { rng: 99 };
    const g = createRng(state);
    const a = g.float(); const b = g.float();
    const r1 = nextFloat(99); const r2 = nextFloat(r1.rng);
    expect([a, b]).toEqual([r1.value, r2.value]);
    expect(state.rng).toBe(r2.rng);
  });

  test('R-ND7: combat/ no usa Math.random', () => {
    const fs = require('fs'); const path = require('path');
    const dir = path.join(__dirname, '../src/services/combat');
    for (const f of fs.readdirSync(dir)) {
      expect(fs.readFileSync(path.join(dir, f), 'utf8')).not.toMatch(/Math\.random/);
    }
  });
});

describe('mitigate (T2)', () => {
  test('def 0 / ausente / negativa = redondeo de v1', () => {
    expect(mitigate(50, 0, 100)).toBe(50);
    expect(mitigate(50, undefined, 100)).toBe(50);
    expect(mitigate(50, -20, 100)).toBe(50);
    expect(mitigate(33.4, 0, 100)).toBe(33);
    expect(mitigate(0.5 * 3, 0, 100)).toBe(Math.round(1.5));
  });
  test.each([
    [100, 10, 100, 91], [100, 15, 100, 87], [100, 50, 100, 67], [100, 100, 100, 50], [100, 300, 100, 25],
  ])('raw %i def %i K %i → %i', (raw, def, K, exp) => {
    expect(mitigate(raw, def, K)).toBe(exp);
  });
  test('K cambia el resultado (no está cableado)', () => {
    expect(mitigate(100, 50, 50)).toBe(50);
    expect(mitigate(100, 50, 200)).toBe(80);
  });
});

const H = (slot, cls, over = {}) => ({ slot, class: cls, alive: true, hp: 10, ...over });

describe('targeting (T3)', () => {
  test('principalEnemy: primer vivo, o el primero si todos muertos', () => {
    expect(principalEnemy([{ id: 'a', hp: 0 }, { id: 'b', hp: 5 }, { id: 'c', hp: 9 }]).id).toBe('b');
    expect(principalEnemy([{ id: 'a', hp: 0 }, { id: 'b', hp: -3 }]).id).toBe('a');
  });

  test('heroTargetOrder: amenaza desc, empate por slot, ignora muertos', () => {
    const hs = [H(1, 'mage'), H(2, 'warrior'), H(3, 'rogue'), H(4, 'warrior'), H(5, 'paladin', { alive: false })];
    expect(heroTargetOrder(hs, COMBAT.threat).map((h) => h.slot)).toEqual([2, 4, 3, 1]);
  });

  test('heroTargetOrder: clase sin peso = 1; no muta el input', () => {
    const hs = [H(1, 'mage'), H(2, 'bardo')];
    expect(heroTargetOrder(hs, COMBAT.threat).map((h) => h.slot)).toEqual([2, 1]);
    expect(hs.map((h) => h.slot)).toEqual([1, 2]);
  });

  test('heroTargetOrder usa el threat que se le pasa (hot-swap)', () => {
    const hs = [H(1, 'warrior'), H(2, 'mage')];
    expect(heroTargetOrder(hs, { warrior: 0.1, mage: 9 }).map((h) => h.slot)).toEqual([2, 1]);
  });

  test('actorOrder: spd desc; empate: héroe antes que enemigo; luego slot/índice', () => {
    const heroes = [H(1, 'warrior', { spd: 10 }), H(2, 'mage', { spd: 10 }), H(3, 'rogue', { spd: 20 }), H(4, 'ranger', { alive: false, spd: 99 })];
    const enemies = [{ id: 'e0', hp: 5, spd: 10 }, { id: 'e1', hp: 5, spd: 30 }, { id: 'e2', hp: 0, spd: 50 }];
    const order = actorOrder(heroes, enemies).map((a) => (a.side === 'h' ? `h${a.ref.slot}` : a.ref.id));
    expect(order).toEqual(['e1', 'h3', 'h1', 'h2', 'e0']);
  });

  test('actorOrder: spd ausente = 0 → todos los héroes y luego los enemigos', () => {
    const order = actorOrder([H(2, 'mage'), H(1, 'warrior')], [{ id: 'e0', hp: 1 }])
      .map((a) => (a.side === 'h' ? `h${a.ref.slot}` : a.ref.id));
    expect(order).toEqual(['h1', 'h2', 'e0']);
  });
});
