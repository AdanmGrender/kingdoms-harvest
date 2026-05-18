const crypto = require('crypto');

const MAX_AUTH_AGE_SECONDS = 300; // 5 minutos

/**
 * Middleware para validar que la petición viene de Telegram Mini App.
 * Verifica el initData usando HMAC-SHA256 con el bot token.
 */
function telegramAuth(req, res, next) {
  // Dev bypass: guarded by NODE_ENV — never active in production
  if (process.env.NODE_ENV !== 'production' &&
      (process.env.SKIP_AUTH === 'true' || req.headers['x-skip-auth'] === 'true')) {
    req.playerId = 123456;
    req.playerData = { id: 123456, first_name: 'Dev', username: 'devuser' };
    return next();
  }

  const initData = req.headers['x-telegram-init-data'];

  if (!initData) {
    return res.status(401).json({ error: 'No se proporcionó initData de Telegram' });
  }

  try {
    const parsed = new URLSearchParams(initData);
    const hash = parsed.get('hash');
    if (!hash) {
      return res.status(401).json({ error: 'Hash no proporcionado' });
    }
    parsed.delete('hash');

    // Verificar expiración de auth_date
    const authDate = parseInt(parsed.get('auth_date'), 10);
    if (!authDate || isNaN(authDate)) {
      return res.status(401).json({ error: 'auth_date inválido' });
    }
    const now = Math.floor(Date.now() / 1000);
    if (now - authDate > MAX_AUTH_AGE_SECONDS) {
      return res.status(401).json({ error: 'initData expirado' });
    }

    // Ordenar parámetros alfabéticamente
    const dataCheckString = Array.from(parsed.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');

    // Crear secret key usando HMAC del bot token
    if (!process.env.BOT_TOKEN) {
      console.error('[Auth] BOT_TOKEN no está configurado');
      return res.status(500).json({ error: 'Error de configuración del servidor' });
    }
    const secretKey = crypto
      .createHmac('sha256', 'WebAppData')
      .update(process.env.BOT_TOKEN)
      .digest();

    // Calcular hash esperado
    const expectedHash = crypto
      .createHmac('sha256', secretKey)
      .update(dataCheckString)
      .digest('hex');

    // Comparación timing-safe para evitar timing attacks
    const hashBuffer = Buffer.from(hash, 'hex');
    const expectedBuffer = Buffer.from(expectedHash, 'hex');
    if (hashBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(hashBuffer, expectedBuffer)) {
      return res.status(401).json({ error: 'initData inválido' });
    }

    // Extraer datos del usuario
    const userRaw = parsed.get('user');
    if (!userRaw) {
      return res.status(401).json({ error: 'Datos de usuario no encontrados' });
    }
    const userData = JSON.parse(userRaw);
    req.playerId = userData.id;
    req.playerData = userData;

    next();
  } catch (error) {
    console.error('Error en autenticación Telegram:', error.message);
    return res.status(401).json({ error: 'Error de autenticación' });
  }
}

module.exports = { telegramAuth };
