/**
 * IsoWorldScene — experimental isometric pixel-art world.
 *
 * Coordinate system:
 *   Grid (col, row) → Screen via isoToScreen()
 *   Screen → Grid via screenToIso() (for tap detection)
 *
 * Depth rule: sprites at grid (col, row) get depth = col + row.
 *   Decorations: +0.2, buildings: +0.6 (so they stack naturally).
 *
 * Activation: set VITE_ISO_MODE=true in client/.env.local
 */
import Phaser from 'phaser';
import CameraSystem from '../systems/CameraSystem';
import EventBridge from '../EventBridge';

// ─── Constants ────────────────────────────────────────────────────────────────
const ISO_W  = 64;
const ISO_H  = 32;
const COLS   = 32;
const ROWS   = 32;

// Map origin (world-space position of tile (0,0) top vertex)
const ORIGIN_X = COLS * (ISO_W / 2);
const ORIGIN_Y = 80;

// World canvas size
const WORLD_W = (COLS + ROWS) * (ISO_W / 2) + ISO_W;
const WORLD_H = (COLS + ROWS) * (ISO_H / 2) + ORIGIN_Y + 120;

// Terrain tile indices (matching iso_terrain.png frames)
const T = { GRASS_DARK: 0, GRASS: 1, GRASS_LIGHT: 2, DIRT: 3, STONE: 4, WATER: 5, SAND: 6 };

// ─── Coordinate math ─────────────────────────────────────────────────────────

function isoToScreen(col, row) {
  return {
    x: ORIGIN_X + (col - row) * (ISO_W / 2),
    y: ORIGIN_Y + (col + row) * (ISO_H / 2),
  };
}

function screenToIso(wx, wy) {
  const rx = wx - ORIGIN_X;
  const ry = wy - ORIGIN_Y;
  return {
    col: Math.floor((rx / (ISO_W / 2) + ry / (ISO_H / 2)) / 2),
    row: Math.floor((ry / (ISO_H / 2) - rx / (ISO_W / 2)) / 2),
  };
}

// Bottom-center of a tile's diamond (where objects "stand")
function isoFoot(col, row) {
  const { x, y } = isoToScreen(col, row);
  return { x, y: y + ISO_H };
}

// ─── Map generation ───────────────────────────────────────────────────────────

function buildMap() {
  const seed = 1337;
  const tiles = [];

  for (let row = 0; row < ROWS; row++) {
    tiles[row] = [];
    for (let col = 0; col < COLS; col++) {
      // Multi-octave pseudo-noise (no external lib)
      const n = Math.sin(col * 0.38 + seed * 1.1) * Math.cos(row * 0.38 + seed * 0.73)
              + Math.sin(col * 0.12 + row * 0.15 + seed * 0.4) * 0.5;

      if (n > 0.75)       tiles[row][col] = T.STONE;
      else if (n > 0.35)  tiles[row][col] = T.DIRT;
      else if (n < -0.70) tiles[row][col] = T.WATER;
      else if (n < -0.35) tiles[row][col] = T.GRASS_LIGHT;
      else if (Math.abs(n) < 0.08) tiles[row][col] = T.GRASS_DARK;
      else                tiles[row][col] = T.GRASS;
    }
  }

  // Clear a central settlement zone
  for (let row = 10; row <= 22; row++) {
    for (let col = 10; col <= 22; col++) {
      tiles[row][col] = T.GRASS;
    }
  }

  // Dirt roads through the center
  for (let i = 1; i < COLS - 1; i++) {
    tiles[16][i] = T.DIRT;
    tiles[i][16] = T.DIRT;
  }

  return tiles;
}

// ─── Scene ────────────────────────────────────────────────────────────────────

