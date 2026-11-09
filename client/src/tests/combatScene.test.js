import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('phaser', () => {
  class Scene { constructor(key) { this.sceneKey = key; } }
  class Game {
    constructor(cfg) { this.config = cfg; this.scenes = []; this.destroyed = 0; Game.last = this; this.scene = { add: (k, C, auto, data) => { this.scenes.push({ k, C, auto, data }); } }; }
    destroy(removeCanvas) { this.destroyed += 1; this.removeCanvas = removeCanvas; }
  }
  const P = { Scene, Game, AUTO: 0, CANVAS: 1, WEBGL: 2, Scale: { FIT: 3, CENTER_BOTH: 1 }, Math: { DegToRad: (x) => x } };
  return { default: P, ...P };
});

import CombatScene, {
  FLOAT_NORMAL, FLOAT_CRIT, FLOAT_STACK, FLOAT_RISE, FLOAT_MS, FLOAT_POP_MS, FLOAT_POP_FROM, FLOAT_HEAD_GAP,
  DEAD_ALPHA, FALL_MS, AIM_MAX_DEG,
} from '../game/combat/CombatScene';
import { createCombatGame, buildCombatConfig } from '../game/combat/createCombatGame';
import { QUALITY } from '../game/combat/combatQuality';
import { spriteGeom, bgCoverScale, BG_DRIFT } from '../game/combat/artMap';
import { computeFormation, enemyList } from '../game/combat/formation';

// Objetos de juego falsos con transformación (x, y, ángulo, escala, origen…) para poder medir quién se mueve.
const DIMS = (key) => {
  const k = String(key || '');
  if (k.startsWith('ph:')) return { w: 80, h: 144 };
  if (k.startsWith('bg:')) return { w: 1080, h: 1935 };
  const m = /^(hero|enemy):([a-z_]+):([a-z]+)$/.exec(k);
  if (m) { const g = spriteGeom(m[1], m[2], m[3]); return { w: g.W, h: g.H }; }
  return { w: 100, h: 100 };
};
function mkObj(log, kind, x = 0, y = 0, texture = null) {
  const o = {
    kind, x, y, x0: x, y0: y, angle: 0, scaleX: 1, scaleY: 1, alpha: 1, flipX: false, originX: 0.5, originY: 0.5, depth: 0,
    texture, tint: null, list: [], active: true, preFX: null,
    get width() { return DIMS(o.texture).w; },
    get height() { return DIMS(o.texture).h; },
    get displayWidth() { return DIMS(o.texture).w * o.scaleX; },
  };
  const self = (fn) => (...args) => { fn(...args); return o; };
  Object.assign(o, {
    setDepth: self((d) => { o.depth = d; }),
    setOrigin: self((ox, oy = ox) => { o.originX = ox; o.originY = oy; }),
    setScale: self((sx, sy = sx) => { o.scaleX = sx; o.scaleY = sy; }),
    setAlpha: self((a) => { o.alpha = a; }),
    setTint: self((t) => { o.tint = t; }),
    setTintFill: self((t) => { o.tint = t; }),
    clearTint: self(() => { o.tint = null; }),
    setTexture: self((k) => { o.texture = k; }),
    setBlendMode: self(() => {}),
    setFlipX: self((f) => { o.flipX = f; }),
    setAngle: self((a) => { o.angle = a; }),
    setPosition: self((px, py) => { o.x = px; o.y = py; }),
    add: self((c) => { for (const ch of (Array.isArray(c) ? c : [c])) { o.list.push(ch); ch.parentContainer = o; } }),
    destroy: () => { o.active = false; },
    setParticleTint: () => {},
    explode: () => {},
  });
  log.objects.push(o);
  return o;
}

const TWEEN_KEYS = ['targets', 'duration', 'delay', 'ease', 'yoyo', 'repeat', 'onComplete', 'hold'];

