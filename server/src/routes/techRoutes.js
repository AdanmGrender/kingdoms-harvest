const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const techService = require('../services/techService');
const { safeErrorMessage } = require('../middleware/errorHandler');

router.get('/', telegramAuth, async (req, res) => {
  try {
    const data = await techService.getResearch(req.playerId);
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

router.post('/research', telegramAuth, validate({
  branchId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z_]+$/ },
  techId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z_]+$/ },
}), async (req, res) => {
  try {
    const result = await techService.startResearch(req.playerId, req.body.branchId, req.body.techId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
