/**
 * CameraSystem: God-view camera with drag-to-pan, pinch/wheel zoom, and WASD panning.
 * Fixed: proper touch handling for mobile, no conflict with SelectionSystem.
 */
import Phaser from 'phaser';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;
const PAN_SPEED = 500;
const DRAG_THRESHOLD = 8; // px - minimum movement to count as drag (not tap)

// Pixel-perfect: el zoom libre produce shimmering en pixel art (unos píxeles
// de arte ocupan 1 físico y otros 2). Al TERMINAR el gesto se hace snap al
// escalón más cercano (docs/iso-art-architecture.md §4).
const ZOOM_STEPS = [0.5, 1, 1.5, 2, 3];
const SNAP_DELAY_MS = 220;

export default class CameraSystem {
  constructor(scene) {
    this.scene = scene;
    this.cam = scene.cameras.main;
    this.enabled = true;

    // Drag state
    this.isDragging = false;
    this.hasDragged = false; // TRUE if pointer moved enough to be a drag (exposed for SelectionSystem)
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.camStartScrollX = 0;
    this.camStartScrollY = 0;

    // Pinch zoom state
    this.isPinching = false;
    this.pinchDistance = 0;
    this.pinchZoomStart = 1;
    this.lastPointerCount = 0;

    // Keyboard
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // Store reference in scene for SelectionSystem to access
    scene.cameraSystem = this;

    this.setupInput();
  }

  setupInput() {
    const scene = this.scene;

    // ─── Pointer down: start potential drag ───
    scene.input.on('pointerdown', (pointer) => {
      if (!this.enabled) return;

      const activeCount = this.getActivePointerCount();

      // If second finger touches, switch to pinch mode
      if (activeCount >= 2) {
        this.isPinching = true;
        this.isDragging = false;
        this.pinchDistance = 0; // Reset to recalculate
        return;
      }

      // Single finger: start drag tracking
      this.isDragging = true;
      this.hasDragged = false;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.camStartScrollX = this.cam.scrollX;
      this.camStartScrollY = this.cam.scrollY;
    });

    // ─── Pointer move: drag or pinch ───
    scene.input.on('pointermove', (pointer) => {
      if (!this.enabled) return;

      const activeCount = this.getActivePointerCount();

      // Handle pinch zoom (2+ fingers)
      if (activeCount >= 2) {
        this.isPinching = true;
        this.isDragging = false;
        this.handlePinch();
        return;
      }

      // Handle single-finger drag
      if (!this.isDragging) return;

      const dx = this.dragStartX - pointer.x;
      const dy = this.dragStartY - pointer.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Only start actual camera movement after threshold
      if (dist > DRAG_THRESHOLD) {
        this.hasDragged = true;
        this.cam.scrollX = this.camStartScrollX + dx / this.cam.zoom;
        this.cam.scrollY = this.camStartScrollY + dy / this.cam.zoom;
      }
    });

    // ─── Pointer up: end drag/pinch ───
    scene.input.on('pointerup', () => {
      const activeCount = this.getActivePointerCount();

      if (activeCount < 2) {
        if (this.isPinching) this._scheduleZoomSnap();
        this.isPinching = false;
        this.pinchDistance = 0;
      }

      if (activeCount === 0) {
        this.isDragging = false;
        // NOTE: hasDragged stays true until next pointerdown
        // so SelectionSystem can check it in pointerup
      }
    });

    // ─── Mouse wheel zoom ───
    scene.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      if (!this.enabled) return;
      const zoomDelta = deltaY > 0 ? -0.15 : 0.15;
      const newZoom = this.cam.zoom + zoomDelta;
      this.setZoom(newZoom);
      this._scheduleZoomSnap();
    });

    // ─── Prevent default touch gestures on the canvas ───
    const canvas = scene.game.canvas;
    if (canvas) {
      canvas.addEventListener('touchmove', (e) => {
        e.preventDefault();
      }, { passive: false });

      canvas.addEventListener('touchstart', (e) => {
        // Prevent double-tap zoom on mobile
        if (e.touches.length > 1) {
          e.preventDefault();
        }
      }, { passive: false });
    }
  }

  getActivePointerCount() {
    const input = this.scene.input;
    let count = 0;
    if (input.pointer1?.isDown) count++;
    if (input.pointer2?.isDown) count++;
    if (input.pointer3?.isDown) count++;
    return count;
  }

  handlePinch() {
    const pointer1 = this.scene.input.pointer1;
    const pointer2 = this.scene.input.pointer2;

    if (!pointer1?.isDown || !pointer2?.isDown) return;

    const dist = Phaser.Math.Distance.Between(
      pointer1.x, pointer1.y,
      pointer2.x, pointer2.y
    );

    if (this.pinchDistance === 0 || isNaN(this.pinchDistance)) {
      // First pinch frame: record baseline
      this.pinchDistance = dist;
      this.pinchZoomStart = this.cam.zoom;
    } else {
      // Subsequent frames: scale zoom proportionally
      const scale = dist / this.pinchDistance;
      const newZoom = this.pinchZoomStart * scale;
      this.setZoom(newZoom);
    }
  }

  setZoom(zoom) {
    this.cam.setZoom(Phaser.Math.Clamp(zoom, MIN_ZOOM, MAX_ZOOM));
  }

  // Snap diferido al escalón de zoom más cercano — se agenda al soltar el
  // pinch o tras una pausa de la rueda, y se re-agenda si el gesto sigue.
  _scheduleZoomSnap() {
    if (this._snapTimer) this._snapTimer.remove();
    this._snapTimer = this.scene.time.delayedCall(SNAP_DELAY_MS, () => {
      this._snapTimer = null;
      const z = this.cam.zoom;
      let best = ZOOM_STEPS[0];
      for (const step of ZOOM_STEPS) {
        if (Math.abs(step - z) < Math.abs(best - z)) best = step;
      }
      if (Math.abs(best - z) > 0.001) {
        this.scene.tweens.add({
          targets: this.cam,
          zoom: best,
          duration: 120,
          ease: 'Sine.easeOut',
        });
      }
    });
  }

  setBounds(x, y, width, height) {
    this.cam.setBounds(x, y, width, height);
  }

  centerOn(x, y) {
    this.cam.centerOn(x, y);
  }

  setEnabled(enabled) {
    this.enabled = enabled;
  }

  update(delta) {
    if (!this.enabled) return;

    // Keyboard panning
    const speed = (PAN_SPEED / this.cam.zoom) * (delta / 1000);
    let dx = 0;
    let dy = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) dx -= speed;
    if (this.cursors.right.isDown || this.wasd.right.isDown) dx += speed;
    if (this.cursors.up.isDown || this.wasd.up.isDown) dy -= speed;
    if (this.cursors.down.isDown || this.wasd.down.isDown) dy += speed;

    if (dx !== 0 || dy !== 0) {
      this.cam.scrollX += dx;
      this.cam.scrollY += dy;
    }
  }

  destroy() {
    if (this._snapTimer) { this._snapTimer.remove(); this._snapTimer = null; }
    this.scene.input.off('pointerdown');
    this.scene.input.off('pointermove');
    this.scene.input.off('pointerup');
    this.scene.input.off('wheel');
  }
}
