import { describe, it, expect } from 'vitest';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import {
  HUB_W,
  HUB_H,
  SAFE_TOP,
  SAFE_BOTTOM,
  SAFE_LEFT,
  SAFE_RIGHT,
  HUB_DEPTHS,
  TOKEN_FONT_PX,
  BUILDING_IDS,
  TILE_SIZES,
  HUB_SLOTS,
  WORKER_BY_BUILDING,
  WORKER_KINDS,
  STORM_AMBIENCE,
  CALM_AMBIENCE,
  HUB_TEXTURES,
  TIERS,
  BUILDING_MAX_LEVEL,
  buildingTier,
  variantKey,
  variantTextureCandidates,
  computeHubViewport,
  pickRepresentative,
  selectHubBuildings,
  buildingVisualState,
  stormAmbience,
  ambienceSignature,
  isTap,
  shouldAcceptTap,
  buildSelectionPayload,
  findFreeTile,
} from '../game/hub/hubLayout';

// shared/ es CommonJS fuera de la raíz de Vite: se lee solo en el test para verificar los espejos.
const require = createRequire(import.meta.url);
const { BUILDINGS, WARP_STORMS } = require('../../../shared/gameConfig.js');

// Registros iniciales de una cuenta nueva (server/src/services/playerService.js).
const STARTER = [
  { id: 1, building_id: 'throne_room', level: 1, is_building: 0, position_x: 78, position_y: 60 },
  { id: 2, building_id: 'farm_plot', level: 1, is_building: 0, position_x: 74, position_y: 64 },
  { id: 3, building_id: 'farm_plot', level: 1, is_building: 0, position_x: 77, position_y: 64 },
  { id: 4, building_id: 'barn', level: 1, is_building: 0, position_x: 82, position_y: 60 },
];

