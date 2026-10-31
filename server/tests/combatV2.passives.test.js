// F14 T3–T8 — comportamiento de las 18 pasivas dentro de simulateRoundV2 + determinismo y compat.
const { COMBAT, COMBAT_FX, HERO_PASSIVE_FX, HEROES, CAMPAIGN } = require('../../shared/gameConfig');
const { ENERGY_MAX, ENERGY_PER_ROUND } = require('../src/services/campaignSim');
const { simulateRoundV2 } = require('../src/services/combat/engine');
const { mitigate } = require('../src/services/combat/damage');
const { nextFloat } = require('../src/services/combat/rng');

const K = COMBAT.defK;
const hero = (slot, heroId, over = {}) => ({
  slot, heroId, class: 'warrior', name: `H${slot}`, atk: 100, hp: 1000, maxHp: 1000,
  energy: 0, energyMax: ENERGY_MAX, skill: { id: 'golpe', type: 'damage', mult: 2 }, alive: true,
  def: 0, spd: 0, ...over,
});
const foe = (i, over = {}) => ({ id: `e${i}`, hp: 100000, maxHp: 100000, dps: 0, def: 0, spd: 0, ...over });
function mk(over = {}) {
  const enemies = over.enemies || [foe(0)];
  return {
    engine: 2, seed: 7, rng: 7, events: [], eventsVersion: 1, round: 0, maxRounds: 50, isBoss: false,
    shield: 0, heroes: [hero(1, null)], log: [], ...over, enemies,
    enemy: { hp: enemies[0].hp, maxHp: enemies[0].maxHp, dps: enemies[0].dps },
  };
}
const step = (s, a = { type: 'advance' }) => simulateRoundV2(s, a).state;
const evs = (s) => s.events.slice(...s.log[s.log.length - 1].eventRange);
const heroHit = (s, actor = 'h1') => evs(s).filter((e) => e.kind === 'hit' && e.actor === actor);
const enemyDmg = (s) => 100000 - s.enemies[0].hp;
const passive = (s, fx) => evs(s).filter((e) => e.kind === 'passive' && (!fx || e.fx === fx));

// Busca un `state.rng` cuya secuencia de floats cumpla los predicados ('lt:x' / 'ge:x').
function rngFor(...conds) {
  for (let v = 1; v < 200000; v++) {
    let st = v; let ok = true;
    for (const c of conds) {
      const r = nextFloat(st); st = r.rng;
      const [op, x] = c.split(':'); const t = Number(x);
      if (op === 'lt' ? !(r.value < t) : !(r.value >= t)) { ok = false; break; }
    }
    if (ok) return v;
  }
  throw new Error('sin semilla para ' + conds.join(','));
}

