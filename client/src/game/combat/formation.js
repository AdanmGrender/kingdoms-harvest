/**
 * Formación del combate (combate_b R24–R27, design §8; hoja_visual.md V1–V3 y decisiones del owner del 2026-11-07
 * y 2026-11-08). PURO: coordenadas lógicas en un lienzo 824×1720.
 *
 * Carriles por profundidad: cada fila tiene su línea de pies. De atrás (arriba) a adelante (abajo):
 *   EB enemigos de atrás · EF enemigos de adelante (un enemigo solo o un jefe usa solo EF) · HB héroes 4–5 · HF héroes 1–3.
 * - Todos los carriles quedan sobre el piso transitable del fondo (debajo de su línea de suelo calibrada) y por encima
 *   del borde superior REAL de los botones de héroe (HUD_TOP); las cabezas de los enemigos, debajo de las barras.
 * - R24 enmendado: cero intersección de cajas DENTRO de cada fila; entre filas se permite solape y la fila de carril
 *   más bajo se dibuja delante (`depth` = carril).
 * - Legibilidad: las caras de los héroes traseros quedan siempre a la vista; los carriles de los enemigos se eligen
 *   para que las caras (35 % superior de la silueta) queden lo menos tapadas posible por las filas de delante.
 *
 * Cada caja: {x, y, w, h} = rectángulo de la textura dibujada (h = alto de V1/R27); `anchor` = pie centrado sobre el
 * carril (la fila inferior con alfa > 0 cae en `lane`); `alpha` = caja de la silueta visible; `face` = su 35 % superior.
 */
import { heroArt, enemyArt, isBossNode, bgArt, BG_GROUND_Y_FRAC, BG_FLOOR_OBSTACLES, bgImageColToWorldX, spriteGeom } from './artMap';

export const WORLD = { w: 824, h: 1720 };
export const ENEMY_HEIGHT_FRAC = { normal: 0.29, boss: 0.36 };   // R27: topes de F9 (× 1720)
export const HERO_H = 308;            // V1: héroe delantero = 308 / 499 = 0,617 × común solo
export const BACK_SCALE = 0.82;       // V1: fila trasera = 0,80–0,85 de la delantera
export const GROUP_SCALE = { 2: 0.8, 3: 0.6, 4: 0.6 };   // × común solo; V1: con 3–4, 299 ≥ 0,9 × 308
export const HUD_TOP = 1328;          // borde superior real de los botones de héroe con «¡TAP!» (peor caso, 360×800; hud_medidas.json)
export const FOOT_MARGIN = 8;
export const LANE_MAX = HUD_TOP - FOOT_MARGIN;   // carril de los héroes delanteros
export const FLOOR_MARGIN = 8;        // los carriles van al menos 8 px por debajo de la línea de suelo del fondo
export const ENEMY_TOP_SOLO = 236;    // cabezas bajo la barra única (borde inferior real ≤ 227, hud_medidas.json)
export const ENEMY_TOP = 320;         // cabezas bajo las dos filas de barras con 2+ enemigos (≤ 312)
export const LANE_GAP = 24;           // separación mínima entre carriles consecutivos
// B1 (decisión del owner del 2026-11-09): el cartel de victoria va centrado al 34 % del alto (±35 px CSS, ≤ 70 px).
// Ningún enemigo caído puede quedar tendido en esa franja: su carril baja lo necesario. Sin medida de la pantalla vale
// el borde inferior de la franja en el peor caso de las 3 vistas de la hoja, medido en el MARCO del panel (con el tope
// de aspecto 2,1, en 360×800 el marco mide 756 y arranca en y 22): 412×860: 655, 360×800: 663,3, 1280×800: 660.
export const BANNER_ZONE = { center: 0.34, half: 35 };
export const BANNER_ZONE_BOTTOM = 664;
export const FACE_FRAC = 0.35;        // «cara» = 35 % superior de la silueta
// Respiración de los que siguen de pie (CombatScene): escala y hasta ×1,014 y x hasta ×0,996 desde el pie. La caja
// alfa crece hacia arriba hasta un 1,4 % de su alto; quien no deba tocar una silueta o una cara cuenta con eso.
export const BREATH = { y: 1.014, x: 0.996 };
export const EDGE = 8;                // margen lateral de las cajas
export const ROW_GAP = 6;             // hueco mínimo entre cajas de una misma fila
export const MAX_ENEMIES = 4;
export const ROWS = ['EB', 'EF', 'HB', 'HF'];
const PITCH_MAX = 280;
const STEP = 4;
const BODY_WEIGHT = 0.05;

