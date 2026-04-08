const { initTestDb, seedTestData, getDb, TEST_PLAYER_ID } = require('./setup');

let db;

beforeAll(async () => {
  db = await initTestDb();
  await seedTestData();
});

// ============================================
// Player Service
// ============================================
describe('PlayerService', () => {
  const playerService = require('../src/services/playerService');

  test('initPlayer returns existing player', async () => {
    const profile = await playerService.initPlayer(TEST_PLAYER_ID, { first_name: 'Test' });
    expect(profile).toBeDefined();
    expect(profile.telegram_id).toBe(TEST_PLAYER_ID);
    expect(profile.resources).toBeDefined();
    expect(profile.buildings).toBeDefined();
  });

  test('initPlayer creates new player with starter resources', async () => {
    const newPlayerId = 111222333;
    const profile = await playerService.initPlayer(newPlayerId, {
      username: 'newbie',
      first_name: 'NewPlayer',
    });

    expect(profile).toBeDefined();
    expect(profile.telegram_id).toBe(newPlayerId);
    expect(profile.resources.gold).toBeDefined();
    expect(profile.resources.gold.amount).toBe(200);
    expect(profile.resources.wood.amount).toBe(100);

    // Cleanup
    await db('farm_plots').where('player_id', newPlayerId).delete();
    await db('player_buildings').where('player_id', newPlayerId).delete();
    await db('player_resources').where('player_id', newPlayerId).delete();
    await db('players').where('telegram_id', newPlayerId).delete();
  });

  test('getFullProfile returns complete data', async () => {
    const profile = await playerService.getFullProfile(TEST_PLAYER_ID);
    expect(profile.display_name).toBe('TestPlayer');
    expect(profile.resources).toHaveProperty('gold');
    expect(profile.buildings.length).toBeGreaterThanOrEqual(4);
    expect(Array.isArray(profile.troops)).toBe(true);
    expect(Array.isArray(profile.animals)).toBe(true);
  });

  test('getFullProfile returns null for non-existent player', async () => {
    const profile = await playerService.getFullProfile(0);
    expect(profile).toBeNull();
  });

  test('modifyResource adds resources', async () => {
    // Set to a known value below capacity so the add is visible
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
      .update({ amount: 100 });

    await playerService.modifyResource(TEST_PLAYER_ID, 'gold', 50);

    const after = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();

    expect(after.amount).toBe(150);
  });

  test('modifyResource subtracts resources atomically', async () => {
    // Set known value
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wood' })
      .update({ amount: 100 });

    await playerService.modifyResource(TEST_PLAYER_ID, 'wood', -30);

    const after = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wood' }).first();

    expect(after.amount).toBe(70);
  });

  test('modifyResource throws on insufficient resources', async () => {
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'stone' })
      .update({ amount: 5 });

    await expect(
      playerService.modifyResource(TEST_PLAYER_ID, 'stone', -100)
    ).rejects.toThrow(/suficiente/i);

    // Value unchanged
    const after = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'stone' }).first();
    expect(after.amount).toBe(5);
  });

  test('modifyResource creates new resource if adding', async () => {
    await playerService.modifyResource(TEST_PLAYER_ID, 'crystal', 5);

    const resource = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'crystal' }).first();

    expect(resource).toBeDefined();
    expect(resource.amount).toBe(5);

    // Cleanup
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'crystal' }).delete();
  });

  test('modifyResource throws when subtracting non-existent resource', async () => {
    await expect(
      playerService.modifyResource(TEST_PLAYER_ID, 'nonexistent_resource', -10)
    ).rejects.toThrow();
  });

  test('addXP increases XP and levels up', async () => {
    await db('players').where('telegram_id', TEST_PLAYER_ID).update({ xp: 0, level: 1 });

    // Level 1 requires 100 XP
    const result = await playerService.addXP(TEST_PLAYER_ID, 150);

    expect(result.level).toBe(2);
    expect(result.leveledUp).toBe(true);
    expect(result.xp).toBe(0); // 150 - 100 = 50 ... actually depends on the table

    // Restore
    await db('players').where('telegram_id', TEST_PLAYER_ID).update({ xp: 0, level: 1 });
  });

  test('getLeaderboard returns sorted players', async () => {
    const leaderboard = await playerService.getLeaderboard();
    expect(Array.isArray(leaderboard)).toBe(true);
    expect(leaderboard.length).toBeGreaterThanOrEqual(1);
  });
});

