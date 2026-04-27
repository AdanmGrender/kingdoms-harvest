const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const eventService = require('../services/eventService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Single active server-wide event (or null)
router.get('/active', telegramAuth, async (req, res) => {
  try {
    const active = await eventService.getActive();
    res.json(active || null);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