describe('tanda 1 — modificadores de ATK/DEF', () => {
  test('aria: +15% con ventaja numérica (2 vs 1), sin bono 1 vs 1 (R8)', () => {
    const ventaja = step(mk({ heroes: [hero(1, 'aria'), hero(2, null)] }));
    expect(heroHit(ventaja)[0].value).toBe(mitigate(100 * 1.15, 0, K));
    const igual = step(mk({ heroes: [hero(1, 'aria')] }));
    expect(heroHit(igual)[0].value).toBe(100);
    expect(passive(ventaja)).toHaveLength(0); // R36: modificador permanente sin evento
  });

  test('aria cuenta héroes vivos: con el aliado muerto no hay ventaja', () => {
    const s = step(mk({ heroes: [hero(1, 'aria'), hero(2, null, { alive: false, hp: 0 })] }));
    expect(heroHit(s)[0].value).toBe(100);
  });

  test('thorin: DEF +30% bajo 50% HP, bordes 50/100 y 49/100 (R9, R7)', () => {
    const run = (hp) => step(mk({
      heroes: [hero(1, 'thorin', { hp, maxHp: 1000, def: 20 })], enemies: [foe(0, { dps: 100 })],
    }));
    const dmg = (s) => evs(s).filter((e) => e.actor === 'e0' && e.kind === 'hit')[0].value;
    expect(dmg(run(500))).toBe(mitigate(100, 20, K));
    expect(dmg(run(499))).toBe(mitigate(100, 26, K));
  });

  test('finn: +20% contra range ranged; melee o sin range sin bono (R12)', () => {
    const r = step(mk({ heroes: [hero(1, 'finn')], enemies: [foe(0, { range: 'ranged' })] }));
    const m = step(mk({ heroes: [hero(1, 'finn')], enemies: [foe(0, { range: 'melee' })] }));
    const n = step(mk({ heroes: [hero(1, 'finn')] }));
    expect(heroHit(r)[0].value).toBe(120);
    expect(heroHit(m)[0].value).toBe(100);
    expect(heroHit(n)[0].value).toBe(100);
  });

  test('viktor: aliados adyacentes +10% DEF; no el propio, no a distancia 2, no si muerto (R14)', () => {
    const base = (viktorAlive) => [
      hero(1, null, { def: 20, class: 'mage' }), hero(2, 'viktor', { alive: viktorAlive, hp: viktorAlive ? 1000 : 0, class: 'mage' }),
      hero(3, null, { def: 20, class: 'mage' }), hero(4, null, { def: 20, class: 'mage' }),
    ];
    const hitOn = (s, target) => evs(s).filter((e) => e.actor === 'e0' && e.target === target && e.kind === 'hit')[0].value;
    // el enemigo golpea siempre al de más amenaza/menor slot: pongo clases para elegir el objetivo
    const probe = (slot, viktorAlive = true) => {
      const hs = base(viktorAlive).map((h) => ({ ...h, class: h.slot === slot ? 'warrior' : 'mage' }));
      hs[1] = { ...hs[1], def: 20 };
      return step(mk({ heroes: hs, enemies: [foe(0, { dps: 100 })] }));
    };
    expect(hitOn(probe(1), 'h1')).toBe(mitigate(100, 22, K));
    expect(hitOn(probe(3), 'h3')).toBe(mitigate(100, 22, K));
    expect(hitOn(probe(4), 'h4')).toBe(mitigate(100, 20, K));
    expect(hitOn(probe(2), 'h2')).toBe(mitigate(100, 20, K));
    expect(hitOn(probe(1, false), 'h1')).toBe(mitigate(100, 20, K));
  });

  test('varok: +25% solo en la ronda 1 (R18)', () => {
    let s = step(mk({ heroes: [hero(1, 'varok')] }));
    expect(heroHit(s)[0].value).toBe(125);
    s = step(s);
    expect(heroHit(s)[0].value).toBe(100);
  });

  test('fenn: +8% por ronda hasta +40% (R21)', () => {
    let s = mk({ heroes: [hero(1, 'fenn')] });
    const dmgs = [];
    for (let i = 0; i < 6; i++) { s = step(s); dmgs.push(heroHit(s)[0].value); }
    expect(dmgs).toEqual([108, 116, 124, 132, 140, 140]);
  });

  test('aditivo entre ATK y multiplicativo con shadow (R6): aria+varok ronda 1 ⇒ ×1.40, +shadow ×1.40', () => {
    const s = step(mk({ heroes: [hero(1, 'aria'), hero(2, 'varok')] }));
    expect(heroHit(s, 'h1')[0].value).toBe(115);
    expect(heroHit(s, 'h2')[0].value).toBe(125);
    const solo = step(mk({ heroes: [hero(1, 'shadow'), hero(2, 'varok'), hero(3, 'aria', { class: 'mage' })] }));
    expect(heroHit(solo, 'h1')[0].value).toBe(140);
  });
});

