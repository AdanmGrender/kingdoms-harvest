/**
 * /api/system — Escala Sistema (G1 idle): meta-mapa de planetas.
 */
const express = require('express');
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const { safeErrorMessage } = require('../middleware/errorHandler');
const systemService = require('../services/systemService');

const router = express.Router();

// GET /api/system — estado de la escala (planetas + nave)
router.get('/', telegramAuth, async (req, res) => {
  try {
    res.json(await systemService.getSystem(req.playerId));
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

// POST /api/system/launch — mandar la Nave a un planeta
router.post('/launch', telegramAuth, validate({
  planetId: { type: 'string', required: true, maxLength: 30 },
}), async (req, res) => {
  try {
    res.json(await systemService.launchShip(req.playerId, req.body.planetId));
  } catch (err) {
    res.status(400).json({ error: safeErrorMessage(err) });
  }
});

module.exports = router;
