const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const guildService = require('../services/guildService');
const { safeErrorMessage } = require('../middleware/errorHandler');
const { guildCreateLimit } = require('../middleware/endpointLimits');

router.post('/create', telegramAuth, guildCreateLimit, validate({
  name:        { type: 'string', required: true, maxLength: 30 },
  tag:         { type: 'string', required: true, maxLength: 5 },
  description: { type: 'string', maxLength: 200 },
}), async (req, res) => {
  try {
    const { name, tag, description } = req.body;
    const result = await guildService.createGuild(req.playerId, { name, tag, description });
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.get('/', telegramAuth, async (req, res) => {
  try {
    const guilds = await guildService.listGuilds(20);
    res.json(guilds);
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.get('/my', telegramAuth, async (req, res) => {
  try {
    const guild = await guildService.getMyGuild(req.playerId);
    res.json({ guild });
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.get('/me', telegramAuth, async (req, res) => {
  try {
    const guild = await guildService.getMyGuild(req.playerId);
    res.json({ guild });
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.get('/invites', telegramAuth, async (req, res) => {
  try {
    const invites = await guildService.getInvites(req.playerId);
    res.json({ invites });
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.get('/:id', telegramAuth, async (req, res) => {
  try {
    const guildId = parseInt(req.params.id, 10);
    if (!Number.isInteger(guildId) || guildId < 1) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const guild = await guildService.getGuild(guildId);
    res.json(guild);
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.post('/invite', telegramAuth, validate({
  targetPlayerId: { type: 'number', required: true },
}), async (req, res) => {
  try {
    const result = await guildService.inviteMember(req.playerId, req.body.targetPlayerId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.post('/respond-invite', telegramAuth, validate({
  guildId: { type: 'number', required: true },
  accept:  { type: 'boolean', required: true },
}), async (req, res) => {
  try {
    const result = await guildService.respondInvite(req.playerId, req.body.guildId, req.body.accept);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.post('/:id/join', telegramAuth, async (req, res) => {
  try {
    const guildId = parseInt(req.params.id, 10);
    if (!Number.isInteger(guildId) || guildId < 1) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const result = await guildService.joinGuild(req.playerId, guildId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.post('/:id/respond-invite', telegramAuth, validate({
  accept: { type: 'boolean', required: true },
}), async (req, res) => {
  try {
    const guildId = parseInt(req.params.id, 10);
    if (!Number.isInteger(guildId) || guildId < 1) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const result = await guildService.respondInvite(req.playerId, guildId, req.body.accept);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.post('/leave', telegramAuth, async (req, res) => {
  try {
    const result = await guildService.leaveGuild(req.playerId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.post('/contribute', telegramAuth, validate({
  amount: { type: 'number', required: true, min: 1, max: 100000 },
}), async (req, res) => {
  try {
    const result = await guildService.contributeToTreasury(req.playerId, req.body.amount);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.post('/promote', telegramAuth, validate({
  targetPlayerId: { type: 'number', required: true },
}), async (req, res) => {
  try {
    const result = await guildService.promoteOfficer(req.playerId, req.body.targetPlayerId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

router.post('/kick', telegramAuth, validate({
  targetPlayerId: { type: 'number', required: true },
}), async (req, res) => {
  try {
    const result = await guildService.kickMember(req.playerId, req.body.targetPlayerId);
    res.json(result);
  } catch (e) {
    res.status(400).json({ error: safeErrorMessage(e) });
  }
});

module.exports = router;
