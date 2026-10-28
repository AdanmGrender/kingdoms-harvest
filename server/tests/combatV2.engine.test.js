// T5 — Comportamiento propio de v2: spd, amenaza, def, multi-enemigo, eventos, determinismo.
const { COMBAT } = require('../../shared/gameConfig');
const { ENERGY_MAX } = require('../src/services/campaignSim');
const { simulateRoundV2 } = require('../src/services/combat/engine');

const hero = (slot, cls, over = {}) => ({
  slot, heroId: `h${slot}`, class: cls, name: `H${slot}`, atk: 20, hp: 100, maxHp: 100,
  energy: 0, energyMax: ENERGY_MAX, skill: { id: 'golpe', type: 'damage', mult: 2 }, alive: true,
  def: 0, spd: 0, ...over,
});
const foe = (i, over = {}) => ({ id: `e${i}`, hp: 500, maxHp: 500, dps: 10, def: 0, spd: 0, ...over });

function st(over = {}) {
  const enemies = over.enemies || [foe(0)];
  return {
    engine: 2, seed: 7, rng: 7, events: [], eventsVersion: 1,
    round: 0, maxRounds: 10, isBoss: false, shield: 0,
    heroes: [hero(1, 'warrior')], log: [],
    ...over, enemies,
    enemy: { hp: enemies[0].hp, maxHp: enemies[0].maxHp, dps: enemies[0].dps },
  };
}
const step = (s, a = { type: 'advance' }) => simulateRoundV2(s, a);
const roundEvents = (s) => s.events.slice(...s.log[s.log.length - 1].eventRange);

describe('orden por spd', () => {
  test('enemigo más rápido pega antes de que un héroe lento actúe: lo mata y el héroe no ataca (R6)', () => {
    const s = st({
      heroes: [hero(1, 'warrior', { hp: 5, maxHp: 5, spd: 1 })],
      enemies: [foe(0, { dps: 50, spd: 9 })],
    });
    const { state, result } = step(s);
    expect(state.heroes[0].alive).toBe(false);
    expect(state.enemies[0].hp).toBe(500); // el héroe muerto no actuó
    expect(result).toBe('defeat');
    expect(roundEvents(state).map((e) => e.kind)).toEqual(['hit', 'death', 'end']);
  });

  test('héroe más rápido mata al enemigo antes de que pegue (no hay golpe enemigo)', () => {
    const s = st({
      heroes: [hero(1, 'warrior', { atk: 600, spd: 9 })],
      enemies: [foe(0, { dps: 50, spd: 1 })],
    });
    const { state, result } = step(s);
    expect(result).toBe('victory');
    expect(state.heroes[0].hp).toBe(100);
  });

  test('orden de eventos sigue spd: e1(30) → h2(20) → h1(10) → e0(10)', () => {
    const s = st({
      heroes: [hero(1, 'warrior', { spd: 10 }), hero(2, 'mage', { spd: 20 })],
      enemies: [foe(0, { spd: 10 }), foe(1, { spd: 30 })],
    });
    const ev = roundEvents(step(s).state).filter((e) => e.kind === 'hit');
    expect(ev.map((e) => e.actor)).toEqual(['e1', 'h2', 'h1', 'e0']);
  });
});

