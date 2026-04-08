const cron = require('node-cron');
const db = require('../config/database');
const dailyTaskService = require('../services/dailyTaskService');

let ioRef = null;

/**
 * Game Tick: se ejecuta cada minuto.
 * Procesa cultivos listos, producción de animales,
 * construcciones completadas, tropas entrenadas, etc.
 */
async function processTick() {
  const now = new Date().toISOString();

  // 1. Cultivos listos para cosechar
  try {
    const readyCrops = await db('farm_plots')
      .where('state', 'growing')
      .where('ready_at', '<=', now)
      .update({ state: 'ready' });

    if (readyCrops > 0) {
      console.log(`[Tick] ${readyCrops} cultivos listos para cosechar`);
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

        if (ioRef) {
          ioRef.to(`player_${building.player_id}`).emit('building_complete', {
            buildingId: building.id,
            buildingType: building.building_id,
          });
        }
      } catch (err) {
        console.error(`[Tick] Error completando edificio ${building.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[Tick] Error procesando construcciones:', error.message);
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
      } catch (err) {
        console.error(`[Tick] Error completando tropa ${troop.id}:`, err.message);
      }
    }
  } catch (error) {
    console.error('[Tick] Error procesando tropas:', error.message);
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

function startGameTick(io) {
  ioRef = io;
  // Ejecutar cada minuto
  cron.schedule('* * * * *', processTick);
  console.log('[Tick] Game tick programado cada 60 segundos');

  // Procesar retiros cada 5 minutos
  cron.schedule('*/5 * * * *', processWithdrawals);
  console.log('[Tick] Procesamiento de retiros cada 5 minutos');
}

module.exports = { startGameTick, processTick };
