const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const achievementService = require('../services/achievementService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Player's full achievements list with progress + unlock + claim state
router.get('/', telegramAuth, async (req, res) => {
  try {
    const list = await achievementService.listForPlayer(req.playerId);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

// Claim reward for a single unlocked achievement
router.post('/:id/claim', telegramAuth, async (req, res) => {
  try {
    const id = String(req.params.id || '').slice(0, 50);
    if (!/^[a-z0-9_]+$/.test(id)) {
      return res.status(400).json({ error: 'ID de logro inválido' });
    }
    const result = await achievementService.claimReward(req.playerId, id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
