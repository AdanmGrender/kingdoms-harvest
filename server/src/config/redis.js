/**
 * Redis client — ioredis instance.
 * Returns null when REDIS_URL is not set, making the entire cache layer a no-op.
 * All callers must handle null gracefully.
 */
const Redis = require('ioredis');

let _client = null;
let _connected = false;

function getRedis() {
  if (!process.env.REDIS_URL) return null;

  if (!_client) {
    _client = new Redis(process.env.REDIS_URL, {
      lazyConnect: true,
      maxRetriesPerRequest: 1,     // fail fast so callers fall through to DB
      enableOfflineQueue: false,   // don't queue commands while disconnected
      connectTimeout: 2000,
      retryStrategy: (times) => {
        if (times >= 3) return null; // stop retrying after 3 attempts
        return Math.min(times * 200, 1000);
      },
    });

    _client.on('connect', () => {
      _connected = true;
      if (process.env.NODE_ENV !== 'test') console.log('[Redis] Conectado');
    });

    _client.on('error', (err) => {
      _connected = false;
      if (process.env.NODE_ENV !== 'test') {
        console.warn('[Redis] Error (cache desactivado):', err.message);
      }
    });

    _client.on('close', () => { _connected = false; });
  }

  return _client;
}

function isConnected() {
  return _connected;
}

// Expose client for use as a rate-limit-redis store
function getRawClient() {
  return getRedis();
}

module.exports = { getRedis, isConnected, getRawClient };
