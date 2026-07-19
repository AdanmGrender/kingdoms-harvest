// Simulación de combate por rondas, PURA (sin DB) para testeo determinista.
// El servidor es la autoridad: el cliente sólo manda intención (action).
const ENERGY_MAX = 100;
const ENERGY_PER_ROUND = 34; // ~3 rondas para cargar una ultimate

/**
 * Aplica la habilidad de un héroe al estado de combate.
 *
 * ⚠️ CONTRATO: muta `s` EN SITIO (no clona). Es seguro llamarla SOLO porque
 * `simulateRound` ya clonó el estado (`JSON.parse(JSON.stringify(state))`)
 * antes de invocarla. NUNCA llamar a `applySkill` sobre un estado "vivo"
 * (el que vive en DB/memoria del server) sin clonarlo primero — mutaría el
 * estado real y rompería el contrato de `simulateRound` (input inmutable).
 */
function applySkill(s, slot) {
  const hero = s.heroes.find((h) => h.slot === slot && h.alive);
  if (!hero) throw new Error('Héroe inválido para la habilidad');
  if (hero.energy < ENERGY_MAX) throw new Error('Energía insuficiente');
  const sk = hero.skill;
  if (sk.type === 'damage') {
    s.enemy.hp -= Math.round(hero.atk * sk.mult);
  } else if (sk.type === 'execute') {
    s.enemy.hp -= Math.round(hero.atk * (s.isBoss ? 4 : 2));
  } else if (sk.type === 'shield') {
    s.shield = sk.mult; // reduce el golpe enemigo de ESTA ronda
  }
  hero.energy = 0;
}

// Resuelve UNA ronda. Devuelve { state, result }.
function simulateRound(state, action) {
  const s = JSON.parse(JSON.stringify(state)); // clon: no muta el input

  if (action && action.type === 'skill') {
    applySkill(s, action.slot);
  }

  if (s.enemy.hp > 0) {
    // 1) héroes pegan + cargan energía (se salta si la skill ya mató al enemigo)
    for (const h of s.heroes) {
      if (!h.alive) continue;
      s.enemy.hp -= h.atk;
      h.energy = Math.min(ENERGY_MAX, h.energy + ENERGY_PER_ROUND);
    }
  }

  let result = null;
  if (s.enemy.hp <= 0) {
    result = 'victory';
  } else {
    // 2) enemigo pega (aplicando escudo si hubo)
    let dmg = Math.round(s.enemy.dps * (1 - (s.shield || 0)));
    s.shield = 0;
    for (const h of s.heroes) {
      if (dmg <= 0) break;
      if (!h.alive) continue;
      const applied = Math.min(dmg, h.hp);
      h.hp -= applied;
      dmg -= applied;
      if (h.hp <= 0) h.alive = false;
    }

    if (!s.heroes.some((h) => h.alive)) {
      result = 'defeat';
    }
  }

  s.round += 1;
  if (result === null && s.round >= s.maxRounds) result = 'defeat';

  // Cada ronda produce EXACTAMENTE UNA entrada de log, con el mismo shape
  // tanto si continúa como si termina (victoria/derrota incluyen snapshot).
  s.log.push({
    round: s.round,
    enemyHp: Math.max(0, s.enemy.hp),
    heroes: s.heroes.map((h) => ({ slot: h.slot, hp: Math.max(0, h.hp), energy: h.energy, alive: h.alive })),
    result,
  });

  return { state: s, result };
}

module.exports = { simulateRound, applySkill, ENERGY_MAX, ENERGY_PER_ROUND };