describe('tanda 2 — daño y objetivo', () => {
  test('lyra: ignora 10% DEF solo con habilidad (R10)', () => {
    const base = { heroes: [hero(1, 'lyra', { energy: ENERGY_MAX })], enemies: [foe(0, { def: 100 })] };
    const sk = step(mk(base), { type: 'skill', slot: 1 });
    const skillEv = evs(sk).find((e) => e.kind === 'skill');
    expect(skillEv.value).toBe(mitigate(200, 90, K));
    expect(heroHit(sk)[0].value).toBe(mitigate(100, 100, K)); // golpe normal: sin bono
    const nodef = step(mk({ heroes: [hero(1, 'lyra', { energy: ENERGY_MAX })] }), { type: 'skill', slot: 1 });
    expect(evs(nodef).find((e) => e.kind === 'skill').value).toBe(200); // def 0: nulo
  });

  test('shadow: primer ataque ×1.40, luego ×1.0, también tras serializar (R16, R16b)', () => {
    let s = step(mk({ heroes: [hero(1, 'shadow')] }));
    expect(heroHit(s)[0].value).toBe(140);
    expect(s.fx.used).toEqual({ h1: true });
    s = JSON.parse(JSON.stringify(s));
    s = step(s);
    expect(heroHit(s)[0].value).toBe(100);
    s = step(JSON.parse(JSON.stringify(s)));
    expect(heroHit(s)[0].value).toBe(100);
  });

  test('shadow: si el primer acto es una habilidad, esa gasta el bono', () => {
    let s = step(mk({ heroes: [hero(1, 'shadow', { energy: ENERGY_MAX })] }), { type: 'skill', slot: 1 });
    expect(evs(s).find((e) => e.kind === 'skill').value).toBe(280);
    expect(heroHit(s)[0].value).toBe(100);
  });

  test('kryx: carga en rondas 3 y 6, máx. 1, la descarga hace ×1.6 y consume (R22, R22b)', () => {
    let s = mk({ heroes: [hero(1, 'kryx')] });
    s = step(s); s = step(s);
    expect(s.fx).toBeUndefined();
    s = step(s); // ronda 3
    expect(s.fx.charge).toEqual({ h1: true });
    expect(passive(s, 'charge')).toHaveLength(1);
    s = step(s); s = step(s); s = step(s); // ronda 6: ya cargada, no se acumula ni re-emite
    expect(s.fx.charge).toEqual({ h1: true });
    expect(passive(s, 'charge')).toHaveLength(0);
    s.heroes[0].energy = ENERGY_MAX;
    const t = step(s, { type: 'skill', slot: 1 });
    expect(evs(t).find((e) => e.kind === 'skill').value).toBe(320);
    expect(passive(t, 'discharge')).toHaveLength(1);
    expect(t.fx.charge).toEqual({});
    t.heroes[0].energy = ENERGY_MAX;
    const u = step(t, { type: 'skill', slot: 1 });
    expect(evs(u).find((e) => e.kind === 'skill').value).toBe(200);
  });

  test('kryx: el golpe normal no gasta la carga', () => {
    let s = mk({ heroes: [hero(1, 'kryx')], round: 2 });
    s = step(s); // ronda 3
    expect(heroHit(s)[0].value).toBe(100);
    expect(s.fx.charge).toEqual({ h1: true });
  });

  test('nyx: ejecuta bajo 15% (14/100 muere con daño 1), 15/100 no; jefe no se ejecuta (R25)', () => {
    const run = (hp, over = {}) => step(mk({
      heroes: [hero(1, 'nyx', { atk: 1 })], enemies: [foe(0, { hp, maxHp: 100 })], ...over,
    }));
    const a = run(14);
    expect(a.enemies[0].hp).toBe(0);
    expect(passive(a, 'execute')).toHaveLength(1);
    expect(evs(a).some((e) => e.kind === 'death' && e.target === 'e0')).toBe(true);
    const b = run(15);
    expect(b.enemies[0].hp).toBeGreaterThan(0);
    expect(passive(b, 'execute')).toHaveLength(0);
    const j = run(14, { isBoss: true });
    expect(j.enemies[0].hp).toBeGreaterThan(0);
    expect(passive(j, 'execute')).toHaveLength(0);
  });

  test('nyx: ×1.5 a objetivos heridos, ×1.0 a sanos, jefe herido también ×1.5 (R25b)', () => {
    const run = (hp, over = {}) => step(mk({
      heroes: [hero(1, 'nyx')], enemies: [foe(0, { hp, maxHp: 100000 })], ...over,
    }));
    expect(heroHit(run(15000))[0].value).toBe(150);
    expect(heroHit(run(100000))[0].value).toBe(100);
    expect(heroHit(run(15000, { isBoss: true }))[0].value).toBe(150);
  });
});

