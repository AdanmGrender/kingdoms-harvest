import { describe, it, expect, vi, beforeEach } from 'vitest';
import { deriveEvents } from '../game/combat/v1Adapter';
import { selectEventSource, eventsForStep, _resetWarnings } from '../game/combat/eventSource';
import { planRound } from '../game/combat/eventPlanner';

const UNITS = new Set(['h1', 'h2', 'h3', 'e0']);
const hero = (slot, hp, extra = {}) => ({ slot, hp, maxHp: 100, alive: hp > 0, ...extra });
const v1 = (round, enemyHp, heroes) => ({ round, enemy: { hp: enemyHp, maxHp: 100 }, heroes });

beforeEach(() => _resetWarnings());

describe('R20: adaptador v1', () => {
  const s0 = v1(0, 40, [hero(1, 100), hero(2, 100)]);
  const s1 = v1(1, 0, [hero(1, 100), hero(2, 85)]);

  it('enemigo -40 muerto + héroe slot 2 -15 → hit(e0), hit(h2), death, end, todos synthetic y t crecientes', () => {
    const evs = deriveEvents(s0, s1, { round: 1, result: 'victory' });
    expect(evs.map((e) => [e.kind, e.target])).toEqual([['hit', 'e0'], ['hit', 'h2'], ['death', 'e0'], ['end', null]]);
    expect(evs[0]).toMatchObject({ actor: 'h1', value: 40, hp: 0 });
    expect(evs[1]).toMatchObject({ actor: 'e0', value: 15, hp: 85 });
    expect(evs[3].value).toBe('victory');
    expect(evs.every((e) => e.synthetic === true)).toBe(true);
    const ts = evs.map((e) => e.t);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
    expect(new Set(ts).size).toBe(ts.length);
  });

  it('planRound acepta los eventos sin cambios y conserva synthetic', () => {
    const evs = deriveEvents(s0, s1, { round: 1, result: 'victory' });
    const warn = vi.fn();
    const { beats } = planRound(evs, { units: UNITS, warn });
    expect(warn).not.toHaveBeenCalled();
    expect(beats.map((b) => b.kind)).toEqual(['hit', 'hit', 'death', 'end']);
    expect(beats.every((b) => b.synthetic === true)).toBe(true);
    expect(beats.find((b) => b.targetId === 'h2').num).toBe(15);
  });

  it('dos rondas consecutivas: las t no se repiten y la cola no descarta la segunda', () => {
    const a = deriveEvents(v1(0, 100, [hero(1, 100)]), v1(1, 70, [hero(1, 90)]), { round: 1 });
    const b = deriveEvents(v1(1, 70, [hero(1, 90)]), v1(2, 30, [hero(1, 90)]), { round: 2 });
    expect(Math.max(...a.map((e) => e.t))).toBeLessThan(Math.min(...b.map((e) => e.t)));
  });

  it('héroe que cae → hit + death del héroe; defeat → end defeat', () => {
    const evs = deriveEvents(v1(0, 50, [hero(1, 20)]), v1(1, 50, [hero(1, 0)]), { round: 1, result: 'defeat' });
    expect(evs.map((e) => [e.kind, e.target])).toEqual([['hit', 'h1'], ['death', 'h1'], ['end', null]]);
    expect(evs[2].value).toBe('defeat');
  });

  it('skill pedida: primer evento skill sintético del slot; tipo desconocido → damage', () => {
    const p = v1(0, 100, [hero(1, 100, { skill: { type: 'rara' } }), hero(2, 100, { skill: { type: 'shield' } })]);
    const n = v1(1, 60, [hero(1, 100, { skill: { type: 'rara' } }), hero(2, 100, { skill: { type: 'shield' } })]);
    const a = deriveEvents(p, n, { round: 1 }, { action: { type: 'skill', slot: 1 } });
    expect(a[0]).toMatchObject({ kind: 'skill', actor: 'h1', target: 'e0', skillType: 'damage', synthetic: true });
    const b = deriveEvents(p, n, { round: 1 }, { action: { type: 'skill', slot: 2 } });
    expect(b[0]).toMatchObject({ kind: 'skill', actor: 'h2', target: null, skillType: 'shield' });
    const beat = planRound(b, { units: UNITS, warn: vi.fn() }).beats[0];
    expect(beat.scope).toBe('squad');
  });

  it('sin estado previo o sin cambios no inventa golpes', () => {
    expect(deriveEvents(null, s0, { round: 0 })).toEqual([]);
    expect(deriveEvents(s0, s0, { round: 1 })).toEqual([]);
    expect(deriveEvents(undefined, undefined, undefined)).toEqual([]);
  });

  it('estado con enemies[] (grupo) deriva un hit por enemigo', () => {
    const p = { round: 0, heroes: [hero(1, 100)], enemies: [{ id: 'e0', hp: 50 }, { id: 'e1', hp: 50 }] };
    const n = { round: 1, heroes: [hero(1, 100)], enemies: [{ id: 'e0', hp: 30 }, { id: 'e1', hp: 0 }] };
    const evs = deriveEvents(p, n, { round: 1 });
    expect(evs.map((e) => [e.kind, e.target, e.value])).toEqual([['hit', 'e0', 20], ['hit', 'e1', 50], ['death', 'e1', 0]]);
  });
});

