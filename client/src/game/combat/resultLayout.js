/**
 * Dónde va el cartel de resultado (combate_b V8, B1/B2 de la revisión visual ronda 2 y decisión del owner del
 * 2026-11-09). PURO: recibe la formación (mundo 824×1720), cómo cae el lienzo en la pantalla y el tamaño del cartel, y
 * devuelve el centro vertical del cartel en px CSS.
 * Todas las medidas van en el MARCO del panel (0 = su borde superior izquierdo, `viewH` = su alto): con el tope de
 * aspecto 2,1 el marco no siempre arranca en el borde de la ventana (360×800: 756 de alto desde y 22).
 *  - Siempre dentro del tercio medio de la pantalla (V8), lo más cerca posible del 34 % del alto.
 *  - Victoria: no toca ninguna silueta, ni héroes ni enemigos caídos, ni el HUD.
 *  - Derrota: puede tapar a los enemigos vivos (la escena está bajo el velo, R41), pero no a los héroes (tendidos) ni el
 *    HUD; entre las posiciones posibles se elige la que no corta caras de enemigos (35 % superior) cuando hay sitio.
 */
import { WORLD, FACE_FRAC, BREATH, lyingBoxes } from './formation';

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
 * Quien sigue de pie respira (escala y hasta BREATH.y desde el pie): su caja y su cara se toman con lo que crecen hacia
 * arriba, así el cartel no las roza en ningún momento de la respiración.
 */
export function silhouettesCss(f, alive, map) {
  const lying = lyingBoxes(f);
  return [...f.heroes, ...f.enemies].map((b) => {
    const up = alive[b.id] !== false;
    const grow = up ? (BREATH.y - 1) * b.alpha.h : 0;
    const rect = up ? { x: b.alpha.x, y: b.alpha.y - grow, w: b.alpha.w, h: b.alpha.h + grow } : lying[b.id];
    return {
      id: b.id, side: b.side, alive: up,
      rect: toCss(rect, map),
      face: up ? toCss({ x: b.alpha.x, y: b.alpha.y - grow, w: b.alpha.w, h: b.alpha.h * FACE_FRAC + grow }, map) : null,
    };
  });
}

const area = (a, b) => Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x))
  * Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));

/**
 * @param outcome  'victory' | 'defeat'
 * @param sil      salida de `silhouettesCss`
 * @param avoid    rectángulos CSS del HUD que el cartel no puede tapar (fila de botones, barras)
 * @param viewH    alto del marco del panel (px CSS); `cy` sale en ese marco, como el `top` del cartel
 * @param banner   { x0, x1, h, shadow? }: extremos horizontales y alto del cartel (px CSS, su caja de maquetación: la
 *                 escala de la animación de entrada no cuenta) y su sombra dura hacia abajo, que también tapa
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
    const r = { x: banner.x0, y: cy - banner.h / 2, w: banner.x1 - banner.x0, h: banner.h + (banner.shadow || 0) };
    const key = [hard.reduce((t, s) => t + area(r, s), 0), faces.reduce((t, s) => t + area(r, s), 0), Math.abs(cy - target)];
    if (!best || key[0] < best.key[0] - 1e-9 || (Math.abs(key[0] - best.key[0]) <= 1e-9
      && (key[1] < best.key[1] - 1e-9 || (Math.abs(key[1] - best.key[1]) <= 1e-9 && key[2] < best.key[2])))) {
      best = { cy, key };
    }
  }
  return { cy: best.cy, ok: best.key[0] === 0, faceCut: best.key[1] };
}
