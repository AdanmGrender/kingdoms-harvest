const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

function playerLimit(windowMs, max, message) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    // Primary key: Telegram player ID (integer). Falls back to IPv6-safe IP
    // helper for unauthenticated requests (before telegramAuth has run).
    keyGenerator: (req) => req.playerId ? String(req.playerId) : ipKeyGenerator(req),
    handler: (req, res) => res.status(429).json({ error: message }),
    skip: () => process.env.NODE_ENV === 'test',
  });
}

module.exports = {
  withdrawLimit:    playerLimit(60 * 60 * 1000,       3, 'Máximo 3 solicitudes de retiro por hora. Intentá más tarde.'),
  withdrawOTPLimit: playerLimit(60 * 60 * 1000,       5, 'Máximo 5 códigos de verificación por hora.'),
  captchaLimit:     playerLimit(60 * 60 * 1000,      15, 'Demasiados intentos de captcha. Intentá más tarde.'),
  pvpLimit:         playerLimit(5  * 60 * 1000,      10, 'Máximo 10 ataques PvP cada 5 minutos.'),
  guildCreateLimit: playerLimit(24 * 60 * 60 * 1000,  3, 'Máximo 3 gremios por día.'),
  marketListLimit:  playerLimit(60 * 60 * 1000,      20, 'Máximo 20 publicaciones en el mercado por hora.'),
  burnLimit:        playerLimit(60 * 60 * 1000,      10, 'Máximo 10 quemas por hora.'),
};
