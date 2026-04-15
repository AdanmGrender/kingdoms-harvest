/**
 * Animal entity: Wander AI within a bounded area, state icons.
 */
import Phaser from 'phaser';

export default class Animal extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, animalType, bounds) {
    super(scene, x, y, animalType, 0);

    this.animalType = animalType;
    this.bounds = bounds; // { x, y, width, height } in pixels
    this.wanderTimer = 0;
    this.wanderDelay = Phaser.Math.Between(3000, 8000);

    scene.add.existing(this);
    scene.physics.add.existing(this);

    this.body.setSize(20, 16);
    this.body.setOffset(6, 16);
    this.setDepth(8);

    this.play(`${animalType}_idle`);

    // Status icon (hunger/ready) above animal
    this.statusIcon = scene.add.text(x, y - 20, '', {
      fontSize: '14px',
    }).setOrigin(0.5).setDepth(20).setVisible(false);
  }

  setStatus(status) {
    if (status === 'hungry') {
      this.statusIcon.setText('🍽').setVisible(true);
    } else if (status === 'ready') {
      this.statusIcon.setText('📦').setVisible(true);
    } else {
      this.statusIcon.setVisible(false);
    }
  }

  update(time) {
    this.wanderTimer += time;

    // Update status icon position
    this.statusIcon.setPosition(this.x, this.y - 20);

    if (this.wanderTimer >= this.wanderDelay) {
      this.wanderTimer = 0;
      this.wanderDelay = Phaser.Math.Between(3000, 8000);

      if (Phaser.Math.Between(0, 1) === 0) {
        // Idle
        this.setVelocity(0, 0);
        this.play(`${this.animalType}_idle`, true);
      } else {
        // Wander to random point within bounds
        const targetX = this.bounds.x + Phaser.Math.Between(16, this.bounds.width - 16);
        const targetY = this.bounds.y + Phaser.Math.Between(16, this.bounds.height - 16);
        const angle = Phaser.Math.Angle.Between(this.x, this.y, targetX, targetY);
        const speed = 30;

        this.setVelocity(Math.cos(angle) * speed, Math.sin(angle) * speed);
        this.play(`${this.animalType}_walk`, true);

        // Stop after reaching approximate target
        const dist = Phaser.Math.Distance.Between(this.x, this.y, targetX, targetY);
        this.scene.time.delayedCall(dist / speed * 1000, () => {
          if (this.active) {
            this.setVelocity(0, 0);
            this.play(`${this.animalType}_idle`, true);
          }
        });
      }
    }
  }

  destroy(fromScene) {
    if (this.statusIcon) this.statusIcon.destroy();
    super.destroy(fromScene);
  }
}
