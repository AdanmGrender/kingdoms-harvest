const db = require('../config/database');
const { STARTER_RESOURCES, BUILDINGS, FACTIONS } = require('../../../shared/gameConfig');
const { sanitizeDisplayText } = require('../utils/sanitize');

// Lazy-loaded to avoid circular dependencies
let _tokenService = null;
let _dailyTaskService = null;
let _referralService = null;
function getTokenService() { if (!_tokenService) _tokenService = require('./tokenService'); return _tokenService; }
function getDailyTaskService() { if (!_dailyTaskService) _dailyTaskService = require('./dailyTaskService'); return _dailyTaskService; }
function getReferralService() { if (!_referralService) _referralService = require('./referralService'); return _referralService; }

const playerService = {
  /**
   * Inicializa un jugador nuevo o retorna el existente
   */
  async initPlayer(telegramId, userData = {}, referralCode = null) {
    let player = await db('players').where('telegram_id', telegramId).first();

    if (!player) {
      // Crear jugador nuevo
      await db('players').insert({
        telegram_id: telegramId,
        username: userData.username || null,
        first_name: sanitizeDisplayText(userData.first_name, 50) || 'Aventurero',
        display_name: sanitizeDisplayText(userData.first_name, 50) || 'Aventurero',
        level: 1,
        xp: 0,
        created_at: new Date().toISOString(),
      });

      // Dar recursos iniciales
      for (const [resourceId, amount] of Object.entries(STARTER_RESOURCES)) {
        await db('player_resources').insert({
          player_id: telegramId,
          resource_id: resourceId,
          amount,
          capacity: 1000,
        });
      }

      // Dar edificios iniciales: Salón del Trono lvl 1 + 2 Parcelas + 1 Granero
      // Positions are in tile coordinates, centered around spawn area (80,62)
      const starterBuildings = [
        { building_id: 'throne_room', level: 1, position_x: 78, position_y: 60 },
        { building_id: 'farm_plot', level: 1, position_x: 74, position_y: 64 },
        { building_id: 'farm_plot', level: 1, position_x: 77, position_y: 64 },
        { building_id: 'barn', level: 1, position_x: 82, position_y: 60 },
      ];

      for (const b of starterBuildings) {
        const [{ id: buildingId }] = await db('player_buildings').insert({
          player_id: telegramId,
          building_id: b.building_id,
          level: b.level,
          is_building: false,
          position_x: b.position_x,
          position_y: b.position_y,
        }).returning('id');

        // Crear farm plots para las parcelas
        if (b.building_id === 'farm_plot') {
          await db('farm_plots').insert({
            player_id: telegramId,
            building_id: buildingId,
            state: 'empty',
          });
        }
      }

      // Inicializar token record
      await getTokenService().ensureTokenRecord(telegramId);

      // Procesar referido si hay codigo
      if (referralCode) {
        try {
          const inviterId = String(referralCode).replace('ref_', '');
          await getReferralService().processReferral(inviterId, telegramId);
        } catch {
          // Ignore referral errors silently
        }
      }

      player = await db('players').where('telegram_id', telegramId).first();
    } else {
      // Actualizar último login
      await db('players').where('telegram_id', telegramId).update({
        last_login: new Date().toISOString(),
      });
    }

    // Actualizar streak y trackear login (para todos los logins, no solo nuevos)
    try {
      await getTokenService().ensureTokenRecord(telegramId);
      await getDailyTaskService().updateLoginStreak(telegramId);
      await getDailyTaskService().trackProgress(telegramId, 'login');
    } catch {
      // Non-critical, don't block login
    }

    return this.getFullProfile(telegramId);
  },

  /**
   * Perfil completo con recursos, edificios, etc
   */
  async getFullProfile(playerId) {
    const player = await db('players').where('telegram_id', playerId).first();
    if (!player) return null;

    const resources = await db('player_resources').where('player_id', playerId);
    const buildings = await db('player_buildings').where('player_id', playerId);
    const troops = await db('player_troops').where('player_id', playerId);
    const animals = await db('player_animals').where('player_id', playerId);
    const activeMissions = await db('missions')
      .where('player_id', playerId)
      .whereIn('status', ['available', 'accepted']);

    // Token info
    const tokenData = await db('player_tokens').where('player_id', playerId).first();

    // Mapear recursos a objeto
    const resourceMap = {};
    resources.forEach((r) => {
      resourceMap[r.resource_id] = { amount: r.amount, capacity: r.capacity };
    });

    return {
      ...player,
      resources: resourceMap,
      buildings,
      troops,
      animals,
      activeMissions,
      tokenBalance: tokenData?.balance || 0,
    };
  },

  async getResources(playerId) {
    const resources = await db('player_resources').where('player_id', playerId);
    const resourceMap = {};
    resources.forEach((r) => {
      resourceMap[r.resource_id] = { amount: r.amount, capacity: r.capacity };
    });
    return resourceMap;
  },

  /**
   * Modificar recursos (añadir o restar).
   * Para restas, usa operación atómica que verifica saldo suficiente.
   * Lanza error si no hay suficiente recurso.
   */
  async modifyResource(playerId, resourceId, delta) {
    let resource = await db('player_resources')
      .where({ player_id: playerId, resource_id: resourceId })
      .first();

    if (!resource) {
      if (delta < 0) {
        throw new Error(`No tenés suficiente ${resourceId}`);
      }
      await db('player_resources').insert({
        player_id: playerId,
        resource_id: resourceId,
        amount: delta,
        capacity: 1000,
      });
      return delta;
    }

    if (delta < 0) {
      // Operación atómica: resta solo si hay suficiente
      const affected = await db('player_resources')
        .where({ player_id: playerId, resource_id: resourceId })
        .decrementIfEnough('amount', Math.abs(delta));

      if (affected === 0) {
        throw new Error(`No tenés suficiente ${resourceId}`);
      }
      // Clamp: si quedó negativo por algún edge case, corregir
      return resource.amount + delta;
    }

    // Single atomic SQL: increment and clamp to capacity in one statement
    await db.raw(
      `UPDATE "player_resources" SET "amount" = LEAST("amount" + ?, "capacity")
       WHERE "player_id" = ? AND "resource_id" = ?`,
      [delta, playerId, resourceId]
    );

    return Math.min(resource.amount + delta, resource.capacity);
  },

  /**
   * Añadir XP y verificar subida de nivel
   */
  async addXP(playerId, amount) {
    const player = await db('players').where('telegram_id', playerId).first();
    if (!player) throw new Error('Jugador no encontrado');
    const { LEVEL_XP_TABLE } = require('../../../shared/gameConfig');

    let newXP = player.xp + amount;
    let newLevel = player.level;

    // Verificar subida de nivel
    while (newLevel < 50) {
      const nextLevelXP = LEVEL_XP_TABLE[newLevel]?.xpRequired || Infinity;
      if (newXP >= nextLevelXP) {
        newXP -= nextLevelXP;
        newLevel++;
      } else {
        break;
      }
    }

    await db('players').where('telegram_id', playerId).update({
      xp: newXP,
      level: newLevel,
    });

    return { level: newLevel, xp: newXP, leveledUp: newLevel > player.level };
  },

  async joinFaction(playerId, factionId) {
    if (!FACTIONS[factionId]) {
      throw new Error('Facción no válida');
    }

    const player = await db('players').where('telegram_id', playerId).first();
    if (!player) throw new Error('Jugador no encontrado');
    if (player.faction_id) {
      throw new Error('Ya pertenecés a una facción');
    }

    // Verificar que tiene embajada
    const embassy = await db('player_buildings')
      .where({ player_id: playerId, building_id: 'embassy' })
      .first();

    if (!embassy) {
      throw new Error('Necesitás construir una Embajada primero');
    }

    await db('players').where('telegram_id', playerId).update({
      faction_id: factionId,
      faction_points: 0,
    });

    await db('factions').where('id', factionId).increment('total_members', 1);

    return { success: true, faction: FACTIONS[factionId] };
  },

  async getLeaderboard() {
    return db('players')
      .select('display_name', 'level', 'xp', 'faction_id')
      .orderBy('level', 'desc')
      .orderBy('xp', 'desc')
      .limit(50);
  },
};

module.exports = playerService;
