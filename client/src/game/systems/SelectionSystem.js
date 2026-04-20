/**
 * SelectionSystem: Tap-to-select entities in the RTS god-view.
 * Fixed: checks CameraSystem.hasDragged to distinguish taps from drags.
 * Fixed: proper hit detection for mobile touch.
 */
import Phaser from 'phaser';
import EventBridge from '../EventBridge';

const SELECTION_COLOR = 0xffd700;
const SELECTION_ALPHA = 0.6;
const TAP_THRESHOLD = 12; // px - max distance between down and up for a tap

export default class SelectionSystem {
  constructor(scene) {
    this.scene = scene;
    this.selectables = [];
    this.selectedEntity = null;
    this.selectionRing = null;
    this.enabled = true;

    this.pointerDownPos = { x: 0, y: 0 };
    this.pointerDownTime = 0;

    this.setupInput();
  }

  setupInput() {
    this.scene.input.on('pointerdown', (pointer) => {
      this.pointerDownPos.x = pointer.x;
      this.pointerDownPos.y = pointer.y;
      this.pointerDownTime = Date.now();
    });

    this.scene.input.on('pointerup', (pointer) => {
      if (!this.enabled) return;

      // ─── Check if CameraSystem says this was a drag ───
      const cameraSystem = this.scene.cameraSystem;
      if (cameraSystem && cameraSystem.hasDragged) {
        return; // It was a drag/pan, not a tap
      }

      // ─── Check if it was a pinch ───
      if (cameraSystem && cameraSystem.isPinching) {
        return; // It was a pinch zoom
      }

      // ─── Verify it's a short tap (not a long press) ───
      const tapDuration = Date.now() - this.pointerDownTime;
      if (tapDuration > 500) return; // Long press, ignore

      // ─── Verify pointer didn't move much ───
      const dist = Phaser.Math.Distance.Between(
        this.pointerDownPos.x, this.pointerDownPos.y,
        pointer.x, pointer.y
      );
      if (dist > TAP_THRESHOLD) return;

      // ─── Convert screen coords to world coords ───
      const worldPoint = this.scene.cameras.main.getWorldPoint(pointer.x, pointer.y);

      // ─── Find closest selectable within tap range ───
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

      // Buildings are larger — give them bigger hit area
      let effectiveMaxDist = maxDist;
      if (entry.type === 'building') effectiveMaxDist = 72;
      else if (entry.type === 'farm_plot') effectiveMaxDist = 56;

      if (dist < effectiveMaxDist && dist < closestDist) {
        closest = entry;
        closestDist = dist;
      }
    }

    return closest;
  }

  select(entry) {
    this.clearSelectionRing();
    this.selectedEntity = entry;

    const obj = entry.gameObject;
    this.selectionRing = this.scene.add.graphics();
    this.selectionRing.lineStyle(2, SELECTION_COLOR, SELECTION_ALPHA);

    const radius = entry.type === 'building' ? 40 : entry.type === 'farm_plot' ? 32 : 22;
    this.selectionRing.strokeCircle(0, 0, radius);
    this.selectionRing.setPosition(obj.x, obj.y);
    this.selectionRing.setDepth(50);

    this.scene.tweens.add({
      targets: this.selectionRing,
      alpha: { from: 1, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
    });

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
