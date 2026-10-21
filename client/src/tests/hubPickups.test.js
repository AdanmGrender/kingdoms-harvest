import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import {
  PICKUP_HOSTS, MAX_PICKUPS_PER_BUILDING, PICKUP_H, PICKUP_BOB, PICKUP_MIN_HIT, PICKUP_FLY_MS, PICKUP_REFRESH_MS,
  ANIMAL_PRODUCT, PICKUP_ICONS, PICKUP_TEXTURES,
  selectPickups, pickupPosition, pickupHitSize, cssToWorld, createPickupController,
} from '../game/hub/hubPickups';
import { HUB_SLOTS, HUB_W, SAFE_TOP, SAFE_BOTTOM, SAFE_LEFT, SAFE_RIGHT } from '../game/hub/hubLayout';

// shared/ es CommonJS fuera de la raíz de Vite: se lee solo en el test para verificar el espejo.
const require = createRequire(import.meta.url);
const { ANIMALS } = require('../../../shared/gameConfig.js');

const NOW = Date.parse('2026-10-20T12:00:00Z');
const built = new Set(['farm_plot', 'stable']);
const past = '2026-10-20T11:00:00Z';
const future = '2026-10-20T13:00:00Z';
const plot = (id, state = 'ready', crop_id = 'wheat') => ({ id, state, crop_id });
const animal = (id, animal_id = 'chicken', over = {}) => ({
  id, animal_id, is_fed: true, next_production_at: past, ...over,
});
const sel = (over = {}) => selectPickups({ plots: [], animals: [], builtIds: built, now: NOW, ...over });

describe('constantes (R10, R11, R18, R20)', () => {
  it('respetan los límites del spec', () => {
    expect(PICKUP_BOB).toBeLessThanOrEqual(6);
    expect(PICKUP_FLY_MS).toBeLessThanOrEqual(700);
    expect(PICKUP_MIN_HIT).toBe(88);
    expect(PICKUP_REFRESH_MS).toBe(5000);
    expect(MAX_PICKUPS_PER_BUILDING).toBe(3);
    expect(PICKUP_HOSTS).toEqual({ crop: 'farm_plot', animal: 'stable' });
  });

  it('PICKUP_TEXTURES: una por ícono, bajo /assets/b/pickups/', () => {
    expect(PICKUP_TEXTURES.map((t) => t.url).sort()).toEqual([
      '/assets/b/pickups/egg_basket.webp', '/assets/b/pickups/milk_pail.webp',
      '/assets/b/pickups/sack.webp', '/assets/b/pickups/wool_bale.webp',
    ]);
    for (const t of PICKUP_TEXTURES) expect(t.key).toMatch(/^hubb_pk_/);
  });
});

describe('ANIMAL_PRODUCT espeja ANIMALS de shared/gameConfig.js (R2)', () => {
  it('mismo producto por animal_id', () => {
    for (const [id, a] of Object.entries(ANIMALS)) expect(ANIMAL_PRODUCT[id]).toBe(a.product);
    expect(Object.keys(ANIMAL_PRODUCT).sort()).toEqual(Object.keys(ANIMALS).sort());
  });

  it('cada producto tiene ícono', () => {
    for (const p of Object.values(ANIMAL_PRODUCT)) expect(PICKUP_ICONS[p]).toBeTruthy();
  });
});

