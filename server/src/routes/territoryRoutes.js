const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const territoryService = require('../services/territoryService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// List world map territories with owner factions
router.get('/', telegramAuth, async (req, res) => {
  try {
    const list = await territoryService.listTerritories();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

// Attack a territory — wraps PvE combat and flips ownership on win
router.post('/:id/attack', telegramAuth, validate({
  army: { type: 'object', required: true, maxKeys: 20 },
  abilityId: { type: 'string', required: false, maxLength: 30, pattern: /^[a-z_]*$/ },
}), async (req, res) => {
  try {
    const territoryId = parseInt(req.params.id, 10);
    if (!Number.isInteger(territoryId) || territoryId < 1) {
      return res.status(400).json({ error: 'ID de territorio inválido' });
    }
    const { army, abilityId } = req.body;
    const result = await territoryService.attackTerritory(req.playerId, territoryId, army, abilityId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
