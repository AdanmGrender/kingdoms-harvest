const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const siegeService = require('../services/siegeService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Get sieges
router.get('/', telegramAuth, async (req, res) => {
  try {
    const sieges = await siegeService.getSieges(req.playerId);
    res.json(sieges);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener asedios' });
  }
});

// Declare war
router.post('/declare', telegramAuth, validate({
  defenderId: { type: 'number', required: true, min: 1 },
  army: { type: 'object', required: true, maxKeys: 20 },
}), async (req, res) => {
  try {
    const { defenderId, army } = req.body;
    const result = await siegeService.declareWar(req.playerId, defenderId, army);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Use ability during siege
router.post('/ability', telegramAuth, validate({
  siegeId: { type: 'number', required: true, min: 1 },
  abilityId: { type: 'string', required: true, maxLength: 30, pattern: /^[a-z_]+$/ },
}), async (req, res) => {
  try {
    const { siegeId, abilityId } = req.body;
    const result = await siegeService.useAbility(req.playerId, siegeId, abilityId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
