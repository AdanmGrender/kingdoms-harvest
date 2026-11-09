/**
 * Mapa de arte del combate (combate_b R28–R32, design §9/§11). PURO: sin Phaser, sin config del servidor.
 * Tres registros de lo que EXISTE hoy bajo `client/public/assets/b/` y tablas de intención (qué arte
 * quisiéramos por héroe/nodo). Lo que no esté registrado cae al fallback: héroe → arte de su clase →
 * `warrior`; enemigo → `bruto`; fondo → `crypt`. Nunca devuelve rutas del arte viejo.
 * Al llegar arte nuevo (Etapa B) solo se amplían `HERO_ART`, `ENEMY_ART` y `BG_ART`.
 */

const BASE = '/assets/b';

export const FALLBACK = { hero: 'warrior', enemy: 'bruto', bg: 'crypt' };

// Poses disponibles por clave (archivo = `<clave>_<pose>.webp`).
export const HERO_ART = {
  warrior: ['idle', 'attack'],
  mage: ['idle', 'attack'],
  ranger: ['idle', 'attack'],
  paladin: ['idle', 'attack'],
  rogue: ['idle', 'attack'],
};
export const ENEMY_ART = {
  bruto: ['idle', 'hit'],
  carroneros: ['idle', 'hit'],
  aullador: ['idle', 'hit'],
  coloso: ['idle', 'hit'],
  boss_devorador: ['idle', 'hit'],
  boss_heraldo: ['idle', 'hit'],
  sin_rostro: ['idle', 'hit'],
  voz_del_velo: ['idle', 'hit'],
};
// Fondos: clave → archivo (sin extensión).
export const BG_ART = {
  crypt: 'combat_crypt',
  moor: 'combat_moor',
  cathedral: 'combat_cathedral',
  ashfield: 'combat_ashfield',
  veil_marsh: 'combat_veil_marsh',
  veil_gate: 'combat_veil_gate',
};

// Cómo dibuja `CombatScene` el fondo: «cover» del lienzo × BG_COVER, con una deriva lenta que lo escala hasta
// × BG_DRIFT alrededor del centro. Todos los fondos miden 1080×1935.
export const BG_IMAGE = { w: 1080, h: 1935 };
export const BG_COVER = 1.04;
export const BG_DRIFT = 1.025;
const LIENZO = { w: 824, h: 1720 };
export const bgCoverScale = (iw = BG_IMAGE.w, ih = BG_IMAGE.h) => Math.max(LIENZO.w / iw, LIENZO.h / ih) * BG_COVER;

// Piso transitable (V2 enmendada): primera fila de la IMAGEN desde la que la franja central (x 20–80 %) es piso por el
// que se camina; leída sobre cada `combat_*.webp` con una regla cada 1 % (método y capturas en
// `specs/combate_b/evidencia/hoja/calibrar_suelo.cjs` → `calibracion_suelo.json`, `suelo/*.webp`).
export const BG_FLOOR_IMAGE_FRAC = {
  crypt: 0.48,       // calle embarrada
  moor: 0.50,        // tierra del páramo
  cathedral: 0.61,   // losas delante del estrado del altar
  ashfield: 0.42,    // llanura de ceniza
  veil_marsh: 0.51,  // barro de la orilla
  veil_gate: 0.575,  // pie de la escalera del portal
};

/** Fila de la imagen del fondo → y del mundo 824×1720, con la transformación de la escena (peor caso de la deriva: la más baja). */
export function bgImageRowToWorldY(f) {
  const s = bgCoverScale();
  return Math.ceil(LIENZO.h / 2 + (f - 0.5) * BG_IMAGE.h * s * (f > 0.5 ? BG_DRIFT : 1));
}

// Línea de suelo de cada fondo como fracción del alto 1720 (= `calibracion_suelo.json`): los carriles van por debajo.
export const BG_GROUND_Y_FRAC = Object.fromEntries(
  Object.entries(BG_FLOOR_IMAGE_FRAC).map(([k, f]) => [k, Number((bgImageRowToWorldY(f) / LIENZO.h).toFixed(4))]),
);

