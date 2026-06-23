const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const factionService = require('../services/factionService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// List all factions with stats
router.get('/', telegramAuth, async (req, res) => {
  try {
    const factions = await factionService.listFactions();
    res.json(factions);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

// Top members of a faction (faction-internal leaderboard)
router.get('/:factionId/members', telegramAuth, async (req, res) => {
  try {
    const factionId = String(req.params.factionId).slice(0, 50);
    if (!/^[a-z_]+$/.test(factionId)) {
      return res.status(400).json({ error: 'ID de facción inválido' });
    }
    const members = await factionService.getMembers(factionId);
    res.json(members);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
