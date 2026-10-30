// Estados con duración y pasivas de héroe del motor v2 (F14). PURO: sin DB, sin I/O y
// sin azar del sistema (todo el azar sale de createRng(state)). Todo estado nuevo vive en
// `state.fx`, que se crea de forma perezosa (sin pasivas ni estados el motor es el de F13).
// Los números de balance viven en shared/gameConfig.js (HERO_PASSIVE_FX, COMBAT_FX).
const { COMBAT_FX, HERO_PASSIVE_FX } = require('../../../../shared/gameConfig');
const { createRng } = require('./rng');

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

// ---------------------------------------------------------------------------
// Intérprete de pasivas (dirigido por datos). Nada acá nombra un heroId: todo sale de
// HERO_PASSIVE_FX. `begin` crea el contexto de UNA ronda de simulateRoundV2 (engine.js).
// Orden de RNG por acción (design §6): héroe que ataca → crit, estado con chance, extraHit;
// enemigo que ataca → dodge. No se consume RNG si la condición de la pasiva no se cumple.
// ---------------------------------------------------------------------------
const passivesOf = (h) => (h && h.heroId != null && Object.prototype.hasOwnProperty.call(HERO_PASSIVE_FX, h.heroId)
  ? HERO_PASSIVE_FX[h.heroId] : []);
const condList = (c) => (c === undefined ? [] : Array.isArray(c) ? c : [c]);
const hpMax = (o) => o.maxHp ?? o.hp;

