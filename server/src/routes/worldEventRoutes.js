const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { safeErrorMessage } = require('../middleware/errorHandler');
const worldEventService = require('../services/worldEventService');

// Get all active events (with claim + session status for this player)
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

// Start a co-op session for a world event
router.post('/:id/start-coop', telegramAuth, async (req, res) => {
  try {
    const eventId = parseInt(req.params.id, 10);
    if (!eventId || isNaN(eventId) || eventId < 1) {
      return res.status(400).json({ error: 'ID de evento inválido' });
    }
    const result = await worldEventService.startCoopSession(req.playerId, eventId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Get session info (used when joining via deep link)
router.get('/session/:sessionId', telegramAuth, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (!sessionId || isNaN(sessionId) || sessionId < 1) {
      return res.status(400).json({ error: 'ID de sesión inválido' });
    }
    const session = await worldEventService.getSession(sessionId);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la sesión' });
  }
});

// Join an existing co-op session
router.post('/session/:sessionId/join', telegramAuth, async (req, res) => {
  try {
    const sessionId = parseInt(req.params.sessionId, 10);
    if (!sessionId || isNaN(sessionId) || sessionId < 1) {
      return res.status(400).json({ error: 'ID de sesión inválido' });
    }
    const result = await worldEventService.joinCoopSession(req.playerId, sessionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
