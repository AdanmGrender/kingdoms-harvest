/**
 * IsoScene — renders a per-player procedural isometric map using Kenney medieval-rts.
 * Map is generated from player.telegram_id so each player sees the same world on reload.
 * Activate via URL param ?iso=1 or scene.start('IsoScene').
 */
import Phaser from 'phaser';
import useGameStore from '../../store/gameStore';
import { generateMap, RESOURCE_TYPES } from '../maps/IsoMapGenerator';

// Visual tile footprint (Kenney default-size tiles render 132x99px, 2:1 iso diamond).
const TILE_W = 132;
const TILE_H = 66;

const MAP_W = 28;
const MAP_H = 28;

const FOG_TINT = 0x202040;
const FOG_ALPHA = 0.55;

const RESOURCE_BADGE_COLORS = {
  [RESOURCE_TYPES.WOOD]:  0x8b5a2b,
  [RESOURCE_TYPES.STONE]: 0xaaaaaa,
  [RESOURCE_TYPES.IRON]:  0x6ec1ff,
  [RESOURCE_TYPES.WHEAT]: 0xf5d742,
};

const pad2 = (n) => String(n).padStart(2, '0');

export default class IsoScene extends Phaser.Scene {
  constructor() {
    super({ key: 'IsoScene' });
  }

  preload() {
    const basePath = '/assets/kenney-medieval/PNG/Default size';

    // 58 terrain tiles.
    for (let i = 1; i <= 58; i++) {
      this.load.image(`iso_tile_${i}`, `${basePath}/Tile/medievalTile_${pad2(i)}.png`);
    }
    // 21 environment sprites.
    for (let i = 1; i <= 21; i++) {
      this.load.image(`iso_env_${i}`, `${basePath}/Environment/medievalEnvironment_${pad2(i)}.png`);
    }
    // 23 structure sprites.
    for (let i = 1; i <= 23; i++) {
      this.load.image(`iso_struct_${i}`, `${basePath}/Structure/medievalStructure_${pad2(i)}.png`);
    }

    this.load.on('loaderror', (file) => {
      console.error('[IsoScene] Failed to load:', file.key, file.url);
    });
  }

