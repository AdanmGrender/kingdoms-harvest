const db = require('../config/database');
const { BUILDINGS } = require('../../../shared/gameConfig');
const playerService = require('./playerService');
let _achievementService = null;
function getAchievementService() { if (!_achievementService) _achievementService = require('./achievementService'); return _achievementService; }

const buildingService = {
  async getBuildings(playerId) {
    return db('player_buildings').where('player_id', playerId);
  },

  /**
   * Calcula el coste de un edificio para un nivel dado
   */
  calculateCost(buildingId, level) {
    const building = BUILDINGS[buildingId];
    if (!building) throw new Error('Edificio no válido');

    const cost = {};
    for (const [resource, baseCost] of Object.entries(building.baseCost)) {
      cost[resource] = Math.floor(baseCost * Math.pow(building.costMultiplier, level - 1));
    }

    const buildTime = Math.floor(
      building.buildTime * Math.pow(building.buildTimeMultiplier, level - 1)
    );

    return { cost, buildTime, level };
  },

  /**
   * Construir un edificio nuevo en posición específica del mapa
   */
  async buildNew(playerId, buildingId, posX, posY) {
    const building = BUILDINGS[buildingId];
    if (!building) throw new Error('Edificio no válido');

    if (posX == null || posY == null) {
      throw new Error('Se requiere posición (posX, posY) para colocar el edificio');
    }

    // Verificar nivel del castillo (throne_room) para desbloqueos
    // Only count throne_rooms that are fully built (is_building: false)
    const throneRoom = await db('player_buildings')
      .where({ player_id: playerId, building_id: 'throne_room', is_building: false })
      .first();

    const castleLevel = throneRoom ? throneRoom.level : 0;

    const zoneRequirements = {
      agricultural: 1,
      defensive: 2,
      social: 3,
      noble: 1,
    };

    if (castleLevel < (zoneRequirements[building.zone] ?? 99)) {
      throw new Error(
        `Necesitás Salón del Trono nivel ${zoneRequirements[building.zone]} para construir en zona ${building.zone}`
      );
    }

    // Verificar que no hay otra construcción en progreso (solo 1 construcción simultánea)
    const inProgress = await db('player_buildings')
      .where({ player_id: playerId, is_building: true })
      .first();
    if (inProgress) {
      throw new Error('Ya tenés un edificio en construcción. Esperá que termine antes de construir otro.');
    }

    // Validate no overlap with existing buildings
    const tileW = building.tileWidth || 2;
    const tileH = building.tileHeight || 2;
    await this.validatePlacement(playerId, posX, posY, tileW, tileH);

    // Calcular y cobrar costes
    const { cost, buildTime } = this.calculateCost(buildingId, 1);
    await this.payResources(playerId, cost);

    const now = new Date();
    const completeAt = new Date(now.getTime() + buildTime);

    await db('player_buildings').insert({
      player_id: playerId,
      building_id: buildingId,
      level: 1,
      is_building: true,
      build_complete_at: completeAt.toISOString(),
      position_x: posX,
      position_y: posY,
    });

    try { await getAchievementService().checkAndUnlock(playerId, 'build', 1); } catch { /* non-blocking */ }

    return {
      success: true,
      buildingId,
      posX,
      posY,
      buildTime,
      completeAt: completeAt.toISOString(),
      message: `Construyendo ${building.icon} ${building.name}... Listo en ${Math.round(buildTime / 60000)} minutos.`,
    };
  },

  /**
   * Validate that a building can be placed at (posX, posY) without overlapping others
   */
  async validatePlacement(playerId, posX, posY, tileW, tileH) {
    const existingBuildings = await db('player_buildings').where('player_id', playerId);

    for (const existing of existingBuildings) {
      const existingConfig = BUILDINGS[existing.building_id];
      const ew = existingConfig?.tileWidth || 2;
      const eh = existingConfig?.tileHeight || 2;
      const ex = existing.position_x;
      const ey = existing.position_y;

      // AABB overlap check
      if (
        posX < ex + ew &&
        posX + tileW > ex &&
        posY < ey + eh &&
        posY + tileH > ey
      ) {
        throw new Error('No se puede construir aquí, hay otro edificio en esa posición');
      }
    }
  },

  /**
   * Mejorar un edificio existente
   */
  async upgrade(playerId, buildingDbId) {
    const playerBuilding = await db('player_buildings')
      .where({ id: buildingDbId, player_id: playerId })
      .first();

    if (!playerBuilding) throw new Error('Edificio no encontrado');
    if (playerBuilding.is_building) throw new Error('El edificio está en construcción');

    const building = BUILDINGS[playerBuilding.building_id];
    const nextLevel = playerBuilding.level + 1;

    if (nextLevel > building.maxLevel) {
      throw new Error(`${building.name} ya está al nivel máximo (${building.maxLevel})`);
    }

    // Verificar que no hay otra construcción en progreso
    const inProgress = await db('player_buildings')
      .where({ player_id: playerId, is_building: true })
      .first();

    if (inProgress) {
      throw new Error('Ya tenés un edificio en construcción.');
    }

    const { cost, buildTime } = this.calculateCost(playerBuilding.building_id, nextLevel);
    await this.payResources(playerId, cost);

    const now = new Date();
    const completeAt = new Date(now.getTime() + buildTime);

    await db('player_buildings').where('id', buildingDbId).update({
      level: nextLevel,
      is_building: true,
      build_complete_at: completeAt.toISOString(),
    });

    // NOTE: Barn capacity is granted in gameTick when construction completes,
    // not here — granting it now would give capacity before the upgrade finishes.

    return {
      success: true,
      buildingId: playerBuilding.building_id,
      newLevel: nextLevel,
      buildTime,
      completeAt: completeAt.toISOString(),
      message: `Mejorando ${building.icon} ${building.name} a nivel ${nextLevel}... Listo en ${Math.round(buildTime / 60000)} min.`,
    };
  },

  /**
   * Cobrar recursos al jugador (atómico con rollback)
   */
  async payResources(playerId, cost) {
    const charged = [];
    try {
      for (const [resource, amount] of Object.entries(cost)) {
        await playerService.modifyResource(playerId, resource, -amount);
        charged.push({ resource, amount });
      }
    } catch (err) {
      // Revertir lo ya cobrado
      for (const { resource, amount } of charged) {
        await playerService.modifyResource(playerId, resource, amount);
      }
      throw new Error(`No tenés suficientes recursos. ${err.message}`);
    }
  },
};

module.exports = buildingService;
