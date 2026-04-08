const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const commerceService = require('../services/commerceService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Obtener caravana activa
router.get('/caravan', telegramAuth, async (req, res) => {
  try {
    const caravan = await commerceService.getActiveCaravan();
    res.json(caravan);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener caravana' });
  }
});

// Comprar a la caravana
router.post('/caravan/buy', telegramAuth, validate({
  resourceId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z_]+$/ },
  quantity: { type: 'number', required: true, min: 1, max: 9999 },
}), async (req, res) => {
  try {
    const { resourceId, quantity } = req.body;
    const result = await commerceService.buyFromCaravan(req.playerId, resourceId, quantity);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Vender a la caravana
router.post('/caravan/sell', telegramAuth, validate({
  resourceId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z_]+$/ },
  quantity: { type: 'number', required: true, min: 1, max: 9999 },
}), async (req, res) => {
  try {
    const { resourceId, quantity } = req.body;
    const result = await commerceService.sellToCaravan(req.playerId, resourceId, quantity);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Venta rápida de recursos
router.post('/sell', telegramAuth, validate({
  resourceId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z_]+$/ },
  quantity: { type: 'number', required: true, min: 1, max: 9999 },
}), async (req, res) => {
  try {
    const { resourceId, quantity } = req.body;
    const result = await commerceService.quickSell(req.playerId, resourceId, quantity);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