function overlaps(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function rectOf(rec) {
  const [w, h] = TILE_SIZES[rec.building_id] || [2, 2];
  return { x: rec.position_x, y: rec.position_y, w, h };
}

describe('hubLayout — capas (R3)', () => {
  it('HUB_DEPTHS en orden estrictamente creciente: cielo → … → gradación', () => {
    const order = ['sky', 'skyFx', 'base', 'buildings', 'fog', 'fg', 'particles', 'grade', 'flash'];
    expect(Object.keys(HUB_DEPTHS)).toEqual(order);
    for (let i = 1; i < order.length; i++) {
      expect(HUB_DEPTHS[order[i]]).toBeGreaterThan(HUB_DEPTHS[order[i - 1]]);
    }
  });

  it('edificios (+ y) y trabajadores (+1) quedan por debajo de la niebla', () => {
    const maxY = Math.max(...Object.values(HUB_SLOTS).map((s) => s.y));
    expect(HUB_DEPTHS.buildings + maxY + 1).toBeLessThan(HUB_DEPTHS.fog);
  });

  it('espacio lógico 824×1720', () => {
    expect([HUB_W, HUB_H]).toEqual([824, 1720]);
  });
});

describe('hubLayout — computeHubViewport (R4, R6)', () => {
  it.each([
    [824, 1720, 1],
    [1236, 2580, 1.5],
    [412, 860, 0.5],
  ])('%s×%s px de dispositivo → zoom %s', (w, h, zoom) => {
    expect(computeHubViewport(w, h).zoom).toBeCloseTo(zoom, 10);
  });

  it.each([
    [824, 1720],
    [1236, 2580],
    [412, 860],
    [720, 1560],
    [1536, 2048],
  ])('%s×%s: cubre todo el canvas, escala uniforme, centrado y sin bandas', (w, h) => {
    const v = computeHubViewport(w, h);
    // cover: el espacio lógico escalado cubre ambos ejes del canvas
    expect(HUB_W * v.zoom).toBeGreaterThanOrEqual(w - 1e-9);
    expect(HUB_H * v.zoom).toBeGreaterThanOrEqual(h - 1e-9);
    // al menos un eje justo (no sobra zoom)
    expect(Math.min(HUB_W * v.zoom - w, HUB_H * v.zoom - h)).toBeCloseTo(0, 9);
    // la vista en px lógicos cae dentro del espacio lógico → sin bandas vacías
    expect(v.view.x).toBeGreaterThanOrEqual(-1e-9);
    expect(v.view.y).toBeGreaterThanOrEqual(-1e-9);
    expect(v.view.x + v.view.width).toBeLessThanOrEqual(HUB_W + 1e-9);
    expect(v.view.y + v.view.height).toBeLessThanOrEqual(HUB_H + 1e-9);
    // vista centrada; scroll = centro − tamaño de cámara / 2 (centerOn de Phaser)
    expect(v.view.x + v.view.width / 2).toBeCloseTo(HUB_W / 2, 9);
    expect(v.view.y + v.view.height / 2).toBeCloseTo(HUB_H / 2, 9);
    expect(v.scrollX).toBeCloseTo(HUB_W / 2 - w / 2, 9);
    expect(v.scrollY).toBeCloseTo(HUB_H / 2 - h / 2, 9);
  });

  it('720×1560 (360×780 @2) recorta los costados; 1536×2048 (768×1024 @2) recorta arriba/abajo', () => {
    const narrow = computeHubViewport(720, 1560);
    expect(narrow.view.height).toBeCloseTo(HUB_H, 9);
    expect(narrow.view.width).toBeLessThan(HUB_W);
    const wide = computeHubViewport(1536, 2048);
    expect(wide.view.width).toBeCloseTo(HUB_W, 9);
    expect(wide.view.height).toBeLessThan(HUB_H);
  });
});

describe('hubLayout — espejos de shared/gameConfig.js (R8)', () => {
  it('HUB_SLOTS tiene exactamente los 17 ids de BUILDINGS', () => {
    expect(Object.keys(BUILDINGS)).toHaveLength(17);
    expect(Object.keys(HUB_SLOTS).sort()).toEqual(Object.keys(BUILDINGS).sort());
  });

  it('BUILDING_IDS = Object.keys(BUILDINGS) en el mismo orden', () => {
    expect(BUILDING_IDS).toEqual(Object.keys(BUILDINGS));
  });

  it('TILE_SIZES = tileWidth/tileHeight del catálogo', () => {
    const expected = Object.fromEntries(
      Object.entries(BUILDINGS).map(([id, b]) => [id, [b.tileWidth || 2, b.tileHeight || 2]]),
    );
    expect(TILE_SIZES).toEqual(expected);
  });

  it('STORM_AMBIENCE cubre exactamente los ids de WARP_STORMS', () => {
    expect(Object.keys(STORM_AMBIENCE).sort()).toEqual(Object.keys(WARP_STORMS).sort());
  });
});

describe('hubLayout — ranuras dentro de la banda segura (R9)', () => {
  it('banda segura coherente con el espacio lógico', () => {
    expect(0).toBeLessThan(SAFE_TOP);
    expect(SAFE_TOP).toBeLessThan(SAFE_BOTTOM);
    expect(SAFE_BOTTOM).toBeLessThanOrEqual(HUB_H);
    expect(0).toBeLessThan(SAFE_LEFT);
    expect(SAFE_LEFT).toBeLessThan(SAFE_RIGHT);
    expect(SAFE_RIGHT).toBeLessThanOrEqual(HUB_W);
  });

  it.each(Object.entries(HUB_SLOTS))('%s: caja en 0..824 × SAFE_TOP..SAFE_BOTTOM, ancla en SAFE_LEFT..SAFE_RIGHT', (id, s) => {
    expect(s.w).toBeGreaterThan(0);
    expect(s.h).toBeGreaterThan(0);
    expect(s.x - s.w / 2).toBeGreaterThanOrEqual(0);
    expect(s.x + s.w / 2).toBeLessThanOrEqual(HUB_W);
    expect(s.y - s.h).toBeGreaterThanOrEqual(SAFE_TOP);
    expect(s.y).toBeLessThanOrEqual(SAFE_BOTTOM);
    expect(s.x).toBeGreaterThanOrEqual(SAFE_LEFT);
    expect(s.x).toBeLessThanOrEqual(SAFE_RIGHT);
  });

  it('anclas a ≥ 80 px lógicos entre sí', () => {
    const entries = Object.entries(HUB_SLOTS);
    let min = Infinity;
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const [, a] = entries[i];
        const [, b] = entries[j];
        min = Math.min(min, Math.hypot(a.x - b.x, a.y - b.y));
      }
    }
    expect(min).toBeGreaterThanOrEqual(80);
  });
});