describe('R23: sin señales de F14 en v1', () => {
  it('ningún beat status/dot/heal/passive para una secuencia v1', () => {
    let prev = v1(0, 300, [hero(1, 100), hero(2, 100), hero(3, 100)]);
    const kinds = new Set();
    for (let r = 1; r <= 6; r++) {
      const state = v1(r, 300 - r * 60, [hero(1, 100 - r * 10), hero(2, 100 - r * 5), hero(3, r === 6 ? 0 : 100)]);
      const evs = deriveEvents(prev, state, { round: r, result: r === 6 ? 'defeat' : null }, r === 3 ? { action: { type: 'skill', slot: 2 } } : {});
      for (const b of planRound(evs, { units: UNITS, warn: vi.fn() }).beats) kinds.add(b.kind);
      for (const e of evs) kinds.add(`ev:${e.kind}`);
      prev = state;
    }
    for (const k of ['status', 'dot', 'heal', 'passive', 'ev:status', 'ev:dot', 'ev:heal', 'ev:passive']) expect(kinds.has(k)).toBe(false);
    expect(kinds.has('hit')).toBe(true);
  });
});

describe('R21/R22: selectEventSource', () => {
  const evState = { events: [], eventsVersion: 1 };
  it('estado v2 → events; estado v1 → adapter', () => {
    const warn = vi.fn();
    expect(selectEventSource(evState, null, warn)).toBe('events');
    expect(selectEventSource({ round: 1 }, null, warn)).toBe('adapter');
    expect(selectEventSource(null, null, warn)).toBe('adapter');
    expect(warn).not.toHaveBeenCalled();
  });
  it('eventsVersion distinto de 1 → adapter con un único warn y sin lanzar', () => {
    const warn = vi.fn();
    expect(selectEventSource({ events: [], eventsVersion: 2 }, null, warn)).toBe('adapter');
    expect(selectEventSource({ events: [], eventsVersion: 2 }, null, warn)).toBe('adapter');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(selectEventSource({ events: [] }, null, warn)).toBe('adapter'); // versión ausente
    expect(warn).toHaveBeenCalledTimes(2);
  });
  it('eventsForStep: v2 usa el slice de eventRange; v1 deriva', () => {
    const events = [{ t: 0 }, { t: 1 }, { t: 2 }, { t: 3 }];
    const r = eventsForStep({ prev: null, state: { events, eventsVersion: 1 }, roundLog: { eventRange: [1, 3] } });
    expect(r.source).toBe('events');
    expect(r.events.map((e) => e.t)).toEqual([1, 2]);
    const a = eventsForStep({ prev: v1(0, 100, [hero(1, 100)]), state: v1(1, 80, [hero(1, 100)]), roundLog: { round: 1 }, warn: vi.fn() });
    expect(a.source).toBe('adapter');
    expect(a.events[0].synthetic).toBe(true);
  });
  it('eventsVersion 2 con eventos: eventsForStep degrada al adaptador sin lanzar', () => {
    const warn = vi.fn();
    const r = eventsForStep({ prev: v1(0, 100, [hero(1, 100)]), state: { ...v1(1, 80, [hero(1, 100)]), events: [{ t: 0 }], eventsVersion: 2 }, roundLog: { round: 1 }, warn });
    expect(r.source).toBe('adapter');
    expect(r.events.length).toBe(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });
});