function begin(s, round, emit) {
  const rng = createRng(s);
  const ev = (actor, target, kind, value, extra) => { if (emit) emit(actor, target, kind, value, extra); };
  const livingHeroes = () => s.heroes.filter((h) => h.alive);
  const livingEnemies = () => s.enemies.filter((e) => e.hp > 0);
  const bySlot = () => [...s.heroes].sort((a, b) => a.slot - b.slot);
  const flag = (bag, id) => !!(s.fx && s.fx[bag] && s.fx[bag][id]);
  const hUnit = (h) => ({ side: 'h', id: heroUid(h), ref: h });

  // ctx: { holder (héroe portador), target, attacker, skill, adjacent }
  function check(q, c) {
    const id = c.holder ? heroUid(c.holder) : null;
    switch (q.k) {
      case 'numAdvantage': return livingHeroes().length > livingEnemies().length;
      case 'selfHpBelow': return c.holder.hp < q.v * hpMax(c.holder);
      case 'isSkill': return !!c.skill;
      case 'targetRanged': return !!c.target && c.target.range === COMBAT_FX.rangedValue;
      case 'attackerMelee': return !!c.attacker && c.attacker.range !== COMBAT_FX.rangedValue;
      case 'allyAdjacent': return !!c.adjacent;
      case 'roundEq': return round === q.v;
      case 'roundMultiple': return q.v > 0 && round % q.v === 0;
      case 'firstAttack': return !flag('used', id);
      case 'charged': return flag('charge', id);
      case 'targetWounded': return !!c.target && c.target.hp < hpMax(c.target);
      case 'targetHpBelow': return !!c.target && c.target.hp < q.v * hpMax(c.target);
      default: return false;
    }
  }
  const holds = (e, c) => condList(e.cond).every((q) => check(q, c));
  const chanceOk = (e) => (e.chance == null || e.chance >= 1 || rng.float() < e.chance);

  function roundStart() {
    const killedByDot = dotTick(s, emit);
    // regeneración (por slot)
    for (const h of bySlot()) {
      if (!h.alive) continue;
      for (const e of passivesOf(h)) {
        if (e.trigger !== 'roundStart' || e.effect !== 'heal' || (e.scope || 'self') !== 'self') continue;
        if (!holds(e, { holder: h })) continue;
        heal(s, hUnit(h), Math.max(1, Math.round(e.value * hpMax(h))), h.heroId, emit);
      }
    }
    // estados grupales (escudo de serafina)
    for (const h of bySlot()) {
      if (!h.alive) continue;
      for (const e of passivesOf(h)) {
        if (e.trigger !== 'roundStart' || e.effect !== 'applyStatus' || !holds(e, { holder: h })) continue;
        const targets = e.scope === 'allies' ? bySlot().filter((x) => x.alive) : [h];
        for (const t of targets) {
          applyStatus(s, heroUid(t), { type: e.type, value: e.value, dur: e.dur, mode: e.mode, src: heroUid(h) }, emit);
        }
      }
    }
    // cargas (kryx): máximo 1, no se acumula
    for (const h of bySlot()) {
      if (!h.alive) continue;
      for (const e of passivesOf(h)) {
        if (e.trigger !== 'roundStart' || e.effect !== 'charge' || !holds(e, { holder: h })) continue;
        const id = heroUid(h);
        if (flag('charge', id)) continue;
        const f = ensureFx(s);
        if (!f.charge) f.charge = {};
        f.charge[id] = true;
        ev(id, id, 'passive', 1, { passiveId: h.heroId, fx: 'charge' });
      }
    }
    return killedByDot && (!livingEnemies().length || !livingHeroes().length);
  }

  // Modificadores del golpe de un héroe sobre `target` (enemigo). `mul` = factor total sobre
  // `atk × (sk.mult)`; `defOf(def)` = DEF efectiva. Sin pasivas ni estados: mul = 1, defOf = identidad.
  function attackMods(hero, target, { skill = false } = {}) {
    const uid = heroUid(hero);
    const c = { holder: hero, target, skill };
    let atkSum = 0; let dmgMul = 1; let critMul = 1; let ignore = 0;
    let execute = false; let discharge = null;
    for (const e of passivesOf(hero)) {
      if (e.trigger === 'stat' && (e.scope || 'self') === 'self'
        && (e.effect === 'atkMod' || e.effect === 'atkModPerRound') && holds(e, c)) {
        atkSum += e.effect === 'atkMod' ? e.value : Math.min(e.cap, e.value * round);
      } else if (e.trigger === 'attack' && holds(e, c)) {
        if (e.effect === 'ignoreDef') ignore += e.value;
        else if (e.effect === 'dmgMult') {
          dmgMul *= e.value;
          if (condList(e.cond).some((q) => q.k === 'charged')) discharge = e.value;
        } else if (e.effect === 'crit') {
          if (chanceOk(e)) {
            critMul *= COMBAT_FX.critMult;
            ev(uid, target.id, 'passive', COMBAT_FX.critMult, { passiveId: hero.heroId, fx: 'crit' });
          }
        } else if (e.effect === 'execute') {
          execute = !s.isBoss; // los enemigos de un nodo jefe no se ejecutan (Q4)
        }
      }
    }
    const down = statusSum(s, uid, 'atkDown');
    const atkFactor = (atkSum === 0 && down === 0) ? 1 : Math.max(0, 1 + atkSum - down);
    const defDown = statusSum(s, target.id, 'defDown');
    return {
      mul: atkFactor * dmgMul * critMul,
      execute, discharge, skill,
      defOf: (def) => ((defDown === 0 && ignore === 0)
        ? def : Math.max(0, (def || 0) * Math.max(0, 1 - defDown) * (1 - ignore))),
    };
  }

  // Tras restar el daño al objetivo y antes de emitir el `hit`/`skill`.
  function afterAttack(hero, target, m) {
    const uid = heroUid(hero);
    if (m.execute && target.hp > 0) {
      target.hp = 0;
      ev(uid, target.id, 'passive', 0, { passiveId: hero.heroId, fx: 'execute' });
    }
    if (m.discharge != null) {
      const f = ensureFx(s);
      if (f.charge) delete f.charge[uid];
      ev(uid, target.id, 'passive', m.discharge, { passiveId: hero.heroId, fx: 'discharge' });
    }
    let usesFirst = false;
    for (const e of passivesOf(hero)) {
      if (condList(e.cond).some((q) => q.k === 'firstAttack')) usesFirst = true;
      if (e.trigger !== 'attack' || e.effect !== 'applyStatus' || !holds(e, { holder: hero, target, skill: m.skill })) continue;
      const u = findUnit(s, target.id);
      if (!u || !isAlive(u)) continue;
      const spec = { type: e.type, value: e.value, dur: e.dur, mode: e.mode, src: uid };
      if (COMBAT_FX.controlTypes.includes(e.type) && isControlImmune(s, u)) {
        applyStatus(s, target.id, spec, emit); // `blocked`, sin RNG
        continue;
      }
      if (!chanceOk(e)) continue;
      applyStatus(s, target.id, spec, emit);
    }
    if (usesFirst) {
      const f = ensureFx(s);
      if (!f.used) f.used = {};
      f.used[uid] = true;
    }
  }

  // ¿Golpea una segunda vez? (vex). Solo se llama en el golpe original.
  function extraHit(hero, target) {
    for (const e of passivesOf(hero)) {
      if (e.trigger !== 'attack' || e.effect !== 'extraHit' || !holds(e, { holder: hero, target })) continue;
      if (chanceOk(e)) {
        ev(heroUid(hero), target.id, 'passive', 1, { passiveId: hero.heroId, fx: 'extraHit' });
        return true;
      }
    }
    return false;
  }

  // Golpe enemigo `a` contra el héroe `defender` (order[0]). `raw` ya trae `s.shield`.
  // Devuelve { dodged, raw, def, absorb(dmgMitigado) }; sin pasivas ni estados es identidad.
  function incoming(a, defender, raw) {
    const uid = heroUid(defender);
    const identity = (d) => d;
    for (const e of passivesOf(defender)) {
      if (e.trigger !== 'defend' || e.effect !== 'dodge' || !defender.alive) continue;
      if (!holds(e, { holder: defender, attacker: a })) continue;
      if (chanceOk(e)) {
        ev(uid, a.id, 'passive', 0, { passiveId: defender.heroId, fx: 'dodge' });
        return { dodged: true, raw: 0, def: defender.def, absorb: identity };
      }
    }
    const aDown = statusSum(s, a.id, 'atkDown');
    let defSum = 0;
    for (const h of s.heroes) {
      if (!h.alive) continue;
      for (const e of passivesOf(h)) {
        if (e.trigger !== 'stat' || e.effect !== 'defMod') continue;
        const scope = e.scope || 'self';
        if (scope === 'self' && h === defender && holds(e, { holder: h })) defSum += e.value;
        else if (scope === 'adjacent' && h !== defender && Math.abs(h.slot - defender.slot) === 1
          && holds(e, { holder: h, adjacent: true })) defSum += e.value;
      }
    }
    const defDown = statusSum(s, uid, 'defDown');
    return {
      dodged: false,
      raw: aDown === 0 ? raw : raw * Math.max(0, 1 - aDown),
      def: (defSum === 0 && defDown === 0)
        ? defender.def : Math.max(0, (defender.def || 0) * Math.max(0, 1 + defSum - defDown)),
      absorb: (d) => absorb(s, uid, d, emit),
    };
  }

  // Tras un golpe enemigo que NO fue esquivado: pasivas `defend` que reaccionan (morghal).
  function afterHit(a, defender) {
    if (!defender.alive) return;
    for (const e of passivesOf(defender)) {
      if (e.trigger !== 'defend' || e.effect !== 'applyStatus' || e.scope !== 'attacker') continue;
      if (!holds(e, { holder: defender, attacker: a }) || !chanceOk(e)) continue;
      applyStatus(s, a.id, { type: e.type, value: e.value, dur: e.dur, mode: e.mode, src: heroUid(defender) }, emit);
    }
  }

  return {
    roundStart, attackMods, afterAttack, extraHit, incoming, afterHit,
    skipsAction: (unitId) => skipsAction(s, unitId, emit),
    roundEnd: () => roundEnd(s, emit),
  };
}

module.exports = {
  begin, heroUid, findUnit, isAlive, ensureFx, stOf,
  applyStatus, hasStatus, statusSum, isControlImmune,
  skipsAction, dotTick, absorb, roundEnd, heal,
};
