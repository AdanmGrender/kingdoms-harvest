/**
 * Planificador de beats del combate (combate_b R3, R6–R16, R18).
 * PURO: sin Phaser, sin config del servidor, sin azar. Traduce `state.events` (ya resueltos por el
 * servidor) a una línea de tiempo de beats; toda cifra que dibuja sale de `event.value`.
 */
import { KH } from '../../components/ui/kitPieces';

export const ROUND_BUDGET_MS = 2500;
export const MIN_FACTOR = 0.35;
export const SKIP_FACTOR = 0.1;
export const SKIP_MAX_MS = 300;
export const OVERLAP = 0.4;

export const KINDS = ['hit', 'skill', 'death', 'end', 'status', 'dot', 'heal', 'passive'];

export const BASE_MS = { hit: 420, skill: 650, death: 450, status: 300, dot: 300, heal: 300, passive: 300, end: 250, text: 300 };

// Colores: paleta del kit B (kitPieces.KH). `heal` es el verde del kit aclarado (verde apagado).
export const COLORS = {
  hit: KH.bone,
  crit: KH['brass-light'],
  burn: KH.ember,
  poison: KH.macula,
  heal: '#a3b86c',
  text: KH['bone-dim'],
};

export const STATUS_STYLE = {
  stun: { color: KH['brass-light'], label: 'Aturdido' },
  burn: { color: KH.ember, label: 'Quemadura' },
  poison: { color: KH.macula, label: 'Veneno' },
  defDown: { color: KH['bone-dim'], label: 'Defensa baja' },
  atkDown: { color: KH.seal, label: 'Ataque bajo' },
  shield: { color: KH.bone, label: 'Escudo' },
  immune: { color: KH.parchment, label: 'Inmune' },
};

export const PASSIVE_INTENSITY = { crit: 2, execute: 1.4, discharge: 1.4, extraHit: 1, charge: 0.6, dodge: 0.6 };
const HIT_INTENSITY = 1;

const isId = (v) => typeof v === 'string' && v.length > 0;
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);

function warnOnce(ctx, cause) {
  const warned = ctx.warned;
  if (warned.has(cause)) return;
  warned.add(cause);
  ctx.warn(`[combat] ${cause}`);
}

/** Valida un evento. Devuelve true si se puede planificar. */
function validEvent(e, ctx) {
  if (!e || typeof e !== 'object') { warnOnce(ctx, 'evento no objeto'); return false; }
  if (!KINDS.includes(e.kind)) { warnOnce(ctx, `kind desconocido: ${String(e.kind)}`); return false; }
  const known = (id) => !ctx.units || ctx.units.has(id);
  const need = {
    hit: ['actor', 'target'], skill: ['actor'], death: ['target'], status: ['target'],
    dot: ['target'], heal: ['target'], passive: ['actor'], end: [],
  }[e.kind];
  for (const f of need) {
    if (!isId(e[f])) { warnOnce(ctx, `${e.kind} sin ${f}`); return false; }
    if (!known(e[f])) { warnOnce(ctx, `${e.kind}: ${f} inexistente (${e[f]})`); return false; }
  }
  if (e.kind === 'hit' && !known(e.target)) return false;
  if (e.target != null && isId(e.target) && !known(e.target)) { warnOnce(ctx, `${e.kind}: target inexistente (${e.target})`); return false; }
  if (e.kind === 'skill' && e.skillType !== 'shield' && !isId(e.target)) { warnOnce(ctx, 'skill sin target'); return false; }
  return true;
}

function baseBeat(e, kind, extra) {
  return {
    id: `${e.t}:${kind}`, kind, srcT: e.t, at: 0, dur: BASE_MS[kind] ?? BASE_MS.text,
    actorId: isId(e.actor) ? e.actor : null, targetId: isId(e.target) ? e.target : null,
    ...(e.synthetic ? { synthetic: true } : {}),
    ...extra,
  };
}

/**
 * Beats crudos (sin tiempos) de una lista de eventos ya ordenada por `t`.
 */
