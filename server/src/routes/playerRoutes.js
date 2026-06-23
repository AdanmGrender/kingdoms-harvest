const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const playerService = require('../services/playerService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Inicializar o recuperar jugador
router.post('/init', telegramAuth, validate({
  referralCode: { type: 'string', required: false, maxLength: 30, pattern: /^ref_\d{1,15}$/ },
}), async (req, res) => {
  try {
    const referralCode = req.body?.referralCode || null;
    const player = await playerService.initPlayer(req.playerId, req.playerData, referralCode);
    res.json(player);
  } catch (error) {
    console.error('Error init player:', error);
    res.status(500).json({ error: 'Error al inicializar jugador' });
  }
});

// Obtener perfil completo del jugador
router.get('/profile', telegramAuth, async (req, res) => {
  try {
    const profile = await playerService.getFullProfile(req.playerId);
    if (!profile) return res.status(404).json({ error: 'Jugador no encontrado' });
    res.json(profile);
  } catch (error) {
    console.error('Error get profile:', error);
    res.status(500).json({ error: 'Error al obtener perfil' });
  }
});

// Obtener recursos del jugador
router.get('/resources', telegramAuth, async (req, res) => {
  try {
    const resources = await playerService.getResources(req.playerId);
    res.json(resources);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener recursos' });
  }
});

// Unirse a una facción
router.post('/faction/join', telegramAuth, validate({
  factionId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z_]+$/ },
}), async (req, res) => {
  try {
    const { factionId } = req.body;
    const result = await playerService.joinFaction(req.playerId, factionId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Obtener ranking
router.get('/leaderboard', telegramAuth, async (req, res) => {
  try {
    const leaderboard = await playerService.getLeaderboard();
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener ranking' });
  }
});

// Toggle/set Telegram push notifications. Body: { enabled?: boolean }
// Body is intentionally not run through validate — the field is optional and
// the service coerces undefined → flip current value.
router.patch('/notif', telegramAuth, async (req, res) => {
  try {
    const requested = req.body?.enabled;
    const enabled = typeof requested === 'boolean' ? requested : undefined;
    const result = await playerService.setNotifEnabled(req.playerId, enabled);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Search players by display_name prefix — used by alliance invite UI.
// Returns at most 10 matches with telegram_id + display_name + level.
router.get('/search', telegramAuth, async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().slice(0, 32);
    if (q.length < 2) return res.json([]);
    const db = require('../config/database');
    const rows = await db('players')
      .where('display_name', 'LIKE', `${q}%`)
      .whereNot('telegram_id', req.playerId)
      .select('telegram_id as id', 'display_name', 'level', 'faction_id')
      .orderBy('level', 'desc')
      .limit(10);
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
