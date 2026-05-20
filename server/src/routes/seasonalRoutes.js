const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { safeErrorMessage } = require('../middleware/errorHandler');
const seasonalEventService = require('../services/seasonalEventService');
const db = require('../config/database');

async function getWorldDay(playerId) {
  const player = await db('players').where('telegram_id', playerId).first();
  return player?.world_day || 0;
}

router.get('/', telegramAuth, async (req, res) => {
  try {
    const worldDay = await getWorldDay(req.playerId);
    const seasonInfo = seasonalEventService.getSeasonInfo(worldDay);
    const challenges = await seasonalEventService.getSeasonalChallenges(req.playerId, worldDay);
    res.json({ ...seasonInfo, challenges });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

router.post('/claim/:challengeId', telegramAuth, async (req, res) => {
  try {
    const { challengeId } = req.params;
    if (!/^[a-z_0-9]+$/.test(challengeId)) {
      return res.status(400).json({ error: 'ID de desafío inválido' });
    }
    const worldDay = await getWorldDay(req.playerId);
    const result = await seasonalEventService.claimSeasonalReward(req.playerId, challengeId, worldDay);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