describe('selectPickups', () => {
  it('parcela lista → saco; no lista → nada (R1)', () => {
    const r = sel({ plots: [plot(1, 'ready', 'carrot'), plot(2, 'growing'), plot(3, 'empty')] });
    expect(r).toEqual([{
      key: 'plot:1', type: 'crop', host: 'farm_plot', id: 1, icon: 'sack', resourceKey: 'carrot',
    }]);
  });

  it('animal listo según producto; no listo / sin next_production_at / no alimentado → nada (R2)', () => {
    const r = sel({
      animals: [
        animal(1, 'chicken'), animal(2, 'cow'), animal(3, 'sheep'),
      ],
    });
    expect(r.map((p) => [p.key, p.icon, p.resourceKey])).toEqual([
      ['animal:1', 'egg_basket', 'egg'], ['animal:2', 'milk_pail', 'milk'], ['animal:3', 'wool_bale', 'wool'],
    ]);
    expect(sel({ animals: [animal(1, 'cow', { next_production_at: future })] })).toEqual([]);
    expect(sel({ animals: [animal(1, 'cow', { next_production_at: null })] })).toEqual([]);
    expect(sel({ animals: [animal(1, 'cow', { next_production_at: 'basura' })] })).toEqual([]);
    expect(sel({ animals: [animal(1, 'cow', { is_fed: false })] })).toEqual([]);
  });

  it('animal listo justo en now cuenta (<=)', () => {
    expect(sel({ animals: [animal(1, 'cow', { next_production_at: new Date(NOW).toISOString() })] })).toHaveLength(1);
  });

  it('animal_id desconocido se omite sin romper (R3)', () => {
    expect(sel({ animals: [animal(1, 'dragon'), animal(2, 'toString'), animal(3, 'cow')] }).map((p) => p.id)).toEqual([3]);
  });

  it('anfitrión ausente o en construcción → sin objetos (R9)', () => {
    const plots = [plot(1)];
    const animals = [animal(1)];
    expect(sel({ plots, animals, builtIds: new Set() })).toEqual([]);
    expect(sel({ plots, animals, builtIds: new Set(['stable']) }).map((p) => p.host)).toEqual(['stable']);
    expect(sel({ plots, animals, builtIds: new Set(['farm_plot']) }).map((p) => p.host)).toEqual(['farm_plot']);
  });

  it('tope de 3 por anfitrión y orden por id (R4)', () => {
    const plots = [plot(9), plot(2), plot(7), plot(1), plot(5)];
    expect(sel({ plots }).map((p) => p.id)).toEqual([1, 2, 5]);
    const animals = [animal(8), animal(3), animal(4), animal(1)];
    expect(sel({ animals }).map((p) => p.id)).toEqual([1, 3, 4]);
    expect(sel({ plots, animals })).toHaveLength(6);
  });

  it('solo farm_plot y stable son anfitriones (R24)', () => {
    const r = sel({
      plots: [plot(1)], animals: [animal(1)],
      builtIds: new Set(['sawmill', 'mine', 'smithy', 'market', 'mill', 'tavern', 'farm_plot', 'stable']),
    });
    expect(new Set(r.map((p) => p.host))).toEqual(new Set(['farm_plot', 'stable']));
  });

  it('entradas inválidas no rompen', () => {
    expect(selectPickups({ plots: null, animals: undefined, builtIds: built, now: NOW })).toEqual([]);
    expect(sel({ plots: [null, plot(1)], animals: [null] })).toHaveLength(1);
  });

  it('R6: cambiar now hace aparecer el animal (reloj falso)', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(Date.parse('2026-10-20T12:30:00Z'));
      const a = animal(1, 'cow', { next_production_at: '2026-10-20T12:40:00Z' });
      expect(sel({ animals: [a], now: Date.now() })).toEqual([]);
      vi.advanceTimersByTime(PICKUP_REFRESH_MS * 120); // +10 min
      expect(sel({ animals: [a], now: Date.now() })).toHaveLength(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe('pickupPosition (R10)', () => {
  for (const host of ['farm_plot', 'stable']) {
    it(`${host}: count 1..3 dentro del área segura`, () => {
      const slot = HUB_SLOTS[host];
      for (let count = 1; count <= 3; count++) {
        for (let i = 0; i < count; i++) {
          const { x, y } = pickupPosition(slot, host, i, count);
          expect(x - PICKUP_H / 2).toBeGreaterThanOrEqual(SAFE_LEFT);
          expect(x + PICKUP_H / 2).toBeLessThanOrEqual(SAFE_RIGHT);
          expect(y - PICKUP_H).toBeGreaterThanOrEqual(SAFE_TOP);
          expect(y).toBeLessThanOrEqual(SAFE_BOTTOM);
        }
      }
    });
  }

  it('fila centrada y ordenada', () => {
    const slot = { x: 300, y: 1000 };
    expect(pickupPosition(slot, 'stable', 0, 1).x).toBe(300);
    const xs = [0, 1, 2].map((i) => pickupPosition(slot, 'stable', i, 3).x);
    expect(xs[1]).toBe(300);
    expect(xs[0]).toBeLessThan(xs[1]);
    expect(xs[2]).toBeGreaterThan(xs[1]);
  });
});

describe('pickupHitSize (R18)', () => {
  it('nunca baja de 88 px lógicos (44 px CSS)', () => {
    expect(pickupHitSize(60, 84)).toEqual({ w: 88, h: 88 });
    expect(pickupHitSize(120, 100)).toEqual({ w: 120, h: 100 });
    expect(pickupHitSize(PICKUP_H, PICKUP_H).w).toBeGreaterThanOrEqual(PICKUP_MIN_HIT);
  });
});

describe('cssToWorld (R20, R21)', () => {
  const worldView = { x: 0, y: 100, width: 824, height: 1500 };
  for (const dpr of [1, 2, 3]) {
    it(`DPR ${dpr}`, () => {
      // Canvas 412×860 CSS; zoom = ancho de juego / HUB_W; el punto CSS (206, 30) cae en el centro horizontal.
      const gameW = 412 * dpr;
      const zoom = gameW / HUB_W;
      const r = cssToWorld(
        { cssX: 206, cssY: 30 },
        { canvasRect: { left: 0, top: 0 }, renderScale: dpr, worldView, zoom },
      );
      expect(r.x).toBeCloseTo(HUB_W / 2, 6);
      expect(r.y).toBeCloseTo(100 + (30 * dpr) / zoom, 6);
    });
  }

  it('descuenta el origen del canvas', () => {
    const r = cssToWorld(
      { cssX: 110, cssY: 70 },
      { canvasRect: { left: 10, top: 20 }, renderScale: 1, worldView, zoom: 1 },
    );
    expect(r).toEqual({ x: 100, y: 150 });
  });

  it('sin punto → borde superior centrado', () => {
    expect(cssToWorld(null, { canvasRect: { left: 0, top: 0 }, renderScale: 2, worldView, zoom: 1 }))
      .toEqual({ x: HUB_W / 2, y: 124 });
  });
});

describe('createPickupController', () => {
  function setup(snapshot, actionsOver = {}) {
    const state = { snapshot };
    const calls = { add: [], remove: [], busy: [], collected: [] };
    const actions = {
      harvestCrop: vi.fn().mockResolvedValue({ quantity: 3 }),
      collectAnimalProduct: vi.fn().mockResolvedValue({ product: 'egg' }),
      ...actionsOver,
    };
    const ctl = createPickupController({
      getSnapshot: () => state.snapshot,
      actions,
      onAdd: (p) => calls.add.push(p.key),
      onRemove: (p) => calls.remove.push(p.key),
      onBusy: (p, b) => calls.busy.push([p.key, b]),
      onCollected: (p) => calls.collected.push(p.key),
    });
    return { state, calls, actions, ctl };
  }
  const snap = (over = {}) => ({ plots: [], animals: [], builtIds: built, now: NOW, ...over });

  it('sync hace diff por clave (R5)', () => {
    const { state, calls, ctl } = setup(snap({ plots: [plot(1), plot(2)] }));
    ctl.sync();
    expect(calls.add).toEqual(['plot:1', 'plot:2']);
    ctl.sync();
    expect(calls.add).toHaveLength(2); // sin repetir
    state.snapshot = snap({ plots: [plot(2), plot(3)] });
    ctl.sync();
    expect(calls.remove).toEqual(['plot:1']);
    expect(calls.add).toEqual(['plot:1', 'plot:2', 'plot:3']);
    expect(ctl.has('plot:2')).toBe(true);
    expect(ctl.has('plot:1')).toBe(false);
  });

  it('tap de parcela: una llamada, éxito → onCollected (R15, R16)', async () => {
    const { calls, actions, ctl } = setup(snap({ plots: [plot(4)] }));
    ctl.sync();
    await ctl.tap('plot:4');
    expect(actions.harvestCrop).toHaveBeenCalledTimes(1);
    expect(actions.harvestCrop).toHaveBeenCalledWith(4);
    expect(calls.busy).toEqual([['plot:4', true]]);
    expect(calls.collected).toEqual(['plot:4']);
    expect(ctl.has('plot:4')).toBe(false);
  });

  it('tap de animal usa collectAnimalProduct', async () => {
    const { calls, actions, ctl } = setup(snap({ animals: [animal(7, 'cow')] }));
    ctl.sync();
    await ctl.tap('animal:7');
    expect(actions.collectAnimalProduct).toHaveBeenCalledWith(7);
    expect(actions.harvestCrop).not.toHaveBeenCalled();
    expect(calls.collected).toEqual(['animal:7']);
  });

  it('doble tap → 1 sola llamada (R19)', async () => {
    const { actions, calls, ctl } = setup(snap({ plots: [plot(1)] }));
    ctl.sync();
    await Promise.all([ctl.tap('plot:1'), ctl.tap('plot:1'), ctl.tap('plot:1')]);
    expect(actions.harvestCrop).toHaveBeenCalledTimes(1);
    expect(calls.collected).toEqual(['plot:1']);
  });

  it('clave inexistente se ignora', async () => {
    const { actions, ctl } = setup(snap());
    await ctl.tap('plot:99');
    expect(actions.harvestCrop).not.toHaveBeenCalled();
  });

  it('rechazo → onBusy(false), sin vuelo, y se puede reintentar (R23)', async () => {
    const harvestCrop = vi.fn().mockRejectedValueOnce(new Error('400')).mockResolvedValue({ ok: 1 });
    const { calls, ctl } = setup(snap({ plots: [plot(1)] }), { harvestCrop });
    ctl.sync();
    await ctl.tap('plot:1');
    expect(calls.busy).toEqual([['plot:1', true], ['plot:1', false]]);
    expect(calls.collected).toEqual([]);
    expect(ctl.has('plot:1')).toBe(true);
    await ctl.tap('plot:1');
    expect(harvestCrop).toHaveBeenCalledTimes(2);
    expect(calls.collected).toEqual(['plot:1']);
  });

  it('collectAnimalProduct devuelve null → como fallo (R23)', async () => {
    const collectAnimalProduct = vi.fn().mockResolvedValue(null);
    const { calls, ctl } = setup(snap({ animals: [animal(1)] }), { collectAnimalProduct });
    ctl.sync();
    await ctl.tap('animal:1');
    expect(calls.busy).toEqual([['animal:1', true], ['animal:1', false]]);
    expect(calls.collected).toEqual([]);
  });

  it('tras el éxito, un sync con el store sin recargar no recrea el objeto; al recargar se limpia', async () => {
    const { state, calls, ctl } = setup(snap({ plots: [plot(1)] }));
    ctl.sync();
    await ctl.tap('plot:1');
    ctl.sync(); // el store aún lista la parcela
    expect(calls.add).toEqual(['plot:1']);
    expect(calls.remove).toEqual([]);
    state.snapshot = snap({ plots: [] });
    ctl.sync();
    state.snapshot = snap({ plots: [plot(1)] }); // vuelve a estar lista más adelante
    ctl.sync();
    expect(calls.add).toEqual(['plot:1', 'plot:1']);
  });

  it('si un sync quita el objeto durante la petición, no hay vuelo', async () => {
    let resolve;
    const harvestCrop = vi.fn(() => new Promise((r) => { resolve = r; }));
    const { state, calls, ctl } = setup(snap({ plots: [plot(1)] }), { harvestCrop });
    ctl.sync();
    const p = ctl.tap('plot:1');
    state.snapshot = snap({ plots: [] });
    ctl.sync();
    resolve({ ok: 1 });
    await p;
    expect(calls.remove).toEqual(['plot:1']);
    expect(calls.collected).toEqual([]);
  });

  it('dispose con respuesta tardía no invoca callbacks (R30)', async () => {
    let resolve;
    const harvestCrop = vi.fn(() => new Promise((r) => { resolve = r; }));
    const { calls, ctl } = setup(snap({ plots: [plot(1)] }), { harvestCrop });
    ctl.sync();
    const p = ctl.tap('plot:1');
    ctl.dispose();
    resolve({ ok: 1 });
    await p;
    expect(calls.collected).toEqual([]);
    expect(calls.busy).toEqual([['plot:1', true]]);
    ctl.sync();
    await ctl.tap('plot:1');
    expect(calls.add).toEqual(['plot:1']);
    expect(harvestCrop).toHaveBeenCalledTimes(1);
  });
});