// Geometría de cada textura, medida sobre los webp reales: [W, H, l, r, t, b, ox].
// l..r y t..b = caja de los píxeles con alfa > 0 (`specs/combate_b/evidencia/hoja/medir_alfa.cjs`); el pie es la fila b.
// ox = origen X que deja el cuerpo donde está en la pose idle (idle = 0,5); se alinea por el perfil de las piernas
// (`specs/combate_b/evidencia/hoja/medir_poses.cjs`). Así el pie no se mueve al cambiar de pose.
export const SPRITE_GEOM = {
  'hero:warrior:idle': [444, 640, 12, 439, 12, 627, 0.5],
  'hero:warrior:attack': [705, 640, 13, 700, 13, 626, 0.321],
  'hero:mage:idle': [438, 640, 12, 425, 12, 627, 0.5],
  'hero:mage:attack': [735, 640, 14, 734, 14, 625, 0.39],
  'hero:ranger:idle': [413, 640, 12, 409, 12, 627, 0.5],
  'hero:ranger:attack': [791, 640, 0, 788, 15, 624, 0.329],
  'hero:paladin:idle': [445, 640, 12, 432, 11, 628, 0.5],
  'hero:paladin:attack': [517, 640, 12, 504, 12, 627, 0.44],
  'hero:rogue:idle': [464, 640, 12, 451, 12, 627, 0.5],
  'hero:rogue:attack': [803, 640, 15, 787, 15, 624, 0.631],
  'enemy:bruto:idle': [620, 720, 13, 606, 13, 707, 0.5],
  'enemy:bruto:hit': [665, 720, 13, 651, 13, 707, 0.466],
  'enemy:carroneros:idle': [674, 720, 14, 659, 14, 711, 0.5],
  'enemy:carroneros:hit': [701, 720, 13, 687, 13, 706, 0.494],
  'enemy:aullador:idle': [522, 720, 14, 507, 14, 705, 0.5],
  'enemy:aullador:hit': [622, 720, 13, 608, 13, 706, 0.423],
  'enemy:coloso:idle': [601, 720, 14, 586, 14, 705, 0.5],
  'enemy:coloso:hit': [651, 720, 13, 637, 13, 706, 0.466],
  'enemy:boss_devorador:idle': [688, 720, 14, 673, 14, 705, 0.5],
  'enemy:boss_devorador:hit': [687, 720, 21, 665, 14, 712, 0.479],
  'enemy:boss_heraldo:idle': [618, 720, 13, 604, 13, 706, 0.5],
  'enemy:boss_heraldo:hit': [727, 720, 13, 713, 13, 706, 0.536],
  'enemy:sin_rostro:idle': [488, 720, 13, 474, 13, 706, 0.5],
  'enemy:sin_rostro:hit': [632, 720, 13, 618, 13, 706, 0.554],
  'enemy:voz_del_velo:idle': [642, 720, 13, 628, 13, 706, 0.5],
  'enemy:voz_del_velo:hit': [693, 720, 14, 678, 14, 709, 0.541],
};

/**
 * Geometría de `kind/art/pose` (cae a la idle del fallback si falta). `ox`/`oy` = origen que apoya el pie en (x, y):
 * oy = (b + 1) / H deja la fila inferior con alfa justo encima del carril.
 */
export function spriteGeom(kind, art, pose = 'idle') {
  const fb = kind === 'enemy' ? FALLBACK.enemy : FALLBACK.hero;
  const g = SPRITE_GEOM[`${kind}:${art}:${pose}`] || SPRITE_GEOM[`${kind}:${art}:idle`] || SPRITE_GEOM[`${kind}:${fb}:idle`];
  const [W, H, l, r, t, b, ox] = g;
  return { W, H, l, r, t, b, ox, oy: (b + 1) / H };
}

// Nombre visible de cada arte de enemigo (V9: la barra de vida dice lo que se ve en pantalla).
export const ENEMY_DISPLAY_NAME = {
  bruto: 'Bruto', carroneros: 'Carroñero', aullador: 'Aullador', coloso: 'Coloso de Ceniza',
  boss_devorador: 'Devorador', boss_heraldo: 'Heraldo', sin_rostro: 'Sin Rostro', voz_del_velo: 'Voz del Velo',
};

// Intención por heroId (vacío en S0; S2 = un arte por héroe).
export const HERO_BY_ID = {};
// Intención por clase (S1 agrega paladin y rogue).
export const HERO_BY_CLASS = { warrior: 'warrior', mage: 'mage', ranger: 'ranger', paladin: 'paladin', rogue: 'rogue' };

// Intención de enemigo por nodo y por tipo (nombres de la lista de design §11).
// Mapeo Q4 (design §175) + los dos de acto 2 de §11 (a2n7 «Los Sin Rostro», a2n10 «La Voz del Velo»); el resto cae a `bruto`.
export const ENEMY_BY_NODE = {
  a1n3: 'bruto', a1n7: 'carroneros', a1n4: 'aullador', a1n8: 'aullador',
  a1n5: 'boss_heraldo', a1n9: 'boss_devorador', a2n5: 'coloso', a2n7: 'sin_rostro', a2n10: 'voz_del_velo',
};
export const ENEMY_BY_TYPE = { combat: 'bruto', wave: 'bruto', boss: 'boss_devorador' };
// Intención de fondo por tipo de nodo (defecto) y por acto+tipo (`<acto>:<tipo>`).
export const BG_BY_TYPE = { combat: 'crypt', wave: 'crypt', boss: 'crypt' };
export const BG_BY_ACT_TYPE = {
  '1:combat': 'crypt', '1:wave': 'moor', '1:boss': 'cathedral',
  '2:combat': 'ashfield', '2:wave': 'veil_marsh', '2:boss': 'veil_gate',
};

