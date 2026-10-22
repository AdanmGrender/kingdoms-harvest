// Escena del hub con un doble de sprite: valida el cambio de variante de edificio sin Phaser real (R28, R32, R33).
import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('phaser', () => ({
  default: {
    Scene: class {},
    Math: { Between: (a) => a },
    BlendModes: { ADD: 1 },
    Textures: { FilterMode: { LINEAR: 1 } },
  },
}));

import HubSceneB from '../game/scenes/HubSceneB';
import { HUB_SLOTS, selectHubBuildings, variantKey } from '../game/hub/hubLayout';

function fakeSprite(w = 400, h = 300) {
  const data = {};
  const sp = {
    width: w,
    height: h,
    texture: null,
    scale: 1,
    tint: null,
    alpha: 1,
    setTexture: vi.fn(function setTexture(key) { this.texture = key; return this; }),
    setScale: vi.fn(function setScale(s) { this.scale = s; return this; }),
    setData: vi.fn(function setData(k, v) { data[k] = v; return this; }),
    getData: (k) => data[k],
    removeInteractive: vi.fn(function removeInteractive() { return this; }),
    setInteractive: vi.fn(function setInteractive() { return this; }),
    setTint: vi.fn(function setTint(t) { this.tint = t; return this; }),
    clearTint: vi.fn(function clearTint() { this.tint = null; return this; }),
    setAlpha: vi.fn(function setAlpha(a) { this.alpha = a; return this; }),
  };
  return sp;
}

// Doble mínimo de la escena: reutiliza los métodos reales de HubSceneB sobre texturas simuladas.
function fakeScene(existing) {
  const scene = {
    missing: new Set(),
    bldSprites: new Map(),
    textures: { exists: (k) => existing.has(k) },
    tweens: { killTweensOf: vi.fn() },
    created: [],
    syncFire: vi.fn(),
    createWorker: vi.fn(),
    destroyWorker: vi.fn(),
    createSmoke: vi.fn(),
    destroySmoke: vi.fn(),
    createBuildingSprite(id, variant) {
      const sp = fakeSprite();
      sp.texture = this.variantTex(id, variant);
      sp.setData('variant', variant);
      this.created.push(sp);
      return sp;
    },
  };
  for (const m of ['hasTex', 'variantTex', 'applyVariant', 'syncBuildings']) scene[m] = HubSceneB.prototype[m];
  return scene;
}

const rec = (id, level, building = 0, rid = 1) => ({ id: rid, building_id: id, level, is_building: building });

describe('HubSceneB — cambio de variante de edificio (R28, R32, R33)', () => {
  let scene;
  beforeEach(() => {
    scene = fakeScene(new Set(['hubb_bld_barn', variantKey('barn', 'medio'), variantKey('barn', 'obra')]));
  });

  it('sprite nuevo nace con la textura de su variante, sin llamar a setTexture', () => {
    scene.syncBuildings([rec('barn', 1)]);
    const sp = scene.bldSprites.get('barn').sprite;
    expect(sp.texture).toBe('hubb_bld_barn');
    expect(sp.setTexture).not.toHaveBeenCalled();
  });

  it('cambiar de variante hace exactamente un setTexture y recalcula la escala', () => {
    scene.syncBuildings([rec('barn', 1)]);
    const sp = scene.bldSprites.get('barn').sprite;
    sp.width = 500; sp.height = 250;
    scene.syncBuildings([rec('barn', 5)]);
    expect(sp.setTexture).toHaveBeenCalledTimes(1);
    expect(sp.setTexture).toHaveBeenCalledWith('hubb_bld_barn_medio');
    const slot = HUB_SLOTS.barn;
    const sc = Math.min(slot.w / 500, slot.h / 250);
    expect(sp.getData('baseScale')).toBeCloseTo(sc);
    expect(sp.scale).toBeCloseTo(sc);
    expect(sp.getData('variant')).toBe('medio');
    expect(scene.tweens.killTweensOf).toHaveBeenCalledWith(sp);
    expect(sp.removeInteractive).toHaveBeenCalledTimes(1);
    expect(sp.setInteractive).toHaveBeenCalledWith({ pixelPerfect: true, alphaTolerance: 8 });
  });

  it('misma variante en un segundo sync: ningún setTexture (R32)', () => {
    scene.syncBuildings([rec('barn', 5)]);
    const sp = scene.bldSprites.get('barn').sprite;
    scene.syncBuildings([rec('barn', 5)]);
    scene.syncBuildings([rec('barn', 4)]);
    expect(sp.setTexture).not.toHaveBeenCalled();
    expect(scene.tweens.killTweensOf).not.toHaveBeenCalled();
  });

  it('en obra usa la textura obra, sin tint ni alpha, y quita trabajador y humo (R33)', () => {
    scene.syncBuildings([rec('barn', 1)]);
    const sp = scene.bldSprites.get('barn').sprite;
    scene.syncBuildings([rec('barn', 2, 1)]);
    expect(sp.setTexture).toHaveBeenLastCalledWith('hubb_bld_barn_obra');
    expect(sp.setTint).not.toHaveBeenCalled();
    expect(sp.clearTint).not.toHaveBeenCalled();
    expect(sp.setAlpha).not.toHaveBeenCalled();
    expect(sp.tint).toBeNull();
    expect(sp.alpha).toBe(1);
    expect(scene.destroyWorker).toHaveBeenCalled();
    expect(scene.destroySmoke).toHaveBeenCalled();
  });

  it('ciclo mejora: bajo → obra → medio, un setTexture por cambio', () => {
    scene.syncBuildings([rec('barn', 3)]);
    const sp = scene.bldSprites.get('barn').sprite;
    scene.syncBuildings([rec('barn', 4, 1)]);
    scene.syncBuildings([rec('barn', 4, 1)]);
    scene.syncBuildings([rec('barn', 4, 0)]);
    expect(sp.setTexture.mock.calls.map((c) => c[0])).toEqual(['hubb_bld_barn_obra', 'hubb_bld_barn_medio']);
  });

  it('textura de variante ausente: cae al tramo inferior y luego al placeholder (R35)', () => {
    scene.syncBuildings([rec('barn', 9)]); // alto no existe → medio
    expect(scene.bldSprites.get('barn').sprite.texture).toBe('hubb_bld_barn_medio');
    scene.syncBuildings([rec('barn', 9, 1)]); // obra existe
    expect(scene.bldSprites.get('barn').sprite.texture).toBe('hubb_bld_barn_obra');
    const bare = fakeScene(new Set());
    expect(bare.variantTex('mill', 'alto')).toBe('hubb_placeholder');
    expect(() => bare.syncBuildings([rec('mill', 5)])).not.toThrow();
  });

  it('selectHubBuildings entrega la variante que consume la escena', () => {
    expect(selectHubBuildings([rec('barn', 9, 1)])[0].variant).toBe('obra');
  });
});
