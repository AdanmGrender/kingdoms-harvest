import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import fs from 'node:fs';
import path from 'node:path';

const made = [];
vi.mock('../game/combat/createCombatGame', () => ({
  createCombatGame: vi.fn((parent, opts) => {
    const canvas = document.createElement('canvas');
    parent.appendChild(canvas);
    const scene = { played: [], playRound(events, state) { this.played.push({ events, state }); } };
    const game = { destroyed: 0, destroy: vi.fn((rm) => { game.destroyed += 1; if (rm) canvas.remove(); }), scene, opts };
    made.push(game);
    setTimeout(() => opts.onReady && opts.onReady(scene), 0);
    return game;
  }),
}));

import CombatStage, { canRenderCombat } from '../components/campaign/CombatStage';
import EventBridge from '../game/EventBridge';
import { createCombatGame } from '../game/combat/createCombatGame';

const CH = ['combat:open', 'combat:close', 'combat:round-done'];
const hero = (hp) => ({ slot: 1, heroId: null, class: 'warrior', hp, maxHp: 100, alive: hp > 0 });
const st = (e, h) => ({ round: 1, enemy: { hp: e, maxHp: 100 }, heroes: [hero(h)] });
const NODE = { id: 'a1n3', type: 'combat' };
const flush = () => act(async () => { await new Promise((r) => setTimeout(r, 5)); });

beforeEach(() => {
  made.length = 0;
  vi.clearAllMocks();
  window.WebGLRenderingContext = function WebGL() {};
});
afterEach(() => { cleanup(); delete window.WebGLRenderingContext; EventBridge.removeAllListeners(); });

describe('R36: contenedor', () => {
  it('alto var(--kh-frame-h), sin unidades de viewport', async () => {
    const { container } = render(<CombatStage state={st(100, 100)} node={NODE} />);
    await flush();
    const host = container.querySelector('[data-combat-stage]');
    expect(host.style.height).toBe('var(--kh-frame-h)');
    expect(host.getAttribute('style')).not.toMatch(/\d\s*(d|s)?v[hw]|screen/);
  });
});

describe('R38: ciclo de vida', () => {
  it('montar y desmontar: destroy(true) una vez y 0 listeners de EventBridge', async () => {
    const seen = [];
    EventBridge.on('combat:open', () => seen.push('open'));
    EventBridge.on('combat:close', () => seen.push('close'));
    const { unmount } = render(<CombatStage state={st(100, 100)} node={NODE} />);
    await flush();
    expect(made).toHaveLength(1);
    expect(seen).toEqual(['open']);
    unmount();
    expect(made[0].destroy).toHaveBeenCalledTimes(1);
    expect(made[0].destroy).toHaveBeenCalledWith(true);
    expect(seen).toEqual(['open', 'close']);
    EventBridge.removeAllListeners();
    for (const ev of CH) expect(EventBridge.listenerCount(ev)).toBe(0);
  });

  it('el stage no deja ningún listener propio tras desmontar', async () => {
    const before = CH.map((e) => EventBridge.listenerCount(e));
    const { unmount } = render(<CombatStage state={st(100, 100)} node={NODE} />);
    await flush();
    unmount();
    expect(CH.map((e) => EventBridge.listenerCount(e))).toEqual(before);
  });

  it('dos montajes seguidos → a lo sumo un <canvas> de combate', async () => {
    const a = render(<CombatStage state={st(100, 100)} node={NODE} />);
    await flush();
    a.unmount();
    const b = render(<CombatStage state={st(100, 100)} node={NODE} />);
    await flush();
    expect(document.querySelectorAll('canvas').length).toBeLessThanOrEqual(1);
    b.unmount();
    expect(document.querySelectorAll('canvas').length).toBe(0);
  });

  it('desmontar antes de que cargue el módulo no crea juego ni emite close', async () => {
    const seen = [];
    EventBridge.on('combat:close', () => seen.push('close'));
    const { unmount } = render(<CombatStage state={st(100, 100)} node={NODE} />);
    unmount();
    await flush();
    expect(made).toHaveLength(0);
    expect(seen).toEqual([]);
  });

  it('onRoundDone de la escena se reenvía como combat:round-done', async () => {
    const got = [];
    EventBridge.on('combat:round-done', (i) => got.push(i));
    render(<CombatStage state={st(100, 100)} node={NODE} />);
    await flush();
    made[0].opts.onRoundDone({ lastT: 7 });
    expect(got).toEqual([{ lastT: 7 }]);
  });
});