describe('tanda 3 — curación y escudo', () => {
  test('seraph: +8% maxHp por ronda con tope (R15)', () => {
    let s = step(mk({ heroes: [hero(1, 'seraph', { hp: 50, maxHp: 100 })] }));
    expect(s.heroes[0].hp).toBe(58);
    const h = evs(s).filter((e) => e.kind === 'heal');
    expect(h).toHaveLength(1);
    expect(h[0]).toMatchObject({ actor: 'h1', target: 'h1', value: 8, passiveId: 'seraph' });
    const t = step(mk({ heroes: [hero(1, 'seraph', { hp: 98, maxHp: 100 })] }));
    expect(t.heroes[0].hp).toBe(100);
    expect(evs(t).find((e) => e.kind === 'heal').value).toBe(2);
    const full = step(mk({ heroes: [hero(1, 'seraph')] }));
    expect(evs(full).some((e) => e.kind === 'heal')).toBe(false);
  });

  test('morghal: regenera 5% por ronda (R19)', () => {
    let s = mk({ heroes: [hero(1, 'morghal', { hp: 40, maxHp: 100 })] });
    s = step(s); expect(s.heroes[0].hp).toBe(45);
    s = step(s); expect(s.heroes[0].hp).toBe(50);
    expect(evs(s).find((e) => e.kind === 'heal')).toMatchObject({ value: 5, passiveId: 'morghal' });
  });

  test('serafina: shield pct 0.15 a cada héroe vivo, dura 1 ronda; reduce el golpe (R23, R23b)', () => {
    const s = step(mk({
      heroes: [hero(1, 'serafina'), hero(2, null, { class: 'mage' })], enemies: [foe(0, { dps: 100 })],
    }));
    const apply = evs(s).filter((e) => e.kind === 'status' && e.op === 'apply');
    expect(apply.map((e) => [e.target, e.status, e.value, e.dur])).toEqual([['h1', 'shield', 0.15, 1], ['h2', 'shield', 0.15, 1]]);
    expect(evs(s).find((e) => e.kind === 'hit' && e.actor === 'e0').value).toBe(85);
    expect(evs(s).filter((e) => e.op === 'expire')).toHaveLength(2);
    expect(s.fx.st).toEqual({}); // expiró al fin de la ronda; se reaplica al inicio de la siguiente
  });

  test('serafina muerta ⇒ nadie recibe escudo; s.shield del paladín convive (R23b)', () => {
    const muerta = step(mk({ heroes: [hero(1, 'serafina', { alive: false, hp: 0 }), hero(2, null)], enemies: [foe(0, { dps: 100 })] }));
    expect(evs(muerta).some((e) => e.kind === 'status')).toBe(false);
    const both = step(mk({
      heroes: [hero(1, 'serafina'), hero(2, 'zz', { class: 'paladin', energy: ENERGY_MAX, skill: { id: 'm', type: 'shield', mult: 0.5 } })],
      enemies: [foe(0, { dps: 200 })],
    }), { type: 'skill', slot: 2 });
    // primero s.shield sobre el dps (200×0.5=100), luego el estado: round(100×0.85)
    expect(evs(both).find((e) => e.kind === 'hit' && e.actor === 'e0').value).toBe(85);
  });
});

