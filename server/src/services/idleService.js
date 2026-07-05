/**
 * idleService — capa idle F1: reporte offline "Mientras no estabas".
 *
 * Modelo:
 *  - La producción de edificios YA acumula server-side (gameTick, por minuto)
 *    mientras el server corre → el reporte es un RESUMEN (delta vs snapshot
 *    del login anterior), no un premio doble.
 *  - Si el server estuvo CAÍDO durante la ausencia (registrado en
 *    server_downtime por recordBootGap), se acredita catch-up con las MISMAS
 *    tasas del gameTick (ratePerHour × (1 + (nivel−1)×0.25)), cap 12 horas.
 *
 * ENTRADA:  buildOfflineReport(playerId)
 * SALIDA:   null (primer login / ausencia corta) |
 *           { awayMs, resources: {id: delta}, khEarned, catchUp: {id: n},
 *             events: [{icon, text}] }
 */
const db = require('../config/database');
const { BUILDINGS } = require('../../../shared/gameConfig');

const MIN_AWAY_MS = 5 * 60 * 1000;          // ausencias < 5 min no generan reporte
const OFFLINE_CAP_MS = 12 * 60 * 60 * 1000; // cap de producción offline: 12h
const HEARTBEAT_GAP_MS = 2 * 60 * 1000;     // gap > 2 min ⇒ el server estuvo caído

