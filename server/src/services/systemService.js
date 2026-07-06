/**
 * systemService — Escala Sistema (G1 idle): meta-mapa de planetas.
 *
 * Loop: mandás la Nave a un planeta → viaje idle (travelMin) + costo →
 * al llegar se reclama → tributo pasivo por hora (reusa el cron horario).
 * Desbloqueo secuencial: la escala abre con throne_room >= SYSTEM_UNLOCK_LEVEL;
 * cada planeta pide el anterior reclamado.
 *
 * ENTRADAS principales:
 *   getSystem(playerId)          → { unlocked, unlockLevel, ship, planets[] }
 *   launchShip(playerId, planetId)
 *   distributeTribute()          → cron horario (junto al tributo de territorios)
 */
const db = require('../config/database');
const { SYSTEM_PLANETS, SYSTEM_UNLOCK_LEVEL } = require('../../../shared/gameConfig');

const byId = Object.fromEntries(SYSTEM_PLANETS.map((p) => [p.id, p]));
const order = SYSTEM_PLANETS.map((p) => p.id);

const systemService = {
  async _throneLevel(playerId) {
    const t = await db('player_buildings')
      .where({ player_id: playerId, building_id: 'throne_room' })
      .orderBy('level', 'desc')
      .first();
    return t?.level || 0;
  },

  async _claimedIds(playerId) {
    const rows = await db('player_planets').where('player_id', playerId);
    const set = new Set(rows.map((r) => r.planet_id));
    set.add('cadmion'); // mundo natal siempre reclamado
    return set;
  },

  async _getShip(playerId) {
    let ship = await db('player_ship').where('player_id', playerId).first();
    if (!ship) {
      await db('player_ship').insert({ player_id: playerId, status: 'idle' });
      ship = await db('player_ship').where('player_id', playerId).first();
    }
    return ship;
  },

  /** Reclama el planeta destino si la nave ya llegó. Idempotente. */
  async resolveArrival(playerId) {
    const ship = await this._getShip(playerId);
    if (ship.status !== 'traveling' || !ship.arrives_at) return null;
    if (ship.arrives_at > new Date().toISOString()) return null;

    const planetId = ship.target_planet;
    // Registrar reclamo (idempotente por UNIQUE)
    const exists = await db('player_planets')
      .where({ player_id: playerId, planet_id: planetId }).first();
    if (!exists) {
      await db('player_planets').insert({
        player_id: playerId, planet_id: planetId,
        claimed_at: new Date().toISOString(),
      });
    }
    await db('player_ship').where('player_id', playerId).update({
      status: 'idle', target_planet: null, arrives_at: null,
    });
    return planetId;
  },

  async getSystem(playerId) {
    await this.resolveArrival(playerId);

    const throne = await this._throneLevel(playerId);
    const unlocked = throne >= SYSTEM_UNLOCK_LEVEL;
    const claimed = await this._claimedIds(playerId);
    const ship = await this._getShip(playerId);

    const planets = SYSTEM_PLANETS.map((p, idx) => {
      const isClaimed = claimed.has(p.id);
      const prevId = idx > 0 ? order[idx - 1] : null;
      const prevClaimed = !prevId || claimed.has(prevId);
      const isTarget = ship.status === 'traveling' && ship.target_planet === p.id;
      let state;
      if (p.homeworld || isClaimed) state = 'claimed';
      else if (isTarget) state = 'traveling';
      else if (unlocked && prevClaimed && ship.status === 'idle') state = 'available';
      else state = 'locked';
      return {
        id: p.id, name: p.name, icon: p.icon, type: p.type, desc: p.desc,
        travelMin: p.travelMin, cost: p.cost, tribute: p.tribute,
        state,
        requires: prevId,
      };
    });

    return {
      unlocked,
      unlockLevel: SYSTEM_UNLOCK_LEVEL,
      throneLevel: throne,
      ship: {
        status: ship.status,
        target: ship.target_planet,
        arrivesAt: ship.arrives_at,
      },
      planets,
    };
  },

  async launchShip(playerId, planetId) {
    const planet = byId[planetId];
    if (!planet || planet.homeworld) throw new Error('Destino inválido');

    const throne = await this._throneLevel(playerId);
    if (throne < SYSTEM_UNLOCK_LEVEL) {
      throw new Error(`Necesitás Bastión de Mando nivel ${SYSTEM_UNLOCK_LEVEL} para viajar`);
    }

    const ship = await this._getShip(playerId);
    if (ship.status === 'traveling') throw new Error('La Nave ya está en tránsito');

    const claimed = await this._claimedIds(playerId);
    if (claimed.has(planetId)) throw new Error('Ya controlás ese planeta');

    const idx = order.indexOf(planetId);
    const prevId = order[idx - 1];
    if (prevId && !claimed.has(prevId)) {
      throw new Error(`Primero controlá ${byId[prevId].name}`);
    }

    // Cobrar costo de viaje (atómico por recurso)
    const playerService = require('./playerService');
    for (const [res, amount] of Object.entries(planet.cost)) {
      try {
        await playerService.modifyResource(playerId, res, -amount);
      } catch {
        throw new Error(`Necesitás ${amount} ${res} para el viaje a ${planet.name}`);
      }
    }

    const arrives = new Date(Date.now() + planet.travelMin * 60 * 1000);
    await db('player_ship').where('player_id', playerId).update({
      status: 'traveling', target_planet: planetId, arrives_at: arrives.toISOString(),
    });

    return {
      success: true,
      planet: planet.name,
      arrivesAt: arrives.toISOString(),
      travelMin: planet.travelMin,
      message: `🚀 La Nave parte hacia ${planet.name}. Llega en ${planet.travelMin} min.`,
    };
  },

  /**
   * Cron horario: cada planeta reclamado añade su tributo al dueño.
   * Se llama junto al tributo de territorios (gameTick, cada hora).
   */
  async distributeTribute() {
    const rows = await db('player_planets');
    let credited = 0;
    const playerService = require('./playerService');
    for (const row of rows) {
      const planet = byId[row.planet_id];
      if (!planet?.tribute) continue;
      for (const [res, perHour] of Object.entries(planet.tribute)) {
        await playerService.modifyResource(row.player_id, res, perHour);
      }
      credited++;
    }
    return credited;
  },
};

module.exports = systemService;
