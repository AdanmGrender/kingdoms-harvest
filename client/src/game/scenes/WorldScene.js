/**
 * WorldScene: Main overworld with farm, buildings, NPCs, animals.
 * Uses programmatically generated tilemap from MapGenerator.
 */
import Phaser from 'phaser';
import { generateWorldMap, TILE_SIZE } from '../maps/MapGenerator';
import Player from '../entities/Player';
import NPC from '../entities/NPC';
import Animal from '../entities/Animal';
import CropPlot from '../entities/CropPlot';
import Building from '../entities/Building';
import MovementSystem from '../systems/MovementSystem';
import InteractionSystem from '../systems/InteractionSystem';
import EventBridge from '../EventBridge';

export default class WorldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'WorldScene' });
    this.player = null;
    this.movementSystem = null;
    this.interactionSystem = null;
    this.npcs = [];
    this.animals = [];
    this.cropPlots = [];
    this.buildings = [];
    this.mapData = null;
  }

  create() {
    this.mapData = generateWorldMap(42);

    this.createTilemap();
    this.createPlayer();
    this.createBuildings();
    this.createNPCs();
    this.createFarmPlots();
    this.createAnimals();
    this.setupCamera();
    this.setupSystems();
    this.setupEventBridge();

    // Handle resize
    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
      if (this.movementSystem) this.movementSystem.resize(gameSize.width, gameSize.height);
    });
  }

  createTilemap() {
    const { width, height, layers } = this.mapData;

    // Create a blank tilemap
    const map = this.make.tilemap({
      tileWidth: TILE_SIZE,
      tileHeight: TILE_SIZE,
      width,
      height,
    });

    // Add tileset image
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

    // Collision layer (invisible, used for physics)
    const collisionLayer = map.createBlankLayer('collision', terrainTileset, 0, 0, width, height, TILE_SIZE, TILE_SIZE);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (layers.collision[y][x] === 1) {
          const tile = collisionLayer.putTileAt(0, x, y); // Any tile index
          tile.setCollision(true);
        }
      }
    }
    collisionLayer.setDepth(1);
    collisionLayer.setVisible(false);

    this.collisionLayer = collisionLayer;
    this.map = map;

    // Set world bounds
    this.physics.world.setBounds(0, 0, width * TILE_SIZE, height * TILE_SIZE);
  }

  createPlayer() {
    // Find spawn point
    const spawn = this.mapData.objects.find(o => o.type === 'spawn');
    const px = (spawn?.x ?? 40) * TILE_SIZE + TILE_SIZE / 2;
    const py = (spawn?.y ?? 32) * TILE_SIZE + TILE_SIZE / 2;

    this.player = new Player(this, px, py);
    this.player.setCollideWorldBounds(true);

    // Collide with collision layer
    this.physics.add.collider(this.player, this.collisionLayer);
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

      // Collide player with NPC
      this.physics.add.collider(this.player, npc);
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
    // Get animal zone from map
    const animalZone = this.mapData.objects.find(o => o.type === 'animal_zone');
    if (!animalZone) return;

    const bounds = {
      x: animalZone.x * TILE_SIZE,
      y: animalZone.y * TILE_SIZE,
      width: animalZone.width * TILE_SIZE,
      height: animalZone.height * TILE_SIZE,
    };

    // Create some default animals
    const animalTypes = ['chicken', 'cow', 'sheep'];
    for (let i = 0; i < 3; i++) {
      const type = animalTypes[i % animalTypes.length];
      const px = bounds.x + Phaser.Math.Between(32, bounds.width - 32);
      const py = bounds.y + Phaser.Math.Between(32, bounds.height - 32);

      const animal = new Animal(this, px, py, type, bounds);
      this.animals.push(animal);
    }
  }

  setupCamera() {
    const cam = this.cameras.main;
    cam.startFollow(this.player, true, 0.08, 0.08);
    cam.setBounds(0, 0, this.mapData.width * TILE_SIZE, this.mapData.height * TILE_SIZE);
    cam.setZoom(1.5); // Zoom in for pixel art feel
  }

  setupSystems() {
    this.movementSystem = new MovementSystem(this);
    this.interactionSystem = new InteractionSystem(this);

    // Register all interactables
    for (const npc of this.npcs) {
      this.interactionSystem.register(npc, 'npc', {
        npcId: npc.npcId,
        name: npc.npcName,
      });
    }

    for (const plot of this.cropPlots) {
      this.interactionSystem.register(plot, 'farm_plot', {
        plotIndex: plot.plotIndex,
        state: plot.plotData?.state || 'empty',
      });
    }

    for (const building of this.buildings) {
      this.interactionSystem.register(building, 'building', {
        buildingId: building.buildingData.buildingId,
      });
    }

    for (const animal of this.animals) {
      this.interactionSystem.register(animal, 'animal', {
        animalType: animal.animalType,
      });
    }

    // Register war gate
    const warGate = this.mapData.objects.find(o => o.type === 'war_gate');
    if (warGate) {
      const gateMarker = this.add.text(
        warGate.x * TILE_SIZE + TILE_SIZE / 2,
        warGate.y * TILE_SIZE + TILE_SIZE / 2,
        '⚔️',
        { fontSize: '24px' }
      ).setOrigin(0.5).setDepth(8);

      // Create a physics sprite for interaction
      const gateZone = this.physics.add.sprite(
        warGate.x * TILE_SIZE + TILE_SIZE / 2,
        warGate.y * TILE_SIZE + TILE_SIZE / 2,
        null
      ).setVisible(false);
      gateZone.body.setAllowGravity(false);
      gateZone.body.setImmovable(true);

      this.interactionSystem.register(gateZone, 'war_gate', { name: 'War Gate' });
    }
  }

  setupEventBridge() {
    // Listen for overlay open/close to enable/disable input
    EventBridge.on('overlay:open', () => {
      this.player.setInputEnabled(false);
      this.movementSystem.setEnabled(false);
    });

    EventBridge.on('overlay:close', () => {
      this.player.setInputEnabled(true);
      this.movementSystem.setEnabled(true);
    });

    // Listen for game state updates
    EventBridge.on('game:plotsUpdated', (plots) => {
      this.updateCropPlots(plots);
    });

    EventBridge.on('game:animalsUpdated', (animals) => {
      this.updateAnimals(animals);
    });
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
    // Update animal statuses based on server data
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

  update(time, delta) {
    // Get movement velocity
    const velocity = this.movementSystem.getVelocity(this.player.speed);
    this.player.move(velocity.x, velocity.y);

    // Update interaction system
    this.interactionSystem.update(this.player);

    // Update animals
    for (const animal of this.animals) {
      animal.update(delta);
    }

    // Emit player position for minimap/HUD
    EventBridge.emit('player:moved', { x: this.player.x, y: this.player.y });
  }

  shutdown() {
    EventBridge.removeAllListeners('overlay:open');
    EventBridge.removeAllListeners('overlay:close');
    EventBridge.removeAllListeners('game:plotsUpdated');
    EventBridge.removeAllListeners('game:animalsUpdated');

    if (this.movementSystem) this.movementSystem.destroy();
    if (this.interactionSystem) this.interactionSystem.destroy();
  }
}
