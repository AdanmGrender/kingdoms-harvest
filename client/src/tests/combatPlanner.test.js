import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  planRound, createRoundQueue, eventsForRound, unitsFromState,
  ROUND_BUDGET_MS, MIN_FACTOR, KINDS, COLORS, STATUS_STYLE, PASSIVE_INTENSITY,
} from '../game/combat/eventPlanner';
import { QUALITY, resolveQuality, QUALITY_KEY } from '../game/combat/combatQuality';

const UNITS = new Set(['h1', 'h2', 'h3', 'e0', 'e1']);
const ctx = () => ({ units: UNITS, warn: vi.fn() });
let t0 = 0;
const ev = (kind, actor, target, value, extra = {}) => ({ t: t0++, round: 1, actor, target, kind, value, ...extra });
beforeEach(() => { t0 = 0; });

const FIXTURES = {
  hit: () => [ev('hit', 'h1', 'e0', 30, { hp: 70 })],
  skill: () => [ev('skill', 'h1', 'e0', 55, { skillId: 'x', skillType: 'damage' })],
  death: () => [ev('death', 'h1', 'e0', 0)],
  end: () => [ev('end', null, null, 'victory')],
  status: () => [ev('status', 'h1', 'e0', 1, { status: 'burn', op: 'apply', dur: 2 })],
  dot: () => [ev('dot', 'h1', 'e0', 6, { status: 'burn' })],
  heal: () => [ev('heal', 'h1', 'h1', 9, { passiveId: 'aria' })],
  passive: () => [ev('passive', 'h1', 'h1', 1, { passiveId: 'aria', fx: 'charge' })],
};

describe('R7: un beat por cada kind', () => {
  it('KINDS tiene los 8 kinds del contrato', () => {
    expect([...KINDS].sort()).toEqual(['death', 'dot', 'end', 'heal', 'hit', 'passive', 'skill', 'status']);
  });
  for (const kind of Object.keys(FIXTURES)) {
    it(`kind ${kind} → ≥ 1 beat con dur > 0`, () => {
      const r = planRound(FIXTURES[kind](), ctx());
      expect(r.beats.length).toBeGreaterThanOrEqual(1);
      expect(r.beats.some((b) => b.dur > 0)).toBe(true);
      expect(r.beats.every((b) => typeof b.srcT === 'number')).toBe(true);
    });
  }
});

describe('R3/R6: cifras = event.value; orden por t', () => {
  it('cada número planificado es el value del evento de origen', () => {
    const evs = [ev('hit', 'h1', 'e0', 31, { hp: 69 }), ev('dot', 'h1', 'e0', 7, { status: 'poison' }), ev('heal', 'h2', 'h2', 11)];
    const byT = new Map(evs.map((e) => [e.t, e]));
    const { beats } = planRound(evs, ctx());
    const nums = beats.filter((b) => b.num !== undefined);
    expect(nums.length).toBe(3);
    for (const b of nums) expect(b.num).toBe(byT.get(b.srcT).value);
  });
  it('fixture de 3 rondas: la secuencia de t por ronda coincide con el slice de eventRange', () => {
    const events = [];
    for (let i = 0; i < 9; i++) events.push({ t: i, round: Math.floor(i / 3) + 1, actor: 'h1', target: 'e0', kind: 'hit', value: 10 + i, hp: 90 - i });
    const rounds = [{ round: 1, eventRange: [0, 3] }, { round: 2, eventRange: [3, 6] }, { round: 3, eventRange: [6, 9] }];
    for (const r of rounds) {
      const slice = events.slice(r.eventRange[0], r.eventRange[1]);
      const got = eventsForRound({ events }, r);
      expect(got.map((e) => e.t)).toEqual(slice.map((e) => e.t));
      expect(planRound(got, ctx()).beats.map((b) => b.srcT)).toEqual(slice.map((e) => e.t));
    }
  });
  it('sin eventRange, filtra por round', () => {
    const events = [{ t: 0, round: 1 }, { t: 1, round: 2 }];
    expect(eventsForRound({ events }, { round: 2 }).map((e) => e.t)).toEqual([1]);
  });
  it('eventos desordenados se reproducen en orden de t', () => {
    const evs = [{ t: 5, kind: 'hit', actor: 'h1', target: 'e0', value: 1 }, { t: 2, kind: 'hit', actor: 'h1', target: 'e0', value: 2 }];
    expect(planRound(evs, ctx()).beats.map((b) => b.srcT)).toEqual([2, 5]);
  });
});

