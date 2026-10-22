/**
 * ui_kit_b R11/R12 — loadUiFonts: espera la carga, nunca rechaza, respeta el timeout.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { loadUiFonts } from '../game/fonts.js';

const realFonts = Object.getOwnPropertyDescriptor(document, 'fonts');

function setFonts(value) {
  Object.defineProperty(document, 'fonts', { configurable: true, value });
}

afterEach(() => {
  vi.useRealTimers();
  if (realFonts) Object.defineProperty(document, 'fonts', realFonts);
  else delete document.fonts;
});

describe('loadUiFonts', () => {
  it('R11: pide las dos familias y resuelve después de que carguen', async () => {
    const order = [];
    setFonts({
      load: vi.fn((spec) => new Promise((res) => setTimeout(() => { order.push(`loaded:${spec}`); res([]); }, 5))),
    });
    await loadUiFonts();
    order.push('resolved');
    expect(document.fonts.load).toHaveBeenCalledWith("16px 'IM Fell English'");
    expect(document.fonts.load).toHaveBeenCalledWith("16px 'IM Fell English SC'");
    expect(order[order.length - 1]).toBe('resolved');
    expect(order.filter((x) => x.startsWith('loaded:'))).toHaveLength(2);
  });

  it('R12: si document.fonts.load rechaza, resuelve sin lanzar', async () => {
    setFonts({ load: vi.fn(() => Promise.reject(new Error('boom'))) });
    await expect(loadUiFonts()).resolves.toBeUndefined();
  });

  it('R12: si load lanza síncrono, resuelve sin lanzar', async () => {
    setFonts({ load: vi.fn(() => { throw new Error('sync'); }) });
    await expect(loadUiFonts()).resolves.toBeUndefined();
  });

  it('R12: si la carga no termina, resuelve al cumplirse el timeout (3000 ms por defecto)', async () => {
    vi.useFakeTimers();
    setFonts({ load: vi.fn(() => new Promise(() => {})) });
    let done = false;
    const p = loadUiFonts().then(() => { done = true; });
    await vi.advanceTimersByTimeAsync(2999);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(2);
    await p;
    expect(done).toBe(true);
  });

  it('resuelve de inmediato si document.fonts no existe (jsdom)', async () => {
    setFonts(undefined);
    await expect(loadUiFonts()).resolves.toBeUndefined();
  });
});