function toBeats(events, ctx) {
  const beats = [];
  // Esquiva: `passive/dodge` sobre una unidad en la misma ronda hace que el `hit` de valor 0 sobre ella diga «Esquiva».
  const dodgeUnits = new Set();
  for (const e of events) if (e.kind === 'passive' && e.fx === 'dodge') { if (isId(e.actor)) dodgeUnits.add(e.actor); if (isId(e.target)) dodgeUnits.add(e.target); }
  const pendingCrit = new Set(); // `${actor}>${target}` con un crítico anunciado
  let end = null;

  for (const e of events) {
    switch (e.kind) {
      case 'hit': {
        const key = `${e.actor}>${e.target}`;
        const big = pendingCrit.delete(key);
        if (isNum(e.value) && e.value > 0) {
          beats.push(baseBeat(e, 'hit', {
            num: e.value, color: big ? COLORS.crit : COLORS.hit, intensity: big ? PASSIVE_INTENSITY.crit : HIT_INTENSITY,
            ...(isNum(e.hp) ? { hpAfter: e.hp } : {}),
          }));
        } else if (dodgeUnits.has(e.target)) {
          beats.push(baseBeat(e, 'text', { text: 'Esquiva', color: COLORS.text, intensity: 0.6, targetId: e.target }));
        } else {
          beats.push(baseBeat(e, 'hit', {
            color: COLORS.hit, intensity: HIT_INTENSITY * 0.5,
            ...(isNum(e.hp) ? { hpAfter: e.hp } : {}),
          }));
        }
        break;
      }
      case 'skill': {
        const squad = e.skillType === 'shield';
        const key = `${e.actor}>${e.target}`;
        const big = pendingCrit.delete(key);
        beats.push(baseBeat(e, 'skill', {
          skillType: e.skillType || 'damage', ...(squad ? { scope: 'squad', targetId: null, text: 'Escudo' } : {}),
          ...(!squad && isNum(e.value) && e.value > 0 ? { num: e.value } : {}),
          color: big ? COLORS.crit : COLORS.hit, intensity: big ? PASSIVE_INTENSITY.crit : 1.2,
        }));
        break;
      }
      case 'death':
        beats.push(baseBeat(e, 'death', { intensity: 1 }));
        break;
      case 'end':
        end = baseBeat(e, 'end', { result: e.value === 'victory' || e.value === 'defeat' ? e.value : null });
        break;
      case 'status': {
        const type = e.status;
        const st = STATUS_STYLE[type];
        if (!st) { warnOnce(ctx, `status desconocido: ${String(type)}`); break; }
        const op = e.op;
        if (op === 'apply' || op === 'refresh') beats.push(baseBeat(e, 'status', { status: { type, op }, marker: 'add', color: st.color, text: st.label }));
        else if (op === 'expire') beats.push(baseBeat(e, 'status', { status: { type, op }, marker: 'remove', color: st.color }));
        else if (op === 'blocked') beats.push(baseBeat(e, 'status', { status: { type, op }, marker: null, text: 'Inmune', color: STATUS_STYLE.immune.color }));
        else if (op === 'skip') beats.push(baseBeat(e, 'status', { status: { type, op }, marker: null, text: 'Aturdido', color: STATUS_STYLE.stun.color, targetId: e.target }));
        else warnOnce(ctx, `status.op desconocido: ${String(op)}`);
        break;
      }
      case 'dot': {
        const color = COLORS[e.status] || COLORS.burn;
        beats.push(baseBeat(e, 'dot', {
          status: { type: e.status, op: 'tick' }, color, intensity: 0.5, ...(isNum(e.value) && e.value > 0 ? { num: e.value } : {}),
        }));
        break;
      }
      case 'heal':
        beats.push(baseBeat(e, 'heal', {
          color: COLORS.heal, intensity: 0.7, actorId: isId(e.actor) ? e.actor : e.target,
          ...(isNum(e.value) && e.value > 0 ? { num: e.value } : {}),
        }));
        break;
      case 'passive': {
        const fx = typeof e.fx === 'string' ? e.fx : 'charge';
        if (fx === 'crit' && isId(e.target)) pendingCrit.add(`${e.actor}>${e.target}`);
        beats.push(baseBeat(e, 'passive', {
          fx, intensity: PASSIVE_INTENSITY[fx] ?? 0.6, color: fx === 'crit' ? COLORS.crit : COLORS.text,
          ...(fx === 'crit' ? { text: '¡Crítico!' } : {}),
        }));
        break;
      }
      default:
        break;
    }
  }
  if (end) beats.push(end);
  return beats;
}

