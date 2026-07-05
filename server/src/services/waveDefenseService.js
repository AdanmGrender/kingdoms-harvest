/**
 * waveDefenseService — Marea Disforme (F3 idle): defensa por oleadas,
 * 100% automática. El jugador PREPARA; un request resuelve el run entero
 * por rondas y devuelve el log para replay en el cliente.
 *
 * Sim por oleada:
 *  - Defensa: pool HP (muros) + DPS (torres + guarnición + héroe desplegado)
 *    + burst inicial de trampas.
 *  - Oleada N: presupuesto basePower × powerGrowth^(N−1); se gasta comprando
 *    horrores por peso. Cada 5ª oleada: JEFE (hp/atk fijos + secuaces).
 *  - Ronda: horrores pegan al pool; defensa pega a los horrores (orden:
 *    más débiles primero — las torres barren chusma). Héroe: energía
 *    +25/ronda; al llegar a 100 dispara su golpe (daño = atk×3 del héroe).
 *  - Derrota si el pool HP llega a 0; pequeñas bajas de guarnición.
 *
 * ENTRADA:  startRun(playerId, { free = false })
 * SALIDA:   { victory, startWave, endWave, highestWave, log[], rewards }
 */
const db = require('../config/database');
const {
  WAVE_CONFIG, WAVE_ENEMIES, BUILDINGS, TROOPS, HEROES, HERO_RARITIES, HERO_ITEMS,
} = require('../../../shared/gameConfig');

const BOSS_ROTATION = ['boss_devorador', 'boss_heraldo'];

function pickEnemyWeighted(rand) {
  const pool = Object.values(WAVE_ENEMIES).filter((e) => !e.boss);
  const total = pool.reduce((s, e) => s + e.weight, 0);
  let roll = rand() * total;
  for (const e of pool) {
    roll -= e.weight;
    if (roll <= 0) return e;
  }
  return pool[0];
}

/** Compone la oleada N gastando su presupuesto de poder. */
function buildWave(waveNumber, rand = Math.random) {
  const isBoss = waveNumber % WAVE_CONFIG.bossEvery === 0;
  let budget = WAVE_CONFIG.basePower * Math.pow(WAVE_CONFIG.powerGrowth, waveNumber - 1);
  const enemies = [];

  if (isBoss) {
    const bossId = BOSS_ROTATION[(waveNumber / WAVE_CONFIG.bossEvery - 1) % BOSS_ROTATION.length];
    const boss = WAVE_ENEMIES[bossId];
    // El jefe escala con la oleada; los secuaces gastan el presupuesto restante
    const scale = 1 + waveNumber * 0.04;
    enemies.push({
      ...boss,
      hp: Math.floor(boss.hp * scale * WAVE_CONFIG.bossMultiplier / 2.2),
      atk: Math.floor(boss.atk * scale),
      maxHp: Math.floor(boss.hp * scale * WAVE_CONFIG.bossMultiplier / 2.2),
    });
    budget *= 0.5;
  }

  while (budget > 0) {
    const e = pickEnemyWeighted(rand);
    if (e.power > budget && enemies.length > 0) break;
    enemies.push({ ...e, maxHp: e.hp });
    budget -= e.power;
  }
  return enemies;
}

/** Defensa estática del jugador a partir de sus edificios/tropas/héroe. */
async function computeDefense(playerId) {
  const buildings = await db('player_buildings')
    .where({ player_id: playerId, is_building: false });

  let hpPool = 200; // el bastión mismo aguanta algo sin muros
  let towerDps = 0;
  let trapBurst = 0;
  for (const b of buildings) {
    if (b.building_id === 'wall') hpPool += b.level * BUILDINGS.wall.hpPerLevel;
    if (b.building_id === 'tower') towerDps += b.level * BUILDINGS.tower.atkPerLevel;
    if (b.building_id === 'trap') trapBurst += b.level * BUILDINGS.trap.trapDamage;
  }

  const troops = await db('player_troops').where('player_id', playerId);
  let garrisonDps = 0;
  for (const t of troops) {
    const cfg = TROOPS[t.troop_id];
    if (cfg && t.quantity > 0) garrisonDps += cfg.atk * t.quantity * 0.35;
  }

  // Héroe desplegado (F4 traerá escuadras; por ahora el single deploy)
  let hero = null;
  const player = await db('players').where('telegram_id', playerId).first();
  if (player?.deployed_hero_id) {
    const row = await db('player_heroes').where('id', player.deployed_hero_id).first();
    const cfg = row ? HEROES[row.hero_id] : null;
    if (row && cfg) {
      const mult = (HERO_RARITIES[cfg.rarity]?.statMultiplier || 1) * (1 + (row.level - 1) * 0.05);
      hero = {
        name: cfg.name,
        icon: '🦸',
        dps: Math.floor(cfg.baseStats.atk * mult),
        skillDamage: Math.floor(cfg.baseStats.atk * mult * 3),
        energy: 0,
      };
    }
  }

  return { hpPool, towerDps, trapBurst, garrisonDps, hero, troops };
}

