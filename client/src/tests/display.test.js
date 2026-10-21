import { describe, it, expect } from 'vitest';
import {
  MAX_RENDER_SCALE,
  TAP_SLOP_CSS,
  computeRenderScale,
  computeBackingSize,
  buildDisplaySettings,
  resolveStartScene,
  textResolutionFor,
} from '../game/display';

describe('display — computeRenderScale (R39)', () => {
  it.each([
    [0.5, 1],
    [1, 1],
    [2, 2],
    [2.625, 2.625],
    [3, 3],
    [4, 3],
    [undefined, 1],
    [NaN, 1],
  ])('dpr %s → %s', (dpr, s) => {
    expect(computeRenderScale(dpr)).toBe(s);
  });

  it('tope = MAX_RENDER_SCALE = 3', () => {
    expect(MAX_RENDER_SCALE).toBe(3);
    expect(computeRenderScale(Infinity)).toBe(1);
  });
});

describe('display — computeBackingSize (R39)', () => {
  it('412×860 @2 → 824×1720, zoom 0.5', () => {
    expect(computeBackingSize(412, 860, 2)).toEqual({ width: 824, height: 1720, zoom: 0.5 });
  });

  it('412×860 @3 → 1236×2580, zoom 1/3', () => {
    const b = computeBackingSize(412, 860, 3);
    expect(b.width).toBe(1236);
    expect(b.height).toBe(2580);
    expect(b.zoom).toBeCloseTo(1 / 3, 10);
  });

  it('redondea con DPR fraccionario (393×851 @2.625)', () => {
    expect(computeBackingSize(393, 851, 2.625)).toMatchObject({ width: 1032, height: 2234 });
  });
});

describe('display — buildDisplaySettings', () => {
  it('preview = config actual (R46)', () => {
    expect(buildDisplaySettings({ entry: 'preview', cssWidth: 412, cssHeight: 860, dpr: 2 })).toEqual({
      entry: 'preview',
      mode: 'RESIZE',
      renderScale: 1,
      width: '100%',
      height: '100%',
      zoom: 1,
      pixelArt: true,
      antialias: false,
      roundPixels: true,
      scenes: ['BootScene', 'WorldScene', 'IsoScene', 'IsoWorldScene'],
    });
  });

  it('entry desconocido o ausente → preview', () => {
    expect(buildDisplaySettings({ entry: 'otra', cssWidth: 412, cssHeight: 860, dpr: 3 }).entry).toBe('preview');
    expect(buildDisplaySettings().mode).toBe('RESIZE');
  });

  it('hub @2: NONE, búfer 824×1720, zoom 0.5, filtrado lineal (R1, R39)', () => {
    expect(buildDisplaySettings({ entry: 'hub', cssWidth: 412, cssHeight: 860, dpr: 2 })).toEqual({
      entry: 'hub',
      mode: 'NONE',
      renderScale: 2,
      width: 824,
      height: 1720,
      zoom: 0.5,
      pixelArt: false,
      antialias: true,
      roundPixels: false,
      scenes: ['BootScene', 'HubSceneB'],
    });
  });

  it('hub @3: búfer 1236×2580', () => {
    const s = buildDisplaySettings({ entry: 'hub', cssWidth: 412, cssHeight: 860, dpr: 3 });
    expect(s).toMatchObject({ renderScale: 3, width: 1236, height: 2580 });
  });

  it('hub con contenedor en 0 px o DPR inválido nunca da canvas de 0', () => {
    const s = buildDisplaySettings({ entry: 'hub', cssWidth: 0, cssHeight: -5, dpr: NaN });
    expect(s).toMatchObject({ renderScale: 1, width: 1, height: 1, zoom: 1 });
  });
});

describe('display — resolveStartScene (R1, R46)', () => {
  it('hub → HubSceneB (aunque haya isoMode o ?iso=1)', () => {
    expect(resolveStartScene({ entry: 'hub', isoMode: true, search: '?iso=1' })).toBe('HubSceneB');
  });

  it('isoMode → IsoWorldScene', () => {
    expect(resolveStartScene({ entry: 'preview', isoMode: true, search: '' })).toBe('IsoWorldScene');
  });

  it('?iso=1 → IsoScene', () => {
    expect(resolveStartScene({ entry: 'preview', isoMode: false, search: '?preview=world&iso=1' })).toBe('IsoScene');
  });

  it('preview por defecto → WorldScene', () => {
    expect(resolveStartScene({ entry: 'preview', isoMode: false, search: '?preview=world' })).toBe('WorldScene');
  });

  it('entry desconocido → WorldScene', () => {
    expect(resolveStartScene({ entry: 'xyz' })).toBe('WorldScene');
    expect(resolveStartScene()).toBe('WorldScene');
  });
});

describe('display — textResolutionFor (R44) y slop (R22)', () => {
  it.each([
    [0.5, 1],
    [1, 1],
    [1.5, 1.5],
  ])('zoom %s → %s', (zoom, r) => {
    expect(textResolutionFor(zoom)).toBe(r);
  });

  it('TAP_SLOP_CSS = 12 px CSS', () => {
    expect(TAP_SLOP_CSS).toBe(12);
  });
});
