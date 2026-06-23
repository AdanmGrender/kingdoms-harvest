/**
 * CropPlot entity: Visual farm plot showing crop growth stages.
 * Fixed: proper depth sorting, no overlap, correct origin and spacing.
 */
import Phaser from 'phaser';

// Crop tile indices in farm_tiles.png (8 cols)
// Layout: index 0 = empty soil, index 1 = wet soil
// Then each crop has 4 tiles: seed(0), small(1), medium(2), ready(3)
// wheat starts at 2, carrot at 6, potato at 10, etc.
const CROP_TILE_OFFSETS = {
  wheat: 0,
  carrot: 1,
  potato: 2,
  tomato: 3,
  corn: 4,
  pumpkin: 5,
  grape: 6,
};

const TILE_SIZE = 32;

export default class CropPlot extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, plotData) {
    // Start with empty soil frame (tile index 0 from farm_tiles)
    super(scene, x, y, 'farm_tiles', 0);

    this.plotData = plotData;
    this.plotIndex = plotData?.plotIndex ?? 0;

    scene.add.existing(this);

    // ─── FIX: Use proper origin and display size ───
    this.setOrigin(0.5, 0.5);
    this.setDisplaySize(TILE_SIZE * 2, TILE_SIZE * 2);

    // ─── FIX: Dynamic depth based on Y position ───
    // This prevents visual overlap — lower plots render on top
    this.setDepth(3 + (y * 0.001));

    this.updateVisual(plotData);
  }

  updateVisual(plotData) {
    this.plotData = plotData;

    if (!plotData || plotData.state === 'empty' || !plotData.crop_id) {
      this.setFrame(0);
      return;
    }

    const cropName = plotData.crop_id;
    const cropOffset = CROP_TILE_OFFSETS[cropName];
    if (cropOffset === undefined) {
      this.setFrame(1); // Wet soil fallback
      return;
    }

    // Calculate growth stage (0-3)
    let stage = 3;
    if (plotData.state === 'growing' && plotData.planted_at && plotData.ready_at) {
      const now = Date.now();
      const planted = new Date(plotData.planted_at).getTime();
      const ready = new Date(plotData.ready_at).getTime();
      const totalTime = ready - planted;
      const elapsed = now - planted;
      const progress = Math.min(1, elapsed / totalTime);
      stage = Math.min(3, Math.floor(progress * 4));
    } else if (plotData.state === 'ready') {
      stage = 3;
    }

    // Tile index: 2 (skip soil tiles) + cropOffset * 4 + stage
    const tileIndex = 2 + cropOffset * 4 + stage;
    this.setFrame(tileIndex);
  }

  /**
   * Update depth when position changes (for dynamic depth sorting)
   */
  updateDepth() {
    this.setDepth(3 + (this.y * 0.001));
  }
}
