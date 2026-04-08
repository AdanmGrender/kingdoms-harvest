const db = require('../config/database');
const { BUILDINGS } = require('../../../shared/gameConfig');
const playerService = require('./playerService');

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
   * Construir un edificio nuevo
   */
  async buildNew(playerId, buildingId, posX = 0, posY = 0) {
    const building = BUILDINGS[buildingId];
    if (!building) throw new Error('Edificio no válido');

    // Verificar nivel del castillo (throne_room) para desbloqueos
    const throneRoom = await db('player_buildings')
      .where({ player_id: playerId, building_id: 'throne_room' })
      .first();

    const castleLevel = throneRoom ? throneRoom.level : 0;

    // Requisitos de nivel de castillo por zona
    const zoneRequirements = {
      agricultural: 1,
      defensive: 2,
      social: 3,
      noble: 1,
    };

    if (castleLevel < zoneRequirements[building.zone]) {
      throw new Error(
        `Necesitás Salón del Trono nivel ${zoneRequirements[building.zone]} para construir en zona ${building.zone}`
      );
    }

    // Verificar que no esté ya en construcción
    const inProgress = await db('player_buildings')
      .where({ player_id: playerId, is_building: true })
      .first();

    if (inProgress) {
      throw new Error('Ya tenés un edificio en construcción. Esperá a que termine.');
    }

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

    return {
      success: true,
      buildingId,
      buildTime,
      completeAt: completeAt.toISOString(),
      message: `Construyendo ${building.icon} ${building.name}... Listo en ${Math.round(buildTime / 60000)} minutos.`,
    };
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

    // Si es granero, aumentar capacidad de recursos
    if (playerBuilding.building_id === 'barn') {
      const extraStorage = building.storagePerLevel;
      await db('player_resources')
        .where('player_id', playerId)
        .increment('capacity', extraStorage);
    }

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
