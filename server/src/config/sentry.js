const Sentry = require('@sentry/node');

let _initialized = false;

function initSentry() {
  if (_initialized || !process.env.SENTRY_DSN) return;

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: `kingdoms-harvest@${process.env.npm_package_version || '1.0.0'}`,
    // Sample 10% of transactions in production; skip in test/dev to avoid noise
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 0,
    beforeSend(event, hint) {
      // GameErrors are intentional business-logic errors — don't fill up quota with them
      if (hint.originalException?.name === 'GameError') return null;
      return event;
    },
  });

  _initialized = true;
}

/**
 * captureException — safe to call whether or not Sentry was initialized.
 * extras: flat object of additional context (e.g. { subsystem: 'tick.crops' })
 */
function captureException(error, extras) {
  if (!_initialized) return;
  if (extras) {
    Sentry.withScope((scope) => {
      for (const [key, val] of Object.entries(extras)) scope.setExtra(key, val);
      Sentry.captureException(error);
    });
  } else {
    Sentry.captureException(error);
  }
}

/**
 * Wire Sentry's Express error handler (must be called after all routes).
 * Captures any error that propagates out of route handlers unhandled.
 */
function setupExpressErrorHandler(app) {
  if (!_initialized) return;
  Sentry.setupExpressErrorHandler(app);
}

module.exports = { initSentry, captureException, setupExpressErrorHandler };