const isStr = (v) => typeof v === 'string' && v.length > 0;
const has = (obj, k) => isStr(k) && Object.prototype.hasOwnProperty.call(obj, k);

/** Clave de arte de un héroe: `heroArt(heroId, heroClass)` o `heroArt({heroId, class})`. Nunca lanza. */
export function heroArt(hero, heroClass) {
  const h = hero && typeof hero === 'object' ? hero : { heroId: hero, class: heroClass };
  const byId = h.heroId != null && has(HERO_BY_ID, h.heroId) ? HERO_BY_ID[h.heroId] : null;
  if (byId && has(HERO_ART, byId)) return byId;
  const byClass = has(HERO_BY_CLASS, h.class) ? HERO_BY_CLASS[h.class] : null;
  if (byClass && has(HERO_ART, byClass)) return byClass;
  return FALLBACK.hero;
}

const nodeOf = (node) => (node && typeof node === 'object' ? node : { id: node });

/** Clave de arte del enemigo de un nodo `{id, type, isBoss}`. Nunca lanza. */
export function enemyArt(node) {
  const n = nodeOf(node);
  const wanted = (has(ENEMY_BY_NODE, n.id) && ENEMY_BY_NODE[n.id]) || (has(ENEMY_BY_TYPE, n.type) && ENEMY_BY_TYPE[n.type]) || null;
  return wanted && has(ENEMY_ART, wanted) ? wanted : FALLBACK.enemy;
}

/** Nombre visible del enemigo de un nodo (según el arte que se dibuja). */
export const enemyDisplayName = (node) => ENEMY_DISPLAY_NAME[enemyArt(node)] || ENEMY_DISPLAY_NAME.bruto;

const actOf = (n) => {
  if (Number.isInteger(n.act)) return n.act;
  const m = isStr(n.id) ? /^a(\d+)n\d+$/.exec(n.id) : null;
  return m ? Number(m[1]) : null;
};

/** Clave de fondo de un nodo (acto+tipo → tipo → `crypt`). Nunca lanza. */
export function bgArt(node) {
  const n = nodeOf(node);
  const act = actOf(n);
  const byAct = act != null && isStr(n.type) ? `${act}:${n.type}` : null;
  const wanted = (byAct && has(BG_BY_ACT_TYPE, byAct) && BG_BY_ACT_TYPE[byAct]) || (has(BG_BY_TYPE, n.type) ? BG_BY_TYPE[n.type] : null);
  return wanted && has(BG_ART, wanted) ? wanted : FALLBACK.bg;
}

/** ¿Es un nodo de jefe? (topes de tamaño de R27) */
export const isBossNode = (node) => {
  const n = nodeOf(node);
  return !!(n.isBoss || n.type === 'boss');
};

/** Clave de textura de Phaser: `hero:warrior:idle`, `enemy:bruto:hit`, `bg:crypt`. */
export const textureKey = (kind, key, pose) => (kind === 'bg' ? `bg:${key}` : `${kind}:${key}:${pose}`);

/** URL de la textura (siempre bajo `/assets/b/`). */
export function textureUrl(kind, key, pose) {
  if (kind === 'bg') return `${BASE}/bg/${BG_ART[has(BG_ART, key) ? key : FALLBACK.bg]}.webp`;
  if (kind === 'enemy') return `${BASE}/enemies/${has(ENEMY_ART, key) ? key : FALLBACK.enemy}_${pose}.webp`;
  return `${BASE}/heroes/${has(HERO_ART, key) ? key : FALLBACK.hero}_${pose}.webp`;
}

const heroPoses = (key) => HERO_ART[has(HERO_ART, key) ? key : FALLBACK.hero];

/**
 * Texturas que necesita el combate en curso: la escuadra (sin repetir arte), el enemigo y el fondo.
 * @returns [{ key, url }]
 */
export function collectAssetKeys(state, node) {
  const out = new Map();
  const add = (kind, key, pose) => {
    const k = textureKey(kind, key, pose);
    if (!out.has(k)) out.set(k, { key: k, url: textureUrl(kind, key, pose) });
  };
  const heroes = state && Array.isArray(state.heroes) ? state.heroes : [];
  for (const h of heroes) {
    const art = heroArt(h);
    for (const pose of heroPoses(art)) add('hero', art, pose);
  }
  const ek = enemyArt(node);
  for (const pose of ENEMY_ART[ek]) add('enemy', ek, pose);
  add('bg', bgArt(node));
  return [...out.values()];
}