function fakeScene({ quality = 'medium', postFX = true, failTextures = [], reduced = false, state, node } = {}) {
  const s = new CombatScene();
  const log = {
    pointlights: 0, vignette: 0, bloom: 0, shake: 0, tweens: 0, tweenList: [], objects: [], warns: [],
    textures: new Set(['spark', 'shadow', 'fog']), placeholders: [],
  };
  const loaders = {};
  s.load = { on: (ev, fn) => { loaders[ev] = fn; }, image: (key) => { if (failTextures.includes(key)) setTimeout(() => {}, 0); else log.textures.add(key); } };
  s.textures = { exists: (k) => log.textures.has(k) };
  s.make = { graphics: () => ({ fillStyle() {}, fillCircle() {}, fillEllipse() {}, fillRect() {}, fillRoundedRect() {}, generateTexture: (k) => { log.textures.add(k); log.placeholders.push(k); }, clear() {}, destroy() {} }) };
  s.add = {
    image: (x, y, key) => mkObj(log, 'image', x, y, key),
    rectangle: (x, y) => mkObj(log, 'rect', x, y),
    text: (x, y, text, style) => Object.assign(mkObj(log, 'text', x, y), { text, style }),
    particles: () => mkObj(log, 'particles'),
    container: (x, y) => mkObj(log, 'container', x, y),
    pointlight: () => { log.pointlights += 1; return mkObj(log, 'light'); },
  };
  // Un tween se registra y deja a sus objetivos en el valor final (los de ida y vuelta o en bucle, en el inicial).
  s.tweens = {
    add: (cfg) => {
      log.tweens += 1;
      const targets = Array.isArray(cfg.targets) ? cfg.targets : [cfg.targets];
      const props = Object.keys(cfg).filter((k) => !TWEEN_KEYS.includes(k));
      log.tweenList.push({ targets, props, cfg });
      if (!cfg.yoyo && !cfg.repeat) for (const t of targets) for (const k of props) if (typeof cfg[k] === 'number') t[k] = cfg[k];
      if (cfg.onComplete && !cfg.repeat) cfg.onComplete();
      return { pause() {}, resume() {}, stop() {} };
    },
    killTweensOf: () => {},
    timeScale: 1,
  };
  s.time = { delayedCall: (ms, fn) => fn(), timeScale: 1, now: 0 };
  const cam = { shake: () => { log.shake += 1; } };
  if (postFX) cam.postFX = { addVignette: () => { log.vignette += 1; }, addBloom: () => { log.bloom += 1; return {}; } };
  s.cameras = { main: cam };
  s.input = { on: vi.fn() };
  const done = vi.fn();
  s.init({ quality: QUALITY[quality], reducedMotion: reduced, state, node, onRoundDone: done });
  return { s, log, loaders, done, cam };
}

const STATE = {
  heroes: [{ slot: 1, heroId: null, class: 'warrior', hp: 80, maxHp: 100, alive: true }, { slot: 2, heroId: 'x', class: 'mage', hp: 60, maxHp: 60, alive: true }],
  enemy: { hp: 100, maxHp: 100 },
};
const NODE = { id: 'a1n3', type: 'combat' };
const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
beforeEach(() => warn.mockClear());

// 5 héroes (una clase cada uno) y 3 enemigos: la escena completa de las vistas de la hoja.
const CLASSES = ['warrior', 'mage', 'ranger', 'paladin', 'rogue'];
const FULL = {
  heroes: CLASSES.map((c, i) => ({ slot: i + 1, heroId: `x${i}`, class: c, hp: 100, maxHp: 100, alive: true })),
  enemies: [0, 1, 2].map((i) => ({ id: `e${i}`, hp: 100, maxHp: 100 })),
};
const FULL_NODE = { id: 'a1n7', type: 'combat', act: 1 };
const BEAT = (extra) => ({ color: '#e6dcc3', intensity: 1, ...extra });

describe('R36: createCombatGame', () => {
  it('config FIT 824×1720 y destroy(true) disponible', () => {
    const cfg = buildCombatConfig(document.createElement('div'), QUALITY.medium);
    expect(cfg.scale).toMatchObject({ mode: 3, width: 824, height: 1720 });
    const game = createCombatGame(document.createElement('div'), { state: STATE, node: NODE });
    expect(game.scenes).toHaveLength(1);
    expect(game.scenes[0]).toMatchObject({ k: 'combat', auto: true });
    expect(game.scenes[0].data.state).toBe(STATE);
    game.destroy(true);
    expect(game.destroyed).toBe(1);
  });
});

