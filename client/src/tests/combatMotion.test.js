import { describe, it, expect } from 'vitest';
import {
  PROFILES, DEFAULT_PROFILE, profileFor, attackPlan, impactPlan, fallPlan, victoryPlan, idleParams, nextShift,
  sampleSteps, stepsEnd, compose, hash01, mulberry32, idleState, NEUTRAL, state,
} from '../game/combat/motion';
import { BASE_MS, ROUND_BUDGET_MS } from '../game/combat/eventPlanner';
import { resolvePose, poseChain, hasExtraPose, extraAssetKeys } from '../game/combat/poseMap';

const HEROES = ['warrior', 'rogue', 'mage', 'ranger', 'paladin'];
const ENEMIES = ['bruto', 'coloso', 'boss_heraldo', 'boss_devorador'];
const ALL = [...HEROES.map((k) => ['hero', k]), ...ENEMIES.map((k) => ['enemy', k]), ['hero', 'desconocido'], ['enemy', '__proto__']];

describe('motion: perfiles', () => {
  it('hay perfil completo para todo el elenco y los desconocidos caen al neutro (sin lanzar)', () => {
    for (const k of HEROES) expect(PROFILES.hero[k]).toBeTruthy();
    for (const k of ENEMIES) expect(PROFILES.enemy[k]).toBeTruthy();
    expect(profileFor('hero', 'nope')).toBe(DEFAULT_PROFILE);
    expect(profileFor('enemy', '__proto__')).toBe(DEFAULT_PROFILE);
    expect(profileFor('hero', undefined)).toBe(DEFAULT_PROFILE);
  });

  it('cada perfil tiene los campos que usa la escena y valores acotados', () => {
    for (const p of [...Object.values(PROFILES.hero), ...Object.values(PROFILES.enemy), DEFAULT_PROFILE]) {
      expect(p.breath.period).toBeGreaterThan(500);
      expect(p.breath.amp).toBeLessThan(0.05);
      expect(p.heft).toBeGreaterThanOrEqual(0);
      expect(p.heft).toBeLessThanOrEqual(1);
      expect(p.atk.windup + p.atk.lunge + p.atk.settle).toBeCloseTo(1, 1);
      expect(p.shift.max).toBeGreaterThan(p.shift.min);
    }
  });

  it('personalidad: warrior pesado y lento, rogue rápido, mage flota, ranger estable', () => {
    const { warrior, rogue, mage, ranger, paladin } = PROFILES.hero;
    expect(warrior.heft).toBeGreaterThan(rogue.heft);
    expect(warrior.breath.period).toBeGreaterThan(rogue.breath.period);
    expect(rogue.atk.windup).toBeLessThan(warrior.atk.windup);
    expect(mage.float).toBeTruthy();
    expect(ranger.float).toBeNull();
    expect(ranger.atk.stretch).toBeLessThan(rogue.atk.stretch);
    expect(paladin.hurt.recoil).toBeLessThan(rogue.hurt.recoil);
  });
});

describe('motion: secuencia de ataque dentro del presupuesto (Q8)', () => {
  it('termina dentro del beat para todo el elenco y para cualquier beat, incluso muy comprimido', () => {
    for (const [kind, art] of ALL) {
      const p = profileFor(kind, art);
      for (const dur of [BASE_MS.hit, BASE_MS.skill, 180, 90, 30]) {
        const plan = attackPlan(p, { dur, dirX: 300, dirY: -200, dist: 360, reduced: false });
        expect(plan.total).toBeLessThanOrEqual(dur);
        expect(stepsEnd(plan.steps)).toBeLessThanOrEqual(dur + 1);
        expect(plan.contactAt).toBeLessThanOrEqual(plan.total);
        expect(plan.steps.length).toBe(4);
      }
    }
  });

  it('impacto, caída y victoria no se salen de su ventana', () => {
    for (const [kind, art] of ALL) {
      const p = profileFor(kind, art);
      expect(impactPlan(p, { dur: 360, dmgRatio: 0.5, intensity: 2, dirX: 1, dirY: 0 }).total).toBeLessThanOrEqual(360);
      expect(impactPlan(p, { dur: 100, dmgRatio: 0.5, dirX: -1, dirY: 0 }).total).toBeLessThanOrEqual(102);
      expect(fallPlan(p, { cap: BASE_MS.death + 250 }).total).toBeLessThanOrEqual(BASE_MS.death + 250);
      expect(fallPlan(p, {}).total).toBeLessThanOrEqual(p.fall.ms);
    }
  });

  it('la victoria dura < 1 s y es decoración posterior (no cuenta en el presupuesto de ronda)', () => {
    for (const k of HEROES) expect(victoryPlan(PROFILES.hero[k]).total).toBeLessThanOrEqual(1000);
    expect(ROUND_BUDGET_MS).toBe(2500); // si F7 cambia Q8, este piloto debe revisarse
  });

  it('el ataque tiene anticipación (retrocede), embestida (avanza) y vuelve a reposo', () => {
    const plan = attackPlan(PROFILES.hero.warrior, { dur: 420, dirX: 1, dirY: 0, dist: 400 });
    expect(plan.steps[0].to.x).toBeLessThan(0);
    expect(plan.steps[0].to.sy).toBeLessThan(0); // aplasta
    expect(plan.steps[1].to.x).toBeGreaterThan(0);
    expect(plan.steps[1].to.sy).toBeGreaterThan(0); // estira
    expect(plan.steps[3].to).toEqual(state());
    expect(plan.steps[1].to.rot).toBeGreaterThan(0); // se inclina hacia el objetivo
    const left = attackPlan(PROFILES.hero.warrior, { dur: 420, dirX: -1, dirY: 0, dist: 400 });
    expect(left.steps[1].to.x).toBeLessThan(0);
    expect(left.steps[1].to.rot).toBeLessThan(0);
  });

  it('el alcance se limita a la distancia al objetivo (no atraviesa al rival)', () => {
    const near = attackPlan(PROFILES.hero.rogue, { dur: 420, dirX: 1, dirY: 0, dist: 60 });
    expect(near.steps[1].to.x).toBeLessThanOrEqual(60 * 0.45 + 0.01);
  });
});