describe('hubLayout — selección de edificios (R10, R11, R12, R13, R31)', () => {
  it('cuenta nueva: throne_room, farm_plot y barn; ninguna otra ranura (R10, R11)', () => {
    const list = selectHubBuildings(STARTER);
    expect(list.map((b) => b.buildingId).sort()).toEqual(['barn', 'farm_plot', 'throne_room']);
    for (const b of list) {
      expect(b.slot).toBe(HUB_SLOTS[b.buildingId]);
      expect(b.state).toBe('built');
    }
    // los dos huertos se representan con un único sprite: el de menor id
    expect(list.find((b) => b.buildingId === 'farm_plot').record.id).toBe(2);
  });

  it('trabajador solo en productores construidos', () => {
    const list = selectHubBuildings(STARTER);
    expect(list.find((b) => b.buildingId === 'farm_plot').worker).toBe(WORKER_BY_BUILDING.farm_plot);
    expect(list.find((b) => b.buildingId === 'barn').worker).toBeNull();
    expect(list.find((b) => b.buildingId === 'throne_room').worker).toBeNull();
  });

  it('17 ids → 17 resultados', () => {
    const all = BUILDING_IDS.map((id, i) => ({ id: i + 1, building_id: id, level: 1, is_building: false }));
    expect(selectHubBuildings(all)).toHaveLength(17);
  });

  it('vacío → [] (R11)', () => {
    expect(selectHubBuildings([])).toEqual([]);
  });

  it.each([undefined, null, 'x', 42, {}])('no-array %s → [] sin lanzar (R31)', (v) => {
    expect(() => selectHubBuildings(v)).not.toThrow();
    expect(selectHubBuildings(v)).toEqual([]);
  });

  it('ignora entradas inválidas e ids fuera del catálogo (R31)', () => {
    const list = selectHubBuildings([
      undefined,
      null,
      { id: 9, building_id: 'castillo_volador', level: 3 },
      { id: 10 },
      ...STARTER,
    ]);
    expect(list.map((b) => b.buildingId).sort()).toEqual(['barn', 'farm_plot', 'throne_room']);
  });

  it('en obra → estado construction y sin trabajador (R13)', () => {
    const [b] = selectHubBuildings([{ id: 5, building_id: 'smithy', level: 1, is_building: 1 }]);
    expect(b.state).toBe('construction');
    expect(b.worker).toBeNull();
  });

  it('pickRepresentative: construido de mayor nivel (R12)', () => {
    const r = pickRepresentative([
      { id: 1, level: 2, is_building: false },
      { id: 2, level: 5, is_building: true },
      { id: 3, level: 4, is_building: false },
    ]);
    expect(r.id).toBe(3);
  });

  it('pickRepresentative: a igual nivel, menor id (R12)', () => {
    const r = pickRepresentative([
      { id: 7, level: 3, is_building: 0 },
      { id: 4, level: 3, is_building: 0 },
      { id: 9, level: 1, is_building: 0 },
    ]);
    expect(r.id).toBe(4);
  });

  it('pickRepresentative: ninguno construido → en obra de menor id (R12)', () => {
    const r = pickRepresentative([
      { id: 8, level: 1, is_building: true },
      { id: 6, level: 2, is_building: true },
    ]);
    expect(r.id).toBe(6);
  });

  it('pickRepresentative: lista vacía o inválida → null', () => {
    expect(pickRepresentative([])).toBeNull();
    expect(pickRepresentative(undefined)).toBeNull();
  });

  it('buildingVisualState (R13)', () => {
    expect(buildingVisualState({ is_building: true })).toBe('construction');
    expect(buildingVisualState({ is_building: 1 })).toBe('construction');
    expect(buildingVisualState({ is_building: false })).toBe('built');
    expect(buildingVisualState({ is_building: 0 })).toBe('built');
  });
});