describe('R46: calidad', () => {
  it('low: sin PointLight ni postFX', () => {
    const { s, log } = fakeScene({ quality: 'low', state: STATE, node: NODE });
    s.create();
    expect(log.pointlights).toBe(0);
    expect(log.vignette + log.bloom).toBe(0);
  });
  it('medium: 2 luces + viñeta sin bloom; high: 4 luces + viñeta + bloom', () => {
    const m = fakeScene({ quality: 'medium', state: STATE, node: NODE }); m.s.create();
    expect([m.log.pointlights, m.log.vignette, m.log.bloom]).toEqual([2, 1, 0]);
    const h = fakeScene({ quality: 'high', state: STATE, node: NODE }); h.s.create();
    expect([h.log.pointlights, h.log.vignette, h.log.bloom]).toEqual([4, 1, 1]);
  });
});

describe('R47: cámara sin postFX', () => {
  it('no lanza con cameras.main.postFX indefinido', () => {
    const { s } = fakeScene({ quality: 'high', postFX: false, state: STATE, node: NODE });
    expect(() => s.create()).not.toThrow();
  });
});

describe('R31: textura caída', () => {
  it('texFor devuelve un marcador generado y avisa; el combate sigue aceptando rondas', () => {
    const { s, log, loaders, done } = fakeScene({ state: STATE, node: NODE });
    s.preload();
    // la textura del enemigo no cargó
    loaders.loaderror({ key: 'enemy:bruto:idle' });
    log.textures.delete('enemy:bruto:idle');
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('enemy:bruto:idle'));
    expect(() => s.create()).not.toThrow();
    expect(log.placeholders).toContain('ph:enemy:bruto:idle');
    const key = s.texFor('enemy', 'bruto', 'idle');
    expect(key).toBe('ph:enemy:bruto:idle');
    // sigue aceptando rondas
    s.playRound([{ t: 1, round: 1, kind: 'hit', actor: 'h1', target: 'e0', value: 20, hp: 80 }], { ...STATE, enemy: { hp: 80, maxHp: 100 } });
    for (let i = 0; i < 200 && !done.mock.calls.length; i++) s.update(0, 16);
    expect(done).toHaveBeenCalledTimes(1);
  });
});

describe('R3/R15: reproducción', () => {
  it('playRound antes de create se encola y se reproduce al crear', () => {
    const { s, done } = fakeScene({ state: STATE, node: NODE });
    s.playRound([{ t: 1, round: 1, kind: 'hit', actor: 'h1', target: 'e0', value: 20, hp: 80 }], STATE);
    s.create();
    for (let i = 0; i < 200 && !done.mock.calls.length; i++) s.update(0, 16);
    expect(done).toHaveBeenCalledTimes(1);
  });
  it('misma ronda dos veces: la segunda no repite y aun así avisa (R14)', () => {
    const { s, done } = fakeScene({ state: STATE, node: NODE });
    s.create();
    const evs = [{ t: 1, round: 1, kind: 'hit', actor: 'h1', target: 'e0', value: 20, hp: 80 }];
    s.playRound(evs, STATE);
    for (let i = 0; i < 200 && done.mock.calls.length < 1; i++) s.update(0, 16);
    s.playRound(evs, STATE);
    s.update(0, 16);
    expect(done).toHaveBeenCalledTimes(2);
  });
  it('skip() acelera y la ronda termina en ≤ 300 ms', () => {
    const { s, done } = fakeScene({ state: STATE, node: NODE });
    s.create();
    const evs = Array.from({ length: 12 }, (_, i) => ({ t: i + 1, round: 1, kind: 'hit', actor: 'h1', target: 'e0', value: 5, hp: 90 }));
    s.playRound(evs, STATE);
    s.update(0, 50);
    s.skip();
    expect(s.tweens.timeScale).toBeGreaterThan(1);
    let ms = 0;
    while (!done.mock.calls.length && ms < 2000) { s.update(0, 20); ms += 20; }
    expect(ms).toBeLessThanOrEqual(320);
    expect(s.tweens.timeScale).toBe(1);
  });
  it('un toque en el lienzo registra skip', () => {
    const { s } = fakeScene({ state: STATE, node: NODE });
    s.create();
    expect(s.input.on).toHaveBeenCalledWith('pointerdown', expect.any(Function));
  });
});

