/**
 * Movimiento por código del combate B (piloto poses_b_piloto, P1). PURO: sin Phaser, sin azar propio
 * (el azar entra por `rng`). Devuelve planes de pasos que la escena aplica con tweens sobre un canal
 * `{x, y, sx, sy, rot}` por actor — nada de arte nuevo. Todo el elenco usa esta tabla de perfiles.
 *
 * Convenciones: `x/y` en px lógicos (lienzo 824×1720), `sx/sy` = multiplicadores de escala RELATIVOS
 * (0 = sin cambio, +0.1 = 10 % más grande), `rot` en grados (el sprite pivota en los pies).
 * Presupuesto: ninguna secuencia dura más que la duración del beat que la dispara (Q8: la ronda no se alarga);
 * con `reduced` no hay desplazamientos, saltos ni inclinaciones (Q10): solo cambios de pose y fades.
 */

export const NEUTRAL = Object.freeze({ x: 0, y: 0, sx: 0, sy: 0, rot: 0 });
export const CHANNELS = ['act', 'hit', 'idle', 'end'];

/**
 * Perfil de personalidad. Campos:
 *  - breath {period ms, amp}: respiración (escala vertical).   - float {amp px, period}: flotación (mago).
 *  - shift {min,max ms entre cambios de peso, dx px, dur ms}.
 *  - heft 0..1: peso. Más pesado = retrocede menos al recibir un golpe, más lento al embestir.
 *  - atk {back px, squash, stretch, lean °, reach px máx., windup/lunge/settle: fracciones del tiempo, contact 0..1}
 *  - hurt {recoil px base, max px, tilt °}
 *  - fall {tilt °, drop px, ms}
 *  - win {hop px, hops, ms}
 */
