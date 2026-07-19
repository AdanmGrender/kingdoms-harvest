const { simulateRound, ENERGY_MAX } = require('../src/services/campaignSim');

function baseState(over = {}) {
  return {
    round: 0, maxRounds: 8, isBoss: false, shield: 0,
    heroes: [{ slot: 1, heroId: 'h', class: 'warrior', name: 'H', atk: 50, hp: 100, maxHp: 100,
      energy: 0, energyMax: ENERGY_MAX, skill: { id: 'golpe', type: 'damage', mult: 2 }, alive: true }],
    enemy: { hp: 120, maxHp: 120, dps: 10 }, log: [],
    ...over,
  };
}

describe('campaignSim.simulateRound', () => {
  test('advance: héroes pegan, cargan energía, enemigo pega', () => {
    const { state, result } = simulateRound(baseState(), { type: 'advance' });
    expect(state.enemy.hp).toBe(70);          // 120 - 50
    expect(state.heroes[0].energy).toBe(34);  // +ENERGY_PER_ROUND
    expect(state.heroes[0].hp).toBe(90);      // 100 - 10 dps
    expect(state.round).toBe(1);
    expect(result).toBeNull();
  });

  test('victoria cuando el enemigo llega a 0', () => {
    const { result } = simulateRound(baseState({ enemy: { hp: 40, maxHp: 120, dps: 10 } }), { type: 'advance' });
    expect(result).toBe('victory');
  });

  test('skill de daño requiere energía llena y aplica multiplicador', () => {
    const st = baseState({ enemy: { hp: 500, maxHp: 500, dps: 10 } });
    st.heroes[0].energy = ENERGY_MAX;
    const { state } = simulateRound(st, { type: 'skill', slot: 1 });
    // skill 50*2=100, luego ataque normal 50 => 500-100-50 = 350
    expect(state.enemy.hp).toBe(350);
    expect(state.heroes[0].energy).toBe(34); // reseteó a 0 y cargó la ronda
  });

  test('skill sin energía lanza error', () => {
    expect(() => simulateRound(baseState(), { type: 'skill', slot: 1 })).toThrow(/energía/i);
  });

  test('escudo reduce el golpe enemigo de la ronda', () => {
    const st = baseState({ enemy: { hp: 500, maxHp: 500, dps: 100 } });
    st.heroes[0].energy = ENERGY_MAX;
    st.heroes[0].skill = { id: 'esc', type: 'shield', mult: 0.30 };
    const { state } = simulateRound(st, { type: 'skill', slot: 1 });
    expect(state.heroes[0].hp).toBe(30); // 100 - (100*0.7)
  });

  test('ejecución pega ×4 a boss, ×2 al resto', () => {
    const st = baseState({ isBoss: true, enemy: { hp: 1000, maxHp: 1000, dps: 1 } });
    st.heroes[0].energy = ENERGY_MAX;
    st.heroes[0].skill = { id: 'ej', type: 'execute', mult: 4 };
    const { state } = simulateRound(st, { type: 'skill', slot: 1 });
    // ejecución 50*4=200, + ataque 50 => 1000-200-50=750
    expect(state.enemy.hp).toBe(750);
  });

  test('derrota si mueren todos los héroes', () => {
    const st = baseState({ enemy: { hp: 999, maxHp: 999, dps: 1000 } });
    const { result } = simulateRound(st, { type: 'advance' });
    expect(result).toBe('defeat');
  });

  test('derrota por timeout al llegar a maxRounds sin matar', () => {
    const st = baseState({ round: 7, maxRounds: 8, enemy: { hp: 999, maxHp: 999, dps: 1 } });
    const { result } = simulateRound(st, { type: 'advance' });
    expect(result).toBe('defeat');
  });

  test('no muta el estado de entrada (determinista)', () => {
    const st = baseState();
    simulateRound(st, { type: 'advance' });
    expect(st.round).toBe(0);
    expect(st.enemy.hp).toBe(120);
  });

  test('la ronda de victoria incluye snapshot y no duplica número de ronda', () => {
    let st = baseState({ enemy: { hp: 90, maxHp: 90, dps: 5 } });
    let result = null;
    while (result === null) {
      const res = simulateRound(st, { type: 'advance' });
      st = res.state;
      result = res.result;
    }
    expect(result).toBe('victory');
    const lastEntry = st.log[st.log.length - 1];
    expect(lastEntry.result).toBe('victory');
    expect(typeof lastEntry.enemyHp).toBe('number');
    expect(Array.isArray(lastEntry.heroes)).toBe(true);
    expect(lastEntry.heroes.length).toBeGreaterThan(0);
    const roundNumbers = st.log.map((e) => e.round);
    expect(new Set(roundNumbers).size).toBe(roundNumbers.length); // sin rondas duplicadas
  });

  test('desborda daño del héroe frontal al segundo cuando el primero muere (dos héroes)', () => {
    const st = baseState({
      heroes: [
        { slot: 1, heroId: 'h1', class: 'warrior', name: 'Front', atk: 10, hp: 20, maxHp: 20,
          energy: 0, energyMax: ENERGY_MAX, skill: { id: 'golpe', type: 'damage', mult: 2 }, alive: true },
        { slot: 2, heroId: 'h2', class: 'warrior', name: 'Back', atk: 10, hp: 50, maxHp: 50,
          energy: 0, energyMax: ENERGY_MAX, skill: { id: 'golpe', type: 'damage', mult: 2 }, alive: true },
      ],
      enemy: { hp: 1000, maxHp: 1000, dps: 30 },
    });
    const { state, result } = simulateRound(st, { type: 'advance' });
    expect(state.heroes[0].alive).toBe(false);
    expect(state.heroes[0].hp).toBe(0);
    expect(state.heroes[1].alive).toBe(true);
    expect(state.heroes[1].hp).toBe(40); // 50 - (30 - 20 de overflow del frontal)
    expect(result).toBeNull();
  });
});