// ============================================
// Farm Service
// ============================================
describe('FarmService', () => {
  const farmService = require('../src/services/farmService');
  const playerService = require('../src/services/playerService');

  beforeEach(async () => {
    // Ensure player has enough gold
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
      .update({ amount: 500 });

    // Reset plots to empty
    await db('farm_plots').where('player_id', TEST_PLAYER_ID).update({
      state: 'empty', crop_id: null, planted_at: null, ready_at: null,
    });
  });

  test('getPlots returns player plots', async () => {
    const plots = await farmService.getPlots(TEST_PLAYER_ID);
    expect(plots.length).toBeGreaterThanOrEqual(2);
  });

  test('plantCrop plants and deducts gold', async () => {
    const plots = await farmService.getPlots(TEST_PLAYER_ID);
    const emptyPlot = plots.find(p => p.state === 'empty');

    const result = await farmService.plantCrop(TEST_PLAYER_ID, emptyPlot.id, 'wheat');
    expect(result.success).toBe(true);
    expect(result.cropId).toBe('wheat');

    // Plot should be growing
    const updatedPlot = await db('farm_plots').where('id', emptyPlot.id).first();
    expect(updatedPlot.state).toBe('growing');
    expect(updatedPlot.crop_id).toBe('wheat');

    // Gold should be deducted (wheat costs 5 gold)
    const gold = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();
    expect(gold.amount).toBe(495);
  });

  test('plantCrop fails on non-empty plot', async () => {
    const plots = await farmService.getPlots(TEST_PLAYER_ID);
    const emptyPlot = plots.find(p => p.state === 'empty');

    await farmService.plantCrop(TEST_PLAYER_ID, emptyPlot.id, 'wheat');
    await expect(
      farmService.plantCrop(TEST_PLAYER_ID, emptyPlot.id, 'carrot')
    ).rejects.toThrow(/vacía/i);
  });

  test('plantCrop fails with invalid crop', async () => {
    const plots = await farmService.getPlots(TEST_PLAYER_ID);
    const emptyPlot = plots.find(p => p.state === 'empty');

    await expect(
      farmService.plantCrop(TEST_PLAYER_ID, emptyPlot.id, 'invalid_crop')
    ).rejects.toThrow(/no válido/i);
  });

  test('plantCrop fails with insufficient gold', async () => {
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
      .update({ amount: 0 });

    const plots = await farmService.getPlots(TEST_PLAYER_ID);
    const emptyPlot = plots.find(p => p.state === 'empty');

    await expect(
      farmService.plantCrop(TEST_PLAYER_ID, emptyPlot.id, 'wheat')
    ).rejects.toThrow(/oro/i);
  });

  test('harvestCrop gives resources and XP', async () => {
    const plots = await farmService.getPlots(TEST_PLAYER_ID);
    const plot = plots[0];

    // Manually set plot to ready
    await db('farm_plots').where('id', plot.id).update({
      state: 'ready',
      crop_id: 'wheat',
      planted_at: new Date(Date.now() - 3600000).toISOString(),
      ready_at: new Date(Date.now() - 60000).toISOString(),
    });

    await db('players').where('telegram_id', TEST_PLAYER_ID).update({ xp: 0, level: 1 });

    const result = await farmService.harvestCrop(TEST_PLAYER_ID, plot.id);

    expect(result.success).toBe(true);
    expect(result.quantity).toBeGreaterThan(0);
    expect(result.xp).toBe(10); // wheat XP

    // Plot should be empty again
    const updatedPlot = await db('farm_plots').where('id', plot.id).first();
    expect(updatedPlot.state).toBe('empty');
  });

  test('harvestCrop fails when not ready', async () => {
    const plots = await farmService.getPlots(TEST_PLAYER_ID);
    const emptyPlot = plots.find(p => p.state === 'empty');

    await expect(
      farmService.harvestCrop(TEST_PLAYER_ID, emptyPlot.id)
    ).rejects.toThrow(/no está listo/i);
  });

  test('rollQuality returns valid quality', () => {
    for (let i = 0; i < 100; i++) {
      const quality = farmService.rollQuality(false);
      expect(['normal', 'good', 'excellent']).toContain(quality.id);
      expect(quality.multiplier).toBeGreaterThanOrEqual(1.0);
    }
  });
});

