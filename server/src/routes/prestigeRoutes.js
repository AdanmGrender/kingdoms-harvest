const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const { safeErrorMessage } = require('../middleware/errorHandler');
const prestigeService = require('../services/prestigeService');

router.get('/', telegramAuth, async (req, res) => {
  try {
    const info = await prestigeService.getPrestigeInfo(req.playerId);
    res.json(info);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

router.post('/execute', telegramAuth, async (req, res) => {
  try {
    const result = await prestigeService.executePrestige(req.playerId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

router.post('/upgrade', telegramAuth, validate({
  upgradeId: { type: 'string', required: true, maxLength: 30 },
}), async (req, res) => {
  try {
    const result = await prestigeService.purchaseUpgrade(req.playerId, req.body.upgradeId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
