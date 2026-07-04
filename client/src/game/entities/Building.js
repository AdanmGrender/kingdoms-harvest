/**
 * Building entity: Visual building sprite placed on the world map.
 * Supports ghost mode for placement preview and construction animation.
 *
 * Sprite source is the per-buildingId Kenney medieval-rts structure PNG (see
 * buildingSprites.js). The old `buildings.png` spritesheet is no longer used.
 */
import Phaser from 'phaser';
import { getBuildingSprite } from '../config/buildingSprites';

const BUILDING_SIZE = 64;
const SCAFFOLD_SPRITE = 'iso_struct_18'; // ruins — stands in for construction

export default class Building extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, buildingData) {
    const spriteKey = buildingData.is_building
      ? SCAFFOLD_SPRITE
      : getBuildingSprite(buildingData.buildingId, scene);
    super(scene, x, y, spriteKey);

    this.buildingData = buildingData;

    scene.add.existing(this);
    this.setDepth(5);
    // Origin near the base so the sprite "stands" on the tile; matches how
    // decorations and world structures are drawn in WorldScene.
    this.setOrigin(0.5, 0.7);
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

    // Construction indicator — hammer icon that wiggles overhead
    if (buildingData.is_building) {
      this.constructionText = scene.add.text(x, y - 36, '🔨', {
        fontSize: '16px',
      }).setDepth(20).setOrigin(0.5);

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
      // Swap scaffold → final sprite when construction finishes
      this.setTexture(getBuildingSprite(buildingData.buildingId, this.scene));
      this.setDisplaySize(BUILDING_SIZE, BUILDING_SIZE);
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