describe('Q10: prefers-reduced-motion', () => {
  const evs = [{ t: 1, round: 1, kind: 'hit', actor: 'h1', target: 'e0', value: 20, hp: 80 }];
  it('con reducción: sin shake y sin tweens de respiración/deriva', () => {
    const r = fakeScene({ reduced: true, state: STATE, node: NODE }); r.s.create();
    expect(r.log.tweens).toBe(0);
    r.s.playRound(evs, STATE);
    for (let i = 0; i < 200 && !r.done.mock.calls.length; i++) r.s.update(0, 16);
    expect(r.log.shake).toBe(0);
  });
  it('sin reducción: hay shake en el impacto y tweens ambientales', () => {
    const n = fakeScene({ reduced: false, state: STATE, node: NODE }); n.s.create();
    expect(n.log.tweens).toBeGreaterThan(0);
    n.s.playRound(evs, STATE);
    for (let i = 0; i < 200 && !n.done.mock.calls.length; i++) n.s.update(0, 16);
    expect(n.log.shake).toBeGreaterThan(0);
  });
});

describe('Carriles en la escena: un contenedor por personaje, pie sobre su carril (V2)', () => {
  it('cada actor es un contenedor en (cx, carril) con profundidad = carril; el origen del sprite apoya el pie', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    const f = computeFormation(FULL.heroes, enemyList(FULL), { node: FULL_NODE });
    for (const b of [...f.heroes, ...f.enemies]) {
      const a = s.actors[b.id];
      expect(a.c.kind).toBe('container');
      expect([a.c.x, a.c.y]).toEqual([b.cx, b.lane]);
      expect(a.c.depth).toBe(b.lane);
      expect(a.c.list).toContain(a.sp);
      expect(a.c.list).toContain(a.sh);
      expect([a.sp.x, a.sp.y]).toEqual([0, 0]);
      const g = spriteGeom(a.kind, b.art, 'idle');
      expect(a.sp.originY).toBeCloseTo((g.b + 1) / g.H, 10);        // la fila inferior con alfa cae en el carril
      expect(a.sp.originX).toBe(0.5);
      expect(a.sp.scaleY * a.sp.height).toBeCloseTo(b.h, 6);          // alto V1/R27
    }
    // la fila de más abajo se dibuja delante
    expect(s.actors.h1.c.depth).toBeGreaterThan(s.actors.h4.c.depth);
    expect(s.actors.h4.c.depth).toBeGreaterThan(s.actors.e2.c.depth);
    expect(s.actors.e2.c.depth).toBeGreaterThan(s.actors.e0.c.depth);
  });
  it('el fondo usa la misma transformación con la que se calibró el piso (cover × 1,04 y deriva × 1,025)', () => {
    const { s, log } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    const bg = log.objects.find((o) => o.kind === 'image' && String(o.texture).startsWith('bg:'));
    expect(bg.scaleX).toBeCloseTo(bgCoverScale(1080, 1935), 10);
    const drift = log.tweenList.find((t) => t.targets.includes(bg));
    expect(drift.cfg.scale).toBeCloseTo(bgCoverScale(1080, 1935) * BG_DRIFT, 10);
  });
  it('al cambiar de pose el pie no se mueve: origen de la pose (y reflejado al voltear)', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    const a = s.actors.h3; // ranger
    s.setPose(a, 'attack', false);
    const g = spriteGeom('hero', 'ranger', 'attack');
    expect(a.sp.texture).toBe('hero:ranger:attack');
    expect([a.sp.originX, a.sp.originY]).toEqual([g.ox, g.oy]);
    s.setPose(a, 'attack', true);
    expect(a.sp.originX).toBeCloseTo(1 - g.ox, 10);
    expect([a.c.x, a.c.y]).toEqual([a.base.x, a.base.y]);
  });
});

