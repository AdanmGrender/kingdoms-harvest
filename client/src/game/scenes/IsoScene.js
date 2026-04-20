/**
 * IsoScene — renders a per-player procedural isometric map using Kenney medieval-rts.
 * Map is generated from player.telegram_id so each player sees the same world on reload.
 * Activate via URL param ?iso=1 or scene.start('IsoScene').
 */
import Phaser from 'phaser';
import useGameStore from '../../store/gameStore';
import { generateMap } from '../maps/IsoMapGenerator';

// Visual tile footprint (Kenney default-size tiles render 132x99px, 2:1 iso diamond).
const TILE_W = 132;
const TILE_H = 66;

const MAP_W = 28;
const MAP_H = 28;

const pad2 = (n) => String(n).padStart(2, '0');

export default class IsoScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IsoScene' });
  }

  preload() {
    const basePath = '/assets/kenney-medieval/PNG/Default size';

    // All 58 terrain tiles.
    for (let i = 1; i <= 58; i++) {
      this.load.image(`iso_tile_${i}`, `${basePath}/Tile/medievalTile_${pad2(i)}.png`);
    }

    // All 21 environment sprites (trees, rocks, bushes, flowers).
    for (let i = 1; i <= 21; i++) {
      this.load.image(`iso_env_${i}`, `${basePath}/Environment/medievalEnvironment_${pad2(i)}.png`);
    }

    this.load.on('loaderror', (file) => {
      console.error('[IsoScene] Failed to load:', file.key, file.url);
    });
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#1a2a3a');

    const player = useGameStore.getState().player;
    const seed = player?.telegram_id ?? player?.id ?? `preview-${Date.now()}`;

    this.mapData = generateMap({ seed, width: MAP_W, height: MAP_H });

    this.originX = cam.width / 2;
    this.originY = cam.height / 4;

    this.drawTerrain();
    this.drawDecorations();
    this.markSpawn();
    this.setupCamera();
    this.drawHUD(seed);
  }

  /** Grid (gx, gy) → screen pixel coords for iso diamond. */
  isoToScreen(gx, gy) {
    return {
      x: this.originX + (gx - gy) * (TILE_W / 2),
      y: this.originY + (gx + gy) * (TILE_H / 2),
    };
  }

  drawTerrain() {
    const { tileVariants, width, height } = this.mapData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const { x: sx, y: sy } = this.isoToScreen(x, y);
        const tile = this.add.image(sx, sy, `iso_tile_${tileVariants[y][x]}`);
        tile.setOrigin(0.5, 0.5);
        tile.setDepth(y * 100 + x);
      }
    }
  }

  drawDecorations() {
    for (const d of this.mapData.decorations) {
      const { x: sx, y: sy } = this.isoToScreen(d.x, d.y);
      const sprite = this.add.image(sx, sy, `iso_env_${d.tileId}`);
      sprite.setOrigin(0.5, 0.85);
      sprite.setDepth(d.y * 100 + d.x + 5);
    }
  }

  markSpawn() {
    const { x: sx, y: sy } = this.isoToScreen(this.mapData.spawn.x, this.mapData.spawn.y);
    const ring = this.add.graphics();
    ring.lineStyle(3, 0xffd750, 0.9);
    ring.strokeCircle(sx, sy - 6, 30);
    ring.fillStyle(0xffd750, 0.15);
    ring.fillCircle(sx, sy - 6, 30);
    ring.setDepth(this.mapData.spawn.y * 100 + this.mapData.spawn.x + 90);

    // Pulse animation
    this.tweens.add({
      targets: ring,
      alpha: { from: 1, to: 0.4 },
      duration: 900,
      yoyo: true,
      repeat: -1,
    });
  }

  setupCamera() {
    const cam = this.cameras.main;

    // Drag pan.
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
      cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
    });

    // Wheel zoom.
    this.input.on('wheel', (_p, _g, _dx, dy) => {
      const next = cam.zoom + (dy > 0 ? -0.1 : 0.1);
      cam.setZoom(Phaser.Math.Clamp(next, 0.3, 2.5));
    });

    cam.setZoom(0.5);

    // Center on spawn so player starts looking at their castle spot.
    const { x: sx, y: sy } = this.isoToScreen(this.mapData.spawn.x, this.mapData.spawn.y);
    cam.centerOn(sx, sy);
  }

  drawHUD(seed) {
    const mix = Object.entries(this.mapData.biomes || {})
      .sort((a, b) => b[1] - a[1])
      .map(([b, n]) => `${b[0].toUpperCase()}${b.slice(1, 3)}:${n}`)
      .join(' ');
    const lines = [
      `ISO MAP — seed:${String(seed).slice(0, 14)} — ${MAP_W}x${MAP_H}`,
      `biomes: ${mix}`,
      `drag to pan · wheel to zoom`,
    ];
    this.add
      .text(12, 12, lines.join('\n'), {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffd750',
        backgroundColor: '#000000aa',
        padding: { x: 6, y: 4 },
      })
      .setScrollFactor(0)
      .setDepth(99999);
  }
}
