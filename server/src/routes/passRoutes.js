const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const { safeErrorMessage } = require('../middleware/errorHandler');
const passService = require('../services/passService');

router.get('/state', telegramAuth, async (req, res) => {
  try {
    res.json(await passService.getState(req.playerId));
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

router.post('/premium', telegramAuth, validate({}), async (req, res) => {
  try {
    res.json(await passService.unlockPremium(req.playerId));
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

router.post('/claim', telegramAuth, validate({
  tier: { type: 'number', required: true, min: 1, max: 20 },
  track: { type: 'string', required: true, maxLength: 10 },
}), async (req, res) => {
  try {
    res.json(await passService.claimTier(req.playerId, req.body.tier, req.body.track));
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

module.exports = router;
