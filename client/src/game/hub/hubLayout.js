// Layout, ambiente y taps del hub B (HubSceneB). Módulo puro: sin phaser ni store.
// Espejo de BUILDINGS y WARP_STORMS de shared/gameConfig.js — mantener en sync (lo verifica hubLayout.test.js).

export const HUB_W = 824;
export const HUB_H = 1720;

// Banda visible no tapada por el chrome en 412×860 (valores lógicos = css × 2), medida en el DOM real (T12): QuestRail
// termina en 123 px CSS, la botonera empieza en 698, QuickActionsSidebar termina en x 52 y EventSidebar empieza en 356.
export const SAFE_TOP = 250; // bajo TopResourceBar + QuestRail
export const SAFE_BOTTOM = 1390; // sobre botonera de BastionHub + BottomNavBar
export const SAFE_LEFT = 110; // a la derecha de QuickActionsSidebar (left-2, w-11)
export const SAFE_RIGHT = 712; // a la izquierda de EventSidebar/SocialSidebar

export const HUB_DEPTHS = {
  sky: 0,
  skyFx: 5,
  base: 10,
  buildings: 100, // + y del ancla
  fog: 1600,
  fg: 1700,
  particles: 1800,
  grade: 1950,
  flash: 1960,
};

export const TOKEN_FONT_PX = 28; // 14 px CSS × (HUB_W / 412) (R29)

export const BUILDING_IDS = [
  'farm_plot', 'barn', 'mill', 'sawmill', 'smithy', 'stable', 'house', 'mine', 'wall',
  'tower', 'barracks', 'trap', 'tavern', 'market', 'embassy', 'throne_room', 'library',
];

const DEFAULT_TILE = [2, 2];
export const TILE_SIZES = {
  farm_plot: [2, 2], barn: [2, 2], mill: [2, 2], sawmill: [2, 2], smithy: [2, 2], stable: [2, 2],
  house: [2, 2], mine: [2, 2], wall: [2, 2], tower: [2, 2], barracks: [3, 3], trap: [1, 1],
  tavern: [2, 2], market: [3, 2], embassy: [3, 3], throne_room: [4, 4], library: [2, 2],
};

// Ancla = centro-abajo del sprite, en el espacio lógico 824×1720 (design.md §5.1). Ranuras agrandadas en T12 para que
// el hub se lea en un teléfono (cada caja = alto objetivo × aspecto del webp; --height en art-b/hub/process.sh).
export const HUB_SLOTS = {
  library: { x: 150, y: 730, w: 222, h: 290 },
  throne_room: { x: 412, y: 730, w: 332, h: 396, fire: { dx: 65, dy: -322 } },
  embassy: { x: 668, y: 730, w: 232, h: 270 },
  tower: { x: 165, y: 955, w: 226, h: 190 },
  barracks: { x: 415, y: 955, w: 304, h: 150 },
  tavern: { x: 655, y: 955, w: 204, h: 210, smoke: { dx: -37, dy: -195 } },
  mill: { x: 135, y: 1125, w: 173, h: 240 },
  house: { x: 290, y: 1125, w: 193, h: 130 },
  barn: { x: 490, y: 1125, w: 243, h: 140 },
  smithy: { x: 690, y: 1125, w: 194, h: 200, smoke: { dx: 50, dy: -190 } },
  market: { x: 140, y: 1280, w: 236, h: 170 },
  sawmill: { x: 345, y: 1280, w: 199, h: 195 },
  stable: { x: 525, y: 1280, w: 181, h: 175 },
  mine: { x: 680, y: 1280, w: 225, h: 165 },
  farm_plot: { x: 250, y: 1390, w: 205, h: 150 },
  wall: { x: 470, y: 1390, w: 231, h: 130 },
  trap: { x: 660, y: 1390, w: 102, h: 100 },
};

export const WORKER_KINDS = ['farmer', 'woodcutter', 'miner', 'merchant'];

// Posición relativa al ancla de la ranura; alto en px lógicos (design.md §5.2).
export const WORKER_BY_BUILDING = {
  farm_plot: { kind: 'farmer', dx: 80, dy: 0, h: 125, periodMs: 900 },
  mill: { kind: 'farmer', dx: 75, dy: 5, h: 120, periodMs: 1100 },
  sawmill: { kind: 'woodcutter', dx: 85, dy: 5, h: 130, periodMs: 700 },
  smithy: { kind: 'miner', dx: -70, dy: 5, h: 130, periodMs: 650 },
  mine: { kind: 'miner', dx: -60, dy: 10, h: 130, periodMs: 750 },
  tavern: { kind: 'merchant', dx: -85, dy: 8, h: 120, periodMs: 1400 },
  market: { kind: 'merchant', dx: -95, dy: 8, h: 125, periodMs: 1600 },
};