export const PROFILES = {
  hero: {
    warrior: { breath: { period: 2000, amp: 0.018 }, float: null, shift: { min: 2800, max: 5200, dx: 7, dur: 700 }, heft: 0.85,
      atk: { back: 20, squash: 0.1, stretch: 0.1, lean: 7, reach: 120, windup: 0.34, lunge: 0.22, settle: 0.44, contact: 0.56 },
      hurt: { recoil: 14, max: 52, tilt: 6 }, fall: { tilt: 18, drop: 14, ms: 700 }, win: { hop: 44, hops: 2, ms: 900 } },
    rogue: { breath: { period: 1000, amp: 0.012 }, float: null, shift: { min: 1400, max: 3000, dx: 11, dur: 380 }, heft: 0.2,
      atk: { back: 14, squash: 0.06, stretch: 0.16, lean: 12, reach: 190, windup: 0.2, lunge: 0.2, settle: 0.6, contact: 0.4 },
      hurt: { recoil: 22, max: 80, tilt: 9 }, fall: { tilt: 22, drop: 10, ms: 560 }, win: { hop: 70, hops: 2, ms: 760 } },
    mage: { breath: { period: 2800, amp: 0.01 }, float: { amp: 9, period: 2400 }, shift: { min: 3200, max: 6000, dx: 5, dur: 900 }, heft: 0.25,
      atk: { back: 10, squash: 0.05, stretch: 0.08, lean: 4, reach: 50, windup: 0.42, lunge: 0.18, settle: 0.4, contact: 0.6 },
      hurt: { recoil: 20, max: 70, tilt: 7 }, fall: { tilt: 15, drop: 16, ms: 720 }, win: { hop: 50, hops: 1, ms: 820 } },
    ranger: { breath: { period: 1700, amp: 0.012 }, float: null, shift: { min: 2200, max: 4200, dx: 6, dur: 520 }, heft: 0.45,
      atk: { back: 24, squash: 0.04, stretch: 0.05, lean: -4, reach: 36, windup: 0.46, lunge: 0.12, settle: 0.42, contact: 0.52 },
      hurt: { recoil: 18, max: 62, tilt: 6 }, fall: { tilt: 18, drop: 12, ms: 620 }, win: { hop: 52, hops: 2, ms: 820 } },
    paladin: { breath: { period: 2400, amp: 0.012 }, float: null, shift: { min: 3600, max: 6400, dx: 4, dur: 800 }, heft: 0.9,
      atk: { back: 12, squash: 0.06, stretch: 0.06, lean: 4, reach: 90, windup: 0.4, lunge: 0.2, settle: 0.4, contact: 0.58 },
      hurt: { recoil: 10, max: 40, tilt: 3 }, fall: { tilt: 14, drop: 14, ms: 780 }, win: { hop: 30, hops: 1, ms: 900 } },
  },
  enemy: {
    bruto: { breath: { period: 2300, amp: 0.022 }, float: null, shift: { min: 2400, max: 4600, dx: 9, dur: 760 }, heft: 0.9,
      atk: { back: 26, squash: 0.12, stretch: 0.1, lean: 8, reach: 150, windup: 0.4, lunge: 0.2, settle: 0.4, contact: 0.6 },
      hurt: { recoil: 12, max: 46, tilt: 5 }, fall: { tilt: 24, drop: 20, ms: 760 }, win: { hop: 0, hops: 0, ms: 0 } },
    coloso: { breath: { period: 3000, amp: 0.016 }, float: null, shift: { min: 3600, max: 6400, dx: 6, dur: 900 }, heft: 1,
      atk: { back: 16, squash: 0.08, stretch: 0.06, lean: 4, reach: 110, windup: 0.46, lunge: 0.18, settle: 0.36, contact: 0.62 },
      hurt: { recoil: 6, max: 30, tilt: 2 }, fall: { tilt: 14, drop: 26, ms: 860 }, win: { hop: 0, hops: 0, ms: 0 } },
    boss_heraldo: { breath: { period: 2600, amp: 0.014 }, float: { amp: 12, period: 3200 }, shift: { min: 3000, max: 5600, dx: 6, dur: 900 }, heft: 0.7,
      atk: { back: 14, squash: 0.06, stretch: 0.08, lean: 5, reach: 100, windup: 0.44, lunge: 0.18, settle: 0.38, contact: 0.6 },
      hurt: { recoil: 8, max: 34, tilt: 3 }, fall: { tilt: 12, drop: 24, ms: 880 }, win: { hop: 0, hops: 0, ms: 0 } },
    boss_devorador: { breath: { period: 2800, amp: 0.02 }, float: null, shift: { min: 3000, max: 5600, dx: 8, dur: 900 }, heft: 0.95,
      atk: { back: 18, squash: 0.1, stretch: 0.08, lean: 4, reach: 110, windup: 0.46, lunge: 0.2, settle: 0.34, contact: 0.62 },
      hurt: { recoil: 6, max: 28, tilt: 2 }, fall: { tilt: 16, drop: 30, ms: 900 }, win: { hop: 0, hops: 0, ms: 0 } },
  },
};

export const DEFAULT_PROFILE = {
  breath: { period: 1800, amp: 0.014 }, float: null, shift: { min: 2600, max: 5000, dx: 6, dur: 600 }, heft: 0.5,
  atk: { back: 18, squash: 0.07, stretch: 0.08, lean: 6, reach: 100, windup: 0.36, lunge: 0.2, settle: 0.44, contact: 0.56 },
  hurt: { recoil: 14, max: 56, tilt: 5 }, fall: { tilt: 18, drop: 14, ms: 680 }, win: { hop: 40, hops: 1, ms: 800 },
};

const has = (o, k) => typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k);

