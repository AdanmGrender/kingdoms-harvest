const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const combatService = require('../services/combatService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Obtener tropas del jugador
router.get('/troops', telegramAuth, async (req, res) => {
  try {
    const troops = await combatService.getTroops(req.playerId);
    res.json(troops);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener tropas' });
  }
});

// Entrenar tropas
router.post('/train', telegramAuth, validate({
  troopId: { type: 'string', required: true, maxLength: 50, pattern: /^[a-z_]+$/ },
  quantity: { type: 'number', required: true, min: 1, max: 1000 },
}), async (req, res) => {
  try {
    const { troopId, quantity } = req.body;
    const result = await combatService.trainTroops(req.playerId, troopId, quantity);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Atacar aldea NPC (PvE)
router.post('/attack/pve', telegramAuth, validate({
  army: { type: 'object', required: true, maxKeys: 20 },
  territoryId: { type: 'number', required: false, min: 1 },
  abilityId: { type: 'string', required: false, maxLength: 30, pattern: /^[a-z_]*$/ },
}), async (req, res) => {
  try {
    const { army, territoryId, abilityId } = req.body;
    const result = await combatService.attackPVE(req.playerId, army, territoryId, abilityId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Listar jugadores atacables para PvP
router.get('/players', telegramAuth, async (req, res) => {
  try {
    const db = require('../config/database');
    const targets = await db('players')
      .select('telegram_id as id', 'display_name', 'level', 'faction_id')
      .whereNot('telegram_id', req.playerId)
      .orderBy('level', 'desc')
      .limit(20);
    res.json(targets);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener jugadores' });
  }
});

// Atacar otro jugador (PvP)
router.post('/attack/pvp', telegramAuth, validate({
  army: { type: 'object', required: true, maxKeys: 20 },
  defenderId: { type: 'number', required: true, min: 1 },
  abilityId: { type: 'string', required: false, maxLength: 30, pattern: /^[a-z_]*$/ },
}), async (req, res) => {
  try {
    const { army, defenderId, abilityId } = req.body;
    const result = await combatService.attackPVP(req.playerId, army, defenderId, abilityId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Obtener historial de batallas
router.get('/history', telegramAuth, async (req, res) => {
  try {
    const battles = await combatService.getBattleHistory(req.playerId);
    res.json(battles);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener historial' });
  }
});

module.exports = router;
