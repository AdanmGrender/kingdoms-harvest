const express = require('express');
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const { safeErrorMessage } = require('../middleware/errorHandler');
const notificationService = require('../services/notificationService');

const router = express.Router();

// GET /api/notifications/prefs
router.get('/prefs', telegramAuth, async (req, res) => {
  try {
    const prefs = await notificationService.getPrefs(req.playerId);
    res.json(prefs);
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

// POST /api/notifications/prefs — update multiple preferences at once
router.post('/prefs', telegramAuth, validate({
  crops:          { type: 'boolean' },
  buildings:      { type: 'boolean' },
  troops:         { type: 'boolean' },
  animals:        { type: 'boolean' },
  withdrawals:    { type: 'boolean' },
  sieges:         { type: 'boolean' },
  events:         { type: 'boolean' },
  daily_reminder: { type: 'boolean' },
}), async (req, res) => {
  try {
    await notificationService.updatePrefs(req.playerId, req.body);
    const prefs = await notificationService.getPrefs(req.playerId);
    res.json(prefs);
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

// POST /api/notifications/toggle — toggle a single type
router.post('/toggle', telegramAuth, validate({
  type: { type: 'string', required: true, maxLength: 30 },
}), async (req, res) => {
  try {
    const newValue = await notificationService.togglePref(req.playerId, req.body.type);
    res.json({ type: req.body.type, enabled: newValue });
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

module.exports = router;