describe('amenaza de clase', () => {
  test('el enemigo golpea primero al de mayor amenaza (guerrero antes que mago en slot 1)', () => {
    const s = st({ heroes: [hero(1, 'mage'), hero(2, 'warrior')], enemies: [foe(0, { dps: 30 })] });
    const { state } = step(s);
    expect(state.heroes[1].hp).toBe(70);
    expect(state.heroes[0].hp).toBe(100);
  });

  test('empate de amenaza: gana el slot menor', () => {
    const s = st({ heroes: [hero(1, 'rogue'), hero(2, 'rogue')], enemies: [foe(0, { dps: 30 })] });
    const { state } = step(s);
    expect(state.heroes[0].hp).toBe(70);
    expect(state.heroes[1].hp).toBe(100);
  });

  test('hot-swap de COMBAT.threat cambia el objetivo (R-ND8)', () => {
    const orig = COMBAT.threat;
    try {
      COMBAT.threat = { warrior: 0.1, mage: 9 };
      const s = st({ heroes: [hero(1, 'warrior'), hero(2, 'mage')], enemies: [foe(0, { dps: 30 })] });
      const { state } = step(s);
      expect(state.heroes[1].hp).toBe(70);
      expect(state.heroes[0].hp).toBe(100);
    } finally { COMBAT.threat = orig; }
  });

  test('derrame: el sobrante ya mitigado pasa al siguiente por amenaza', () => {
    const s = st({
      heroes: [hero(1, 'mage', { hp: 100 }), hero(2, 'warrior', { hp: 20, maxHp: 20 })],
      enemies: [foe(0, { dps: 30 })],
    });
    const { state } = step(s);
    expect(state.heroes[1].alive).toBe(false);
    expect(state.heroes[0].hp).toBe(90); // 30 - 20 de derrame
    const hits = roundEvents(state).filter((e) => e.kind === 'hit' && e.actor === 'e0');
    expect(hits.map((e) => [e.target, e.value])).toEqual([['h2', 20], ['h1', 10]]);
  });
});

describe('def', () => {
  test('def del héroe mitiga el golpe enemigo con defK (K/(K+def))', () => {
    const s = st({ heroes: [hero(1, 'warrior', { def: 100 })], enemies: [foe(0, { dps: 40 })] });
    expect(step(s).state.heroes[0].hp).toBe(80); // 40 × 100/200 = 20
  });

  test('def del enemigo mitiga golpes y skills del héroe', () => {
    const s = st({ heroes: [hero(1, 'warrior', { atk: 40 })], enemies: [foe(0, { def: 100 })] });
    expect(step(s).state.enemies[0].hp).toBe(480);
    const sk = st({ heroes: [hero(1, 'warrior', { atk: 40, energy: ENERGY_MAX })], enemies: [foe(0, { def: 100 })] });
    expect(step(sk, { type: 'skill', slot: 1 }).state.enemies[0].hp).toBe(500 - 40 - 20); // skill 80→40, golpe 40→20
  });

  test('hot-swap de COMBAT.defK (R-ND8)', () => {
    const orig = COMBAT.defK;
    try {
      COMBAT.defK = 50;
      const s = st({ heroes: [hero(1, 'warrior', { def: 50 })], enemies: [foe(0, { dps: 40 })] });
      expect(step(s).state.heroes[0].hp).toBe(80); // 40 × 50/100
      COMBAT.defK = 100;
      expect(step(s).state.heroes[0].hp).toBe(73); // 40 × 100/150 = 26.67 → 27
    } finally { COMBAT.defK = orig; }
  });

  test('def/spd ausentes valen 0', () => {
    const s = st();
    delete s.heroes[0].def; delete s.heroes[0].spd; delete s.enemies[0].def; delete s.enemies[0].spd;
    const { state } = step(s);
    expect(state.enemies[0].hp).toBe(480);
    expect(state.heroes[0].hp).toBe(90);
  });
});