describe('tanda 4 — azar y estados aplicados', () => {
  test('zara: atkDown 0.20 dur 2 al objetivo, baja el dps 20% y expira (R11)', () => {
    let s = step(mk({ heroes: [hero(1, 'zara')], enemies: [foe(0, { dps: 100 })] }));
    expect(evs(s).find((e) => e.kind === 'status')).toMatchObject({ op: 'apply', status: 'atkDown', target: 'e0', actor: 'h1', value: 0.2, dur: 2 });
    expect(evs(s).find((e) => e.actor === 'e0' && e.kind === 'hit').value).toBe(80); // el héroe actúa antes: ya aplicó
    s = step(s);
    expect(evs(s).find((e) => e.actor === 'e0' && e.kind === 'hit').value).toBe(80);
    expect(s.fx.st.e0).toHaveLength(1); // refrescado, no acumulado
    // sin más golpes de zara: dur 2 ⇒ el estado vive 2 rondas y expira
    s.heroes[0].alive = false; s.heroes[0].hp = 0; s.heroes.push(hero(2, null));
    s = step(s); expect(evs(s).find((e) => e.actor === 'e0' && e.kind === 'hit').value).toBe(80);
    expect(evs(s).some((e) => e.kind === 'status' && e.op === 'expire')).toBe(true);
    s = step(s); expect(evs(s).find((e) => e.actor === 'e0' && e.kind === 'hit').value).toBe(100);
  });

  test('morghal: quien la golpea queda atkDown 0.05; refresca sin acumular (R19b)', () => {
    let s = step(mk({ heroes: [hero(1, 'morghal')], enemies: [foe(0, { dps: 100 })] }));
    expect(s.fx.st.e0).toEqual([{ type: 'atkDown', value: 0.05, dur: 1, src: 'h1' }]); // dur 2 − 1 al cerrar la ronda
    s = step(s);
    expect(evs(s).find((e) => e.actor === 'e0' && e.kind === 'hit').value).toBe(95);
    expect(s.fx.st.e0).toHaveLength(1);
    expect(s.fx.st.e0[0].dur).toBe(1);
  });

  test('elena: 15% de esquivar solo golpes melee; ranged no consume RNG (R13, R37)', () => {
    const lo = rngFor('lt:0.15'); const hi = rngFor('ge:0.15');
    const run = (rng, range) => step(mk({ rng, heroes: [hero(1, 'elena')], enemies: [foe(0, { dps: 100, ...(range ? { range } : {}) })] }));
    const d = run(lo);
    expect(evs(d).find((e) => e.actor === 'e0' && e.kind === 'hit').value).toBe(0);
    expect(passive(d, 'dodge')[0]).toMatchObject({ passiveId: 'elena', actor: 'h1', target: 'e0' });
    expect(evs(run(hi)).find((e) => e.actor === 'e0' && e.kind === 'hit').value).toBe(100);
    const r = run(lo, 'ranged');
    expect(evs(r).find((e) => e.actor === 'e0' && e.kind === 'hit').value).toBe(100);
    expect(r.rng).toBe(lo);
  });

  test('azyra: esquivar 20% y crítico 10% ×critMult, orden crit → (R20, R20b, R37)', () => {
    // héroe ataca (crit) primero porque ambos spd 0 y los héroes van antes; luego el enemigo (dodge)
    const crit = rngFor('lt:0.10', 'lt:0.20');
    const s = step(mk({ rng: crit, heroes: [hero(1, 'azyra')], enemies: [foe(0, { dps: 100 })] }));
    expect(heroHit(s)[0].value).toBe(Math.round(100 * COMBAT_FX.critMult));
    expect(passive(s, 'crit')[0]).toMatchObject({ passiveId: 'azyra', value: COMBAT_FX.critMult });
    expect(passive(s, 'dodge')).toHaveLength(1);
    expect(evs(s).find((e) => e.actor === 'e0' && e.kind === 'hit').value).toBe(0);
    const none = rngFor('ge:0.10', 'ge:0.20');
    const t = step(mk({ rng: none, heroes: [hero(1, 'azyra')], enemies: [foe(0, { dps: 100 })] }));
    expect(heroHit(t)[0].value).toBe(100);
    expect(passive(t)).toHaveLength(0);
    expect(evs(t).find((e) => e.actor === 'e0' && e.kind === 'hit').value).toBe(100);
  });

  test('vex: segundo golpe con 25%; el segundo no genera otro ni energía extra (R17)', () => {
    const lo = rngFor('lt:0.25'); const hi = rngFor('ge:0.25');
    const a = step(mk({ rng: lo, heroes: [hero(1, 'vex')] }));
    expect(heroHit(a)).toHaveLength(2);
    expect(passive(a, 'extraHit')).toHaveLength(1);
    expect(a.heroes[0].energy).toBe(ENERGY_PER_ROUND);
    const b = step(mk({ rng: hi, heroes: [hero(1, 'vex')] }));
    expect(heroHit(b)).toHaveLength(1);
    expect(a.rng).not.toBe(lo); // consumió exactamente 1 float
    expect(a.rng).toBe(nextFloat(lo).rng);
  });

  test('vex: sin segundo golpe si el primero mató al último enemigo', () => {
    const lo = rngFor('lt:0.25');
    const s = step(mk({ rng: lo, heroes: [hero(1, 'vex')], enemies: [foe(0, { hp: 10, maxHp: 10 })] }));
    expect(heroHit(s)).toHaveLength(1);
    expect(s.rng).toBe(lo);
  });

  test('gorr: 20% de aturdir; el enemigo pierde su siguiente acción una sola vez (R24, R29)', () => {
    const lo = rngFor('lt:0.20'); const hi = rngFor('ge:0.20');
    let s = step(mk({ rng: lo, heroes: [hero(1, 'gorr', { spd: 5 })], enemies: [foe(0, { dps: 100 })] }));
    // el héroe actúa antes (spd 5): aturde y el enemigo pierde la acción de ESA ronda
    expect(evs(s).filter((e) => e.actor === 'e0' && e.kind === 'hit')).toHaveLength(0);
    expect(evs(s).find((e) => e.op === 'skip')).toMatchObject({ status: 'stun', target: 'e0', actor: 'h1' });
    expect(s.fx.st.e0).toBeUndefined();
    s.rng = hi;
    s = step(s);
    expect(evs(s).filter((e) => e.actor === 'e0' && e.kind === 'hit')).toHaveLength(1);
    const n = step(mk({ rng: hi, heroes: [hero(1, 'gorr', { spd: 5 })], enemies: [foe(0, { dps: 100 })] }));
    expect(evs(n).filter((e) => e.actor === 'e0' && e.kind === 'hit')).toHaveLength(1);
  });

  test('gorr: aturde al enemigo que ya actuó ⇒ pierde la acción de la ronda siguiente', () => {
    const lo = rngFor('lt:0.20'); const hi = rngFor('ge:0.20');
    let s = step(mk({ rng: lo, heroes: [hero(1, 'gorr', { spd: 0 })], enemies: [foe(0, { dps: 100, spd: 9 })] }));
    expect(evs(s).filter((e) => e.actor === 'e0' && e.kind === 'hit')).toHaveLength(1);
    expect(s.fx.st.e0[0].type).toBe('stun');
    s.rng = hi;
    s = step(s);
    expect(evs(s).filter((e) => e.actor === 'e0' && e.kind === 'hit')).toHaveLength(0);
    s = step(s);
    expect(evs(s).filter((e) => e.actor === 'e0' && e.kind === 'hit')).toHaveLength(1);
  });

  test('gorr contra jefe: blocked, no se crea stun y no avanza state.rng (R33, R37)', () => {
    const lo = rngFor('lt:0.20');
    const s = step(mk({ rng: lo, isBoss: true, heroes: [hero(1, 'gorr')], enemies: [foe(0, { dps: 100 })] }));
    expect(evs(s).find((e) => e.kind === 'status')).toMatchObject({ op: 'blocked', status: 'stun', target: 'e0' });
    expect(s.fx?.st?.e0).toBeUndefined();
    expect(s.rng).toBe(lo);
    expect(evs(s).filter((e) => e.actor === 'e0' && e.kind === 'hit')).toHaveLength(1);
  });
});

