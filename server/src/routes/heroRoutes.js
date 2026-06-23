const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const heroService = require('../services/heroService');
const { safeErrorMessage } = require('../middleware/errorHandler');

// Stat caps for client bar normalization
router.get('/stat-caps', (req, res) => {
  res.json(heroService.STAT_CAPS);
});

// Get all player heroes
router.get('/', telegramAuth, async (req, res) => {
  try {
    const heroes = await heroService.getHeroes(req.playerId);
    res.json(heroes);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener héroes' });
  }
});

// Get player item inventory
router.get('/items', telegramAuth, async (req, res) => {
  try {
    const items = await heroService.getItems(req.playerId);
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener objetos' });
  }
});

// Summon a hero (tokens or gold)
router.post('/summon', telegramAuth, validate({
  payWithTokens: { type: 'boolean' },
}), async (req, res) => {
  try {
    const payWithTokens = req.body.payWithTokens !== false;
    const result = await heroService.summonHero(req.playerId, payWithTokens);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Level up a hero (costs gold)
router.post('/level-up', telegramAuth, validate({
  heroDbId: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const result = await heroService.levelUpHero(req.playerId, req.body.heroDbId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Equip an item on a hero
router.post('/equip', telegramAuth, validate({
  heroDbId: { type: 'number', required: true, min: 1 },
  itemId:   { type: 'string', required: true, maxLength: 50 },
}), async (req, res) => {
  try {
    const { heroDbId, itemId } = req.body;
    const result = await heroService.equipItem(req.playerId, heroDbId, itemId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Unequip an item from a hero slot
router.post('/unequip', telegramAuth, validate({
  heroDbId: { type: 'number', required: true, min: 1 },
  slot:     { type: 'string', required: true, maxLength: 20 },
}), async (req, res) => {
  try {
    const { heroDbId, slot } = req.body;
    if (!['weapon', 'armor', 'accessory'].includes(slot)) {
      return res.status(400).json({ error: 'Slot inválido' });
    }
    const result = await heroService.unequipItem(req.playerId, heroDbId, slot);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Deploy a hero for combat
router.post('/deploy', telegramAuth, validate({
  heroDbId: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const result = await heroService.deployHero(req.playerId, req.body.heroDbId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Recall the deployed hero
router.post('/recall', telegramAuth, async (req, res) => {
  try {
    const result = await heroService.recallHero(req.playerId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Get currently deployed hero
router.get('/deployed', telegramAuth, async (req, res) => {
  try {
    const result = await heroService.getDeployedHero(req.playerId);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Error al obtener héroe desplegado' });
  }
});

module.exports = router;
