/**
 * stormService — Tormentas Disformes (F2 idle): sucesos aleatorios globales.
 *
 * Modelo (espejo de eventService, pero ALEATORIO en vez de rotación fija):
 *  - Sin tormenta activa, cada tick (1 min) tira un dado con probabilidad
 *    1/mediaEnMinutos → media de una tormenta cada STORM_MEAN_GAP_MS (~4h).
 *    'calma_falsa' deja hasten_next=1 y la media se reduce a la mitad.
 *  - Tipo elegido por peso (weight); intensidad 1-3 escala modificadores y
 *    duración. Duración base aleatoria dentro de durationMs [min,max].
 *  - getModifier(key) cacheado 60s para hot paths, sumado a los multipliers
 *    de eventService en los MISMOS call sites.
 *  - convoysSealed(): guard para commerceService.
 *
 * ENTRADA/SALIDA principales:
 *   tick(io?)            → programa/cierra tormentas; push socket global
 *   getActive()          → tormenta activa con catálogo | null
 *   getModifier(key)     → delta aditivo (0 si no hay tormenta)
 *   convoysSealed()      → boolean
 *   forceStorm(type, minutes?) → arranca una tormenta (dev/tests/admin)
 */
const db = require('../config/database');
const { WARP_STORMS, STORM_MEAN_GAP_MS } = require('../../../shared/gameConfig');

const CACHE_TTL_MS = 60 * 1000;
let cachedActive = null;
let cachedAt = 0;

function pickWeighted(rand = Math.random) {
  const entries = Object.values(WARP_STORMS);
  const total = entries.reduce((s, e) => s + (e.weight || 1), 0);
  let roll = rand() * total;
  for (const e of entries) {
    roll -= e.weight || 1;
    if (roll <= 0) return e;
  }
  return entries[entries.length - 1];
}

const stormService = {
  _invalidate() { cachedActive = null; cachedAt = 0; },

  async getActive() {
    if (cachedActive !== null && Date.now() - cachedAt < CACHE_TTL_MS) {
      return cachedActive || null;
    }
    const row = await db('warp_storms')
      .where('is_active', 1)
      .orderBy('id', 'desc')
      .first();

    if (!row || row.ends_at <= new Date().toISOString()) {
      cachedActive = false; // false = "consultado, no hay" (vs null = sin caché)
      cachedAt = Date.now();
      return null;
    }
    const catalog = WARP_STORMS[row.storm_type];
    cachedActive = catalog ? {
      ...catalog,
      intensity: row.intensity,
      modifiers: JSON.parse(row.modifiers || '{}'),
      started_at: row.started_at,
      ends_at: row.ends_at,
      row_id: row.id,
    } : false;
    cachedAt = Date.now();
    return cachedActive || null;
  },

  /** Delta aditivo del modificador `key` (0 sin tormenta). */
  async getModifier(key) {
    const active = await this.getActive();
    return active?.modifiers?.[key] || 0;
  },

  /** ¿El comercio de convoyes está sellado por la tormenta? */
  async convoysSealed() {
    const active = await this.getActive();
    return !!(active && WARP_STORMS[active.id]?.sealsConvoys);
  },

  /**
   * Arranca una tormenta concreta YA (dev/tests + hook de spawn de F3).
   * intensity escala modificadores (×1, ×1.5, ×2) y duración.
   */
  async forceStorm(stormType, { intensity = 1, durationMin = null, io = null } = {}) {
    const catalog = WARP_STORMS[stormType];
    if (!catalog) throw new Error('Tormenta desconocida');

    // Cerrar cualquier activa (solo una a la vez)
    await db('warp_storms').where('is_active', 1).update({ is_active: 0 });

    const [minD, maxD] = catalog.durationMs;
    const minutes = durationMin ?? (minD + Math.random() * (maxD - minD)) * (1 + (intensity - 1) * 0.5);
    const scale = 1 + (intensity - 1) * 0.5;
    const modifiers = {};
    for (const [k, v] of Object.entries(catalog.modifiers || {})) {
      modifiers[k] = Math.round(v * scale * 100) / 100;
    }

    const now = new Date();
    const [rowId] = await db('warp_storms').insert({
      storm_type: stormType,
      intensity,
      modifiers: JSON.stringify(modifiers),
      started_at: now.toISOString(),
      ends_at: new Date(now.getTime() + minutes * 60 * 1000).toISOString(),
      is_active: 1,
      hasten_next: catalog.hastensNext ? 1 : 0,
    });
    this._invalidate();

    const active = await this.getActive();
    if (io && active) io.emit('storm_started', active);

    // Aviso por bot (best-effort, no bloquea)
    try {
      const notificationService = require('./notificationService');
      const players = await db('players').select('telegram_id');
      const scaled = intensity > 1 ? ` (intensidad ${intensity})` : '';
      notificationService.notifyBatch(
        players.map((p) => p.telegram_id),
        'events',
        `${catalog.icon} ¡${catalog.name}${scaled}! ${catalog.description}`,
      ).catch(() => {});
    } catch { /* bot apagado */ }

    return { rowId, stormType, intensity, minutes: Math.round(minutes) };
  },

  /**
   * Hook del gameTick (cada minuto): cierra tormentas vencidas y, si no hay
   * activa, tira el dado de aparición.
   */
  async tick(io = null) {
    const nowIso = new Date().toISOString();

    // 1) Cerrar vencidas (y avisar el fin)
    const expired = await db('warp_storms')
      .where('is_active', 1)
      .where('ends_at', '<=', nowIso);
    if (expired.length > 0) {
      await db('warp_storms')
        .where('is_active', 1)
        .where('ends_at', '<=', nowIso)
        .update({ is_active: 0 });
      this._invalidate();
      if (io) io.emit('storm_ended', { storm_type: expired[0].storm_type });
    }

    // 2) ¿Sigue una activa? nada que hacer
    const active = await this.getActive();
    if (active) return null;

    // 3) Dado de aparición — media 1/STORM_MEAN_GAP_MS; 'calma_falsa'
    //    reciente reduce la media a la mitad
    const last = await db('warp_storms').orderBy('id', 'desc').first();
    const meanMs = last?.hasten_next ? STORM_MEAN_GAP_MS / 2 : STORM_MEAN_GAP_MS;
    const perTickChance = 60 * 1000 / meanMs; // ticks de 1 min

    if (Math.random() >= perTickChance) return null;

    // 4) ¡Tormenta! — tipo por peso, intensidad sesgada a 1
    const type = pickWeighted();
    const roll = Math.random();
    const intensity = roll < 0.6 ? 1 : roll < 0.9 ? 2 : 3;
    const started = await this.forceStorm(type.id, { intensity, io });
    console.log(`[Storm] ${type.name} (i${intensity}) por ${started.minutes} min`);

    // 5) F3 hook: la Marea Carmesí trae horrores — run de defensa gratis
    if (type.spawnsWave) {
      try {
        await require('./waveDefenseService').grantFreeRuns();
      } catch (e) {
        console.error('[Storm] Error otorgando runs gratis:', e.message);
      }
    }
    return started;
  },
};

module.exports = stormService;
