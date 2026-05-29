const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const { safeErrorMessage } = require('../middleware/errorHandler');
const worldEventService = require('../services/worldEventService');

// Validates a route param is a positive integer; returns 400 on failure.
function requireIntParam(name) {
  return (req, res, next) => {
    const val = parseInt(req.params[name], 10);
    if (!val || isNaN(val) || val < 1) {
      return res.status(400).json({ error: `${name} debe ser un número entero positivo` });
    }
    req.params[name] = val; // coerce to number for downstream handlers
    next();
  };
}

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
router.post('/:id/claim', telegramAuth, requireIntParam('id'), validate({}), async (req, res) => {
  try {
    const result = await worldEventService.claimEvent(req.playerId, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Start a co-op session for a world event
router.post('/:id/start-coop', telegramAuth, requireIntParam('id'), validate({}), async (req, res) => {
  try {
    const result = await worldEventService.startCoopSession(req.playerId, req.params.id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Get session info (used when joining via deep link)
router.get('/session/:sessionId', telegramAuth, requireIntParam('sessionId'), async (req, res) => {
  try {
    const session = await worldEventService.getSession(req.params.sessionId);
    if (!session) return res.status(404).json({ error: 'Sesión no encontrada' });
    res.json(session);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener la sesión' });
  }
});

// Join an existing co-op session
router.post('/session/:sessionId/join', telegramAuth, requireIntParam('sessionId'), validate({}), async (req, res) => {
  try {
    const result = await worldEventService.joinCoopSession(req.playerId, req.params.sessionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;