// Ambientes (design.md §5.3). sky = nombre del cielo (textura `hubb_<sky>`).
export const CALM_AMBIENCE = {
  sky: 'sky_calm', skyTint: null, grade: null, fog: null, particles: 'none', particleColors: [], flash: null,
  cloudDrift: true, fireBoost: 1,
};

export const STORM_AMBIENCE = {
  velo_estatico: {
    sky: 'sky_storm', skyTint: 0x9a8aa6, grade: { color: 0x7a5a8a, alpha: 0.18 }, fog: { banks: 5, alpha: 0.55 },
    particles: 'none', particleColors: [], flash: null, cloudDrift: true, fireBoost: 1,
  },
  marea_carmesi: {
    sky: 'sky_storm', skyTint: 0xc0453a, grade: { color: 0xb32821, alpha: 0.22 }, fog: null,
    particles: 'none', particleColors: [], flash: { color: 0xb32821, everyMs: [5000, 9000] }, cloudDrift: true,
    fireBoost: 1,
  },
  lluvia_de_energia: {
    sky: 'sky_storm', skyTint: 0x8a7a6a, grade: { color: 0xe8933a, alpha: 0.10 }, fog: null,
    particles: 'embers_fall', particleColors: [0xe8933a, 0x4fd8c8], flash: null, cloudDrift: true, fireBoost: 1,
  },
  susurros_del_vacio: {
    sky: 'sky_storm', skyTint: 0x7f9a5a, grade: { color: 0x4a4550, alpha: 0.25 }, fog: null,
    particles: 'motes_rise', particleColors: [0x9fd35a], flash: null, cloudDrift: true, fireBoost: 1,
  },
  calma_falsa: {
    sky: 'sky_calm', skyTint: 0xe0b860, grade: { color: 0xd9a441, alpha: 0.14 }, fog: null,
    particles: 'none', particleColors: [], flash: null, cloudDrift: false, fireBoost: 1,
  },
};

const GENERIC_STORM_TINT = 0x8a8478;

// Única lista de texturas que carga HubSceneB (design.md §8.3).
export const HUB_TEXTURES = [
  { key: 'hubb_sky_calm', url: '/assets/b/hub/sky_calm.webp' },
  { key: 'hubb_sky_storm', url: '/assets/b/hub/sky_storm.webp' },
  { key: 'hubb_base', url: '/assets/b/hub/base.webp' },
  { key: 'hubb_fg', url: '/assets/b/hub/fg.webp' },
  ...BUILDING_IDS.map((id) => ({ key: `hubb_bld_${id}`, url: `/assets/b/buildings/${id}.webp` })),
  ...WORKER_KINDS.flatMap((kind) => ['a', 'b'].map((pose) => ({
    key: `hubb_wk_${kind}_${pose}`, url: `/assets/b/workers/${kind}_${pose}.webp`,
  }))),
];

// px de dispositivo → cámara que cubre todo el canvas con el espacio lógico a escala uniforme (cover).
export function computeHubViewport(width, height) {
  const zoom = Math.max(width / HUB_W, height / HUB_H);
  const viewW = width / zoom;
  const viewH = height / zoom;
  return {
    zoom,
    // Phaser hace zoom alrededor del centro de la cámara: centerOn(x, y) ⇒ scroll = centro − tamaño / 2.
    scrollX: HUB_W / 2 - width / 2,
    scrollY: HUB_H / 2 - height / 2,
    view: { x: (HUB_W - viewW) / 2, y: (HUB_H - viewH) / 2, width: viewW, height: viewH },
  };
}

function numId(r) {
  const n = Number(r?.id);
  return Number.isFinite(n) ? n : Infinity;
}

export function pickRepresentative(records) {
  if (!Array.isArray(records) || !records.length) return null;
  const valid = records.filter((r) => r && typeof r === 'object');
  if (!valid.length) return null;
  const built = valid.filter((r) => !r.is_building);
  if (built.length) {
    return built.reduce((best, r) => {
      const lv = Number(r.level) || 0;
      const bl = Number(best.level) || 0;
      if (lv !== bl) return lv > bl ? r : best;
      return numId(r) < numId(best) ? r : best;
    });
  }
  return valid.reduce((best, r) => (numId(r) < numId(best) ? r : best));
}

