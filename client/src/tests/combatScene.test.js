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

import CombatScene from '../game/combat/CombatScene';
import { createCombatGame, buildCombatConfig } from '../game/combat/createCombatGame';
import { QUALITY } from '../game/combat/combatQuality';

const chain = () => { const o = { setDepth: () => o, setOrigin: () => o, setScale: () => o, setAlpha: () => o, setTint: () => o, setTintFill: () => o, clearTint: () => o, setTexture: () => o, setBlendMode: () => o, destroy: () => {}, setParticleTint: () => {}, explode: () => {}, width: 100, height: 100, displayWidth: 100, active: true }; return o; };

function fakeScene({ quality = 'medium', postFX = true, failTextures = [], reduced = false, state, node } = {}) {
  const s = new CombatScene();
  const log = { pointlights: 0, vignette: 0, bloom: 0, shake: 0, tweens: 0, warns: [], textures: new Set(['spark', 'shadow', 'fog']), placeholders: [] };
  const loaders = {};
  s.load = { on: (ev, fn) => { loaders[ev] = fn; }, image: (key) => { if (failTextures.includes(key)) setTimeout(() => {}, 0); else log.textures.add(key); } };
  s.textures = { exists: (k) => log.textures.has(k) };
  s.make = { graphics: () => ({ fillStyle() {}, fillCircle() {}, fillEllipse() {}, fillRect() {}, fillRoundedRect() {}, generateTexture: (k) => { log.textures.add(k); log.placeholders.push(k); }, clear() {}, destroy() {} }) };
  s.add = {
    image: () => chain(), rectangle: () => chain(), text: () => chain(), particles: () => chain(),
    pointlight: () => { log.pointlights += 1; return chain(); },
  };
  s.tweens = { add: () => { log.tweens += 1; return { pause() {}, resume() {} }; }, timeScale: 1 };
  s.time = { delayedCall: (ms, fn) => fn(), timeScale: 1 };
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
