const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const { safeErrorMessage } = require('../middleware/errorHandler');
const calendarService = require('../services/calendarService');

router.get('/state', telegramAuth, async (req, res) => {
  try {
    res.json(await calendarService.getState(req.playerId));
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

router.post('/claim', telegramAuth, validate({}), async (req, res) => {
  try {
    res.json(await calendarService.claim(req.playerId));
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

module.exports = router;
