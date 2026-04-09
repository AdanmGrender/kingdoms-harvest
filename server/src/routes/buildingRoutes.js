const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const buildingService = require('../services/buildingService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Obtener edificios del jugador
router.get('/', telegramAuth, async (req, res) => {
  try {
    const buildings = await buildingService.getBuildings(req.playerId);
    res.json(buildings);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener edificios' });
  }
});

// Construir nuevo edificio
router.post('/build', telegramAuth, validate({
  buildingId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z_]+$/ },
  posX: { type: 'number', required: true, min: 0, max: 200 },
  posY: { type: 'number', required: true, min: 0, max: 200 },
}), async (req, res) => {
  try {
    const { buildingId, posX, posY } = req.body;
    const result = await buildingService.buildNew(req.playerId, buildingId, posX, posY);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Mejorar edificio existente
router.post('/upgrade', telegramAuth, validate({
  buildingDbId: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const { buildingDbId } = req.body;
    const result = await buildingService.upgrade(req.playerId, buildingDbId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Obtener coste de construcción/mejora
router.get('/cost/:buildingId/:level', telegramAuth, async (req, res) => {
  try {
    const buildingId = req.params.buildingId;
    const level = parseInt(req.params.level, 10);
    if (!/^[a-z_]+$/.test(buildingId) || isNaN(level) || level < 1 || level > 50) {
      return res.status(400).json({ error: 'Parámetros inválidos' });
    }
    const cost = buildingService.calculateCost(buildingId, level);
    res.json(cost);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
