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
};
export const ENEMY_ART = {
  bruto: ['idle', 'hit'],
};
// Fondos: clave → archivo (sin extensión).
export const BG_ART = {
  crypt: 'combat_crypt',
};

// Intención por heroId (vacío en S0; S2 = un arte por héroe).
export const HERO_BY_ID = {};
// Intención por clase (S1 agrega paladin y rogue).
export const HERO_BY_CLASS = { warrior: 'warrior', mage: 'mage', ranger: 'ranger', paladin: 'paladin', rogue: 'rogue' };

// Intención de enemigo por nodo y por tipo (nombres de la lista de design §11).
export const ENEMY_BY_NODE = { a1n5: 'boss_heraldo', a1n9: 'boss_devorador', a2n5: 'coloso', a2n10: 'boss_heraldo' };
export const ENEMY_BY_TYPE = { combat: 'bruto', wave: 'coloso', boss: 'boss_devorador' };
// Intención de fondo por tipo de nodo.
export const BG_BY_TYPE = { combat: 'crypt', wave: 'crypt', boss: 'crypt' };

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

/** Clave de fondo de un nodo. Nunca lanza. */
export function bgArt(node) {
  const n = nodeOf(node);
  const wanted = has(BG_BY_TYPE, n.type) ? BG_BY_TYPE[n.type] : null;
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
