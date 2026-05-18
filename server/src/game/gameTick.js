const cron = require('node-cron');
const db = require('../config/database');
const dailyTaskService = require('../services/dailyTaskService');
const { BUILDINGS, DAY_CYCLE } = require('../../../shared/gameConfig');
const { getBot } = require('../bot/telegramBot');

function sendBotNotification(playerId, message) {
  try {
    const bot = getBot();
    if (bot) bot.sendMessage(playerId, message).catch(() => {});
  } catch {}
}

let ioRef = null;
let lastEventGenTime = 0;
const EVENT_GEN_INTERVAL_MS = 15 * 60 * 1000; // 15 minutos

// Fractional production accumulator — tracks sub-integer resource amounts
// between ticks so buildings producing < 60/hour still generate resources.
// Resets on server restart (acceptable; no data loss beyond partial fractions).
const productionAccumulators = {};

/**
 * Game Tick: se ejecuta cada minuto.
 * Procesa cultivos listos, producción de animales,
 * construcciones completadas, tropas entrenadas, etc.
 */
async function processTick() {
  const now = new Date().toISOString();

  // 1. Cultivos listos para cosechar
  try {
    const justReady = await db('farm_plots')
      .where('state', 'growing')
      .where('ready_at', '<=', now);

    if (justReady.length > 0) {
      await db('farm_plots')
        .where('state', 'growing')
        .where('ready_at', '<=', now)
        .update({ state: 'ready' });

      // Notify each player how many crops are ready
      const perPlayer = {};
      for (const plot of justReady) {
        perPlayer[plot.player_id] = (perPlayer[plot.player_id] || 0) + 1;
      }
      for (const [playerId, count] of Object.entries(perPlayer)) {
        if (ioRef) ioRef.to(`player_${playerId}`).emit('crop_ready', { count });
        sendBotNotification(playerId, `🌾 ¡${count} cultivo${count > 1 ? 's' : ''} listo${count > 1 ? 's' : ''} para cosechar! Volvé al juego.`);
      }
      console.log(`[Tick] ${justReady.length} cultivos listos para cosechar`);
    }
  } catch (error) {
    console.error('[Tick] Error procesando cultivos:', error.message);
  }

  // 2. Construcciones completadas
  try {
    const completedBuildings = await db('player_buildings')
      .where('is_building', true)
      .where('build_complete_at', '<=', now);

    for (const building of completedBuildings) {
      try {
        await db('player_buildings')
          .where('id', building.id)
          .update({ is_building: false, build_complete_at: null });

        if (building.building_id === 'farm_plot') {
          await db('farm_plots').insert({
            player_id: building.player_id,
            building_id: building.id,
            state: 'empty',
          });
        }

        if (building.building_id === 'house') {
          const villagerService = require('../services/villagerService');
          await villagerService.checkAndSpawnInitial(building.player_id);
        }

        if (building.building_id === 'barn') {
          const { BUILDINGS: B } = require('../../../shared/gameConfig');
          const barnConfig = B['barn'];
          if (barnConfig?.storagePerLevel) {
            await db('player_resources')
              .where('player_id', building.player_id)
              .increment('capacity', barnConfig.storagePerLevel);
          }
        }

        if (ioRef) {
          ioRef.to(`player_${building.player_id}`).emit('building_complete', {
            buildingId: building.id,
            buildingType: building.building_id,
          });
        }
        sendBotNotification(building.player_id, `🏗️ ¡Tu ${building.building_id} ha terminado de construirse! Volvé al juego para continuar.`);
      } catch (err) {
        console.error(`[Tick] Error completando edificio ${building.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[Tick] Error procesando construcciones:', error.message);
  }

  // 2b. Building resource production (per hour, processed per minute)
  try {
    const allBuildings = await db('player_buildings')
      .where('is_building', false);

    // Group by player
    const playerBuildings = {};
    for (const b of allBuildings) {
      if (!playerBuildings[b.player_id]) playerBuildings[b.player_id] = [];
      playerBuildings[b.player_id].push(b);
    }

    for (const [playerId, buildings] of Object.entries(playerBuildings)) {
      const totalProduction = {};

      for (const b of buildings) {
        const config = BUILDINGS[b.building_id];
        if (!config?.produces) continue;

        // Production rate is per hour, tick runs every minute
        // Scale by building level
        const levelMultiplier = 1 + (b.level - 1) * 0.25;
        for (const [resource, ratePerHour] of Object.entries(config.produces)) {
          const perMinute = (ratePerHour * levelMultiplier) / 60;
          totalProduction[resource] = (totalProduction[resource] || 0) + perMinute;
        }
      }

      // Accumulate fractional production and award integer portions
      for (const [resource, amount] of Object.entries(totalProduction)) {
        const key = `${playerId}:${resource}`;
        productionAccumulators[key] = (productionAccumulators[key] || 0) + amount;
        const intAmount = Math.floor(productionAccumulators[key]);
        if (intAmount > 0) {
          productionAccumulators[key] -= intAmount;
          try {
            const result = await db.raw(
              'UPDATE "player_resources" SET "amount" = LEAST("amount" + ?, "capacity") WHERE "player_id" = ? AND "resource_id" = ?',
              [intAmount, playerId, resource]
            );
            if (result.rowCount === 0) {
              await db('player_resources').insert({
                player_id: playerId,
                resource_id: resource,
                amount: intAmount,
                capacity: 1000,
              });
            }
          } catch (e) {
            // Race condition on insert, ignore
          }
        }
      }

      // Notify player of resource update
      if (ioRef && Object.keys(totalProduction).length > 0) {
        ioRef.to(`player_${playerId}`).emit('resources_updated', totalProduction);
      }
    }
  } catch (error) {
    console.error('[Tick] Error procesando producción de edificios:', error.message);
  }

  // 3. Producción de animales
  try {
    const readyAnimals = await db('player_animals')
      .where('is_fed', true)
      .whereNotNull('next_production_at')
      .where('next_production_at', '<=', now);

    for (const animal of readyAnimals) {
      if (ioRef) {
        ioRef.to(`player_${animal.player_id}`).emit('animal_ready', {
          animalId: animal.id,
          animalType: animal.animal_id,
        });
      }
    }
  } catch (error) {
    console.error('[Tick] Error procesando animales:', error.message);
  }

  // 4. Tropas entrenadas
  try {
    const trainedTroops = await db('player_troops')
      .where('training_quantity', '>', 0)
      .where('training_complete_at', '<=', now);

    for (const troop of trainedTroops) {
      try {
        await db('player_troops')
          .where('id', troop.id)
          .update({
            quantity: troop.quantity + troop.training_quantity,
            training_quantity: 0,
            training_complete_at: null,
          });

        if (ioRef) {
          ioRef.to(`player_${troop.player_id}`).emit('troops_trained', {
            troopId: troop.troop_id,
            quantity: troop.training_quantity,
          });
        }
        sendBotNotification(troop.player_id, `⚔️ ¡${troop.training_quantity}x ${troop.troop_id} están listos para la batalla!`);
      } catch (err) {
        console.error(`[Tick] Error completando tropa ${troop.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[Tick] Error procesando tropas:', error.message);
  }

  // 4b. Process arrived sieges
  try {
    const siegeService = require('../services/siegeService');
    await siegeService.processArrivedSieges(ioRef);
  } catch (error) {
    console.error('[Tick] Error procesando asedios:', error.message);
  }

  // 4c. Villager simulation (throttled: at most once per 5 minutes per player)
  try {
    const villagerService = require('../services/villagerService');
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();

    // Two queries instead of N+1: get players with villagers, then filter by throttle column
    const villagerPlayerRows = await db('villagers').select('player_id').groupBy('player_id');
    if (villagerPlayerRows.length > 0) {
      const playerIds = villagerPlayerRows.map((r) => r.player_id);
      const playerTicks = await db('players')
        .whereIn('telegram_id', playerIds)
        .select('telegram_id', 'villager_last_tick');

      const toSimulate = playerTicks.filter(
        (p) => !p.villager_last_tick || p.villager_last_tick < fiveMinAgo
      );

      for (const p of toSimulate) {
        await villagerService.simulateTick(p.telegram_id);
        await db('players')
          .where('telegram_id', p.telegram_id)
          .update({ villager_last_tick: new Date().toISOString() });
      }
    }
  } catch (error) {
    console.error('[Tick] Error simulando aldeanos:', error.message);
  }

  // 4d. Advance world time — single atomic batch SQL (no per-player await gaps)
  try {
    const timeIncrement = 60000 / DAY_CYCLE.dayDurationMs;
    const allPlayers = await db('players').select('telegram_id', 'world_time', 'world_day');

    if (allPlayers.length > 0) {
      // Identify players crossing a day boundary BEFORE the update (for side effects)
      const rolled = allPlayers.filter((p) => (p.world_time || 0) + timeIncrement >= 1.0);

      // One SQL statement updates every player atomically — no event-loop yield between rows
      await db.raw(
        `UPDATE "players" SET
           "world_time" = ("world_time" + ?) - FLOOR(("world_time" + ?))::INTEGER,
           "world_day"  = "world_day" + FLOOR(("world_time" + ?))::INTEGER`,
        [timeIncrement, timeIncrement, timeIncrement]
      );

      // Async side effects (processAging) run AFTER world_day is already committed
      if (rolled.length > 0) {
        const villagerService = require('../services/villagerService');
        for (const p of rolled) {
          try {
            await villagerService.processAging(p.telegram_id);
            await villagerService.processRelationships(p.telegram_id);
          } catch (ageErr) {
            console.error(`[Tick] Error aging/families for player ${p.telegram_id}:`, ageErr.message);
          }
        }
      }
    }
  } catch (error) {
    console.error('[Tick] Error avanzando tiempo del mundo:', error.message);
  }

  // 5. Misiones expiradas
  try {
    await db('missions')
      .where('status', 'available')
      .where('expires_at', '<=', now)
      .update({ status: 'expired' });
  } catch (error) {
    console.error('[Tick] Error expirando misiones:', error.message);
  }

  // 6. Reset diario de tokens
  try {
    const expiredTokens = await db('player_tokens')
      .where('daily_reset_at', '<=', now)
      .where('daily_earned_today', '>', 0);

    for (const pt of expiredTokens) {
      const resetAt = new Date();
      resetAt.setUTCHours(24, 0, 0, 0);
      await db('player_tokens').where('player_id', pt.player_id).update({
        daily_earned_today: 0,
        daily_reset_at: resetAt.toISOString(),
      });
    }
  } catch (error) {
    console.error('[Tick] Error reseteando tokens diarios:', error.message);
  }

  // 7. Limpiar tareas diarias expiradas
  try {
    await dailyTaskService.resetExpiredDailyTasks();
  } catch (error) {
    console.error('[Tick] Error limpiando tareas diarias:', error.message);
  }

  // 8. Reset streak bonus diario
  try {
    const today = new Date().toISOString().slice(0, 10);
    await db('player_streaks')
      .where('streak_bonus_claimed_today', 1)
      .where('last_login_date', '<', today)
      .update({ streak_bonus_claimed_today: 0 });
  } catch (error) {
    console.error('[Tick] Error reseteando streak bonus:', error.message);
  }
}

/**
 * Procesa retiros de TON pendientes (cada 5 minutos)
 */
async function processWithdrawals() {
  try {
    const tokenService = require('../services/tokenService');
    await tokenService.processPendingWithdrawals();
  } catch (error) {
    console.error('[Withdrawal] Error procesando retiros:', error.message);
  }
}

async function processWorldEvents() {
  const now = Date.now();
  if (now - lastEventGenTime < EVENT_GEN_INTERVAL_MS) return;
  lastEventGenTime = now;
  try {
    const worldEventService = require('../services/worldEventService');
    await worldEventService.cleanExpiredEvents();
    const created = await worldEventService.generateEvents();
    if (created > 0 && ioRef) {
      ioRef.emit('world_events_updated', { count: created });
    }
  } catch (error) {
    console.error('[Tick] Error procesando eventos del mundo:', error.message);
  }
}

function startGameTick(io) {
  ioRef = io;
  // Ejecutar cada minuto
  cron.schedule('* * * * *', processTick);
  console.log('[Tick] Game tick programado cada 60 segundos');

  // Procesar retiros cada 5 minutos
  cron.schedule('*/5 * * * *', processWithdrawals);
  console.log('[Tick] Procesamiento de retiros cada 5 minutos');

  // Generar eventos del mundo cada 15 minutos
  cron.schedule('*/15 * * * *', processWorldEvents);
  console.log('[Tick] Eventos del mundo programados cada 15 minutos');
}

module.exports = { startGameTick, processTick };
