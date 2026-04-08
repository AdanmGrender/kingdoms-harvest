const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const tokenService = require('../services/tokenService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Obtener info de tokens del jugador
router.get('/info', telegramAuth, async (req, res) => {
  try {
    const info = await tokenService.getTokenInfo(req.playerId);
    res.json(info);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener info de tokens' });
  }
});

// Quemar recursos por tokens
router.post('/burn', telegramAuth, validate({
  resourceId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z_]+$/ },
  quantity: { type: 'number', required: true, min: 1, max: 10000 },
}), async (req, res) => {
  try {
    const { resourceId, quantity } = req.body;
    const result = await tokenService.burnResourcesForTokens(req.playerId, resourceId, quantity);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Vincular wallet TON
router.post('/link-wallet', telegramAuth, validate({
  walletAddress: { type: 'string', required: true, maxLength: 100, pattern: /^(EQ|UQ)[A-Za-z0-9_-]{46,48}$/ },
}), async (req, res) => {
  try {
    const result = await tokenService.linkWallet(req.playerId, req.body.walletAddress);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Solicitar retiro
router.post('/withdraw', telegramAuth, validate({
  amount: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const result = await tokenService.requestWithdrawal(req.playerId, req.body.amount);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Historial de retiros
router.get('/withdrawals', telegramAuth, async (req, res) => {
  try {
    const history = await tokenService.getWithdrawalHistory(req.playerId);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

// Leaderboard de tokens
router.get('/leaderboard', telegramAuth, async (req, res) => {
  try {
    const leaderboard = await tokenService.getTokenLeaderboard();
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ranking' });
  }
});

module.exports = router;