/** Simula UNA oleada contra la defensa. Muta defense.hpPool y devuelve log. */
function simulateWave(waveNumber, enemies, defense, log) {
  const isBoss = enemies.some((e) => e.boss);
  log.push({
    type: 'wave_start',
    wave: waveNumber,
    boss: isBoss,
    enemies: enemies.length,
    text: `${isBoss ? '💀 OLEADA JEFE' : '🌊 Oleada'} ${waveNumber}: ${enemies.length} horrores emergen de la Marea`,
  });

  // Trampas: burst inicial contra los primeros horrores
  let burst = defense.trapBurst;
  for (const e of enemies) {
    if (burst <= 0) break;
    const dmg = Math.min(burst, e.hp);
    e.hp -= dmg;
    burst -= dmg;
  }
  if (defense.trapBurst > 0) {
    log.push({ type: 'traps', text: `💣 Campo de minas: ${defense.trapBurst} de daño inicial` });
  }

  for (let round = 1; round <= WAVE_CONFIG.roundCap; round++) {
    const alive = enemies.filter((e) => e.hp > 0);
    if (alive.length === 0) {
      log.push({ type: 'wave_clear', wave: waveNumber, text: `✅ Oleada ${waveNumber} aniquilada en ${round - 1} ronda(s)` });
      return true;
    }

    // Horrores golpean el pool
    const waveAtk = alive.reduce((s, e) => s + e.atk, 0);
    defense.hpPool -= waveAtk;

    // Defensa golpea (chusma primero — las torres barren lo débil)
    let dps = defense.towerDps + defense.garrisonDps;
    if (defense.hero) {
      dps += defense.hero.dps;
      defense.hero.energy += WAVE_CONFIG.heroEnergyPerRound;
      if (defense.hero.energy >= 100) {
        defense.hero.energy = 0;
        dps += defense.hero.skillDamage;
        log.push({ type: 'hero_skill', text: `⚡ ${defense.hero.name} descarga su golpe (+${defense.hero.skillDamage})` });
      }
    }
    alive.sort((a, b) => a.hp - b.hp);
    for (const e of alive) {
      if (dps <= 0) break;
      const dmg = Math.min(dps, e.hp);
      e.hp -= dmg;
      dps -= dmg;
    }

    const remaining = enemies.filter((e) => e.hp > 0).length;
    log.push({
      type: 'round',
      wave: waveNumber,
      round,
      waveAtk,
      poolHp: Math.max(0, Math.floor(defense.hpPool)),
      remaining,
      text: `R${round}: la Marea golpea (−${waveAtk} HP) · quedan ${remaining} horrores · muros ${Math.max(0, Math.floor(defense.hpPool))}`,
    });

    if (defense.hpPool <= 0) {
      log.push({ type: 'defeat', wave: waveNumber, text: `☠️ Los muros caen en la oleada ${waveNumber}` });
      return false;
    }
  }

  // Empate por roundCap: la Marea se retira, cuenta como victoria pírrica
  log.push({ type: 'wave_clear', wave: waveNumber, text: `🌫️ La Marea se disipa (oleada ${waveNumber})` });
  return true;
}

