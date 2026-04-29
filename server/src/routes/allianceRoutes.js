const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const allianceService = require('../services/allianceService');
const { safeErrorMessage } = require('../middleware/errorHandler');

router.get('/', telegramAuth, async (req, res) => {
  try {
    const list = await allianceService.listAlliances();
    res.json(list);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

router.get('/mine', telegramAuth, async (req, res) => {
  try {
    const mine = await allianceService.getMyAlliance(req.playerId);
    res.json(mine || null);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

router.get('/:id/members', telegramAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });
    const members = await allianceService.getMembers(id);
    res.json(members);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

router.post('/', telegramAuth, validate({
  name: { type: 'string', required: true, maxLength: 24 },
  motto: { type: 'string', required: false, maxLength: 80 },
}), async (req, res) => {
  try {
    const result = await allianceService.createAlliance(req.playerId, req.body.name, req.body.motto || '');
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

router.post('/:id/join', telegramAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });
    const result = await allianceService.joinAlliance(req.playerId, id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

router.post('/leave', telegramAuth, async (req, res) => {
  try {
    const result = await allianceService.leaveAlliance(req.playerId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

router.delete('/:id', telegramAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id < 1) return res.status(400).json({ error: 'ID inválido' });
    const result = await allianceService.disbandAlliance(req.playerId, id);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Last 50 chat messages for the player's alliance
router.get('/messages/list', telegramAuth, async (req, res) => {
  try {
    const messages = await allianceService.getMessages(req.playerId);
    res.json(messages);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Post a chat message — fans out via socket + rate-limited DMs to offline
router.post('/messages', telegramAuth, validate({
  content: { type: 'string', required: true, maxLength: 280 },
}), async (req, res) => {
  try {
    const io = req.app.get('io');
    const result = await allianceService.sendMessage(req.playerId, req.body.content, io);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
