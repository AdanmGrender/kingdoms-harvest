// Objetos de recolección del hub B (HubSceneB). Módulo puro: sin phaser, sin store, sin DOM.
// Lógica con ramas de specs/hub_b_recoleccion/design.md §4; la escena es solo el adaptador visual.
import { HUB_W } from './hubLayout';

export const PICKUP_HOSTS = { crop: 'farm_plot', animal: 'stable' };
export const MAX_PICKUPS_PER_BUILDING = 3;
export const PICKUP_REFRESH_MS = 5000;
export const PICKUP_H = 84; // alto mostrado, px lógicos (≈ 42 px CSS)
export const PICKUP_STEP = 70; // separación horizontal entre objetos de un mismo anfitrión
export const PICKUP_BOB = 5; // amplitud del balanceo, px lógicos (R11: ≤ 6)
export const PICKUP_MIN_HIT = 88; // 44 px CSS × (824 / 412) (R18)
export const PICKUP_FLY_MS = 600; // R20: ≤ 700

// Producto de animal por animal_id (espejo de ANIMALS[id].product en shared/gameConfig.js; lo verifica el test).
export const ANIMAL_PRODUCT = { chicken: 'egg', cow: 'milk', sheep: 'wool' };
export const PICKUP_ICONS = { crop: 'sack', egg: 'egg_basket', milk: 'milk_pail', wool: 'wool_bale' };
export const PICKUP_TEXTURES = Object.values(PICKUP_ICONS)
  .map((id) => ({ key: `hubb_pk_${id}`, url: `/assets/b/pickups/${id}.webp` }));
export const PICKUP_ANCHORS = { farm_plot: { dx: 0, dy: -6 }, stable: { dx: 0, dy: -6 } };

const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);
const byId = (a, b) => Number(a.id) - Number(b.id);

// Pickup = { key, type: 'crop'|'animal', host, id, icon, resourceKey }
export function selectPickups({ plots, animals, builtIds, now }) {
  const built = builtIds instanceof Set ? builtIds : new Set(builtIds || []);
  const out = [];

  if (built.has(PICKUP_HOSTS.crop) && Array.isArray(plots)) {
    const list = plots.filter((p) => p && p.state === 'ready').sort(byId)
      .slice(0, MAX_PICKUPS_PER_BUILDING);
    for (const p of list) {
      out.push({
        key: `plot:${p.id}`, type: 'crop', host: PICKUP_HOSTS.crop, id: p.id,
        icon: PICKUP_ICONS.crop, resourceKey: p.crop_id,
      });
    }
  }

  if (built.has(PICKUP_HOSTS.animal) && Array.isArray(animals)) {
    const list = animals
      .filter((a) => {
        if (!a || !a.is_fed || !has(ANIMAL_PRODUCT, a.animal_id) || !a.next_production_at) return false;
        const t = Date.parse(a.next_production_at);
        return Number.isFinite(t) && t <= now;
      })
      .sort(byId)
      .slice(0, MAX_PICKUPS_PER_BUILDING);
    for (const a of list) {
      const product = ANIMAL_PRODUCT[a.animal_id];
      out.push({
        key: `animal:${a.id}`, type: 'animal', host: PICKUP_HOSTS.animal, id: a.id,
        icon: PICKUP_ICONS[product], resourceKey: product,
      });
    }
  }
  return out;
}

// Fila centrada sobre la ranura del anfitrión; origen del sprite = centro-abajo.
export function pickupPosition(slot, host, index, count) {
  const anchor = PICKUP_ANCHORS[host] || { dx: 0, dy: 0 };
  return {
    x: slot.x + anchor.dx + (index - (count - 1) / 2) * PICKUP_STEP,
    y: slot.y + anchor.dy,
  };
}

// Zona táctil mínima de 44 px CSS (R18).
export function pickupHitSize(displayW, displayH) {
  return { w: Math.max(displayW, PICKUP_MIN_HIT), h: Math.max(displayH, PICKUP_MIN_HIT) };
}

// Punto CSS (pantalla) → espacio lógico del mundo. Sin punto (contador ausente) → borde superior centrado (R21).
export function cssToWorld(point, { canvasRect, renderScale, worldView, zoom }) {
  if (!point) return { x: HUB_W / 2, y: worldView.y + 24 };
  const gx = (point.cssX - canvasRect.left) * renderScale;
  const gy = (point.cssY - canvasRect.top) * renderScale;
  return { x: worldView.x + gx / zoom, y: worldView.y + gy / zoom };
}

export function createPickupController(deps) {
  const { getSnapshot, actions, onAdd, onRemove, onBusy, onCollected } = deps;
  const current = new Map();
  const busy = new Set();
  const collected = new Set(); // ya recogidos (en vuelo) que el store todavía puede listar hasta recargar
  let disposed = false;

  function sync() {
    if (disposed) return;
    const all = selectPickups(getSnapshot());
    const listed = new Set(all.map((p) => p.key));
    for (const key of collected) if (!listed.has(key)) collected.delete(key);
    const next = new Map(all.filter((p) => !collected.has(p.key)).map((p) => [p.key, p]));
    for (const [key, p] of current) {
      if (!next.has(key)) {
        current.delete(key);
        busy.delete(key);
        onRemove(p);
      }
    }
    for (const [key, p] of next) {
      if (!current.has(key)) {
        current.set(key, p);
        onAdd(p);
      }
    }
  }

  async function tap(key) {
    if (disposed) return;
    const p = current.get(key);
    if (!p || busy.has(key)) return;
    busy.add(key);
    onBusy(p, true);
    let ok = false;
    try {
      const res = p.type === 'crop' ? await actions.harvestCrop(p.id) : await actions.collectAnimalProduct(p.id);
      ok = res != null;
    } catch {
      ok = false; // el store ya notificó el error
    }
    if (disposed) return;
    busy.delete(key);
    if (current.get(key) !== p) return; // un sync() intermedio ya lo quitó (p. ej. cosechado desde el panel)
    if (ok) {
      // El sprite lo toma la animación de vuelo: sale del conjunto y de la vista hasta que el store deje de listarlo.
      current.delete(key);
      collected.add(key);
      onCollected(p);
    } else {
      onBusy(p, false);
    }
  }

  function dispose() {
    disposed = true;
    busy.clear();
    collected.clear();
    current.clear();
  }

  return { sync, tap, dispose, has: (key) => current.has(key) };
}