describe('hubLayout — producción animada (R15, R16, R17)', () => {
  it('WORKER_BY_BUILDING = ids de BUILDINGS con produces (R15)', () => {
    const producers = Object.entries(BUILDINGS).filter(([, b]) => b.produces).map(([id]) => id);
    expect(producers).toHaveLength(7);
    expect(Object.keys(WORKER_BY_BUILDING).sort()).toEqual(producers.sort());
  });

  it('cada trabajador usa un tipo conocido con período y alto válidos', () => {
    for (const w of Object.values(WORKER_BY_BUILDING)) {
      expect(WORKER_KINDS).toContain(w.kind);
      expect(w.h).toBeGreaterThan(0);
      expect(w.periodMs).toBeGreaterThan(0);
    }
  });

  it('humo en la chimenea de smithy y tavern (R17)', () => {
    for (const id of ['smithy', 'tavern']) {
      expect(HUB_SLOTS[id].smoke).toEqual({ dx: expect.any(Number), dy: expect.any(Number) });
      expect(HUB_SLOTS[id].smoke.dy).toBeLessThan(0);
    }
  });
});

describe('hubLayout — ambiente de tormenta (R18, R19, R21)', () => {
  it('sin tormenta → cielo calmo sin niebla, partículas ni gradación (R18)', () => {
    for (const v of [null, undefined]) {
      const a = stormAmbience(v);
      expect(a).toBe(CALM_AMBIENCE);
      expect(a.sky).toBe('sky_calm');
      expect(a.fog).toBeNull();
      expect(a.particles).toBe('none');
      expect(a.grade).toBeNull();
      expect(a.flash).toBeNull();
    }
  });

  it.each(Object.keys(WARP_STORMS))('%s → su fila de la tabla, distinta de la calma (R19)', (id) => {
    const a = stormAmbience({ ...WARP_STORMS[id] });
    expect(a).toBe(STORM_AMBIENCE[id]);
    expect(ambienceSignature(a)).not.toBe(ambienceSignature(CALM_AMBIENCE));
    expect(a.grade).not.toBeNull();
  });

  it('calma + 5 tormentas → 6 firmas distintas (R19)', () => {
    const sigs = [CALM_AMBIENCE, ...Object.keys(WARP_STORMS).map((id) => stormAmbience({ id }))]
      .map(ambienceSignature);
    expect(new Set(sigs).size).toBe(6);
  });

  it('id desconocido con color válido → genérico teñido con ese color (R21)', () => {
    let a;
    expect(() => { a = stormAmbience({ id: 'desconocida', color: '#123456' }); }).not.toThrow();
    expect(a.sky).toBe('sky_storm');
    expect(a.skyTint).toBe(0x123456);
    expect(a.grade).toEqual({ color: 0x123456, alpha: 0.15 });
  });

  it.each(['rojo', '#12345', '#1234567', undefined, 123])('id desconocido con color inválido %s → tinte 0x8a8478 (R21)', (color) => {
    let a;
    expect(() => { a = stormAmbience({ id: 'desconocida', color }); }).not.toThrow();
    expect(a.sky).toBe('sky_storm');
    expect(a.skyTint).toBe(0x8a8478);
  });
});