describe('motion: impacto proporcional al daño', () => {
  it('más daño → más retroceso; más pesado → menos retroceso', () => {
    const w = PROFILES.hero.warrior; const r = PROFILES.hero.rogue;
    const small = impactPlan(w, { dur: 360, dmgRatio: 0.02, dirX: 1, dirY: 0 });
    const big = impactPlan(w, { dur: 360, dmgRatio: 0.3, dirX: 1, dirY: 0 });
    expect(big.px).toBeGreaterThan(small.px);
    expect(impactPlan(r, { dur: 360, dmgRatio: 0.3, dirX: 1, dirY: 0 }).px).toBeGreaterThan(big.px);
    expect(big.steps[0].to.x).toBeGreaterThan(0); // empujado en la dirección del golpe
  });
  it('un crítico empuja más pero con tope (no sale volando)', () => {
    const p = PROFILES.hero.rogue;
    const n = impactPlan(p, { dur: 360, dmgRatio: 1, intensity: 1, dirX: 1, dirY: 0 }).px;
    const c = impactPlan(p, { dur: 360, dmgRatio: 1, intensity: 2, dirX: 1, dirY: 0 }).px;
    expect(c).toBeGreaterThanOrEqual(n);
    expect(c).toBeLessThan(p.hurt.max * 1.6);
  });
});

describe('motion: prefers-reduced-motion (Q10)', () => {
  it('sin desplazamientos, saltos, inclinaciones ni reposo animado', () => {
    for (const [kind, art] of ALL) {
      const p = profileFor(kind, art);
      expect(attackPlan(p, { dur: 420, dirX: 1, dirY: 0, reduced: true }).steps).toEqual([]);
      expect(impactPlan(p, { dur: 360, dmgRatio: 1, dirX: 1, dirY: 0, reduced: true }).steps).toEqual([]);
      expect(fallPlan(p, { reduced: true }).steps).toEqual([]);
      expect(victoryPlan(p, { reduced: true }).steps).toEqual([]);
      expect(idleParams(p, { reduced: true })).toBeNull();
    }
  });
  it('conserva el momento de contacto para que los cambios de pose no se desfasen', () => {
    const r = attackPlan(PROFILES.hero.warrior, { dur: 420, reduced: true });
    expect(r.contactAt).toBeGreaterThan(0);
    expect(r.total).toBeLessThanOrEqual(420);
  });
});

describe('motion: reposo vivo', () => {
  it('cada actor está desfasado (el hash de su id) y el primer cambio de peso no coincide', () => {
    const p = PROFILES.hero.warrior;
    const a = idleParams(p, { phase: hash01('h0') });
    const b = idleParams(p, { phase: hash01('h1') });
    const c = idleParams(p, { phase: hash01('e0') });
    expect(new Set([a.breath.delay, b.breath.delay, c.breath.delay]).size).toBe(3);
    expect(new Set([a.firstShiftIn, b.firstShiftIn, c.firstShiftIn]).size).toBe(3);
    expect(hash01('h0')).toBe(hash01('h0'));
  });
  it('el mago flota; el warrior no', () => {
    expect(idleParams(PROFILES.hero.mage, { phase: 0.3 }).float).toBeTruthy();
    expect(idleParams(PROFILES.hero.warrior, { phase: 0.3 }).float).toBeNull();
    const fy = idleState(idleParams(PROFILES.hero.mage, { phase: 0 }), 600).y;
    expect(fy).toBeLessThan(0);
  });
  it('el desplazamiento de peso es acotado, espaciado y determinista con un rng con semilla', () => {
    const p = PROFILES.hero.rogue;
    const r1 = mulberry32(0.42); const r2 = mulberry32(0.42);
    for (let i = 0; i < 50; i++) {
      const s = nextShift(p, r1);
      expect(s).toEqual(nextShift(p, r2));
      expect(s.wait).toBeGreaterThanOrEqual(p.shift.min);
      expect(s.wait).toBeLessThanOrEqual(p.shift.max);
      expect(Math.abs(s.dx)).toBeLessThanOrEqual(p.shift.dx);
    }
  });
  it('la respiración vuelve al reposo cada periodo y nunca escala más que su amplitud', () => {
    const ip = idleParams(PROFILES.hero.warrior, { phase: 0 });
    expect(Math.abs(idleState(ip, 0).sy)).toBeLessThan(1e-9);
    expect(idleState(ip, 1000).sy).toBeCloseTo(PROFILES.hero.warrior.breath.amp, 5);
    expect(idleState(null, 5)).toEqual(NEUTRAL);
  });
});