describe('R8: eventos malformados no lanzan', () => {
  it('kind desconocido, actor/objetivo inexistente, hit sin actor, null y campos extra', () => {
    const c = ctx();
    const evs = [
      { t: 0, kind: 'zzz' },
      { t: 1, kind: 'hit', actor: 'h9', target: 'e7', value: 3 },
      { t: 2, kind: 'hit', value: 5 },
      null,
      42,
      { t: 3, kind: 'hit', actor: 'h1', target: 'e0', value: 8, campoExtra: { a: 1 } },
      { t: 4, kind: 'hit', actor: 'h1', target: 'e0', value: 9 }, // sin hp
      { t: 5, kind: 'status', actor: 'h1', target: 'e0', status: 'nuevoTipo', op: 'apply' },
      { t: 6, kind: 'status', actor: 'h1', target: 'e0', status: 'burn', op: 'rarisima' },
    ];
    let r;
    expect(() => { r = planRound(evs, c); }).not.toThrow();
    expect(r.beats.map((b) => b.srcT)).toEqual([3, 4]);
    expect(c.warn).toHaveBeenCalled();
  });
  it('warn una vez por causa', () => {
    const c = ctx();
    planRound([{ t: 0, kind: 'zzz' }, { t: 1, kind: 'zzz' }, { t: 2, kind: 'zzz' }], c);
    expect(c.warn).toHaveBeenCalledTimes(1);
  });
  it('lista no-array, vacía o undefined', () => {
    expect(planRound(undefined, ctx()).beats).toEqual([]);
    expect(planRound([], ctx()).beats).toEqual([]);
    expect(planRound('x', ctx()).beats).toEqual([]);
  });
});

describe('R9: esquiva', () => {
  it('passive/dodge + hit value 0 → texto «Esquiva» y ningún número "0"', () => {
    const evs = [
      ev('passive', 'h1', 'e0', 0, { passiveId: 'aria', fx: 'dodge' }), // el defensor es el actor
      ev('hit', 'e0', 'h1', 0, { hp: 90 }),
    ];
    const { beats } = planRound(evs, ctx());
    expect(beats.some((b) => b.text === 'Esquiva')).toBe(true);
    expect(beats.some((b) => b.num === 0 || b.text === '0')).toBe(false);
  });
  it('hit value 0 sin dodge → sin número ni texto "0"', () => {
    const { beats } = planRound([ev('hit', 'e0', 'h1', 0, { hp: 90 })], ctx());
    expect(beats.length).toBe(1);
    expect(beats[0].num).toBeUndefined();
    expect(beats.some((b) => b.text === 'Esquiva')).toBe(false);
  });
});

describe('R10: shield / damage', () => {
  it('shield → scope squad sin targetId; damage y execute → targetId', () => {
    const sh = planRound([ev('skill', 'h1', null, 0.4, { skillType: 'shield', skillId: 's' })], ctx()).beats[0];
    expect(sh.scope).toBe('squad');
    expect(sh.targetId).toBeNull();
    for (const skillType of ['damage', 'execute']) {
      const b = planRound([ev('skill', 'h1', 'e1', 40, { skillType })], ctx()).beats[0];
      expect(b.targetId).toBe('e1');
      expect(b.scope).toBeUndefined();
    }
  });
});

describe('R11: death y end', () => {
  it('end es el último beat y posterior a todo death, aunque llegue antes en la lista', () => {
    const evs = [ev('hit', 'h1', 'e0', 50, { hp: 0 }), ev('death', 'h1', 'e0', 0), ev('end', null, null, 'victory')];
    const { beats } = planRound(evs, ctx());
    const end = beats[beats.length - 1];
    expect(end.kind).toBe('end');
    expect(end.result).toBe('victory');
    for (const b of beats.filter((x) => x.kind === 'death')) expect(end.at).toBeGreaterThanOrEqual(b.at + b.dur - 1e-6);
  });
  it('end recolocado al final aunque su t sea menor (orden del servidor roto)', () => {
    const evs = [{ t: 0, kind: 'end', value: 'defeat' }, { t: 1, kind: 'death', target: 'h1' }];
    const { beats } = planRound(evs, ctx());
    expect(beats[beats.length - 1].kind).toBe('end');
  });
});

