const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const tournamentService = require('../services/tournamentService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Active tournaments + the player's standings inside them
router.get('/active', telegramAuth, async (req, res) => {
  try {
    // Lazy-snapshot the player into every active tournament so their
    // first request as the window opens still counts toward the score.
    await tournamentService.ensureEntries(req.playerId);
    const active = await tournamentService.getActiveTournaments();
    res.json(active);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

// Live leaderboard for one tournament
router.get('/:id/leaderboard', telegramAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });
    const limit = Math.min(parseInt(req.query.limit || '10', 10), 50);
    const leaderboard = await tournamentService.getLeaderboard(id, limit);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