/** Perfil de un actor (`kind` 'hero'|'enemy', `art` = clave de arte). Nunca lanza: lo desconocido cae al neutro. */
export function profileFor(kind, art) {
  const table = PROFILES[kind === 'enemy' ? 'enemy' : 'hero'];
  return has(table, art) ? table[art] : DEFAULT_PROFILE;
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const r2 = (v) => Math.round(v * 100) / 100;
export const state = (o = {}) => ({ ...NEUTRAL, ...o });

/** Duración total de una lista de pasos. */
export const stepsEnd = (steps) => (steps || []).reduce((m, s) => Math.max(m, s.at + s.dur), 0);

/** Normaliza (dx,dy) a vector unitario; sin dirección, hacia arriba. */
export function unit(dx, dy) {
  const L = Math.hypot(dx, dy);
  return L > 1e-6 ? { x: dx / L, y: dy / L } : { x: 0, y: -1 };
}

/**
 * Ataque: anticipación (retroceso corto + aplastar) → embestida con estirar → aterrizaje con rebote.
 * @param {object} p       perfil
 * @param {object} o       { dur: ms del beat, dirX, dirY: hacia el objetivo, dist: px hasta él, reduced }
 * @returns {{steps, contactAt, total}} contactAt = ms (desde el inicio) en que el golpe conecta
 */
export function attackPlan(p, o = {}) {
  const dur = Math.max(1, Number(o.dur) || 420);
  const a = p.atk;
  // El peso alarga un poco la secuencia, pero nunca más que el beat.
  const total = Math.min(dur, Math.round(dur * (0.78 + 0.2 * p.heft)));
  const contactAt = Math.round(total * a.contact);
  if (o.reduced) return { steps: [], contactAt, total };
  const d = unit(o.dirX, o.dirY);
  const reach = Math.min(a.reach, Math.max(0, (Number(o.dist) || a.reach) * 0.45));
  const lean = a.lean * clamp(d.x * 2, -1, 1);
  const tWind = Math.round(total * a.windup);
  const tLunge = Math.round(total * a.lunge);
  const tBounce = Math.round(total * a.settle * 0.45);
  const tRest = Math.max(1, total - tWind - tLunge - tBounce);
  const steps = [
    // anticipación: se aleja del objetivo y se aplasta
    { at: 0, dur: tWind, ease: 'Sine.easeOut', to: state({ x: -d.x * a.back, y: -d.y * a.back, sx: a.squash * 0.7, sy: -a.squash, rot: -lean * 0.6 }) },
    // embestida: estirada hacia el objetivo, inclinado hacia él
    { at: tWind, dur: tLunge, ease: 'Quad.easeIn', to: state({ x: d.x * reach, y: d.y * reach, sx: -a.stretch * 0.4, sy: a.stretch, rot: lean }) },
    // aterrizaje con rebote (aplasta de nuevo y sobrepasa un poco)
    { at: tWind + tLunge, dur: tBounce, ease: 'Quad.easeOut', to: state({ x: d.x * reach * 0.55, y: d.y * reach * 0.55, sx: a.squash * 0.9, sy: -a.squash * 0.9, rot: lean * 0.3 }) },
    { at: tWind + tLunge + tBounce, dur: tRest, ease: 'Back.easeOut', to: state() },
  ];
  return { steps: steps.map(roundStep), contactAt, total: stepsEnd(steps) };
}

/**
 * Impacto en el objetivo: retroceso proporcional al daño + inclinación y rebote. Empieza en `delay`.
 * @param o { dur: ms disponibles, dmgRatio: daño/vidaMáx, intensity, dirX, dirY: de atacante a objetivo, reduced }
 */
export function impactPlan(p, o = {}) {
  const dur = Math.max(1, Number(o.dur) || 300);
  if (o.reduced) return { steps: [], px: 0, total: 0 };
  const ratio = clamp(Number(o.dmgRatio) || 0, 0, 1);
  const crit = clamp(Number(o.intensity) || 1, 0.5, 2);
  const px = Math.min(p.hurt.max * 1.2, (p.hurt.recoil + (p.hurt.max - p.hurt.recoil) * clamp(ratio / 0.25, 0, 1)) * (1.25 - 0.5 * p.heft) * Math.min(crit, 1.5));
  const d = unit(o.dirX, o.dirY);
  const t1 = Math.max(1, Math.round(dur * 0.3));
  const t2 = Math.max(1, Math.round(dur * 0.3));
  const t3 = Math.max(1, dur - t1 - t2);
  const tilt = p.hurt.tilt * (d.x >= 0 ? 1 : -1) * clamp(crit, 0.6, 1.4);
  const steps = [
    { at: 0, dur: t1, ease: 'Quad.easeOut', to: state({ x: d.x * px, y: d.y * px * 0.8, sx: 0.06, sy: -0.08, rot: tilt }) },
    { at: t1, dur: t2, ease: 'Sine.easeInOut', to: state({ x: d.x * px * -0.18, y: d.y * px * -0.14, sx: -0.02, sy: 0.03, rot: -tilt * 0.3 }) },
    { at: t1 + t2, dur: t3, ease: 'Quad.easeOut', to: state() },
  ];
  return { steps: steps.map(roundStep), px: r2(px), total: stepsEnd(steps) };
}

/** Caída: inclinación + caída + (la escena añade polvo y fundido). Dura `p.fall.ms` como mucho `cap`. */
export function fallPlan(p, o = {}) {
  const ms = Math.min(p.fall.ms, Number(o.cap) || p.fall.ms);
  if (o.reduced) return { steps: [], total: 0 };
  const side = o.side === -1 ? -1 : 1;
  const t1 = Math.round(ms * 0.35);
  const steps = [
    { at: 0, dur: t1, ease: 'Quad.easeOut', to: state({ x: side * 8, y: -4, sx: 0, sy: 0.03, rot: side * p.fall.tilt * 0.4 }) },
    { at: t1, dur: ms - t1, ease: 'Bounce.easeOut', to: state({ x: side * 18, y: p.fall.drop, sx: 0.06, sy: -0.1, rot: side * p.fall.tilt }) },
  ];
  return { steps: steps.map(roundStep), total: stepsEnd(steps) };
}

/** Victoria: salto(s) corto(s) de los vivos. Es decoración posterior al final de la ronda (no la alarga). */
export function victoryPlan(p, o = {}) {
  if (o.reduced || !p.win.hops) return { steps: [], total: 0 };
  const per = Math.round(p.win.ms / p.win.hops);
  const steps = [];
  for (let i = 0; i < p.win.hops; i++) {
    const at = i * per;
    steps.push({ at, dur: Math.round(per * 0.45), ease: 'Quad.easeOut', to: state({ y: -p.win.hop, sx: -0.03, sy: 0.06 }) });
    steps.push({ at: at + Math.round(per * 0.45), dur: Math.round(per * 0.3), ease: 'Quad.easeIn', to: state({ y: 0, sx: 0.05, sy: -0.07 }) });
    steps.push({ at: at + Math.round(per * 0.75), dur: per - Math.round(per * 0.75), ease: 'Sine.easeOut', to: state() });
  }
  return { steps: steps.map(roundStep), total: stepsEnd(steps) };
}

/** Parámetros del reposo vivo de un actor. `phase` (0..1) desfasa a cada actor; sin `reduced` no hay nada. */
export function idleParams(p, o = {}) {
  if (o.reduced) return null;
  const phase = clamp(Number(o.phase) || 0, 0, 1);
  return {
    breath: { period: p.breath.period, amp: p.breath.amp, delay: Math.round(phase * p.breath.period) },
    float: p.float ? { amp: p.float.amp, period: p.float.period, delay: Math.round(phase * p.float.period) } : null,
    // primer cambio de peso desfasado: no se mueven todos juntos
    firstShiftIn: Math.round(p.shift.min * (0.4 + 1.2 * phase)),
  };
}

/** Siguiente espera (ms) hasta un cambio de peso y su desplazamiento. `rng` devuelve [0,1). */
export function nextShift(p, rng = Math.random) {
  const wait = Math.round(p.shift.min + (p.shift.max - p.shift.min) * rng());
  const dx = Math.round((rng() * 2 - 1) * p.shift.dx * 10) / 10;
  return { wait, dx, dur: p.shift.dur };
}

/** Valor del canal `idle` para un instante dado: (solo para pruebas y la vista previa; la escena usa tweens). */
export function breathAt(p, t) {
  const k = (1 - Math.cos((2 * Math.PI * t) / p.breath.period)) / 2;
  return r2(k * p.breath.amp);
}

function roundStep(s) {
  const to = {};
  for (const k of Object.keys(s.to)) to[k] = r2(s.to[k]);
  return { ...s, to };
}

/** Suma los canales de un actor en un único desplazamiento/escala/rotación (lo usa la escena cada frame). */
export function compose(channels, out = {}) {
  let x = 0; let y = 0; let sx = 0; let sy = 0; let rot = 0;
  for (const k of CHANNELS) {
    const c = channels[k];
    if (!c) continue;
    x += c.x; y += c.y; sx += c.sx; sy += c.sy; rot += c.rot;
  }
  out.x = x; out.y = y; out.sx = sx; out.sy = sy; out.rot = rot;
  return out;
}

// ── Utilidades de reproducción (puras; la escena las avanza con su propio reloj, sin tweens de Phaser) ──────────

const EASES = {
  Linear: (t) => t,
  'Sine.easeOut': (t) => Math.sin((t * Math.PI) / 2),
  'Sine.easeInOut': (t) => -(Math.cos(Math.PI * t) - 1) / 2,
  'Quad.easeIn': (t) => t * t,
  'Quad.easeOut': (t) => 1 - (1 - t) * (1 - t),
  'Back.easeOut': (t) => { const c1 = 1.70158; const c3 = c1 + 1; return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2; },
  'Bounce.easeOut': (t) => {
    const n1 = 7.5625; const d1 = 2.75;
    if (t < 1 / d1) return n1 * t * t;
    if (t < 2 / d1) { const u = t - 1.5 / d1; return n1 * u * u + 0.75; }
    if (t < 2.5 / d1) { const u = t - 2.25 / d1; return n1 * u * u + 0.9375; }
    const u = t - 2.625 / d1; return n1 * u * u + 0.984375;
  },
};
export const ease = (name, t) => (EASES[name] || EASES.Linear)(clamp(t, 0, 1));

export function lerpState(a, b, k) {
  return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, sx: a.sx + (b.sx - a.sx) * k, sy: a.sy + (b.sy - a.sy) * k, rot: a.rot + (b.rot - a.rot) * k };
}

