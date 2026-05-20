const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const marketService = require('../services/marketService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Browse active listings (optional ?resource= filter)
router.get('/', telegramAuth, async (req, res) => {
  try {
    const resourceId = typeof req.query.resource === 'string' ? req.query.resource : null;
    const listings = await marketService.getListings({ resourceId });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener el mercado' });
  }
});

// Get my listings
router.get('/my', telegramAuth, async (req, res) => {
  try {
    const listings = await marketService.getMyListings(req.playerId);
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tus ventas' });
  }
});

// Create a new listing
router.post('/list', telegramAuth, validate({
  resourceId:   { type: 'string', required: true, maxLength: 30 },
  quantity:     { type: 'number', required: true, min: 1, max: 1000 },
  pricePerUnit: { type: 'number', required: true, min: 1, max: 10000 },
}), async (req, res) => {
  try {
    const { resourceId, quantity, pricePerUnit } = req.body;
    const result = await marketService.createListing(req.playerId, resourceId, quantity, pricePerUnit);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Buy from a listing
router.post('/:id/buy', telegramAuth, validate({
  quantity: { type: 'number', required: true, min: 1, max: 1000 },
}), async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    if (!Number.isInteger(listingId) || listingId < 1) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const result = await marketService.buyListing(req.playerId, listingId, req.body.quantity);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Cancel a listing (seller only)
router.post('/:id/cancel', telegramAuth, async (req, res) => {
  try {
    const listingId = Number(req.params.id);
    if (!Number.isInteger(listingId) || listingId < 1) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const result = await marketService.cancelListing(req.playerId, listingId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