const CX = WORLD.w / 2;
const EPS = 1e-9;

/** Línea de suelo (y del mundo) del fondo de un nodo. */
export const groundY = (node) => Math.round((BG_GROUND_Y_FRAC[bgArt(node)] ?? BG_GROUND_Y_FRAC.crypt) * WORLD.h);

/** Enemigos del estado: `state.enemies` (v2) o `[state.enemy]` con id `e0` (v1). */
export function enemyList(state) {
  if (state && Array.isArray(state.enemies) && state.enemies.length) {
    return state.enemies.slice(0, MAX_ENEMIES).map((e, i) => ({ ...e, id: typeof e.id === 'string' ? e.id : `e${i}` }));
  }
  if (state && state.enemy) return [{ ...state.enemy, id: 'e0' }];
  return [];
}

// ── unidades y cajas ──────────────────────────────────────────────────────

function unit(id, kind, art, h, extra) {
  const g = spriteGeom(kind, art, 'idle');
  const s = h / g.H;
  // pies (columnas que apoyan en el piso) respecto del centro de la caja: la pose idle tiene el origen X al centro
  return { id, kind, art, h, s, g, w: g.W * s, ah: (g.b - g.t + 1) * s, fl: (g.pl - g.W / 2) * s, fr: (g.pr + 1 - g.W / 2) * s, ...extra };
}

/** Caja de una unidad con el pie en `lane` y centro `cx`. */
function place(u, cx, lane) {
  const { g, s, w, h } = u;
  const y = lane - (g.b + 1) * s;
  const alpha = { x: cx - w / 2 + g.l * s, y: y + g.t * s, w: (g.r - g.l + 1) * s, h: u.ah };
  const face = { x: alpha.x, y: alpha.y, w: alpha.w, h: alpha.h * FACE_FRAC };
  const feet = { x0: cx + u.fl, x1: cx + u.fr };
  const box = {
    id: u.id, x: cx - w / 2, y, w, h, cx, lane, depth: lane, anchor: { x: cx, y: lane }, alpha, face, feet, row: u.row, art: u.art,
  };
  for (const k of ['side', 'slot', 'index', 'heroId', 'scale']) if (u[k] !== undefined) box[k] = u[k];
  return box;
}

/** Centros repartidos y simétricos para una fila de anchos `ws` (sin intersección, dentro del lienzo). */
function spread(ws) {
  const k = ws.length;
  if (k <= 1) return [CX];
  let minPitch = 0;
  for (let i = 1; i < k; i++) minPitch = Math.max(minPitch, (ws[i - 1] + ws[i]) / 2 + ROW_GAP);
  const maxPitch = (WORLD.w - 2 * EDGE - (ws[0] + ws[k - 1]) / 2) / (k - 1);
  const p = Math.max(minPitch, Math.min(PITCH_MAX, maxPitch));
  return ws.map((_, i) => CX + (i - (k - 1) / 2) * p);
}

const atLeft = (w) => EDGE + w / 2;
const atRight = (w) => WORLD.w - EDGE - w / 2;

// ── cobertura (legibilidad) ───────────────────────────────────────────────