describe('hubLayout — tap y selección (R22, R23, R24)', () => {
  const down = { x: 100, y: 100, t: 1000 };

  it('isTap con slop 12 (s = 1)', () => {
    expect(isTap(down, { x: 108, y: 108, t: 1200 })).toBe(true);
    expect(isTap(down, { x: 113, y: 100, t: 1200 })).toBe(false);
    expect(isTap(down, { x: 100, y: 100, t: 1501 })).toBe(false);
    expect(isTap(down, { x: 100, y: 100, t: 1500 })).toBe(true);
  });

  it('isTap con slop 24 (s = 2) y 36 (s = 3): 12 px CSS en px de dispositivo', () => {
    expect(isTap(down, { x: 124, y: 100, t: 1100 }, 24)).toBe(true);
    expect(isTap(down, { x: 125, y: 100, t: 1100 }, 24)).toBe(false);
    expect(isTap(down, { x: 136, y: 100, t: 1100 }, 36)).toBe(true);
    expect(isTap(down, { x: 137, y: 100, t: 1100 }, 36)).toBe(false);
  });

  it('isTap sin down/up → false', () => {
    expect(isTap(null, down)).toBe(false);
    expect(isTap(down, undefined)).toBe(false);
  });

  it('shouldAcceptTap: solo sin overlay (R23, R24)', () => {
    expect(shouldAcceptTap(null)).toBe(true);
    expect(shouldAcceptTap(undefined)).toBe(true);
    expect(shouldAcceptTap({ type: 'building', data: {} })).toBe(false);
    expect(shouldAcceptTap('menu')).toBe(false);
  });

  it('buildSelectionPayload = contrato de entity:selected (R22)', () => {
    expect(buildSelectionPayload({
      id: 4, building_id: 'barn', level: 3, is_building: 0, position_x: 82, position_y: 60,
    })).toEqual({ type: 'building', data: { buildingId: 'barn', posX: 82, level: 3, isBuilding: false } });
    expect(buildSelectionPayload({ building_id: 'mill', level: 1, is_building: 1, position_x: 5 }).data.isBuilding)
      .toBe(true);
  });
});

describe('hubLayout — texto flotante y texturas (R29)', () => {
  it('TOKEN_FONT_PX = 28 (14 px CSS × 824 / 412)', () => {
    expect(TOKEN_FONT_PX).toBe(28);
    expect(TOKEN_FONT_PX).toBe(14 * (HUB_W / 412));
  });

  it('HUB_TEXTURES: capas, 17 edificios * 4 y 8 poses, claves hubb_* únicas bajo /assets/b/', () => {
    expect(HUB_TEXTURES).toHaveLength(4 + 17 * 4 + 8);
    expect(new Set(HUB_TEXTURES.map((t) => t.key)).size).toBe(HUB_TEXTURES.length);
    for (const t of HUB_TEXTURES) {
      expect(t.key.startsWith('hubb_')).toBe(true);
      expect(t.url).toMatch(/^\/assets\/b\/(hub|buildings|workers)\/[a-z_]+\.webp$/);
    }
    for (const id of BUILDING_IDS) {
      expect(HUB_TEXTURES.map((t) => t.key)).toContain(variantKey(id, 'bajo'));
      expect(HUB_TEXTURES.map((t) => t.key)).toContain(variantKey(id, 'medio'));
      expect(HUB_TEXTURES.map((t) => t.key)).toContain(variantKey(id, 'alto'));
      expect(HUB_TEXTURES.map((t) => t.key)).toContain(variantKey(id, 'obra'));
    }
  });

  it('HUB_TEXTURES: cada URL de edificio (4 por id) apunta a un webp que existe en client/public', () => {
    const publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public');
    const bld = HUB_TEXTURES.filter((t) => t.url.startsWith('/assets/b/buildings/'));
    expect(bld).toHaveLength(BUILDING_IDS.length * 4);
    for (const t of bld) {
      expect(fs.existsSync(path.join(publicDir, t.url)), t.url).toBe(true);
    }
  });
});