describe('Movimiento (regla del owner): cada personaje anima solo su contenedor', () => {
  const ownerOf = (s, obj) => Object.values(s.actors).find((a) => a.c === obj || a.c.list.includes(obj));
  const snap = (s) => Object.fromEntries(Object.values(s.actors).map((a) => [a.id, [a.c.x, a.c.y, a.c.angle, a.sp.x, a.sp.y, a.sp.angle]]));
  const setup = () => {
    const env = fakeScene({ state: FULL, node: FULL_NODE });
    env.s.preload();
    env.s.create();
    return env;
  };

  it('idle: la respiración de cada uno solo escala SU sprite; ningún contenedor se mueve', () => {
    const { s, log } = setup();
    const breath = log.tweenList.filter((t) => t.cfg.repeat === -1 && t.targets.some((o) => ownerOf(s, o)));
    expect(breath).toHaveLength(8);
    for (const t of breath) {
      expect(t.targets).toHaveLength(1);
      expect(ownerOf(s, t.targets[0]).sp).toBe(t.targets[0]);
      expect(t.props.sort()).toEqual(['scaleX', 'scaleY']);
    }
    for (const a of Object.values(s.actors)) expect([a.c.x, a.c.y, a.sp.x, a.sp.y]).toEqual([a.base.x, a.base.y, 0, 0]);
  });

  const CASES = [
    ['attack (h1 ataca a e0)', BEAT({ kind: 'hit', actorId: 'h1', targetId: 'e0', num: 20 }), ['h1', 'e0']],
    ['hit (e1 golpea a h3)', BEAT({ kind: 'hit', actorId: 'e1', targetId: 'h3', num: 12 }), ['e1', 'h3']],
    ['skill (h5 sobre e2)', BEAT({ kind: 'skill', actorId: 'h5', targetId: 'e2', num: 40, intensity: 2 }), ['h5', 'e2']],
    ['KO (cae e2)', BEAT({ kind: 'death', targetId: 'e2' }), ['e2']],
    ['KO (cae h2)', BEAT({ kind: 'death', targetId: 'h2' }), ['h2']],
  ];
  for (const [name, beat, acting] of CASES) {
    it(`${name}: los compañeros varían 0 px y ningún tween los toca`, () => {
      const { s, log } = setup();
      const before = snap(s);
      const from = log.tweenList.length;
      s.playBeat(beat);
      for (const t of log.tweenList.slice(from)) {
        for (const o of t.targets) {
          const owner = ownerOf(s, o);
          if (owner) expect(acting, `${t.props.join(',')} sobre ${owner.id}`).toContain(owner.id);
        }
      }
      const after = snap(s);
      for (const id of Object.keys(s.actors)) if (!acting.includes(id)) expect(after[id], id).toEqual(before[id]);
      // y el contenedor del que actúa vuelve a su sitio (embestida y retroceso son de ida y vuelta)
      for (const id of acting) expect([s.actors[id].c.x, s.actors[id].c.y], id).toEqual([s.actors[id].base.x, s.actors[id].base.y]);
    });
  }
});

