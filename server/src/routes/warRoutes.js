const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const factionWarService = require('../services/factionWarService');
const allianceWarService = require('../services/allianceWarService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Active server-wide faction war + standings
router.get('/faction/active', telegramAuth, async (req, res) => {
  try {
    const active = await factionWarService.getActive();
    const standings = await factionWarService.getStandings();
    res.json({ active, standings });
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

// Active alliance war (if any) for the player's alliance
router.get('/alliance/active', telegramAuth, async (req, res) => {
  try {
    const war = await allianceWarService.getMyActiveWar(req.playerId);
    res.json(war);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

// Leader-only: declare war on another alliance
router.post('/alliance/declare', telegramAuth, async (req, res) => {
  try {
    const targetId = parseInt(req.body?.targetAllianceId, 10);
    if (!Number.isInteger(targetId) || targetId < 1) {
      return res.status(400).json({ error: 'targetAllianceId inválido' });
    }
    const result = await allianceWarService.declareWar(req.playerId, targetId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
