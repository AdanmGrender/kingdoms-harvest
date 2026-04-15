/**
 * Villager: Autonomous NPC entity that walks between buildings,
 * works, rests, and shows status indicators.
 */
import Phaser from 'phaser';
import { TILE_SIZE } from '../maps/MapGenerator';

const VILLAGER_SPEED = 40; // pixels per second
const ROLE_COLORS = {
  farmer: 0x66bb6a,
  woodcutter: 0x8d6e63,
  miner: 0x78909c,
  soldier: 0xef5350,
  merchant: 0xffd54f,
  builder: 0xff9800,
};

const ROLE_ICONS = {
  farmer: '🧑‍🌾',
  woodcutter: '🪓',
  miner: '⛏️',
  soldier: '⚔️',
  merchant: '💰',
  builder: '🔨',
};

const STATE_ICONS = {
  idle: '💤',
  walking_to_work: '🚶',
  working: '⚙️',
  resting: '🏠',
  sleeping: '😴',
  hungry: '🍽️',
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

    // Simple colored circle for the villager body
    const body = scene.add.graphics();
    const color = ROLE_COLORS[data.role] || 0xffffff;
    body.fillStyle(color, 1);
    body.fillCircle(0, 0, 8);
    body.lineStyle(1, 0x000000, 0.5);
    body.strokeCircle(0, 0, 8);
    this.add(body);

    // Name label
    this.nameText = scene.add.text(0, -16, data.name || 'Aldeano', {
      fontSize: '8px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(this.nameText);

    // Role icon
    this.roleIcon = scene.add.text(0, 12, ROLE_ICONS[data.role] || '👤', {
      fontSize: '10px',
    }).setOrigin(0.5);
    this.add(this.roleIcon);

    // Status icon (shows current state)
    this.statusIcon = scene.add.text(10, -12, '', {
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

    // If assigned to a building, walk toward it
    if (data.state === 'walking_to_work' && data.targetPos) {
      this.targetX = data.targetPos.x;
      this.targetY = data.targetPos.y;
      this.isMoving = true;
    }
  }

  updateStatusIcon() {
    const state = this.villagerData.state || 'idle';
    const hunger = this.villagerData.hunger || 100;

    if (hunger <= 20) {
      this.statusIcon.setText(STATE_ICONS.hungry);
    } else {
      this.statusIcon.setText(STATE_ICONS[state] || '');
    }
  }

  update(delta) {
    if (this.isMoving) {
      // Move toward target
      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 4) {
        this.isMoving = false;
        return;
      }

      const speed = VILLAGER_SPEED * (delta / 1000);
      const nx = dx / dist;
      const ny = dy / dist;
      this.x += nx * speed;
      this.y += ny * speed;
    } else {
      // Random wander when idle
      this.wanderTimer += delta;
      if (this.wanderTimer >= this.wanderDelay) {
        this.wanderTimer = 0;
        this.wanderDelay = Phaser.Math.Between(3000, 8000);

        // Wander within a small radius
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
