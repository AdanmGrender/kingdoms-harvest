const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const farmService = require('../services/farmService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Obtener parcelas del jugador
router.get('/plots', telegramAuth, async (req, res) => {
  try {
    const plots = await farmService.getPlots(req.playerId);
    res.json(plots);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener parcelas' });
  }
});

// Plantar un cultivo
router.post('/plant', telegramAuth, validate({
  plotId: { type: 'number', required: true, min: 1 },
  cropId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z_]+$/ },
}), async (req, res) => {
  try {
    const { plotId, cropId } = req.body;
    const result = await farmService.plantCrop(req.playerId, plotId, cropId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Cosechar un cultivo
router.post('/harvest', telegramAuth, validate({
  plotId: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const { plotId } = req.body;
    const result = await farmService.harvestCrop(req.playerId, plotId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Obtener animales del jugador
router.get('/animals', telegramAuth, async (req, res) => {
  try {
    const animals = await farmService.getAnimals(req.playerId);
    res.json(animals);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener animales' });
  }
});

// Comprar un animal
router.post('/animals/buy', telegramAuth, validate({
  animalId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z_]+$/ },
  name: { type: 'string', required: false, maxLength: 30, pattern: /^[\p{L}\p{N}\s._'-]{1,30}$/u },
}), async (req, res) => {
  try {
    const { animalId, name } = req.body;
    const result = await farmService.buyAnimal(req.playerId, animalId, name);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Alimentar un animal
router.post('/animals/feed', telegramAuth, validate({
  animalId: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const { animalId } = req.body;
    const result = await farmService.feedAnimal(req.playerId, animalId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Recolectar producto de un animal
router.post('/animals/collect', telegramAuth, validate({
  animalId: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const { animalId } = req.body;
    const result = await farmService.collectAnimalProduct(req.playerId, animalId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
