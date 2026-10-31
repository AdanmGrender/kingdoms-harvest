// F14 T2 — effects.js: estados con duración (R26–R34), eventos status/dot/heal (R35), pureza (R38).
const fs = require('fs');
const path = require('path');
const fx = require('../src/services/combat/effects');

const hero = (slot, over = {}) => ({ slot, heroId: `h${slot}`, class: 'warrior', atk: 20, hp: 100, maxHp: 100, def: 0, alive: true, ...over });
const foe = (i, over = {}) => ({ id: `e${i}`, hp: 400, maxHp: 400, dps: 10, def: 0, ...over });
const mk = (over = {}) => ({ round: 0, isBoss: false, heroes: [hero(1)], enemies: [foe(0)], events: [], ...over });
function rec() {
  const ev = [];
  const emit = (actor, target, kind, value, extra) => { ev.push({ t: ev.length, round: 1, actor, target, kind, value, ...extra }); };
  return { ev, emit };
}

describe('R26 almacén de estados', () => {
  test('aplicar cada tipo crea la entrada con los campos exactos; serializa idéntico', () => {
    const s = mk();
    const types = ['stun', 'burn', 'poison', 'defDown', 'atkDown', 'immune'];
    types.forEach((type, i) => {
      s.heroes.push(hero(i + 2));
      expect(fx.applyStatus(s, `h${i + 2}`, { type, value: 0.1, dur: 2, src: 'e0' })).toEqual({ type, value: 0.1, dur: 2, src: 'e0' });
    });
    s.heroes.push(hero(9));
    expect(fx.applyStatus(s, 'h9', { type: 'shield', mode: 'pool', value: 30, dur: 1, src: 'h1' }))
      .toEqual({ type: 'shield', value: 30, dur: 1, src: 'h1', mode: 'pool' });
    expect(JSON.parse(JSON.stringify(s.fx))).toEqual(s.fx);
  });

  test('immune admite dur null; tipo desconocido y unidad muerta/inexistente no crean nada', () => {
    const s = mk();
    expect(fx.applyStatus(s, 'h1', { type: 'immune', value: 1, dur: null, src: null }).dur).toBeNull();
    const t = mk({ heroes: [hero(1, { alive: false })] });
    expect(fx.applyStatus(t, 'h1', { type: 'burn', value: 0.1, dur: 1, src: 'e0' })).toBeNull();
    expect(t.fx).toBeUndefined();
    expect(fx.applyStatus(t, 'zz', { type: 'burn', value: 0.1, dur: 1 })).toBeNull();
    expect(fx.applyStatus(s, 'h1', { type: 'inventado', value: 1, dur: 1 })).toBeNull();
    const e = mk({ enemies: [foe(0, { hp: 0 })] });
    expect(fx.applyStatus(e, 'e0', { type: 'burn', value: 0.1, dur: 1 })).toBeNull();
  });
});

describe('R28 refresco sin acumular', () => {
  test('misma fuente y tipo: una entrada, dur y value mayores', () => {
    const s = mk(); const { ev, emit } = rec();
    fx.applyStatus(s, 'e0', { type: 'atkDown', value: 0.05, dur: 2, src: 'h1' }, emit);
    fx.applyStatus(s, 'e0', { type: 'atkDown', value: 0.05, dur: 2, src: 'h1' }, emit);
    expect(s.fx.st.e0).toHaveLength(1);
    expect(s.fx.st.e0[0]).toMatchObject({ value: 0.05, dur: 2 });
    fx.applyStatus(s, 'e0', { type: 'atkDown', value: 0.20, dur: 1, src: 'h1' }, emit);
    expect(s.fx.st.e0[0]).toMatchObject({ value: 0.20, dur: 2 });
    expect(ev.map((e) => e.op)).toEqual(['apply', 'refresh', 'refresh']);
  });
  test('fuentes distintas conviven y suman (R31)', () => {
    const s = mk();
    fx.applyStatus(s, 'e0', { type: 'atkDown', value: 0.2, dur: 2, src: 'h1' });
    fx.applyStatus(s, 'e0', { type: 'atkDown', value: 0.05, dur: 2, src: 'h2' });
    expect(s.fx.st.e0).toHaveLength(2);
    expect(fx.statusSum(s, 'e0', 'atkDown')).toBeCloseTo(0.25, 10);
    expect(fx.statusSum(s, 'e0', 'defDown')).toBe(0);
    expect(fx.hasStatus(s, 'e0', 'atkDown')).toBe(true);
  });
});

