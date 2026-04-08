/**
 * InteractionSystem: Detects player proximity to interactable objects.
 * Shows interact prompt and handles tap-to-interact.
 */
import EventBridge from '../EventBridge';

const INTERACT_DISTANCE = 48; // pixels

export default class InteractionSystem {
  constructor(scene) {
    this.scene = scene;
    this.interactables = []; // { gameObject, type, data }
    this.currentTarget = null;

    // Interact prompt
    this.prompt = scene.add.container(0, 0).setDepth(50).setVisible(false).setScrollFactor(0);

    const bg = scene.add.graphics();
    bg.fillStyle(0x222244, 0.85);
    bg.fillRoundedRect(-40, -16, 80, 32, 8);
    bg.lineStyle(1, 0xffd700, 0.8);
    bg.strokeRoundedRect(-40, -16, 80, 32, 8);
    this.prompt.add(bg);

    this.promptText = scene.add.text(0, 0, 'Tocar', {
      fontFamily: 'MedievalSharp, serif',
      fontSize: '13px',
      color: '#ffd700',
    }).setOrigin(0.5);
    this.prompt.add(this.promptText);

    // Interact button (bottom-right of screen)
    this.interactBtn = scene.add.graphics();
    this.interactBtn.fillStyle(0x3366aa, 0.8);
    this.interactBtn.fillCircle(0, 0, 28);
    this.interactBtn.lineStyle(2, 0xffd700, 0.9);
    this.interactBtn.strokeCircle(0, 0, 28);
    this.interactBtn.setDepth(100);
    this.interactBtn.setScrollFactor(0);
    this.interactBtn.setVisible(false);
    this.interactBtn.setInteractive(
      new Phaser.Geom.Circle(0, 0, 28),
      Phaser.Geom.Circle.Contains
    );

    this.interactBtnText = scene.add.text(0, 0, '✋', {
      fontSize: '22px',
    }).setOrigin(0.5).setDepth(101).setScrollFactor(0).setVisible(false);

    this.positionInteractButton();

    // Handle interact button tap
    this.interactBtn.on('pointerdown', () => {
      if (this.currentTarget) {
        this.triggerInteraction(this.currentTarget);
      }
    });

    // Also handle E key for desktop
    scene.input.keyboard.on('keydown-E', () => {
      if (this.currentTarget) {
        this.triggerInteraction(this.currentTarget);
      }
    });

    // Listen for screen resize
    scene.scale.on('resize', () => this.positionInteractButton());
  }

  positionInteractButton() {
    const { width, height } = this.scene.cameras.main;
    const btnX = width - 70;
    const btnY = height - 80;
    this.interactBtn.setPosition(btnX, btnY);
    this.interactBtnText.setPosition(btnX, btnY);
  }

  register(gameObject, type, data) {
    this.interactables.push({ gameObject, type, data });
  }

  unregister(gameObject) {
    this.interactables = this.interactables.filter(i => i.gameObject !== gameObject);
  }

  update(player) {
    let closestTarget = null;
    let closestDist = INTERACT_DISTANCE;

    for (const interactable of this.interactables) {
      if (!interactable.gameObject.active) continue;

      const dist = Phaser.Math.Distance.Between(
        player.x, player.y,
        interactable.gameObject.x, interactable.gameObject.y
      );

      if (dist < closestDist) {
        closestDist = dist;
        closestTarget = interactable;
      }
    }

    if (closestTarget !== this.currentTarget) {
      this.currentTarget = closestTarget;

      if (closestTarget) {
        // Show prompt above the target
        const cam = this.scene.cameras.main;
        const screenX = closestTarget.gameObject.x - cam.scrollX;
        const screenY = closestTarget.gameObject.y - cam.scrollY - 40;
        this.prompt.setPosition(screenX, screenY).setVisible(true);

        // Set prompt text based on type
        const labels = {
          npc: 'Hablar',
          farm_plot: 'Cultivar',
          building: 'Entrar',
          animal: 'Interactuar',
          war_gate: 'Combatir',
        };
        this.promptText.setText(labels[closestTarget.type] || 'Tocar');

        // Show interact button
        this.interactBtn.setVisible(true);
        this.interactBtnText.setVisible(true);
      } else {
        this.prompt.setVisible(false);
        this.interactBtn.setVisible(false);
        this.interactBtnText.setVisible(false);
      }
    }

    // Update prompt position to follow target on screen
    if (this.currentTarget && this.currentTarget.gameObject.active) {
      const cam = this.scene.cameras.main;
      const screenX = this.currentTarget.gameObject.x - cam.scrollX;
      const screenY = this.currentTarget.gameObject.y - cam.scrollY - 40;
      this.prompt.setPosition(screenX, screenY);
    }
  }

  triggerInteraction(target) {
    EventBridge.emit('player:interact', {
      type: target.type,
      data: target.data,
      gameObject: target.gameObject,
    });
  }

  destroy() {
    this.prompt.destroy();
    this.interactBtn.destroy();
    this.interactBtnText.destroy();
  }
}