/** Asigna `at` (encadena los del mismo actor; solapa 40 % los de actores distintos). */
function schedule(beats) {
  let prev = null;
  for (const b of beats) {
    if (b.kind === 'end') continue;
    if (!prev) b.at = 0;
    else {
      const sameActor = (b.actorId || b.targetId) === (prev.actorId || prev.targetId);
      const start = prev.at + prev.dur;
      b.at = sameActor ? start : Math.max(prev.at, start - OVERLAP * Math.min(prev.dur, b.dur));
    }
    prev = b;
  }
  const last = beats.filter((b) => b.kind !== 'end').reduce((m, b) => Math.max(m, b.at + b.dur), 0);
  const end = beats.find((b) => b.kind === 'end');
  if (end) end.at = last;
  return beats;
}

const endOf = (beats) => beats.reduce((m, b) => Math.max(m, b.at + b.dur), 0);

/**
 * Planifica una ronda. `events`: lista ya recortada a la ronda.
 * ctx: { units?: Set<string>, warn?, warned? }.
 * Devuelve { beats, duration, factor, squeezed }.
 */
export function planRound(events, ctx = {}) {
  const c = { warn: console.warn.bind(console), warned: new Set(), ...ctx };
  const list = Array.isArray(events) ? events.filter((e) => validEvent(e, c)) : [];
  list.sort((a, b) => (isNum(a.t) && isNum(b.t) ? a.t - b.t : 0));
  const beats = schedule(toBeats(list, c));
  const total = endOf(beats);
  let factor = 1;
  let squeezed = false;
  if (total > ROUND_BUDGET_MS) {
    factor = Math.max(MIN_FACTOR, ROUND_BUDGET_MS / total);
    for (const b of beats) { b.at *= factor; b.dur *= factor; }
    if (endOf(beats) > ROUND_BUDGET_MS) {
      // Ni con el factor mínimo cabe: se comprimen las posiciones (los beats se solapan más).
      let scale = 1;
      for (const b of beats) if (b.at > 0) scale = Math.min(scale, (ROUND_BUDGET_MS - b.dur) / b.at);
      for (const b of beats) b.at *= scale;
      squeezed = true;
    }
  }
  for (const b of beats) { b.at = Math.round(b.at * 100) / 100; b.dur = Math.round(b.dur * 100) / 100; }
  return { beats, duration: endOf(beats), factor, squeezed };
}

/** Eventos de una ronda: `events.slice(eventRange)`; sin rango, los de `roundLog.round`. */
export function eventsForRound(state, roundLog) {
  const events = state && Array.isArray(state.events) ? state.events : [];
  const r = roundLog && roundLog.eventRange;
  if (Array.isArray(r) && r.length === 2 && isNum(r[0]) && isNum(r[1])) return events.slice(r[0], r[1]);
  if (roundLog && isNum(roundLog.round)) return events.filter((e) => e && e.round === roundLog.round);
  return events;
}

// ── Vista de barras (R15) ───────────────────────────────────────────────────

