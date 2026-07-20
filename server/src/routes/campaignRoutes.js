const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const { safeErrorMessage } = require('../middleware/errorHandler');
const campaignService = require('../services/campaignService');

router.get('/map', telegramAuth, async (req, res) => {
  try {
    const nodes = await campaignService.getMap(req.playerId);
    const sweepsLeft = await campaignService.sweepsLeft(req.playerId);
    res.json({ nodes, sweepsLeft });
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

router.post('/enter', telegramAuth, validate({
  nodeId: { type: 'string', required: true, maxLength: 40 },
}), async (req, res) => {
  try {
    res.json(await campaignService.enterNode(req.playerId, req.body.nodeId));
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

router.post('/step', telegramAuth, validate({
  runId: { type: 'number', required: true },
  actionType: { type: 'string', required: true, maxLength: 10 },
  slot: { type: 'number', required: false, min: 1, max: 5 },
}), async (req, res) => {
  try {
    const action = req.body.actionType === 'skill'
      ? { type: 'skill', slot: req.body.slot }
      : { type: 'advance' };
    res.json(await campaignService.resolveStep(req.playerId, req.body.runId, action));
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

router.post('/sweep', telegramAuth, validate({
  nodeId: { type: 'string', required: true, maxLength: 40 },
}), async (req, res) => {
  try {
    res.json(await campaignService.sweepNode(req.playerId, req.body.nodeId));
  } catch (error) { res.status(400).json({ error: safeErrorMessage(error) }); }
});

module.exports = router;