export default class IsoWorldScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IsoWorldScene' });

    this.tiles      = [];      // [row][col] = tileIndex
    this.groundRT   = null;    // RenderTexture for static ground
    this.buildings  = [];      // Phaser.GameObjects.Image[]
    this.decorations = [];     // Phaser.GameObjects.Image[]

    this.ghostSprite     = null;
    this.pendingBuildId  = null;
    this.pendingFrame    = null;
    this._ghostMove      = null; // bound handler for cleanup
    this.cameraSystem    = null;
  }

  // ─── Asset loading (isolated from BootScene) ────────────────────────────────
  preload() {
    // Show a simple loading message
    const { width, height } = this.cameras.main;
    this.add.text(width / 2, height / 2, 'Cargando modo isométrico...', {
      fontFamily: 'serif', fontSize: '18px', color: '#ffd700',
    }).setOrigin(0.5).setScrollFactor(0);

    this.load.spritesheet('iso_terrain', '/assets/game/iso/iso_terrain.png', {
      frameWidth: ISO_W, frameHeight: ISO_H,
    });
    this.load.spritesheet('iso_objects', '/assets/game/iso/iso_objects.png', {
      frameWidth: 64, frameHeight: 96,
    });
    // Reuse building sprites from BootScene load
  }

  // ─── Scene setup ─────────────────────────────────────────────────────────────
  create() {
    this.tiles = buildMap();

    this._renderGround();
    this._placeDecorations();
    this._placeStartingBuildings();
    this._setupCamera();
    this._setupInput();
    this._setupEventBridge();

    // Start centered on settlement
    const center = isoToScreen(16, 16);
    this.cameras.main.centerOn(center.x, center.y);

    this.scale.on('resize', (gs) => {
      this.cameras.main.setSize(gs.width, gs.height);
    });
  }

  // ─── Ground (RenderTexture — static, no per-tile depth sorting needed) ───────
  _renderGround() {
    this.groundRT = this.add.renderTexture(0, 0, WORLD_W, WORLD_H);
    this.groundRT.setDepth(-1);

    for (let row = 0; row < ROWS; row++) {
      for (let col = 0; col < COLS; col++) {
        const frame = this.tiles[row][col];
        const { x, y } = isoToScreen(col, row);
        // drawFrame positions by top-left of frame bounding box
        this.groundRT.drawFrame('iso_terrain', frame, x - ISO_W / 2, y);
      }
    }
  }

  // ─── Decorations ─────────────────────────────────────────────────────────────
  _placeDecorations() {
    // Frame: 0=pine, 1=bare-tree, 2=rock, 3=bush
    const layout = [
      [2, 2, 0], [5, 1, 0], [1, 8, 0], [4, 5, 1],
      [28, 3, 1], [30, 7, 0], [29, 12, 2], [27, 18, 3],
      [2, 20, 0], [3, 26, 0], [7, 28, 2], [24, 27, 3],
      [28, 24, 0], [31, 20, 1], [6, 14, 3], [25, 8, 2],
      [0, 15, 0], [15, 0, 1], [30, 15, 0], [15, 30, 0],
    ];

    for (const [col, row, frame] of layout) {
      // Only place on non-water, non-building tiles
      if (this.tiles[row]?.[col] === T.WATER) continue;
      const foot = isoFoot(col, row);
      const dec = this.add.image(foot.x, foot.y, 'iso_objects', frame);
      dec.setOrigin(0.5, 1.0);
      dec.setDepth(col + row + 0.2);
      this.decorations.push(dec);
    }
  }

  // ─── Starting buildings ───────────────────────────────────────────────────────
  _placeStartingBuildings() {
    // [col, row, buildingFrame, buildingId]
    // Uses the existing buildings.png (128×128 frames, isometric-styled)
    const layout = [
      [12, 12,  14, 'farm_plot'],
      [14, 12,  14, 'farm_plot'],
      [16, 12,  14, 'farm_plot'],
      [18, 12,  14, 'farm_plot'],
      [12, 14,   0, 'barn'],
      [15, 14,   5, 'tavern'],
      [18, 14,   6, 'market'],
      [12, 17,   1, 'mill'],
      [17, 17,   4, 'barracks'],
      [20, 13,   3, 'tower'],
      [14, 19,  10, 'smithy'],
      [19, 19,   7, 'throne_room'],
    ];

    for (const [col, row, frame, id] of layout) {
      this._addBuilding(col, row, frame, id, false);
    }
  }

  // ─── Add building sprite ──────────────────────────────────────────────────────
  _addBuilding(col, row, frame, buildingId, interactive = true) {
    const foot = isoFoot(col, row);

    const bldg = this.add.image(foot.x, foot.y, 'buildings', frame);
    // Anchor at ~85% height so base of drawn building sits at foot point
    bldg.setOrigin(0.5, 0.88);
    bldg.setDepth(col + row + 0.6);
    bldg.setData('buildingId', buildingId);
    bldg.setData('col', col);
    bldg.setData('row', row);

    if (interactive) {
      bldg.setInteractive();
      bldg.on('pointerover', () => bldg.setTint(0xdddddd));
      bldg.on('pointerout', () => bldg.clearTint());
      bldg.on('pointerdown', () => this._selectBuilding(bldg));
    }

    this.buildings.push(bldg);
    return bldg;
  }

  _selectBuilding(bldg) {
    EventBridge.emit('entity:selected', {
      entityType: 'building',
      data: {
        id:          bldg.getData('buildingId'),
        building_id: bldg.getData('buildingId'),
        x:           bldg.getData('col'),
        y:           bldg.getData('row'),
      },
    });
  }

  // ─── Camera ───────────────────────────────────────────────────────────────────
  _setupCamera() {
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameraSystem = new CameraSystem(this);
  }

  // ─── Input (tap on tiles) ─────────────────────────────────────────────────────
  _setupInput() {
    this.input.on('pointerdown', (pointer) => {
      // Skip if placement mode is active (handled by ghost)
      if (this.pendingBuildId) return;

      const { col, row } = screenToIso(pointer.worldX, pointer.worldY);
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        this._onTileTap(col, row);
      }
    });
  }

  _onTileTap(col, row) {
    const tileType = this.tiles[row]?.[col];
    if (tileType === undefined) return;

    EventBridge.emit('entity:selected', {
      entityType: 'tile',
      data: { col, row, tileType },
    });
  }

  // ─── Building placement ───────────────────────────────────────────────────────
  _startPlacement(buildingId, frame) {
    this.pendingBuildId = buildingId;
    this.pendingFrame   = frame;

    if (this.ghostSprite) this.ghostSprite.destroy();
    this.ghostSprite = this.add.image(0, 0, 'buildings', frame);
    this.ghostSprite.setOrigin(0.5, 0.88);
    this.ghostSprite.setAlpha(0.65);
    this.ghostSprite.setTint(0x44ff88);
    this.ghostSprite.setDepth(10000);
    this.ghostSprite.setVisible(false);

    this._ghostMove = (pointer) => this._updateGhost(pointer);
    this.input.on('pointermove', this._ghostMove);

    // Tap to confirm placement
    this._ghostTap = (pointer) => {
      const { col, row } = screenToIso(pointer.worldX, pointer.worldY);
      if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
        this._confirmPlacement(col, row);
      }
    };
    this.input.on('pointerdown', this._ghostTap);

    if (this.cameraSystem) this.cameraSystem.setEnabled(false);
    EventBridge.emit('placement:started');
  }

  _updateGhost(pointer) {
    if (!this.ghostSprite) return;
    const { col, row } = screenToIso(pointer.worldX, pointer.worldY);

    if (col >= 0 && col < COLS && row >= 0 && row < ROWS) {
      const foot = isoFoot(col, row);
      this.ghostSprite.setPosition(foot.x, foot.y);
      this.ghostSprite.setVisible(true);
      const canPlace = this.tiles[row]?.[col] !== T.WATER;
      this.ghostSprite.setTint(canPlace ? 0x44ff88 : 0xff4444);
    } else {
      this.ghostSprite.setVisible(false);
    }
  }

  _confirmPlacement(col, row) {
    if (!this.pendingBuildId) return;
    if (this.tiles[row]?.[col] === T.WATER) return;

    const bldg = this._addBuilding(col, row, this.pendingFrame, this.pendingBuildId, true);
    bldg.setInteractive();
    bldg.on('pointerover', () => bldg.setTint(0xdddddd));
    bldg.on('pointerout', () => bldg.clearTint());
    bldg.on('pointerdown', () => this._selectBuilding(bldg));

    EventBridge.emit('building:placed', { buildingId: this.pendingBuildId, x: col, y: row });
    this._cancelPlacement();
  }

  _cancelPlacement() {
    this.pendingBuildId = null;
    this.pendingFrame   = null;
    if (this.ghostSprite) { this.ghostSprite.destroy(); this.ghostSprite = null; }
    if (this._ghostMove) { this.input.off('pointermove', this._ghostMove); this._ghostMove = null; }
    if (this._ghostTap)  { this.input.off('pointerdown', this._ghostTap);  this._ghostTap = null; }
    if (this.cameraSystem) this.cameraSystem.setEnabled(true);
    EventBridge.emit('placement:ended');
  }

  // ─── EventBridge wiring ───────────────────────────────────────────────────────
  _setupEventBridge() {
    EventBridge.on('building:startPlacement', ({ buildingId, tileIndex }) => {
      this._startPlacement(buildingId, tileIndex);
    });

    EventBridge.on('building:cancelPlacement', () => this._cancelPlacement());

    EventBridge.on('building:confirmPlacement', () => {
      if (!this.ghostSprite?.visible) return;
      const { col, row } = screenToIso(
        this.ghostSprite.x,
        this.ghostSprite.y - ISO_H,
      );
      this._confirmPlacement(col, row);
    });

    // When a building is added from the server (e.g. after placement confirmed by API)
    EventBridge.on('building:addToScene', ({ buildingId, posX, posY }) => {
      const info = this.game.registry.get('store')?.getState?.();
      if (!info) return;
      // posX/posY are iso grid coords when coming from IsoWorldScene placement
      const existing = this.buildings.find(
        b => b.getData('col') === posX && b.getData('row') === posY,
      );
      if (existing) existing.setInteractive();
    });
  }

  // ─── Update loop ──────────────────────────────────────────────────────────────
  update(_time, delta) {
    if (this.cameraSystem) this.cameraSystem.update(delta);
  }

  // ─── Cleanup ──────────────────────────────────────────────────────────────────
  shutdown() {
    EventBridge.off('building:startPlacement');
    EventBridge.off('building:cancelPlacement');
    EventBridge.off('building:confirmPlacement');
    EventBridge.off('building:addToScene');
  }
}
