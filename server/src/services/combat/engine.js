// Motor de combate v2: una ronda, PURA (sin DB, sin azar del sistema).
// v1 (campaignSim.js) queda intacto; campaignService elige motor por state.engine.
// Contrato de salida: { state, result }. Contrato de eventos: specs/combate_motor_v2/design.md §5.
const { COMBAT } = require('../../../../shared/gameConfig');
const { ENERGY_MAX, ENERGY_PER_ROUND } = require('../campaignSim');
const { mitigate } = require('./damage');
const { principalEnemy, heroTargetOrder, actorOrder } = require('./targeting');

const heroId = (h) => `h${h.slot}`;

function simulateRoundV2(state, action) {
  const s = JSON.parse(JSON.stringify(state)); // clon: no muta el input
  const K = COMBAT.defK;

  // 1) Normalizar: enemies[] manda; si solo hay `enemy`, es enemies = [enemy].
  if (!Array.isArray(s.enemies)) s.enemies = [s.enemy];
  s.enemies.forEach((e, i) => { if (!e.id) e.id = `e${i}`; });
  if (!Array.isArray(s.events)) s.events = [];
  s.eventsVersion = 1;
  if (s.seed === undefined) s.seed = 0;
  if (s.rng === undefined) s.rng = s.seed;

  const round = s.round + 1;
  const from = s.events.length;
  const emit = (actor, target, kind, value, extra) => {
    s.events.push({ t: s.events.length, round, actor, target, kind, value, ...extra });
  };
  const hitAlive = (e) => e.hp > 0;

  // 2) Habilidad (antes del orden de actores), sobre el enemigo principal.
  if (action && action.type === 'skill') {
    const hero = s.heroes.find((h) => h.slot === action.slot && h.alive);
    if (!hero) throw new Error('Héroe inválido para la habilidad');
    if (hero.energy < ENERGY_MAX) throw new Error('Energía insuficiente');
    const sk = hero.skill;
    const target = principalEnemy(s.enemies);
    let value = 0;
    if (sk.type === 'damage') {
      value = mitigate(hero.atk * sk.mult, target.def, K);
      target.hp -= value;
    } else if (sk.type === 'execute') {
      value = mitigate(hero.atk * (s.isBoss ? 4 : 2), target.def, K);
      target.hp -= value;
    } else if (sk.type === 'shield') {
      s.shield = sk.mult; // reduce los golpes enemigos de ESTA ronda
      value = sk.mult;
    }
    hero.energy = 0;
    emit(heroId(hero), sk.type === 'shield' ? null : target.id, 'skill', value,
      { skillId: sk.id, skillType: sk.type });
    if (sk.type !== 'shield' && target.hp <= 0) emit(heroId(hero), target.id, 'death', 0);
  }

  // 3) Actores por spd. Como v1, si la habilidad ya mató a todos no hay fase de actores.
  if (s.enemies.some(hitAlive)) {
    for (const actor of actorOrder(s.heroes, s.enemies)) {
      const a = actor.ref;
      if (actor.side === 'h') {
        if (!a.alive) continue;
        if (s.enemies.some(hitAlive)) {
          const target = principalEnemy(s.enemies);
          const dmg = mitigate(a.atk, target.def, K);
          target.hp -= dmg;
          emit(heroId(a), target.id, 'hit', dmg, { hp: Math.max(0, target.hp) });
          if (target.hp <= 0) emit(heroId(a), target.id, 'death', 0);
        }
        a.energy = Math.min(ENERGY_MAX, a.energy + ENERGY_PER_ROUND);
      } else {
        if (a.hp <= 0) continue;
        const order = heroTargetOrder(s.heroes, COMBAT.threat);
        if (order.length === 0) continue;
        let dmg = mitigate(a.dps * (1 - (s.shield || 0)), order[0].def, K);
        for (let i = 0; i < order.length; i++) {
          const h = order[i];
          if (i > 0 && dmg <= 0) break; // el primer objetivo siempre recibe el golpe (aunque sea 0)
          const applied = Math.min(dmg, h.hp);
          h.hp -= applied;
          dmg -= applied; // el sobrante ya viene mitigado: derrama al siguiente
          emit(a.id, heroId(h), 'hit', applied, { hp: Math.max(0, h.hp) });
          if (h.hp <= 0) {
            h.alive = false;
            emit(a.id, heroId(h), 'death', 0);
          }
        }
      }
    }
  }
  s.shield = 0;

  // 4) Resultado: victoria > derrota por muerte > timeout.
  let result = null;
  if (!s.enemies.some(hitAlive)) result = 'victory';
  else if (!s.heroes.some((h) => h.alive)) result = 'defeat';
  s.round = round;
  if (result === null && s.round >= s.maxRounds) result = 'defeat';
  if (result) emit(null, null, 'end', result);

  // 5) Alias: `enemy` = copia del principal (lo lee el cliente actual).
  const main = principalEnemy(s.enemies);
  s.enemy = { ...main };

  // 6) Una entrada de log por ronda: claves de v1 + enemies[] + eventRange.
  s.log.push({
    round: s.round,
    enemyHp: Math.max(0, main.hp),
    heroes: s.heroes.map((h) => ({ slot: h.slot, hp: Math.max(0, h.hp), energy: h.energy, alive: h.alive })),
    result,
    enemies: s.enemies.map((e) => ({ id: e.id, hp: Math.max(0, e.hp) })),
    eventRange: [from, s.events.length],
  });

  return { state: s, result };
}

module.exports = { simulateRoundV2 };
