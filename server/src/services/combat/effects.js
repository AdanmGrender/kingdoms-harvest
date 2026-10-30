// Estados con duración y pasivas de héroe del motor v2 (F14). PURO: sin DB, sin I/O y
// sin azar del sistema (todo el azar sale de createRng(state)). Todo estado nuevo vive en
// `state.fx`, que se crea de forma perezosa (sin pasivas ni estados el motor es el de F13).
// Los números de balance viven en shared/gameConfig.js (HERO_PASSIVE_FX, COMBAT_FX).
const { COMBAT_FX } = require('../../../../shared/gameConfig');

// ---------------------------------------------------------------------------
// Unidades. Héroes: id `h<slot>`, vivos si `alive`. Enemigos: `e.id`, vivos si hp > 0.
// ---------------------------------------------------------------------------
const heroUid = (h) => `h${h.slot}`;

function findUnit(s, id) {
  for (const h of s.heroes || []) if (heroUid(h) === id) return { side: 'h', id, ref: h };
  for (const e of s.enemies || []) if (e.id === id) return { side: 'e', id, ref: e };
  return null;
}
const isAlive = (u) => (u.side === 'h' ? !!u.ref.alive : u.ref.hp > 0);
const maxHpOf = (u) => (u.ref.maxHp ?? u.ref.hp);

// ---------------------------------------------------------------------------
// Almacén de estados: state.fx.st[unitId] = [{ type, value, dur, src, (mode) }]
// ---------------------------------------------------------------------------
function ensureFx(s) {
  if (!s.fx) s.fx = {};
  return s.fx;
}
const stOf = (s, id) => (s.fx && s.fx.st && s.fx.st[id]) || [];

function hasStatus(s, id, type) {
  return stOf(s, id).some((x) => x.type === type);
}
// Suma de `value` de todas las instancias activas de un tipo (R31).
function statusSum(s, id, type) {
  return stOf(s, id).reduce((acc, x) => (x.type === type ? acc + x.value : acc), 0);
}

// Inmune a control: estado `immune`, o enemigo de un nodo jefe (R33, Q4).
function isControlImmune(s, unit) {
  return hasStatus(s, unit.id, 'immune') || (unit.side === 'e' && !!s.isBoss);
}

// Aplica un estado { type, value, dur, src, mode? } a una unidad. Devuelve la entrada o null
// (tipo desconocido, unidad muerta/inexistente, o bloqueado por inmunidad). Mismo tipo y misma
// fuente => refresca (dur mayor, value mayor), nunca acumula (R28).
function applyStatus(s, unitId, spec, emit) {
  if (!COMBAT_FX.statusTypes.includes(spec.type)) return null;
  const u = findUnit(s, unitId);
  if (!u || !isAlive(u)) return null;
  const src = spec.src ?? null;
  if (COMBAT_FX.controlTypes.includes(spec.type) && isControlImmune(s, u)) {
    if (emit) emit(src, unitId, 'status', spec.value, { status: spec.type, op: 'blocked', dur: spec.dur });
    return null;
  }
  const fx = ensureFx(s);
  if (!fx.st) fx.st = {};
  if (!fx.st[unitId]) fx.st[unitId] = [];
  const list = fx.st[unitId];
  const cur = list.find((x) => x.type === spec.type && x.src === src);
  if (cur) {
    cur.dur = (cur.dur == null || spec.dur == null) ? null : Math.max(cur.dur, spec.dur);
    cur.value = Math.max(cur.value, spec.value);
    if (emit) emit(src, unitId, 'status', cur.value, { status: cur.type, op: 'refresh', dur: cur.dur });
    return cur;
  }
  const entry = { type: spec.type, value: spec.value, dur: spec.dur ?? null, src };
  if (spec.type === 'shield') entry.mode = spec.mode || 'pct';
  list.push(entry);
  if (emit) emit(src, unitId, 'status', entry.value, { status: entry.type, op: 'apply', dur: entry.dur });
  return entry;
}