describe('hubLayout — findFreeTile (R26)', () => {
  it.each(['trap', 'house', 'barracks', 'throne_room'])('%s: sin solapes con los 4 registros iniciales y dentro de 0..200', (id) => {
    const pos = findFreeTile(STARTER, id);
    expect(pos).not.toBeNull();
    const [w, h] = TILE_SIZES[id];
    const r = { x: pos.posX, y: pos.posY, w, h };
    expect(r.x).toBeGreaterThanOrEqual(0);
    expect(r.y).toBeGreaterThanOrEqual(0);
    expect(r.x + w).toBeLessThanOrEqual(200);
    expect(r.y + h).toBeLessThanOrEqual(200);
    for (const rec of STARTER) expect(overlaps(r, rectOf(rec))).toBe(false);
  });

  it('huellas 1×1, 3×3 y 4×4 del catálogo', () => {
    expect(TILE_SIZES.trap).toEqual([1, 1]);
    expect(TILE_SIZES.barracks).toEqual([3, 3]);
    expect(TILE_SIZES.throne_room).toEqual([4, 4]);
  });

  it('busca cerca del origen (posición inicial de throne_room)', () => {
    const pos = findFreeTile([], 'house');
    expect(pos).toEqual({ posX: 78, posY: 60 });
    const near = findFreeTile(STARTER, 'house');
    expect(Math.max(Math.abs(near.posX - 78), Math.abs(near.posY - 60))).toBeLessThanOrEqual(6);
  });

  it('colocaciones sucesivas nunca se solapan', () => {
    const placed = [...STARTER];
    for (let i = 0; i < 20; i++) {
      const id = ['trap', 'house', 'barracks', 'market', 'throne_room'][i % 5];
      const pos = findFreeTile(placed, id);
      const rec = { id: 100 + i, building_id: id, position_x: pos.posX, position_y: pos.posY };
      for (const other of placed) expect(overlaps(rectOf(rec), rectOf(other))).toBe(false);
      placed.push(rec);
    }
  });

  it('tablero lleno → null', () => {
    const full = [];
    for (let x = 0; x < 200; x += 4) {
      for (let y = 0; y < 200; y += 4) full.push({ building_id: 'throne_room', position_x: x, position_y: y });
    }
    expect(findFreeTile(full, 'trap')).toBeNull();
    expect(findFreeTile([], 'trap', { max: 0 })).toBeNull();
  });
});

