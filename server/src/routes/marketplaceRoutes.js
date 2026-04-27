const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const marketplaceService = require('../services/marketplaceService');
const { safeErrorMessage } = require('../middleware/errorHandler');

router.get('/', telegramAuth, async (req, res) => {
  try {
    const list = await marketplaceService.listActive();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

router.get('/mine', telegramAuth, async (req, res) => {
  try {
    const list = await marketplaceService.listMine(req.playerId);
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

router.post('/', telegramAuth, validate({
  resourceId: { type: 'string', required: true, maxLength: 30, pattern: /^[a-z_]+$/ },
  quantity: { type: 'number', required: true, min: 1, max: 999999 },
  pricePerUnit: { type: 'number', required: true, min: 1, max: 1000000 },
}), async (req, res) => {
  try {
    const { resourceId, quantity, pricePerUnit } = req.body;
    const result = await marketplaceService.createListing(req.playerId, resourceId, quantity, pricePerUnit);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

router.post('/:id/buy', telegramAuth, validate({
  quantity: { type: 'number', required: true, min: 1, max: 999999 },
}), async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });
    const result = await marketplaceService.buyFromListing(req.playerId, id, req.body.quantity);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

router.delete('/:id', telegramAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });
    const result = await marketplaceService.cancelListing(req.playerId, id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