/** Área de `t` cubierta por la unión de `rects` (exacta, por compresión de coordenadas). */
export function coveredArea(t, rects) {
  const clip = [];
  for (const r of rects) {
    const x0 = Math.max(t.x, r.x); const x1 = Math.min(t.x + t.w, r.x + r.w);
    const y0 = Math.max(t.y, r.y); const y1 = Math.min(t.y + t.h, r.y + r.h);
    if (x1 > x0 && y1 > y0) clip.push({ x0, x1, y0, y1 });
  }
  if (!clip.length) return 0;
  const xs = [...new Set(clip.flatMap((c) => [c.x0, c.x1]))].sort((a, b) => a - b);
  const ys = [...new Set(clip.flatMap((c) => [c.y0, c.y1]))].sort((a, b) => a - b);
  let area = 0;
  for (let i = 0; i < xs.length - 1; i++) {
    const mx = (xs[i] + xs[i + 1]) / 2;
    for (let j = 0; j < ys.length - 1; j++) {
      const my = (ys[j] + ys[j + 1]) / 2;
      if (clip.some((c) => mx > c.x0 && mx < c.x1 && my > c.y0 && my < c.y1)) area += (xs[i + 1] - xs[i]) * (ys[j + 1] - ys[j]);
    }
  }
  return area;
}

/** Fracción de la cara (35 % superior de la silueta) de `box` tapada por las siluetas de `front`. */
export const faceCover = (box, front) => coveredArea(box.face, front.map((b) => b.alpha)) / (box.face.w * box.face.h);
const bodyCover = (box, front) => coveredArea(box.alpha, front.map((b) => b.alpha)) / (box.alpha.w * box.alpha.h);

function rowScore(units, xs, lane, front) {
  let s = 0;
  units.forEach((u, i) => {
    const b = place(u, xs[i], lane);
    s += faceCover(b, front) + BODY_WEIGHT * bodyCover(b, front);
  });
  return s;
}

// ── formación ─────────────────────────────────────────────────────────────

function heroRows(heroes, fs = 1) {
  const sorted = [...(Array.isArray(heroes) ? heroes : [])].sort((a, b) => a.slot - b.slot);
  const front = []; const back = [];
  for (const h of sorted) (h.slot <= 3 && front.length < 3 ? front : back).push(h);
  const back2 = back.slice(0, Math.max(0, 5 - front.length));
  const mk = (h, row, H) => unit(`h${h.slot}`, 'hero', heroArt(h), H, { row, side: 'h', slot: h.slot, heroId: h.heroId ?? null });
  const HF = front.map((h) => mk(h, 'HF', HERO_H * fs));
  const HB = back2.map((h) => mk(h, 'HB', Math.round(HERO_H * BACK_SCALE) * fs));
  const xF = spread(HF.map((u) => u.w));
  const pitch = xF.length > 1 ? xF[1] - xF[0] : PITCH_MAX;
  // traseros en los huecos entre los delanteros (ladrillo): sus caras asoman entre las cabezas de delante
  const xB = HB.length === 2 ? [CX - pitch / 2, CX + pitch / 2] : HB.map(() => CX - pitch / 2);
  return { HF, HB, xF, xB };
}

function enemyRows(enemies, boss, node, fs = 1) {
  const list = (Array.isArray(enemies) ? enemies : []).slice(0, MAX_ENEMIES);
  const m = list.length;
  const art = enemyArt(node);
  const solo = Math.round(ENEMY_HEIGHT_FRAC.normal * WORLD.h);
  const h = fs * (m === 1 ? Math.round((boss ? ENEMY_HEIGHT_FRAC.boss : ENEMY_HEIGHT_FRAC.normal) * WORLD.h) : Math.round(solo * (GROUP_SCALE[m] || 0.6)));
  const scale = m === 1 ? 1 : GROUP_SCALE[m] || 0.6;
  const us = list.map((e, i) => unit(e.id ?? `e${i}`, 'enemy', art, h, { side: 'e', index: i, scale }));
  const w = us.length ? us[0].w : 0;
  if (m === 0) return { EB: [], EF: [], xB: [], xF: [] };
  if (m === 1) return { EB: [], EF: [{ ...us[0], row: 'EF' }], xB: [], xF: [CX] };
  if (m === 2) return { EB: [{ ...us[0], row: 'EB' }], EF: [{ ...us[1], row: 'EF' }], xB: [atLeft(w)], xF: [atRight(w)] };
  if (m === 3) {
    return { EB: [{ ...us[0], row: 'EB' }, { ...us[1], row: 'EB' }], EF: [{ ...us[2], row: 'EF' }], xB: [atLeft(w), atRight(w)], xF: [CX] };
  }
  const d = w / 2 + ROW_GAP / 2;
  return {
    EB: [{ ...us[0], row: 'EB' }, { ...us[1], row: 'EB' }], EF: [{ ...us[2], row: 'EF' }, { ...us[3], row: 'EF' }],
    xB: [CX - d, CX + d], xF: [atLeft(w), atRight(w)],
  };
}