describe('hubLayout — tramos de nivel (R1–R6, R9, R26, R35)', () => {
  // Tabla de cortes de design.md §3: [id, max, [último bajo, último medio]].
  const CORTES = {
    embassy: [3, 1, 2],
    mill: [5, 2, 3], sawmill: [5, 2, 3], smithy: [5, 2, 3], stable: [5, 2, 3],
    house: [5, 2, 3], mine: [5, 2, 3], tavern: [5, 2, 3], market: [5, 2, 3],
    trap: [8, 3, 5], library: [8, 3, 5],
    farm_plot: [10, 3, 7], barn: [10, 3, 7], tower: [10, 3, 7], barracks: [10, 3, 7], throne_room: [10, 3, 7],
    wall: [15, 5, 10],
  };

  it('TIERS en orden bajo → medio → alto', () => {
    expect(TIERS).toEqual(['bajo', 'medio', 'alto']);
  });

  it('BUILDING_MAX_LEVEL espeja maxLevel de shared/gameConfig.js para los 17 ids (R6)', () => {
    expect(Object.keys(BUILDING_MAX_LEVEL).sort()).toEqual([...BUILDING_IDS].sort());
    for (const id of BUILDING_IDS) expect(BUILDING_MAX_LEVEL[id]).toBe(BUILDINGS[id].maxLevel);
  });

  it('la tabla de cortes cubre los 17 ids y coincide con max', () => {
    expect(Object.keys(CORTES).sort()).toEqual([...BUILDING_IDS].sort());
    for (const id of BUILDING_IDS) expect(CORTES[id][0]).toBe(BUILDING_MAX_LEVEL[id]);
  });

  it.each(Object.entries(CORTES))('%s: bordes de nivel de cada tramo (R2, R5)', (id, [max, lastBajo, lastMedio]) => {
    for (let lv = 1; lv <= max; lv++) {
      const expected = lv <= lastBajo ? 'bajo' : lv <= lastMedio ? 'medio' : 'alto';
      expect(buildingTier(id, lv), `${id} nivel ${lv}`).toBe(expected);
    }
    expect(buildingTier(id, 1)).toBe('bajo');
    expect(buildingTier(id, max)).toBe('alto');
    expect(buildingTier(id, lastBajo + 1)).toBe('medio');
  });

  it('level > max da alto (R4)', () => {
    expect(buildingTier('embassy', 4)).toBe('alto');
    expect(buildingTier('wall', 99)).toBe('alto');
  });

  it('level nulo, no numérico o < 1 da bajo (R3)', () => {
    for (const bad of [null, undefined, '', 'x', NaN, 0, -1, Infinity * -1, {}]) {
      expect(buildingTier('barn', bad)).toBe('bajo');
    }
  });

  it('acepta el nivel como string numérico', () => {
    expect(buildingTier('barn', '8')).toBe('alto');
  });

  it('id sin max (desconocido, prototipo) da bajo', () => {
    expect(buildingTier('inexistente', 5)).toBe('bajo');
    expect(buildingTier('constructor', 5)).toBe('bajo');
    expect(buildingTier(undefined, 5)).toBe('bajo');
  });

  it('variantKey: el bajo conserva la clave histórica (R25)', () => {
    expect(variantKey('barn', 'bajo')).toBe('hubb_bld_barn');
    expect(variantKey('barn', 'medio')).toBe('hubb_bld_barn_medio');
    expect(variantKey('barn', 'alto')).toBe('hubb_bld_barn_alto');
    expect(variantKey('barn', 'obra')).toBe('hubb_bld_barn_obra');
  });

  it('variantTextureCandidates: orden de caída (R35)', () => {
    expect(variantTextureCandidates('barn', 'bajo')).toEqual(['hubb_bld_barn']);
    expect(variantTextureCandidates('barn', 'medio')).toEqual(['hubb_bld_barn_medio', 'hubb_bld_barn']);
    expect(variantTextureCandidates('barn', 'alto')).toEqual(['hubb_bld_barn_alto', 'hubb_bld_barn_medio', 'hubb_bld_barn']);
    expect(variantTextureCandidates('barn', 'obra')).toEqual(['hubb_bld_barn_obra', 'hubb_bld_barn']);
    expect(variantTextureCandidates('barn', 'raro')).toEqual(['hubb_bld_barn']);
  });

  it('selectHubBuildings agrega tier y variant (R26)', () => {
    const list = selectHubBuildings([
      { id: 1, building_id: 'barn', level: 1, is_building: 0 },
      { id: 2, building_id: 'wall', level: 7, is_building: 0 },
      { id: 3, building_id: 'embassy', level: 3, is_building: 0 },
    ]);
    const by = Object.fromEntries(list.map((b) => [b.buildingId, b]));
    expect(by.barn).toMatchObject({ tier: 'bajo', variant: 'bajo', state: 'built' });
    expect(by.wall).toMatchObject({ tier: 'medio', variant: 'medio' });
    expect(by.embassy).toMatchObject({ tier: 'alto', variant: 'alto' });
  });

  it('en obra la variante es obra y el tier sigue el nivel del registro (R9, R27)', () => {
    const [b] = selectHubBuildings([{ id: 9, building_id: 'barn', level: 8, is_building: 1 }]);
    expect(b.state).toBe('construction');
    expect(b.variant).toBe('obra');
    expect(b.tier).toBe('alto');
  });

  it('el representativo (más alto entre los construidos) fija el tramo; los en obra no cuentan', () => {
    const [b] = selectHubBuildings([
      { id: 1, building_id: 'farm_plot', level: 2, is_building: 0 },
      { id: 2, building_id: 'farm_plot', level: 5, is_building: 0 },
      { id: 3, building_id: 'farm_plot', level: 9, is_building: 1 },
    ]);
    expect(b.record.id).toBe(2);
    expect(b.variant).toBe('medio');
  });
});
