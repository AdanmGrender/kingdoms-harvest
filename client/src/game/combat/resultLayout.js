/**
 * Dónde va el cartel de resultado (combate_b V8, B1/B2 de la revisión visual ronda 2 y decisión del owner del
 * 2026-11-09). PURO: recibe la formación (mundo 824×1720), cómo cae el lienzo en la pantalla y el tamaño del cartel, y
 * devuelve el centro vertical del cartel en px CSS.
 *  - Siempre dentro del tercio medio de la pantalla (V8), lo más cerca posible del 34 % del alto.
 *  - Victoria: no toca ninguna silueta, ni héroes ni enemigos caídos, ni el HUD.
 *  - Derrota: puede tapar a los enemigos vivos (la escena está bajo el velo, R41), pero no a los héroes (tendidos) ni el
 *    HUD; entre las posiciones posibles se elige la que no corta caras de enemigos (35 % superior) cuando hay sitio.
 */
import { WORLD, FACE_FRAC, lyingBoxes } from './formation';

export const BANNER_CENTER = 0.34;   // centro preferido, en fracción del alto de la pantalla
export const BANNER_MAX_H = 70;      // alto máximo del cartel compacto, px CSS

/** Mundo → pantalla: el lienzo 824×1720 va en FIT y centrado dentro del escenario (`stage`, rectángulo CSS). */
export function worldToCss(stage) {
  const k = Math.min(stage.width / WORLD.w, stage.height / WORLD.h);
  return { k, x0: stage.left + (stage.width - WORLD.w * k) / 2, y0: stage.top + (stage.height - WORLD.h * k) / 2 };
}

const toCss = (r, m) => ({ x: m.x0 + r.x * m.k, y: m.y0 + r.y * m.k, w: r.w * m.k, h: r.h * m.k });

/**
 * Siluetas de la formación en el estado final, en px CSS: de pie (caja alfa, con su cara) o tendidas (caja de
 * `lyingBoxes`, sin cara). `alive` = { [id]: boolean }.
 */
export function silhouettesCss(f, alive, map) {
  const lying = lyingBoxes(f);
  return [...f.heroes, ...f.enemies].map((b) => {
    const up = alive[b.id] !== false;
    const rect = up ? b.alpha : lying[b.id];
    return {
      id: b.id, side: b.side, alive: up,
      rect: toCss(rect, map),
      face: up ? toCss({ x: b.alpha.x, y: b.alpha.y, w: b.alpha.w, h: b.alpha.h * FACE_FRAC }, map) : null,
    };
  });
}

const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * @param outcome  'victory' | 'defeat'
 * @param sil      salida de `silhouettesCss`
 * @param avoid    rectángulos CSS del HUD que el cartel no puede tapar (fila de botones, barras)
 * @param viewH    alto de la pantalla (px CSS)
 * @param banner   { x0, x1, h }: extremos horizontales y alto del cartel (px CSS)
 * @returns { cy, ok, faceCut }  ok = false si no hay ninguna posición sin tapar lo prohibido (se usa la que menos tapa)
 */
export function placeResultBanner({ outcome, sil, avoid = [], viewH, banner }) {
  const lo = Math.ceil(viewH / 3);
  const hi = Math.floor((2 * viewH) / 3);
  const target = BANNER_CENTER * viewH;
  const victory = outcome === 'victory';
  const hard = [...sil.filter((s) => victory || s.side === 'h').map((s) => s.rect), ...avoid];
  const faces = victory ? [] : sil.filter((s) => s.side === 'e' && s.alive && s.face).map((s) => s.face);
  let best = null;
  for (let cy = lo; cy <= hi; cy += 1) {
    const r = { x: banner.x0, y: cy - banner.h / 2, w: banner.x1 - banner.x0, h: banner.h };
    const key = [hard.reduce((t, s) => t + area(r, s), 0), faces.reduce((t, s) => t + area(r, s), 0), Math.abs(cy - target)];
    if (!best || key[0] < best.key[0] - 1e-9 || (Math.abs(key[0] - best.key[0]) <= 1e-9
      && (key[1] < best.key[1] - 1e-9 || (Math.abs(key[1] - best.key[1]) <= 1e-9 && key[2] < best.key[2])))) {
      best = { cy, key };
    }
  }
  return { cy: best.cy, ok: best.key[0] === 0, faceCut: best.key[1] };
}
