/**
 * /api/storms — Tormentas Disformes (F2 idle).
 */
const express = require('express');
const { telegramAuth } = require('../middleware/telegramAuth');
const { safeErrorMessage } = require('../middleware/errorHandler');
const stormService = require('../services/stormService');

const router = express.Router();

// GET /api/storms/active — tormenta activa (null si el cielo está limpio)
router.get('/active', telegramAuth, async (req, res) => {
  try {
    const storm = await stormService.getActive();
    res.json(storm || null);
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

module.exports = router;
