/**
 * Villager: Autonomous NPC entity that walks between buildings,
 * works, rests, and shows status indicators.
 */
import Phaser from 'phaser';

const VILLAGER_SPEED = 40; // pixels per second

const STATE_ICONS = {
  idle: '💤',
  walking_to_work: '🚶',
  working: '⚙️',
  resting: '🏠',
  sleeping: '😴',
  hungry: '🍽️',
};

// Maps role to spritesheet tint color for visual variety
const ROLE_TINTS = {
  farmer:     0xa8d880,
  woodcutter: 0xd4a070,
  miner:      0xa0b0c0,
  soldier:    0xff8888,
  merchant:   0xffd070,
  builder:    0xffb040,
};

export default class Villager extends Phaser.GameObjects.Container {
  constructor(scene, x, y, data) {
    super(scene, x, y);

    this.villagerData = data;
    this.targetX = x;
    this.targetY = y;
    this.isMoving = false;
    this.wanderTimer = 0;
    this.wanderDelay = Phaser.Math.Between(3000, 6000);

    // Sprite body using generated villager spritesheet
    this.sprite = scene.add.sprite(0, 0, 'villager', 0);
    this.sprite.setDisplaySize(28, 42);
    const tint = ROLE_TINTS[data.role];
    if (tint) this.sprite.setTint(tint);
    this.add(this.sprite);

    // Play idle animation
    if (scene.anims.exists('villager_idle')) {
      this.sprite.play('villager_idle');
    }

    // Name label
    this.nameText = scene.add.text(0, -24, data.name || 'Aldeano', {
      fontSize: '8px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(this.nameText);

    // Status icon
    this.statusIcon = scene.add.text(16, -18, '', {
      fontSize: '8px',
    }).setOrigin(0.5);
    this.add(this.statusIcon);

    this.setDepth(9);
    scene.add.existing(this);

    this.updateStatusIcon();
  }

  updateData(data) {
    this.villagerData = data;
    this.updateStatusIcon();

    if (data.state === 'walking_to_work' && data.targetPos) {
      this.targetX = data.targetPos.x;
      this.targetY = data.targetPos.y;
      this.isMoving = true;
    }
  }

  updateStatusIcon() {
    const state = this.villagerData.state || 'idle';
    const hunger = this.villagerData.hunger || 100;
    this.statusIcon.setText(hunger <= 20 ? STATE_ICONS.hungry : (STATE_ICONS[state] || ''));
  }

  update(delta) {
    if (this.isMoving) {
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        this.isMoving = false;
        return;
      }

      const speed = VILLAGER_SPEED * (delta / 1000);
      this.x += (dx / dist) * speed;
      this.y += (dy / dist) * speed;
    } else {
      this.wanderTimer += delta;
      if (this.wanderTimer >= this.wanderDelay) {
        this.wanderTimer = 0;
        this.wanderDelay = Phaser.Math.Between(3000, 8000);
        const radius = 32;
        this.targetX = this.x + Phaser.Math.Between(-radius, radius);
        this.targetY = this.y + Phaser.Math.Between(-radius, radius);
        this.isMoving = true;
      }
    }
  }

  destroy(fromScene) {
    super.destroy(fromScene);
  }
}