// `stun`: la unidad pierde su acción (R29). Resta 1 a `dur` y se retira al llegar a 0.
function skipsAction(s, unitId, emit) {
  const list = stOf(s, unitId);
  const stun = list.find((x) => x.type === 'stun');
  if (!stun) return false;
  stun.dur -= 1;
  if (emit) emit(stun.src, unitId, 'status', stun.value, { status: 'stun', op: 'skip', dur: stun.dur });
  if (stun.dur <= 0) {
    list.splice(list.indexOf(stun), 1);
    if (list.length === 0) delete s.fx.st[unitId];
  }
  return true;
}

// Daño por tick de burn/poison al inicio de ronda (R30): héroes h1..hN, luego enemigos.
// Devuelve true si algún DoT mató a alguien.
function dotTick(s, emit) {
  if (!s.fx || !s.fx.st) return false;
  let killed = false;
  const units = [
    ...[...s.heroes].sort((a, b) => a.slot - b.slot).map((h) => ({ side: 'h', id: heroUid(h), ref: h })),
    ...s.enemies.map((e) => ({ side: 'e', id: e.id, ref: e })),
  ];
  for (const u of units) {
    for (const st of stOf(s, u.id).filter((x) => x.type === 'burn' || x.type === 'poison')) {
      if (!isAlive(u)) break;
      const raw = Math.max(COMBAT_FX.dotMinDamage, Math.round(st.value * maxHpOf(u)));
      const applied = Math.min(raw, u.ref.hp);
      u.ref.hp -= applied;
      if (emit) emit(st.src, u.id, 'dot', applied, { status: st.type });
      if (u.ref.hp <= 0) {
        if (u.side === 'h') u.ref.alive = false;
        killed = true;
        if (emit) emit(st.src, u.id, 'death', 0);
      }
    }
  }
  return killed;
}

// Escudos (R32): `pct` => round(dmg × (1 − value)); `pool` => descuenta del pool.
function absorb(s, unitId, dmg, emit) {
  const list = stOf(s, unitId);
  let out = dmg;
  for (const st of list.filter((x) => x.type === 'shield')) {
    if (st.mode === 'pool') {
      const taken = Math.min(st.value, out);
      st.value -= taken;
      out -= taken;
      if (st.value <= 0) {
        list.splice(list.indexOf(st), 1);
        if (emit) emit(st.src, unitId, 'status', 0, { status: 'shield', op: 'expire', dur: 0 });
      }
    } else {
      out = Math.round(out * (1 - st.value));
    }
  }
  if (s.fx && s.fx.st && list.length === 0) delete s.fx.st[unitId];
  return out;
}

// Fin de ronda (R27, R34): resta 1 a `dur` (menos stun e immune permanente), retira los que
// llegan a 0 con `status`/`expire`, y borra las entradas de unidades muertas o desconocidas.
// Un `type` desconocido (dato corrupto) se retira sin lanzar.
function roundEnd(s, emit) {
  if (!s.fx || !s.fx.st) return;
  for (const id of Object.keys(s.fx.st)) {
    const u = findUnit(s, id);
    if (!u || !isAlive(u)) { delete s.fx.st[id]; continue; }
    const keep = [];
    for (const st of s.fx.st[id]) {
      if (!COMBAT_FX.statusTypes.includes(st.type)) continue;
      if (st.type === 'stun' || st.dur == null) { keep.push(st); continue; }
      st.dur -= 1;
      if (st.dur <= 0) {
        if (emit) emit(st.src, id, 'status', st.value, { status: st.type, op: 'expire', dur: 0 });
      } else {
        keep.push(st);
      }
    }
    if (keep.length) s.fx.st[id] = keep; else delete s.fx.st[id];
  }
}

// Cura `amount` (ya en HP) sin pasar de maxHp. Devuelve el HP curado realmente.
function heal(s, unit, amount, passiveId, emit) {
  if (!isAlive(unit)) return 0;
  const healed = Math.max(0, Math.min(amount, maxHpOf(unit) - unit.ref.hp));
  if (healed <= 0) return 0;
  unit.ref.hp += healed;
  if (emit) emit(unit.id, unit.id, 'heal', healed, { passiveId });
  return healed;
}

module.exports = {
  heroUid, findUnit, isAlive, ensureFx, stOf,
  applyStatus, hasStatus, statusSum, isControlImmune,
  skipsAction, dotTick, absorb, roundEnd, heal,
};
