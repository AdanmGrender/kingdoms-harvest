/**
 * NPC entity: Idle animation, name label, quest indicator.
 */
import Phaser from 'phaser';

export default class NPC extends Phaser.Physics.Arcade.Sprite {
  constructor(scene, x, y, npcId, name) {
    super(scene, x, y, `npc_${npcId}`, 0);

    this.npcId = npcId;
    this.npcName = name;

    scene.add.existing(this);
    scene.physics.add.existing(this, true); // Static body

    this.body.setSize(24, 16);
    this.body.setOffset(4, 32);
    this.setDepth(9);

    // Play idle animation
    this.play(`npc_${npcId}_idle`);

    // Name label above head
    this.nameText = scene.add.text(x, y - 32, name, {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '11px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(20);

    // Quest indicator (exclamation mark, hidden by default)
    this.questIcon = scene.add.text(x, y - 42, '!', {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '16px',
      color: '#ffd700',
      stroke: '#000000',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(20).setVisible(false);

    // Bounce animation for quest icon
    scene.tweens.add({
      targets: this.questIcon,
      y: y - 48,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  setHasQuest(hasQuest) {
    this.questIcon.setVisible(hasQuest);
  }

  destroy(fromScene) {
    if (this.nameText) this.nameText.destroy();
    if (this.questIcon) this.questIcon.destroy();
    super.destroy(fromScene);
  }
}