describe('R27 duración por ronda', () => {
  test('dur 2 aplicado en la ronda 1: activo en 1 y 2, expira al fin de la 2; dur 1 solo esa ronda', () => {
    const s = mk(); const { ev, emit } = rec();
    fx.applyStatus(s, 'e0', { type: 'defDown', value: 0.5, dur: 2, src: 'h1' });
    fx.applyStatus(s, 'e0', { type: 'burn', value: 0.05, dur: 1, src: 'h1' });
    fx.roundEnd(s, emit); // fin ronda 1
    expect(fx.hasStatus(s, 'e0', 'defDown')).toBe(true);
    expect(fx.hasStatus(s, 'e0', 'burn')).toBe(false);
    fx.roundEnd(s, emit); // fin ronda 2
    expect(s.fx.st).toEqual({});
    expect(ev.filter((e) => e.op === 'expire').map((e) => e.status)).toEqual(['burn', 'defDown']);
  });
  test('stun e immune permanente no bajan por el paso de la ronda', () => {
    const s = mk();
    fx.applyStatus(s, 'e0', { type: 'stun', value: 1, dur: 1, src: 'h1' });
    fx.applyStatus(s, 'h1', { type: 'immune', value: 1, dur: null, src: null });
    fx.roundEnd(s); fx.roundEnd(s);
    expect(fx.hasStatus(s, 'e0', 'stun')).toBe(true);
    expect(fx.hasStatus(s, 'h1', 'immune')).toBe(true);
  });
  test('type desconocido (dato corrupto) se ignora y se retira sin lanzar', () => {
    const s = mk(); s.fx = { st: { e0: [{ type: 'raro', value: 1, dur: 3, src: null }] } };
    expect(fx.statusSum(s, 'e0', 'atkDown')).toBe(0);
    expect(() => fx.roundEnd(s)).not.toThrow();
    expect(s.fx.st).toEqual({});
  });
});

describe('R29 stun', () => {
  test('salta la acción una sola vez, emite skip y se retira; sin stun no hace nada', () => {
    const s = mk(); const { ev, emit } = rec();
    expect(fx.skipsAction(s, 'e0', emit)).toBe(false);
    fx.applyStatus(s, 'e0', { type: 'stun', value: 1, dur: 1, src: 'h1' });
    expect(fx.skipsAction(s, 'e0', emit)).toBe(true);
    expect(ev).toHaveLength(1);
    expect(ev[0]).toMatchObject({ kind: 'status', op: 'skip', status: 'stun', actor: 'h1', target: 'e0' });
    expect(fx.hasStatus(s, 'e0', 'stun')).toBe(false);
    expect(fx.skipsAction(s, 'e0', emit)).toBe(false);
  });
  test('dur 2 pierde dos acciones', () => {
    const s = mk();
    fx.applyStatus(s, 'e0', { type: 'stun', value: 1, dur: 2, src: 'h1' });
    expect([fx.skipsAction(s, 'e0'), fx.skipsAction(s, 'e0'), fx.skipsAction(s, 'e0')]).toEqual([true, true, false]);
  });
});

describe('R30 DoT', () => {
  test('burn 0.05 con maxHp 400 ⇒ −20 por ronda, evento dot', () => {
    const s = mk(); const { ev, emit } = rec();
    fx.applyStatus(s, 'e0', { type: 'burn', value: 0.05, dur: 2, src: 'h1' });
    expect(fx.dotTick(s, emit)).toBe(false);
    expect(s.enemies[0].hp).toBe(380);
    expect(ev[0]).toMatchObject({ kind: 'dot', status: 'burn', target: 'e0', value: 20, actor: 'h1' });
  });
  test('mínimo 1 de daño', () => {
    const s = mk({ enemies: [foe(0, { hp: 10, maxHp: 10 })] });
    fx.applyStatus(s, 'e0', { type: 'poison', value: 0.001, dur: 2, src: null });
    fx.dotTick(s);
    expect(s.enemies[0].hp).toBe(9);
  });
  test('héroe muerto por poison: alive false y death; enemigo muerto: death', () => {
    const s = mk({ heroes: [hero(1, { hp: 3, maxHp: 100 })], enemies: [foe(0, { hp: 5, maxHp: 400 })] });
    const { ev, emit } = rec();
    fx.applyStatus(s, 'h1', { type: 'poison', value: 0.05, dur: 2, src: 'e0' });
    fx.applyStatus(s, 'e0', { type: 'burn', value: 0.05, dur: 2, src: 'h1' });
    expect(fx.dotTick(s, emit)).toBe(true);
    expect(s.heroes[0]).toMatchObject({ hp: 0, alive: false });
    expect(s.enemies[0].hp).toBe(0);
    expect(ev.map((e) => `${e.kind}:${e.target}`)).toEqual(['dot:h1', 'death:h1', 'dot:e0', 'death:e0']);
    expect(ev[0].value).toBe(3); // no se reporta más HP del que tenía
  });
  test('sin fx no hace nada', () => {
    const s = mk();
    expect(fx.dotTick(s)).toBe(false);
    expect(s.fx).toBeUndefined();
  });
});

describe('R32 shield', () => {
  test('pct: round(dmg × (1 − value))', () => {
    const s = mk();
    fx.applyStatus(s, 'h1', { type: 'shield', mode: 'pct', value: 0.15, dur: 1, src: 'h2' });
    expect(fx.absorb(s, 'h1', 20)).toBe(17);
    expect(fx.absorb(s, 'h1', 0)).toBe(0);
  });
  test('pool 30 y golpe 50 ⇒ 20 y se retira con expire; pool 30 y golpe 10 ⇒ 0 y value 20', () => {
    const s = mk(); const { ev, emit } = rec();
    fx.applyStatus(s, 'h1', { type: 'shield', mode: 'pool', value: 30, dur: 3, src: 'h1' });
    expect(fx.absorb(s, 'h1', 10, emit)).toBe(0);
    expect(s.fx.st.h1[0].value).toBe(20);
    expect(fx.absorb(s, 'h1', 50, emit)).toBe(30);
    expect(fx.hasStatus(s, 'h1', 'shield')).toBe(false);
    expect(ev.at(-1)).toMatchObject({ kind: 'status', op: 'expire', status: 'shield' });
    expect(fx.absorb(s, 'h1', 7, emit)).toBe(7);
  });
});

