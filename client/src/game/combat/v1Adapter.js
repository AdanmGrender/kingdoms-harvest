/**
 * Adaptador de motor v1 (combate_b R20–R23, design §7). PURO.
 * El motor v1 no emite `state.events`: se derivan eventos sintéticos de los deltas de HP entre dos
 * estados consecutivos. Solo `hit`, `skill`, `death` y `end`: nunca status/dot/heal/passive (R23).
 * Los números son diferencias de HP ya resueltas por el servidor, no un cálculo de daño.
 */

const SKILL_TYPES = ['damage', 'execute', 'shield'];
const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

const heroUid = (h) => `h${h.slot}`;
const aliveOf = (h) => h && h.alive !== false && (num(h.hp) ?? 1) > 0;

function enemiesOf(st) {
  if (!st) return [];
  if (Array.isArray(st.enemies) && st.enemies.length) return st.enemies.map((e, i) => ({ id: typeof e.id === 'string' ? e.id : `e${i}`, hp: e.hp }));
  if (st.enemy) return [{ id: 'e0', hp: st.enemy.hp }];
  return [];
}

/**
 * @param prevState estado anterior (null en la primera ronda)
 * @param state     estado actual
 * @param roundLog  entrada de log de la ronda (respaldo si `state` no trae héroes/enemigo)
 * @param opts      { action?: {type:'skill',slot}, result?: 'victory'|'defeat'|null, tStart?: number }
 * @returns eventos con la forma del contrato, todos `synthetic: true`, `t` crecientes
 */
export function deriveEvents(prevState, state, roundLog, opts = {}) {
  const round = num(roundLog && roundLog.round) ?? num(state && state.round) ?? 1;
  let t = num(opts.tStart) ?? round * 1000;
  const out = [];
  const push = (actor, target, kind, value, extra) => {
    out.push({ t: t++, round, actor, target, kind, value, synthetic: true, ...extra });
  };
  const result = opts.result ?? (roundLog && roundLog.result) ?? (state && state.result) ?? null;

  const heroesNow = (state && Array.isArray(state.heroes) && state.heroes.length ? state.heroes : (roundLog && roundLog.heroes)) || [];
  const heroesPrev = (prevState && Array.isArray(prevState.heroes)) ? prevState.heroes : [];
  const prevBySlot = new Map(heroesPrev.map((h) => [h.slot, h]));

  if (prevState) {
    // 1) Habilidad pedida por el jugador: el primer evento es un `skill` sintético del slot.
    const act = opts.action;
    if (act && act.type === 'skill') {
      const caster = heroesNow.find((h) => h.slot === act.slot) || prevBySlot.get(act.slot);
      if (caster) {
        const raw = caster.skill && caster.skill.type;
        const skillType = SKILL_TYPES.includes(raw) ? raw : 'damage';
        const firstEnemy = enemiesOf(prevState)[0];
        push(heroUid(caster), skillType === 'shield' ? null : (firstEnemy ? firstEnemy.id : 'e0'), 'skill', 0, { skillType });
      }
    }

    // 2) Golpes al enemigo. Actor aproximado: primer héroe vivo de menor slot.
    const striker = [...heroesNow].filter(aliveOf).sort((a, b) => a.slot - b.slot)[0]
      || [...heroesPrev].filter(aliveOf).sort((a, b) => a.slot - b.slot)[0];
    const enNow = new Map(enemiesOf(state).map((e) => [e.id, e]));
    const enemyDeaths = [];
    for (const pe of enemiesOf(prevState)) {
      const cur = enNow.get(pe.id) || (roundLog && roundLog.enemyHp !== undefined && pe.id === 'e0' ? { hp: roundLog.enemyHp } : null);
      if (!cur) continue;
      const delta = (num(pe.hp) ?? 0) - (num(cur.hp) ?? 0);
      if (delta > 0 && striker) push(heroUid(striker), pe.id, 'hit', delta, { hp: Math.max(0, cur.hp) });
      if ((num(pe.hp) ?? 0) > 0 && (num(cur.hp) ?? 1) <= 0) enemyDeaths.push(pe.id);
    }

    // 3) Golpes a los héroes (actor e0).
    const heroDeaths = [];
    for (const h of heroesNow) {
      const p = prevBySlot.get(h.slot);
      if (!p) continue;
      const delta = (num(p.hp) ?? 0) - (num(h.hp) ?? 0);
      if (delta > 0) push('e0', heroUid(h), 'hit', delta, { hp: Math.max(0, h.hp) });
      if (aliveOf(p) && !aliveOf(h)) heroDeaths.push(heroUid(h));
    }

    // 4) Muertes y fin.
    for (const id of heroDeaths) push('e0', id, 'death', 0);
    for (const id of enemyDeaths) push(striker ? heroUid(striker) : null, id, 'death', 0);
  }
  if (result === 'victory' || result === 'defeat') push(null, null, 'end', result);
  return out;
}
