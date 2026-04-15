/**
 * CameraSystem: God-view camera with drag-to-pan, pinch/wheel zoom, and WASD panning.
 * Replaces the old player-follow camera for RTS gameplay.
 */
import Phaser from 'phaser';

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const PAN_SPEED = 500; // pixels per second for keyboard panning
const LERP_FACTOR = 0.1;

export default class CameraSystem {
  constructor(scene) {
    this.scene = scene;
    this.cam = scene.cameras.main;
    this.enabled = true;

    // Drag state
    this.isDragging = false;
    this.dragStartX = 0;
    this.dragStartY = 0;
    this.camStartScrollX = 0;
    this.camStartScrollY = 0;

    // Pinch zoom state
    this.pinchDistance = 0;
    this.pinchZoomStart = 1;

    // Keyboard
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    this.setupInput();
  }

  setupInput() {
    const scene = this.scene;

    // Pointer down — start drag
    scene.input.on('pointerdown', (pointer) => {
      if (!this.enabled) return;
      // Only start drag with single pointer
      if (scene.input.pointer1.isDown && scene.input.pointer2.isDown) return;
      this.isDragging = true;
      this.dragStartX = pointer.x;
      this.dragStartY = pointer.y;
      this.camStartScrollX = this.cam.scrollX;
      this.camStartScrollY = this.cam.scrollY;
    });

    // Pointer move — drag camera
    scene.input.on('pointermove', (pointer) => {
      if (!this.enabled || !this.isDragging) return;

      // If two pointers are down, handle pinch instead
      if (scene.input.pointer1.isDown && scene.input.pointer2.isDown) {
        this.handlePinch();
        return;
      }

      const dx = (this.dragStartX - pointer.x) / this.cam.zoom;
      const dy = (this.dragStartY - pointer.y) / this.cam.zoom;

      this.cam.scrollX = this.camStartScrollX + dx;
      this.cam.scrollY = this.camStartScrollY + dy;
    });

    // Pointer up — end drag
    scene.input.on('pointerup', () => {
      this.isDragging = false;
      this.pinchDistance = 0;
    });

    // Mouse wheel zoom
    scene.input.on('wheel', (_pointer, _gameObjects, _deltaX, deltaY) => {
      if (!this.enabled) return;
      const zoomDelta = deltaY > 0 ? -0.1 : 0.1;
      this.setZoom(this.cam.zoom + zoomDelta);
    });
  }

  handlePinch() {
    const pointer1 = this.scene.input.pointer1;
    const pointer2 = this.scene.input.pointer2;

    const dist = Phaser.Math.Distance.Between(
      pointer1.x, pointer1.y,
      pointer2.x, pointer2.y
    );

    if (this.pinchDistance === 0) {
      this.pinchDistance = dist;
      this.pinchZoomStart = this.cam.zoom;
    } else {
      const scale = dist / this.pinchDistance;
      this.setZoom(this.pinchZoomStart * scale);
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
