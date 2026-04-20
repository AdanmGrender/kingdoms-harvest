/**
 * IsoScene — Isometric proof-of-concept using Kenney medieval-rts assets.
 * Renders a flat iso grid with terrain and a few structures.
 * NOT wired into gameplay yet — activate via URL param ?iso=1 or setScene('IsoScene').
 */
import Phaser from 'phaser';

// Kenney medieval-rts tiles are 132x99 at default size — roughly 2:1 iso.
// We use a logical tile size for grid math.
const TILE_W = 132;
const TILE_H = 66; // half of visual height for stacking math

const GRID_W = 14;
const GRID_H = 14;

// Hand-picked kenney tile indices — POC guesses, refine after visual test.
const TILE_GRASS = 1;
const TILE_GRASS_VAR = 2;
const TILE_DIRT = 5;
const TILE_STONE = 7;
const TILE_WATER = 9;

// Pick a few structure indices for demo
const STRUCT_TOWER = 1;
const STRUCT_HOUSE = 5;
const STRUCT_BARN = 10;
const STRUCT_WALL = 15;

function pad2(n) {
  return String(n).padStart(2, '0');
}

export default class IsoScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IsoScene' });
  }

  preload() {
    const basePath = '/assets/kenney-medieval/PNG/Default size';

    // Load a small subset of tiles for POC
    for (const i of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      this.load.image(`iso_tile_${i}`, `${basePath}/Tile/medievalTile_${pad2(i)}.png`);
    }

    // Load a few structures
    for (const i of [1, 5, 10, 15, 20]) {
      this.load.image(`iso_struct_${i}`, `${basePath}/Structure/medievalStructure_${pad2(i)}.png`);
    }

    this.load.on('loaderror', (file) => {
      console.error('[IsoScene] Failed to load:', file.key, file.url);
    });
  }

  create() {
    const { width, height } = this.cameras.main;
    this.cameras.main.setBackgroundColor('#1a2a3a');

    // Origin: center map horizontally, offset down a bit
    this.originX = width / 2;
    this.originY = height / 3;

    this.drawGrid();
    this.drawStructures();
    this.setupCamera();
    this.drawHUD();
  }

  /** World (grid) coord → screen pixel coord. */
  isoToScreen(gx, gy) {
    return {
      x: this.originX + (gx - gy) * (TILE_W / 2),
      y: this.originY + (gx + gy) * (TILE_H / 2),
    };
  }

  drawGrid() {
    for (let y = 0; y < GRID_H; y++) {
      for (let x = 0; x < GRID_W; x++) {
        const { x: sx, y: sy } = this.isoToScreen(x, y);

        // Simple terrain pattern — mostly grass with some variation
        let tileKey = `iso_tile_${TILE_GRASS}`;

        // Small water pond
        if (x >= 2 && x <= 4 && y >= 9 && y <= 11) {
          tileKey = `iso_tile_${TILE_WATER}`;
        } else if ((x + y) % 5 === 0) {
          tileKey = `iso_tile_${TILE_GRASS_VAR}`;
        } else if (x === 6 && y >= 3 && y <= 8) {
          // Dirt path
          tileKey = `iso_tile_${TILE_DIRT}`;
        }

        const tile = this.add.image(sx, sy, tileKey);
        tile.setOrigin(0.5, 0.5);
        // Iso depth: tiles closer to camera (higher y) render on top
        tile.setDepth(y * 10 + x);
      }
    }
  }

  drawStructures() {
    const placements = [
      { gx: 7, gy: 3, key: `iso_struct_${STRUCT_TOWER}` },
      { gx: 9, gy: 5, key: `iso_struct_${STRUCT_HOUSE}` },
      { gx: 4, gy: 6, key: `iso_struct_${STRUCT_BARN}` },
      { gx: 10, gy: 9, key: `iso_struct_${STRUCT_WALL}` },
      { gx: 7, gy: 7, key: `iso_struct_${STRUCT_HOUSE}` },
    ];

    for (const p of placements) {
      const { x, y } = this.isoToScreen(p.gx, p.gy);
      // Anchor bottom-center so structures sit on the tile
      const struct = this.add.image(x, y, p.key);
      struct.setOrigin(0.5, 0.9);
      struct.setDepth(p.gy * 10 + p.gx + 5);
    }
  }

  setupCamera() {
    // Simple drag pan
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      this.cameras.main.scrollX -= (pointer.x - pointer.prevPosition.x) / this.cameras.main.zoom;
      this.cameras.main.scrollY -= (pointer.y - pointer.prevPosition.y) / this.cameras.main.zoom;
    });

    // Wheel zoom
    this.input.on('wheel', (_p, _g, _dx, dy) => {
      const next = this.cameras.main.zoom + (dy > 0 ? -0.1 : 0.1);
      this.cameras.main.setZoom(Phaser.Math.Clamp(next, 0.4, 2.5));
    });

    this.cameras.main.setZoom(0.6);
  }

  drawHUD() {
    this.add.text(12, 12, 'ISO POC — drag to pan, wheel to zoom', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#ffd750',
      backgroundColor: '#000000aa',
      padding: { x: 6, y: 3 },
    }).setScrollFactor(0).setDepth(9999);
  }
}
