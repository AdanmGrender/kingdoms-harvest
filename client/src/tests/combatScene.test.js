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
  FLOAT_NORMAL, FLOAT_CRIT, FLOAT_STACK_GAP, FLOAT_RISE, FLOAT_MS, FLOAT_POP_MS, FLOAT_POP_FROM, FLOAT_HEAD_GAP,
  DEAD_ALPHA, FALL_MS, AIM_MAX_DEG,
} from '../game/combat/CombatScene';
import { createCombatGame, buildCombatConfig } from '../game/combat/createCombatGame';
import { QUALITY } from '../game/combat/combatQuality';
import { spriteGeom, bgCoverScale, BG_DRIFT } from '../game/combat/artMap';
import { computeFormation, enemyList, lyingBoxes, DEAD_LEN, DEAD_FLAT } from '../game/combat/formation';

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
    setRotation: self((r) => { o.rotation = r; }),
    setCrop: self((...c) => { o.isCropped = c.length > 0; o.crop = c.length ? c : null; }),
    add: self((c) => { for (const ch of (Array.isArray(c) ? c : [c])) { o.list.push(ch); ch.parentContainer = o; } }),
    destroy: () => { o.active = false; },
    setParticleTint: () => {},
    explode: () => {},
  });
  log.objects.push(o);
  return o;
}

const TWEEN_KEYS = ['targets', 'duration', 'delay', 'ease', 'yoyo', 'repeat', 'onComplete', 'hold'];

