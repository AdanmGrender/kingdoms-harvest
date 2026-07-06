/**
 * /api/galaxy — Escala Galaxia (G2 idle): surcar la Disformidad.
 */
const express = require('express');
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const { safeErrorMessage } = require('../middleware/errorHandler');
const galaxyService = require('../services/galaxyService');

const router = express.Router();

// GET /api/galaxy — estado de la escala (sistemas + crucero)
router.get('/', telegramAuth, async (req, res) => {
  try {
    res.json(await galaxyService.getGalaxy(req.playerId));
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

// POST /api/galaxy/warp — surcar la Disformidad hacia un sistema
router.post('/warp', telegramAuth, validate({
  systemId: { type: 'string', required: true, maxLength: 30 },
}), async (req, res) => {
  try {
    res.json(await galaxyService.launchWarp(req.playerId, req.body.systemId));
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

module.exports = router;
