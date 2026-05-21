/**
 * Application cache backed by Redis.
 * All functions are silent no-ops when Redis is unavailable — callers always
 * fall back to the database on a miss.
 *
 * Key conventions:
 *   leaderboard              – token leaderboard (60 s TTL)
 *   player_profile:<id>      – full profile payload (30 s TTL)
 *   player_resources:<id>    – resource map (10 s TTL)
 */
const { getRedis } = require('./redis');

async function get(key) {
  const redis = getRedis();
  if (!redis) return null;
  try {
    const raw = await redis.get(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

async function set(key, value, ttlSeconds = 60) {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  } catch { /* noop — DB is the source of truth */ }
}

async function del(...keys) {
  const redis = getRedis();
  if (!redis) return;
  try {
    if (keys.length > 0) await redis.del(...keys);
  } catch { /* noop */ }
}

// Invalidate all keys matching a pattern (e.g. "player_*").
// Use sparingly — SCAN has O(n) cost.
async function invalidatePattern(pattern) {
  const redis = getRedis();
  if (!redis) return;
  try {
    let cursor = '0';
    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;
      if (keys.length > 0) await redis.del(...keys);
    } while (cursor !== '0');
  } catch { /* noop */ }
}

module.exports = { get, set, del, invalidatePattern };
