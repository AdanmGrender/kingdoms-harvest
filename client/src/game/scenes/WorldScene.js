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
import { bakeWangTiles } from '../maps/WangAutotile';
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
import AmbientSystem from '../systems/AmbientSystem';
import { addStaticShadow, addTrackedShadow } from '../systems/ShadowSystem';
import { addGlow, addGroundGlow } from '../systems/GlowLights';
import { buildZoneAnchor, ZONE_TILES } from '../systems/ZoneAnchors';
import ZoneStreamer from '../systems/ZoneStreamer';
import { BUILDING_LIGHTS } from '../config/buildingSprites';
import EventBridge from '../EventBridge';

const FOG_TINT = 0x202040;
const FOG_ALPHA = 0.55;

// Shadow profile per decoration type — rocks/flowers are too flat to cast
// shadows. SE-direction sun: offsetX/offsetY both positive, scaled by
// the object's perceived height; subtle CW rotation on tall things.
const DECOR_SHADOW_PROFILE = {
  tree: { width: 32, height: 8, alpha: 0.35, offsetX: 10, offsetY: 14, rotation: 0.18 },
  bush: { width: 18, height: 5, alpha: 0.3,  offsetX: 4,  offsetY: 8,  rotation: 0 },
};

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
    this.zoneStreamer = null;
    this.decalSpots = [];
    this.ambientSystem = null;
    this.glows = [];
  }

  create() {
    // Modo hub (Task 11): pantalla-ancla compacta con cámara fija sobre la
    // base — no se streamea el mundo gigante ni se permite paneo. Se lee UNA
    // vez acá (el registry no cambia dinámicamente durante la vida de la
    // escena: PhaserGame crea el juego una sola vez por mount).
    this.hubMode = !!this.registry.get('hubMode');
    // Inicializar hubZonesBuilt (se usa en buildHubZones para idempotencia)
    this.hubZonesBuilt = new Set();

    const player = useGameStore.getState().player;
    const seed = player?.telegram_id ?? player?.id ?? 42;

    this.mapData = generateMap({ seed, width: MAP_W, height: MAP_H });
    // Legacy-shape objects array: services/createXxx methods read this.
    this.mapData.objects = this.deriveObjects(this.mapData);

    // Bake biome-edge transition textures (Wang tiles) before terrain draws.
    // MUST exist before the first buildZone() call (wang.resolve is per-tile).
    this.wang = bakeWangTiles(this);

    // Streaming por zonas: terreno + decals + decoraciones + anclas de zona se
    // construyen SOLO para las zonas visibles (+1 de margen) y se destruyen al
    // salir de cámara. El gameplay (edificios, NPCs, cultivos, animales,
    // aldeanos, marcadores de recursos, estructuras) NO se streamea.
    this.decalSpots = this.computeDecalSpots();
    // Modo hub: la cámara nunca se mueve, así que no hace falta streamear
    // zonas dentro/fuera — se construyen una sola vez las que cubren el
    // viewport fijo (ver buildHubZones(), llamado tras setupCamera()).
    this.zoneStreamer = this.hubMode ? null : new ZoneStreamer(this, this.mapData, {
      tileSize: TILE_SIZE,
      buildZone: (zx, zy) => this.buildZone(zx, zy),
    });

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
    if (this.hubMode) {
      // Base compacta: construye de una sola vez las zonas bajo la cámara
      // fija (equivalente al "primer stream inmediato" de abajo, pero sin
      // streamer — la cámara no se va a mover).
      this.buildHubZones();
      this.buildHubAnchor();
    } else {
      // Primer stream inmediato: la cámara ya está centrada en el spawn, así
      // el jugador nunca ve el piso vacío (worldView aún no existe →
      // ZoneStreamer deriva el rect desde scroll/zoom).
      this.zoneStreamer.update(true);
    }
    this.setupSystems();
    this.setupEventBridge();

    // Keep camera viewport in sync with canvas. Don't auto-zoom — that kills
    // drag-pan space when viewport >= world. Margins past the world get the
    // terrain-tinted backgroundColor (config.js) instead of black so it reads
    // as "off the edge of the map" rather than a render failure.
    this.scale.on('resize', (gameSize) => {
      this.cameras.main.setSize(gameSize.width, gameSize.height);
      if (this.hubMode) {
        // Cámara fija: re-centrar sobre la base tras un resize (el ancho/alto
        // usados por centerOn() cambian con el viewport).
        const spawn = this.mapData.spawn;
        this.cameraSystem.centerOn(spawn.x * TILE_SIZE, spawn.y * TILE_SIZE);
        // Si el viewport creció, la cobertura construida en create() puede
        // haber quedado corta (+1 zona de margen ya no alcanza) y aparecería
        // piso vacío en el borde. buildHubZones() es idempotente vía
        // hubZonesBuilt — re-llamarla solo construye las zonas NUEVAS que
        // quedaron expuestas, sin duplicar las ya existentes.
        this.buildHubZones();
      }
    });
  }

  /**
   * Modo hub: construye las zonas de terreno/decals/anclas que caen bajo el
   * viewport fijo de la cámara (+1 zona de margen). Idempotente vía
   * hubZonesBuilt (Set de claves "zx,zy") — llamable de nuevo tras un resize
   * que agrande el viewport sin re-construir zonas ya existentes. No hay
   * streaming continuo — la cámara no se mueve en este modo (CameraSystem
   * queda deshabilitado en setupCamera()).
   */
  buildHubZones() {
    const cam = this.cameras.main;
    const viewW = cam.width / cam.zoom;
    const viewH = cam.height / cam.zoom;
    // Mismo cálculo de fallback que ZoneStreamer._viewRect(): worldView aún
    // no existe en el primer frame (se actualiza en preRender), así que se
    // deriva desde scroll/zoom. centerOn() ya dejó scrollX/Y tal que
    // scroll + width/2 == centro pedido, independientemente del zoom.
    const view = {
      x: cam.scrollX + cam.width / 2 - viewW / 2,
      y: cam.scrollY + cam.height / 2 - viewH / 2,
      right: cam.scrollX + cam.width / 2 + viewW / 2,
      bottom: cam.scrollY + cam.height / 2 + viewH / 2,
    };
    const zonePx = ZONE_TILES * TILE_SIZE;
    const zonesX = Math.ceil(this.mapData.width / ZONE_TILES);
    const zonesY = Math.ceil(this.mapData.height / ZONE_TILES);
    const margin = 1;
    const zx0 = Math.max(0, Math.floor(view.x / zonePx) - margin);
    const zy0 = Math.max(0, Math.floor(view.y / zonePx) - margin);
    const zx1 = Math.min(zonesX - 1, Math.floor((view.right - 1) / zonePx) + margin);
    const zy1 = Math.min(zonesY - 1, Math.floor((view.bottom - 1) / zonePx) + margin);
    for (let zy = zy0; zy <= zy1; zy++) {
      for (let zx = zx0; zx <= zx1; zx++) {
        const key = `${zx},${zy}`;
        if (this.hubZonesBuilt.has(key)) continue;
        this.buildZone(zx, zy);
        this.hubZonesBuilt.add(key);
      }
    }
  }

  /**
   * Ancla ÚNICA del hub: una sola imagen de terreno (zone_hub) centrada en el
   * spawn, dibujada SOBRE las anclas por zona (depth 0.52 vs 0.5) y BAJO los
   * decals (depth 1) y el gameplay. La vista fija del Bastión cae justo en la
   * esquina donde se juntan 4 zonas con imágenes IA distintas → sin esto el
   * piso se ve "partido en 4" con costuras en cruz. Mismo tinte que las anclas
   * para que el gameplay siga resaltando. No-op si falta el arte (fallback).
   */
  buildHubAnchor() {
    if (!this.textures.exists('zone_hub')) return;
    const spawn = this.mapData.spawn;
    // 1600×1067 world px (aspecto 3:2 del arte): cubre de sobra el viewport a
    // zoom 1.4 incluso en desktop ancho; más allá siguen las anclas por zona.
    this.add.image(spawn.x * TILE_SIZE, spawn.y * TILE_SIZE, 'zone_hub')
      .setOrigin(0.5, 0.5)
      .setDisplaySize(1600, 1067)
      .setTint(0x6b6b73)
      .setDepth(0.52);
  }

  // ───────────────────────────────────────────────────────────
  //  Terrain / decoration / resource rendering (top-down 64px)
  // ───────────────────────────────────────────────────────────

  tileToPx(gx, gy) {
    return { px: gx * TILE_SIZE + TILE_SIZE / 2, py: gy * TILE_SIZE + TILE_SIZE / 2 };
  }

  /**
   * Decals: manchas de óxido/sangre/grietas sobre el terreno (seeded por
   * mapa — mismo mundo, mismas cicatrices). "Suelo con historia" grimdark.
   * Solo DATA (posiciones + frame) — los sprites los crea buildZone() cuando
   * la zona del decal entra a cámara. La secuencia del PRNG replica el orden
   * de consumo original (x, y, [frame]) para que el mundo no cambie.
   */
  computeDecalSpots() {
    const spots = [];
    if (!this.textures.exists('ground_decals')) return spots;
    const { terrain, width, height } = this.mapData;
    let seed = (this.mapData.seed || 42) * 7 + 13;
    const rand = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 160; i++) {
      const x = Math.floor(rand() * width);
      const y = Math.floor(rand() * height);
      // Nieve/hielo limpios — el óxido y la sangre viven en el resto
      if (terrain[y]?.[x] === BIOMES.SNOW || terrain[y]?.[x] === BIOMES.ICE) continue;
      spots.push({ x, y, frame: Math.floor(rand() * 8) });
    }
    return spots;
  }

  /**
   * Construye TODOS los objetos de render de una zona de 8×8 tiles:
   * tiles de terreno (Wang/camino), ancla de zona, decals y decoraciones.
   * Llamado por ZoneStreamer cuando la zona entra a cámara; los objetos
   * devueltos se destruyen cuando sale. Determinista e idempotente.
   * @returns {Phaser.GameObjects.GameObject[]}
   */
  buildZone(zx, zy) {
    const objs = [];
    const { tileVariants, terrain, width, height } = this.mapData;
    const x0 = zx * ZONE_TILES;
    const y0 = zy * ZONE_TILES;
    const x1 = Math.min(x0 + ZONE_TILES, width);
    const y1 = Math.min(y0 + ZONE_TILES, height);

    // ── Terreno (tiles 64px, Wang autotile per-tile) ──
    for (let y = y0; y < y1; y++) {
      for (let x = x0; x < x1; x++) {
        const { px, py } = this.tileToPx(x, y);
        let textureKey;
        if (terrain[y][x] === BIOMES.ROAD) {
          textureKey = `iso_tile_${this.pickRoadTile(x, y)}`;
        } else {
          // Wang resolver returns a plain tile when all neighbors match, else a
          // pre-baked transition texture toward the nearest differing biome.
          textureKey = this.wang.resolve(x, y, terrain, width, height, tileVariants);
        }
        const tile = this.add.image(px, py, textureKey);
        tile.setOrigin(0.5, 0.5);
        tile.setDepth(0);
        // terrainSprites se mantiene coherente con lo streameado: entra al
        // crear la zona, sale cuando ZoneStreamer destruye el tile.
        const mapKey = `${x},${y}`;
        this.terrainSprites.set(mapKey, tile);
        tile.once('destroy', () => {
          if (this.terrainSprites.get(mapKey) === tile) this.terrainSprites.delete(mapKey);
        });
        objs.push(tile);
      }
    }

    // ── Ancla de zona: piso de terreno IA por bioma sobre los tiles planos
    // (§ ZoneAnchors). Null si el arte no está cargado → fallback a los tiles.
    const anchor = buildZoneAnchor(this, this.mapData, zx, zy, { tileSize: TILE_SIZE });
    if (anchor) objs.push(anchor);

    // ── Decals cuyo tile cae dentro de la zona ──
    for (const d of this.decalSpots) {
      if (d.x < x0 || d.x >= x1 || d.y < y0 || d.y >= y1) continue;
      const { px, py } = this.tileToPx(d.x, d.y);
      objs.push(
        this.add.image(px, py, 'ground_decals', d.frame).setDepth(1).setAlpha(0.8)
      );
    }

    // ── Decoraciones (árboles/arbustos/rocas) dentro de la zona ──
    for (const d of this.mapData.decorations) {
      if (d.x < x0 || d.x >= x1 || d.y < y0 || d.y >= y1) continue;
      const { px, py } = this.tileToPx(d.x, d.y);
      const profile = DECOR_SHADOW_PROFILE[d.type];
      if (profile) {
        objs.push(addStaticShadow(this, px, py, { ...profile, depth: 1 }));
      }
      const sprite = this.add.image(px, py, `iso_env_${d.tileId}`);
      sprite.setOrigin(0.5, 0.7);
      sprite.setDepth(50 + d.y * 10 + d.x); // below buildings (buildings start at y*100)
      objs.push(sprite);
    }

    return objs;
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
      // Procedural structures (windmill/ruins/etc.) — small SE projection
      addStaticShadow(this, px, py, {
        width: 28, height: 8, alpha: 0.35, depth: 1,
        offsetX: 8, offsetY: 8, rotation: 0.15,
      });
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

    // NPCs scattered — offsets chosen to AVOID occupying the same tile as any
    // starter building above. Each NPC stands one tile adjacent to their
    // home/work building, never on it.
    // Nombres grimdark (títulos ominosos, IP-safe — solo strings de display;
    // los npcId internos siguen intactos).
    const npcSpots = [
      { npcId: 'farmer',   dx:  2, dy:  5, name: 'Siervo' },       // east of farm_plots
      { npcId: 'baker',    dx:  4, dy:  0, name: 'Racionero' },    // NE of mill
      { npcId: 'merchant', dx: -4, dy: -1, name: 'Chatarrero' },  // east of market
      { npcId: 'knight',   dx: -5, dy:  4, name: 'Centinela' },    // east of barracks
      { npcId: 'princess', dx:  2, dy: -2, name: 'La Heredera' },  // east of throne_room
      { npcId: 'wizard',   dx:  6, dy:  0, name: 'El Augur' },     // SE of tavern
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
      // Player buildings are the tallest entities — biggest SE shadow
      addStaticShadow(this, px, py, {
        width: 72, height: 22, alpha: 0.45, depth: 1,
        offsetX: 18, offsetY: 22, rotation: 0.20,
      });
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
      // NPCs are short — small SE drift, no rotation
      addStaticShadow(this, px, py, {
        width: 22, height: 7, alpha: 0.35, depth: 1,
        offsetX: 6, offsetY: 16, rotation: 0,
      });
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
      animal._shadow = addTrackedShadow(this, animal, {
        width: 20, height: 7, alpha: 0.35,
        offsetX: 5, offsetY: 10, depth: 1,
      });
      this.animals.push(animal);
    }
  }

  createVillagers() {
    const defaults = [
      { id: 1, name: 'Korvath', role: 'farmer',  state: 'idle' },
      { id: 2, name: 'Draust',  role: 'builder', state: 'idle' },
      { id: 3, name: 'Vael',    role: 'soldier', state: 'idle' },
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
    const spawn = this.mapData.spawn;
    if (this.hubMode) {
      // Base compacta, cámara fija: zoom in sobre la base (spawn = centro de
      // la base — mismo punto que usa deriveObjects() para anclar todos los
      // edificios iniciales) y sin input de cámara (drag/zoom/pan/teclado).
      this.cameraSystem.setZoom(1.4);
      this.cameraSystem.centerOn(spawn.x * TILE_SIZE, spawn.y * TILE_SIZE);
      this.cameraSystem.setEnabled(false);
    } else {
      this.cameraSystem.setZoom(1.0);
      this.cameraSystem.centerOn(spawn.x * TILE_SIZE, spawn.y * TILE_SIZE);
    }
  }

  setupSystems() {
    this.selectionSystem = new SelectionSystem(this);
    this.placementSystem = new BuildingPlacementSystem(this);
    this.dayNightSystem = new DayNightSystem(this);
    this.particleSystem = new ParticleSystem(this);
    // Ambiente grimdark: viñeta de bordes + cielo tormenta de backdrop
    // (desactivable en Configuración para teléfonos lentos)
    if (AmbientSystem.enabledInSettings()) {
      this.ambientSystem = new AmbientSystem(this, { sky: true, vignette: true });
    }

    // Tormenta Disforme (F2): la viñeta pulsa del color de la tormenta
    this._onStormStarted = (storm) => this.ambientSystem?.setStormMode(true, storm?.color);
    this._onStormEnded = () => this.ambientSystem?.setStormMode(false);
    EventBridge.on('storm:started', this._onStormStarted);
    EventBridge.on('storm:ended', this._onStormEnded);

    for (const building of this.buildings) {
      const id = building.buildingData.buildingId;
      if (['mill', 'smithy', 'barn', 'tavern'].includes(id)) {
        this.particleSystem.addBuildingSmoke(building.x, building.y);
      }
      // Luces falsas por edificio (holo teal, velas, forja) — brillan de noche.
      // Cada luz: el punto elevado + un charco que derrama color al piso.
      for (const l of BUILDING_LIGHTS[id] || []) {
        this.glows.push(addGlow(this, building.x + l.dx, building.y + l.dy, {
          color: l.color, radius: l.radius, depth: 950,
        }));
        this.glows.push(addGroundGlow(this, building.x + l.dx, building.y + 18, {
          color: l.color, radius: l.radius * 1.35, depth: 2,
        }));
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
    addStaticShadow(this, px, py, {
      width: 72, height: 22, alpha: 0.45, depth: 1,
      offsetX: 18, offsetY: 22, rotation: 0.20,
    });
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
    // Streaming de zonas: throttled internamente (~4 checks/s vía scene.time.now)
    if (this.zoneStreamer) this.zoneStreamer.update();
    this.cameraSystem.update(delta);
    this.dayNightSystem.update(delta);
    this.selectionSystem.update();
    for (const animal of this.animals) {
      const visible = this.isOnScreen(animal);
      animal.setVisible(visible);
      if (animal._shadow) {
        animal._shadow.setVisible(visible);
        if (visible) {
          animal._shadow.x = animal.x + animal._shadow._shadowOffsetX;
          animal._shadow.y = animal.y + animal._shadow._shadowOffsetY;
        }
      }
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

    if (this.zoneStreamer) { this.zoneStreamer.destroy(); this.zoneStreamer = null; }
    if (this.cameraSystem) this.cameraSystem.destroy();
    if (this.selectionSystem) this.selectionSystem.destroy();
    if (this.particleSystem) this.particleSystem.destroy();
    if (this.dayNightSystem) this.dayNightSystem.destroy();
    if (this.placementSystem) this.placementSystem.destroy();
    if (this._onStormStarted) EventBridge.off('storm:started', this._onStormStarted);
    if (this._onStormEnded) EventBridge.off('storm:ended', this._onStormEnded);
    if (this.ambientSystem) this.ambientSystem.destroy();
    for (const g of this.glows) g.destroy();
    this.glows = [];
  }
}