describe('R12: status', () => {
  const st = (status, op) => planRound([ev('status', 'h1', 'e0', 1, { status, op, dur: 2 })], ctx()).beats[0];
  it('apply/refresh → marcador add; expire → remove; blocked → Inmune; skip → Aturdido', () => {
    for (const type of Object.keys(STATUS_STYLE).filter((k) => k !== 'immune')) {
      expect(st(type, 'apply').marker).toBe('add');
      expect(st(type, 'refresh').marker).toBe('add');
      expect(st(type, 'expire').marker).toBe('remove');
      expect(st(type, 'apply').color).toBe(STATUS_STYLE[type].color);
    }
    expect(st('stun', 'blocked').text).toBe('Inmune');
    expect(st('stun', 'skip').text).toBe('Aturdido');
  });
  it('los 7 tipos tienen color y etiqueta distintos', () => {
    const types = Object.keys(STATUS_STYLE);
    expect(types.sort()).toEqual(['atkDown', 'burn', 'defDown', 'immune', 'poison', 'shield', 'stun']);
    expect(new Set(Object.values(STATUS_STYLE).map((s) => s.color)).size).toBe(7);
    expect(new Set(Object.values(STATUS_STYLE).map((s) => s.label)).size).toBe(7);
  });
});

describe('R13: dot, heal, passive', () => {
  it('colores distintos entre hit, dot/burn, dot/poison y heal', () => {
    const hit = planRound([ev('hit', 'h1', 'e0', 5)], ctx()).beats[0].color;
    const burn = planRound([ev('dot', 'h1', 'e0', 5, { status: 'burn' })], ctx()).beats[0].color;
    const poison = planRound([ev('dot', 'h1', 'e0', 5, { status: 'poison' })], ctx()).beats[0].color;
    const heal = planRound([ev('heal', 'h1', 'h1', 5)], ctx()).beats[0].color;
    expect(new Set([hit, burn, poison, heal]).size).toBe(4);
  });
  it('passive/crit tiene intensity mayor que el hit y marca el hit siguiente como grande', () => {
    const evs = [ev('passive', 'h1', 'e0', 1.5, { fx: 'crit' }), ev('hit', 'h1', 'e0', 60, { hp: 40 })];
    const { beats } = planRound(evs, ctx());
    const crit = beats.find((b) => b.kind === 'passive');
    const hit = beats.find((b) => b.kind === 'hit');
    expect(crit.intensity).toBeGreaterThan(planRound([ev('hit', 'h1', 'e0', 60)], ctx()).beats[0].intensity);
    expect(hit.num).toBe(60);
    expect(hit.color).toBe(COLORS.crit);
  });
  it('fx charge, extraHit y dodge producen señal propia', () => {
    for (const fx of ['charge', 'extraHit', 'dodge']) {
      const b = planRound([ev('passive', 'h1', 'e0', 1, { fx })], ctx()).beats[0];
      expect(b.fx).toBe(fx);
      expect(b.dur).toBeGreaterThan(0);
    }
    expect(PASSIVE_INTENSITY.crit).toBeGreaterThan(PASSIVE_INTENSITY.extraHit);
  });
});

describe('R16: presupuesto de tiempo', () => {
  const many = (n) => {
    t0 = 0;
    const out = [];
    for (let i = 0; i < n; i++) out.push(ev(i % 2 ? 'hit' : 'skill', i % 3 ? 'h1' : 'h2', 'e0', 5, { hp: 10, skillType: 'damage' }));
    return out;
  };
  for (const n of [4, 12, 40]) {
    it(`${n} eventos → duración ≤ ${ROUND_BUDGET_MS} ms y factor ≥ ${MIN_FACTOR}`, () => {
      const r = planRound(many(n), ctx());
      expect(r.duration).toBeLessThanOrEqual(ROUND_BUDGET_MS + 1e-6);
      expect(r.factor).toBeGreaterThanOrEqual(MIN_FACTOR);
      expect(r.beats.every((b) => b.dur > 0)).toBe(true);
    });
  }
  it('2 eventos → factor 1', () => {
    const r = planRound([ev('hit', 'h1', 'e0', 5), ev('hit', 'e0', 'h1', 5)], ctx());
    expect(r.factor).toBe(1);
    expect(r.squeezed).toBe(false);
  });
  it('40 eventos comprimen (factor < 1) y el end sigue siendo último', () => {
    const evs = [...many(40), ev('end', null, null, 'victory')];
    const r = planRound(evs, ctx());
    expect(r.factor).toBeLessThan(1);
    expect(r.beats[r.beats.length - 1].kind).toBe('end');
    expect(r.duration).toBeLessThanOrEqual(ROUND_BUDGET_MS + 1e-6);
  });
});