function fakeScene({ quality = 'medium', postFX = true, failTextures = [], reduced = false, state, node, cssW = 412 } = {}) {
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
    text: (x, y, text, style) => {
      const o = Object.assign(mkObj(log, 'text', x, y), { text, style });
      Object.defineProperty(o, 'height', { get: () => parseFloat(style.fontSize) * 1.25 }); // alto de línea del texto
      Object.defineProperty(o, 'width', { get: () => parseFloat(style.fontSize) * 0.6 * String(text).length });
      return o;
    },
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
  s.scale = { displaySize: { width: cssW, height: cssW * (1720 / 824) } };
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

describe('V4: números de daño sobre la cabeza (px de pantalla; apilado por alto real + 4)', () => {
  it('a cualquier escala: normal 36–44 y crítico 56–64 px CSS; arrancan sobre la cabeza; pop 1,4→1 en 120 ms; suben 60 px CSS en 800 ms', () => {
    expect([FLOAT_NORMAL, FLOAT_CRIT, FLOAT_RISE, FLOAT_POP_FROM, FLOAT_POP_MS]).toEqual([40, 60, 60, 1.4, 120]);
    for (const cssW of [412, 383, 360, 354.5, 319.5]) {
      const k = cssW / 824;
      const { s, log } = fakeScene({ state: FULL, node: FULL_NODE, cssW });
      s.preload();
      s.create();
      const a = s.actors.e0;
      const from = log.tweenList.length;
      const t1 = s.floatAt(a, 20, '#fff');
      const t2 = s.floatAt(s.actors.e1, 40, '#fff', true);
      const css = (t) => parseFloat(t.style.fontSize) * k;
      expect(css(t1), `${cssW}`).toBeGreaterThanOrEqual(36);
      expect(css(t1), `${cssW}`).toBeLessThanOrEqual(44);
      expect(css(t2), `${cssW}`).toBeGreaterThanOrEqual(56);
      expect(css(t2), `${cssW}`).toBeLessThanOrEqual(64);
      expect(t1.originY).toBe(1);                                         // se coloca el borde inferior
      expect(t1.y0).toBeCloseTo(a.base.headY - FLOAT_HEAD_GAP / k, 6);     // sobre la cabeza, nunca sobre la cara
      expect(t1.y0).toBeLessThan(a.base.headY);
      expect(t1.scaleX).toBe(1.4);
      const tw = log.tweenList.slice(from).filter((t) => t.targets[0] === t1);
      const pop = tw.find((t) => t.props.includes('scale'));
      const rise = tw.find((t) => t.props.includes('y'));
      const fade = tw.find((t) => t.props.includes('alpha'));
      expect([pop.cfg.scale, pop.cfg.duration]).toEqual([1, 120]);
      expect((t1.y0 - rise.cfg.y) * k).toBeCloseTo(60, 6);
      expect(rise.cfg.duration).toBe(800);
      expect((fade.cfg.delay || 0) + fade.cfg.duration).toBeLessThanOrEqual(800);
    }
  });
  it('apilado: cada número arranca 4 px CSS sobre el borde superior real del anterior (normal o crítico) y nunca se pisan', () => {
    const k = 412 / 824;
    const { s, log } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    log.tweenList.length = 0;
    s.tweens.add = (cfg) => { log.tweenList.push({ targets: [cfg.targets], cfg }); return { stop() {} }; }; // sin aplicar: todos a la vez
    const a = s.actors.e0;
    const ts = [s.floatAt(a, 12, '#fff'), s.floatAt(a, 96, '#fff', true), s.floatAt(a, 7, '#fff'), s.floatAt(a, 55, '#fff', true), s.floatAt(a, 81, '#fff')];
    const rect = (t) => ({ x0: t.x - (t.width * t.scaleX) / 2, x1: t.x + (t.width * t.scaleX) / 2, y0: t.y0 - t.height * t.scaleY, y1: t.y0 });
    // mientras haya sitio arriba, cada uno arranca 4 px CSS sobre el borde superior real (con el pop 1,4) del anterior
    expect(ts[1].y0).toBeCloseTo(rect(ts[0]).y0 - FLOAT_STACK_GAP / k, 6);
    expect(ts[2].y0).toBeCloseTo(rect(ts[1]).y0 - FLOAT_STACK_GAP / k, 6);
    // nunca se pisan (si no queda sitio arriba, columna nueva al lado)
    for (let i = 0; i < ts.length; i++) {
      for (let j = i + 1; j < ts.length; j++) {
        const [p, q] = [rect(ts[i]), rect(ts[j])];
        const overlap = p.x0 < q.x1 && q.x0 < p.x1 && p.y0 < q.y1 && q.y0 < p.y1;
        expect(overlap, `${i}×${j}`).toBe(false);
      }
      expect(rect(ts[i]).y0).toBeGreaterThanOrEqual(0);
      expect(rect(ts[i]).x1).toBeLessThanOrEqual(824);
    }
    // un número que ya se fue no empuja al siguiente: vuelve a arrancar sobre la cabeza
    for (const t of ts) t.destroy();
    const t5 = s.floatAt(a, 3, '#fff');
    expect(t5.y0).toBeCloseTo(a.base.headY - FLOAT_HEAD_GAP / k, 6);
  });
  it('el daño de un golpe sale con floatAt sobre el objetivo', () => {
    const { s, log } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    s.playBeat(BEAT({ kind: 'hit', actorId: 'h1', targetId: 'e1', num: 33 }));
    const txt = log.objects.find((o) => o.kind === 'text' && String(o.text) === '33');
    expect(txt.y0).toBeCloseTo(s.actors.e1.base.headY - FLOAT_HEAD_GAP / (412 / 824), 6);
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
      // tendido dentro del lienzo (largo = alto de la silueta de la pose tendida × DEAD_LEN, el pie como pivote)
      const g = spriteGeom(a.kind, a.art, a.kind === 'enemy' ? 'hit' : 'idle');
      const half = ((g.b - g.t + 1) * a.sp.scaleY) / 2;
      const cx = a.base.x + a.sp.x + Math.sign(a.sp.angle) * half;
      expect(cx - half).toBeGreaterThanOrEqual(0);
      expect(cx + half).toBeLessThanOrEqual(824);
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
  it('el tirador apunta: se inclina hacia el objetivo, como mucho 30°', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    s.time.delayedCall = () => {};
    const r = s.actors.h3; // ranger, a la derecha
    s.playBeat(BEAT({ kind: 'hit', actorId: 'h3', targetId: 'e0', num: 5 })); // objetivo arriba a la izquierda
    expect(r.sp.flipX).toBe(true);
    expect(r.sp.angle).toBeGreaterThan(0);                    // mirando a la izquierda, sube el cañón girando a la derecha
    expect(r.sp.angle).toBeLessThanOrEqual(AIM_MAX_DEG);
    expect(AIM_MAX_DEG).toBe(30);
    const w = s.actors.h1; // warrior: no inclina
    s.playBeat(BEAT({ kind: 'hit', actorId: 'h1', targetId: 'e1', num: 5 }));
    expect(w.sp.angle).toBe(0);
  });
});

describe('B5: el tirador dispara al enemigo, sin fogonazo sobre compañeros', () => {
  const FORMS = [
    [FULL, FULL_NODE],
    [{ ...FULL, enemies: [{ id: 'e0', hp: 100, maxHp: 100 }] }, { id: 'a1n9', type: 'boss', act: 1, isBoss: true }],
    [{ ...FULL, enemies: [0, 1, 2, 3].map((i) => ({ id: `e${i}`, hp: 100, maxHp: 100 })) }, { id: 'a2n10', type: 'boss', act: 2, isBoss: true }],
    [{ ...FULL, enemies: [{ id: 'e0', hp: 100, maxHp: 100 }] }, { id: 'a1n3', type: 'combat', act: 1 }],
  ];
  it('recorta el fogonazo pintado, dispara de la boca del arma al pecho del objetivo y la boca no cae sobre nadie de su bando', () => {
    for (const [state, node] of FORMS) {
      const { s, log } = fakeScene({ state, node });
      s.preload();
      s.create();
      const pending = [];
      s.time.delayedCall = (ms, fn) => { pending.push(fn); };
      const f = computeFormation(state.heroes, enemyList(state), { node, boss: !!node.isBoss });
      const r = s.actors.h3;
      for (const e of f.enemies) {
        const from = log.objects.length;
        s.playBeat(BEAT({ kind: 'hit', actorId: 'h3', targetId: e.id, num: 5 }));
        expect(r.sp.texture).toBe('hero:ranger:attack');
        expect(r.sp.crop, `${node.id} ${e.id}`).toEqual([0, 0, 533, 640]);       // sin el fogonazo de la textura
        const shot = s.lastShot;
        const tgt = s.actors[e.id];
        expect(shot.to).toEqual({ x: tgt.base.x, y: tgt.base.y - tgt.base.alphaH * 0.55 });
        // la estela sale de la boca y apunta al objetivo; el proyectil termina en el objetivo
        const tracer = log.objects.slice(from).find((o) => o.texture === 'tracer');
        expect([tracer.x, tracer.y]).toEqual([shot.muzzle.x, shot.muzzle.y]);
        expect(tracer.rotation).toBeCloseTo(Math.atan2(shot.to.y - shot.muzzle.y, shot.to.x - shot.muzzle.x), 10);
        expect(tracer.scaleX * 64).toBeCloseTo(Math.hypot(shot.to.x - shot.muzzle.x, shot.to.y - shot.muzzle.y), 6);
        // la boca del arma (y su fogonazo) no cae sobre ningún compañero
        for (const h of f.heroes) {
          if (h.id === 'h3') continue;
          const A = h.alpha;
          const inside = shot.muzzle.x > A.x && shot.muzzle.x < A.x + A.w && shot.muzzle.y > A.y && shot.muzzle.y < A.y + A.h;
          expect(inside, `${node.id} → ${e.id}: boca sobre ${h.id}`).toBe(false);
        }
        for (const fn of pending.splice(0)) fn();
        expect(r.sp.isCropped).toBe(false);                     // de vuelta a idle, sin recorte
        expect(r.sp.angle).toBe(0);
      }
    }
  });
  it('la boca del arma se calcula con volteo, escala y giro: sin girar coincide con el píxel de la textura', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    const r = s.actors.h3;
    s.setPose(r, 'attack', false);
    r.sp.setAngle(0);
    const g = spriteGeom('hero', 'ranger', 'attack');
    const sc = r.sp.scaleX;
    const m = s.muzzleWorld(r);
    expect(m.x).toBeCloseTo(r.base.x + (533 - g.ox * g.W) * sc, 6);
    expect(m.y).toBeCloseTo(r.base.y + (184 - g.oy * g.H) * sc, 6);
    s.setPose(r, 'attack', true);
    const mf = s.muzzleWorld(r);
    expect(mf.x).toBeCloseTo(r.base.x - (533 - g.ox * g.W) * sc, 6);      // volteado: espejo alrededor del pie
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

describe('B3: tendidos de derrota (largo ×0,9, todos hacia el mismo lado)', () => {
  it('los 5 héroes caen con la cabeza a la izquierda, ocupan la caja de lyingBox y no se pisan dentro de la fila', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    for (const id of ['h1', 'h2', 'h3', 'h4', 'h5']) s.playBeat(BEAT({ kind: 'death', targetId: id }));
    const f = computeFormation(FULL.heroes, enemyList(FULL), { node: FULL_NODE });
    const rows = { HF: [], HB: [] };
    for (const b of f.heroes) {
      const a = s.actors[b.id];
      expect(a.sp.angle, b.id).toBe(-90);
      const g = spriteGeom('hero', b.art, 'idle');
      const len = (g.b - g.t + 1) * a.sp.scaleY;
      const thick = (g.r - g.l + 1) * a.sp.scaleX;
      expect(len / ((g.b - g.t + 1) * (b.h / g.H))).toBeCloseTo(DEAD_LEN, 10);
      expect(thick / ((g.r - g.l + 1) * (b.h / g.H))).toBeCloseTo(DEAD_FLAT, 10);
      // del pie (pivote) hacia la izquierda: x de la caja tendida = pivote − largo
      const x0 = a.base.x + a.sp.x - len;
      const L = lyingBoxes(f)[b.id];
      expect(Math.abs(x0 - L.x), b.id).toBeLessThan(1e-6);
      rows[b.row].push(L);
    }
    for (const list of Object.values(rows)) {
      for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
        const ov = Math.max(0, Math.min(list[i].x + list[i].w, list[j].x + list[j].w) - Math.max(list[i].x, list[j].x));
        expect(ov / Math.min(list[i].w, list[j].w), `${list[i].id}×${list[j].id}`).toBeLessThanOrEqual(0.1);
      }
    }
  });
});

describe('H2: la escena toma el borde real del HUD y se recoloca si cambia el alto', () => {
  it('con un borde más alto que el de la hoja no cambia nada; con uno más bajo, cada personaje sube a su carril nuevo', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    const antes = Object.fromEntries(Object.values(s.actors).map((a) => [a.id, [a.c.x, a.c.y]]));
    s.setHud({ bottom: 1372.5, top: 276 });          // 412×860: sin cambios visibles
    for (const a of Object.values(s.actors)) expect([a.c.x, a.c.y], a.id).toEqual(antes[a.id]);
    s.setHud({ bottom: 1272, top: 358.5 });          // 375×667 (hud_medidas.json)
    const f = computeFormation(FULL.heroes, enemyList(FULL), { node: FULL_NODE, hud: { bottom: 1272, top: 358.5 } });
    for (const b of [...f.heroes, ...f.enemies]) {
      const a = s.actors[b.id];
      expect([a.c.x, a.c.y], b.id).toEqual([b.cx, b.lane]);
      expect(a.c.depth).toBe(b.lane);
      expect(a.base.headY).toBe(b.alpha.y);
    }
    expect(s.actors.h1.c.y).toBeLessThanOrEqual(1272);
  });
  it('un borde medido antes de crear la escena ya se usa al armar la formación', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.setHud({ bottom: 1316.2, top: 320.8 });         // 360×740, llega antes de create()
    s.preload();
    s.create();
    const f = computeFormation(FULL.heroes, enemyList(FULL), { node: FULL_NODE, hud: { bottom: 1316.2, top: 320.8 } });
    expect(s.actors.h1.c.y).toBe(f.lanes.HF);
  });
  it('un caído se vuelve a tender en su carril nuevo', () => {
    const { s } = fakeScene({ state: FULL, node: FULL_NODE });
    s.preload();
    s.create();
    s.playBeat(BEAT({ kind: 'death', targetId: 'h2' }));
    s.setHud({ bottom: 1272, top: 358.5 });
    const a = s.actors.h2;
    expect(Math.abs(a.sp.angle)).toBe(90);
    expect(a.c.y).toBeLessThanOrEqual(1272);
  });
});
