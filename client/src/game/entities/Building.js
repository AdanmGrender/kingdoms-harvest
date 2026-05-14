/**
 * Building entity: Visual building sprite on the world map.
 * Supports construction state with per-building-type tint, NPC occupancy
 * tracking (activity glow), and worker particle effects for construction sites.
 */
import Phaser from 'phaser';
import EventBridge from '../EventBridge';

const BUILDING_SIZE = 112;
const TILE = 32;

// Color tint applied to the scaffold frame (frame 15) per building type
// Gives each building a unique look during construction
const CONSTRUCTION_TINTS = {
  barn:        0xd4a84b,
  mill:        0xb8b8b8,
  wall:        0x9ca3af,
  tower:       0x8a8fa3,
  barracks:    0xef4444,
  tavern:      0xd97706,
  market:      0xfbbf24,
  throne_room: 0xffd700,
  library:     0x3b82f6,
  stable:      0xc97706,
  smithy:      0x6b7280,
  sawmill:     0xa16207,
  embassy:     0xe2e8f0,
  trap:        0xf97316,
  farm_plot:   0x78350f,
  default:     0xd4a84b,
};

// Entrance pixel offset from building centre for each building type
// NPCs walk to this point before entering
const ENTRANCE_OFFSETS = {
  barn:        { dx:   0, dy: 48 },
  mill:        { dx:   0, dy: 48 },
  barracks:    { dx:   0, dy: 48 },
  market:      { dx: -18, dy: 48 },
  tavern:      { dx:   0, dy: 48 },
  library:     { dx:   0, dy: 48 },
  stable:      { dx:  18, dy: 48 },
  smithy:      { dx:   0, dy: 48 },
  sawmill:     { dx: -14, dy: 48 },
  embassy:     { dx:   0, dy: 48 },
  throne_room: { dx:   0, dy: 48 },
  default:     { dx:   0, dy: 48 },
};

export default class Building extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, buildingData) {
    super(scene, x, y, 'buildings', buildingData.tileIndex ?? 0);

    this.buildingData  = buildingData;
    this.occupants     = [];
    this.activityGlow  = null;
    this._workerPresent = false;
    this._dustEmitter  = null;

    scene.add.existing(this);
    this.setDepth(5);
    this.setDisplaySize(BUILDING_SIZE, BUILDING_SIZE);

    // Level indicator
    if (buildingData.level && buildingData.level > 1) {
      this.levelText = scene.add.text(x + 24, y + 24, `Lv${buildingData.level}`, {
        fontFamily: 'MedievalSharp, serif',
        fontSize: '10px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 2,
      }).setDepth(20).setOrigin(0.5);
    }

    // Construction state
    if (buildingData.is_building) {
      this._applyConstructionVisuals(buildingData.buildingId);
    }
  }

  _applyConstructionVisuals(buildingId) {
    this.setFrame(15);
    const tint = CONSTRUCTION_TINTS[buildingId] || CONSTRUCTION_TINTS.default;
    this.setTint(tint);

    this.constructionText = this.scene.add.text(this.x, this.y - 38, '🔨', {
      fontSize: '16px',
    }).setDepth(20).setOrigin(0.5);

    this.scene.tweens.add({
      targets:  this.constructionText,
      angle:    { from: -15, to: 15 },
      duration: 400,
      yoyo:     true,
      repeat:   -1,
    });
  }

  updateData(buildingData) {
    this.buildingData = buildingData;
    if (!buildingData.is_building) {
      this.clearTint();
      this.setFrame(buildingData.tileIndex ?? 0);
      if (this.constructionText) {
        this.constructionText.destroy();
        this.constructionText = null;
      }
      this._stopDust();
    }
  }

  // ─── Entrance helpers ────────────────────────────────────────────────────

  /**
   * Returns the tile coordinates of this building's entrance
   * (one tile below the building footprint, for A* pathfinding goal).
   */
  getEntranceTile() {
    const posX = this.buildingData.posX ?? Math.round((this.x / TILE) - 1);
    const posY = this.buildingData.posY ?? Math.round((this.y / TILE) - 1);
    return { x: posX + 1, y: posY + 2 };
  }

  /**
   * Returns the world pixel position of the entrance door.
   */
  getEntrancePixel() {
    const id  = this.buildingData.buildingId;
    const off = ENTRANCE_OFFSETS[id] || ENTRANCE_OFFSETS.default;
    return { x: this.x + off.dx, y: this.y + off.dy };
  }

  // ─── NPC occupancy ───────────────────────────────────────────────────────

  onNPCEnter(npc) {
    if (!this.occupants.includes(npc)) this.occupants.push(npc);
    if (this.occupants.length === 1) this._showActivityGlow();
    EventBridge.emit('building:occupancyChanged', {
      buildingId: this.buildingData.buildingId,
      posX: this.buildingData.posX,
      posY: this.buildingData.posY,
      occupantCount: this.occupants.length,
    });
  }

  onNPCExit(npc) {
    this.occupants = this.occupants.filter(o => o !== npc);
    if (this.occupants.length === 0) this._hideActivityGlow();
    EventBridge.emit('building:occupancyChanged', {
      buildingId: this.buildingData.buildingId,
      posX: this.buildingData.posX,
      posY: this.buildingData.posY,
      occupantCount: this.occupants.length,
    });
  }

  _showActivityGlow() {
    if (this.activityGlow) return;
    this.activityGlow = this.scene.add.text(this.x, this.y - 52, '✨', {
      fontSize: '14px',
    }).setDepth(15).setOrigin(0.5);

    this.scene.tweens.add({
      targets:  this.activityGlow,
      alpha:    { from: 1, to: 0.4 },
      duration: 700,
      yoyo:     true,
      repeat:   -1,
    });
  }

  _hideActivityGlow() {
    if (!this.activityGlow) return;
    this.scene.tweens.killTweensOf(this.activityGlow);
    this.activityGlow.destroy();
    this.activityGlow = null;
  }

  // ─── Builder worker particles ────────────────────────────────────────────

  /**
   * Called by NPCBehaviorSystem when a builder NPC arrives/leaves.
   * Shows dust particles on active construction sites.
   */
  setWorkerPresent(bool) {
    this._workerPresent = bool;
    if (bool && this.buildingData.is_building) {
      this._startDust();
    } else {
      this._stopDust();
    }
  }

  _startDust() {
    if (this._dustEmitter) return;
    try {
      const particles = this.scene.add.particles(this.x, this.y - 20, '__DEFAULT', {
        speed:     { min: 15, max: 40 },
        angle:     { min: 240, max: 300 },
        scale:     { start: 0.35, end: 0 },
        alpha:     { start: 0.7, end: 0 },
        lifespan:  900,
        tint:      [0xd4b483, 0xb0a090, 0xe8d8c0],
        frequency: 300,
        quantity:  1,
        depth:     12,
      });
      this._dustEmitter = particles;
    } catch (_) {
      // Particle API differences across Phaser versions — degrade gracefully
    }
  }

  _stopDust() {
    if (!this._dustEmitter) return;
    try { this._dustEmitter.destroy(); } catch (_) { /* ignore */ }
    this._dustEmitter = null;
  }

  destroy(fromScene) {
    if (this.levelText)        this.levelText.destroy();
    if (this.constructionText) this.constructionText.destroy();
    if (this.activityGlow)     { this.scene.tweens.killTweensOf(this.activityGlow); this.activityGlow.destroy(); }
    this._stopDust();
    super.destroy(fromScene);
  }
}