describe('R19c: modo unavailable', () => {
  it('sin WebGL/canvas → unavailable en el primer render, sin crear juego ni emitir open', async () => {
    delete window.WebGLRenderingContext;
    expect(canRenderCombat()).toBe(false);
    const modes = [];
    const seen = [];
    EventBridge.on('combat:open', () => seen.push('open'));
    const { container } = render(<CombatStage state={st(100, 100)} node={NODE} onMode={(m) => modes.push(m)} />);
    expect(container.querySelector('[data-combat-stage]').dataset.combatStage).toBe('unavailable');
    expect(modes).toEqual(['unavailable']);
    await flush();
    expect(createCombatGame).not.toHaveBeenCalled();
    expect(seen).toEqual([]);
  });

  it('createCombatGame lanza → unavailable, un warn y el desmontaje no falla', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    createCombatGame.mockImplementationOnce(() => { throw new Error('sin contexto'); });
    const modes = [];
    const { unmount, container } = render(<CombatStage state={st(100, 100)} node={NODE} onMode={(m) => modes.push(m)} />);
    await flush();
    expect(container.querySelector('[data-combat-stage]').dataset.combatStage).toBe('unavailable');
    expect(modes).toEqual(['unavailable']);
    expect(warn).toHaveBeenCalled();
    expect(() => unmount()).not.toThrow();
    warn.mockRestore();
  });
});

describe('rondas: eventos hacia la escena', () => {
  it('step de motor v1 → eventos sintéticos a la escena; mismo step.id no se repite', async () => {
    const { rerender } = render(<CombatStage state={st(100, 100)} node={NODE} />);
    await flush();
    const step = { id: 1, state: st(70, 90), roundLog: { round: 1 }, action: { type: 'advance' } };
    rerender(<CombatStage state={st(100, 100)} node={NODE} step={step} />);
    expect(made[0].scene.played).toHaveLength(1);
    expect(made[0].scene.played[0].events.map((e) => [e.kind, e.target, e.value])).toEqual([['hit', 'e0', 30], ['hit', 'h1', 10]]);
    rerender(<CombatStage state={st(100, 100)} node={NODE} step={{ ...step }} />);
    expect(made[0].scene.played).toHaveLength(1);
  });

  it('una ronda que llega antes de que la escena esté lista se encola y se entrega al listo', async () => {
    const { rerender } = render(<CombatStage state={st(100, 100)} node={NODE} />);
    // El juego aún no existe (import pendiente); llega la ronda.
    rerender(<CombatStage state={st(100, 100)} node={NODE} step={{ id: 1, state: st(60, 100), roundLog: { round: 1 } }} />);
    await flush();
    expect(made[0].scene.played).toHaveLength(1);
  });
});

describe('R39: PhaserGame duerme y despierta el hub', () => {
  it('combat:open → game.loop.sleep(); combat:close → wake(); y se desengancha al desmontar', async () => {
    vi.resetModules();
    const loop = { sleep: vi.fn(), wake: vi.fn() };
    vi.doMock('phaser', () => {
      class Game { constructor() { this.loop = loop; this.registry = { set() {} }; this.scale = { resize() {}, setZoom() {} }; } destroy() {} }
      const P = { Game, AUTO: 0, Scale: {} };
      return { default: P, ...P };
    });
    vi.doMock('../game/config', () => ({ buildGameConfig: () => ({}), ISO_MODE: false }));
    const { default: PhaserGame } = await import('../game/PhaserGame');
    const { default: Bridge } = await import('../game/EventBridge');
    const { unmount } = render(<PhaserGame entry="hub" />);
    Bridge.emit('combat:open', {});
    expect(loop.sleep).toHaveBeenCalledTimes(1);
    Bridge.emit('combat:close', {});
    expect(loop.wake).toHaveBeenCalledTimes(1);
    unmount();
    Bridge.emit('combat:open', {});
    expect(loop.sleep).toHaveBeenCalledTimes(1);
    vi.doUnmock('phaser'); vi.doUnmock('../game/config');
  });

  it('el enganche en PhaserGame.jsx ocupa ≤ 15 líneas añadidas', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../game/PhaserGame.jsx'), 'utf8');
    const lines = src.split(/\r?\n/).filter((l) => /combat|sleepHub|wakeHub/.test(l));
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(lines.length).toBeLessThanOrEqual(15);
  });
});