describe('multi-enemigo', () => {
  test('los héroes pegan al principal; al caer, al siguiente; sin victoria hasta que mueran todos', () => {
    const s = st({
      heroes: [hero(1, 'warrior', { atk: 100 }), hero(2, 'rogue', { atk: 100 })],
      enemies: [foe(0, { hp: 150, maxHp: 150 }), foe(1, { hp: 300, maxHp: 300 })],
    });
    const r1 = step(s);
    expect(r1.state.enemies.map((e) => e.hp)).toEqual([-50, 300]); // el 2º héroe remata al principal (sin derrame ofensivo)
    expect(r1.result).toBeNull();
    expect(r1.state.enemy.hp).toBe(300);       // alias = principal vivo (R-ND4b)
    expect(r1.state.enemy.maxHp).toBe(300);
    expect(r1.state.enemy.dps).toBe(10);
    const r2 = step(r1.state);                 // ahora el principal es e1
    expect(r2.state.enemies.map((e) => e.hp)).toEqual([-50, 100]);
  });

  test('todos los enemigos vivos pegan; los muertos no (R6)', () => {
    const s = st({ enemies: [foe(0, { dps: 10 }), foe(1, { dps: 15 }), foe(2, { hp: 0, dps: 99 })] });
    expect(step(s).state.heroes[0].hp).toBe(75);
  });

  test('victoria solo con todos muertos; log trae enemies[] y eventRange', () => {
    const s = st({ heroes: [hero(1, 'warrior', { atk: 1000 })], enemies: [foe(0, { hp: 10 }), foe(1, { hp: 10 })] });
    const { state } = step(s);
    // el golpe del héroe solo mata al principal; el segundo sigue
    expect(state.enemies[0].hp).toBeLessThanOrEqual(0);
    expect(state.enemies[1].hp).toBe(10);
    const r2 = step(state);
    expect(r2.result).toBe('victory');
    const last = r2.state.log[r2.state.log.length - 1];
    expect(last.enemies).toEqual([{ id: 'e0', hp: 0 }, { id: 'e1', hp: 0 }]);
    expect(last.enemyHp).toBe(0);
  });

  test('state con solo `enemy` equivale a enemies:[enemy]', () => {
    const a = st();
    const b = JSON.parse(JSON.stringify(a)); delete b.enemies;
    b.enemy = { hp: 500, maxHp: 500, dps: 10 };
    const ra = step(a).state; const rb = step(b).state;
    expect(rb.enemies.map((e) => e.hp)).toEqual(ra.enemies.map((e) => e.hp));
    expect(rb.heroes).toEqual(ra.heroes);
    expect(rb.enemy.hp).toBe(ra.enemy.hp);
  });
});

describe('eventos y contrato', () => {
  test('claves/tipos del contrato (eventsVersion 1)', () => {
    let s = st({ heroes: [hero(1, 'warrior', { energy: ENERGY_MAX, skill: { id: 'golpe', type: 'damage', mult: 2 } })],
      enemies: [foe(0, { hp: 90, maxHp: 90, dps: 200 })] });
    s.heroes[0].hp = 100;
    const out = step(s, { type: 'skill', slot: 1 });
    expect(out.state.eventsVersion).toBe(1);
    out.state.events.forEach((e, i) => {
      expect(e.t).toBe(i);
      expect(e.round).toBe(1);
      expect(['hit', 'skill', 'death', 'end']).toContain(e.kind);
      expect(e.actor === null || /^[he]\d+$/.test(e.actor)).toBe(true);
      expect(e.target === null || /^[he]\d+$/.test(e.target)).toBe(true);
      expect(['number', 'string']).toContain(typeof e.value);
    });
    const kinds = out.state.events.map((e) => e.kind);
    expect(kinds[0]).toBe('skill');
    expect(kinds[kinds.length - 1]).toBe('end');
    expect(out.state.events[0]).toMatchObject({ actor: 'h1', target: 'e0', kind: 'skill', value: 40, skillId: 'golpe', skillType: 'damage' });
    const hit = out.state.events.find((e) => e.kind === 'hit');
    expect(typeof hit.hp).toBe('number');
    expect(hit.hp).toBeGreaterThanOrEqual(0);
  });

  test('snapshot de una ronda completa', () => {
    const s = st({ heroes: [hero(1, 'warrior', { atk: 30, spd: 5 })], enemies: [foe(0, { hp: 100, maxHp: 100, dps: 8, spd: 3 })] });
    const { state } = step(s);
    expect(state.events).toEqual([
      { t: 0, round: 1, actor: 'h1', target: 'e0', kind: 'hit', value: 30, hp: 70 },
      { t: 1, round: 1, actor: 'e0', target: 'h1', kind: 'hit', value: 8, hp: 92 },
    ]);
    expect(state.log[0]).toEqual({
      round: 1, enemyHp: 70, heroes: [{ slot: 1, hp: 92, energy: 34, alive: true }], result: null,
      enemies: [{ id: 'e0', hp: 70 }], eventRange: [0, 2],
    });
  });

  test('escudo: skill con target null; los eventos son acumulativos entre rondas', () => {
    const s = st({ heroes: [hero(1, 'warrior', { energy: ENERGY_MAX, skill: { id: 'esc', type: 'shield', mult: 0.3 } })],
      enemies: [foe(0, { dps: 100 })] });
    const r1 = step(s, { type: 'skill', slot: 1 });
    expect(r1.state.events[0]).toMatchObject({ kind: 'skill', target: null, value: 0.3, skillType: 'shield' });
    expect(r1.state.heroes[0].hp).toBe(30);
    const n1 = r1.state.events.length;
    const r2 = step(r1.state);
    expect(r2.state.events.slice(0, n1)).toEqual(r1.state.events);
    expect(r2.state.log[1].eventRange[0]).toBe(n1);
    expect(r2.state.log[0].eventRange).toEqual([0, n1]);
  });

  test('muerte del enemigo por skill emite death y end(victory)', () => {
    const s = st({ heroes: [hero(1, 'warrior', { atk: 100, energy: ENERGY_MAX })], enemies: [foe(0, { hp: 150, maxHp: 150 })] });
    const { state, result } = step(s, { type: 'skill', slot: 1 });
    expect(result).toBe('victory');
    const ev = state.events;
    expect(ev.map((e) => e.kind)).toEqual(['skill', 'death', 'end']);
    expect(ev[2]).toMatchObject({ actor: null, target: null, value: 'victory' });
  });

  test('alias enemy tras cada ronda y log == último elemento (R-ND4b)', () => {
    let s = st({ enemies: [foe(0, { hp: 200, maxHp: 200 })] });
    for (let i = 0; i < 3; i++) {
      s = step(s).state;
      expect(s.enemy.hp).toBe(s.enemies[0].hp);
      expect(s.enemy.maxHp).toBe(200);
      expect(s.enemy.dps).toBe(10);
    }
    expect(s.log.map((l) => l.round)).toEqual([1, 2, 3]);
  });
});