/**
 * Banda de x (mundo) donde pueden apoyar los pies de los enemigos (B4): fuera de las columnas con obstáculos del fondo
 * (`BG_FLOOR_OBSTACLES`), en el peor caso de la deriva y con 4 de margen.
 */
export function enemyFootBand(node) {
  let aL = EDGE;
  let aR = WORLD.w - EDGE;
  for (const o of BG_FLOOR_OBSTACLES[bgArt(node)] || []) {
    if (o.x0 <= 0) aL = Math.max(aL, bgImageColToWorldX(o.x1).max + 4);
    else if (o.x1 >= 1) aR = Math.min(aR, bgImageColToWorldX(o.x0).min - 4);
  }
  return [aL, aR];
}

/**
 * Corre lo justo los centros de una fila para que los pies de cada unidad queden dentro de la banda [aL, aR], sin que
 * las cajas de la fila se toquen ni salgan del lienzo. Devuelve los centros nuevos (o los pedidos si no hay forma).
 */
function fitFeet(units, xs, [aL, aR]) {
  if (!units.length) return xs;
  const order = units.map((u, i) => i).sort((i, j) => xs[i] - xs[j]);
  const lo = (i) => Math.max(EDGE + units[i].w / 2, aL - units[i].fl);
  const hi = (i) => Math.min(WORLD.w - EDGE - units[i].w / 2, aR - units[i].fr);
  const sep = (i, j) => (units[i].w + units[j].w) / 2 + ROW_GAP;
  const out = xs.slice();
  for (const i of order) out[i] = Math.min(hi(i), Math.max(lo(i), out[i]));
  // empujar a la derecha lo que se pisa, y después traer de vuelta desde el borde derecho de la banda
  for (let k = 1; k < order.length; k++) out[order[k]] = Math.max(out[order[k]], out[order[k - 1]] + sep(order[k - 1], order[k]));
  const last = order[order.length - 1];
  out[last] = Math.min(out[last], hi(last));
  for (let k = order.length - 2; k >= 0; k--) {
    out[order[k]] = Math.min(out[order[k]], hi(order[k]), out[order[k + 1]] - sep(order[k], order[k + 1]));
  }
  const ok = order.every((i, k) => out[i] >= lo(i) - 1e-6 && out[i] <= hi(i) + 1e-6
    && (k === 0 || out[i] - out[order[k - 1]] >= sep(order[k - 1], i) - 1e-6));
  return ok ? out : xs;
}

/** Carril más bajo (pie más arriba) que admite una fila de enemigos: piso del fondo y cabezas bajo las barras. */
function enemyLo(units, floor, topLimit, zoneBottom) {
  let lo = floor;
  for (const u of units) {
    lo = Math.max(lo, topLimit + (u.g.b + 1) * u.s);
    // B1: tendido en su carril, el enemigo caído no puede subir a la franja del cartel de victoria
    const gh = spriteGeom('enemy', u.art, 'hit');
    lo = Math.max(lo, zoneBottom + (gh.r - gh.l + 1) * (u.h / gh.H) * DEAD_FLAT);
  }
  return Math.ceil(lo);
}

/**
 * Límites de los carriles con el HUD REAL medido en tiempo de ejecución (H2, decisión del owner del 2026-11-09):
 * `hud.bottom` = borde superior de la fila de botones de héroe (con «¡TAP!»), `hud.top` = borde inferior de las barras
 * de vida y `hud.zoneBottom` = borde inferior de la franja del cartel de victoria (B1), en y del mundo. Sin medida
 * valen las constantes del peor caso de la hoja (HUD_TOP, ENEMY_TOP*, BANNER_ZONE_BOTTOM). Una pantalla más alta nunca
 * baja a los héroes: el tope inferior es el menor de los dos, así 412×860, 360×800 y 1280×800 no cambian.
 * El carril va al px de mundo más cercano: la medida tiene ruido de subpíxel según la densidad de la pantalla (360×800
 * da 1327,5 con DPR 2 y 1328,1 con DPR 3) y los dos dan el mismo 1320; el margen sobre los botones queda ≥ 7,5.
 */