describe('motion: reproducción de pasos', () => {
  it('sampleSteps interpola, mantiene entre pasos y termina en el último destino', () => {
    const steps = [{ at: 0, dur: 100, ease: 'Linear', to: state({ x: 10 }) }, { at: 200, dur: 100, ease: 'Linear', to: state({ x: 0 }) }];
    expect(sampleSteps(steps, NEUTRAL, 50).x).toBeCloseTo(5);
    expect(sampleSteps(steps, NEUTRAL, 150).x).toBeCloseTo(10);
    expect(sampleSteps(steps, NEUTRAL, 250).x).toBeCloseTo(5);
    expect(sampleSteps(steps, NEUTRAL, 999).x).toBe(0);
    expect(sampleSteps([], NEUTRAL, 10)).toBe(NEUTRAL);
  });
  it('compose suma canales y tolera canales ausentes', () => {
    const o = compose({ act: state({ x: 5, rot: 2 }), hit: state({ x: -2 }), idle: undefined });
    expect(o.x).toBe(3);
    expect(o.rot).toBe(2);
  });
  it('un ataque termina en reposo exacto al final de su ventana', () => {
    const plan = attackPlan(PROFILES.enemy.bruto, { dur: 420, dirX: -1, dirY: 0, dist: 500 });
    const end = sampleSteps(plan.steps, NEUTRAL, plan.total + 5);
    expect(end).toEqual(state());
  });
});

describe('poseMap: poses extra con fallback', () => {
  const only = (...have) => (kind, key, pose) => have.includes(`${kind}:${key}:${pose}`);
  it('registra el piloto: warrior (hit, skill, ko, victory) y bruto (attack, ko)', () => {
    for (const p of ['hit', 'skill', 'ko', 'victory']) expect(hasExtraPose('hero', 'warrior', p)).toBe(true);
    for (const p of ['attack', 'ko']) expect(hasExtraPose('enemy', 'bruto', p)).toBe(true);
    expect(hasExtraPose('hero', 'mage', 'skill')).toBe(false);
    expect(hasExtraPose('hero', '__proto__', 'skill')).toBe(false);
  });
  it('sin la pose cae a la siguiente de la cadena', () => {
    expect(resolvePose('hero', 'mage', 'skill', only('hero:mage:attack'))).toBe('attack');
    expect(resolvePose('hero', 'mage', 'skill', only())).toBe('idle');
    expect(resolvePose('enemy', 'coloso', 'attack', only('enemy:coloso:hit'))).toBe('hit');
    expect(resolvePose('hero', 'warrior', 'skill', only('hero:warrior:skill', 'hero:warrior:attack'))).toBe('skill');
    expect(resolvePose('hero', 'mage', 'victory', only())).toBe('idle');
  });
  it('un KO sin arte propio conserva la textura actual (null) y con arte la usa', () => {
    expect(resolvePose('hero', 'mage', 'ko', only())).toBeNull();
    expect(resolvePose('hero', 'warrior', 'ko', only('hero:warrior:ko'))).toBe('ko');
    expect(poseChain('enemy', 'ko')).toEqual(['ko', null]);
  });
  it('extraAssetKeys pide solo las poses extra de los personajes presentes, sin duplicar', () => {
    const assets = [{ key: 'hero:warrior:idle', url: 'x' }, { key: 'hero:mage:idle', url: 'x' }, { key: 'enemy:bruto:idle', url: 'x' }, { key: 'bg:crypt', url: 'x' }];
    const extra = extraAssetKeys(assets);
    expect(extra.map((e) => e.key).sort()).toEqual([
      'enemy:bruto:attack', 'enemy:bruto:ko', 'hero:warrior:hit', 'hero:warrior:ko', 'hero:warrior:skill', 'hero:warrior:victory',
    ]);
    expect(extra.find((e) => e.key === 'enemy:bruto:ko').url).toBe('/assets/b/enemies/bruto_ko.webp');
    expect(extra.find((e) => e.key === 'hero:warrior:hit').url).toBe('/assets/b/heroes/warrior_hit.webp');
    expect(extraAssetKeys([])).toEqual([]);
    expect(extraAssetKeys(null)).toEqual([]);
  });
});
