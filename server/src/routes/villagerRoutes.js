const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const villagerService = require('../services/villagerService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Get all villagers
router.get('/', telegramAuth, async (req, res) => {
  try {
    const villagers = await villagerService.getVillagers(req.playerId);
    res.json(villagers);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener aldeanos' });
  }
});

// Spawn a new villager
router.post('/spawn', telegramAuth, validate({
  role: { type: 'string', required: true, maxLength: 20, pattern: /^[a-z_]+$/ },
}), async (req, res) => {
  try {
    const result = await villagerService.spawnVillager(req.playerId, req.body.role);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Assign villager to building
router.post('/assign', telegramAuth, validate({
  villagerId: { type: 'number', required: true, min: 1 },
  buildingId: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const { villagerId, buildingId } = req.body;
    const result = await villagerService.assignToBuilding(req.playerId, villagerId, buildingId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Unassign villager
router.post('/unassign', telegramAuth, validate({
  villagerId: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const result = await villagerService.unassign(req.playerId, req.body.villagerId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
