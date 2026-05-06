/**
 * WorldScene: RTS god-view overworld with buildings, NPCs, animals, and crop plots.
 * No player character — camera is freely pannable and zoomable.
 */
import Phaser from 'phaser';
import { generateWorldMap, TILE_SIZE } from '../maps/MapGenerator';
import NPC from '../entities/NPC';
import Animal from '../entities/Animal';
import Villager from '../entities/Villager';
import CropPlot from '../entities/CropPlot';
import Building from '../entities/Building';
import CameraSystem from '../systems/CameraSystem';
import SelectionSystem from '../systems/SelectionSystem';
import BuildingPlacementSystem from '../systems/BuildingPlacementSystem';
import DayNightSystem from '../systems/DayNightSystem';
import ParticleSystem from '../systems/ParticleSystem';
import EventBridge from '../EventBridge';

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldScene' });
    this.cameraSystem = null;
    this.selectionSystem = null;
    this.placementSystem = null;
    this.dayNightSystem = null;
    this.particleSystem = null;
    this.npcs = [];
    this.animals = [];
    this.cropPlots = [];
    this.buildings = [];
    this.villagers = [];
    this.mapData = null;
  }

  create() {
    this.mapData = generateWorldMap(42);

    this.createTilemap();
    this.createBuildings();
    this.createNPCs();
    this.createFarmPlots();
    this.createAnimals();
    this.createVillagers();
    this.createResourceZones();
    this.setupCamera();
    this.setupSystems();
    this.setupEventBridge();

    // Handle resize
    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
    });
  }

  createTilemap() {
    const { width, height, layers } = this.mapData;

    const map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width,
      height,
    });

    const terrainTileset = map.addTilesetImage('terrain', 'terrain', TILE_SIZE, TILE_SIZE);

    // Ground layer
    const groundLayer = map.createBlankLayer('ground', terrainTileset, 0, 0, width, height, TILE_SIZE, TILE_SIZE);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        groundLayer.putTileAt(layers.ground[y][x], x, y);
      }
    }
    groundLayer.setDepth(0);

    // Decoration layer
    const decoLayer = map.createBlankLayer('decoration', terrainTileset, 0, 0, width, height, TILE_SIZE, TILE_SIZE);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (layers.decoration[y][x] >= 0) {
          decoLayer.putTileAt(layers.decoration[y][x], x, y);
        }
      }
    }
    decoLayer.setDepth(2);

    // Collision layer (invisible, for future pathfinding)
    const collisionLayer = map.createBlankLayer('collision', terrainTileset, 0, 0, width, height, TILE_SIZE, TILE_SIZE);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (layers.collision[y][x] === 1) {
          const tile = collisionLayer.putTileAt(0, x, y);
          tile.setCollision(true);
        }
      }
    }
    collisionLayer.setDepth(1);
    collisionLayer.setVisible(false);

    this.collisionLayer = collisionLayer;
    this.map = map;

    this.physics.world.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
  }

  createBuildings() {
    const buildingObjects = this.mapData.objects.filter(o => o.type === 'building');

    for (const obj of buildingObjects) {
      const px = obj.x * TILE_SIZE + TILE_SIZE;
      const py = obj.y * TILE_SIZE + TILE_SIZE;

      const building = new Building(this, px, py, {
        buildingId: obj.buildingId,
        tileIndex: obj.tileIndex,
        level: 1,
        is_building: false,
      });

      this.buildings.push(building);
    }
  }

  createNPCs() {
    const npcObjects = this.mapData.objects.filter(o => o.type === 'npc');

    for (const obj of npcObjects) {
      const px = obj.x * TILE_SIZE + TILE_SIZE / 2;
      const py = obj.y * TILE_SIZE + TILE_SIZE / 2;

      const npc = new NPC(this, px, py, obj.npcId, obj.name);
      this.npcs.push(npc);
    }
  }

  createFarmPlots() {
    const plotObjects = this.mapData.objects.filter(o => o.type === 'farm_plot');

    for (const obj of plotObjects) {
      const px = obj.x * TILE_SIZE + TILE_SIZE;
      const py = obj.y * TILE_SIZE + TILE_SIZE;

      const plot = new CropPlot(this, px, py, {
        plotIndex: obj.plotIndex,
        state: 'empty',
        crop_id: null,
      });

      this.cropPlots.push(plot);
    }
  }

  createAnimals() {
    const animalZone = this.mapData.objects.find(o => o.type === 'animal_zone');
    if (!animalZone) return;

    const bounds = {
      x: animalZone.x * TILE_SIZE,
      y: animalZone.y * TILE_SIZE,
      width: animalZone.width * TILE_SIZE,
      height: animalZone.height * TILE_SIZE,
    };

    const animalTypes = ['chicken', 'cow', 'sheep'];
    for (let i = 0; i < 3; i++) {
      const type = animalTypes[i % animalTypes.length];
      const px = bounds.x + Phaser.Math.Between(32, bounds.width - 32);
      const py = bounds.y + Phaser.Math.Between(32, bounds.height - 32);

      const animal = new Animal(this, px, py, type, bounds);
      this.animals.push(animal);
    }
  }

  createVillagers() {
    // Spawn some default villagers in the farm zone
    // In production, these would come from the server API
    const defaultVillagers = [
      { id: 1, name: 'Aldric', role: 'farmer', state: 'idle' },
      { id: 2, name: 'Brynn', role: 'builder', state: 'idle' },
      { id: 3, name: 'Cedric', role: 'soldier', state: 'idle' },
    ];

    const spawn = this.mapData.objects.find(o => o.type === 'spawn');
    const cx = (spawn?.x ?? 40) * TILE_SIZE;
    const cy = (spawn?.y ?? 32) * TILE_SIZE;

    for (let i = 0; i < defaultVillagers.length; i++) {
      const data = defaultVillagers[i];
      const px = cx + Phaser.Math.Between(-64, 64);
      const py = cy + Phaser.Math.Between(-64, 64);

      const villager = new Villager(this, px, py, data);
      this.villagers.push(villager);
    }
  }

  createResourceZones() {
    const zones = this.mapData.objects.filter(o => o.type === 'resource_zone');
    for (const zone of zones) {
      const px = zone.x * TILE_SIZE;
      const py = zone.y * TILE_SIZE;
      const ICONS = { stone: '🪨', iron: '⛏️', wood: '🪵', gold: '🪙' };
      const label = this.add.text(px, py - 16, `${ICONS[zone.resource] || '?'} ${zone.name}`, {
        fontSize: '10px', color: '#ffd700', stroke: '#000', strokeThickness: 2,
      }).setOrigin(0.5).setDepth(8);
    }
    // Rival kingdom banners
    const rivals = this.mapData.objects.filter(o => o.type === 'rival_kingdom');
    for (const r of rivals) {
      const px = r.x * TILE_SIZE;
      const py = r.y * TILE_SIZE;
      this.add.text(px, py, `🏰 ${r.name}`, {
        fontSize: '11px', color: '#ff6666', stroke: '#000', strokeThickness: 3,
        fontFamily: 'MedievalSharp, serif',
      }).setOrigin(0.5).setDepth(8);
    }
  }

  setupCamera() {
    this.cameraSystem = new CameraSystem(this);
    this.cameraSystem.setBounds(0, 0, this.mapData.width * TILE_SIZE, this.mapData.height * TILE_SIZE);
    this.cameraSystem.setZoom(1.3);

    // Start camera on the castle zone (throne room at tile 77,12; library/embassy at y=18)
    this.cameraSystem.centerOn(78 * TILE_SIZE, 18 * TILE_SIZE);
  }

  setupSystems() {
    this.selectionSystem = new SelectionSystem(this);
    this.placementSystem = new BuildingPlacementSystem(this);
    this.dayNightSystem = new DayNightSystem(this);
    this.particleSystem = new ParticleSystem(this);

    // Add smoke to production buildings
    for (const building of this.buildings) {
      const id = building.buildingData.buildingId;
      if (['mill', 'smithy', 'barn', 'tavern'].includes(id)) {
        this.particleSystem.addBuildingSmoke(building.x, building.y);
      }
    }

    // Register all selectables
    for (const npc of this.npcs) {
      this.selectionSystem.register(npc, 'npc', {
        npcId: npc.npcId,
        name: npc.npcName,
      });
    }

    for (const plot of this.cropPlots) {
      this.selectionSystem.register(plot, 'farm_plot', {
        plotIndex: plot.plotIndex,
        state: plot.plotData?.state || 'empty',
      });
    }

    for (const building of this.buildings) {
      this.selectionSystem.register(building, 'building', {
        buildingId: building.buildingData.buildingId,
      });
    }

    for (const animal of this.animals) {
      this.selectionSystem.register(animal, 'animal', {
        animalType: animal.animalType,
      });
    }

    for (const villager of this.villagers) {
      this.selectionSystem.register(villager, 'villager', {
        villagerId: villager.villagerData.id,
        name: villager.villagerData.name,
        role: villager.villagerData.role,
        state: villager.villagerData.state,
      });
    }

    // War gate marker
    const warGate = this.mapData.objects.find(o => o.type === 'war_gate');
    if (warGate) {
      const gateMarker = this.add.text(
        warGate.x * TILE_SIZE + TILE_SIZE / 2,
        warGate.y * TILE_SIZE + TILE_SIZE / 2,
        '⚔️',
        { fontSize: '24px' }
      ).setOrigin(0.5).setDepth(8);

      // Invisible sprite for selection
      const gateZone = this.add.sprite(
        warGate.x * TILE_SIZE + TILE_SIZE / 2,
        warGate.y * TILE_SIZE + TILE_SIZE / 2,
        null
      ).setVisible(false);

      this.selectionSystem.register(gateZone, 'war_gate', { name: 'War Gate' });
    }
  }

  setupEventBridge() {
    // Listen for overlay state changes
    EventBridge.on('overlay:open', () => {
      this.selectionSystem.setEnabled(false);
    });

    EventBridge.on('overlay:close', () => {
      this.selectionSystem.setEnabled(true);
      this.selectionSystem.deselect();
    });

    // Building placement events from React toolbar
    EventBridge.on('building:startPlacement', ({ buildingId, tileIndex }) => {
      // Get building config — use tileIndex from the toolbar
      const config = { tileWidth: 2, tileHeight: 2 }; // Default; could import from shared
      this.placementSystem.startPlacement(buildingId, config, tileIndex);
    });

    EventBridge.on('building:cancelPlacement', () => {
      this.placementSystem.cancel();
    });

    EventBridge.on('building:confirmPlacement', () => {
      const result = this.placementSystem.confirmPlacement();
      if (result) {
        // Emit to React to call the API
        EventBridge.emit('building:placed', result);
      }
    });

    // Building added after server confirms
    EventBridge.on('building:addToScene', (buildingData) => {
      this.addBuilding(buildingData);
    });

    // Listen for game state updates
    EventBridge.on('game:plotsUpdated', (plots) => {
      this.updateCropPlots(plots);
    });

    EventBridge.on('game:animalsUpdated', (animals) => {
      this.updateAnimals(animals);
    });

    // Token earned: float "+X KH" text in game world
    EventBridge.on('token:earned', ({ amount, x, y }) => {
      if (!this.particleSystem || amount <= 0) return;
      const cam = this.cameras.main;
      // Use provided world coords, or default to visible center of world
      const wx = (x != null) ? x : cam.scrollX + cam.width / 2;
      const wy = (y != null) ? y : cam.scrollY + cam.height / 3;
      this.particleSystem.emitTokenGain(wx, wy, amount);
    });
  }

  /**
   * Add a building to the scene (called after server confirms placement)
   */
  addBuilding(buildingData) {
    const px = buildingData.posX * TILE_SIZE + TILE_SIZE;
    const py = buildingData.posY * TILE_SIZE + TILE_SIZE;

    const building = new Building(this, px, py, buildingData);
    this.buildings.push(building);
    this.selectionSystem.register(building, 'building', {
      buildingId: buildingData.buildingId,
    });
    // Construction dust effect
    if (this.particleSystem) {
      this.particleSystem.emitConstructionDust(px, py);
    }
  }

  updateCropPlots(plotsData) {
    if (!plotsData) return;
    for (const plot of this.cropPlots) {
      const serverPlot = plotsData.find(p => p.plotIndex === plot.plotIndex);
      if (serverPlot) {
        plot.updateVisual(serverPlot);
      }
    }
  }

  updateAnimals(animalsData) {
    if (!animalsData) return;
    for (let i = 0; i < this.animals.length && i < animalsData.length; i++) {
      const data = animalsData[i];
      if (!data.is_fed) {
        this.animals[i].setStatus('hungry');
      } else if (data.next_production_at && new Date(data.next_production_at) <= new Date()) {
        this.animals[i].setStatus('ready');
      } else {
        this.animals[i].setStatus(null);
      }
    }
  }

  /**
   * Check if a game object is within the camera viewport (with margin).
   */
  isOnScreen(obj, margin = 128) {
    const cam = this.cameras.main;
    const cx = cam.scrollX - margin;
    const cy = cam.scrollY - margin;
    const cw = cam.width / cam.zoom + margin * 2;
    const ch = cam.height / cam.zoom + margin * 2;
    return obj.x >= cx && obj.x <= cx + cw && obj.y >= cy && obj.y <= cy + ch;
  }

  update(time, delta) {
    // Update camera (keyboard panning)
    this.cameraSystem.update(delta);

    // Update day/night cycle
    this.dayNightSystem.update(delta);

    // Update selection ring position
    this.selectionSystem.update();

    // Update animals (only on-screen for performance)
    for (const animal of this.animals) {
      const visible = this.isOnScreen(animal);
      animal.setVisible(visible);
      if (visible) animal.update(delta);
    }

    // Update villagers (only on-screen for performance)
    for (const villager of this.villagers) {
      const visible = this.isOnScreen(villager);
      villager.setVisible(visible);
      if (visible) villager.update(delta);
    }
  }

  shutdown() {
    EventBridge.removeAllListeners('overlay:open');
    EventBridge.removeAllListeners('overlay:close');
    EventBridge.removeAllListeners('building:startPlacement');
    EventBridge.removeAllListeners('building:cancelPlacement');
    EventBridge.removeAllListeners('building:confirmPlacement');
    EventBridge.removeAllListeners('building:addToScene');
    EventBridge.removeAllListeners('game:plotsUpdated');
    EventBridge.removeAllListeners('game:animalsUpdated');

    if (this.cameraSystem) this.cameraSystem.destroy();
    if (this.selectionSystem) this.selectionSystem.destroy();
    if (this.particleSystem) this.particleSystem.destroy();
    if (this.dayNightSystem) this.dayNightSystem.destroy();
    if (this.placementSystem) this.placementSystem.destroy();
  }
}