describe('R33 inmunidad a control', () => {
  test('enemigo de nodo jefe: stun bloqueado con evento blocked; atkDown/defDown/DoT sí', () => {
    const s = mk({ isBoss: true }); const { ev, emit } = rec();
    expect(fx.applyStatus(s, 'e0', { type: 'stun', value: 1, dur: 1, src: 'h1' }, emit)).toBeNull();
    expect(ev[0]).toMatchObject({ kind: 'status', op: 'blocked', status: 'stun', target: 'e0' });
    expect(s.fx).toBeUndefined();
    expect(fx.applyStatus(s, 'e0', { type: 'atkDown', value: 0.2, dur: 2, src: 'h1' })).not.toBeNull();
    expect(fx.applyStatus(s, 'e0', { type: 'defDown', value: 0.2, dur: 2, src: 'h1' })).not.toBeNull();
    expect(fx.applyStatus(s, 'e0', { type: 'burn', value: 0.05, dur: 2, src: 'h1' })).not.toBeNull();
  });
  test('isBoss no inmuniza a héroes; isBoss false aturde; estado immune bloquea', () => {
    const boss = mk({ isBoss: true });
    expect(fx.applyStatus(boss, 'h1', { type: 'stun', value: 1, dur: 1, src: 'e0' })).not.toBeNull();
    const s = mk();
    expect(fx.applyStatus(s, 'e0', { type: 'stun', value: 1, dur: 1, src: 'h1' })).not.toBeNull();
    const t = mk();
    fx.applyStatus(t, 'e0', { type: 'immune', value: 1, dur: null, src: null });
    const { ev, emit } = rec();
    expect(fx.applyStatus(t, 'e0', { type: 'stun', value: 1, dur: 1, src: 'h1' }, emit)).toBeNull();
    expect(ev[0].op).toBe('blocked');
  });
});

describe('R34 muertos', () => {
  test('al fin de ronda se retiran las entradas de unidades muertas y desconocidas', () => {
    const s = mk(); fx.applyStatus(s, 'e0', { type: 'burn', value: 0.05, dur: 5, src: 'h1' });
    s.enemies[0].hp = 0;
    fx.roundEnd(s);
    expect(s.fx.st.e0).toBeUndefined();
    s.fx.st.zz = [{ type: 'burn', value: 1, dur: 1, src: null }];
    fx.roundEnd(s);
    expect(s.fx.st.zz).toBeUndefined();
    expect(fx.dotTick(s)).toBe(false);
  });
});

describe('heal y contrato de eventos (R35)', () => {
  test('heal topa en maxHp, emite {passiveId} y no cura a muertos', () => {
    const s = mk({ heroes: [hero(1, { hp: 98 })] }); const { ev, emit } = rec();
    const u = fx.findUnit(s, 'h1');
    expect(fx.heal(s, u, 8, 'seraph', emit)).toBe(2);
    expect(s.heroes[0].hp).toBe(100);
    expect(ev[0]).toEqual({ t: 0, round: 1, actor: 'h1', target: 'h1', kind: 'heal', value: 2, passiveId: 'seraph' });
    expect(fx.heal(s, u, 8, 'seraph', emit)).toBe(0);
    expect(ev).toHaveLength(1);
    s.heroes[0].alive = false; s.heroes[0].hp = 0;
    expect(fx.heal(s, u, 8, 'seraph', emit)).toBe(0);
  });
  test('status y dot: claves y tipos', () => {
    const s = mk(); const { ev, emit } = rec();
    fx.applyStatus(s, 'e0', { type: 'burn', value: 0.05, dur: 2, src: 'h1' }, emit);
    fx.dotTick(s, emit);
    const [a, d] = ev;
    expect(Object.keys(a).sort()).toEqual(['actor', 'dur', 'kind', 'op', 'round', 'status', 't', 'target', 'value']);
    expect(Object.keys(d).sort()).toEqual(['actor', 'kind', 'round', 'status', 't', 'target', 'value']);
    expect(typeof a.status).toBe('string');
    expect(typeof d.value).toBe('number');
  });
});

describe('R38 / R-ND7 pureza', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/services/combat/effects.js'), 'utf8');
  test('sin azar del sistema, DB ni fs', () => {
    expect(src).not.toMatch(/Math\.random/);
    expect(src).not.toMatch(/config\/database|require\(['"]fs['"]\)/);
    const reqs = [...src.matchAll(/require\(['"]([^'"]+)['"]\)/g)].map((m) => m[1]);
    expect(reqs).toEqual(['../../../../shared/gameConfig', './rng']);
  });
});
