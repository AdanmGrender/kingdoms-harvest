/**
 * BuildingPlacementSystem: Handles building placement in RTS mode.
 * Player selects a building type, sees a ghost preview snapped to tile grid,
 * and taps to confirm placement. Validates against collision and existing buildings.
 */
import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/tileConfig';
import Building from '../entities/Building';
import EventBridge from '../EventBridge';

const VALID_TINT = 0x00ff00;
const INVALID_TINT = 0xff0000;
const GHOST_ALPHA = 0.5;

export default class BuildingPlacementSystem {
  constructor(scene) {
    this.scene = scene;
    this.active = false;
    this.buildingId = null;
    this.buildingConfig = null;
    this.ghostSprite = null;
    this.tileW = 2;
    this.tileH = 2;
    this.currentTileX = 0;
    this.currentTileY = 0;
    this.isValidPlacement = false;

    this.setupInput();
  }

  setupInput() {
    this.scene.input.on('pointermove', (pointer) => {
      if (!this.active || !this.ghostSprite) return;

      // Convert screen to world coords
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

      // Snap to tile grid
      const tileX = Math.floor(worldPoint.x / TILE_SIZE);
      const tileY = Math.floor(worldPoint.y / TILE_SIZE);

      if (tileX !== this.currentTileX || tileY !== this.currentTileY) {
        this.currentTileX = tileX;
        this.currentTileY = tileY;
        this.updateGhostPosition();
        this.validatePlacement();
      }
    });
  }

  /**
   * Enter placement mode for a specific building type
   */
  startPlacement(buildingId, buildingConfig, tileIndex) {
    this.cancel(); // Clear any existing placement

    this.active = true;
    this.buildingId = buildingId;
    this.buildingConfig = buildingConfig;
    this.tileW = buildingConfig.tileWidth || 2;
    this.tileH = buildingConfig.tileHeight || 2;

    // Create ghost sprite
    const px = this.currentTileX * TILE_SIZE + (this.tileW * TILE_SIZE) / 2;
    const py = this.currentTileY * TILE_SIZE + (this.tileH * TILE_SIZE) / 2;

    this.ghostSprite = this.scene.add.sprite(px, py, 'buildings', tileIndex ?? 0);
    this.ghostSprite.setDisplaySize(this.tileW * TILE_SIZE, this.tileH * TILE_SIZE);
    this.ghostSprite.setAlpha(GHOST_ALPHA);
    this.ghostSprite.setDepth(100);
    this.ghostSprite.setTint(VALID_TINT);

    // Disable camera drag while placing
    if (this.scene.cameraSystem) {
      this.scene.cameraSystem.setEnabled(false);
    }
    if (this.scene.selectionSystem) {
      this.scene.selectionSystem.setEnabled(false);
    }

    EventBridge.emit('placement:started', { buildingId });
  }

  /**
   * Update ghost sprite position based on current tile
   */
  updateGhostPosition() {
    if (!this.ghostSprite) return;
    const px = this.currentTileX * TILE_SIZE + (this.tileW * TILE_SIZE) / 2;
    const py = this.currentTileY * TILE_SIZE + (this.tileH * TILE_SIZE) / 2;
    this.ghostSprite.setPosition(px, py);
  }

  /**
   * Check if current position is valid for building placement
   */
  validatePlacement() {
    if (!this.ghostSprite) return;

    const { collision } = this.scene.mapData.layers;
    const mapW = this.scene.mapData.width;
    const mapH = this.scene.mapData.height;

    let valid = true;

    // Check map bounds
    if (
      this.currentTileX < 0 || this.currentTileY < 0 ||
      this.currentTileX + this.tileW > mapW ||
      this.currentTileY + this.tileH > mapH
    ) {
      valid = false;
    }

    // Check collision tiles (water, trees, rocks)
    if (valid) {
      for (let y = this.currentTileY; y < this.currentTileY + this.tileH; y++) {
        for (let x = this.currentTileX; x < this.currentTileX + this.tileW; x++) {
          if (collision[y]?.[x] === 1) {
            valid = false;
            break;
          }
        }
        if (!valid) break;
      }
    }

    // Check overlap with existing buildings
    if (valid && this.scene.buildings) {
      for (const building of this.scene.buildings) {
        const bConfig = building.buildingData;
        const bw = bConfig.tileWidth || 2;
        const bh = bConfig.tileHeight || 2;
        const bx = bConfig.posX ?? Math.floor(building.x / TILE_SIZE) - 1;
        const by = bConfig.posY ?? Math.floor(building.y / TILE_SIZE) - 1;

        if (
          this.currentTileX < bx + bw &&
          this.currentTileX + this.tileW > bx &&
          this.currentTileY < by + bh &&
          this.currentTileY + this.tileH > by
        ) {
          valid = false;
          break;
        }
      }
    }

    this.isValidPlacement = valid;
    this.ghostSprite.setTint(valid ? VALID_TINT : INVALID_TINT);
  }

  /**
   * Confirm placement at current position
   */
  confirmPlacement() {
    if (!this.active || !this.isValidPlacement) return null;

    const result = {
      buildingId: this.buildingId,
      posX: this.currentTileX,
      posY: this.currentTileY,
    };

    this.cancel();
    return result;
  }

  /**
   * Cancel placement mode
   */
  cancel() {
    if (this.ghostSprite) {
      this.ghostSprite.destroy();
      this.ghostSprite = null;
    }

    this.active = false;
    this.buildingId = null;
    this.buildingConfig = null;

    // Re-enable camera and selection
    if (this.scene.cameraSystem) {
      this.scene.cameraSystem.setEnabled(true);
    }
    if (this.scene.selectionSystem) {
      this.scene.selectionSystem.setEnabled(true);
    }

    EventBridge.emit('placement:ended');
  }

  isActive() {
    return this.active;
  }

  destroy() {
    this.cancel();
  }
}
