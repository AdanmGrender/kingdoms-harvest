// fix_pantalla_movil — alto visible, tope de aspecto, safe-area y barrido de h-screen.
import { describe, it, expect, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { MAX_ASPECT, computeAppHeight, installViewportVars } from '../utils/viewport';

const SRC = path.resolve(__dirname, '..');
const read = (...p) => fs.readFileSync(path.join(SRC, ...p), 'utf8');

describe('computeAppHeight', () => {
  it('Telegram válido: mínimo entre viewportStableHeight e innerHeight', () => {
    expect(computeAppHeight({ tgInitData: 'x=1', tgStableHeight: 640, innerHeight: 700, supportsDvh: true })).toBe(640);
    expect(computeAppHeight({ tgInitData: 'x=1', tgStableHeight: 720, innerHeight: 700, supportsDvh: true })).toBe(700);
  });
  it('Telegram con initData vacío cae a dvh / innerHeight', () => {
    expect(computeAppHeight({ tgInitData: '', tgStableHeight: 640, innerHeight: 700, supportsDvh: true })).toBeNull();
    expect(computeAppHeight({ tgInitData: '', tgStableHeight: 640, innerHeight: 700.4, supportsDvh: false })).toBe(700);
  });
  it('viewportStableHeight 0 o ausente no usa Telegram', () => {
    expect(computeAppHeight({ tgInitData: 'x=1', tgStableHeight: 0, innerHeight: 700, supportsDvh: true })).toBeNull();
    expect(computeAppHeight({ tgInitData: 'x=1', tgStableHeight: undefined, innerHeight: 700, supportsDvh: false })).toBe(700);
  });
  it('sin soporte de dvh → innerHeight; con soporte → null (manda 100dvh)', () => {
    expect(computeAppHeight({ innerHeight: 783.2, supportsDvh: false })).toBe(783);
    expect(computeAppHeight({ innerHeight: 783, supportsDvh: true })).toBeNull();
    expect(computeAppHeight({ innerHeight: 0, supportsDvh: false })).toBeNull();
  });
});

function fakeEnv({ tg, dvh = true, innerHeight = 800 } = {}) {
  const listeners = {};
  const style = { props: {}, setProperty(k, v) { this.props[k] = v; }, removeProperty(k) { delete this.props[k]; } };
  const win = {
    innerHeight,
    Telegram: tg ? { WebApp: tg } : undefined,
    CSS: { supports: () => dvh },
    addEventListener: vi.fn((ev, fn) => { (listeners[ev] ||= new Set()).add(fn); }),
    removeEventListener: vi.fn((ev, fn) => { listeners[ev]?.delete(fn); }),
  };
  const doc = { documentElement: { style } };
  return { win, doc, style, listeners };
}

describe('installViewportVars', () => {
  it('con dvh no fija la variable; sin dvh la fija y la recalcula en resize', () => {
    const a = fakeEnv({ dvh: true });
    installViewportVars({ win: a.win, doc: a.doc });
    expect(a.style.props['--kh-app-h']).toBeUndefined();

    const b = fakeEnv({ dvh: false, innerHeight: 700 });
    installViewportVars({ win: b.win, doc: b.doc });
    expect(b.style.props['--kh-app-h']).toBe('700px');
    b.win.innerHeight = 650;
    b.listeners.resize.forEach((fn) => fn());
    expect(b.style.props['--kh-app-h']).toBe('650px');
    b.win.innerHeight = 600;
    b.win.CSS.supports = () => true;
    b.listeners.orientationchange.forEach((fn) => fn());
    expect(b.style.props['--kh-app-h']).toBeUndefined();
  });

  it('Telegram: usa viewportStableHeight y reacciona a viewportChanged; el cleanup desregistra todo', () => {
    const handlers = {};
    const tg = {
      initData: 'query_id=1', viewportStableHeight: 640,
      onEvent: vi.fn((ev, fn) => { handlers[ev] = fn; }),
      offEvent: vi.fn((ev, fn) => { if (handlers[ev] === fn) delete handlers[ev]; }),
    };
    const e = fakeEnv({ tg, innerHeight: 700 });
    const cleanup = installViewportVars({ win: e.win, doc: e.doc });
    expect(e.style.props['--kh-app-h']).toBe('640px');
    tg.viewportStableHeight = 560;
    handlers.viewportChanged();
    expect(e.style.props['--kh-app-h']).toBe('560px');
    expect(Object.keys(e.listeners).sort()).toEqual(['orientationchange', 'resize']);
    cleanup();
    expect(e.listeners.resize.size).toBe(0);
    expect(e.listeners.orientationchange.size).toBe(0);
    expect(handlers.viewportChanged).toBeUndefined();
  });
});

describe('tokens y meta viewport', () => {
  it('index.html: viewport-fit=cover y los tokens de siempre', () => {
    const html = fs.readFileSync(path.resolve(SRC, '..', 'index.html'), 'utf8');
    const meta = html.match(/<meta name="viewport" content="([^"]+)"/)[1];
    for (const t of ['width=device-width', 'initial-scale=1.0', 'maximum-scale=1.0', 'user-scalable=no', 'viewport-fit=cover']) {
      expect(meta).toContain(t);
    }
  });
  it('index.css: --kh-max-aspect espeja MAX_ASPECT; dvh bajo @supports; marco con contain: layout; safe-area', () => {
    const css = read('styles', 'index.css');
    expect(css).toContain(`--kh-max-aspect: ${MAX_ASPECT};`);
    expect(css).toContain('@supports (height: 100dvh)');
    expect(css).toMatch(/\.kh-frame\s*\{[^}]*contain:\s*layout/);
    for (const side of ['top', 'right', 'bottom', 'left']) {
      expect(css).toContain(`env(safe-area-inset-${side}, 0px)`);
    }
  });
});

describe('barrido de h-screen / w-screen', () => {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) return d.name === 'tests' ? [] : walk(p);
    return d.name.endsWith('.jsx') ? [p] : [];
  });
  it('ningún .jsx usa h-screen ni w-screen en código (comentarios aparte)', () => {
    const bad = [];
    for (const f of walk(SRC)) {
      const code = fs.readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
      if (/\b(h|w)-screen\b/.test(code)) bad.push(path.relative(SRC, f));
    }
    expect(bad).toEqual([]);
  });
});
