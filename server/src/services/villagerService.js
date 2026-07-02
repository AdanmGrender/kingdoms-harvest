const crypto = require('crypto');
const db = require('../config/database');
const { VILLAGER_ROLES, VILLAGER_NAMES, BUILDINGS } = require('../../../shared/gameConfig');

// Fractional production accumulators: villagerId:resource → sub-integer remainder
const villagerAccumulators = {};

const villagerService = {
  async getVillagers(playerId) {
    return db('villagers').where('player_id', playerId);
  },

  async spawnVillager(playerId, role = 'farmer') {
    const roleConfig = VILLAGER_ROLES[role];
    if (!roleConfig) throw new Error('Rol de aldeano no válido');

    // Pick a random name
    const name = VILLAGER_NAMES[Math.floor(crypto.randomInt(0, VILLAGER_NAMES.length))];

    const now = new Date().toISOString();
    await db('villagers').insert({
      player_id: playerId,
      name,
      role,
      state: 'idle',
      hunger: 100,
      happiness: 100,
      age: 18 + crypto.randomInt(0, 20),
      born_at: now,
      created_at: now,
    });

    return { success: true, message: `${roleConfig.icon} ${name} se ha unido a tu reino como ${roleConfig.name}` };
  },

  async assignToBuilding(playerId, villagerId, buildingId) {
    const villager = await db('villagers')
      .where({ id: villagerId, player_id: playerId })
      .first();

    if (!villager) throw new Error('Aldeano no encontrado');

    // Verify building belongs to player
    if (buildingId) {
      const building = await db('player_buildings')
        .where({ id: buildingId, player_id: playerId })
        .first();
      if (!building) throw new Error('Edificio no encontrado');
    }

    await db('villagers').where('id', villagerId).update({
      assigned_building_id: buildingId || null,
      state: buildingId ? 'walking_to_work' : 'idle',
    });

    return { success: true, message: `${villager.name} asignado correctamente` };
  },

  async unassign(playerId, villagerId) {
    return this.assignToBuilding(playerId, villagerId, null);
  },

  /**
   * Simulate villager behavior for one tick (called from gameTick every 5 minutes).
   * Hunger/state/happiness updated in a single batch SQL for all villagers of this player.
   * Resource production loop only runs for villagers already in 'working' state.
   */
  async simulateTick(playerId) {
    // Single UPDATE for all N villagers — replaces N individual updates
    await db.raw(`
      UPDATE "villagers" SET
        "hunger" = MAX(0, "hunger" - 1),
        "happiness" = CASE
          WHEN ("hunger" - 1) <= 20 THEN MAX(0, "happiness" - 1)
          ELSE "happiness"
        END,
        "state" = CASE
          WHEN ("hunger" - 1) <= 20 THEN 'resting'
          WHEN "assigned_building_id" IS NOT NULL AND "state" = 'idle' THEN 'walking_to_work'
          WHEN "state" = 'walking_to_work' THEN 'working'
          WHEN "state" = 'resting' AND ("hunger" - 1) > 50 AND "assigned_building_id" IS NOT NULL THEN 'walking_to_work'
          WHEN "state" = 'resting' AND ("hunger" - 1) > 50 THEN 'idle'
          ELSE "state"
        END
      WHERE "player_id" = ?
    `, [playerId]);

    // Resource production: only for working villagers (smaller loop after batch state update)
    const workingVillagers = await db('villagers')
      .where({ player_id: playerId, state: 'working' })
      .whereNotNull('assigned_building_id');

    for (const v of workingVillagers) {
      const building = await db('player_buildings').where('id', v.assigned_building_id).first();
      const config = building ? BUILDINGS[building.building_id] : null;
      if (!config?.produces) continue;

      for (const [resource, ratePerHour] of Object.entries(config.produces)) {
        const key = `${v.id}:${resource}`;
        villagerAccumulators[key] = (villagerAccumulators[key] || 0) + (ratePerHour * 0.5) / 60;
        const intAmount = Math.floor(villagerAccumulators[key]);
        if (intAmount > 0) {
          villagerAccumulators[key] -= intAmount;
          const res = await db.raw(
            'UPDATE "player_resources" SET "amount" = MIN("amount" + ?, "capacity") WHERE "player_id" = ? AND "resource_id" = ?',
            [intAmount, playerId, resource]
          );
          if (res.count === 0) {
            await db('player_resources').insert({
              player_id: playerId, resource_id: resource, amount: intAmount, capacity: 1000,
            });
          }
        }
      }
    }
  },

  /**
   * Auto-spawn initial villagers when first house is built
   */
  async checkAndSpawnInitial(playerId) {
    const existing = await db('villagers').where('player_id', playerId);
    if (existing.length === 0) {
      await this.spawnVillager(playerId, 'farmer');
      await this.spawnVillager(playerId, 'builder');
      await this.spawnVillager(playerId, 'soldier');
    }
  },

  /**
   * Aging system — called each game day (from gameTick when world_day increments)
   */
  async processAging(playerId) {
    const villagers = await db('villagers').where('player_id', playerId);

    for (const v of villagers) {
      // Age by 1 year per game day
      const newAge = v.age + 1;

      if (newAge >= 70) {
        // Old age death (probability increases with age, capped at 95%)
        const deathChance = Math.min((newAge - 70) * 0.05, 0.95);
        if (crypto.randomInt(0, 10000) / 10000 < deathChance) {
          await db('villagers').where('id', v.id).delete();
          continue;
        }
      }

      await db('villagers').where('id', v.id).update({ age: newAge });
    }
  },

  /**
   * Family formation — try to pair up idle adults
   */
  async processRelationships(playerId) {
    const villagers = await db('villagers').where('player_id', playerId);
    if (villagers.length === 0) return;
    const existingFamilies = await db('villager_families')
      .whereIn('villager_a_id', villagers.map(v => v.id))
      .orWhereIn('villager_b_id', villagers.map(v => v.id));

    const pairedIds = new Set();
    for (const f of existingFamilies) {
      pairedIds.add(f.villager_a_id);
      pairedIds.add(f.villager_b_id);
    }

    // Find unpaired adults (age 18-50)
    const singles = villagers.filter(v => !pairedIds.has(v.id) && v.age >= 18 && v.age <= 50);

    // Pair them up if there are at least 2 and happiness is decent
    if (singles.length >= 2) {
      const happySingles = singles.filter(v => v.happiness >= 60);
      if (happySingles.length >= 2 && crypto.randomInt(0, 10000) / 10000 < 0.1) {
        const a = happySingles[0];
        const b = happySingles[1];
        await db('villager_families').insert({
          villager_a_id: a.id,
          villager_b_id: b.id,
          children_count: 0,
          formed_at: new Date().toISOString(),
        });
      }
    }

    // Existing families may have children
    for (const family of existingFamilies) {
      if (family.children_count >= 3) continue;

      const parentA = villagers.find(v => v.id === family.villager_a_id);
      const parentB = villagers.find(v => v.id === family.villager_b_id);
      if (!parentA || !parentB) continue;
      if (parentA.age > 45 || parentB.age > 45) continue;
      if (parentA.happiness < 50 || parentB.happiness < 50) continue;

      // Check housing capacity
      const houses = await db('player_buildings')
        .where({ player_id: playerId, building_id: 'house', is_building: false });
      const capacity = houses.reduce((sum, h) => sum + h.level * 2, 0);
      if (villagers.length >= capacity) continue;

      // 5% chance per tick of having a child
      if (crypto.randomInt(0, 10000) / 10000 < 0.05) {
        const roles = ['farmer', 'builder', 'woodcutter', 'miner'];
        const role = roles[crypto.randomInt(0, roles.length)];
        await this.spawnVillager(playerId, role);
        // Set child's age to 0 — they'll grow up via aging
        const child = await db('villagers').where('player_id', playerId).orderBy('id', 'desc').first();
        if (child) {
          await db('villagers').where('id', child.id).update({ age: 0 });
        }
        await db('villager_families').where('id', family.id).update({
          children_count: family.children_count + 1,
        });
      }
    }
  },
};

module.exports = villagerService;