describe('V4: números de daño sobre la cabeza', () => {
  it('normal 40 px / crítico 60 px; arrancan encima de la cabeza; pop 1,4→1 en 120 ms; suben 60 px en 800 ms; se apilan 28 px', () => {
    expect(FLOAT_NORMAL).toBeGreaterThanOrEqual(36); expect(FLOAT_NORMAL).toBeLessThanOrEqual(44);
    expect(FLOAT_CRIT).toBeGreaterThanOrEqual(56); expect(FLOAT_CRIT).toBeLessThanOrEqual(64);
    const { s, log } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    const a = s.actors.e0;
    const from = log.tweenList.length;
    const t1 = s.floatAt(a, 20, '#fff');
    const t2 = s.floatAt(a, 40, '#fff', true);
    expect(t1.style.fontSize).toBe(`${FLOAT_NORMAL}px`);
    expect(t2.style.fontSize).toBe(`${FLOAT_CRIT}px`);
    expect(t1.originY).toBe(1);                                   // el borde inferior es el que se coloca
    expect(t1.y0).toBe(a.base.headY - FLOAT_HEAD_GAP);            // sobre la cabeza, nunca sobre la cara
    expect(t1.y0).toBeLessThan(a.base.headY);
    expect(t2.y0).toBe(t1.y0 - FLOAT_STACK);
    const tw = log.tweenList.slice(from).filter((t) => t.targets[0] === t1);
    const pop = tw.find((t) => t.props.includes('scale'));
    const rise = tw.find((t) => t.props.includes('y'));
    const fade = tw.find((t) => t.props.includes('alpha'));
    expect(FLOAT_POP_FROM).toBe(1.4);
    expect([pop.cfg.scale, pop.cfg.duration]).toEqual([1, FLOAT_POP_MS]);
    expect(FLOAT_POP_MS).toBe(120);
    expect([t1.y0 - rise.cfg.y, rise.cfg.duration]).toEqual([FLOAT_RISE, FLOAT_MS]);
    expect(FLOAT_RISE).toBe(60);
    expect((fade.cfg.delay || 0) + fade.cfg.duration).toBeLessThanOrEqual(800);
  });
  it('el daño de un golpe sale con floatAt sobre el objetivo', () => {
    const { s, log } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    s.playBeat(BEAT({ kind: 'hit', actorId: 'h1', targetId: 'e1', num: 33 }));
    const txt = log.objects.find((o) => o.kind === 'text' && String(o.text) === '33');
    expect(txt.y0).toBe(s.actors.e1.base.headY - FLOAT_HEAD_GAP);
  });
});

describe('V6: muerte', () => {
  it('cae (rotación ±90 + bajada en ≤ 600 ms) y queda tendido sobre su carril, opaco (≥ 0,8) y apagado', () => {
    expect(FALL_MS).toBeLessThanOrEqual(600);
    expect(DEAD_ALPHA).toBeGreaterThanOrEqual(0.8);
    for (const id of ['h1', 'h2', 'h3', 'e0', 'e1']) {
      const { s, log } = fakeScene({ state: FULL, node: FULL_NODE });
      s.preload();
    s.create();
      const a = s.actors[id];
      const from = log.tweenList.length;
      s.playBeat(BEAT({ kind: 'death', targetId: id }));
      const fall = log.tweenList.slice(from).find((t) => t.targets.includes(a.sp) && t.props.includes('angle'));
      expect(fall.cfg.duration).toBeLessThanOrEqual(600);
      expect(Math.abs(a.sp.angle)).toBe(90);
      expect(a.sp.alpha).toBeGreaterThanOrEqual(0.8);
      expect(a.sp.tint).not.toBeNull();
      expect(a.sp.y).toBeLessThanOrEqual(0);          // el cuerpo queda por encima del carril, no hundido
      expect([a.c.x, a.c.y]).toEqual([a.base.x, a.base.y]);
      // tendido dentro del lienzo
      const cx = a.base.x + a.sp.x + Math.sign(a.sp.angle) * a.base.alphaH / 2;
      expect(cx - a.base.alphaH / 2).toBeGreaterThanOrEqual(0);
      expect(cx + a.base.alphaH / 2).toBeLessThanOrEqual(824);
      // no vuelve a levantarse con un restore pendiente
      s.restoreLater(a, 10);
      expect(Math.abs(a.sp.angle)).toBe(90);
    }
  });
  it('un estado inicial con caídos los muestra tendidos, nunca como fantasma de pie', () => {
    const st = { ...FULL, enemies: [{ id: 'e0', hp: 0, maxHp: 100 }, { id: 'e1', hp: 50, maxHp: 100 }] };
    const { s } = fakeScene({ state: st, node: FULL_NODE });
    s.preload();
    s.create();
    expect(Math.abs(s.actors.e0.sp.angle)).toBe(90);
    expect(s.actors.e0.sp.alpha).toBeGreaterThanOrEqual(0.8);
    expect(s.actors.e1.sp.angle).toBe(0);
  });
});

