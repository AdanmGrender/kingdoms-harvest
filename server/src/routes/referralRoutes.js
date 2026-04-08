const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const referralService = require('../services/referralService');

// Obtener stats de referidos
router.get('/stats', telegramAuth, async (req, res) => {
  try {
    const stats = await referralService.getReferralStats(req.playerId);
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener stats de referidos' });
  }
});

// Obtener link de referido
router.get('/link', telegramAuth, async (req, res) => {
  try {
    const link = referralService.generateReferralLink(req.playerId);
    res.json({ link });
  } catch (error) {
    res.status(500).json({ error: 'Error al generar link' });
  }
});

module.exports = router;
