// Orden de actores y selección de objetivos del motor v2 (todo determinista).

// Enemigo principal: el primer vivo por índice; si ninguno vive, enemies[0].
function principalEnemy(enemies) {
  return enemies.find((e) => e.hp > 0) || enemies[0];
}

// Héroes vivos por amenaza de clase descendente (1 si la clase no tiene peso)
// y, a igualdad, por slot ascendente.
function heroTargetOrder(heroes, threat) {
  const w = (h) => ((threat && threat[h.class]) ?? 1);
  return heroes
    .filter((h) => h.alive)
    .sort((a, b) => (w(b) - w(a)) || (a.slot - b.slot));
}

// Actores vivos de la ronda por spd descendente (spd ausente = 0). Empate:
// héroes antes que enemigos; luego slot (héroes) o índice (enemigos) ascendente.
function actorOrder(heroes, enemies) {
  const actors = [];
  heroes.forEach((h) => { if (h.alive) actors.push({ side: 'h', ref: h, spd: h.spd || 0, ord: h.slot }); });
  enemies.forEach((e, i) => { if (e.hp > 0) actors.push({ side: 'e', ref: e, spd: e.spd || 0, ord: i }); });
  actors.sort((a, b) => (b.spd - a.spd)
    || ((a.side === b.side) ? 0 : (a.side === 'h' ? -1 : 1))
    || (a.ord - b.ord));
  return actors.map(({ side, ref }) => ({ side, ref }));
}

module.exports = { principalEnemy, heroTargetOrder, actorOrder };
