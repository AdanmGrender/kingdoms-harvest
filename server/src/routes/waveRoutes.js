/**
 * /api/waves — Marea Disforme (F3 idle): defensa por oleadas automática.
 */
const express = require('express');
const { telegramAuth } = require('../middleware/telegramAuth');
const { safeErrorMessage } = require('../middleware/errorHandler');
const waveDefenseService = require('../services/waveDefenseService');

const router = express.Router();

// GET /api/waves/status — escalera del jugador
router.get('/status', telegramAuth, async (req, res) => {
  try {
    res.json(await waveDefenseService.getStatus(req.playerId));
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

// POST /api/waves/start — resuelve un desafío completo (server-side, por rondas)
router.post('/start', telegramAuth, async (req, res) => {
  try {
    res.json(await waveDefenseService.startRun(req.playerId));
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

// GET /api/waves/history — últimos runs
router.get('/history', telegramAuth, async (req, res) => {
  try {
    res.json(await waveDefenseService.getHistory(req.playerId));
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

module.exports = router;