export function laneLimits(hud) {
  // B-3 (review ronda 3): una medida fuera del lienzo (0, negativa, más allá del borde) no es una medida: vale la constante
  const m = (k) => (hud && Number.isFinite(hud[k]) && hud[k] > 0 && hud[k] < WORLD.h ? hud[k] : null);
  const bottom = m('bottom') !== null ? Math.min(HUD_TOP, m('bottom')) : HUD_TOP;
  const top = m('top') !== null ? m('top') + 8 : -Infinity;
  const zone = m('zoneBottom') !== null ? m('zoneBottom') : -Infinity;
  return {
    laneMax: Math.round(bottom - FOOT_MARGIN), top1: Math.max(ENEMY_TOP_SOLO, top), topN: Math.max(ENEMY_TOP, top),
    zoneBottom: Math.max(BANNER_ZONE_BOTTOM, zone),
  };
}

/**
 * Bordes del HUD en px de pantalla → y del mundo. El lienzo 824×1720 va en FIT y centrado dentro del escenario
 * (`stage` = su rectángulo). Todo en px CSS en el MARCO del panel (0 = su borde superior; con el tope de aspecto el
 * marco puede no arrancar en el borde de la ventana): `buttonsTop`, `barsBottom` y `viewH` (alto del marco).
 * Devuelve { bottom?, top?, zoneBottom? } o null. Un borde que cae fuera del lienzo (botones en y 0, barras por encima o
 * por debajo de todo) no se devuelve: la formación usa la constante (B-3 de la review ronda 3).
 */
export function hudToWorld({ stage, buttonsTop, barsBottom, viewH } = {}) {
  if (!stage || !(stage.width > 0) || !(stage.height > 0)) return null;
  const k = Math.min(stage.width / WORLD.w, stage.height / WORLD.h);
  const canvasTop = stage.top + (stage.height - WORLD.h * k) / 2;
  const out = {};
  const put = (key, v) => { if (Number.isFinite(v) && v > 0 && v < WORLD.h) out[key] = v; };
  if (Number.isFinite(buttonsTop)) put('bottom', (buttonsTop - canvasTop) / k);
  if (Number.isFinite(barsBottom)) put('top', (barsBottom - canvasTop) / k);
  if (viewH > 0) put('zoneBottom', (BANNER_ZONE.center * viewH + BANNER_ZONE.half - canvasTop) / k);
  return Object.keys(out).length ? out : null;
}

/**
 * La formación cabe: carriles en orden con ≥ LANE_GAP entre filas consecutivas y todas las cajas dentro del lienzo.
 * Con las constantes (sin medida) siempre cabe (matriz R24); con una medida absurda puede no caber.
 */
export function formationFits(f) {
  const present = ROWS.filter((r) => f.lanes[r] !== undefined);
  for (let i = 1; i < present.length; i++) if (f.lanes[present[i]] - f.lanes[present[i - 1]] < LANE_GAP) return false;
  return [...f.heroes, ...f.enemies].every((b) => b.alpha.y >= 0 && b.lane <= WORLD.h && b.alpha.x >= 0 && b.alpha.x + b.alpha.w <= WORLD.w);
}

/**
 * @param heroes   `state.heroes` (usa `slot`, `heroId`, `class`)
 * @param enemies  salida de `enemyList(state)` (usa `id`)
 * @param opts     { boss?: boolean | node, node?, hud?: { bottom?, top?, zoneBottom? } }  (un nodo `{type:'boss'}` también
 *                 vale en `boss`)
 * H-c (decisión del owner del 2026-11-09): si con la medida del HUD la formación no cabe con su tamaño de siempre (un
 * marco muy bajo: los carriles no tienen su separación de 24), toda la formación se achica en proporción (el mismo
 * factor `factor` para héroes y enemigos: las proporciones de V1 se mantienen) lo justo para que vuelva a caber, con
 * R24 por fila, el piso, las cabezas bajo las barras y los pies sobre los botones. Donde entra, `factor` = 1.
 * B-3 (review ronda 3): si ni achicada a SHRINK_MIN cabe (botones medidos en y 600, barras en 1500, franja en 1700), la
 * medida es absurda: se descarta y vuelven las constantes.
 */
