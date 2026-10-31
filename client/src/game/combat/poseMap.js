/**
 * Poses clave extra del combate B (piloto poses_b_piloto, P2). PURO: sin Phaser. Archivo APARTE de `artMap.js`
 * (F7 edita ese): aquí vive el registro de poses extra y la cadena de fallback. Un personaje sin la pose pedida
 * cae a la siguiente de la cadena (hit → idle, skill → attack → idle…) y la escena le suma el movimiento de
 * `motion.js`, así que el combate nunca depende de que exista el arte nuevo.
 */
import { textureKey } from './artMap';

const BASE = '/assets/b';

// Poses extra por `<kind>:<clave de arte>` (archivo = `<clave>_<pose>.webp`). Ampliar al extender el piloto al elenco.
export const EXTRA_POSES = {
  'hero:warrior': ['hit', 'skill', 'ko', 'victory'],
  'enemy:bruto': ['attack', 'ko'],
};

const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

/** ¿Tiene `key` esa pose extra registrada? */
export const hasExtraPose = (kind, key, pose) => has(EXTRA_POSES, `${kind}:${key}`) && EXTRA_POSES[`${kind}:${key}`].includes(pose);

/** Cadena de fallback por pose pedida. `null` = conservar la textura actual (solo el movimiento cuenta la historia). */
export function poseChain(kind, pose) {
  const enemy = kind === 'enemy';
  switch (pose) {
    case 'attack': return enemy ? ['attack', 'hit', 'idle'] : ['attack', 'idle'];
    case 'skill': return enemy ? ['skill', 'attack', 'hit', 'idle'] : ['skill', 'attack', 'idle'];
    case 'hit': return ['hit', 'idle'];
    case 'ko': return ['ko', null];
    case 'victory': return ['victory', 'idle'];
    default: return [pose, 'idle'];
  }
}

/**
 * Primera pose de la cadena que está disponible. `available(kind, key, pose)` → boolean (la escena responde
 * con "la textura cargó"). Devuelve la pose elegida o `null` (= no cambiar la textura).
 */
export function resolvePose(kind, key, pose, available) {
  for (const p of poseChain(kind, pose)) {
    if (p === null) return null;
    if (available(kind, key, p)) return p;
  }
  return 'idle';
}

/** ¿Es una pose extra que ocupa su propia escala (mismo px/unidad que el idle) en vez de ajustarse a la altura base? */
export const isExtraPose = (kind, key, pose) => hasExtraPose(kind, key, pose);

/** Texturas extra a cargar para el conjunto de texturas base del combate (`collectAssetKeys`). */
export function extraAssetKeys(assets) {
  const out = [];
  const seen = new Set();
  for (const a of assets || []) {
    const m = /^(hero|enemy):([^:]+):idle$/.exec(a.key || '');
    if (!m) continue;
    const [, kind, key] = m;
    for (const pose of (has(EXTRA_POSES, `${kind}:${key}`) ? EXTRA_POSES[`${kind}:${key}`] : [])) {
      const k = textureKey(kind, key, pose);
      if (seen.has(k) || (assets || []).some((x) => x.key === k)) continue;
      seen.add(k);
      out.push({ key: k, url: `${BASE}/${kind === 'enemy' ? 'enemies' : 'heroes'}/${key}_${pose}.webp` });
    }
  }
  return out;
}
