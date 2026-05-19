const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const territoryService = require('../services/territoryService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// List all territories
router.get('/', telegramAuth, async (req, res) => {
  try {
    const territories = await territoryService.getTerritories();
    res.json(territories);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener territorios' });
  }
});

// Get single territory detail
router.get('/:id', telegramAuth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id < 1) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const territory = await territoryService.getTerritory(id);
    res.json(territory);
  } catch (error) {
    res.status(404).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
