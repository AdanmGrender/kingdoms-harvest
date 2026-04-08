const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const missionService = require('../services/missionService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Obtener misiones disponibles
router.get('/', telegramAuth, async (req, res) => {
  try {
    const missions = await missionService.getMissions(req.playerId);
    res.json(missions);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener misiones' });
  }
});

// Generar nuevas misiones (refresh del tablón)
router.post('/generate', telegramAuth, async (req, res) => {
  try {
    const missions = await missionService.generateMissions(req.playerId);
    res.json(missions);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Aceptar una misión
router.post('/accept', telegramAuth, validate({
  missionId: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const { missionId } = req.body;
    const result = await missionService.acceptMission(req.playerId, missionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Completar una misión (entregar items)
router.post('/complete', telegramAuth, validate({
  missionId: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const { missionId } = req.body;
    const result = await missionService.completeMission(req.playerId, missionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
