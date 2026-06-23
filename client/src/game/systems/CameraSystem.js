/**
 * CameraSystem: God-view camera with drag-to-pan, pinch/wheel zoom, and WASD panning.
 * Fixed: proper touch handling for mobile, no conflict with SelectionSystem.
 */
import Phaser from 'phaser';

const MIN_ZOOM = 0.4;
const MAX_ZOOM = 3;
const PAN_SPEED = 500;
const DRAG_THRESHOLD = 8; // px - minimum movement to count as drag (not tap)

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
    this.scene.input.off('pointerdown');
    this.scene.input.off('pointermove');
    this.scene.input.off('pointerup');
    this.scene.input.off('wheel');
  }
}
