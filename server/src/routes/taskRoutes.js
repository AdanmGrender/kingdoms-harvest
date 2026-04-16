const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const dailyTaskService = require('../services/dailyTaskService');
const captchaService = require('../services/captchaService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Obtener tareas diarias con progreso
router.get('/daily', telegramAuth, async (req, res) => {
  try {
    const tasks = await dailyTaskService.getDailyTasksWithInfo(req.playerId);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tareas diarias' });
  }
});

// Reclamar recompensa de tarea diaria
router.post('/daily/claim', telegramAuth, validate({
  taskId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z0-9_]+$/ },
}), async (req, res) => {
  try {
    const result = await dailyTaskService.claimTaskReward(req.playerId, req.body.taskId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Obtener tareas sociales
router.get('/social', telegramAuth, async (req, res) => {
  try {
    const tasks = await dailyTaskService.getSocialTasks(req.playerId);
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tareas sociales' });
  }
});

// Verificar y completar tarea social
router.post('/social/verify', telegramAuth, validate({
  taskId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z0-9_]+$/ },
}), async (req, res) => {
  try {
    const result = await dailyTaskService.completeSocialTask(req.playerId, req.body.taskId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Obtener info de streak
router.get('/streak', telegramAuth, async (req, res) => {
  try {
    const streak = await dailyTaskService.getStreakInfo(req.playerId);
    res.json(streak);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener streak' });
  }
});

// Generar desafio CAPTCHA del dia
router.get('/captcha/challenge', telegramAuth, async (req, res) => {
  try {
    const challenge = captchaService.generateChallenge(req.playerId);
    res.json(challenge);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Resolver desafio CAPTCHA y reclamar recompensa
router.post('/captcha/solve', telegramAuth, validate({
  answer: { type: 'string', required: true, maxLength: 30, pattern: /^[a-zA-Z0-9 +\-*]+$/ },
}), async (req, res) => {
  try {
    const result = captchaService.solveChallenge(req.playerId, req.body.answer);

    if (result.correct) {
      // Track progress for the daily captcha task
      await dailyTaskService.trackProgress(req.playerId, 'captcha', 1);
    }

    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
