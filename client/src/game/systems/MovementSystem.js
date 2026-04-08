/**
 * MovementSystem: Virtual joystick for mobile + WASD/Arrow keys for desktop.
 */
import Phaser from 'phaser';

export default class MovementSystem {
  constructor(scene) {
    this.scene = scene;
    this.enabled = true;

    // Keyboard input
    this.cursors = scene.input.keyboard.createCursorKeys();
    this.wasd = scene.input.keyboard.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D,
    });

    // Virtual joystick state
    this.joystickActive = false;
    this.joystickVelocity = { x: 0, y: 0 };

    // Joystick UI elements
    this.joystickBase = null;
    this.joystickThumb = null;
    this.joystickOrigin = { x: 0, y: 0 };
    this.joystickRadius = 50;

    this.createJoystick();
    this.setupTouchInput();
  }

  createJoystick() {
    const { width, height } = this.scene.cameras.main;
    const baseX = 80;
    const baseY = height - 80;

    // Semi-transparent base circle
    this.joystickBase = this.scene.add.graphics();
    this.joystickBase.fillStyle(0x333355, 0.4);
    this.joystickBase.fillCircle(0, 0, this.joystickRadius);
    this.joystickBase.lineStyle(2, 0x666688, 0.6);
    this.joystickBase.strokeCircle(0, 0, this.joystickRadius);
    this.joystickBase.setPosition(baseX, baseY);
    this.joystickBase.setDepth(100);
    this.joystickBase.setScrollFactor(0);

    // Thumb circle
    this.joystickThumb = this.scene.add.graphics();
    this.joystickThumb.fillStyle(0x8888bb, 0.7);
    this.joystickThumb.fillCircle(0, 0, 20);
    this.joystickThumb.setPosition(baseX, baseY);
    this.joystickThumb.setDepth(101);
    this.joystickThumb.setScrollFactor(0);

    this.joystickOrigin = { x: baseX, y: baseY };

    // Direction arrows on base
    const arrows = this.scene.add.text(baseX, baseY, '✦', {
      fontSize: '10px',
      color: '#aaaacc',
    }).setOrigin(0.5).setDepth(100).setScrollFactor(0).setAlpha(0.4);
    this.joystickArrows = arrows;
  }

  setupTouchInput() {
    const scene = this.scene;

    scene.input.on('pointerdown', (pointer) => {
      if (!this.enabled) return;
      // Only activate joystick for touches in the bottom-left quadrant
      const { width, height } = scene.cameras.main;
      if (pointer.x < width * 0.5 && pointer.y > height * 0.4) {
        this.joystickActive = true;
        this.joystickOrigin = {
          x: pointer.x,
          y: pointer.y,
        };
        this.joystickBase.setPosition(pointer.x, pointer.y);
        this.joystickThumb.setPosition(pointer.x, pointer.y);
        if (this.joystickArrows) {
          this.joystickArrows.setPosition(pointer.x, pointer.y);
        }
      }
    });

    scene.input.on('pointermove', (pointer) => {
      if (!this.joystickActive || !this.enabled) return;

      const dx = pointer.x - this.joystickOrigin.x;
      const dy = pointer.y - this.joystickOrigin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Clamp thumb to radius
      const clampedDist = Math.min(dist, this.joystickRadius);
      const angle = Math.atan2(dy, dx);

      const thumbX = this.joystickOrigin.x + Math.cos(angle) * clampedDist;
      const thumbY = this.joystickOrigin.y + Math.sin(angle) * clampedDist;

      this.joystickThumb.setPosition(thumbX, thumbY);

      // Normalize velocity (0 to 1)
      const normalizedDist = clampedDist / this.joystickRadius;
      if (normalizedDist > 0.15) { // Dead zone
        this.joystickVelocity = {
          x: Math.cos(angle) * normalizedDist,
          y: Math.sin(angle) * normalizedDist,
        };
      } else {
        this.joystickVelocity = { x: 0, y: 0 };
      }
    });

    const onPointerUp = () => {
      if (this.joystickActive) {
        this.joystickActive = false;
        this.joystickVelocity = { x: 0, y: 0 };
        // Reset thumb to base center
        this.joystickThumb.setPosition(this.joystickOrigin.x, this.joystickOrigin.y);
      }
    };

    scene.input.on('pointerup', onPointerUp);
    scene.input.on('pointerupoutside', onPointerUp);
  }

  getVelocity(speed) {
    if (!this.enabled) return { x: 0, y: 0 };

    // Check keyboard first
    let kx = 0, ky = 0;

    if (this.cursors.left.isDown || this.wasd.left.isDown) kx -= 1;
    if (this.cursors.right.isDown || this.wasd.right.isDown) kx += 1;
    if (this.cursors.up.isDown || this.wasd.up.isDown) ky -= 1;
    if (this.cursors.down.isDown || this.wasd.down.isDown) ky += 1;

    if (kx !== 0 || ky !== 0) {
      // Normalize diagonal movement
      const len = Math.sqrt(kx * kx + ky * ky);
      return {
        x: (kx / len) * speed,
        y: (ky / len) * speed,
      };
    }

    // Joystick
    if (this.joystickVelocity.x !== 0 || this.joystickVelocity.y !== 0) {
      return {
        x: this.joystickVelocity.x * speed,
        y: this.joystickVelocity.y * speed,
      };
    }

    return { x: 0, y: 0 };
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled) {
      this.joystickVelocity = { x: 0, y: 0 };
      this.joystickActive = false;
    }
  }

  resize(width, height) {
    // Reposition joystick on screen resize
    const baseX = 80;
    const baseY = height - 80;
    this.joystickBase.setPosition(baseX, baseY);
    this.joystickThumb.setPosition(baseX, baseY);
    this.joystickOrigin = { x: baseX, y: baseY };
    if (this.joystickArrows) {
      this.joystickArrows.setPosition(baseX, baseY);
    }
  }

  destroy() {
    if (this.joystickBase) this.joystickBase.destroy();
    if (this.joystickThumb) this.joystickThumb.destroy();
    if (this.joystickArrows) this.joystickArrows.destroy();
  }
}