// ============================================
// Commerce Service
// ============================================
describe('CommerceService', () => {
  const commerceService = require('../src/services/commerceService');

  beforeEach(async () => {
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' })
      .update({ amount: 500 });
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wheat' })
      .update({ amount: 50 });
  });

  test('quickSell deducts resource and gives gold', async () => {
    const goldBefore = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();

    const result = await commerceService.quickSell(TEST_PLAYER_ID, 'wheat', 10);

    expect(result.success).toBe(true);
    expect(result.gold).toBeGreaterThan(0);

    const wheat = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wheat' }).first();
    expect(wheat.amount).toBe(40);
  });

  test('quickSell fails on insufficient resource', async () => {
    await expect(
      commerceService.quickSell(TEST_PLAYER_ID, 'wheat', 9999)
    ).rejects.toThrow(/suficiente/i);
  });

  test('quickSell fails on invalid resource', async () => {
    await expect(
      commerceService.quickSell(TEST_PLAYER_ID, 'unobtanium', 1)
    ).rejects.toThrow(/no vendible/i);
  });

  test('getActiveCaravan returns caravan with offers', async () => {
    const caravan = await commerceService.getActiveCaravan();
    expect(caravan).toBeDefined();
    expect(caravan.buy_offers.length).toBeGreaterThan(0);
    expect(caravan.sell_offers.length).toBeGreaterThan(0);
    expect(caravan.is_active).toBeTruthy();
  });
});

// ============================================
// Combat Service
// ============================================
describe('CombatService', () => {
  const combatService = require('../src/services/combatService');

  test('calculateBattle returns valid result structure', () => {
    const attackerArmy = { militia: 10 };
    const defenderArmy = { militia: 10 };

    const result = combatService.calculateBattle(attackerArmy, defenderArmy);

    expect(result).toHaveProperty('winner');
    expect(['attacker', 'defender']).toContain(result.winner);
    expect(result).toHaveProperty('attackPower');
    expect(result).toHaveProperty('defensePower');
    expect(result).toHaveProperty('attackerLosses');
    expect(result).toHaveProperty('defenderLosses');
    expect(result).toHaveProperty('battleLog');
  });

  test('strongVs increases attack power', () => {
    // Cavalry is strong vs militia
    const cavalryVsMilitia = combatService.calculateBattle(
      { cavalry: 10 }, { militia: 10 }
    );
    const militiaVsMilitia = combatService.calculateBattle(
      { militia: 10 }, { militia: 10 }
    );

    expect(cavalryVsMilitia.attackPower).toBeGreaterThan(militiaVsMilitia.attackPower);
  });

  test('defensive buildings increase defense', () => {
    const army = { militia: 10 };
    const defArmy = { militia: 10 };

    const withoutWall = combatService.calculateBattle(army, defArmy, []);
    const withWall = combatService.calculateBattle(army, defArmy, [
      { building_id: 'wall', level: 5 },
    ]);

    expect(withWall.defensePower).toBeGreaterThan(withoutWall.defensePower);
  });

  test('validateArmy rejects troops player doesnt have', async () => {
    await expect(
      combatService.validateArmy(TEST_PLAYER_ID, { militia: 100 })
    ).rejects.toThrow(/suficientes/i);
  });

  test('generateNPCArmy creates army with positive quantities', () => {
    const army = combatService.generateNPCArmy(100);
    expect(Object.keys(army).length).toBeGreaterThan(0);

    for (const qty of Object.values(army)) {
      expect(qty).toBeGreaterThan(0);
    }
  });

  test('generateNPCArmy scales with strength', () => {
    const weak = combatService.generateNPCArmy(10);
    const strong = combatService.generateNPCArmy(500);

    const weakTotal = Object.values(weak).reduce((a, b) => a + b, 0);
    const strongTotal = Object.values(strong).reduce((a, b) => a + b, 0);

    expect(strongTotal).toBeGreaterThan(weakTotal);
  });
});

// ============================================
// Building Service
// ============================================
describe('BuildingService', () => {
  const buildingService = require('../src/services/buildingService');

  test('calculateCost returns cost that scales with level', () => {
    const lvl1 = buildingService.calculateCost('farm_plot', 1);
    const lvl5 = buildingService.calculateCost('farm_plot', 5);

    expect(lvl5.cost.wood).toBeGreaterThan(lvl1.cost.wood);
    expect(lvl5.buildTime).toBeGreaterThan(lvl1.buildTime);
  });

  test('calculateCost throws for invalid building', () => {
    expect(() => buildingService.calculateCost('nonexistent', 1)).toThrow(/no válido/i);
  });

  test('buildNew creates building and deducts resources', async () => {
    // Ensure enough resources
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wood' })
      .update({ amount: 500 });
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'stone' })
      .update({ amount: 500 });

    // Clear any in-progress builds
    await db('player_buildings')
      .where({ player_id: TEST_PLAYER_ID, is_building: true })
      .update({ is_building: false, build_complete_at: null });

    const result = await buildingService.buildNew(TEST_PLAYER_ID, 'stable');
    expect(result.success).toBe(true);
    expect(result.buildingId).toBe('stable');

    // Building should exist in DB
    const building = await db('player_buildings')
      .where({ player_id: TEST_PLAYER_ID, building_id: 'stable' }).first();
    expect(building).toBeDefined();
    expect(building.is_building).toBeTruthy();

    // Cleanup
    await db('player_buildings')
      .where({ player_id: TEST_PLAYER_ID, building_id: 'stable' }).delete();
  });

  test('buildNew fails when another building in progress', async () => {
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wood' })
      .update({ amount: 999 });
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'stone' })
      .update({ amount: 999 });

    await db('player_buildings')
      .where({ player_id: TEST_PLAYER_ID, is_building: true })
      .update({ is_building: false, build_complete_at: null });

    await buildingService.buildNew(TEST_PLAYER_ID, 'stable');

    await expect(
      buildingService.buildNew(TEST_PLAYER_ID, 'sawmill')
    ).rejects.toThrow(/en construcción/i);

    // Cleanup
    await db('player_buildings')
      .where({ player_id: TEST_PLAYER_ID, building_id: 'stable' }).delete();
    await db('player_buildings')
      .where({ player_id: TEST_PLAYER_ID, building_id: 'sawmill' }).delete();
  });
});

