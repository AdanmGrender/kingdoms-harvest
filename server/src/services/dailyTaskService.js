const db = require('../config/database');
const { TOKEN_CONFIG } = require('../../../shared/tokenConfig');
const tokenService = require('./tokenService');

const dailyTaskService = {
  /**
   * Obtener o crear tareas diarias del jugador
   */
  async getOrCreateDailyTasks(playerId) {
    const now = new Date();
    const existing = await db('player_daily_tasks')
      .where('player_id', playerId)
      .where('reset_at', '>', now.toISOString());

    if (existing.length > 0) return existing;

    // Limpiar tareas viejas
    await db('player_daily_tasks')
      .where('player_id', playerId)
      .where('reset_at', '<=', now.toISOString())
      .delete();

    // Crear tareas de hoy
    const resetAt = new Date(now);
    resetAt.setUTCHours(24, 0, 0, 0); // midnight UTC

    const tasks = [];
    for (const task of TOKEN_CONFIG.DAILY_TASKS) {
      const [id] = await db('player_daily_tasks').insert({
        player_id: playerId,
        task_id: task.id,
        progress: 0,
        target: task.target,
        completed: 0,
        reward_claimed: 0,
        reset_at: resetAt.toISOString(),
      });
      tasks.push({
        id,
        player_id: playerId,
        task_id: task.id,
        progress: 0,
        target: task.target,
        completed: 0,
        reward_claimed: 0,
        reset_at: resetAt.toISOString(),
        // Merge config info for client
        desc: task.desc,
        icon: task.icon,
        reward: task.reward,
      });
    }

    return tasks;
  },

  /**
   * Obtener tareas diarias con info de config mergeada
   */
  async getDailyTasksWithInfo(playerId) {
    const tasks = await this.getOrCreateDailyTasks(playerId);
    const configMap = {};
    TOKEN_CONFIG.DAILY_TASKS.forEach((t) => { configMap[t.id] = t; });

    return tasks.map((t) => ({
      ...t,
      desc: configMap[t.task_id]?.desc || t.task_id,
      icon: configMap[t.task_id]?.icon || '📋',
      reward: configMap[t.task_id]?.reward || 0,
    }));
  },

  /**
   * Trackear progreso de una accion (llamado desde los servicios existentes)
   */
  async trackProgress(playerId, action, count = 1) {
    const now = new Date().toISOString();

    // Find matching uncompleted tasks for this action
    const tasks = await db('player_daily_tasks')
      .where('player_id', playerId)
      .where('reset_at', '>', now)
      .where('completed', 0);

    // Map action to task_ids
    const matchingTaskIds = TOKEN_CONFIG.DAILY_TASKS
      .filter((t) => t.action === action)
      .map((t) => t.id);

    for (const task of tasks) {
      if (!matchingTaskIds.includes(task.task_id)) continue;

      const newProgress = Math.min(task.progress + count, task.target);
      const isComplete = newProgress >= task.target ? 1 : 0;

      await db('player_daily_tasks').where('id', task.id).update({
        progress: newProgress,
        completed: isComplete,
      });
    }
  },

  /**
   * Reclamar recompensa de tarea diaria completada
   */
  async claimTaskReward(playerId, taskId) {
    const now = new Date().toISOString();
    const task = await db('player_daily_tasks')
      .where({ player_id: playerId, task_id: taskId })
      .where('reset_at', '>', now)
      .first();

    if (!task) throw new Error('Tarea no encontrada');
    if (!task.completed) throw new Error('Tarea aun no completada');
    if (task.reward_claimed) throw new Error('Recompensa ya reclamada');

    const config = TOKEN_CONFIG.DAILY_TASKS.find((t) => t.id === taskId);
    if (!config) throw new Error('Tarea invalida');

    // Award tokens
    const result = await tokenService.awardTokens(playerId, config.reward, 'daily_task');

    await db('player_daily_tasks').where('id', task.id).update({ reward_claimed: 1 });

    return {
      success: true,
      tokensAwarded: result.awarded,
      balance: result.balance,
      message: `Reclamaste ${result.awarded} KH Tokens por "${config.desc}"!`,
    };
  },

  // ==========================================
  // STREAKS
  // ==========================================

  /**
   * Actualizar streak de login (llamado en initPlayer/login)
   */
  async updateLoginStreak(playerId) {
    let streak = await db('player_streaks').where('player_id', playerId).first();
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    if (!streak) {
      await db('player_streaks').insert({
        player_id: playerId,
        current_streak: 1,
        last_login_date: today,
        longest_streak: 1,
        streak_bonus_claimed_today: 0,
      });
      return { currentStreak: 1, isNew: true };
    }

    if (streak.last_login_date === today) {
      // Ya logueado hoy
      return { currentStreak: streak.current_streak, isNew: false };
    }

    // Check if yesterday
    const lastDate = new Date(streak.last_login_date + 'T00:00:00Z');
    const todayDate = new Date(today + 'T00:00:00Z');
    const diffDays = Math.floor((todayDate - lastDate) / (1000 * 60 * 60 * 24));

    let newStreak;
    if (diffDays === 1) {
      newStreak = streak.current_streak + 1;
    } else {
      newStreak = 1; // Streak broken
    }

    const longestStreak = Math.max(streak.longest_streak, newStreak);

    await db('player_streaks').where('player_id', playerId).update({
      current_streak: newStreak,
      last_login_date: today,
      longest_streak: longestStreak,
      streak_bonus_claimed_today: 0,
    });

    return { currentStreak: newStreak, isNew: true, longestStreak };
  },

  /**
   * Obtener info de streak
   */
  async getStreakInfo(playerId) {
    const streak = await db('player_streaks').where('player_id', playerId).first();
    if (!streak) {
      return { currentStreak: 0, longestStreak: 0, multiplier: 1.0, nextMilestone: 3 };
    }

    const { getStreakMultiplier } = require('../../../shared/tokenConfig');
    const multiplier = getStreakMultiplier(streak.current_streak);

    // Find next milestone
    const milestones = Object.keys(TOKEN_CONFIG.STREAK_MULTIPLIERS).map(Number).sort((a, b) => a - b);
    const nextMilestone = milestones.find((m) => m > streak.current_streak) || null;

    return {
      currentStreak: streak.current_streak,
      longestStreak: streak.longest_streak,
      multiplier,
      nextMilestone,
      lastLoginDate: streak.last_login_date,
    };
  },

  // ==========================================
  // SOCIAL TASKS
  // ==========================================

  /**
   * Obtener tareas sociales con estado de completitud
   */
  async getSocialTasks(playerId) {
    const completions = await db('social_task_completions')
      .where('player_id', playerId);

    const completedSet = new Set(completions.filter((c) => c.completed).map((c) => c.task_id));

    return TOKEN_CONFIG.SOCIAL_TASKS.map((task) => ({
      ...task,
      completed: completedSet.has(task.id),
    }));
  },

  /**
   * Verificar y completar tarea social
   */
  async completeSocialTask(playerId, taskId) {
    const task = TOKEN_CONFIG.SOCIAL_TASKS.find((t) => t.id === taskId);
    if (!task) throw new Error('Tarea social no encontrada');

    // Check not already completed
    const existing = await db('social_task_completions')
      .where({ player_id: playerId, task_id: taskId, completed: 1 })
      .first();
    if (existing) throw new Error('Tarea ya completada');

    // Verify based on task type
    if (task.id === 'join_channel') {
      // Verify via Telegram Bot API
      const { getBot } = require('../bot/telegramBot');
      const bot = getBot();
      if (bot && task.channel) {
        try {
          const member = await bot.getChatMember(task.channel, playerId);
          if (!member || ['left', 'kicked'].includes(member.status)) {
            throw new Error('No estas en el canal. Unite primero!');
          }
        } catch (err) {
          if (err.message.includes('No estas')) throw err;
          // If bot can't check (not admin of channel), allow it
        }
      }
    } else if (task.requiredInvites) {
      // Check referral count
      const referralCount = await db('referrals')
        .where('inviter_id', playerId)
        .count('* as count');
      const count = referralCount[0]?.count || 0;
      if (count < task.requiredInvites) {
        throw new Error(`Necesitas ${task.requiredInvites} invitados. Tenes ${count}.`);
      }
    }

    // Mark completed and award tokens
    await db('social_task_completions').insert({
      player_id: playerId,
      task_id: taskId,
      completed: 1,
      completed_at: new Date().toISOString(),
    });

    const result = await tokenService.awardTokens(playerId, task.reward, 'social_task');

    return {
      success: true,
      tokensAwarded: result.awarded,
      balance: result.balance,
      message: `Completaste "${task.desc}"! +${result.awarded} KH Tokens`,
    };
  },

  /**
   * Limpiar tareas diarias expiradas (llamado desde gameTick)
   */
  async resetExpiredDailyTasks() {
    const now = new Date().toISOString();
    const deleted = await db('player_daily_tasks')
      .where('reset_at', '<=', now)
      .delete();
    return deleted;
  },
};

module.exports = dailyTaskService;
