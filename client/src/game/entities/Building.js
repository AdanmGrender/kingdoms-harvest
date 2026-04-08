/**
 * Building entity: Visual building sprite placed on the world map.
 */
import Phaser from 'phaser';

const BUILDING_SIZE = 64;
const TILESET_COLS = 8;

export default class Building extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, buildingData) {
    const tileIndex = buildingData.tileIndex ?? 0;
    super(scene, x, y, 'buildings', tileIndex);

    this.buildingData = buildingData;

    scene.add.existing(this);
    this.setDepth(5);
    this.setDisplaySize(BUILDING_SIZE, BUILDING_SIZE);

    // Level indicator text
    if (buildingData.level && buildingData.level > 1) {
      this.levelText = scene.add.text(x + 24, y + 24, `Lv${buildingData.level}`, {
        fontFamily: 'MedievalSharp, serif',
        fontSize: '10px',
        color: '#ffd700',
        stroke: '#000000',
        strokeThickness: 2,
      }).setDepth(20).setOrigin(0.5);
    }

    // Construction indicator
    if (buildingData.is_building) {
      this.setFrame(15); // Construction scaffold frame
      this.constructionText = scene.add.text(x, y - 36, '🔨', {
        fontSize: '16px',
      }).setDepth(20).setOrigin(0.5);

      // Hammer animation
      scene.tweens.add({
        targets: this.constructionText,
        angle: { from: -15, to: 15 },
        duration: 400,
        yoyo: true,
        repeat: -1,
      });
    }
  }

  updateData(buildingData) {
    this.buildingData = buildingData;
    if (!buildingData.is_building) {
      this.setFrame(buildingData.tileIndex ?? 0);
      if (this.constructionText) {
        this.constructionText.destroy();
        this.constructionText = null;
      }
    }
  }

  destroy(fromScene) {
    if (this.levelText) this.levelText.destroy();
    if (this.constructionText) this.constructionText.destroy();
    super.destroy(fromScene);
  }
}
