const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const achievementService = require('../services/achievementService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Get all achievements with player progress
router.get('/', telegramAuth, async (req, res) => {
  try {
    const achievements = await achievementService.getAchievements(req.playerId);
    res.json(achievements);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener logros' });
  }
});

// Claim reward for an unlocked achievement
router.post('/:id/claim', telegramAuth, async (req, res) => {
  try {
    const achievementId = req.params.id;
    if (!/^[a-z_0-9]+$/.test(achievementId)) {
      return res.status(400).json({ error: 'ID de logro inválido' });
    }
    const result = await achievementService.claimReward(req.playerId, achievementId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
