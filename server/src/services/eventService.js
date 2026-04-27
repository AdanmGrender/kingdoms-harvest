/**
 * Seasonal events — single-active server-wide buff that rotates through
 * SEASONAL_EVENT_ROTATION on a fixed cadence.
 *
 * gameTick calls `tick()` every minute. The first call after server boot
 * (or after the active event's window passes) flips the expired row off
 * and inserts the next rotation entry as the new active event.
 *
 * Read-side helpers (`getActive`, `getMultiplier`) are cached for 60s in
 * memory so hot paths (every harvest, every sale, every battle) don't
 * re-query the DB each call.
 */
const db = require('../config/database');
const {
  SEASONAL_EVENTS,
  SEASONAL_EVENT_ROTATION,
} = require('../../../shared/gameConfig');

const CACHE_TTL_MS = 60 * 1000;
let cachedActive = null;
let cachedAt = 0;

const eventService = {
  /**
   * Read the currently active event row, joined with its catalog entry.
   * Returns null if nothing is active (e.g. fresh DB before first tick).
   */
  async getActive() {
    if (cachedActive && Date.now() - cachedAt < CACHE_TTL_MS) {
      return cachedActive;
    }
    const row = await db('seasonal_events')
      .where('is_active', 1)
      .orderBy('id', 'desc')
      .first();
    if (!row) {
      cachedActive = null;
      cachedAt = Date.now();
      return null;
    }
    const catalog = SEASONAL_EVENTS[row.event_id];
    cachedActive = catalog ? {
      ...catalog,
      starts_at: row.starts_at,
      ends_at: row.ends_at,
      row_id: row.id,
    } : null;
    cachedAt = Date.now();
    return cachedActive;
  },

  /**
   * Convenience for hot paths — returns the additive bonus for a given
   * multiplier key (farming, commerce, battle_loot, kh_bonus). 0 if no
   * active event or no matching key.
   */
  async getMultiplier(key) {
    const active = await this.getActive();
    return active?.multipliers?.[key] || 0;
  },

  /** Invalidate the in-process cache (called after rotate). */
  _invalidate() { cachedActive = null; cachedAt = 0; },

  /**
   * Pick the next event id in the rotation after `currentId`. Wraps.
   * If currentId is null, returns the first rotation entry.
   */
  _nextEventId(currentId) {
    if (!currentId || !SEASONAL_EVENT_ROTATION.includes(currentId)) {
      return SEASONAL_EVENT_ROTATION[0];
    }
    const idx = SEASONAL_EVENT_ROTATION.indexOf(currentId);
    return SEASONAL_EVENT_ROTATION[(idx + 1) % SEASONAL_EVENT_ROTATION.length];
  },

  /**
   * gameTick hook — closes any expired active row and starts the next
   * event in the rotation. Idempotent: returns the active row's id
   * after running, even if no rotation happened.
   */
  async tick() {
    const now = new Date();
    const nowIso = now.toISOString();

    // 1) Close expired active rows (defensive — usually only one is active)
    await db('seasonal_events')
      .where('is_active', 1)
      .where('ends_at', '<=', nowIso)
      .update({ is_active: 0 });

    // 2) If something is still active, nothing to do
    const stillActive = await db('seasonal_events').where('is_active', 1).first();
    if (stillActive) return stillActive.id;

    // 3) Otherwise, schedule the next event
    const lastEvent = await db('seasonal_events').orderBy('id', 'desc').first();
    const nextId = this._nextEventId(lastEvent?.event_id);
    const config = SEASONAL_EVENTS[nextId];
    if (!config) return null;

    const ends = new Date(now.getTime() + config.durationMs);
    const [newRowId] = await db('seasonal_events').insert({
      event_id: nextId,
      starts_at: nowIso,
      ends_at: ends.toISOString(),
      is_active: 1,
    });

    this._invalidate();
    return newRowId;
  },
};

module.exports = eventService;
