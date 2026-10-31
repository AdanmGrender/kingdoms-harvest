/**
 * Formación del combate (combate_b R24–R27, design §8). PURO: coordenadas lógicas en un lienzo 824×1720.
 * Héroes abajo (slots 1–3 al frente, 4–5 atrás), enemigos arriba (1 centrado o 2–4 escalonados).
 * Las cajas son {x,y} = esquina superior izquierda, {w,h}; `anchor` = pie centrado (donde se apoya el sprite).
 */
import { heroArt, isBossNode } from './artMap';

export const WORLD = { w: 824, h: 1720 };
export const ENEMY_HEIGHT_FRAC = { normal: 0.29, boss: 0.36 };
export const ENEMY_ASPECT = 0.8;          // ancho/alto de la caja del enemigo
export const HERO_BOX = { w: 190, h: 250 };
export const BACK_SCALE = 0.75;           // la fila trasera se dibuja más chica
export const FRONT_Y = 1180;
export const BACK_Y = 990;   // design §8 dice y≈1010; 990 evita que la fila trasera pise la frontal (y 1180)
export const PITCH = 230;
export const HUD_TOP = 1440;              // nada de la formación pasa de aquí (banda inferior del HUD)
export const ENEMY_TOP = 100;
export const ENEMY_ZONE_BOTTOM = 960;
export const MAX_ENEMIES = 4;
const ENEMY_SCALE = { 1: 1, 2: 0.8, 3: 0.7, 4: 0.6 };
const GAP = 10;

const CX = WORLD.w / 2;

const spreadX = (n, w) => {
  const pitch = n > 1 ? Math.min(PITCH, (WORLD.w - 2 * 20 - w) / (n - 1)) : 0;
  return Array.from({ length: n }, (_, i) => Math.round(CX + (i - (n - 1) / 2) * pitch));
};

const box = (id, cx, top, w, h, extra) => ({
  id, x: cx - w / 2, y: top, w, h, cx, anchor: { x: cx, y: top + h }, ...extra,
});

/** Enemigos del estado: `state.enemies` (v2) o `[state.enemy]` con id `e0` (v1). */
export function enemyList(state) {
  if (state && Array.isArray(state.enemies) && state.enemies.length) {
    return state.enemies.slice(0, MAX_ENEMIES).map((e, i) => ({ ...e, id: typeof e.id === 'string' ? e.id : `e${i}` }));
  }
  if (state && state.enemy) return [{ ...state.enemy, id: 'e0' }];
  return [];
}

function layoutHeroes(heroes) {
  const sorted = [...(Array.isArray(heroes) ? heroes : [])].sort((a, b) => a.slot - b.slot);
  const front = []; const back = [];
  for (const h of sorted) (h.slot <= 3 && front.length < 3 ? front : back).push(h);
  const out = [];
  const place = (list, row, w, h, top) => {
    spreadX(list.length, w).forEach((cx, i) => {
      const u = list[i];
      out.push(box(`h${u.slot}`, cx, top, w, h, { side: 'h', slot: u.slot, row, art: heroArt(u), heroId: u.heroId ?? null }));
    });
  };
  place(front, 'front', HERO_BOX.w, HERO_BOX.h, FRONT_Y);
  place(back, 'back', Math.round(HERO_BOX.w * BACK_SCALE), Math.round(HERO_BOX.h * BACK_SCALE), BACK_Y);
  return out;
}

function layoutEnemies(enemies, boss) {
  const list = (Array.isArray(enemies) ? enemies : []).slice(0, MAX_ENEMIES);
  const n = list.length;
  if (n === 0) return [];
  const frac = boss ? ENEMY_HEIGHT_FRAC.boss : ENEMY_HEIGHT_FRAC.normal;
  const full = frac * WORLD.h;
  if (n === 1) {
    const h = Math.round(full);
    return [box(list[0].id ?? 'e0', CX, ENEMY_TOP, Math.round(h * ENEMY_ASPECT), h, { side: 'e', index: 0, scale: 1 })];
  }
  let scale = ENEMY_SCALE[n];
  const build = () => {
    const h = Math.round(full * scale);
    const w = Math.round(h * ENEMY_ASPECT);
    const colA = Math.round(WORLD.w * 0.25);
    const colB = Math.round(WORLD.w * 0.75);
    return list.map((e, i) => {
      const inA = i % 2 === 0;
      const level = Math.floor(i / 2);
      const top = ENEMY_TOP + (inA ? 0 : Math.round(h / 2)) + level * (h + GAP);
      return box(e.id ?? `e${i}`, inA ? colA : colB, top, w, h, { side: 'e', index: i, scale });
    });
  };
  let boxes = build();
  while (Math.max(...boxes.map((b) => b.y + b.h)) > ENEMY_ZONE_BOTTOM && scale > 0.2) { scale *= 0.95; boxes = build(); }
  return boxes;
}

/**
 * @param heroes   `state.heroes` (usa `slot`, `heroId`, `class`)
 * @param enemies  salida de `enemyList(state)` (usa `id`)
 * @param opts     { boss?: boolean | node }  (un nodo `{type:'boss'}` también vale)
 */
export function computeFormation(heroes, enemies, opts = {}) {
  const boss = typeof opts.boss === 'object' ? isBossNode(opts.boss) : !!opts.boss;
  return { world: WORLD, heroes: layoutHeroes(heroes), enemies: layoutEnemies(enemies, boss), boss };
}