export const SHRINK_MIN = 0.5;
export function computeFormation(heroes, enemies, opts = {}) {
  const f = buildFormation(heroes, enemies, opts, 1);
  if (!opts.hud || formationFits(f)) return f;
  const at = (fs) => buildFormation(heroes, enemies, opts, fs);
  let best = at(SHRINK_MIN);
  if (!formationFits(best)) return buildFormation(heroes, enemies, { ...opts, hud: null }, 1);
  // el mayor factor (al 0,5 %) con el que cabe: cabe en `lo`, no cabe en `hi`
  let lo = SHRINK_MIN; let hi = 1;
  while (hi - lo > 0.005) {
    const mid = Math.round(((lo + hi) / 2) * 1000) / 1000;
    const g = at(mid);
    if (formationFits(g)) { lo = mid; best = g; } else hi = mid;
  }
  return best;
}

function buildFormation(heroes, enemies, opts, fs) {
  const boss = typeof opts.boss === 'object' && opts.boss ? isBossNode(opts.boss) : !!opts.boss;
  const node = opts.node || (typeof opts.boss === 'object' ? opts.boss : null);
  const ground = groundY(node);
  const floor = ground + FLOOR_MARGIN;
  const lim = laneLimits(opts.hud);
  const H = heroRows(heroes, fs);
  const E = enemyRows(enemies, boss, node, fs);
  const band = enemyFootBand(node);
  E.xB = fitFeet(E.EB, E.xB, band);
  E.xF = fitFeet(E.EF, E.xF, band);
  const lanes = {};

  // héroes: delanteros sobre los botones; traseros lo más adelante posible sin que la fila delantera les tape la cara
  const out = { HF: [], HB: [], EF: [], EB: [] };
  if (H.HF.length) {
    lanes.HF = lim.laneMax;
    out.HF = H.HF.map((u, i) => place(u, H.xF[i], lanes.HF));
  }
  if (H.HB.length) {
    if (out.HF.length) {
      const topF = Math.min(...out.HF.map((b) => b.alpha.y));
      const ahB = Math.min(...H.HB.map((u) => u.ah));
      lanes.HB = Math.max(floor, Math.min(lanes.HF - LANE_GAP, Math.floor(topF + (1 - FACE_FRAC) * ahB)));
    } else {
      lanes.HB = lim.laneMax; // sin nadie en los slots 1–3, la fila trasera es la de más adelante
    }
    out.HB = H.HB.map((u, i) => place(u, H.xB[i], lanes.HB));
  }

  // enemigos: búsqueda del carril (o par de carriles) que menos cara tapa, y a igualdad, el más cercano a los héroes
  if (E.EF.length) {
    const heroBoxes = [...out.HF, ...out.HB];
    const below = H.HB.length ? lanes.HB : H.HF.length ? lanes.HF : lim.laneMax + LANE_GAP;
    const topLimit = E.EB.length || E.EF.length > 1 ? lim.topN : lim.top1;
    const hiF = below - LANE_GAP;
    const loB = E.EB.length ? enemyLo(E.EB, floor, topLimit, lim.zoneBottom) : null;
    const loF = Math.max(enemyLo(E.EF, floor, topLimit, lim.zoneBottom), loB !== null ? loB + LANE_GAP : -Infinity);
    let best = null;
    for (let LF = hiF; LF >= loF; LF -= STEP) {
      let total = rowScore(E.EF, E.xF, LF, heroBoxes);
      let LB = null;
      if (E.EB.length) {
        const front = [...heroBoxes, ...E.EF.map((u, i) => place(u, E.xF[i], LF))];
        const hiB = LF - LANE_GAP;
        const k = Math.floor((hiB - loB) / STEP);
        const sAt = (j) => rowScore(E.EB, E.xB, loB + j * STEP, front);
        const s0 = sAt(0);
        // la cobertura no baja al acercar la fila (monótona): el carril más cercano con la cobertura mínima
        let a = 0; let z = k;
        while (a < z) { const mid = Math.ceil((a + z) / 2); if (sAt(mid) <= s0 + EPS) a = mid; else z = mid - 1; }
        LB = loB + a * STEP;
        total += s0;
      }
      if (!best || total < best.total - EPS) best = { total, LF, LB };
    }
    if (!best) best = { LF: Math.max(loF, Math.min(hiF, loF)), LB: loB }; // sin hueco: se prioriza el piso
    lanes.EF = best.LF;
    out.EF = E.EF.map((u, i) => place(u, E.xF[i], lanes.EF));
    if (E.EB.length) {
      lanes.EB = best.LB;
      out.EB = E.EB.map((u, i) => place(u, E.xB[i], lanes.EB));
    }
  }

  const byIndex = [...out.EB, ...out.EF].sort((a, b) => a.index - b.index);
  return {
    world: WORLD, boss, ground, lanes, bg: bgArt(node), factor: fs,
    heroes: [...out.HF, ...out.HB],
    enemies: byIndex,
  };
}

