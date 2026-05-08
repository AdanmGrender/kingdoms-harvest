const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const craftingService = require('../services/craftingService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// List all craftable items and their recipes
router.get('/', telegramAuth, async (req, res) => {
  try {
    res.json(craftingService.getCraftableItems());
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

// Craft an item
router.post('/craft', telegramAuth, validate({
  itemId:   { type: 'string', required: true, maxLength: 30, pattern: /^[a-z_]+$/ },
  quantity: { type: 'number', required: true, min: 1, max: 100 },
}), async (req, res) => {
  try {
    const result = await craftingService.craft(req.playerId, req.body.itemId, req.body.quantity);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
