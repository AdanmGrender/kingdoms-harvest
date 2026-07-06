/**
 * galaxyService — Escala Galaxia (G2 idle): surcar la Disformidad.
 *
 * Espejo de systemService una escala más arriba. Se abre al DOMINAR la escala
 * Sistema (todos los planetas no-natales reclamados). El Crucero Disforme
 * viaja HORAS entre sistemas; si hay una Tormenta Disforme activa al zarpar,
 * la travesía es turbulenta y tarda WARP_TURBULENCE_MULT más.
 *
 * ENTRADAS:
 *   getGalaxy(playerId)          → { unlocked, warp, systems[] }
 *   launchWarp(playerId, systemId)
 *   resolveWarpArrival(playerId)
 *   distributeTribute()          → cron horario
 */
const db = require('../config/database');
const {
  GALAXY_SYSTEMS, WARP_TURBULENCE_MULT, SYSTEM_PLANETS,
} = require('../../../shared/gameConfig');

const byId = Object.fromEntries(GALAXY_SYSTEMS.map((s) => [s.id, s]));
const order = GALAXY_SYSTEMS.map((s) => s.id);
const NON_HOME_PLANETS = SYSTEM_PLANETS.filter((p) => !p.homeworld).length;

const galaxyService = {
  /** La escala Galaxia abre al reclamar TODOS los planetas del Sistema. */
  async _systemMastered(playerId) {
    const rows = await db('player_planets').where('player_id', playerId);
    const claimed = new Set(rows.map((r) => r.planet_id));
    let count = 0;
    for (const p of SYSTEM_PLANETS) {
      if (!p.homeworld && claimed.has(p.id)) count++;
    }
    return count >= NON_HOME_PLANETS;
  },

  async _claimedIds(playerId) {
    const rows = await db('player_systems').where('player_id', playerId);
    const set = new Set(rows.map((r) => r.system_id));
    set.add('natal'); // sistema natal siempre reclamado
    return set;
  },

  async _getWarp(playerId) {
    let w = await db('player_warp').where('player_id', playerId).first();
    if (!w) {
      await db('player_warp').insert({ player_id: playerId, status: 'idle' });
      w = await db('player_warp').where('player_id', playerId).first();
    }
    return w;
  },

  /** Reclama el sistema destino si el Crucero ya llegó. Idempotente. */
  async resolveWarpArrival(playerId) {
    const w = await this._getWarp(playerId);
    if (w.status !== 'traveling' || !w.arrives_at) return null;
    if (w.arrives_at > new Date().toISOString()) return null;

    const systemId = w.target_system;
    const exists = await db('player_systems')
      .where({ player_id: playerId, system_id: systemId }).first();
    if (!exists) {
      await db('player_systems').insert({
        player_id: playerId, system_id: systemId,
        claimed_at: new Date().toISOString(),
      });
    }
    await db('player_warp').where('player_id', playerId).update({
      status: 'idle', target_system: null, arrives_at: null, turbulent: 0,
    });
    return systemId;
  },

  async getGalaxy(playerId) {
    await this.resolveWarpArrival(playerId);

    const unlocked = await this._systemMastered(playerId);
    const claimed = await this._claimedIds(playerId);
    const warp = await this._getWarp(playerId);

    const systems = GALAXY_SYSTEMS.map((s, idx) => {
      const isClaimed = claimed.has(s.id);
      const prevId = idx > 0 ? order[idx - 1] : null;
      const prevClaimed = !prevId || claimed.has(prevId);
      const isTarget = warp.status === 'traveling' && warp.target_system === s.id;
      let state;
      if (s.homeSystem || isClaimed) state = 'claimed';
      else if (isTarget) state = 'traveling';
      else if (unlocked && prevClaimed && warp.status === 'idle') state = 'available';
      else state = 'locked';
      return {
        id: s.id, name: s.name, icon: s.icon, type: s.type, desc: s.desc,
        warpMin: s.warpMin, cost: s.cost, tribute: s.tribute,
        state, requires: prevId,
      };
    });

    return {
      unlocked,
      warp: {
        status: warp.status,
        target: warp.target_system,
        arrivesAt: warp.arrives_at,
        turbulent: !!warp.turbulent,
      },
      systems,
    };
  },

  async launchWarp(playerId, systemId) {
    const sys = byId[systemId];
    if (!sys || sys.homeSystem) throw new Error('Destino inválido');

    if (!(await this._systemMastered(playerId))) {
      throw new Error('Primero controlá todos los planetas de tu sistema natal');
    }

    const warp = await this._getWarp(playerId);
    if (warp.status === 'traveling') throw new Error('El Crucero ya surca la Disformidad');

    const claimed = await this._claimedIds(playerId);
    if (claimed.has(systemId)) throw new Error('Ya controlás ese sistema');

    const idx = order.indexOf(systemId);
    const prevId = order[idx - 1];
    if (prevId && !claimed.has(prevId)) {
      throw new Error(`Primero controlá ${byId[prevId].name}`);
    }

    // Cobrar costo de la travesía
    const playerService = require('./playerService');
    for (const [res, amount] of Object.entries(sys.cost)) {
      try {
        await playerService.modifyResource(playerId, res, -amount);
      } catch {
        throw new Error(`Necesitás ${amount} ${res} para surcar hacia ${sys.name}`);
      }
    }

    // Turbulencia: si hay Tormenta Disforme activa, la travesía tarda más
    let turbulent = false;
    try {
      const storm = await require('./stormService').getActive();
      if (storm) turbulent = true;
    } catch { /* stormService puede faltar en algún contexto */ }

    const mult = turbulent ? WARP_TURBULENCE_MULT : 1;
    const arrives = new Date(Date.now() + sys.warpMin * mult * 60 * 1000);
    await db('player_warp').where('player_id', playerId).update({
      status: 'traveling', target_system: systemId,
      arrives_at: arrives.toISOString(), turbulent: turbulent ? 1 : 0,
    });

    return {
      success: true,
      system: sys.name,
      arrivesAt: arrives.toISOString(),
      warpMin: Math.round(sys.warpMin * mult),
      turbulent,
      message: turbulent
        ? `🌀 El Crucero entra en una Disformidad turbulenta hacia ${sys.name}. Travesía extendida.`
        : `🌀 El Crucero surca la Disformidad hacia ${sys.name}.`,
    };
  },

  /** Cron horario: cada sistema reclamado añade su tributo al dueño. */
  async distributeTribute() {
    const rows = await db('player_systems');
    let credited = 0;
    const playerService = require('./playerService');
    for (const row of rows) {
      const sys = byId[row.system_id];
      if (!sys?.tribute) continue;
      for (const [res, perHour] of Object.entries(sys.tribute)) {
        await playerService.modifyResource(row.player_id, res, perHour);
      }
      credited++;
    }
    return credited;
  },
};

module.exports = galaxyService;
