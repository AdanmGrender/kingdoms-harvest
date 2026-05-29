const { captureException } = require('../config/sentry');

/**
 * Known game errors thrown intentionally by services (safe to show to users).
 * Unexpected errors (DB failures, type errors, etc.) get a generic message in production.
 */
class GameError extends Error {
  constructor(message) {
    super(message);
    this.name = 'GameError';
  }
}

/**
 * Returns a safe error message for the client.
 * In development, always returns the real message.
 * In production, only returns the real message for known GameErrors.
 */
function safeErrorMessage(error) {
  if (process.env.NODE_ENV !== 'production') {
    return error.message;
  }
  if (error instanceof GameError) {
    return error.message;
  }
  // Unexpected error — capture to Sentry and return generic message to client
  console.error('Unexpected error:', error);
  captureException(error);
  return 'Error interno del servidor';
}

module.exports = { GameError, safeErrorMessage };