/** Estado en el instante `t` (ms) de una lista de pasos que parte de `from`. Entre pasos con hueco, mantiene el valor. */
export function sampleSteps(steps, from, t) {
  let cur = from;
  for (const s of steps || []) {
    if (t < s.at) return cur;
    const k = s.dur > 0 ? (t - s.at) / s.dur : 1;
    if (k < 1) return lerpState(cur, s.to, ease(s.ease, k));
    cur = s.to;
  }
  return cur;
}

/** Hash estable string → [0,1): desfasa a cada actor sin azar. */
export function hash01(str) {
  let h = 2166136261;
  for (const ch of String(str)) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return ((h >>> 0) % 10007) / 10007;
}
/** PRNG determinista (mulberry32) → () => [0,1). */
export function mulberry32(seed) {
  let a = Math.floor(seed * 4294967296) >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

/** Canal `idle` en el instante `t`: respiración (aplasta/estira) + flotación; el desplazamiento de peso lo suma la escena. */
export function idleState(params, t) {
  if (!params) return NEUTRAL;
  const { breath, float } = params;
  const k = (1 - Math.cos((2 * Math.PI * (t + breath.delay)) / breath.period)) / 2;
  const fy = float ? -float.amp * (0.5 + 0.5 * Math.sin((2 * Math.PI * (t + float.delay)) / float.period)) : 0;
  return { x: 0, y: fy, sx: -breath.amp * 0.3 * k, sy: breath.amp * k, rot: 0 };
}
