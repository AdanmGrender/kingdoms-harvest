/**
 * WorldScene: RTS god-view overworld rendered on a per-player procedural map.
 *
 * Uses Kenney medieval-rts (top-down 64x64) via IsoMapGenerator. Same renderer
 * approach as IsoScene but keeps authed gameplay entities (Building, NPC,
 * CropPlot, Animal, Villager) and their systems on top.
 */
import Phaser from 'phaser';
import useGameStore from '../../store/gameStore';
import {
  generateMap,
  BIOMES,
  ROAD_CONNECTORS,
  RESOURCE_TYPES,
} from '../maps/IsoMapGenerator';
import { TILE_SIZE, MAP_W, MAP_H } from '../maps/tileConfig';
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

const FOG_TINT = 0x202040;
const FOG_ALPHA = 0.55;

const RESOURCE_BADGE_COLORS = {
  [RESOURCE_TYPES.WOOD]:  0x8b5a2b,
  [RESOURCE_TYPES.STONE]: 0xaaaaaa,
  [RESOURCE_TYPES.IRON]:  0x6ec1ff,
  [RESOURCE_TYPES.WHEAT]: 0xf5d742,
};

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
    this.terrainSprites = new Map();
  }

  create() {
    const player = useGameStore.getState().player;
    const seed = player?.telegram_id ?? player?.id ?? 42;

    this.mapData = generateMap({ seed, width: MAP_W, height: MAP_H });
    // Legacy-shape objects array: services/createXxx methods read this.
    this.mapData.objects = this.deriveObjects(this.mapData);

    this.drawTerrain();
    this.drawDecorations();
    this.drawResourceMarkers();
    this.markStructureSlots();

    // Physics bounds for world
    this.physics.world.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);

    this.createBuildings();
    this.createNPCs();
    this.createFarmPlots();
    this.createAnimals();
    this.createVillagers();
    this.setupCamera();
    this.setupSystems();
    this.setupEventBridge();

    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
    });
  }

  // ───────────────────────────────────────────────────────────
  //  Terrain / decoration / resource rendering (top-down 64px)
  // ───────────────────────────────────────────────────────────

  tileToPx(gx, gy) {
    return { px: gx * TILE_SIZE + TILE_SIZE / 2, py: gy * TILE_SIZE + TILE_SIZE / 2 };
  }

  drawTerrain() {
    const { tileVariants, terrain, width, height } = this.mapData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const { px, py } = this.tileToPx(x, y);
        const tileId =
          terrain[y][x] === BIOMES.ROAD
            ? this.pickRoadTile(x, y)
            : tileVariants[y][x];
        const tile = this.add.image(px, py, `iso_tile_${tileId}`);
        tile.setOrigin(0.5, 0.5);
        tile.setDepth(0);
        this.terrainSprites.set(`${x},${y}`, tile);
      }
    }
  }

  pickRoadTile(x, y) {
    const { terrain, width, height } = this.mapData;
    const isRoad = (nx, ny) =>
      nx >= 0 && ny >= 0 && nx < width && ny < height &&
      terrain[ny][nx] === BIOMES.ROAD;
    let mask = 0;
    if (isRoad(x, y - 1)) mask |= 0b0001; // N
    if (isRoad(x + 1, y)) mask |= 0b0010; // E
    if (isRoad(x, y + 1)) mask |= 0b0100; // S
    if (isRoad(x - 1, y)) mask |= 0b1000; // W
    const pool = ROAD_CONNECTORS.ON_GRASS;
    return pool[mask] ?? pool['*'];
  }

  drawDecorations() {
    const { decorations } = this.mapData;
    for (const d of decorations) {
      const { px, py } = this.tileToPx(d.x, d.y);
      const sprite = this.add.image(px, py, `iso_env_${d.tileId}`);
      sprite.setOrigin(0.5, 0.7);
      sprite.setDepth(50 + d.y * 10 + d.x); // below buildings (buildings start at y*100)
    }
  }

  drawResourceMarkers() {
    const ICONS = {
      [RESOURCE_TYPES.WOOD]: '🪵',
      [RESOURCE_TYPES.STONE]: '🪨',
      [RESOURCE_TYPES.IRON]: '⛏️',
      [RESOURCE_TYPES.WHEAT]: '🌾',
    };
    for (const r of this.mapData.resources) {
      const { px, py } = this.tileToPx(r.x, r.y);
      const badge = this.add.text(px, py - 14, ICONS[r.type] || '?', {
        fontSize: '14px',
        stroke: '#000',
        strokeThickness: 2,
      }).setOrigin(0.5).setDepth(55 + r.y * 10 + r.x);
      badge.resourceData = r;
    }
  }

  /** Procedural structures from generator → simple sprites (ruins, windmill, etc.). */
  markStructureSlots() {
    for (const s of this.mapData.structures) {
      // Skip slots we'll re-use for player buildings (starter buildings override these)
      const { px, py } = this.tileToPx(s.x, s.y);
      const sprite = this.add.image(px, py, `iso_struct_${s.tileId}`);
      sprite.setOrigin(0.5, 0.7);
      sprite.setDepth(60 + s.y * 10 + s.x);
    }
  }

  // ───────────────────────────────────────────────────────────
  //  Object derivation — legacy shape for entity creation
  // ───────────────────────────────────────────────────────────

  /**
   * Build a synthetic `.objects` array matching the old MapGenerator shape.
   * Starter buildings are placed at fixed offsets around the spawn (which is
   * walkable/safe by generator invariants).
   */
  deriveObjects(mapData) {
    const { spawn } = mapData;
    const objects = [{ type: 'spawn', x: spawn.x, y: spawn.y, name: 'player_spawn' }];

    // Starter buildings around the spawn (compact 32x32 layout)
    const S = {
      // Central keep
      throne_room: { dx:  0, dy: -2, tileIndex: 7 },
      // Production ring
      barn:        { dx: -3, dy:  1, tileIndex: 0 },
      mill:        { dx:  3, dy:  1, tileIndex: 1 },
      sawmill:     { dx: -3, dy:  3, tileIndex: 11 },
      smithy:      { dx:  3, dy:  3, tileIndex: 10 },
      // Commerce / civic
      market:      { dx: -5, dy: -1, tileIndex: 6 },
      tavern:      { dx:  5, dy: -1, tileIndex: 5 },
      // Military
      barracks:    { dx: -6, dy:  4, tileIndex: 4 },
      tower:       { dx:  6, dy:  4, tileIndex: 3 },
    };
    for (const [buildingId, spec] of Object.entries(S)) {
      const x = spawn.x + spec.dx, y = spawn.y + spec.dy;
      if (x < 1 || y < 1 || x >= mapData.width - 1 || y >= mapData.height - 1) continue;
      objects.push({ type: 'building', buildingId, x, y, tileIndex: spec.tileIndex });
    }

    // Farm plots — 3 tiles in a row just south of spawn
    for (let i = 0; i < 3; i++) {
      objects.push({
        type: 'farm_plot',
        plotIndex: i,
        x: spawn.x - 1 + i,
        y: spawn.y + 5,
      });
    }

    // Animal pasture zone (east of spawn)
    objects.push({
      type: 'animal_zone',
      x: spawn.x + 4, y: spawn.y + 3,
      width: 3, height: 3,
      name: 'pasture',
    });

    // NPCs scattered (check in-bounds)
    const npcSpots = [
      { npcId: 'farmer',   dx:  0, dy:  5, name: 'Granjero' },
      { npcId: 'baker',    dx:  2, dy: -1, name: 'Panadero' },
      { npcId: 'merchant', dx: -5, dy: -1, name: 'Comerciante' },
      { npcId: 'knight',   dx: -6, dy:  4, name: 'Capitán' },
      { npcId: 'princess', dx:  0, dy: -3, name: 'Princesa' },
      { npcId: 'wizard',   dx:  5, dy: -2, name: 'Mago' },
    ];
    for (const n of npcSpots) {
      const x = spawn.x + n.dx, y = spawn.y + n.dy;
      if (x < 1 || y < 1 || x >= mapData.width - 1 || y >= mapData.height - 1) continue;
      objects.push({ type: 'npc', npcId: n.npcId, x, y, name: n.name });
    }

    // War gate — at the westmost edge relative to spawn
    const gateX = Math.max(1, spawn.x - 10);
    objects.push({ type: 'war_gate', x: gateX, y: spawn.y + 2, name: 'War Gate' });

    // Resource zones derived from generator resources — group by type.
    const zoneByType = {};
    for (const r of mapData.resources) {
      if (!zoneByType[r.type]) zoneByType[r.type] = { type: 'resource_zone', resource: r.type, x: r.x, y: r.y, name: r.type };
    }
    for (const z of Object.values(zoneByType)) objects.push(z);

    return objects;
  }

  // ───────────────────────────────────────────────────────────
  //  Entity creation (Building / NPC / Farm / Animal / Villager)
  // ───────────────────────────────────────────────────────────

  createBuildings() {
    const buildingObjects = this.mapData.objects.filter(o => o.type === 'building');
    for (const obj of buildingObjects) {
      const { px, py } = this.tileToPx(obj.x, obj.y);
      const building = new Building(this, px, py, {
        buildingId: obj.buildingId,
        tileIndex: obj.tileIndex,
        level: 1,
        is_building: false,
      });
      building.setDepth(100 + obj.y * 10 + obj.x);
      this.buildings.push(building);
    }
  }

  createNPCs() {
    const npcObjects = this.mapData.objects.filter(o => o.type === 'npc');
    for (const obj of npcObjects) {
      const { px, py } = this.tileToPx(obj.x, obj.y);
      const npc = new NPC(this, px, py, obj.npcId, obj.name);
      npc.setDepth(200 + obj.y * 10 + obj.x);
      this.npcs.push(npc);
    }
  }

  createFarmPlots() {
    const plotObjects = this.mapData.objects.filter(o => o.type === 'farm_plot');
    for (const obj of plotObjects) {
      const { px, py } = this.tileToPx(obj.x, obj.y);
      const plot = new CropPlot(this, px, py, {
        plotIndex: obj.plotIndex,
        state: 'empty',
        crop_id: null,
      });
      plot.setDepth(80 + obj.y * 10 + obj.x);
      this.cropPlots.push(plot);
    }
  }

  createAnimals() {
    const zone = this.mapData.objects.find(o => o.type === 'animal_zone');
    if (!zone) return;
    const bounds = {
      x: zone.x * TILE_SIZE,
      y: zone.y * TILE_SIZE,
      width: zone.width * TILE_SIZE,
      height: zone.height * TILE_SIZE,
    };
    const types = ['chicken', 'cow', 'sheep'];
    for (let i = 0; i < 3; i++) {
      const type = types[i % types.length];
      const px = bounds.x + Phaser.Math.Between(16, Math.max(16, bounds.width - 16));
      const py = bounds.y + Phaser.Math.Between(16, Math.max(16, bounds.height - 16));
      const animal = new Animal(this, px, py, type, bounds);
      animal.setDepth(150 + Math.floor(py / TILE_SIZE) * 10);
      this.animals.push(animal);
    }
  }

  createVillagers() {
    const defaults = [
      { id: 1, name: 'Aldric', role: 'farmer',  state: 'idle' },
      { id: 2, name: 'Brynn',  role: 'builder', state: 'idle' },
      { id: 3, name: 'Cedric', role: 'soldier', state: 'idle' },
    ];
    const spawn = this.mapData.spawn;
    const cx = spawn.x * TILE_SIZE + TILE_SIZE / 2;
    const cy = spawn.y * TILE_SIZE + TILE_SIZE / 2;
    for (const data of defaults) {
      const px = cx + Phaser.Math.Between(-48, 48);
      const py = cy + Phaser.Math.Between(-48, 48);
      const v = new Villager(this, px, py, data);
      v.setDepth(180);
      this.villagers.push(v);
    }
  }

  // ───────────────────────────────────────────────────────────
  //  Camera / systems / event bridge
  // ───────────────────────────────────────────────────────────

  setupCamera() {
    this.cameraSystem = new CameraSystem(this);
    this.cameraSystem.setBounds(0, 0, MAP_W * TILE_SIZE, MAP_H * TILE_SIZE);
    this.cameraSystem.setZoom(1.0);
    const spawn = this.mapData.spawn;
    this.cameraSystem.centerOn(spawn.x * TILE_SIZE, spawn.y * TILE_SIZE);
  }

  setupSystems() {
    this.selectionSystem = new SelectionSystem(this);
    this.placementSystem = new BuildingPlacementSystem(this);
    this.dayNightSystem = new DayNightSystem(this);
    this.particleSystem = new ParticleSystem(this);

    for (const building of this.buildings) {
      const id = building.buildingData.buildingId;
      if (['mill', 'smithy', 'barn', 'tavern'].includes(id)) {
        this.particleSystem.addBuildingSmoke(building.x, building.y);
      }
    }

    for (const npc of this.npcs) {
      this.selectionSystem.register(npc, 'npc', { npcId: npc.npcId, name: npc.npcName });
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
      this.selectionSystem.register(animal, 'animal', { animalType: animal.animalType });
    }
    for (const villager of this.villagers) {
      this.selectionSystem.register(villager, 'villager', {
        villagerId: villager.villagerData.id,
        name: villager.villagerData.name,
        role: villager.villagerData.role,
        state: villager.villagerData.state,
      });
    }

    const warGate = this.mapData.objects.find(o => o.type === 'war_gate');
    if (warGate) {
      const { px, py } = this.tileToPx(warGate.x, warGate.y);
      this.add.text(px, py, '⚔️', { fontSize: '24px' }).setOrigin(0.5).setDepth(90);
      const gateZone = this.add.sprite(px, py, null).setVisible(false);
      this.selectionSystem.register(gateZone, 'war_gate', { name: 'War Gate' });
    }
  }

  setupEventBridge() {
    EventBridge.on('overlay:open', () => { this.selectionSystem.setEnabled(false); });
    EventBridge.on('overlay:close', () => {
      this.selectionSystem.setEnabled(true);
      this.selectionSystem.deselect();
    });

    EventBridge.on('building:startPlacement', ({ buildingId, tileIndex }) => {
      const config = { tileWidth: 2, tileHeight: 2 };
      this.placementSystem.startPlacement(buildingId, config, tileIndex);
    });
    EventBridge.on('building:cancelPlacement', () => { this.placementSystem.cancel(); });
    EventBridge.on('building:confirmPlacement', () => {
      const result = this.placementSystem.confirmPlacement();
      if (result) EventBridge.emit('building:placed', result);
    });

    EventBridge.on('building:addToScene', (buildingData) => { this.addBuilding(buildingData); });
    EventBridge.on('game:plotsUpdated', (plots) => { this.updateCropPlots(plots); });
    EventBridge.on('game:animalsUpdated', (animals) => { this.updateAnimals(animals); });

    EventBridge.on('token:earned', ({ amount, x, y }) => {
      if (!this.particleSystem || amount <= 0) return;
      const cam = this.cameras.main;
      const wx = (x != null) ? x : cam.scrollX + cam.width / 2;
      const wy = (y != null) ? y : cam.scrollY + cam.height / 3;
      this.particleSystem.emitTokenGain(wx, wy, amount);
    });
  }

  addBuilding(buildingData) {
    const { px, py } = this.tileToPx(buildingData.posX, buildingData.posY);
    const building = new Building(this, px, py, buildingData);
    building.setDepth(100 + buildingData.posY * 10 + buildingData.posX);
    this.buildings.push(building);
    this.selectionSystem.register(building, 'building', { buildingId: buildingData.buildingId });
    if (this.particleSystem) this.particleSystem.emitConstructionDust(px, py);
  }

  updateCropPlots(plotsData) {
    if (!plotsData) return;
    for (const plot of this.cropPlots) {
      const serverPlot = plotsData.find(p => p.plotIndex === plot.plotIndex);
      if (serverPlot) plot.updateVisual(serverPlot);
    }
  }

  updateAnimals(animalsData) {
    if (!animalsData) return;
    for (let i = 0; i < this.animals.length && i < animalsData.length; i++) {
      const data = animalsData[i];
      if (!data.is_fed) this.animals[i].setStatus('hungry');
      else if (data.next_production_at && new Date(data.next_production_at) <= new Date()) this.animals[i].setStatus('ready');
      else this.animals[i].setStatus(null);
    }
  }

  isOnScreen(obj, margin = 128) {
    const cam = this.cameras.main;
    const cx = cam.scrollX - margin;
    const cy = cam.scrollY - margin;
    const cw = cam.width / cam.zoom + margin * 2;
    const ch = cam.height / cam.zoom + margin * 2;
    return obj.x >= cx && obj.x <= cx + cw && obj.y >= cy && obj.y <= cy + ch;
  }

  update(time, delta) {
    this.cameraSystem.update(delta);
    this.dayNightSystem.update(delta);
    this.selectionSystem.update();
    for (const animal of this.animals) {
      const visible = this.isOnScreen(animal);
      animal.setVisible(visible);
      if (visible) animal.update(delta);
    }
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
    EventBridge.removeAllListeners('token:earned');

    if (this.cameraSystem) this.cameraSystem.destroy();
    if (this.selectionSystem) this.selectionSystem.destroy();
    if (this.particleSystem) this.particleSystem.destroy();
    if (this.dayNightSystem) this.dayNightSystem.destroy();
    if (this.placementSystem) this.placementSystem.destroy();
  }
}
