/**
 * SelectionSystem: Tap-to-select entities in the RTS god-view.
 * Shows a highlight ring around selected entity and emits events via EventBridge.
 */
import Phaser from 'phaser';
import EventBridge from '../EventBridge';

const SELECTION_COLOR = 0xffd700;
const SELECTION_ALPHA = 0.6;

export default class SelectionSystem {
  constructor(scene) {
    this.scene = scene;
    this.selectables = []; // { gameObject, type, data }
    this.selectedEntity = null;
    this.selectionRing = null;
    this.enabled = true;

    // Track drag distance to distinguish tap from pan
    this.pointerDownPos = { x: 0, y: 0 };
    this.TAP_THRESHOLD = 10; // pixels

    this.setupInput();
  }

  setupInput() {
    this.scene.input.on('pointerdown', (pointer) => {
      this.pointerDownPos.x = pointer.x;
      this.pointerDownPos.y = pointer.y;
    });

    this.scene.input.on('pointerup', (pointer) => {
      if (!this.enabled) return;

      // Only count as tap if pointer didn't move much (not a drag)
      const dist = Phaser.Math.Distance.Between(
        this.pointerDownPos.x, this.pointerDownPos.y,
        pointer.x, pointer.y
      );
      if (dist > this.TAP_THRESHOLD) return;

      // Convert screen coords to world coords
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

      // Find closest selectable within tap range
      const selected = this.findClosest(worldPoint.x, worldPoint.y, 48);

      if (selected) {
        this.select(selected);
      } else {
        this.deselect();
      }
    });
  }

  register(gameObject, type, data) {
    this.selectables.push({ gameObject, type, data });
  }

  unregister(gameObject) {
    this.selectables = this.selectables.filter(s => s.gameObject !== gameObject);
    if (this.selectedEntity?.gameObject === gameObject) {
      this.deselect();
    }
  }

  findClosest(worldX, worldY, maxDist) {
    let closest = null;
    let closestDist = maxDist;

    for (const entry of this.selectables) {
      const obj = entry.gameObject;
      if (!obj.active) continue;

      const dist = Phaser.Math.Distance.Between(worldX, worldY, obj.x, obj.y);
      if (dist < closestDist) {
        closest = entry;
        closestDist = dist;
      }
    }

    return closest;
  }

  select(entry) {
    // Deselect previous
    this.clearSelectionRing();

    this.selectedEntity = entry;

    // Draw selection ring
    const obj = entry.gameObject;
    this.selectionRing = this.scene.add.graphics();
    this.selectionRing.lineStyle(2, SELECTION_COLOR, SELECTION_ALPHA);

    // Determine ring size based on entity type
    const radius = entry.type === 'building' ? 36 : 20;
    this.selectionRing.strokeCircle(0, 0, radius);
    this.selectionRing.setPosition(obj.x, obj.y);
    this.selectionRing.setDepth(50);

    // Pulse animation
    this.scene.tweens.add({
      targets: this.selectionRing,
      alpha: { from: 1, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

    // Emit event for React UI
    EventBridge.emit('entity:selected', {
      type: entry.type,
      data: entry.data,
    });
  }

  deselect() {
    this.clearSelectionRing();
    this.selectedEntity = null;
    EventBridge.emit('entity:deselected');
  }

  clearSelectionRing() {
    if (this.selectionRing) {
      this.scene.tweens.killTweensOf(this.selectionRing);
      this.selectionRing.destroy();
      this.selectionRing = null;
    }
  }

  update() {
    // Keep selection ring following entity (in case it moves)
    if (this.selectionRing && this.selectedEntity?.gameObject?.active) {
      const obj = this.selectedEntity.gameObject;
      this.selectionRing.setPosition(obj.x, obj.y);
    } else if (this.selectionRing && !this.selectedEntity?.gameObject?.active) {
      this.deselect();
    }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  destroy() {
    this.clearSelectionRing();
    this.selectables = [];
    this.selectedEntity = null;
  }
}
