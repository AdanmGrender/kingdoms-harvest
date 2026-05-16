const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { safeErrorMessage } = require('../middleware/errorHandler');
const worldEventService = require('../services/worldEventService');

// Get all active events (with claim status for this player)
router.get('/', telegramAuth, async (req, res) => {
  try {
    const events = await worldEventService.getActiveEvents(req.playerId);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener eventos del mundo' });
  }
});

// Claim a world event
router.post('/:id/claim', telegramAuth, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    if (!eventId || isNaN(eventId) || eventId < 1) {
      return res.status(400).json({ error: 'ID de evento inválido' });
    }
    const result = await worldEventService.claimEvent(req.playerId, eventId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