describe('R14/R15/R18: cola', () => {
  const round = (from, n) => Array.from({ length: n }, (_, i) => ({ t: from + i, round: 1, actor: 'h1', target: 'e0', kind: 'hit', value: 10, hp: 50 }));
  const state = {
    heroes: [{ slot: 1, hp: 80, maxHp: 100, alive: true }, { slot: 2, hp: 0, maxHp: 90, alive: false }],
    enemies: [{ id: 'e0', hp: 40, maxHp: 100 }], fx: { st: { h1: [{ type: 'shield', value: 0.3 }] } },
  };

  it('R14: la misma ronda dos veces → 0 beats la segunda', () => {
    const q = createRoundQueue({ warn: vi.fn() });
    const evs = round(0, 3);
    expect(q.enqueueRound(evs, { units: UNITS }).beats.length).toBe(3);
    expect(q.lastT).toBe(2);
    expect(q.enqueueRound(evs, { units: UNITS }).beats.length).toBe(0);
    expect(q.enqueueRound(round(3, 2), { units: UNITS }).beats.length).toBe(2);
    expect(q.lastT).toBe(4);
  });

  it('R15: con un hit omitido, reconcile deja las barras iguales al state', () => {
    const q = createRoundQueue({ warn: vi.fn() });
    q.setUnits({ heroes: [{ slot: 1, hp: 100, maxHp: 100 }, { slot: 2, hp: 90, maxHp: 90 }], enemies: [{ id: 'e0', hp: 100, maxHp: 100 }] });
    q.enqueueRound([{ t: 0, round: 1, actor: 'h1', target: 'e0', kind: 'hit', value: 30, hp: 70 }], { units: UNITS });
    q.tick(3000);
    expect(q.view.e0.hp).toBe(70); // falta el segundo golpe (hp 40)
    const v = q.reconcile(state);
    expect(v.e0.hp).toBe(40);
    expect(v.h1).toMatchObject({ hp: 80, alive: true, shield: 0.3 });
    expect(v.h2).toMatchObject({ hp: 0, alive: false });
    expect(v).toEqual(unitsFromState(state));
  });

  it('tick entrega los beats en orden y deja la cola ociosa', () => {
    const q = createRoundQueue({ warn: vi.fn() });
    q.enqueueRound(round(0, 3), { units: UNITS });
    expect(q.isIdle()).toBe(false);
    const got = [];
    for (let i = 0; i < 400 && !q.isIdle(); i++) got.push(...q.tick(16));
    expect(got.map((b) => b.srcT)).toEqual([0, 1, 2]);
    expect(q.isIdle()).toBe(true);
  });

  it('R18: skip() deja la ronda en curso en ≤ 300 ms', () => {
    const q = createRoundQueue({ warn: vi.fn() });
    q.enqueueRound(round(0, 12), { units: UNITS });
    q.tick(100);
    const before = q.remaining();
    expect(before).toBeGreaterThan(300);
    q.skip();
    expect(q.factor).toBe(0.1);
    expect(q.remaining()).toBeLessThanOrEqual(300 + 1e-6);
    const got = q.tick(300);
    expect(q.isIdle()).toBe(true);
    expect(got.length).toBeGreaterThan(0);
  });

  it('R15: un death deja la unidad caída en la vista aunque falte el estado', () => {
    const q = createRoundQueue({ warn: vi.fn() });
    q.setUnits(state);
    q.enqueueRound([{ t: 0, round: 1, actor: 'h1', target: 'e0', kind: 'death', value: 0 }], { units: UNITS });
    q.tick(1000);
    expect(q.view.e0).toMatchObject({ hp: 0, alive: false });
  });
});

describe('R46/R47: calidad', () => {
  it('low no usa postFX ni luces ni bloom; tabla de 3 niveles', () => {
    expect(Object.keys(QUALITY)).toEqual(['low', 'medium', 'high']);
    expect(QUALITY.low).toMatchObject({ postFX: false, lights: 0, bloom: false });
    expect(QUALITY.medium.lights).toBeGreaterThan(0);
    expect(QUALITY.high.maxParticles).toBeGreaterThan(QUALITY.medium.maxParticles);
  });
  it('resolveQuality: null, inválido, low, high y storage que lanza', () => {
    const st = (v) => ({ getItem: (k) => (k === QUALITY_KEY ? v : null) });
    expect(resolveQuality(st(null)).name).toBe('medium');
    expect(resolveQuality(st('zzz')).name).toBe('medium');
    expect(resolveQuality(st('low')).name).toBe('low');
    expect(resolveQuality(st('high')).name).toBe('high');
    expect(resolveQuality(st('__proto__')).name).toBe('medium');
    expect(resolveQuality({ getItem() { throw new Error('denegado'); } }).name).toBe('medium');
  });
  it('sin argumento usa localStorage', () => {
    localStorage.setItem(QUALITY_KEY, 'low');
    expect(resolveQuality().name).toBe('low');
    localStorage.removeItem(QUALITY_KEY);
    expect(resolveQuality().name).toBe('medium');
  });
});
