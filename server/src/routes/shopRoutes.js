const express = require('express');
const router = express.Router();
const { telegramAuth } = require('../middleware/telegramAuth');
const { validate } = require('../middleware/validate');
const paymentService = require('../services/paymentService');
const gemService = require('../services/gemService');
const shopService = require('../services/shopService');
const boostService = require('../services/boostService');
const { safeErrorMessage } = require('../middleware/errorHandler');

/**
 * Tienda (INGRESO de dinero real vía Telegram Stars).
 *
 * ⚠️ NINGUNA ruta acá acredita gemas. El crédito ocurre EXCLUSIVAMENTE en el
 *    handler `successful_payment` del bot (update firmado por Telegram). El
 *    cliente solo puede PEDIR un link de factura y GASTAR lo que ya tiene.
 *    Tampoco existe ruta alguna que convierta gemas → KH/TON (invariante).
 */

// Catálogo de packs (público, del catálogo del server).
router.get('/catalog', telegramAuth, async (req, res) => {
  try {
    res.json({ packs: paymentService.getCatalog() });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Saldo de gemas del jugador.
router.get('/gems', telegramAuth, async (req, res) => {
  try {
    res.json(await gemService.getBalance(req.playerId));
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Crear link de factura de Stars. NO acredita nada: solo devuelve el link que
// el cliente abre con Telegram.WebApp.openInvoice().
router.post('/invoice', telegramAuth, validate({
  productId: { type: 'string', required: true, maxLength: 30, pattern: /^[a-z_]+$/ },
}), async (req, res) => {
  try {
    const result = await paymentService.createInvoice(req.playerId, req.body.productId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Historial de compras (solo columnas públicas).
router.get('/purchases', telegramAuth, async (req, res) => {
  try {
    res.json({ purchases: await paymentService.getPurchaseHistory(req.playerId) });
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Cotizar el costo de acelerar (para mostrar el precio antes de confirmar).
router.get('/speedup/building/:id', telegramAuth, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (!Number.isInteger(id) || id <= 0) throw new Error('Edificio inválido');
    res.json(await shopService.quoteSpeedupBuilding(req.playerId, id));
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Gastar gemas para acelerar una construcción. El costo se recalcula
// server-side; el cliente no manda el precio.
router.post('/speedup/building', telegramAuth, validate({
  buildingDbId: { type: 'number', required: true, min: 1 },
}), async (req, res) => {
  try {
    const result = await shopService.speedupBuilding(req.playerId, req.body.buildingDbId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Estado del boost de producción (activo/vencido + vencimiento).
router.get('/boost', telegramAuth, async (req, res) => {
  try {
    res.json(await boostService.getState(req.playerId));
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

// Comprar/extender el boost ×2 de producción. Costo/duración salen del
// catálogo (GEM_SINKS.production_boost) — nunca del request.
router.post('/boost', telegramAuth, validate({}), async (req, res) => {
  try {
    res.json(await boostService.buy(req.playerId));
  } catch (error) {
    res.status(400).json({ error: safeErrorMessage(error) });
  }
});

module.exports = router;
