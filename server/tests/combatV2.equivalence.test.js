// T6 — Con def=0, 1 enemigo y spd iguales, v2 reproduce v1 (los 11 escenarios de
// campaignSim.test.js, replicados acá sin tocar ese archivo) y coincide campo a campo.
const { simulateRound, ENERGY_MAX } = require('../src/services/campaignSim');
const { simulateRoundV2 } = require('../src/services/combat/engine');

function baseState(over = {}) {
  return {
    round: 0, maxRounds: 8, isBoss: false, shield: 0,
    heroes: [{ slot: 1, heroId: 'h', class: 'warrior', name: 'H', atk: 50, hp: 100, maxHp: 100,
      energy: 0, energyMax: ENERGY_MAX, skill: { id: 'golpe', type: 'damage', mult: 2 }, alive: true }],
    enemy: { hp: 120, maxHp: 120, dps: 10 }, log: [],
    ...over,
  };
}

// v1 y v2 sobre el mismo estado: mismos campos observables de v1.
function both(st, action) {
  const a = simulateRound(JSON.parse(JSON.stringify(st)), action);
  const b = simulateRoundV2(JSON.parse(JSON.stringify(st)), action);
  return { a, b };
}
function expectSame({ a, b }) {
  expect(b.result).toBe(a.result);
  expect(b.state.round).toBe(a.state.round);
  expect(b.state.enemy.hp).toBe(a.state.enemy.hp);
  expect(b.state.enemy.maxHp).toBe(a.state.enemy.maxHp);
  expect(b.state.enemy.dps).toBe(a.state.enemy.dps);
  expect(b.state.heroes).toEqual(a.state.heroes);
  if (a.result !== 'victory') expect(b.state.shield).toBe(a.state.shield); // v1 no reinicia el escudo al ganar
  const la = a.state.log[a.state.log.length - 1];
  const lb = b.state.log[b.state.log.length - 1];
  expect({ round: lb.round, enemyHp: lb.enemyHp, heroes: lb.heroes, result: lb.result }).toEqual(la);
}

const twoHeroes = () => baseState({
  heroes: [
    { slot: 1, heroId: 'h1', class: 'warrior', name: 'Front', atk: 10, hp: 20, maxHp: 20,
      energy: 0, energyMax: ENERGY_MAX, skill: { id: 'golpe', type: 'damage', mult: 2 }, alive: true },
    { slot: 2, heroId: 'h2', class: 'warrior', name: 'Back', atk: 10, hp: 50, maxHp: 50,
      energy: 0, energyMax: ENERGY_MAX, skill: { id: 'golpe', type: 'damage', mult: 2 }, alive: true },
  ],
  enemy: { hp: 1000, maxHp: 1000, dps: 30 },
});

