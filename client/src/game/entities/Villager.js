/**
 * Villager: Autonomous NPC entity that walks between buildings,
 * works, rests, and shows status indicators.
 * Uses NPC spritesheets loaded in BootScene for rendering.
 */
import Phaser from 'phaser';
import { addContainerShadow } from '../systems/ShadowSystem';

const VILLAGER_SPEED = 40; // pixels per second

// Map villager roles to loaded NPC spritesheets
const ROLE_SPRITE_MAP = {
  farmer: 'npc_farmer',
  woodcutter: 'npc_ranger',
  miner: 'npc_knight',
  soldier: 'npc_knight',
  merchant: 'npc_merchant',
  builder: 'npc_baker',
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

    // Use NPC spritesheet instead of colored circle
    const spriteKey = ROLE_SPRITE_MAP[data.role] || 'npc_farmer';
    const animKey = `${spriteKey}_idle`;

    // Check if the sprite texture exists, fallback to colored circle
    if (scene.textures.exists(spriteKey)) {
      this.sprite = scene.add.sprite(0, 0, spriteKey, 0);
      this.sprite.setDisplaySize(28, 42);
      if (scene.anims.exists(animKey)) {
        this.sprite.play(animKey);
      }
      this.add(this.sprite);
    } else {
      // Fallback: colored circle (shouldn't happen with proper assets)
      const ROLE_COLORS = {
        farmer: 0x66bb6a, woodcutter: 0x8d6e63, miner: 0x78909c,
        soldier: 0xef5350, merchant: 0xffd54f, builder: 0xff9800,
      };
      const body = scene.add.graphics();
      body.fillStyle(ROLE_COLORS[data.role] || 0xffffff, 1);
      body.fillCircle(0, 0, 8);
      body.lineStyle(1, 0x000000, 0.5);
      body.strokeCircle(0, 0, 8);
      this.add(body);
    }

    // Name label
    this.nameText = scene.add.text(0, -26, data.name || 'Aldeano', {
      fontSize: '8px',
      color: '#ffffff',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5);
    this.add(this.nameText);

    // Status icon (shows current state)
    this.statusIcon = scene.add.text(12, -18, '', {
      fontSize: '8px',
    }).setOrigin(0.5);
    this.add(this.statusIcon);

    // Drop-shadow ellipse beneath sprite — inserted at index 0 so it draws first
    addContainerShadow(this, { width: 16, height: 6, alpha: 0.35, offsetY: 14 });

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
        // Flip sprite based on last movement direction
        if (this.sprite && dx < 0) this.sprite.setFlipX(true);
        else if (this.sprite) this.sprite.setFlipX(false);
        return;
      }

      const speed = VILLAGER_SPEED * (delta / 1000);
      const nx = dx / dist;
      const ny = dy / dist;
      this.x += nx * speed;
      this.y += ny * speed;

      // Flip sprite based on movement direction
      if (this.sprite) {
        this.sprite.setFlipX(nx < 0);
      }
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
