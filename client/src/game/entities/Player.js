/**
 * Player entity: Character sprite with 4-directional movement and animations.
 */
import Phaser from 'phaser';

export default class Player extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y) {
    super(scene, x, y, 'player', 0);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    // Physics body setup
    this.body.setSize(20, 16);
    this.body.setOffset(6, 32); // Feet hitbox
    this.setDepth(10);

    this.speed = 160;
    this.direction = 'down';
    this.isMoving = false;
    this.inputEnabled = true;

    // Start idle
    this.play('player_idle_down');
  }

  move(velocityX, velocityY) {
    if (!this.inputEnabled) {
      this.setVelocity(0, 0);
      if (this.isMoving) {
        this.play(`player_idle_${this.direction}`, true);
        this.isMoving = false;
      }
      return;
    }

    this.setVelocity(velocityX, velocityY);

    if (velocityX !== 0 || velocityY !== 0) {
      // Determine direction from velocity
      if (Math.abs(velocityX) > Math.abs(velocityY)) {
        this.direction = velocityX > 0 ? 'right' : 'left';
      } else {
        this.direction = velocityY > 0 ? 'down' : 'up';
      }

      const animKey = `player_walk_${this.direction}`;
      if (!this.isMoving || this.anims.currentAnim?.key !== animKey) {
        this.play(animKey, true);
      }
      this.isMoving = true;
    } else {
      if (this.isMoving) {
        this.play(`player_idle_${this.direction}`, true);
        this.isMoving = false;
      }
    }
  }

  setInputEnabled(enabled) {
    this.inputEnabled = enabled;
    if (!enabled) {
      this.setVelocity(0, 0);
      this.play(`player_idle_${this.direction}`, true);
      this.isMoving = false;
    }
  }
}