  create() {
    const cam = this.cameras.main;
    cam.setBackgroundColor('#0e1420');

    const player = useGameStore.getState().player;
    const seed = player?.telegram_id ?? player?.id ?? `preview-${Date.now()}`;

    this.mapData = generateMap({ seed, width: MAP_W, height: MAP_H });

    this.originX = cam.width / 2;
    this.originY = cam.height / 4;

    this.drawTerrain();
    this.drawStructures();
    this.drawDecorations();
    this.drawResources();
    this.applyFog();
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

  /** Stores each terrain sprite by key "x,y" so fog can tint them in one pass. */
  drawTerrain() {
    this.terrainSprites = new Map();
    const { tileVariants, width, height } = this.mapData;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const { x: sx, y: sy } = this.isoToScreen(x, y);
        const tile = this.add.image(sx, sy, `iso_tile_${tileVariants[y][x]}`);
        tile.setOrigin(0.5, 0.5);
        tile.setDepth(y * 100 + x);
        this.terrainSprites.set(`${x},${y}`, tile);
      }
    }
  }

  drawStructures() {
    this.structureSprites = [];
    for (const s of this.mapData.structures) {
      const { x: sx, y: sy } = this.isoToScreen(s.x, s.y);
      const sprite = this.add.image(sx, sy, `iso_struct_${s.tileId}`);
      sprite.setOrigin(0.5, 0.9);
      sprite.setDepth(s.y * 100 + s.x + 10);
      sprite.setData('gridX', s.x);
      sprite.setData('gridY', s.y);
      this.structureSprites.push(sprite);
    }
  }

  drawDecorations() {
    this.decorSprites = [];
    for (const d of this.mapData.decorations) {
      const { x: sx, y: sy } = this.isoToScreen(d.x, d.y);
      const sprite = this.add.image(sx, sy, `iso_env_${d.tileId}`);
      sprite.setOrigin(0.5, 0.85);
      sprite.setDepth(d.y * 100 + d.x + 5);
      sprite.setData('gridX', d.x);
      sprite.setData('gridY', d.y);
      this.decorSprites.push(sprite);
    }
  }

  /** Resource nodes get a small color-coded badge to signal they're gatherable. */
  drawResources() {
    this.resourceSprites = [];
    for (const r of this.mapData.resources) {
      const { x: sx, y: sy } = this.isoToScreen(r.x, r.y);
      const sprite = this.add.image(sx, sy, `iso_env_${r.tileId}`);
      sprite.setOrigin(0.5, 0.85);
      sprite.setDepth(r.y * 100 + r.x + 6);

      const badge = this.add.circle(sx, sy - 32, 5, RESOURCE_BADGE_COLORS[r.type] || 0xffffff);
      badge.setStrokeStyle(1, 0x1a1408);
      badge.setDepth(r.y * 100 + r.x + 7);

      sprite.setData('gridX', r.x);
      sprite.setData('gridY', r.y);
      badge.setData('gridX', r.x);
      badge.setData('gridY', r.y);

      this.resourceSprites.push(sprite, badge);
    }
  }

  /** Dim tiles + props that fall outside visibility. */
  applyFog() {
    const { visibility } = this.mapData;
    const isHidden = (x, y) => !(visibility?.[y]?.[x]);

    for (const [key, sprite] of this.terrainSprites) {
      const [x, y] = key.split(',').map(Number);
      if (isHidden(x, y)) {
        sprite.setTint(FOG_TINT);
        sprite.setAlpha(FOG_ALPHA);
      }
    }
    const dimProps = (arr) => {
      for (const s of arr) {
        const gx = s.getData('gridX');
        const gy = s.getData('gridY');
        if (isHidden(gx, gy)) {
          if (s.setTint) s.setTint(FOG_TINT);
          s.setAlpha(FOG_ALPHA * 0.5);
        }
      }
    };
    dimProps(this.structureSprites);
    dimProps(this.decorSprites);
    dimProps(this.resourceSprites);
  }

  markSpawn() {
    const { x: sx, y: sy } = this.isoToScreen(this.mapData.spawn.x, this.mapData.spawn.y);
    const ring = this.add.graphics();
    ring.lineStyle(3, 0xffd750, 0.9);
    ring.strokeCircle(sx, sy - 6, 30);
    ring.fillStyle(0xffd750, 0.15);
    ring.fillCircle(sx, sy - 6, 30);
    ring.setDepth(this.mapData.spawn.y * 100 + this.mapData.spawn.x + 90);

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
    this.input.on('pointermove', (pointer) => {
      if (!pointer.isDown) return;
      cam.scrollX -= (pointer.x - pointer.prevPosition.x) / cam.zoom;
      cam.scrollY -= (pointer.y - pointer.prevPosition.y) / cam.zoom;
    });
    this.input.on('wheel', (_p, _g, _dx, dy) => {
      const next = cam.zoom + (dy > 0 ? -0.1 : 0.1);
      cam.setZoom(Phaser.Math.Clamp(next, 0.3, 2.5));
    });
    cam.setZoom(0.5);
    const { x: sx, y: sy } = this.isoToScreen(this.mapData.spawn.x, this.mapData.spawn.y);
    cam.centerOn(sx, sy);
  }

  drawHUD(seed) {
    const { structures, resources, roads, biomes } = this.mapData;
    const mix = Object.entries(biomes || {})
      .sort((a, b) => b[1] - a[1])
      .map(([b, n]) => `${b.slice(0, 3)}:${n}`)
      .join(' ');

    const resByType = resources.reduce((acc, r) => {
      acc[r.type] = (acc[r.type] || 0) + 1;
      return acc;
    }, {});
    const resStr = Object.entries(resByType).map(([t, n]) => `${t}:${n}`).join(' ');

    const lines = [
      `ISO MAP — seed:${String(seed).slice(0, 14)} — ${MAP_W}x${MAP_H}`,
      `biomes: ${mix}`,
      `roads:${roads.length}  structures:${structures.length}  resources: ${resStr}`,
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