const idleService = {
  /**
   * Llamar cada tick del gameTick: persiste el último instante "vivo" del server.
   */
  async recordHeartbeat() {
    const now = new Date().toISOString();
    const affected = await db('server_heartbeat').where('id', 1).update({ last_tick_at: now });
    if (!affected) {
      await db('server_heartbeat').insert({ id: 1, last_tick_at: now });
    }
  },

  /**
   * Llamar UNA vez al arrancar el server (antes del primer tick): si el
   * heartbeat quedó viejo, registra el periodo de caída para el catch-up.
   */
  async recordBootGap() {
    const hb = await db('server_heartbeat').where('id', 1).first();
    if (!hb) return null;
    const gapMs = Date.now() - new Date(hb.last_tick_at).getTime();
    if (gapMs <= HEARTBEAT_GAP_MS) return null;

    const downtime = {
      started_at: hb.last_tick_at,
      ended_at: new Date().toISOString(),
    };
    await db('server_downtime').insert(downtime);
    return downtime;
  },

  /**
   * Tasas de producción por hora del jugador (misma fórmula que gameTick §2b).
   */
  async computeHourlyRates(playerId) {
    const buildings = await db('player_buildings')
      .where({ player_id: playerId, is_building: false });

    const rates = {};
    for (const b of buildings) {
      const config = BUILDINGS[b.building_id];
      if (!config?.produces) continue;
      const levelMultiplier = 1 + (b.level - 1) * 0.25;
      for (const [resource, ratePerHour] of Object.entries(config.produces)) {
        rates[resource] = (rates[resource] || 0) + ratePerHour * levelMultiplier;
      }
    }
    return rates;
  },

  /**
   * Milisegundos de caída del server dentro de la ventana [desde, hasta].
   */
  async downtimeWithin(fromIso, toIso) {
    const rows = await db('server_downtime').where('ended_at', '>', fromIso);
    let total = 0;
    const from = new Date(fromIso).getTime();
    const to = new Date(toIso).getTime();
    for (const r of rows) {
      const s = Math.max(new Date(r.started_at).getTime(), from);
      const e = Math.min(new Date(r.ended_at).getTime(), to);
      if (e > s) total += e - s;
    }
    return total;
  },

  async _snapshotNow(playerId) {
    const resources = await db('player_resources').where('player_id', playerId);
    const resMap = {};
    for (const r of resources) resMap[r.resource_id] = r.amount;
    const tokens = await db('player_tokens').where('player_id', playerId).first();
    return {
      player_id: playerId,
      resources: JSON.stringify(resMap),
      kh_balance: tokens?.balance || 0,
      created_at: new Date().toISOString(),
    };
  },

  async _writeSnapshot(snapshot) {
    const affected = await db('login_snapshots')
      .where('player_id', snapshot.player_id)
      .update({
        resources: snapshot.resources,
        kh_balance: snapshot.kh_balance,
        created_at: snapshot.created_at,
      });
    if (!affected) await db('login_snapshots').insert(snapshot);
  },

  /**
   * Núcleo del F1: construir (y aplicar) el reporte offline del jugador.
   */
  async buildOfflineReport(playerId) {
    const prev = await db('login_snapshots').where('player_id', playerId).first();
    const current = await this._snapshotNow(playerId);

    // Primer login con snapshots: crear baseline, sin reporte
    if (!prev) {
      await this._writeSnapshot(current);
      return null;
    }

    const awayMs = new Date(current.created_at) - new Date(prev.created_at);
    if (awayMs < MIN_AWAY_MS) {
      // Ausencia corta: refrescar baseline sin molestar con un modal
      await this._writeSnapshot(current);
      return null;
    }

    // 1) Catch-up por caída del server (acreditar ANTES de medir el delta)
    const catchUp = {};
    const downMs = await this.downtimeWithin(prev.created_at, current.created_at);
    if (downMs > HEARTBEAT_GAP_MS) {
      const cappedMs = Math.min(downMs, OFFLINE_CAP_MS);
      const hours = cappedMs / 3600000;
      const rates = await this.computeHourlyRates(playerId);
      for (const [resource, perHour] of Object.entries(rates)) {
        const amount = Math.floor(perHour * hours);
        if (amount <= 0) continue;
        // Mismo camino atómico con cap de capacidad que usa el gameTick
        const result = await db.raw(
          'UPDATE "player_resources" SET "amount" = MIN("amount" + ?, "capacity") WHERE "player_id" = ? AND "resource_id" = ?',
          [amount, playerId, resource]
        );
        if (!result || result.count === 0) {
          try {
            await db('player_resources').insert({
              player_id: playerId, resource_id: resource, amount, capacity: 1000,
            });
          } catch { /* fila creada por otro camino */ }
        }
        catchUp[resource] = amount;
      }
    }

    // 2) Delta de recursos y KH vs snapshot anterior (incluye el catch-up)
    const after = await this._snapshotNow(playerId);
    const prevRes = JSON.parse(prev.resources || '{}');
    const afterRes = JSON.parse(after.resources);
    const resources = {};
    for (const [id, amount] of Object.entries(afterRes)) {
      const delta = amount - (prevRes[id] || 0);
      if (delta > 0) resources[id] = delta;
    }
    const khEarned = Math.max(0, (after.kh_balance || 0) - (prev.kh_balance || 0));

    // 3) Eventos resueltos durante la ausencia (queries baratas por timestamp)
    const events = [];
    const readyPlots = await db('farm_plots')
      .where({ player_id: playerId, state: 'growing' });
    // Un plot "growing" con harvest vencida cuenta como listo (farmService usa
    // planted_at + growthTime; aquí basta el conteo aproximado por estado)
    if (readyPlots.length > 0) {
      events.push({ icon: '🌾', text: `${readyPlots.length} cultivo(s) esperando cosecha` });
    }
    const research = await db('player_research')
      .where('player_id', playerId)
      .where('completed_at', '>', prev.created_at);
    if (research.length > 0) {
      events.push({ icon: '🔬', text: `${research.length} investigación(es) completada(s)` });
    }
    const sieges = await db('sieges')
      .where('attacker_id', playerId)
      .where('resolved_at', '>', prev.created_at);
    if (sieges.length > 0) {
      events.push({ icon: '💥', text: `${sieges.length} asedio(s) resuelto(s)` });
    }
    const defenses = await db('battles')
      .where('defender_id', playerId)
      .where('created_at', '>', prev.created_at);
    if (defenses.length > 0) {
      events.push({ icon: '🛡️', text: `Tu bastión fue atacado ${defenses.length} vez/veces` });
    }

    // 4) Nuevo baseline
    await this._writeSnapshot(after);

    const hasContent = Object.keys(resources).length > 0 || khEarned > 0 || events.length > 0;
    if (!hasContent) return null;

    return {
      awayMs,
      resources,
      khEarned: Math.round(khEarned * 100) / 100,
      catchUp,
      downtimeMs: downMs,
      events,
    };
  },
};

module.exports = idleService;