export function buildingVisualState(record) {
  return record && record.is_building ? 'construction' : 'built';
}

export function selectHubBuildings(buildings) {
  if (!Array.isArray(buildings)) return [];
  const groups = new Map();
  for (const r of buildings) {
    const id = r && r.building_id;
    if (!id || !Object.prototype.hasOwnProperty.call(HUB_SLOTS, id)) continue;
    if (!groups.has(id)) groups.set(id, []);
    groups.get(id).push(r);
  }
  const out = [];
  for (const id of BUILDING_IDS) {
    const recs = groups.get(id);
    if (!recs) continue;
    const record = pickRepresentative(recs);
    const state = buildingVisualState(record);
    const worker = state === 'built' && WORKER_BY_BUILDING[id] ? WORKER_BY_BUILDING[id] : null;
    out.push({ buildingId: id, record, slot: HUB_SLOTS[id], state, worker });
  }
  return out;
}

function parseHex(color) {
  return typeof color === 'string' && /^#[0-9a-fA-F]{6}$/.test(color) ? parseInt(color.slice(1), 16) : null;
}

export function stormAmbience(activeStorm) {
  if (activeStorm == null) return CALM_AMBIENCE;
  const id = typeof activeStorm === 'object' ? activeStorm.id : activeStorm;
  if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(STORM_AMBIENCE, id)) return STORM_AMBIENCE[id];
  const tint = parseHex(activeStorm && activeStorm.color);
  const color = tint ?? GENERIC_STORM_TINT;
  return {
    sky: 'sky_storm', skyTint: color, grade: { color, alpha: 0.15 }, fog: null, particles: 'none',
    particleColors: [], flash: null, cloudDrift: true, fireBoost: 1,
  };
}

export function ambienceSignature(amb) {
  if (!amb) return '';
  const flash = amb.flash ? `${amb.flash.color}@${amb.flash.everyMs.join('-')}` : '-';
  return [amb.sky, amb.skyTint ?? '-', amb.fog ? 'fog' : '-', amb.particles, flash, amb.cloudDrift ? 'drift' : '-']
    .join('|');
}

export function isTap(down, up, slop = 12) {
  if (!down || !up) return false;
  const dt = up.t - down.t;
  if (!Number.isFinite(dt) || dt < 0 || dt > 500) return false;
  return Math.hypot(up.x - down.x, up.y - down.y) <= slop;
}

export function shouldAcceptTap(overlayState) {
  return overlayState == null;
}

export function buildSelectionPayload(record) {
  return {
    type: 'building',
    data: {
      buildingId: record.building_id,
      posX: record.position_x,
      level: record.level,
      isBuilding: !!record.is_building,
    },
  };
}

function footprint(id) {
  return TILE_SIZES[id] || DEFAULT_TILE;
}

// Primera celda libre en espiral (anillos de Chebyshev) desde origin; misma regla AABB que
// buildingService.validatePlacement. El server sigue siendo la autoridad.
export function findFreeTile(buildings, buildingId, opts = {}) {
  const origin = opts.origin || { x: 78, y: 60 };
  const max = opts.max ?? 200;
  const [w, h] = footprint(buildingId);
  const maxX = max - w;
  const maxY = max - h;
  if (maxX < 0 || maxY < 0) return null;
  const rects = (Array.isArray(buildings) ? buildings : [])
    .filter((b) => b && Number.isFinite(Number(b.position_x)) && Number.isFinite(Number(b.position_y)))
    .map((b) => {
      const [ew, eh] = footprint(b.building_id);
      return { x: Number(b.position_x), y: Number(b.position_y), w: ew, h: eh };
    });
  const free = (x, y) => rects.every((r) => !(x < r.x + r.w && x + w > r.x && y < r.y + r.h && y + h > r.y));
  const ox = Math.min(Math.max(Math.round(origin.x), 0), maxX);
  const oy = Math.min(Math.max(Math.round(origin.y), 0), maxY);
  const maxR = Math.max(ox, maxX - ox, oy, maxY - oy);
  for (let r = 0; r <= maxR; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = ox + dx;
        const y = oy + dy;
        if (x < 0 || y < 0 || x > maxX || y > maxY) continue;
        if (free(x, y)) return { posX: x, posY: y };
      }
    }
  }
  return null;
}