describe('simulateRoundV2 reproduce los escenarios de campaignSim.test.js (v1)', () => {
  test('1 advance: héroes pegan, cargan energía, enemigo pega', () => {
    const { state, result } = simulateRoundV2(baseState(), { type: 'advance' });
    expect(state.enemy.hp).toBe(70);
    expect(state.heroes[0].energy).toBe(34);
    expect(state.heroes[0].hp).toBe(90);
    expect(state.round).toBe(1);
    expect(result).toBeNull();
    expectSame(both(baseState(), { type: 'advance' }));
  });

  test('2 victoria cuando el enemigo llega a 0', () => {
    const st = baseState({ enemy: { hp: 40, maxHp: 120, dps: 10 } });
    expect(simulateRoundV2(st, { type: 'advance' }).result).toBe('victory');
    expectSame(both(st, { type: 'advance' }));
  });

  test('3 skill de daño con energía llena y multiplicador', () => {
    const st = baseState({ enemy: { hp: 500, maxHp: 500, dps: 10 } });
    st.heroes[0].energy = ENERGY_MAX;
    const { state } = simulateRoundV2(st, { type: 'skill', slot: 1 });
    expect(state.enemy.hp).toBe(350);
    expect(state.heroes[0].energy).toBe(34);
    expectSame(both(st, { type: 'skill', slot: 1 }));
  });

  test('4 skill sin energía lanza error (mismo texto que v1)', () => {
    expect(() => simulateRoundV2(baseState(), { type: 'skill', slot: 1 })).toThrow(/energía/i);
    let e1; let e2;
    try { simulateRound(baseState(), { type: 'skill', slot: 1 }); } catch (e) { e1 = e.message; }
    try { simulateRoundV2(baseState(), { type: 'skill', slot: 1 }); } catch (e) { e2 = e.message; }
    expect(e2).toBe(e1);
  });

  test('4b skill con héroe inexistente o muerto lanza el mismo error que v1', () => {
    const st = baseState(); st.heroes[0].energy = ENERGY_MAX;
    expect(() => simulateRoundV2(st, { type: 'skill', slot: 9 })).toThrow('Héroe inválido para la habilidad');
    st.heroes[0].alive = false;
    expect(() => simulateRoundV2(st, { type: 'skill', slot: 1 })).toThrow('Héroe inválido para la habilidad');
  });

  test('5 escudo reduce el golpe enemigo de la ronda', () => {
    const st = baseState({ enemy: { hp: 500, maxHp: 500, dps: 100 } });
    st.heroes[0].energy = ENERGY_MAX;
    st.heroes[0].skill = { id: 'esc', type: 'shield', mult: 0.30 };
    expect(simulateRoundV2(st, { type: 'skill', slot: 1 }).state.heroes[0].hp).toBe(30);
    expectSame(both(st, { type: 'skill', slot: 1 }));
  });

  test('6 ejecución ×4 a boss, ×2 al resto', () => {
    const boss = baseState({ isBoss: true, enemy: { hp: 1000, maxHp: 1000, dps: 1 } });
    boss.heroes[0].energy = ENERGY_MAX;
    boss.heroes[0].skill = { id: 'ej', type: 'execute', mult: 4 };
    expect(simulateRoundV2(boss, { type: 'skill', slot: 1 }).state.enemy.hp).toBe(750);
    expectSame(both(boss, { type: 'skill', slot: 1 }));
    const norm = JSON.parse(JSON.stringify(boss)); norm.isBoss = false;
    expect(simulateRoundV2(norm, { type: 'skill', slot: 1 }).state.enemy.hp).toBe(850);
    expectSame(both(norm, { type: 'skill', slot: 1 }));
  });

  test('7 derrota si mueren todos los héroes', () => {
    const st = baseState({ enemy: { hp: 999, maxHp: 999, dps: 1000 } });
    expect(simulateRoundV2(st, { type: 'advance' }).result).toBe('defeat');
    expectSame(both(st, { type: 'advance' }));
  });

  test('8 derrota por timeout al llegar a maxRounds', () => {
    const st = baseState({ round: 7, maxRounds: 8, enemy: { hp: 999, maxHp: 999, dps: 1 } });
    expect(simulateRoundV2(st, { type: 'advance' }).result).toBe('defeat');
    expectSame(both(st, { type: 'advance' }));
  });

  test('9 no muta el estado de entrada', () => {
    const st = baseState();
    const snap = JSON.stringify(st);
    simulateRoundV2(st, { type: 'advance' });
    expect(JSON.stringify(st)).toBe(snap);
    expect(st.round).toBe(0);
    expect(st.enemy.hp).toBe(120);
  });

  test('10 la ronda de victoria incluye snapshot y no duplica número de ronda', () => {
    let st = baseState({ enemy: { hp: 90, maxHp: 90, dps: 5 } });
    let result = null;
    while (result === null) {
      const res = simulateRoundV2(st, { type: 'advance' });
      st = res.state; result = res.result;
    }
    expect(result).toBe('victory');
    const last = st.log[st.log.length - 1];
    expect(last.result).toBe('victory');
    expect(typeof last.enemyHp).toBe('number');
    expect(last.heroes.length).toBeGreaterThan(0);
    const nums = st.log.map((e) => e.round);
    expect(new Set(nums).size).toBe(nums.length);
  });

  test('11 derrame al segundo héroe cuando el frontal muere (dos héroes)', () => {
    const { state, result } = simulateRoundV2(twoHeroes(), { type: 'advance' });
    expect(state.heroes[0].alive).toBe(false);
    expect(state.heroes[0].hp).toBe(0);
    expect(state.heroes[1].alive).toBe(true);
    expect(state.heroes[1].hp).toBe(40);
    expect(result).toBeNull();
    expectSame(both(twoHeroes(), { type: 'advance' }));
  });
});

describe('v1 ↔ v2: partidas completas con def=0, spd iguales y 1 enemigo', () => {
  function playBoth(make, pick) {
    let a = make(); let b = make();
    for (let i = 0; i < 20; i++) {
      const act = pick(i, a);
      const ra = simulateRound(a, act); const rb = simulateRoundV2(b, act);
      expectSame({ a: ra, b: rb });
      a = ra.state; b = rb.state;
      if (ra.result) return ra.result;
    }
    return null;
  }

  test('advance puro, dos héroes', () => {
    expect(playBoth(() => ({ ...twoHeroes(), enemy: { hp: 300, maxHp: 300, dps: 12 } }), () => ({ type: 'advance' }))).not.toBeNull();
  });

  test('con skills cuando hay energía', () => {
    const make = () => {
      const s = twoHeroes(); s.enemy = { hp: 150, maxHp: 150, dps: 9 };
      s.heroes[0].hp = s.heroes[0].maxHp = 400; s.heroes[1].hp = s.heroes[1].maxHp = 400;
      s.heroes[1].skill = { id: 'esc', type: 'shield', mult: 0.3 };
      return s;
    };
    const pick = (i, st) => {
      const h = st.heroes.find((x) => x.alive && x.energy >= ENERGY_MAX);
      return h ? { type: 'skill', slot: h.slot } : { type: 'advance' };
    };
    expect(playBoth(make, pick)).toBe('victory');
  });

  test('derrota por héroes muertos', () => {
    expect(playBoth(() => ({ ...twoHeroes(), enemy: { hp: 9999, maxHp: 9999, dps: 60 } }), () => ({ type: 'advance' }))).toBe('defeat');
  });
});