/** Unidades de un estado: `h<slot>` y `e<i>`. Es una copia solo de lectura de lo que dice el servidor. */
export function unitsFromState(state) {
  const out = {};
  const st = (state && state.fx && state.fx.st) || {};
  const shieldOf = (id) => {
    const arr = Array.isArray(st[id]) ? st[id] : [];
    const s = arr.find((x) => x && x.type === 'shield');
    return s ? (isNum(s.value) ? s.value : 1) : 0;
  };
  for (const h of (state && state.heroes) || []) {
    const id = `h${h.slot}`;
    out[id] = { id, side: 'h', hp: Math.max(0, h.hp ?? 0), maxHp: h.maxHp ?? h.hp ?? 0, alive: h.alive !== false && (h.hp ?? 1) > 0, shield: shieldOf(id) };
  }
  const enemies = state && Array.isArray(state.enemies) && state.enemies.length ? state.enemies : (state && state.enemy ? [{ ...state.enemy, id: 'e0' }] : []);
  enemies.forEach((e, i) => {
    const id = isId(e.id) ? e.id : `e${i}`;
    out[id] = { id, side: 'e', hp: Math.max(0, e.hp ?? 0), maxHp: e.maxHp ?? e.hp ?? 0, alive: (e.hp ?? 0) > 0, shield: shieldOf(id) };
  });
  return out;
}

// ── Cola de reproducción (R14, R16, R18) ─────────────────────────────────────

export function createRoundQueue(opts = {}) {
  const warn = opts.warn || console.warn.bind(console);
  const warned = new Set();
  let lastT = -1;
  let plan = null;       // { beats, duration, clock, next }
  const pending = [];    // planes en espera
  let speed = 1;
  let view = {};

  const mutate = (b) => {
    if (b.kind === 'hit' && isNum(b.hpAfter) && view[b.targetId]) view[b.targetId].hp = b.hpAfter;
    if (b.kind === 'death' && view[b.targetId]) { view[b.targetId].alive = false; view[b.targetId].hp = 0; }
  };

  const q = {
    get lastT() { return lastT; },
    get factor() { return speed === 1 ? 1 : SKIP_FACTOR; },
    get speed() { return speed; },
    get view() { return view; },
    setUnits(state) { view = unitsFromState(state); return view; },
    /** Encola una ronda; descarta `t ≤ lastT` (R14). Devuelve el plan (con `beats` vacío si no hay nada nuevo). */
    enqueueRound(events, ctx = {}) {
      const fresh = (Array.isArray(events) ? events : []).filter((e) => !(e && isNum(e.t) && e.t <= lastT));
      const planned = planRound(fresh, { warn, warned, units: ctx.units, ...ctx });
      for (const e of fresh) if (e && isNum(e.t) && e.t > lastT) lastT = e.t;
      if (planned.beats.length) {
        const p = { ...planned, clock: 0, next: 0 };
        if (plan) pending.push(p); else plan = p;
      }
      return planned;
    },
    isIdle() { return !plan && pending.length === 0; },
    /** Tiempo (ms reales) que falta para vaciar la cola. */
    remaining() {
      let rest = 0;
      if (plan) rest += Math.max(0, plan.duration - plan.clock);
      for (const p of pending) rest += p.duration;
      return rest / speed;
    },
    /** Avanza `dt` ms reales y devuelve los beats que vencen. */
    tick(dt) {
      const due = [];
      let left = Math.max(0, dt) * speed;
      while (plan && left >= 0) {
        const target = plan.clock + left;
        while (plan.next < plan.beats.length && plan.beats[plan.next].at <= target) {
          const b = plan.beats[plan.next++];
          mutate(b);
          due.push(b);
        }
        if (target >= plan.duration) {
          left = target - plan.duration;
          plan = pending.shift() || null;
          if (!plan) { speed = 1; break; }
        } else { plan.clock = target; break; }
      }
      return due;
    },
    /** Un toque: completa la ronda en ≤ 300 ms reales (R18). */
    skip() {
      speed = 1 / SKIP_FACTOR;
      const rest = q.remaining();
      if (rest > SKIP_MAX_MS) speed *= rest / SKIP_MAX_MS;
    },
    /** Fija HP, vivo y escudo desde el estado autoritativo (R15). */
    reconcile(state) {
      view = unitsFromState(state);
      return view;
    },
  };
  return q;
}