describe('determinismo y serialización', () => {
  function play(s0, n = 10) {
    let s = s0;
    const picks = [];
    for (let i = 0; i < n; i++) {
      const h = s.heroes.find((x) => x.alive && x.energy >= ENERGY_MAX);
      const act = h ? { type: 'skill', slot: h.slot } : { type: 'advance' };
      picks.push(act.type);
      const out = step(s, act);
      s = out.state;
      if (out.result) break;
    }
    return { s, picks };
  }
  const mk = () => st({
    heroes: [hero(1, 'warrior', { hp: 300, maxHp: 300, def: 20, spd: 5 }), hero(2, 'mage', { hp: 200, maxHp: 200, atk: 35, spd: 8 })],
    enemies: [foe(0, { hp: 400, maxHp: 400, dps: 12, def: 10, spd: 6 }), foe(1, { hp: 300, maxHp: 300, dps: 9, spd: 2 })],
  });

  test('misma entrada → misma salida (10 rondas)', () => {
    const a = play(mk()); const b = play(mk());
    expect(a.s).toEqual(b.s);
    expect(a.s.log.length).toBeGreaterThanOrEqual(5);
  });

  test('state serializado a JSON y retomado da lo mismo que seguir en memoria', () => {
    let mem = mk(); let json = mk();
    for (let i = 0; i < 8; i++) {
      json = JSON.parse(JSON.stringify(json));
      const a = step(mem); const b = step(json);
      expect(b.state).toEqual(a.state);
      mem = a.state; json = b.state;
      if (a.result) break;
    }
  });

  test('F13 no consume azar: seed y rng no cambian; no muta el input', () => {
    const s = mk();
    const snap = JSON.stringify(s);
    const out = step(s).state;
    expect(JSON.stringify(s)).toBe(snap);
    expect(out.seed).toBe(7);
    expect(out.rng).toBe(7);
  });

  test('estado sin semilla (v1-like) usa seed 0 y no rompe', () => {
    const s = st(); delete s.seed; delete s.rng; delete s.events; delete s.eventsVersion; delete s.engine;
    const out = step(s).state;
    expect(out.seed).toBe(0);
    expect(out.rng).toBe(0);
    expect(out.eventsVersion).toBe(1);
  });
});