describe('V7: orientación al atacar', () => {
  it('el atacante mira a su objetivo (flipX según el lado) y vuelve a su orientación al terminar', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    const pending = [];
    s.time.delayedCall = (ms, fn) => { pending.push(fn); };
    // h1 (izquierda) ataca a e1 (derecha): un héroe ya mira a la derecha → sin voltear
    s.playBeat(BEAT({ kind: 'hit', actorId: 'h1', targetId: 'e1', num: 5 }));
    expect(s.actors.h1.sp.flipX).toBe(false);
    // h3 (derecha) ataca a e0 (izquierda) → voltea
    s.playBeat(BEAT({ kind: 'hit', actorId: 'h3', targetId: 'e0', num: 5 }));
    expect(s.actors.h3.sp.flipX).toBe(true);
    // e1 (derecha) ataca a h1 (izquierda): un enemigo ya mira a la izquierda → sin voltear; e0 → h3 voltea
    s.playBeat(BEAT({ kind: 'hit', actorId: 'e1', targetId: 'h1', num: 5 }));
    expect(s.actors.e1.sp.flipX).toBe(false);
    s.playBeat(BEAT({ kind: 'hit', actorId: 'e0', targetId: 'h3', num: 5 }));
    expect(s.actors.e0.sp.flipX).toBe(true);
    for (const fn of pending.splice(0)) fn();
    for (const id of ['h1', 'h3', 'e0', 'e1']) {
      expect(s.actors[id].sp.flipX, id).toBe(false);
      expect(s.actors[id].sp.angle, id).toBe(0);
      expect(s.actors[id].sp.texture, id).toContain(':idle');
    }
  });
  it('el tirador apunta: inclina el arma hacia el objetivo, como mucho 15°', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    s.time.delayedCall = () => {};
    const r = s.actors.h3; // ranger, a la derecha
    s.playBeat(BEAT({ kind: 'hit', actorId: 'h3', targetId: 'e0', num: 5 })); // objetivo arriba a la izquierda
    expect(r.sp.flipX).toBe(true);
    expect(r.sp.angle).toBeGreaterThan(0);                    // mirando a la izquierda, sube el cañón girando a la derecha
    expect(r.sp.angle).toBeLessThanOrEqual(AIM_MAX_DEG);
    const w = s.actors.h1; // warrior: no inclina
    s.playBeat(BEAT({ kind: 'hit', actorId: 'h1', targetId: 'e1', num: 5 }));
    expect(w.sp.angle).toBe(0);
  });
});

describe('R31 en combate: ninguna pose cae al marcador (bug de la ronda 2)', () => {
  const noPlaceholder = (s, when) => {
    for (const a of Object.values(s.actors)) expect(String(a.sp.texture), `${a.id} ${when}`).not.toMatch(/^ph:/);
  };
  it('cada actor resuelve idle, attack y hit a una textura real (el héroe golpeado queda en idle)', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    for (const a of Object.values(s.actors)) {
      for (const pose of ['idle', 'attack', 'hit']) {
        s.setPose(a, pose, false);
        expect(String(a.sp.texture), `${a.id}:${pose}`).not.toMatch(/^ph:/);
      }
    }
    s.setPose(s.actors.h1, 'hit');
    expect(s.actors.h1.sp.texture).toBe('hero:warrior:idle');
    s.setPose(s.actors.e0, 'attack');
    expect(s.actors.e0.sp.texture).toBe('enemy:carroneros:hit');
  });
  it('una ronda con golpes a cada héroe, ataques, habilidad y caídas nunca muestra el marcador', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    const pending = [];
    s.time.delayedCall = (ms, fn) => { pending.push(fn); };
    const beats = [
      ...['h1', 'h2', 'h3', 'h4', 'h5'].map((h, i) => BEAT({ kind: 'hit', actorId: `e${i % 3}`, targetId: h, num: 9 })),
      ...['e0', 'e1', 'e2'].map((e, i) => BEAT({ kind: 'hit', actorId: `h${i + 1}`, targetId: e, num: 12 })),
      BEAT({ kind: 'skill', actorId: 'h3', targetId: 'e1', num: 40, intensity: 2 }),
      BEAT({ kind: 'death', targetId: 'e2' }),
      BEAT({ kind: 'death', targetId: 'h4' }),
    ];
    for (const b of beats) {
      s.playBeat(b);
      noPlaceholder(s, `tras ${b.kind} ${b.actorId || ''}→${b.targetId}`);
    }
    for (const fn of pending.splice(0)) fn();
    noPlaceholder(s, 'al volver a idle');
  });
});