// ── tendidos (V6, B3 de la revisión visual ronda 2) ─────────────────────────
export const DEAD_FLAT = 0.55;  // el grosor del cuerpo tendido se aplana al 55 % (suelo visto en 2,5D)
export const DEAD_LEN = 0.9;    // y el largo, al 90 %: tres delanteros tendidos caben en 824 con hueco
/** Todos los de un bando caen hacia el mismo lado: héroes con la cabeza a la izquierda, enemigos a la derecha. */
export const fallDir = (kind) => (kind === 'hero' ? -1 : 1);

/**
 * Caja (mundo) de una unidad tendida sobre su carril: largo = alto de su silueta × DEAD_LEN, centrado en su x sin
 * salirse del lienzo; grosor = ancho de su silueta × DEAD_FLAT, apoyado en el carril. `head` = extremo de la cabeza.
 */
export function lyingBox(b) {
  const kind = b.side === 'e' ? 'enemy' : 'hero';
  const g = spriteGeom(kind, b.art, kind === 'enemy' ? 'hit' : 'idle');
  const s = b.h / g.H;
  const len = (g.b - g.t + 1) * s * DEAD_LEN;
  const thick = (g.r - g.l + 1) * s * DEAD_FLAT;
  const half = len / 2;
  const cx = Math.min(WORLD.w - half - 4, Math.max(half + 4, b.cx));
  const dir = fallDir(kind);
  return { id: b.id, row: b.row, x: cx - half, y: b.lane - thick, w: len, h: thick, cx, dir, head: dir < 0 ? cx - half : cx + half };
}

/**
 * Cajas tendidas de toda la formación (como si cayeran todos): dentro de cada fila, si dos cuerpos se pisan se separan
 * lo justo (hueco ≥ 4) sin salirse del lienzo, conservando el largo ×0,9. Devuelve { [id]: caja }.
 */
export function lyingBoxes(f) {
  const rows = {};
  for (const b of [...(f.heroes || []), ...(f.enemies || [])]) (rows[b.row] = rows[b.row] || []).push(lyingBox(b));
  const out = {};
  for (const list of Object.values(rows)) {
    list.sort((p, q) => p.cx - q.cx);
    const move = (L, dx) => { L.cx += dx; L.x += dx; L.head += dx; };
    for (let it = 0; it < 6; it++) {
      for (let i = 1; i < list.length; i++) {
        const need = list[i - 1].x + list[i - 1].w + 4 - list[i].x;
        if (need > 0) { move(list[i - 1], -need / 2); move(list[i], need / 2); }
      }
      for (const L of list) {
        if (L.x < 4) move(L, 4 - L.x);
        if (L.x + L.w > WORLD.w - 4) move(L, WORLD.w - 4 - L.x - L.w);
      }
    }
    for (const L of list) out[L.id] = L;
  }
  return out;
}

/** Cobertura de cara de cada unidad por las filas de delante (para medir la legibilidad de una formación). */
export function faceCoverage(f) {
  const all = [...f.heroes, ...f.enemies];
  return Object.fromEntries(all.map((b) => [b.id, faceCover(b, all.filter((o) => o.lane > b.lane))]));
}