// ============================================
// Mission Service
// ============================================
describe('MissionService', () => {
  const missionService = require('../src/services/missionService');

  beforeEach(async () => {
    // Clean missions
    await db('missions').where('player_id', TEST_PLAYER_ID).delete();
  });

  test('generateMissions creates missions', async () => {
    const missions = await missionService.generateMissions(TEST_PLAYER_ID);
    expect(missions.length).toBeGreaterThanOrEqual(2);

    for (const mission of missions) {
      expect(mission.title).toBeDefined();
      expect(mission.npc_name).toBeDefined();
      expect(mission.requirements).toBeDefined();
      expect(mission.rewards).toBeDefined();
    }
  });

  test('acceptMission changes status', async () => {
    const missions = await missionService.generateMissions(TEST_PLAYER_ID);
    const mission = missions[0];

    const result = await missionService.acceptMission(TEST_PLAYER_ID, mission.id);
    expect(result.success).toBe(true);

    const updated = await db('missions').where('id', mission.id).first();
    expect(updated.status).toBe('accepted');
  });

  test('acceptMission fails for non-existent mission', async () => {
    await expect(
      missionService.acceptMission(TEST_PLAYER_ID, 99999)
    ).rejects.toThrow(/no disponible/i);
  });

  test('completeMission gives rewards and deducts resources', async () => {
    // Create a simple mission manually
    const requirements = [{ resource_id: 'wheat', amount: 5 }];
    const rewards = { gold: 100, xp: 50, items: [] };

    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wheat' })
      .update({ amount: 100 });

    const goldBefore = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'gold' }).first();

    const [missionId] = await db('missions').insert({
      player_id: TEST_PLAYER_ID,
      title: 'Test Mission',
      description: 'Test',
      npc_name: 'Test NPC',
      requirements: JSON.stringify(requirements),
      rewards: JSON.stringify(rewards),
      status: 'accepted',
      is_urgent: false,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });

    const result = await missionService.completeMission(TEST_PLAYER_ID, missionId);
    expect(result.success).toBe(true);

    // Wheat should be deducted
    const wheat = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wheat' }).first();
    expect(wheat.amount).toBe(95);

    // Mission should be completed
    const mission = await db('missions').where('id', missionId).first();
    expect(mission.status).toBe('completed');
  });

  test('completeMission rollback on insufficient resources', async () => {
    const requirements = [
      { resource_id: 'wheat', amount: 5 },
      { resource_id: 'iron', amount: 99999 }, // more than player has
    ];
    const rewards = { gold: 100, xp: 50, items: [] };

    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wheat' })
      .update({ amount: 50 });
    await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'iron' })
      .update({ amount: 10 });

    const [missionId] = await db('missions').insert({
      player_id: TEST_PLAYER_ID,
      title: 'Hard Mission',
      description: 'Test rollback',
      npc_name: 'Test NPC',
      requirements: JSON.stringify(requirements),
      rewards: JSON.stringify(rewards),
      status: 'accepted',
      is_urgent: false,
      expires_at: new Date(Date.now() + 86400000).toISOString(),
    });

    await expect(
      missionService.completeMission(TEST_PLAYER_ID, missionId)
    ).rejects.toThrow(/suficientes/i);

    // Wheat should be restored (rollback)
    const wheat = await db('player_resources')
      .where({ player_id: TEST_PLAYER_ID, resource_id: 'wheat' }).first();
    expect(wheat.amount).toBe(50);
  });
});