describe('DoT dentro del motor (R30)', () => {
  test('un DoT que mata al último enemigo da victory y no ejecuta la habilidad', () => {
    const s = mk({ heroes: [hero(1, null, { energy: ENERGY_MAX })], enemies: [foe(0, { hp: 3, maxHp: 400 })] });
    s.fx = { st: { e0: [{ type: 'burn', value: 0.05, dur: 2, src: 'h1' }] } };
    const { state, result } = simulateRoundV2(s, { type: 'skill', slot: 1 });
    expect(result).toBe('victory');
    expect(state.heroes[0].energy).toBe(ENERGY_MAX); // la habilidad no se gastó
    expect(evs(state).map((e) => e.kind)).toEqual(['dot', 'death', 'end']);
  });

  test('un DoT que mata a todos los héroes da defeat', () => {
    const s = mk({ heroes: [hero(1, null, { hp: 2, maxHp: 100 })], enemies: [foe(0, { dps: 50 })] });
    s.fx = { st: { h1: [{ type: 'poison', value: 0.05, dur: 2, src: 'e0' }] } };
    const { state, result } = simulateRoundV2(s, { type: 'advance' });
    expect(result).toBe('defeat');
    expect(state.heroes[0].alive).toBe(false);
  });
});

describe('determinismo, compat y datos (T8)', () => {
  const squad = () => mk({
    seed: 99, rng: 99, maxRounds: 12,
    heroes: ['azyra', 'gorr', 'vex', 'elena', 'morghal'].map((id, i) => hero(i + 1, id, { hp: 400, maxHp: 400, spd: i })),
    enemies: [foe(0, { hp: 3000, maxHp: 3000, dps: 60, spd: 2 }), foe(1, { hp: 3000, maxHp: 3000, dps: 40 })],
  });
  const play = (s0) => { let s = s0; let r = null; for (let i = 0; i < 12 && !r; i++) ({ state: s, result: r } = simulateRoundV2(s, { type: 'advance' })); return { s, r }; };

  test('misma semilla ⇒ mismo state/events/result; semillas distintas ⇒ difieren (R-ND7)', () => {
    const a = play(squad()); const b = play(squad());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    const c = play({ ...squad(), seed: 5, rng: 5 });
    expect(JSON.stringify(c.s.events)).not.toBe(JSON.stringify(a.s.events));
  });

  test('el state de entrada no se muta y el resultado serializa (R38)', () => {
    const s0 = squad(); const frozen = JSON.parse(JSON.stringify(s0));
    const { state } = simulateRoundV2(s0, { type: 'advance' });
    expect(s0).toEqual(frozen);
    expect(JSON.parse(JSON.stringify(state))).toEqual(state);
  });

  test('sin pasivas (heroId null, "h1" o desconocido): sin fx, sin eventos nuevos, sin RNG (R4, R5)', () => {
    for (const id of [null, 'h1', 'inventado', undefined]) {
      const s = step(mk({ rng: 123, heroes: [hero(1, id)], enemies: [foe(0, { dps: 30 })] }));
      expect(s.fx).toBeUndefined();
      expect(s.rng).toBe(123);
      expect(new Set(s.events.map((e) => e.kind))).toEqual(new Set(['hit']));
    }
  });

  test('contrato de eventos nuevos: claves y tipos; eventsVersion 1 (R35)', () => {
    const s = step(mk({ rng: rngFor('lt:0.10', 'lt:0.20'), heroes: [hero(1, 'azyra'), hero(2, 'serafina', { hp: 50, maxHp: 100 }), hero(3, 'seraph', { hp: 50, maxHp: 100 })], enemies: [foe(0, { dps: 100 })] }));
    expect(s.eventsVersion).toBe(1);
    const base = ['actor', 'kind', 'round', 't', 'target', 'value'];
    const keys = (e) => Object.keys(e).sort();
    const p = s.events.find((e) => e.kind === 'passive');
    expect(keys(p)).toEqual([...base, 'fx', 'passiveId'].sort());
    const st = s.events.find((e) => e.kind === 'status');
    expect(keys(st)).toEqual([...base, 'dur', 'op', 'status'].sort());
    const h = s.events.find((e) => e.kind === 'heal');
    expect(keys(h)).toEqual([...base, 'passiveId'].sort());
    expect(typeof p.passiveId).toBe('string');
  });

  test('mutar en caliente un value de HERO_PASSIVE_FX cambia el daño (R-ND8)', () => {
    const orig = HERO_PASSIVE_FX.varok[0].value;
    try {
      HERO_PASSIVE_FX.varok[0].value = 0.5;
      expect(heroHit(step(mk({ heroes: [hero(1, 'varok')] })))[0].value).toBe(150);
    } finally { HERO_PASSIVE_FX.varok[0].value = orig; }
    expect(heroHit(step(mk({ heroes: [hero(1, 'varok')] })))[0].value).toBe(125);
  });

  test('estructura de state/heroes/log sin claves nuevas con pasivas (R-ND4)', () => {
    const s = step(squad());
    expect(Object.keys(s.heroes[0]).sort()).toEqual(Object.keys(squad().heroes[0]).sort());
    expect(Object.keys(s.log[0]).sort()).toEqual(['enemies', 'enemyHp', 'eventRange', 'heroes', 'result', 'round']);
    expect(Object.keys(s.enemy).sort()).toEqual(['dps', 'hp', 'id', 'maxHp', 'def', 'spd'].sort());
    expect(COMBAT.engineVersion).toBe(1);
  });

  test('las 18 pasivas juegan una ronda de nodo a1n3/a1n4 sin lanzar y sin tocar CAMPAIGN (R39)', () => {
    const ids = Object.keys(HEROES);
    expect(ids).toHaveLength(18);
    for (const n of CAMPAIGN.filter((x) => x.id === 'a1n3' || x.id === 'a1n4')) {
      const heroes = ids.slice(0, 5).map((id, i) => hero(i + 1, id, { hp: 300, maxHp: 300 }));
      const s0 = mk({ heroes, isBoss: !!n.isBoss, maxRounds: n.maxRounds, enemies: [foe(0, { hp: n.enemy.hp, maxHp: n.enemy.hp, dps: n.enemy.dps })] });
      expect(() => play(s0)).not.toThrow();
    }
    for (const id of ids) {
      const s = mk({ heroes: [hero(1, id, { hp: 300, maxHp: 300 })], enemies: [foe(0, { dps: 20 })] });
      expect(() => play(s)).not.toThrow();
    }
  });
});