const waveDefenseService = {
  async getStatus(playerId) {
    let progress = await db('wave_progress').where('player_id', playerId).first();
    if (!progress) {
      await db('wave_progress').insert({ player_id: playerId, highest_wave: 0, total_runs: 0 });
      progress = await db('wave_progress').where('player_id', playerId).first();
    }
    const nextWave = progress.highest_wave + 1;
    return {
      highestWave: progress.highest_wave,
      totalRuns: progress.total_runs,
      freeRunAvailable: !!progress.free_run_available,
      nextWave,
      nextIsBoss: nextWave % WAVE_CONFIG.bossEvery === 0,
      bossEvery: WAVE_CONFIG.bossEvery,
    };
  },

  /** Tormenta marea_carmesi (F2): habilita un run gratis bonificado a todos. */
  async grantFreeRuns() {
    await db.raw('UPDATE "wave_progress" SET "free_run_available" = 1');
  },

  async startRun(playerId, { rand = Math.random } = {}) {
    const status = await this.getStatus(playerId);
    const defense = await computeDefense(playerId);

    if (defense.towerDps + defense.garrisonDps + (defense.hero?.dps || 0) <= 0) {
      throw new Error('Sin defensas: entrená tropas o construí torretas antes de desafiar la Marea');
    }

    const startWave = status.nextWave;
    const log = [];
    let wave = startWave;
    let victory = true;
    let powerDefeated = 0;
    let bossesDown = 0;
    let wavesCleared = 0;

    for (let i = 0; i < WAVE_CONFIG.wavesPerRun; i++, wave++) {
      const enemies = buildWave(wave, rand);
      const survived = simulateWave(wave, enemies, defense, log);
      if (!survived) { victory = false; break; }
      wavesCleared++;
      powerDefeated += enemies.reduce((s, e) => s + (e.boss ? 80 : e.power), 0);
      if (enemies.some((e) => e.boss)) bossesDown++;
    }
    const endWave = wave - (victory ? 1 : 0);

    // ── Recompensas ──
    const rewards = { gold: 0, kh: 0, heroXp: 0, item: null };
    if (wavesCleared > 0) {
      rewards.gold = Math.floor(powerDefeated * WAVE_CONFIG.rewards.goldPerPower);
      const playerService = require('./playerService');
      await playerService.modifyResource(playerId, 'gold', rewards.gold);

      const khAmount = wavesCleared * WAVE_CONFIG.rewards.khBase
        + bossesDown * WAVE_CONFIG.rewards.khBossBonus;
      try {
        const tokenService = require('./tokenService');
        const res = await tokenService.awardTokens(playerId, khAmount, 'wave_defense');
        rewards.kh = res.awarded;
      } catch { /* economía no bloquea el run */ }

      // XP del héroe desplegado
      if (defense.hero) {
        rewards.heroXp = wavesCleared * WAVE_CONFIG.rewards.heroXpPerWave;
        const player = await db('players').where('telegram_id', playerId).first();
        if (player?.deployed_hero_id) {
          await db('player_heroes')
            .where('id', player.deployed_hero_id)
            .increment('xp', rewards.heroXp);
        }
      }

      // Drop de ítem al tumbar jefe
      if (bossesDown > 0 && rand() < WAVE_CONFIG.rewards.itemDropChance * bossesDown * 3) {
        const items = Object.keys(HERO_ITEMS);
        const itemId = items[Math.floor(rand() * items.length)];
        rewards.item = itemId;
        const existing = await db('player_items')
          .where({ player_id: playerId, item_id: itemId }).first();
        if (existing) {
          await db('player_items').where('id', existing.id).increment('quantity', 1);
        } else {
          await db('player_items').insert({ player_id: playerId, item_id: itemId, quantity: 1 });
        }
      }

      try {
        const dailyTaskService = require('./dailyTaskService');
        await dailyTaskService.trackProgress(playerId, 'battle_win', 1);
      } catch { /* no bloquea */ }
    }

    // Derrota: pequeñas bajas de guarnición
    if (!victory) {
      for (const t of defense.troops) {
        const losses = Math.floor(t.quantity * WAVE_CONFIG.garrisonLossOnDefeat);
        if (losses > 0) {
          await db('player_troops').where('id', t.id).decrement('quantity', losses);
          log.push({ type: 'losses', text: `⚰️ ${losses}x ${TROOPS[t.troop_id]?.name || t.troop_id} caídos` });
        }
      }
    }

    // ── Persistir progreso + run ──
    const newHighest = Math.max(status.highestWave, victory ? endWave : wave - 1);
    await db('wave_progress').where('player_id', playerId).update({
      highest_wave: newHighest,
      total_runs: status.totalRuns + 1,
      free_run_available: 0,
      last_run_at: new Date().toISOString(),
    });
    await db('wave_runs').insert({
      player_id: playerId,
      start_wave: startWave,
      end_wave: Math.max(startWave, endWave),
      victory: victory ? 1 : 0,
      log: JSON.stringify(log),
      rewards: JSON.stringify(rewards),
      created_at: new Date().toISOString(),
    });

    return {
      victory,
      startWave,
      endWave: Math.max(startWave, endWave),
      highestWave: newHighest,
      wavesCleared,
      bossesDown,
      log,
      rewards,
    };
  },

  async getHistory(playerId, limit = 10) {
    const runs = await db('wave_runs')
      .where('player_id', playerId)
      .orderBy('id', 'desc')
      .limit(limit);
    return runs.map((r) => ({
      id: r.id,
      startWave: r.start_wave,
      endWave: r.end_wave,
      victory: !!r.victory,
      rewards: JSON.parse(r.rewards || '{}'),
      createdAt: r.created_at,
    }));
  },
};

module.exports = waveDefenseService;
